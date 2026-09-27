// Casa viva (cliente): lo que se ve y se oye al usar los muebles chicos. Fuego animado en la fogata y
// las chimeneas (con chispas, luz cálida que titila y el crepitar), la radio con su música, las cortinas
// cerradas, lo que avanza para todos (puzle, pizarra, caballete), la luz de "ocupado" de los baños y lo
// que se lleva un rato en la mano (libro, regadera, malvavisco). Lo usa usables.ts: aquí no hay reglas,
// solo dibujo y sonido (las reglas las valida el servidor).
import { catalogItem, curtainFeature, curtainsOf, footprint, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import {
  curtainClosed,
  flame,
  FLAME_FRAMES,
  globeSpin,
  glowSprite,
  musicNote,
  NOTE_COLORS,
  openBook,
  progressLayer,
  roastStick,
  soapBubble,
  spark,
  stallLight,
  waterDrop,
  wateringCan,
  WORLD_TO_ART,
  type FlameSize,
  type PixelCanvas,
  type Sprite,
} from "@hyvento/map/art";
import { bookTitle, CASA, counterMax, CURTAIN_TYPE, furnitureKey, isFreeHold, usableSpec, type Direction, type FurnitureEvent } from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import * as Phaser from "phaser";
import { COZY, cozyFontFamily } from "@/lib/cozy";
import type { Avatar } from "./Avatar";
import {
  playChalk,
  playClack,
  playCoffee,
  playCurtain,
  playFridge,
  playGlobe,
  playGot,
  playPage,
  playSizzle,
  playSnap,
  playStall,
  playSwitch,
  playTv,
  playWash,
  playWater,
  playWhoosh,
  setFireCrackle,
  setRadioMusic,
  stopFireCrackle,
  stopRadioMusic,
} from "./casaSonidos";
import { DEPTH_OVERLAY, depthOf, ensureTexture, worldToScreen, type AreaView } from "./iso/view";
import type { OfficeRoom } from "./network";
import { useOfficeStore } from "./store";

/** Lo que casaViva necesita de usables.ts (el nivel, la sala, los avatares y cómo se oye cada mueble). */
export interface CasaHost {
  map(): OfficeMap | undefined;
  room(): OfficeRoom | undefined;
  avatarOf(sessionId: string): Avatar | undefined;
  local(): Avatar | undefined;
  /** Volumen con que se oye el mueble desde (x, y), rodeando paredes (hearVolume de usables.ts). */
  hear(f: PlacedFurniture, x: number, y: number): number;
  isOn(f: PlacedFurniture): boolean;
}

const FIRE_TYPES = new Set(["fire-pit", "fireplace", "fireplace-stone"]);
const STALL_TYPES = new Set(["toilet-stall", "bath-stall"]);
const PROGRESS_TYPES = new Set(["puzzle-table", "cafe-sign", "easel"]);
const LAMP_SOUND = new Set(["lamp", "lamp-mushroom", "reading-lamp", "lamp-post", "garden-lantern", "dock-lamp", "wall-sconce", "record-player", "radio"]);
/** Cómo se dice lo que salió de la nevera o la cafetera. */
const GIFT_TEXT: Record<string, string> = { jugo: "¡Un jugo!", manzana: "¡Una manzana!", banano: "¡Un banano!", aguapanela: "¡Un agua de panela!", malvavisco: "¡Malvavisco dorado!" };
/** Cuánto "más lejos" cuenta una cortina al elegir qué ofrece E (tiles; ver `nearest` en usables.ts). */
export const CURTAIN_PENALTY_TILES = 0.75;
/** Hasta dónde se oye el fuego (el volumen de `hear` se eleva a esta potencia: se oye de más cerca). */
const FIRE_HEAR_POW = 2.2;
/**
 * La radio suena como el tocadiscos (usables.ts): plena en toda la habitación donde está y, afuera,
 * bajito rodeando las paredes por las puertas.
 */
const ROOM_MUSIC_VOLUME = 0.85;
const OUTSIDE_ROOM_FACTOR = 0.35;

/** Habitación que contiene el tile (la última que lo cubre, como en build.ts). */
function roomOf(map: OfficeMap, x: number, y: number): string | undefined {
  const rooms = map.def.rooms;
  for (let i = rooms.length - 1; i >= 0; i--) {
    const r = rooms[i]!.rect;
    if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return rooms[i]!.id;
  }
  return undefined;
}

interface Fire {
  f: PlacedFurniture;
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  size: FlameSize;
  stokedUntil: number;
  frame: number;
}

/** Algo que se lleva un rato en la mano y sigue al avatar (libro, regadera, palito del malvavisco). */
interface Prop {
  who: Avatar;
  img: Phaser.GameObjects.Image;
  until: number;
  /** Dónde va respecto de los pies (de frente) y si apunta hacia donde mira (se voltea). */
  dx: number;
  dy: number;
  pointing: boolean;
  onFrame?: (elapsed: number) => void;
  start: number;
}

/** Hacia dónde mirar para quedar de frente al mueble (igual que usables.ts). */
function faceToward(f: PlacedFurniture, ts: number, x: number, y: number): Direction {
  const dx = (f.x + f.w / 2) * ts - x;
  const dy = (f.y + f.d / 2) * ts - y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

export class CasaViva {
  private map?: OfficeMap;
  private fires: Fire[] = [];
  private fireTimer?: Phaser.Time.TimerEvent;
  private stallLights = new Map<string, { f: PlacedFurniture; img: Phaser.GameObjects.Image; busy?: boolean }>();
  private progress = new Map<string, { f: PlacedFurniture; img?: Phaser.GameObjects.Image; n: number }>();
  private props: Prop[] = [];
  private radios: PlacedFurniture[] = [];
  /** Quiénes están adentro de un cubículo (sesiones escondidas) y si yo estoy. */
  private inStall = new Set<string>();
  private detach: (() => void)[] = [];
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: CasaHost,
  ) {}

  // ---------- Nivel y sala ----------

  /** La vista del nivel (las capas pegadas a muebles se registran ahí para el modo privado). */
  private view?: AreaView;

  setArea(map: OfficeMap, view?: AreaView) {
    this.clear();
    this.map = map;
    this.view = view;
    this.curtainRects = undefined;
    for (const f of map.furniture) {
      if (FIRE_TYPES.has(f.type)) this.addFire(f);
      if (STALL_TYPES.has(f.type)) this.addStallLight(f);
      if (PROGRESS_TYPES.has(f.type)) this.progress.set(furnitureKey(map.id, f.type, f.x, f.y), { f, n: 0 });
      if (f.type === "radio") this.radios.push(f);
    }
    if (this.fires.length) {
      this.fireTimer = this.scene.time.addEvent({ delay: 110, loop: true, callback: () => this.animateFires() });
    }
    this.refreshCounters();
    this.refreshStalls();
  }

  bind(room: OfficeRoom) {
    this.unbind();
    const $ = getStateCallbacks(room);
    const watch = (field: "counters" | "stalls", again: () => void) =>
      this.detach.push(
        $(room.state).listen(field, (m) => {
          if (!m) return;
          const m$ = $(m as never) as unknown as { onAdd(cb: () => void): () => void; onChange(cb: () => void): () => void; onRemove(cb: () => void): () => void };
          this.detach.push(m$.onAdd(again), m$.onChange(again), m$.onRemove(again));
          again();
        }),
      );
    watch("counters", () => this.refreshCounters());
    watch("stalls", () => this.refreshStalls());
  }

  unbind() {
    this.detach.forEach((d) => d());
    this.detach = [];
  }

  destroy() {
    this.unbind();
    this.clear();
    stopFireCrackle();
    stopRadioMusic();
  }

  private clear() {
    this.fireTimer?.remove();
    this.fireTimer = undefined;
    for (const o of this.objects) o.destroy();
    this.objects = [];
    for (const p of this.props) p.img.destroy();
    this.props = [];
    this.fires = [];
    this.stallLights.clear();
    for (const p of this.progress.values()) p.img?.destroy();
    this.progress.clear();
    this.radios = [];
  }

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objects.push(o);
    return o;
  }

  /** Punto local del dibujo del mueble (arte, mirando a +x) en pantalla, según hacia dónde mira. */
  private localPoint(f: PlacedFurniture, lx: number, ly: number, lz: number) {
    const ts = this.map!.tileSize;
    const item = catalogItem(f.type);
    const flip = !item.fixed && (f.facing === "down" || f.facing === "up");
    const local = flip ? { x: ly, y: lx } : { x: lx, y: ly };
    return worldToScreen(f.x * ts + local.x / WORLD_TO_ART, f.y * ts + local.y / WORLD_TO_ART, lz);
  }

  private furnitureDepth(f: PlacedFurniture) {
    const ts = this.map!.tileSize;
    const [w, d] = footprint(catalogItem(f.type), f.facing);
    return depthOf((f.x + w / 2) * ts, (f.y + d / 2) * ts);
  }

  /** ¿Se ve de espaldas? (entonces la capa no se pone: el frente no se ve). */
  private isBack(f: PlacedFurniture) {
    return (f.facing === "left" || f.facing === "up") && Boolean(catalogItem(f.type).hasBack);
  }

  /** Capa sobre el dibujo del mueble (mismo lugar, volteo y profundidad; ver `layer` en usables.ts). */
  private layer(f: PlacedFurniture, key: string, s: Sprite, lift = 0.01) {
    const ts = this.map!.tileSize;
    const item = catalogItem(f.type);
    const flip = !item.fixed && (f.facing === "down" || f.facing === "up");
    const a = worldToScreen(f.x * ts, f.y * ts);
    ensureTexture(this.scene, key, () => s.canvas);
    return this.scene.add
      .image(a.x - (flip ? s.canvas.width - s.ox : s.ox), a.y - s.oy, key)
      .setOrigin(0, 0)
      .setFlipX(flip)
      .setDepth(this.furnitureDepth(f) + lift);
  }

  // ---------- Fuego ----------

  private flameKey(size: FlameSize, frame: number) {
    const key = `casa-llama-${size}-${frame}`;
    if (!this.scene.textures.exists(key)) {
      const s = flame(frame, size);
      ensureTexture(this.scene, key, () => s.canvas);
      this.scene.registry.set(`${key}-origen`, [s.ox / s.canvas.width, s.oy / s.canvas.height]);
    }
    return key;
  }

  private addFire(f: PlacedFurniture) {
    if (this.isBack(f)) return;
    const pit = f.type === "fire-pit";
    const light = catalogItem(f.type).light;
    const [lx, ly] = pit ? [16, 16] : (light?.at ?? [8, 8]);
    const base = this.localPoint(f, lx, ly, pit ? 3 : 2);
    const size: FlameSize = pit ? "pit" : "hearth";
    const key = this.flameKey(size, 0);
    const [ox, oy] = this.scene.registry.get(`${key}-origen`) as [number, number];
    const img = this.track(this.scene.add.image(base.x, base.y, key).setOrigin(ox, oy).setDepth(this.furnitureDepth(f) + 0.02));
    // Luz cálida que titila (también de día, suave): la de noche del catálogo queda debajo.
    const r = pit ? 46 : 30;
    const gkey = ensureTexture(this.scene, `casa-calor-${r}`, () => glowSprite(r, Math.round(r * 0.6), "#ffb45a", 0.35));
    const glow = this.track(this.scene.add.image(base.x, base.y - (pit ? 6 : 3), gkey).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_OVERLAY + 1));
    this.view?.attach(f, img);
    this.view?.attach(f, glow);
    this.fires.push({ f, img, glow, size, stokedUntil: 0, frame: 0 });
  }

  private animateFires() {
    const now = this.scene.time.now;
    const night = useOfficeStore.getState().night;
    for (const fire of this.fires) {
      fire.frame = (fire.frame + 1) % FLAME_FRAMES;
      const pit = fire.f.type === "fire-pit";
      const stoked = now < fire.stokedUntil;
      const size: FlameSize = pit ? (stoked ? "stoked" : "pit") : stoked ? "hearth-stoked" : "hearth";
      const key = this.flameKey(size, fire.frame);
      const [ox, oy] = this.scene.registry.get(`${key}-origen`) as [number, number];
      fire.img.setTexture(key).setOrigin(ox, oy);
      fire.glow.setAlpha((night ? 0.75 : 0.25) + Math.random() * (night ? 0.25 : 0.12)).setScale(stoked ? 1.25 : 1);
      // Chispas: la fogata siempre suelta alguna; avivada, muchas.
      if (pit ? Math.random() < (stoked ? 0.9 : 0.35) : stoked && Math.random() < 0.4) this.spark(fire, stoked);
    }
  }

  private spark(fire: Fire, stoked: boolean) {
    const hot = Math.random() < 0.5;
    const key = ensureTexture(this.scene, `casa-chispa-${hot ? 1 : 0}`, () => spark(hot));
    const x0 = fire.img.x + Phaser.Math.Between(-4, 4);
    const y0 = fire.img.y - Phaser.Math.Between(6, 14);
    const img = this.scene.add.image(x0, y0, key).setDepth(fire.img.depth + 0.01);
    const rise = Phaser.Math.Between(stoked ? 22 : 14, stoked ? 40 : 26);
    const drift = Phaser.Math.Between(-8, 8);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Phaser.Math.Between(700, 1300),
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        img.setPosition(Math.round(x0 + drift * v + Math.sin(v * 9) * 1.5), Math.round(y0 - rise * v));
        img.setAlpha(v > 0.6 ? 1 - (v - 0.6) / 0.4 : 1);
      },
      onComplete: () => img.destroy(),
    });
  }

  private stoke(f: PlacedFurniture) {
    const fire = this.fires.find((x) => x.f === f);
    if (!fire) return;
    fire.stokedUntil = this.scene.time.now + CASA.stokeMs;
    for (let k = 0; k < 10; k++) this.scene.time.delayedCall(k * 40, () => this.spark(fire, true));
  }

  // ---------- Baños ----------

  private addStallLight(f: PlacedFurniture) {
    const ts = this.map!.tileSize;
    const p = worldToScreen((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts, 37);
    const key = ensureTexture(this.scene, "casa-bano-libre", () => stallLight(false));
    const img = this.track(this.scene.add.image(p.x, p.y, key).setDepth(this.furnitureDepth(f) + 0.05));
    this.view?.attach(f, img);
    this.stallLights.set(furnitureKey(this.map!.id, f.type, f.x, f.y), { f, img });
  }

  private refreshStalls() {
    const stalls = this.host.room()?.state.stalls;
    for (const [key, s] of this.stallLights) {
      const busy = Boolean(stalls?.get(key));
      if (s.busy === busy) continue;
      // Al cambiar (no al llegar al nivel): la puerta y el pestillo.
      if (s.busy !== undefined) this.soundAt(s.f, playStall);
      s.busy = busy;
      s.img.setTexture(ensureTexture(this.scene, busy ? "casa-bano-ocupado" : "casa-bano-libre", () => stallLight(busy)));
    }
  }

  /**
   * Quien está en un cubículo no se ve (yo me veo transparente, para saber dónde estoy). Se revisa cada
   * cuadro: la escena vuelve a mostrar a todos al cambiar de nivel.
   */
  private updateStallHiding() {
    const room = this.host.room();
    const map = this.map;
    if (!room || !map) return;
    const inside = new Set<string>();
    const users = new Set<string>();
    room.state.stalls?.forEach((userId) => users.add(userId));
    if (users.size) room.state.players.forEach((p, sessionId) => users.has(p.userId) && p.area === map.id && inside.add(sessionId));
    const me = this.host.local();
    for (const sessionId of inside) {
      const a = this.host.avatarOf(sessionId);
      if (!a) continue;
      if (a === me) a.sprite.setAlpha(0.35);
      else a.setHidden(true);
    }
    for (const sessionId of this.inStall) {
      if (inside.has(sessionId)) continue;
      const a = this.host.avatarOf(sessionId);
      const p = room.state.players.get(sessionId);
      if (!a) continue;
      if (a === me) a.sprite.setAlpha(1);
      else a.setHidden(p?.area !== map.id);
    }
    this.inStall = inside;
  }

  // ---------- Contadores (puzle, pizarra, caballete) ----------

  private counterOf(key: string) {
    return this.host.room()?.state.counters?.get(key) ?? 0;
  }

  private refreshCounters() {
    for (const [key, p] of this.progress) {
      const n = this.counterOf(key);
      if (p.img && p.n === n) continue;
      p.n = n;
      p.img?.destroy();
      p.img = undefined;
      if (this.isBack(p.f)) continue;
      const max = counterMax(p.f.type);
      const s = progressLayer(p.f.type, n, max);
      if (s) p.img = this.layer(p.f, `casa-progreso-${p.f.type}-${n}-${max}`, s);
    }
  }

  // ---------- Muebles que se prenden (radio, cortinas) ----------

  /**
   * Capas extra de un mueble que se prende según su estado (la radio con notas, la cortina cerrada) y el
   * sonido del cambio. `first` = al armar el nivel (sin sonido).
   */
  toggleLayers(f: PlacedFurniture, on: boolean, first: boolean): { images: Phaser.GameObjects.Image[]; timer?: Phaser.Time.TimerEvent } {
    if (!first) {
      if (f.type === CURTAIN_TYPE) this.soundAt(f, playCurtain);
      else if (f.type === "tv-retro") this.soundAt(f, (v) => playTv(v, on));
      else if (LAMP_SOUND.has(f.type)) this.soundAt(f, playSwitch);
    }
    const images: Phaser.GameObjects.Image[] = [];
    if (f.type === CURTAIN_TYPE && on) {
      const feature = this.map && curtainFeature(this.map, f);
      if (feature) {
        const edge = feature.edge;
        const width = feature.width ?? 1;
        const s = curtainClosed(edge, width);
        const key = ensureTexture(this.scene, `casa-cortina-${edge}-${width}`, () => s.canvas);
        const ts = this.map!.tileSize;
        const a = worldToScreen(f.x * ts, f.y * ts);
        images.push(this.scene.add.image(a.x - s.ox, a.y - s.oy, key).setOrigin(0, 0).setDepth(depthOf(f.x * ts, f.y * ts) + 0.5));
      }
      return { images };
    }
    if (f.type === "radio" && on) {
      let k = 0;
      const timer = this.scene.time.addEvent({ delay: 700, loop: true, callback: () => this.note(f, 12, k++) });
      return { images, timer };
    }
    return { images };
  }

  /** Rectángulo en pantalla de la ventana de cada cortina (donde se dibuja cerrada), para el clic. */
  private curtainRects?: { f: PlacedFurniture; x: number; y: number; w: number; h: number }[];

  /**
   * La cortina cuya ventana está bajo el puntero. El clic se prueba sobre el dibujo de la ventana en la
   * pared, no sobre el piso de adelante: si no, un clic para caminar junto a la pared la cerraría.
   */
  curtainUnder(sx: number, sy: number): PlacedFurniture | null {
    const map = this.map;
    if (!map) return null;
    if (!this.curtainRects) {
      const ts = map.tileSize;
      this.curtainRects = [];
      for (const f of curtainsOf(map)) {
        const feature = curtainFeature(map, f);
        if (!feature) continue;
        const s = curtainClosed(feature.edge, feature.width ?? 1);
        const a = worldToScreen(f.x * ts, f.y * ts);
        this.curtainRects.push({ f, x: a.x - s.ox, y: a.y - s.oy, w: s.canvas.width, h: s.canvas.height });
      }
    }
    const hit = this.curtainRects.find((r) => sx >= r.x && sx < r.x + r.w && sy >= r.y && sy < r.y + r.h);
    return hit?.f ?? null;
  }

  /** Una nota que sube desde el mueble y se desvanece (como las del tocadiscos). */
  private note(f: PlacedFurniture, z: number, k: number) {
    const ts = this.map!.tileSize;
    const kind = (k % 3 === 2 ? 1 : 0) as 0 | 1;
    const color = NOTE_COLORS[k % NOTE_COLORS.length]!;
    const key = ensureTexture(this.scene, `nota-${kind}-${k % NOTE_COLORS.length}`, () => musicNote(kind, color));
    const p = worldToScreen((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts, z);
    this.rise(this.scene.add.image(p.x + (Math.random() - 0.5) * 8, p.y, key), 20, 1500);
  }

  /** Sube `dist` px meciéndose y se desvanece (notas, burbujas, polvo de tiza). */
  private rise(img: Phaser.GameObjects.Image, dist: number, ms: number, sway = 3) {
    const x0 = img.x;
    const y0 = img.y;
    const phase = Math.random() * Math.PI * 2;
    img.setDepth(DEPTH_OVERLAY + 2).setAlpha(0);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        img.setPosition(Math.round(x0 + Math.sin(phase + v * 6) * sway), Math.round(y0 - v * dist));
        img.setAlpha(v < 0.15 ? v / 0.15 : 1 - (v - 0.15) / 0.85);
      },
      onComplete: () => img.destroy(),
    });
  }

  /** Cae `dist` px (gotas de agua). */
  private fall(img: Phaser.GameObjects.Image, dist: number, ms: number) {
    img.setDepth(DEPTH_OVERLAY + 2);
    this.scene.tweens.add({ targets: img, y: img.y + dist, alpha: 0.2, duration: ms, ease: "Quad.in", onComplete: () => img.destroy() });
  }

  // ---------- Lo que pasa al usarlos ----------

  /** Ayuda del mueble: el contador ("Poner una pieza (7/20)") o si el baño está ocupado. */
  label(f: PlacedFurniture): string | undefined {
    const map = this.map;
    const spec = usableSpec(f.type);
    if (!map || !spec) return undefined;
    const key = furnitureKey(map.id, f.type, f.x, f.y);
    if (spec.action === "count") return `${spec.label} (${this.counterOf(key)}/${counterMax(f.type)})`;
    if (spec.action === "take" || spec.action === "roast") {
      // Lo gratis no pisa lo pagado (el servidor lo rechaza igual): se avisa antes.
      const room = this.host.room();
      const held = room?.state.players.get(room.sessionId)?.held;
      if (held && !isFreeHold(held)) return "Tienes las manos ocupadas";
    }
    if (spec.action === "stall") {
      const who = this.host.room()?.state.stalls?.get(key);
      const me = this.host.room()?.state.players.get(this.host.room()!.sessionId)?.userId;
      if (who && who === me) return "Estás en el baño (camina para salir)";
      if (who) return "Baño ocupado";
    }
    return undefined;
  }

  /** Alguien de tu nivel usó un mueble de la casa viva: animación y sonido. Devuelve si lo manejó. */
  handleEvent(e: FurnitureEvent, f: PlacedFurniture, vol: number): boolean {
    const map = this.map;
    if (!map) return false;
    const who = this.host.avatarOf(e.sessionId);
    const face = who ? faceToward(f, map.tileSize, who.x, who.y) : "down";
    const ts = map.tileSize;
    const top = (z: number) => worldToScreen((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts, z);
    switch (e.action) {
      case "read": {
        who?.perform(face, CASA.readMs);
        playPage(vol);
        if (who) {
          this.prop(who, `casa-libro-${e.seed % 5}`, () => openBook(e.seed), CASA.readMs, { dx: 0, dy: 9, pointing: false });
          // Aparte del globo de chat (no lo pisa si estaba hablando).
          this.floatText(who, `«${bookTitle(e.seed)}»`, CASA.readMs - 1200);
        }
        return true;
      }
      case "spin": {
        playGlobe(vol);
        if (this.isBack(f)) return true;
        const frames = 8;
        const img = this.layer(f, "casa-globo-0", globeSpin(0), 0.02);
        let k = 0;
        let delay = 60;
        const step = () => {
          k++;
          if (k > 22) return img.destroy();
          const s = globeSpin(k % frames);
          img.setTexture(ensureTexture(this.scene, `casa-globo-${k % frames}`, () => s.canvas));
          delay += 6;
          this.scene.time.delayedCall(delay, step);
        };
        this.scene.time.delayedCall(delay, step);
        return true;
      }
      case "stoke":
        who?.perform(face, 900);
        playWhoosh(vol);
        this.stoke(f);
        return true;
      case "water": {
        who?.perform(face, CASA.waterMs);
        playWater(vol);
        if (who) this.prop(who, "casa-regadera", () => wateringCan(), CASA.waterMs, { dx: 7, dy: 12, pointing: true });
        const p = top(12);
        for (let k = 0; k < 9; k++)
          this.scene.time.delayedCall(250 + k * 160, () => {
            const key = ensureTexture(this.scene, "casa-gota", () => waterDrop());
            this.fall(this.scene.add.image(p.x + Phaser.Math.Between(-4, 4), p.y - 6, key), 10, 380);
          });
        // La planta agradecida: unas chispitas verdes al final.
        this.scene.time.delayedCall(CASA.waterMs - 300, () => this.sparkle(top(16), 0x8cc653));
        return true;
      }
      case "wash": {
        who?.perform(face, CASA.washMs);
        playWash(vol);
        const p = top(12);
        for (let k = 0; k < 8; k++)
          this.scene.time.delayedCall(k * 150, () => {
            const drop = ensureTexture(this.scene, "casa-gota", () => waterDrop());
            this.fall(this.scene.add.image(p.x + Phaser.Math.Between(-3, 3), p.y - 4, drop), 6, 300);
          });
        for (let k = 0; k < 7; k++)
          this.scene.time.delayedCall(500 + k * 190, () => {
            const big = Math.random() < 0.35;
            const key = ensureTexture(this.scene, `casa-burbuja-${big ? 1 : 0}`, () => soapBubble(big));
            this.rise(this.scene.add.image(p.x + Phaser.Math.Between(-5, 5), p.y - 2, key), Phaser.Math.Between(12, 22), 1300, 2);
          });
        return true;
      }
      case "take": {
        who?.perform(face, 700);
        if (f.type === "coffee-station") {
          playCoffee(vol);
          const p = top(14);
          for (let k = 0; k < 4; k++) this.scene.time.delayedCall(k * 220, () => this.puff(p.x + Phaser.Math.Between(-2, 2), p.y));
        } else playFridge(vol);
        if (who && e.item) this.scene.time.delayedCall(500, () => this.floatText(who, GIFT_TEXT[e.item!] ?? "¡Listo!"));
        return true;
      }
      case "stall":
        // El cubículo y su luz llegan por el estado (refreshStalls); aquí solo mira hacia la puerta.
        who?.perform(face, 400);
        return true;
      case "roast": {
        who?.perform(face, CASA.roastMs);
        playSizzle(vol, CASA.roastMs / 1000);
        if (who) {
          const keys = ([0, 1, 2, 3] as const).map((t) => ensureTexture(this.scene, `casa-palito-${t}`, () => roastStick(t)));
          this.prop(who, keys[0]!, () => roastStick(0), CASA.roastMs, {
            dx: 9,
            dy: 10,
            pointing: true,
            onFrame: (ms) => {
              const t = Math.min(3, Math.floor((ms / CASA.roastMs) * 4));
              return keys[t]!;
            },
          });
          const areaId = map.id;
          this.scene.time.delayedCall(CASA.roastMs, () => {
            // Si se fue de la fogata (o de nivel), el servidor no se lo da: no se festeja.
            const ts2 = map.tileSize;
            const dx = Math.max(f.x * ts2 - who.x, 0, who.x - (f.x + f.w) * ts2);
            const dy = Math.max(f.y * ts2 - who.y, 0, who.y - (f.y + f.d) * ts2);
            if (this.map?.id !== areaId || Math.hypot(dx, dy) > CASA.roastReachTiles * ts2) return;
            playGot(vol);
            this.floatText(who, GIFT_TEXT.malvavisco!);
          });
        }
        return true;
      }
      case "count": {
        who?.perform(face, 700);
        const p = top(f.type === "chess-table" || f.type === "puzzle-table" ? 14 : 24);
        if (f.type === "chess-table") {
          playClack(vol);
          this.hop(p.x, p.y, e.seed % 2 ? 0xf0f0f2 : 0x30374b, 2, 4);
        } else if (f.type === "puzzle-table") {
          playSnap(vol);
          this.hop(p.x, p.y, [0xee7a22, 0xdcae3f, 0x6e3a96, 0x5ea247][e.seed % 4]!, 3, 3);
        } else {
          playChalk(vol, f.type === "easel");
          for (let k = 0; k < 5; k++) this.scene.time.delayedCall(k * 120, () => this.dust(p.x + Phaser.Math.Between(-4, 4), p.y + Phaser.Math.Between(-3, 5), f.type === "easel"));
        }
        // El valor nuevo viene en el evento (el parche del estado llega un poco después).
        const n = e.count ?? this.counterOf(furnitureKey(map.id, f.type, f.x, f.y));
        this.floatAt(p.x, p.y - 6, n === 0 ? "¡Terminado! De nuevo" : `${n}/${counterMax(f.type)}`);
        return true;
      }
      default:
        return false;
    }
  }

  /** Una pieza (ajedrez, puzle) que salta sobre el tablero y se apoya. */
  private hop(x: number, y: number, color: number, w: number, h: number) {
    const r = this.scene.add.rectangle(x, y, w, h, color).setStrokeStyle(1, 0x2b1b17).setDepth(DEPTH_OVERLAY + 2);
    this.scene.tweens.add({ targets: r, y: y - 8, duration: 180, yoyo: true, ease: "Quad.out", onComplete: () => this.scene.tweens.add({ targets: r, alpha: 0, delay: 500, duration: 300, onComplete: () => r.destroy() }) });
  }

  /** Polvo de tiza (o gotitas de pintura) que cae de la pizarra. */
  private dust(x: number, y: number, paint: boolean) {
    const color = paint ? [0x86b8e6, 0x8cc653, 0xf3d672][Phaser.Math.Between(0, 2)]! : 0xfffaf0;
    const r = this.scene.add.rectangle(x, y, 1, 1, color).setDepth(DEPTH_OVERLAY + 2);
    this.scene.tweens.add({ targets: r, y: y + Phaser.Math.Between(6, 12), alpha: 0, duration: 700, onComplete: () => r.destroy() });
  }

  /** Vapor de la cafetera. */
  private puff(x: number, y: number) {
    const size = Phaser.Math.Between(2, 3);
    const r = this.scene.add.rectangle(x, y, size, size, 0xf0f0f2, 0.8).setDepth(DEPTH_OVERLAY + 2);
    this.scene.tweens.add({ targets: r, y: y - Phaser.Math.Between(10, 16), x: x + Phaser.Math.Between(-3, 3), alpha: 0, duration: 1100, onComplete: () => r.destroy() });
  }

  /** Chispitas de color que suben (la planta regada). */
  private sparkle(p: { x: number; y: number }, color: number) {
    for (let k = 0; k < 5; k++) {
      const r = this.scene.add.rectangle(p.x + Phaser.Math.Between(-6, 6), p.y + Phaser.Math.Between(-2, 4), 1, 1, color).setDepth(DEPTH_OVERLAY + 2);
      this.scene.tweens.add({ targets: r, y: r.y - Phaser.Math.Between(6, 12), alpha: 0, delay: k * 60, duration: 800, onComplete: () => r.destroy() });
    }
  }

  /** Texto chico que sube sobre la cabeza ("¡Un jugo!"); `holdMs`: cuánto se queda antes de irse. */
  private floatText(who: Avatar, text: string, holdMs = 600) {
    const s = worldToScreen(who.x, who.y);
    this.floatAt(s.x, s.y - 36, text, holdMs);
  }

  private floatAt(x: number, y: number, text: string, holdMs = 600) {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: cozyFontFamily(), fontSize: "8px", color: COZY.paperLight, stroke: COZY.frame, strokeThickness: 2, resolution: 6 })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY + 10);
    this.scene.tweens.add({ targets: t, y: y - 12, alpha: 0, delay: holdMs, duration: 1200, ease: "Sine.out", onComplete: () => t.destroy() });
  }

  /** Algo en la mano por un rato: sigue al avatar (ver `update`). `onFrame` devuelve otra textura. */
  private prop(who: Avatar, key: string, make: () => PixelCanvas, ms: number, o: { dx: number; dy: number; pointing: boolean; onFrame?: (ms: number) => string }) {
    // Solo uno por persona a la vez.
    for (const p of this.props.filter((p) => p.who === who)) p.until = 0;
    ensureTexture(this.scene, key, make);
    const img = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
    const start = this.scene.time.now;
    const prop: Prop = {
      who,
      img,
      until: start + ms,
      dx: o.dx,
      dy: o.dy,
      pointing: o.pointing,
      start,
      onFrame: o.onFrame ? (elapsed) => img.setTexture(o.onFrame!(elapsed)) : undefined,
    };
    this.props.push(prop);
    this.placeProp(prop);
  }

  private placeProp(p: Prop) {
    const s = worldToScreen(p.who.x, p.who.y);
    const dir = p.who.direction;
    // De frente (down, right) delante del cuerpo; de espaldas (left, up) detrás.
    const front = dir === "down" || dir === "right";
    // Lo que apunta (regadera, palito) va hacia donde mira: a la izquierda en down/left, a la derecha en right/up.
    const toRight = dir === "right" || dir === "up";
    const side = p.pointing ? (toRight ? 1 : -1) : 0;
    p.img
      .setPosition(Math.round(s.x + side * p.dx), Math.round(s.y - p.dy + (p.who.isSeated ? 3 : 0)))
      .setFlipX(p.pointing && toRight)
      .setDepth(depthOf(p.who.x, p.who.y) + (front ? 0.56 : 0.44));
  }

  // ---------- Cada cuadro ----------

  update() {
    const now = this.scene.time.now;
    for (const p of this.props) {
      if (now >= p.until) continue;
      p.onFrame?.(now - p.start);
      this.placeProp(p);
    }
    const done = this.props.filter((p) => now >= p.until);
    if (done.length) {
      done.forEach((p) => p.img.destroy());
      this.props = this.props.filter((p) => now < p.until);
    }
    this.updateStallHiding();
    const me = this.host.local();
    if (!me || !this.map) {
      // Reconectando (sin avatar): que no siga sonando al último volumen.
      setFireCrackle(0);
      setRadioMusic(0);
      return;
    }
    let fire = 0;
    for (const f of this.fires) {
      const v = this.host.hear(f.f, me.x, me.y) ** FIRE_HEAR_POW;
      fire = Math.max(fire, now < f.stokedUntil ? Math.min(1, v * 1.6) : v);
    }
    setFireCrackle(fire);
    const ts = this.map.tileSize;
    const myRoom = roomOf(this.map, Math.floor(me.x / ts), Math.floor(me.y / ts));
    let radio = 0;
    for (const f of this.radios) {
      if (!this.host.isOn(f)) continue;
      const room = roomOf(this.map, f.x, f.y);
      radio = Math.max(radio, room && room === myRoom ? ROOM_MUSIC_VOLUME : this.host.hear(f, me.x, me.y) * OUTSIDE_ROOM_FACTOR);
    }
    setRadioMusic(radio);
  }

  /** Sonido de un mueble al volumen con que me llega. */
  private soundAt(f: PlacedFurniture, play: (vol: number) => void) {
    const me = this.host.local();
    if (me) play(this.host.hear(f, me.x, me.y));
  }
}
