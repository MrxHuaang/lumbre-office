// El clima en pantalla. Lo decide el servidor (`state.weather`); acá solo se dibuja, y solo afuera
// (el jardín): lluvia con salpicaduras y charcos que aparecen de a poco, tormenta con relámpagos, sombras
// de nubes y niebla. Adentro basta un tono un poco más oscuro cuando llueve.
//
// Rinde con el render Canvas 2D: las gotas y salpicaduras son imágenes de un pool fijo (no se crean ni
// se destruyen mientras llueve), solo se mueven las que están a la vista de la cámara y la cantidad
// tiene tope. Con `prefers-reduced-motion`, un tercio de las gotas y sin destellos.
import { isBlockedTile, type OfficeMap } from "@hyvento/map";
import { cloudShadow, fogBank, noise, puddle, rainSplash, raindrop, RAIN_SLANT, SURROUND_PAD } from "@hyvento/map/art";
import type { Weather } from "@hyvento/shared";
import * as Phaser from "phaser";
import { duskAt } from "@/lib/cozy";
import { currentGameTime } from "./gameClock";
import { DEPTH_FLAT, DEPTH_OVERLAY, ensureTexture, worldToScreen } from "./iso/view";
import { emitAmbience, emitLightning, emitThunder } from "./weatherEvents";

/** Cuánto de cada efecto lleva cada clima afuera (0..1) y lo oscuro del tono (alpha del MULTIPLY). */
const OUTDOOR: Record<Weather, { rain: number; cloud: number; fog: number; dim: number }> = {
  despejado: { rain: 0, cloud: 0, fog: 0, dim: 0 },
  nublado: { rain: 0, cloud: 1, fog: 0, dim: 0.22 },
  lluvia: { rain: 0.6, cloud: 0.5, fog: 0, dim: 0.32 },
  tormenta: { rain: 1, cloud: 0.6, fog: 0, dim: 0.45 },
  niebla: { rain: 0, cloud: 0, fog: 1, dim: 0.1 },
  // Nieve: los copos los dibuja seasons.ts; acá, nubes y un poco de bruma.
  nieve: { rain: 0, cloud: 0.7, fog: 0.25, dim: 0.14 },
};
/**
 * Adentro, de día: solo un toque más oscuro con nubes o lluvia, en un tono tibio (el gris azulado de
 * afuera deja la madera triste). De noche nada: la casa ya tiene sus luces prendidas.
 */
const INDOOR_DIM: Record<Weather, number> = { despejado: 0, nublado: 0.04, lluvia: 0.08, tormenta: 0.12, niebla: 0, nieve: 0.05 };
/** Color del tono de afuera (gris azulado de día nublado) y del de adentro (sombra tibia), para el MULTIPLY. */
const DIM_COLOR = 0x6c7690;
const INDOOR_DIM_COLOR = 0x9a7a62;
/**
 * El atardecer (MULTIPLY): empieza dorado y termina anaranjado rosado, cada vez más oscuro, justo antes
 * del azul de la noche. Adentro llega apenas (entra por las ventanas).
 */
const DUSK = { from: 0xffd08a, to: 0xe8875a, alpha: 0.42, indoor: 0.3 };
/** Cada cuánto se vuelve a mirar la hora del juego para el atardecer (ms reales; 1 s = 1 minuto del juego). */
const DUSK_EVERY_MS = 1000;
/** Tope de gotas a la vez, y cuántos px² de vista toca a cada una. */
const MAX_DROPS = 320;
const PX_PER_DROP = 1500;
const MAX_SPLASHES = 48;
const SPLASH_FRAME_MS = 70;
/** Velocidad de caída (px de pantalla del mundo por ms). */
const DROP_SPEED = { lluvia: 0.32, tormenta: 0.46 };
const PUDDLES = 26;
/** Los charcos se llenan en ~1.5 min de lluvia fuerte y se secan en ~3 min. */
const PUDDLE_FILL_MS = 90_000;
const PUDDLE_DRY_MS = 180_000;
const CLOUDS = 5;
const CLOUD_SCALE = 5;
const FOGS = 7;
const FOG_SCALE = 4;
/** Cada cuánto cae un relámpago en la tormenta (ms, entre los dos). */
const LIGHTNING_EVERY: [number, number] = [6_000, 20_000];
/** Qué tan rápido va cada efecto hacia su objetivo (fracción por ms: ~8 s de punta a punta). */
const EASE_PER_MS = 1 / 8000;

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

interface Drop {
  img: Phaser.GameObjects.Image;
  on: boolean;
  /** Lo que le falta caer hasta el piso (px). */
  left: number;
}
interface Splash {
  img: Phaser.GameObjects.Image;
  t: number;
  on: boolean;
}
interface Drifter {
  img: Phaser.GameObjects.Image;
  speed: number;
  phase: number;
}

const approach = (v: number, target: number, step: number) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

export class WeatherView {
  private weather: Weather = "despejado";
  private map?: OfficeMap;
  private bounds?: Phaser.Geom.Rectangle;
  private outdoor = false;
  private night = false;
  /** Atardecer de la hora (0..1) y lo que se ve ahora (va hacia él de a poco, como el clima). */
  private duskTarget = 0;
  private dusk = 0;
  private duskElapsed = DUSK_EVERY_MS;
  private readonly calm = reducedMotion();
  /** Lo que se ve ahora de cada efecto (va hacia el objetivo del clima de a poco). */
  private level = { rain: 0, cloud: 0, fog: 0, dim: 0 };
  /** Lo que se llenaron los charcos (0 secos, 1 llenos). */
  private wet = 0;
  /** Oscurecido extra justo después de un relámpago (se va solo). */
  private flashDim = 0;
  private nextLightning = 0;
  private drops: Drop[] = [];
  private splashes: Splash[] = [];
  /** Objetos del nivel actual (se rehacen al cambiar de nivel). */
  private tint?: Phaser.GameObjects.Rectangle;
  private duskTint?: Phaser.GameObjects.Rectangle;
  private haze?: Phaser.GameObjects.Rectangle;
  private puddles: Phaser.GameObjects.Image[] = [];
  private clouds: Drifter[] = [];
  private fogs: Drifter[] = [];
  private areaObjects: Phaser.GameObjects.GameObject[] = [];
  private flashRect?: Phaser.GameObjects.Rectangle;

  constructor(private readonly scene: Phaser.Scene) {
    ensureTexture(scene, "clima-gota", () => raindrop(6));
    ensureTexture(scene, "clima-gota-fuerte", () => raindrop(9, true));
    for (const f of [0, 1, 2] as const) ensureTexture(scene, `clima-salpica-${f}`, () => rainSplash(f));
  }

  /** Nivel nuevo: se rehacen el tono, los charcos, las nubes y la niebla (solo afuera). */
  setArea(map: OfficeMap, bounds: Phaser.Geom.Rectangle) {
    for (const o of this.areaObjects) o.destroy();
    this.areaObjects = [];
    this.puddles = [];
    this.clouds = [];
    this.fogs = [];
    this.map = map;
    this.bounds = bounds;
    this.outdoor = map.outdoor;
    const P = SURROUND_PAD;
    this.tint = this.keep(
      this.scene.add
        .rectangle(bounds.centerX, bounds.centerY, bounds.width + P * 2, bounds.height + P * 2, this.outdoor ? DIM_COLOR : INDOOR_DIM_COLOR, 1)
        .setBlendMode(Phaser.BlendModes.MULTIPLY)
        .setDepth(DEPTH_OVERLAY - 2)
        .setAlpha(0)
        .setVisible(false),
    );
    this.duskTint = this.keep(
      this.scene.add
        .rectangle(bounds.centerX, bounds.centerY, bounds.width + P * 2, bounds.height + P * 2, DUSK.from, 1)
        .setBlendMode(Phaser.BlendModes.MULTIPLY)
        .setDepth(DEPTH_OVERLAY - 1)
        .setAlpha(0)
        .setVisible(false),
    );
    if (this.outdoor) {
      this.haze = this.keep(
        this.scene.add
          .rectangle(bounds.centerX, bounds.centerY, bounds.width + P * 2, bounds.height + P * 2, 0xf4ecdc, 1)
          .setDepth(DEPTH_OVERLAY - 4)
          .setAlpha(0)
          .setVisible(false),
      );
      this.placePuddles(map);
      this.placeDrifters();
    } else this.haze = undefined;
    for (const d of this.drops) this.hideDrop(d);
    for (const s of this.splashes) this.hideSplash(s);
    // Al entrar a un nivel el clima ya está puesto (sin esperar a que "llegue" la lluvia).
    this.snap();
    emitAmbience({ weather: this.weather, outdoor: this.outdoor });
  }

  /** Otro clima; `instant` = ponerlo de una (el primero que llega al conectarse), si no entra de a poco. */
  setWeather(w: Weather, instant = false) {
    if (w === "tormenta" && this.weather !== "tormenta") this.nextLightning = this.scene.time.now + 2500 + Math.random() * 4000;
    this.weather = w;
    if (instant) this.snap();
    emitAmbience({ weather: w, outdoor: this.outdoor });
  }

  /**
   * De noche adentro no se oscurece por el clima (las lámparas mandan); ese cambio entra de a poco. El
   * atardecer se apaga de una: la escena llama esto debajo del velo del cambio de noche, que lo tapa.
   */
  setNight(on: boolean) {
    this.night = on;
    if (on) this.dusk = this.duskTarget = 0;
  }

  private target() {
    if (this.outdoor) return OUTDOOR[this.weather];
    return { rain: 0, cloud: 0, fog: 0, dim: this.night ? 0 : INDOOR_DIM[this.weather] };
  }

  /** Pone todo en su objetivo de una (al cambiar de nivel o al conectarse). */
  private snap() {
    this.level = { ...this.target() };
    this.duskTarget = this.duskNow();
    this.dusk = this.duskTarget;
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.areaObjects.push(o);
    return o;
  }

  /** Charcos en tiles de camino o pasto (mismos para todos: salen del ruido del mapa). */
  private placePuddles(map: OfficeMap) {
    const ts = map.tileSize;
    const r = map.def.playable ?? { x: 0, y: 0, w: map.width, h: map.height };
    const spots: { x: number; y: number; n: number }[] = [];
    for (let ty = r.y; ty < r.y + r.h; ty++)
      for (let tx = r.x; tx < r.x + r.w; tx++) {
        const floor = map.floors[ty * map.width + tx];
        if ((floor !== "path" && floor !== "grass" && floor !== "soil") || isBlockedTile(map, tx, ty)) continue;
        // Los caminos juntan más agua que el pasto.
        const n = noise(tx, ty, 811) * (floor === "path" ? 0.5 : 1);
        if (n < 0.05) spots.push({ x: tx, y: ty, n });
      }
    spots.sort((a, b) => a.n - b.n);
    spots.slice(0, PUDDLES).forEach((s, i) => {
      const rx = 5 + Math.floor(noise(s.x, s.y, 812) * 8);
      const seed = Math.floor(noise(s.x, s.y, 813) * 4);
      const key = ensureTexture(this.scene, `clima-charco-${rx}-${seed}`, () => puddle(rx, seed));
      const p = worldToScreen((s.x + 0.3 + noise(s.x, s.y, 814) * 0.4) * ts, (s.y + 0.3 + noise(s.x, s.y, 815) * 0.4) * ts);
      const img = this.keep(this.scene.add.image(p.x, p.y, key).setDepth(DEPTH_FLAT - 1).setAlpha(0).setVisible(false));
      // Cada charco aparece a su turno: los primeros con poca lluvia, los últimos con el suelo empapado.
      img.setData("from", (i / PUDDLES) * 0.8);
      this.puddles.push(img);
    });
  }

  /** Sombras de nubes y bancos de niebla repartidos sobre el nivel (se mueven con el viento). */
  private placeDrifters() {
    const b = this.bounds!;
    for (let i = 0; i < CLOUDS; i++) {
      const key = ensureTexture(this.scene, `clima-nube-${i}`, () => cloudShadow(96, 48, 50 + i));
      const img = this.keep(
        this.scene.add
          .image(b.x + noise(i, 1, 901) * b.width, b.y + noise(i, 2, 901) * b.height, key)
          .setScale(CLOUD_SCALE)
          .setBlendMode(Phaser.BlendModes.MULTIPLY)
          .setDepth(DEPTH_OVERLAY - 5)
          .setAlpha(0)
          .setVisible(false),
      );
      this.clouds.push({ img, speed: 0.01 + noise(i, 3, 901) * 0.008, phase: 0 });
    }
    for (let i = 0; i < FOGS; i++) {
      const key = ensureTexture(this.scene, `clima-niebla-${i}`, () => fogBank(120, 40, 70 + i));
      const img = this.keep(
        this.scene.add
          .image(b.x + noise(i, 1, 902) * b.width, b.y + noise(i, 2, 902) * b.height, key)
          .setScale(FOG_SCALE)
          .setDepth(DEPTH_OVERLAY - 4)
          .setAlpha(0)
          .setVisible(false),
      );
      this.fogs.push({ img, speed: 0.004 + noise(i, 3, 902) * 0.004, phase: noise(i, 4, 902) * Math.PI * 2 });
    }
  }

  update(time: number, delta: number) {
    if (!this.map) return;
    const target = this.target();
    const step = delta * EASE_PER_MS;
    this.level.rain = approach(this.level.rain, target.rain, step);
    this.level.cloud = approach(this.level.cloud, target.cloud, step);
    this.level.fog = approach(this.level.fog, target.fog, step);
    this.level.dim = approach(this.level.dim, target.dim, step);
    this.flashDim = Math.max(0, this.flashDim - delta / 1200);

    const dim = Math.min(0.75, this.level.dim + this.flashDim);
    this.tint?.setVisible(dim > 0.002).setAlpha(dim);
    this.updateDusk(delta);
    this.updateRain(delta);
    this.updatePuddles(delta);
    this.updateDrifters(time, delta);
    if (this.weather === "tormenta") this.updateLightning(time);
  }

  // ---------- Atardecer ----------

  /** Atardecer según la hora del juego (la del servidor); sin reloj todavía o de noche, nada. */
  private duskNow(): number {
    const t = currentGameTime();
    return this.night || !t ? 0 : duskAt(t.hour, t.minute);
  }

  private updateDusk(delta: number) {
    this.duskElapsed += delta;
    if (this.duskElapsed >= DUSK_EVERY_MS) {
      this.duskElapsed = 0;
      this.duskTarget = this.duskNow();
    }
    this.dusk = approach(this.dusk, this.night ? 0 : this.duskTarget, delta * EASE_PER_MS);
    const a = this.dusk * DUSK.alpha * (this.outdoor ? 1 : DUSK.indoor);
    if (!this.duskTint) return;
    this.duskTint.setVisible(a > 0.002);
    if (a <= 0.002) return;
    this.duskTint.setAlpha(a).setFillStyle(Phaser.Display.Color.ObjectToColor(
      Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(DUSK.from),
        Phaser.Display.Color.ValueToColor(DUSK.to),
        100,
        Math.round(this.dusk * 100),
      ),
    ).color, 1);
  }

  // ---------- Lluvia ----------

  private updateRain(delta: number) {
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const heavy = this.weather === "tormenta";
    const want = this.outdoor
      ? Math.round(Math.min(MAX_DROPS, (view.width * view.height) / PX_PER_DROP) * this.level.rain * (this.calm ? 0.3 : 1))
      : 0;
    while (this.drops.length < want) {
      // La punta de la gota (abajo a la izquierda del dibujo) es la que toca el piso.
      const img = this.scene.add.image(0, 0, "clima-gota").setOrigin(0, 1).setDepth(DEPTH_OVERLAY - 3).setVisible(false);
      this.drops.push({ img, on: false, left: 0 });
    }
    const speed = (heavy ? DROP_SPEED.tormenta : DROP_SPEED.lluvia) * delta;
    const key = heavy ? "clima-gota-fuerte" : "clima-gota";
    let active = 0;
    for (const d of this.drops) {
      if (!d.on) {
        if (active < want) this.spawnDrop(d, view, key, true);
        else continue;
      }
      if (active >= want) {
        // Sobran (paró de llover o se alejó la cámara): se apagan al llegar al piso.
        d.left -= speed;
        d.img.y += speed;
        d.img.x -= speed * RAIN_SLANT;
        if (d.left <= 0) this.hideDrop(d);
        continue;
      }
      active++;
      d.left -= speed;
      d.img.y += speed;
      d.img.x -= speed * RAIN_SLANT;
      if (d.left <= 0) {
        if (!this.calm || Math.random() < 0.4) this.splashAt(d.img.x, d.img.y);
        this.spawnDrop(d, view, key, false);
      } else {
        // Se movió la cámara y la gota quedó lejos de la vista: se vuelve a tirar donde se ve.
        const gx = d.img.x - d.left * RAIN_SLANT;
        const gy = d.img.y + d.left;
        if (gx < view.x - 60 || gx > view.right + 60 || gy < view.y - 60 || gy > view.bottom + 80) this.spawnDrop(d, view, key, true);
      }
    }
    for (const s of this.splashes) {
      if (!s.on) continue;
      s.t += delta;
      const f = Math.floor(s.t / SPLASH_FRAME_MS);
      if (f > 2) this.hideSplash(s);
      else s.img.setTexture(`clima-salpica-${f}`);
    }
  }

  /** Gota nueva sobre la vista: cae hasta un punto del piso al azar. `midway` = ya venía cayendo. */
  private spawnDrop(d: Drop, view: Phaser.Geom.Rectangle, key: string, midway: boolean) {
    const fall = 40 + Math.random() * 90;
    const gx = view.x - 10 + Math.random() * (view.width + 20);
    const gy = view.y + Math.random() * (view.height + 20);
    const done = midway ? Math.random() * fall : 0;
    d.left = fall - done;
    d.img
      .setTexture(key)
      .setPosition(gx + d.left * RAIN_SLANT, gy - d.left)
      .setVisible(true);
    d.on = true;
  }

  private hideDrop(d: Drop) {
    d.on = false;
    d.img.setVisible(false);
  }

  private splashAt(x: number, y: number) {
    let s = this.splashes.find((q) => !q.on);
    if (!s) {
      if (this.splashes.length >= MAX_SPLASHES) return;
      s = { img: this.scene.add.image(0, 0, "clima-salpica-0").setDepth(DEPTH_OVERLAY - 3).setOrigin(0.5, 1), t: 0, on: false };
      this.splashes.push(s);
    }
    s.on = true;
    s.t = 0;
    s.img.setTexture("clima-salpica-0").setPosition(Math.round(x), Math.round(y)).setVisible(true);
  }

  private hideSplash(s: Splash) {
    s.on = false;
    s.img.setVisible(false);
  }

  private updatePuddles(delta: number) {
    // El suelo se moja aunque uno esté adentro: al salir, los charcos ya están.
    const rain = OUTDOOR[this.weather].rain;
    this.wet = rain > 0 ? Math.min(1, this.wet + (delta / PUDDLE_FILL_MS) * (0.4 + rain)) : Math.max(0, this.wet - delta / PUDDLE_DRY_MS);
    if (this.puddles.length === 0) return;
    for (const p of this.puddles) {
      const a = Math.max(0, Math.min(1, (this.wet - (p.getData("from") as number)) / 0.2));
      p.setVisible(a > 0.01).setAlpha(a);
    }
  }

  // ---------- Nubes y niebla ----------

  private updateDrifters(time: number, delta: number) {
    const b = this.bounds;
    if (!b) return;
    const slow = this.calm ? 0.5 : 1;
    const wrap = (img: Phaser.GameObjects.Image) => {
      const half = img.displayWidth / 2;
      if (img.x - half > b.right + SURROUND_PAD / 2) img.x = b.x - SURROUND_PAD / 2 - half;
    };
    const cloudAlpha = this.level.cloud * 0.55;
    for (const c of this.clouds) {
      c.img.setVisible(cloudAlpha > 0.01).setAlpha(cloudAlpha);
      if (cloudAlpha <= 0.01) continue;
      // Viento del oeste: las nubes van a la derecha y un poco hacia abajo en pantalla.
      c.img.x += c.speed * delta * slow;
      c.img.y += c.speed * delta * slow * 0.15;
      if (c.img.y > b.bottom) c.img.y = b.y;
      wrap(c.img);
    }
    const fog = this.level.fog;
    this.haze?.setVisible(fog > 0.01).setAlpha(fog * 0.14);
    for (const f of this.fogs) {
      const a = fog * (0.75 + 0.25 * Math.sin(time / 6000 + f.phase));
      f.img.setVisible(a > 0.01).setAlpha(a);
      if (a <= 0.01) continue;
      f.img.x += f.speed * delta * slow;
      f.img.y += Math.sin(time / 9000 + f.phase) * 0.004 * delta * slow;
      wrap(f.img);
    }
  }

  // ---------- Relámpagos ----------

  private updateLightning(time: number) {
    if (!this.nextLightning) this.nextLightning = time + Phaser.Math.Between(...LIGHTNING_EVERY);
    if (time < this.nextLightning) return;
    this.nextLightning = time + Phaser.Math.Between(...LIGHTNING_EVERY);
    const strength = 0.4 + Math.random() * 0.6;
    const indoor = !this.outdoor;
    emitLightning({ strength, indoor });
    if (!this.calm && this.outdoor) {
      // Doble destello corto y después un momento más oscuro.
      this.flash(0.55 * strength, 70);
      this.scene.time.delayedCall(140, () => this.outdoor && this.flash(0.4 * strength, 120));
      this.scene.time.delayedCall(260, () => (this.flashDim = 0.25 * strength));
    } else if (!this.calm) {
      this.flashDim = 0.08 * strength;
    }
    // El trueno llega después: más cerca (más fuerte), antes.
    this.scene.time.delayedCall(300 + (1 - strength) * 2200, () => emitThunder({ strength, indoor: !this.outdoor }));
  }

  /**
   * Destello blanco sobre lo que muestra la cámara (encima de la noche, así también se ve de noche). Un
   * rectángulo propio en vez de `camera.flash`, que arranca a pantalla blanca entera y encandila.
   */
  private flash(alpha: number, ms: number) {
    const v = this.scene.cameras.main.worldView;
    this.flashRect ??= this.scene.add.rectangle(0, 0, 1, 1, 0xeef2ff).setOrigin(0, 0).setDepth(DEPTH_OVERLAY + 5);
    const r = this.flashRect;
    this.scene.tweens.killTweensOf(r);
    r.setPosition(v.x - 20, v.y - 20).setSize(v.width + 40, v.height + 40).setAlpha(alpha).setVisible(true);
    this.scene.tweens.add({ targets: r, alpha: 0, duration: ms, onComplete: () => r.setVisible(false) });
  }

  destroy() {
    this.flashRect?.destroy();
    this.flashRect = undefined;
    for (const o of this.areaObjects) o.destroy();
    for (const d of this.drops) d.img.destroy();
    for (const s of this.splashes) s.img.destroy();
    this.areaObjects = [];
    this.drops = [];
    this.splashes = [];
    this.puddles = [];
    this.clouds = [];
    this.fogs = [];
    this.map = undefined;
  }
}
