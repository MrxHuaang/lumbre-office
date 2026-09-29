// Las estaciones en pantalla (solo afuera, en el jardín): un tono del terreno según la estación, lo que
// queda en el pasto (hojarasca en otoño, florcitas en primavera, manchas de nieve en invierno) y lo que
// cae (copos cuando nieva, hojas en otoño, pétalos en primavera). La estación sale de la fecha
// (`seasonOf`, igual para todos) y la nieve del clima del servidor (`state.weather`).
//
// Como la lluvia (weather.ts), rinde con el render Canvas 2D: un pool fijo de imágenes con tope, solo se
// mueven las que están a la vista y con `prefers-reduced-motion` cae un tercio.
import { isBlockedTile, type OfficeMap } from "@hyvento/map";
import { fallingLeaf, fallingPetal, flowerTuft, leafLitter, noise, snowflake, snowPatch, SURROUND_PAD } from "@hyvento/map/art";
import { seasonOf, type Season, type Weather } from "@hyvento/shared";
import * as Phaser from "phaser";
import { DEPTH_FLAT, DEPTH_OVERLAY, ensureTexture, worldToScreen } from "./iso/view";
import { lessMotion } from "@/lib/prefs";

/** Tono del terreno por estación: color, modo y opacidad (0 = sin tono). */
const TINT: Record<Season, { color: number; mode: "multiply" | "screen"; alpha: number }> = {
  primavera: { color: 0xeaffd8, mode: "multiply", alpha: 0 },
  verano: { color: 0xfff0c4, mode: "multiply", alpha: 0.18 },
  otono: { color: 0xe8b070, mode: "multiply", alpha: 0.4 },
  invierno: { color: 0x98a8c4, mode: "screen", alpha: 0.32 },
};
/** Lo que cae: cuántos a la vez como mucho y cuántos px² de vista le tocan a cada uno. */
const MAX_FLAKES = 180;
const PX_PER_FLAKE = 1800;
const LEAVES = { calm: 12, windy: 22 };
const PETALS = 12;
/** Cosas en el pasto (hojarasca o florcitas) y manchas de nieve. */
const DECALS = 90;
const SNOW_PATCHES = 30;
/** La nieve cubre el piso en ~2 min nevando y se derrite en ~5; en invierno siempre queda un poco. */
const SNOW_FILL_MS = 120_000;
const SNOW_MELT_MS = 300_000;
const WINTER_COVER = 0.3;
const EASE_PER_MS = 1 / 8000;


type Kind = "snow" | "leaf" | "petal";
interface Faller {
  img: Phaser.GameObjects.Image;
  kind: Kind;
  on: boolean;
  /** Lo que le falta caer (px) y a qué velocidad (px/ms). */
  left: number;
  vy: number;
  /** Deriva de lado (px/ms), vaivén y cambio de cuadro (hojas y pétalos dan vueltas). */
  vx: number;
  phase: number;
  flipIn: number;
  frame: 0 | 1;
  variant: number;
}

const approach = (v: number, target: number, step: number) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

export class SeasonView {
  private season: Season = seasonOf(Date.now());
  private weather: Weather = "despejado";
  private outdoor = false;
  private get calm() {
    return lessMotion();
  }
  /** Cuánto se ve de la nieve que cae (va hacia el objetivo de a poco) y cuánto cubre el piso. */
  private snowing = 0;
  private cover = 0;
  private nextSeasonCheck = 0;
  private fallers: Faller[] = [];
  private tint?: Phaser.GameObjects.Rectangle;
  private patches: Phaser.GameObjects.Image[] = [];
  private areaObjects: Phaser.GameObjects.GameObject[] = [];
  private map?: OfficeMap;
  private bounds?: Phaser.Geom.Rectangle;

  constructor(private readonly scene: Phaser.Scene) {}

  /** La estación de ahora (el chip del HUD la calcula igual). */
  get current(): Season {
    return this.season;
  }

  /** Nivel nuevo: se rehacen el tono y lo del pasto (solo afuera). */
  setArea(map: OfficeMap, bounds: Phaser.Geom.Rectangle) {
    this.map = map;
    this.bounds = bounds;
    this.outdoor = map.outdoor;
    this.rebuild();
    this.snowing = this.weather === "nieve" ? 1 : 0;
    this.cover = this.season === "invierno" ? Math.max(WINTER_COVER, this.weather === "nieve" ? 1 : 0) : 0;
  }

  setWeather(w: Weather, instant = false) {
    this.weather = w;
    if (instant) this.snowing = w === "nieve" ? 1 : 0;
  }

  private rebuild() {
    for (const o of this.areaObjects) o.destroy();
    this.areaObjects = [];
    this.patches = [];
    for (const f of this.fallers) this.hide(f);
    const map = this.map;
    const b = this.bounds;
    if (!map || !b || !this.outdoor) return;
    const t = TINT[this.season];
    if (t.alpha > 0) {
      const P = SURROUND_PAD;
      // Justo encima del terreno y del bosque de alrededor, debajo de los muebles y de las personas.
      this.tint = this.keep(
        this.scene.add
          .rectangle(b.centerX, b.centerY, b.width + P * 2, b.height + P * 2, t.color, 1)
          .setBlendMode(t.mode === "screen" ? Phaser.BlendModes.SCREEN : Phaser.BlendModes.MULTIPLY)
          .setDepth(DEPTH_FLAT - 3)
          .setAlpha(t.alpha),
      );
    } else this.tint = undefined;
    this.placeDecals(map);
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.areaObjects.push(o);
    return o;
  }

  /** Tiles de pasto libres (los mismos para todos: salen del ruido del mapa), ordenados por el ruido. */
  private grassSpots(map: OfficeMap, seed: number) {
    const r = map.def.playable ?? { x: 0, y: 0, w: map.width, h: map.height };
    const spots: { x: number; y: number; n: number }[] = [];
    for (let ty = r.y; ty < r.y + r.h; ty++)
      for (let tx = r.x; tx < r.x + r.w; tx++) {
        if (map.floors[ty * map.width + tx] !== "grass" || isBlockedTile(map, tx, ty)) continue;
        const n = noise(tx, ty, seed);
        if (n < 0.06) spots.push({ x: tx, y: ty, n });
      }
    return spots.sort((a, c) => a.n - c.n);
  }

  /** Hojarasca (otoño), florcitas (primavera) o manchas de nieve (invierno) en el pasto. */
  private placeDecals(map: OfficeMap) {
    const ts = map.tileSize;
    const at = (s: { x: number; y: number }, k: number) =>
      worldToScreen((s.x + 0.2 + noise(s.x, s.y, k) * 0.6) * ts, (s.y + 0.2 + noise(s.x, s.y, k + 1) * 0.6) * ts);
    if (this.season === "otono" || this.season === "primavera") {
      const autumn = this.season === "otono";
      for (const s of this.grassSpots(map, autumn ? 931 : 941).slice(0, DECALS)) {
        const seed = Math.floor(noise(s.x, s.y, 932) * 6);
        const key = ensureTexture(this.scene, `estacion-${autumn ? "hojarasca" : "flores"}-${seed}`, () => (autumn ? leafLitter(seed) : flowerTuft(seed)));
        const p = at(s, 933);
        this.keep(this.scene.add.image(p.x, p.y, key).setDepth(DEPTH_FLAT - 2));
      }
    }
    if (this.season === "invierno") {
      this.grassSpots(map, 951)
        .slice(0, SNOW_PATCHES)
        .forEach((s, i) => {
          const rx = 6 + Math.floor(noise(s.x, s.y, 952) * 8);
          const seed = Math.floor(noise(s.x, s.y, 953) * 4);
          const key = ensureTexture(this.scene, `estacion-nieve-${rx}-${seed}`, () => snowPatch(rx, seed));
          const p = at(s, 954);
          const img = this.keep(this.scene.add.image(p.x, p.y, key).setDepth(DEPTH_FLAT - 2).setAlpha(0).setVisible(false));
          // Cada mancha aparece a su turno: las primeras siempre, las últimas con la nevada fuerte.
          img.setData("from", (i / SNOW_PATCHES) * 0.85);
          this.patches.push(img);
        });
    }
  }

  update(time: number, delta: number) {
    if (!this.map) return;
    if (time >= this.nextSeasonCheck) {
      // A la medianoche de fin de mes cambia la estación: se revisa cada minuto.
      this.nextSeasonCheck = time + 60_000;
      const s = seasonOf(Date.now());
      if (s !== this.season) {
        this.season = s;
        this.rebuild();
      }
    }
    const snow = this.weather === "nieve";
    this.snowing = approach(this.snowing, snow ? 1 : 0, delta * EASE_PER_MS);
    const floor = this.season === "invierno" ? WINTER_COVER : 0;
    this.cover = snow ? Math.min(1, this.cover + delta / SNOW_FILL_MS) : Math.max(floor, this.cover - delta / SNOW_MELT_MS);
    for (const p of this.patches) {
      const a = Math.max(0, Math.min(1, (this.cover - (p.getData("from") as number)) / 0.2));
      p.setVisible(a > 0.01).setAlpha(a);
    }
    this.updateFalling(time, delta);
  }

  /** Cuántos de cada cosa caen ahora a la vista. */
  private wanted(view: Phaser.Geom.Rectangle): Record<Kind, number> {
    if (!this.outdoor) return { snow: 0, leaf: 0, petal: 0 };
    const k = this.calm ? 0.3 : 1;
    const wet = this.weather === "lluvia" || this.weather === "tormenta";
    return {
      snow: Math.round(Math.min(MAX_FLAKES, (view.width * view.height) / PX_PER_FLAKE) * this.snowing * k),
      // Con lluvia y viento se desprenden más hojas; con nieve, ya no quedan.
      leaf: this.season === "otono" && this.snowing < 0.05 ? Math.round((wet ? LEAVES.windy : LEAVES.calm) * k) : 0,
      petal: this.season === "primavera" && !wet ? Math.round(PETALS * k) : 0,
    };
  }

  private updateFalling(time: number, delta: number) {
    const view = this.scene.cameras.main.worldView;
    const want = this.wanted(view);
    const active: Record<Kind, number> = { snow: 0, leaf: 0, petal: 0 };
    for (const f of this.fallers) if (f.on) active[f.kind]++;
    for (const kind of ["snow", "leaf", "petal"] as const) {
      for (let n = active[kind]; n < want[kind]; n++) {
        const f = this.fallers.find((q) => !q.on) ?? this.newFaller();
        if (!f) break;
        this.spawn(f, kind, view, true);
      }
    }
    const count: Record<Kind, number> = { snow: 0, leaf: 0, petal: 0 };
    for (const f of this.fallers) {
      if (!f.on) continue;
      const extra = ++count[f.kind] > want[f.kind];
      const dy = f.vy * delta;
      f.left -= dy;
      f.img.y += dy;
      f.img.x += (f.vx + Math.sin(time / (f.kind === "snow" ? 900 : 500) + f.phase) * (f.kind === "snow" ? 0.012 : 0.03)) * delta;
      if (f.kind !== "snow") {
        f.flipIn -= delta;
        if (f.flipIn <= 0) {
          // Da vueltas: de plano a de canto y al revés, volteándose.
          f.frame = f.frame === 0 ? 1 : 0;
          f.flipIn = 180 + noise(f.variant, time, 961) * 260;
          f.img.setTexture(this.key(f.kind, f.variant, f.frame)).setFlipX(f.frame === 0 ? !f.img.flipX : f.img.flipX);
        }
      }
      if (f.left <= 0) {
        // Tocó el piso: si sobra, se apaga; si no, vuelve a caer desde arriba de la vista.
        if (extra) this.hide(f);
        else this.spawn(f, f.kind, view, false);
      } else if (f.img.x < view.x - 80 || f.img.x > view.right + 80 || f.img.y > view.bottom + 80 || f.img.y < view.y - 200) {
        // La cámara se movió y quedó lejos: se vuelve a tirar donde se ve.
        if (extra) this.hide(f);
        else this.spawn(f, f.kind, view, true);
      }
    }
  }

  private key(kind: Kind, variant: number, frame: 0 | 1): string {
    if (kind === "snow") return ensureTexture(this.scene, `estacion-copo-${variant}`, () => snowflake(variant === 1 ? 1 : 0));
    if (kind === "leaf") return ensureTexture(this.scene, `estacion-hoja-${variant}-${frame}`, () => fallingLeaf(variant, frame));
    return ensureTexture(this.scene, `estacion-petalo-${variant}-${frame}`, () => fallingPetal(variant, frame));
  }

  private newFaller(): Faller | undefined {
    if (this.fallers.length >= MAX_FLAKES + LEAVES.windy + PETALS) return undefined;
    const img = this.scene.add.image(0, 0, this.key("snow", 0, 0)).setOrigin(0.5, 1).setDepth(DEPTH_OVERLAY - 3).setVisible(false);
    const f: Faller = { img, kind: "snow", on: false, left: 0, vy: 0, vx: 0, phase: 0, flipIn: 0, frame: 0, variant: 0 };
    this.fallers.push(f);
    return f;
  }

  /** Algo nuevo cayendo sobre la vista hasta un punto del piso al azar. `midway` = ya venía cayendo. */
  private spawn(f: Faller, kind: Kind, view: Phaser.Geom.Rectangle, midway: boolean) {
    const snow = kind === "snow";
    const fall = snow ? 50 + Math.random() * 140 : 90 + Math.random() * 160;
    const gx = view.x - 20 + Math.random() * (view.width + 40);
    const gy = view.y + Math.random() * (view.height + 30);
    const done = midway ? Math.random() * fall : 0;
    f.kind = kind;
    f.left = fall - done;
    f.vy = snow ? 0.025 + Math.random() * 0.03 : 0.018 + Math.random() * 0.018;
    // Viento del oeste, como las nubes: todo se corre un poco a la derecha.
    f.vx = snow ? 0.004 + Math.random() * 0.006 : 0.01 + Math.random() * 0.02;
    f.phase = Math.random() * Math.PI * 2;
    f.frame = 0;
    f.flipIn = 150 + Math.random() * 300;
    f.variant = snow ? (Math.random() < 0.25 ? 1 : 0) : Math.floor(Math.random() * (kind === "leaf" ? 4 : 3));
    f.img
      .setTexture(this.key(kind, f.variant, 0))
      .setFlipX(Math.random() < 0.5)
      .setPosition(gx - f.left * (f.vx / f.vy), gy - f.left)
      .setVisible(true);
    f.on = true;
  }

  private hide(f: Faller) {
    f.on = false;
    f.img.setVisible(false);
  }

  destroy() {
    for (const o of this.areaObjects) o.destroy();
    for (const f of this.fallers) f.img.destroy();
    this.areaObjects = [];
    this.fallers = [];
    this.patches = [];
    this.map = undefined;
  }
}
