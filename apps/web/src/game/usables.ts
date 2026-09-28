// Muebles que se usan (E o clic): piano y guitarra se tocan, el tocadiscos pone música, la tele y las
// lámparas se prenden y apagan, y al gato se lo acaricia. Lo que queda prendido lo decide el servidor
// (`OfficeState.switches`); tocar o acariciar llega como evento. La escena solo tiene ganchos chicos.
import { catalogItem, footprint, INTERACT_REACH_TILES, usablesOf, zoneAt, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { glowSprite, heartSmall, lampLit, lampOff, musicNote, NOTE_COLORS, tvScreenOff, tvScreenOn, vinylSpin, type Sprite } from "@hyvento/map/art";
import { CURTAIN_TYPE, isSwitchedOn, stepsTo, USE_STEPS, usableSpec, type Direction, type FurnitureEvent, type UsableSpec } from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import * as Phaser from "phaser";
import type { Avatar } from "./Avatar";
import { CasaViva, CURTAIN_PENALTY_TILES } from "./casaViva";
import { GranjaVivo } from "./granja";
import { JardinVivo } from "./jardinVivo";
import { Mascotas } from "./mascotas";
import { AreaView, DEPTH_OVERLAY, depthOf, ensureTexture, screenToWorld, worldToScreen } from "./iso/view";
import type { OfficeRoom } from "./network";
import { playGuitar, playPiano, playPurr, setRecordMusic, stopRecordMusic, volumeAt } from "./sound";
import { useOfficeStore } from "./store";

/** Cuánto dura tocar un instrumento (igual a la pausa del servidor). */
const PLAY_MS = 2400;
/** Hasta dónde se oye (px de mundo): los instrumentos y el tocadiscos. */
const HEAR_PX = 12 * 32;
/** Pasos máximos (tile a tile, rodeando paredes) por los que llega el sonido. */
const HEAR_STEPS = 14;

export interface UsableHit {
  f: PlacedFurniture;
  spec: UsableSpec;
  dist: number;
}

/** Capas de un mueble prendible: las imágenes encima del dibujo y su animación. */
interface Overlay {
  f: PlacedFurniture;
  images: Phaser.GameObjects.Image[];
  timer?: Phaser.Time.TimerEvent;
  frame: number;
  /** Estado con el que se armaron las capas (para no rearmarlas en cada cambio de la sala). */
  on?: boolean;
}

/** Distancia de los pies (px) al borde de lo que ocupa el mueble: la misma cuenta que el servidor. */
function distTo(f: PlacedFurniture, ts: number, px: number, py: number) {
  const dx = Math.max(f.x * ts - px, 0, px - (f.x + f.w) * ts);
  const dy = Math.max(f.y * ts - py, 0, py - (f.y + f.d) * ts);
  return Math.hypot(dx, dy);
}

/**
 * Las mismas reglas que el servidor (`canUse`): al alcance, sin pared de por medio (tile a tile) y lo de
 * una oficina no se usa desde afuera (ni al revés).
 */
function canUse(map: OfficeMap, f: PlacedFurniture, px: number, py: number) {
  const ts = map.tileSize;
  // La fogata se usa desde los troncos (su propio alcance, igual que el servidor).
  if (distTo(f, ts, px, py) > (usableSpec(f.type)?.reachTiles ?? INTERACT_REACH_TILES) * ts) return false;
  if (stepsTo(map, Math.floor(px / ts), Math.floor(py / ts), f, USE_STEPS) > USE_STEPS) return false;
  const fz = zoneAt(map, (f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts);
  const pz = zoneAt(map, px, py);
  return (fz?.type !== "office" && pz?.type !== "office") || fz?.id === pz?.id;
}

/** Hacia dónde mirar para quedar de frente al mueble. */
function faceToward(f: PlacedFurniture, ts: number, x: number, y: number): Direction {
  const dx = (f.x + f.w / 2) * ts - x;
  const dy = (f.y + f.d / 2) * ts - y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

/** Volumen del tocadiscos dentro de su habitación, y cuánto de eso sale por las puertas. */
const ROOM_MUSIC_VOLUME = 0.85;
const OUTSIDE_ROOM_FACTOR = 0.35;

/** Habitación que contiene el tile (la última que lo cubre, como en build.ts). */
function roomAt(map: OfficeMap, x: number, y: number): string | undefined {
  const rooms = map.def.rooms;
  for (let i = rooms.length - 1; i >= 0; i--) {
    const r = rooms[i]!.rect;
    if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return rooms[i]!.id;
  }
  return undefined;
}

export class Usables {
  private map?: OfficeMap;
  private view?: AreaView;
  private room?: OfficeRoom;
  private overlays = new Map<PlacedFurniture, Overlay>();
  private detach: (() => void)[] = [];
  /** Pasos hasta cada tocadiscos, recalculados solo al cambiar de tile (la música se mide cada frame). */
  private hearCache = new Map<PlacedFurniture, { tile: number; steps: number }>();
  /** Casa viva: fuego, radio, cortinas, contadores, baños y lo que se lleva en la mano; y las mascotas. */
  private casa: CasaViva;
  private pets: Mascotas;
  /** El modo privado vela a las mascotas de afuera de la sala (px de mundo). */
  setPetVeil(rect: { x: number; y: number; w: number; h: number } | null) {
    this.pets.setVeil(rect);
  }
  /** Jardín vivo: el huerto, las abejas y la glorieta. */
  private jardin: JardinVivo;
  private readonly onSceneUpdate = (time: number, delta: number) => {
    this.casa.update();
    this.pets.update(delta);
    this.jardin.update(time, delta);
    this.granja.update(time, delta);
  };
  /** La granja: los animales, la rueda del molino, los huevos y lo que está en el fuego. */
  private granja: GranjaVivo;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly avatarOf: (sessionId: string) => Avatar | undefined,
    private readonly local: () => Avatar | undefined,
  ) {
    this.casa = new CasaViva(scene, {
      map: () => this.map,
      room: () => this.room,
      avatarOf,
      local,
      hear: (f, x, y) => this.hearVolume(f, x, y),
      isOn: (f) => this.isOn(f),
    });
    this.pets = new Mascotas(scene, local);
    this.jardin = new JardinVivo(scene, { room: () => this.room, avatarOf, local });
    this.granja = new GranjaVivo(scene, { room: () => this.room, avatarOf, local });
    // Cada cuadro, aparte de update(): lo que se mueve en la casa viva (mascotas, fuego, lo de la mano).
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate);
  }

  /** Se dibujó un nivel (o se rearmó con otra decoración): capas nuevas según lo prendido. */
  setArea(map: OfficeMap, view: AreaView) {
    this.clearOverlays();
    this.hearCache.clear();
    this.map = map;
    this.view = view;
    // Con las cortinas de las ventanas (usablesOf), que no son muebles del catálogo.
    this.casa.setArea(map, view);
    this.pets.setArea(map.id);
    this.jardin.setArea(map);
    this.granja.setArea(map, view);
    for (const f of usablesOf(map)) if (usableSpec(f.type)?.action === "toggle") this.overlays.set(f, { f, images: [], frame: 0 });
    for (const o of this.overlays.values()) this.refresh(o);
  }

  bind(room: OfficeRoom) {
    this.unbind();
    this.room = room;
    this.casa.bind(room);
    this.pets.bind(room);
    this.jardin.bind(room);
    this.granja.bind(room);
    const $ = getStateCallbacks(room);
    const again = () => {
      for (const o of this.overlays.values()) this.refresh(o);
    };
    this.detach.push(
      $(room.state).listen("switches", (switches) => {
        if (!switches) return;
        const s$ = $(switches);
        this.detach.push(s$.onAdd(again), s$.onChange(again), s$.onRemove(again));
        again();
      }),
    );
  }

  unbind() {
    this.detach.forEach((d) => d());
    this.detach = [];
    this.room = undefined;
    this.casa.unbind();
    this.pets.unbind();
    this.jardin.unbind();
    this.granja.unbind();
  }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate);
    this.casa.destroy();
    this.pets.destroy();
    this.jardin.destroy();
    this.granja.destroy();
    this.unbind();
    this.clearOverlays();
    stopRecordMusic();
  }

  private isOn(f: PlacedFurniture) {
    const switches = this.room?.state.switches;
    if (!this.map) return false;
    return isSwitchedOn(switches ?? new Map(), this.map.id, f.type, f.x, f.y);
  }

  /** Imagen de una capa sobre el mueble: mismo lugar, volteo y profundidad que su dibujo (ver furnitureImage). */
  private layer(f: PlacedFurniture, key: string, s: Sprite, lift = 0.01) {
    const ts = this.map!.tileSize;
    const item = catalogItem(f.type);
    const flip = !item.fixed && (f.facing === "down" || f.facing === "up");
    const [w, d] = footprint(item, f.facing);
    const a = worldToScreen(f.x * ts, f.y * ts);
    ensureTexture(this.scene, key, () => s.canvas);
    return this.scene.add
      .image(a.x - (flip ? s.canvas.width - s.ox : s.ox), a.y - s.oy, key)
      .setOrigin(0, 0)
      .setFlipX(flip)
      .setDepth(depthOf((f.x + w / 2) * ts, (f.y + d / 2) * ts) + lift);
  }

  /** Vuelve a armar las capas de un mueble según esté prendido o apagado. */
  private refresh(o: Overlay) {
    const on = this.isOn(o.f);
    if (o.on === on) return;
    const first = o.on === undefined;
    o.on = on;
    o.timer?.remove();
    o.timer = undefined;
    o.images.forEach((i) => i.destroy());
    o.images = [];
    const f = o.f;
    // Las cortinas no están en el catálogo (son las ventanas): no tienen espalda.
    const back = f.type !== CURTAIN_TYPE && (f.facing === "left" || f.facing === "up") && catalogItem(f.type).hasBack;
    this.view?.setLight(f, on);
    if (f.type === "tv-retro") {
      if (!back) {
        if (!on) o.images.push(this.layer(f, "capa-tele-apagada", tvScreenOff()));
        else {
          // Prendida: la franja de barrido baja por la pantalla.
          const frames = [0, 1, 2, 3].map((k) => {
            const s = tvScreenOn(k);
            ensureTexture(this.scene, `capa-tele-${k}`, () => s.canvas);
            return `capa-tele-${k}`;
          });
          const img = this.layer(f, frames[0]!, tvScreenOn(0));
          o.images.push(img);
          o.timer = this.scene.time.addEvent({ delay: 160, loop: true, callback: () => img.setTexture(frames[++o.frame % 4]!) });
        }
      }
      if (on) o.images.push(this.glow(f, "#7fd4ff", 22, 14));
    } else if (f.type === "lamp") {
      // Apagada también lleva capa: la pantalla oscura se nota de día (de noche, además, no da luz).
      o.images.push(on ? this.layer(f, "capa-lampara", lampLit()) : this.layer(f, "capa-lampara-apagada", lampOff()));
    } else if (f.type === "record-player" && on) {
      const frames = [0, 1, 2, 3].map((k) => {
        const s = vinylSpin(k);
        ensureTexture(this.scene, `capa-disco-${k}`, () => s.canvas);
        return `capa-disco-${k}`;
      });
      const img = this.layer(f, frames[0]!, vinylSpin(0));
      o.images.push(img);
      o.timer = this.scene.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => {
          img.setTexture(frames[++o.frame % 4]!);
          // De vez en cuando sale una nota del tocadiscos.
          if (o.frame % 9 === 0) this.note(f, 16);
        },
      });
    }
    // Casa viva: la radio, las cortinas y el sonido de cada cambio.
    const extra = this.casa.toggleLayers(f, on, first);
    o.images.push(...extra.images);
    if (extra.timer) o.timer = extra.timer;
    // Con el mueble: el modo privado las esconde si queda afuera de la sala.
    for (const img of o.images) this.view?.attach(f, img);
  }

  /** Resplandor de pantalla (la tele prendida), que titila un poco. */
  private glow(f: PlacedFurniture, color: string, r: number, z: number) {
    const ts = this.map!.tileSize;
    const p = worldToScreen((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts, z);
    const key = ensureTexture(this.scene, `resplandor-${color}-${r}`, () => glowSprite(r, Math.round(r * 0.6), color, 0.4));
    const img = this.scene.add.image(p.x, p.y, key).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_OVERLAY + 1);
    this.scene.tweens.add({ targets: img, alpha: 0.6, duration: 220, yoyo: true, repeat: -1, repeatDelay: 300, ease: "Stepped" });
    return img;
  }

  private clearOverlays() {
    for (const o of this.overlays.values()) {
      o.timer?.remove();
      o.images.forEach((i) => i.destroy());
    }
    this.overlays.clear();
  }

  // ---------- Qué hay cerca ----------

  /** La mascota de mi nivel al alcance para acariciarla (la más cercana que se ve), o null. */
  /** La granja: alguien al lado con un plato de la parrilla al que pedirle una porción. */
  portionNear() {
    return this.granja.portionNear();
  }

  petNear(x: number, y: number): { id: string; name: string; dist: number } | null {
    return this.pets.nearest(x, y);
  }

  /** El mueble que se usa más cercano al alcance de (x, y), o null. */
  nearest(x: number, y: number): UsableHit | null {
    const map = this.map;
    if (!map) return null;
    const night = useOfficeStore.getState().night;
    let best: UsableHit | null = null;
    for (const f of usablesOf(map)) {
      const spec = usableSpec(f.type);
      // Una lámpara sin capa de encendida solo cambia algo de noche: de día no se ofrece.
      if (!spec || (spec.nightOnly && !night)) continue;
      // Las cortinas ceden ante cualquier mueble cerca: caminando pegado a la pared, E no queda siempre en
      // "Cerrar la cortina".
      const dist = distTo(f, map.tileSize, x, y) + (f.type === CURTAIN_TYPE ? map.tileSize * CURTAIN_PENALTY_TILES : 0);
      if ((!best || dist < best.dist) && canUse(map, f, x, y)) best = { f, spec, dist };
    }
    return best;
  }

  /** ¿Se alcanza ese mueble desde (x, y)? */
  reaches(f: PlacedFurniture, x: number, y: number): boolean {
    const map = this.map;
    return Boolean(map && canUse(map, f, x, y));
  }

  /** Mueble que se usa dibujado bajo el puntero (se busca un poco más abajo: los muebles son altos). */
  under(sx: number, sy: number): PlacedFurniture | null {
    const map = this.map;
    if (!map) return null;
    const ts = map.tileSize;
    for (let lift = 0; lift <= 30; lift += 4) {
      const w = screenToWorld(sx, sy + lift);
      const tx = Math.floor(w.x / ts);
      const ty = Math.floor(w.y / ts);
      const night = useOfficeStore.getState().night;
      const f = usablesOf(map).find((f) => {
        const spec = usableSpec(f.type);
        // Las cortinas no ocupan el piso: se prueban sobre el dibujo de la ventana (abajo). Van antes de
        // mirar el catálogo, porque no son un mueble de él.
        if (!spec || f.type === CURTAIN_TYPE) return false;
        // Lo que se camina por dentro (el techo de la glorieta): un clic ahí es para entrar, no para usarlo.
        const walkIn = catalogItem(f.type).solid === false && !catalogItem(f.type).flat;
        return !walkIn && (!spec.nightOnly || night) && tx >= f.x && tx < f.x + f.w && ty >= f.y && ty < f.y + f.d;
      });
      if (f) return f;
    }
    return this.casa.curtainUnder(sx, sy);
  }

  /** Lo que dice la ayuda para ese mueble ("Prender la tele" o "Apagar la tele"). */
  label(f: PlacedFurniture): string {
    const spec = usableSpec(f.type)!;
    const casa = this.casa.label(f) ?? this.jardin.label(f) ?? this.granja.label(f);
    if (casa) return casa;
    return spec.action === "toggle" && this.isOn(f) ? (spec.labelOn ?? spec.label) : spec.label;
  }

  /** Un tile libre desde el que se alcanza el mueble (para caminar hasta él con un clic). */
  standSpot(f: PlacedFurniture): { x: number; y: number } {
    const ts = this.map!.tileSize;
    const around: [number, number][] = [];
    for (let x = f.x - 1; x <= f.x + f.w; x++) around.push([x, f.y + f.d], [x, f.y - 1]);
    for (let y = f.y; y < f.y + f.d; y++) around.push([f.x - 1, y], [f.x + f.w, y]);
    const ok = around.find(([x, y]) => x >= 0 && y >= 0 && x < this.map!.width && y < this.map!.height && !this.map!.blocked[y * this.map!.width + x]);
    const [x, y] = ok ?? [f.x, f.y + f.d];
    return { x: x * ts + ts / 2, y: y * ts + ts / 2 };
  }

  // ---------- Lo que pasa al usarlos ----------

  /**
   * Cada frame: la música del tocadiscos prendido de tu nivel. Suena pleno en toda la habitación donde
   * está puesto; afuera se oye bajito, rodeando las paredes por las puertas (hearVolume).
   */
  update() {
    const me = this.local();
    const map = this.map;
    if (!me || !map) return;
    const ts = map.tileSize;
    const myRoom = roomAt(map, Math.floor(me.x / ts), Math.floor(me.y / ts));
    let vol = 0;
    for (const o of this.overlays.values()) {
      if (o.f.type !== "record-player" || !this.isOn(o.f)) continue;
      const room = roomAt(map, o.f.x, o.f.y);
      vol = Math.max(vol, room && room === myRoom ? ROOM_MUSIC_VOLUME : this.hearVolume(o.f, me.x, me.y) * OUTSIDE_ROOM_FACTOR);
    }
    setRecordMusic(vol);
  }

  /**
   * Volumen con que se oye un mueble desde (x, y): el sonido rodea las paredes (se cuentan los pasos tile
   * a tile hasta él) y no entra ni sale de una zona aislada (oficinas, sala de reuniones).
   */
  private hearVolume(f: PlacedFurniture, x: number, y: number): number {
    const map = this.map;
    if (!map) return 0;
    const ts = map.tileSize;
    const fz = zoneAt(map, (f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts);
    const pz = zoneAt(map, x, y);
    if (fz?.id !== pz?.id && (fz?.isolated || pz?.isolated)) return 0;
    const tx = Math.floor(x / ts);
    const ty = Math.floor(y / ts);
    const tile = ty * map.width + tx;
    let cached = this.hearCache.get(f);
    if (cached?.tile !== tile) {
      cached = { tile, steps: stepsTo(map, tx, ty, f, HEAR_STEPS) };
      this.hearCache.set(f, cached);
    }
    if (!Number.isFinite(cached.steps)) return 0;
    // Dando la vuelta por una puerta, cuenta lo que se camina (no la línea recta a través de la pared).
    return volumeAt(Math.max(distTo(f, ts, x, y), (cached.steps - 1) * ts), HEAR_PX);
  }

  /** Alguien de tu nivel tocó un instrumento o acarició al gato. */
  handleEvent(e: FurnitureEvent) {
    const map = this.map;
    if (!map) return;
    const f = usablesOf(map).find((f) => f.type === e.type && f.x === e.x && f.y === e.y);
    if (!f) return;
    const who = this.avatarOf(e.sessionId);
    const me = this.local();
    const vol = me ? this.hearVolume(f, me.x, me.y) : 0;
    // Casa viva: leer, girar, avivar, regar, lavarse, sacar algo gratis, el baño, asar y los contadores.
    if (this.casa.handleEvent(e, f, vol)) return;
    if (this.jardin.handleEvent(e, f, vol)) return;
    if (this.granja.handleEvent(e, f, vol)) return;
    if (who) who.perform(faceToward(f, map.tileSize, who.x, who.y), e.action === "play" ? PLAY_MS : 600);
    if (e.action === "play") {
      if (e.type === "guitar") playGuitar(e.seed, vol);
      else playPiano(e.seed, vol);
      // Las notas salen del instrumento mientras suena.
      for (let k = 0; k < 7; k++) this.scene.time.delayedCall(k * 330, () => this.note(f, e.type === "piano" ? 22 : 14, k));
    } else {
      playPurr(vol);
      this.heart(f);
    }
  }

  /** Una nota que sube desde el mueble, se mece y se desvanece. */
  private note(f: PlacedFurniture, z: number, k = Math.floor(Math.random() * 5)) {
    const ts = this.map!.tileSize;
    const kind = (k % 3 === 2 ? 1 : 0) as 0 | 1;
    const color = NOTE_COLORS[k % NOTE_COLORS.length]!;
    const key = ensureTexture(this.scene, `nota-${kind}-${k % NOTE_COLORS.length}`, () => musicNote(kind, color));
    const p = worldToScreen((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts, z);
    const x0 = p.x + (Math.random() - 0.5) * 10;
    const img = this.scene.add.image(x0, p.y, key).setDepth(DEPTH_OVERLAY + 2).setAlpha(0);
    const phase = Math.random() * Math.PI * 2;
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1500,
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        img.setPosition(Math.round(x0 + Math.sin(phase + v * 6) * 3), Math.round(p.y - v * 20));
        img.setAlpha(v < 0.15 ? v / 0.15 : 1 - (v - 0.15) / 0.85);
      },
      onComplete: () => img.destroy(),
    });
  }

  /** Corazón que sale del gato, da un saltito y sube. */
  private heart(f: PlacedFurniture) {
    const ts = this.map!.tileSize;
    const key = ensureTexture(this.scene, "corazon-gato", () => heartSmall());
    const p = worldToScreen((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts, 12);
    const img = this.scene.add.image(p.x, p.y, key).setDepth(DEPTH_OVERLAY + 2).setScale(0.4);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1400,
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        img.setScale(v < 0.1 ? 0.4 + v * 7 : v < 0.18 ? 1.1 - (v - 0.1) * 1.25 : 1);
        img.setPosition(p.x, Math.round(p.y - v * 16));
        img.setAlpha(v > 0.7 ? 1 - (v - 0.7) / 0.3 : 1);
      },
      onComplete: () => img.destroy(),
    });
  }
}
