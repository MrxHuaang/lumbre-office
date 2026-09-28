// El club y el arcade en la escena: la música (según estés en el club), las luces que siguen el ritmo
// (pista, cabina, parlantes, rayos de colores), la tarima encendida con alguien en el tubo, los bailes
// de cada persona (con la hora del servidor, así todos ven el mismo paso) y las pantallas del arcade.
// La escena solo tiene ganchos chicos: setArea, update, tapE y esc.
import { catalogItem, footprint, INTERACT_REACH_TILES, pointsOfType, zoneAt, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import {
  arcadeScreen,
  danceFloorLights,
  DANCE_FRAMES,
  djBoothEq,
  drawFloorDance,
  drawPoleDance,
  FLOOR_LIGHT_PATTERNS,
  glowSprite,
  poleStageLights,
  POLE_FEET_Y,
  POLE_FRAME_H,
  POLE_FRAME_W,
  POLE_ROUTINE,
  speakerPulse,
  styleFor,
  FEET_Y,
  FRAME,
  VIDEO_WALL_SCREEN,
  drawReaction,
  billsFor,
  BILL_FRAMES,
  drawBill,
  type ArcadeScreenKind,
  type PixelCanvas,
  type Sprite,
} from "@hyvento/map/art";
import { ARCADE_MACHINES, CLUB, CLUB_TIP, DANCE_MOVE_IDS, isPlaying, poleKey, type ClubReactionEvent, type ClubTipEvent, type DanceMoveId } from "@hyvento/shared";
import * as Phaser from "phaser";
import type { Avatar } from "../Avatar";
import { AreaView, DEPTH_FLAT, DEPTH_OVERLAY, depthOf, ensureTexture, toHtmlCanvas, worldToScreen } from "../iso/view";
import { characterKey, parseLook } from "../looks";
import { getRoom } from "../network";
import { useOfficeStore } from "../store";
import { clubMusic, disposeClubMusic } from "./music";
import { wallQuad, type Point } from "../wallMount";
import { YoutubeScreen } from "../youtube";
import { COZY, cozyFontFamily } from "@/lib/cozy";
import { sfx, volAt } from "../sfx";
import { onClubReaction, onClubTip, sendClubDance, sendClubPole, sendClubQueue, sendClubTip } from "./net";
import { clubBeat, serverNow, useClubStore, type ClubDancerView } from "./store";

/** El reproductor del club (uno solo, mientras estoy en el sótano). */
let video: YoutubeScreen | null = null;

/** Lo que el club hace con los avisos de su reproductor: la cola la lleva el servidor. */
function clubScreen(parent: HTMLElement) {
  return new YoutubeScreen(parent, {
    id: "club",
    onDuration: (id, ms) => sendClubQueue({ action: "duration", id, ms }),
    onEnded: (id) => sendClubQueue({ action: "ended", id }),
    // El video no se puede ver (lo borraron, no deja insertarse): se salta para todos.
    onError: (id, code) => {
      useOfficeStore
        .getState()
        .notify(code === 101 || code === 150 ? "Ese video no deja verse fuera de YouTube: pasa al siguiente." : "Ese video no se pudo reproducir: pasa al siguiente.", "warning");
      sendClubQueue({ action: "skip", id });
    },
    onNeedsTap: (needs) => useClubStore.getState().setNeedsTap(needs),
    onClick: () => {
      const s = useClubStore.getState();
      s.setVideoBig(!s.videoBig);
    },
    titles: { small: "Ver el video en grande", big: "Volver a la pantalla del club" },
  });
}

/** Colores de las luces del club (rosado, turquesa, violeta y dorado del neón). */
const LIGHTS = ["#ff5fd2", "#3fd0dd", "#9459ba", "#f3d672"];
/** Frames del ecualizador de la cabina (alturas al azar, fijas). */
const EQ_FRAMES = 8;
const EQ_LEVELS = Array.from({ length: EQ_FRAMES }, (_, k) => Array.from({ length: 10 }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(k * 1.7 + i * 2.3 + k * i * 0.4))));

/** Una capa encima de un mueble: el mismo lugar, espejo y profundidad que su dibujo (ver furnitureImage). */
interface Layer {
  f: PlacedFurniture;
  img: Phaser.GameObjects.Image;
  key: string;
  /** Dónde quedó en pantalla (los parlantes tiemblan desde ahí). */
  y0: number;
}

/** La imagen del baile de alguien. */
interface DanceImage {
  img: Phaser.GameObjects.Image;
  texture: string;
}

/** Cuánto quedan los billetes en la tarima antes de irse, y cuántos caben a la vez. */
const BILL_PILE_MS = 90_000;
const BILL_PILE_MAX = 48;
/** Montoncitos alrededor del tubo (en tiles desde su centro): ahí caen los billetes y se apilan. */
const PILE_SPOTS: readonly [number, number][] = [
  [-0.9, -0.5],
  [0.8, -0.8],
  [1.0, 0.4],
  [-0.4, 1.0],
  [0.4, 1.1],
  [-1.1, 0.5],
];

/** Un billete en el piso de la tarima. */
interface LandedBill {
  img: Phaser.GameObjects.Image;
  at: number;
  spot: number;
}

/** ¿Está el mueble dentro del club? (una pista o un parlante que un admin puso en otro lado no se encienden). */
function inClub(map: OfficeMap, f: PlacedFurniture) {
  return map.id === CLUB.area && zoneAt(map, (f.x + f.w / 2) * map.tileSize, (f.y + f.d / 2) * map.tileSize)?.id === CLUB.zone;
}

/** ¿Están los pies en (x, y) sobre la pista de baile del club? (la misma cuenta que el servidor). */
function onFloor(map: OfficeMap, x: number, y: number) {
  const ts = map.tileSize;
  if (map.id !== CLUB.area || zoneAt(map, x, y)?.id !== CLUB.zone) return false;
  return map.furniture.some((f) => f.type === "dance-floor" && x >= f.x * ts && x < (f.x + f.w) * ts && y >= f.y * ts && y < (f.y + f.d) * ts);
}

/** Juego de la máquina: el de su punto "arcade" más cercano (el mismo índice que usa el servidor). */
function cabinetGame(map: OfficeMap, f: PlacedFurniture) {
  const cx = (f.x + f.w / 2) * map.tileSize;
  const cy = (f.y + f.d / 2) * map.tileSize;
  let best = { i: -1, d: Infinity };
  pointsOfType(map, "arcade").forEach((p, i) => {
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < best.d) best = { i, d };
  });
  return best.i < 0 ? null : (ARCADE_MACHINES[best.i] ?? null);
}

/** Registra una hoja como textura con frames de w x h numerados de izquierda a derecha y de arriba abajo. */
function addSheet(scene: Phaser.Scene, key: string, px: PixelCanvas, w: number, h: number) {
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.addCanvas(key, toHtmlCanvas(px));
  if (!texture) return key;
  const cols = px.width / w;
  const rows = px.height / h;
  for (let i = 0; i < cols * rows; i++) texture.add(i, 0, (i % cols) * w, Math.floor(i / cols) * h, w, h);
  return key;
}

export class ClubMode {
  private map?: OfficeMap;
  private floorLayers: Layer[] = [];
  private stageLayers: Layer[] = [];
  private eqLayers: Layer[] = [];
  private speakerLayers: Layer[] = [];
  private screens: { layer: Layer; kind: ArcadeScreenKind }[] = [];
  private beams: Phaser.GameObjects.Image[] = [];
  private djGlows: Phaser.GameObjects.Image[] = [];
  private poleGlows = new Map<PlacedFurniture, Phaser.GameObjects.Image>();
  private dances = new Map<string, DanceImage>();
  /** Última posición de cada bailarín (si se mueve, se deja de ver el baile al instante). */
  private lastPos = new Map<string, { x: number; y: number }>();
  private objects: Phaser.GameObjects.GameObject[] = [];
  private screenFrame = 0;
  private screenTimer?: Phaser.Time.TimerEvent;
  private offReaction: () => void;
  private offTip: () => void;
  /** Los billetes que quedaron en la tarima, y cuántos hay en cada montoncito. */
  private pile: LandedBill[] = [];
  private pileHeights = new Map<number, number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly avatarOf: (sessionId: string) => Avatar | undefined,
    private readonly local: () => Avatar | undefined,
    private readonly localId: () => string | null,
  ) {
    this.offReaction = onClubReaction((e) => this.floatReaction(e));
    this.offTip = onClubTip((e) => this.throwBills(e));
  }

  /** Se dibujó un nivel: capas nuevas para sus muebles del club y del arcade. */
  private view?: AreaView;

  setArea(map: OfficeMap, view: AreaView) {
    this.clear();
    this.map = map;
    this.view = view;
    for (const f of map.furniture) {
      if (f.type === "dance-floor" && inClub(map, f)) this.floorLayers.push(this.layer(f, "club-pista-0", danceFloorLights(0), DEPTH_FLAT + 1));
      else if (f.type === "pole-stage") this.stageLayers.push(this.layer(f, "club-tarima-0", poleStageLights(0), DEPTH_FLAT + 1));
      else if (f.type === "dj-booth") this.eqLayers.push(this.layer(f, "club-eq-0", djBoothEq(EQ_LEVELS[0]!)));
      else if (f.type === "speaker" && inClub(map, f))
        this.speakerLayers.push(this.layer(f, "club-parlante-0", speakerPulse(0)));
      else if (f.type === "arcade-cabinet") {
        const kind = cabinetGame(map, f);
        this.screens.push({ layer: this.layer(f, `arcade-pantalla-${kind ?? "off"}-0`, arcadeScreen(kind ?? "off", 0)), kind: kind ?? "off" });
      }
    }
    for (const l of [...this.floorLayers, ...this.stageLayers]) l.img.setVisible(false);
    for (const f of map.furniture.filter((f) => f.type === "dance-pole")) {
      const glow = this.glow(f, 26, "#ff5fd2", 28, 0.5).setVisible(false);
      this.poleGlows.set(f, glow);
    }
    const booth = map.furniture.find((f) => f.type === "dj-booth");
    if (booth) for (const [k, color] of LIGHTS.slice(0, 2).entries()) this.djGlows.push(this.glow(booth, 22 + k * 4, color, 18, 0.45).setVisible(false));
    const floor = map.furniture.find((f) => f.type === "dance-floor" && inClub(map, f));
    if (floor) {
      for (let k = 0; k < 3; k++) {
        const key = ensureTexture(this.scene, `club-rayo-${k}`, () => glowSprite(22, 11, LIGHTS[k]!, 0.4));
        const img = this.scene.add.image(0, 0, key).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_FLAT + 2).setVisible(false);
        this.beams.push(img);
        this.objects.push(img);
      }
    }
    // Las pantallas del arcade siempre están en modo demostración.
    if (this.screens.length) this.screenTimer = this.scene.time.addEvent({ delay: 330, loop: true, callback: () => this.tickScreens() });
  }

  destroy() {
    this.clear();
    this.offReaction();
    this.offTip();
    video?.destroy();
    video = null;
    disposeClubMusic();
  }

  // ---------- Cada frame ----------

  update() {
    const map = this.map;
    const club = useClubStore.getState();
    const playing = isPlaying(club);
    const beat = playing ? clubBeat() : null;
    const me = this.local();
    const myId = this.localId();
    const office = useOfficeStore.getState();
    const inClub = Boolean(me && map && map.id === CLUB.area && office.zone?.id === CLUB.zone);

    // La música: solo dentro del club, con el volumen propio (y nada si la silencié).
    const level = inClub && !club.muted ? club.volume : 0;
    const music = clubMusic(serverNow, playing && level > 0);
    music?.setSong(club.track, club.startedAt, playing);
    music?.setLevel(level);
    music?.update();
    this.updateVideo(level);

    const mine = myId ? club.dancers[myId] : undefined;
    club.setHere({
      inClub,
      onFloor: Boolean(me && map && !me.isSeated && onFloor(map, me.x, me.y)),
      dancing: mine ? mine.kind : null,
      tipTarget: inClub && mine?.kind !== "pole" ? this.tipTargetFor(club.dancers, myId) : null,
    });
    if (!map) return;
    this.agePile();

    this.updateLights(beat);
    this.updateDancers(club.dancers, beat);
  }

  // ---------- Video de YouTube ----------

  /** El reproductor existe mientras estoy en el sótano; suena solo dentro del club, con mi volumen. */
  private updateVideo(level: number) {
    const map = this.map;
    const club = useClubStore.getState();
    if (!map || map.id !== CLUB.area) {
      video?.destroy();
      video = null;
      return;
    }
    const parent = this.scene.game.canvas.parentElement;
    if (!parent) return;
    if (!video && club.now) video = clubScreen(parent);
    video?.update({
      entry: club.now,
      elapsedMs: club.paused ? club.pausedAt : serverNow() - club.startedAt,
      paused: club.paused,
      volume: level,
      quad: this.videoQuad(parent),
      big: club.videoBig,
    });
  }

  /** Dónde cae la imagen de la pantalla del club, en px del contenedor (null si no se ve). */
  private videoQuad(parent: HTMLElement) {
    const f = this.map!.def.features.find((w) => w.kind === "video-wall");
    return f ? wallQuad(this.scene, this.map!, f, VIDEO_WALL_SCREEN, parent) : null;
  }

  /**
   * Una reacción sube sobre la cabeza de quien la mandó (sobre la pantalla la taparía el video, que va
   * encima del canvas); si no lo veo, desde el borde de arriba de la pantalla.
   */
  private floatReaction(e: ClubReactionEvent) {
    const map = this.map;
    if (!map || map.id !== CLUB.area) return;
    const a = this.avatarOf(e.sessionId);
    const f = map.def.features.find((w) => w.kind === "video-wall");
    let p: Point | null = null;
    if (a && !a.isHidden) p = worldToScreen(a.x + (Math.random() - 0.5) * 12, a.y, 40);
    else if (f) p = worldToScreen((f.x + (f.width ?? 1) * (0.2 + Math.random() * 0.6)) * map.tileSize, f.y * map.tileSize, VIDEO_WALL_SCREEN.hv1 + 4);
    if (!p) return;
    const key = ensureTexture(this.scene, `reaccion-${e.emoji}`, () => drawReaction(e.emoji));
    const text = this.scene.add.image(Math.round(p.x), Math.round(p.y), key).setOrigin(0.5, 1).setDepth(DEPTH_OVERLAY + 12);
    this.scene.tweens.add({
      targets: text,
      y: text.y - 26 - Math.random() * 10,
      x: text.x + (Math.random() - 0.5) * 10,
      alpha: 0,
      duration: 1800,
      ease: "Sine.out",
      onComplete: () => text.destroy(),
    });
  }

  private updateLights(beat: number | null) {
    const on = beat !== null;
    const b = beat ?? 0;
    const frac = b - Math.floor(b);
    for (const l of this.floorLayers) {
      l.img.setVisible(on);
      if (on) this.setLayer(l, `club-pista-${Math.floor(b) % FLOOR_LIGHT_PATTERNS}`, () => danceFloorLights(Math.floor(b) % FLOOR_LIGHT_PATTERNS));
    }
    for (const l of this.eqLayers) {
      const k = on ? Math.floor(b * 4) % EQ_FRAMES : 0;
      l.img.setVisible(on);
      if (on) this.setLayer(l, `club-eq-${k}`, () => djBoothEq(EQ_LEVELS[k]!));
    }
    // El woofer empuja en cada golpe del bombo y vuelve.
    const push = on ? (frac < 0.12 ? 2 : frac < 0.3 ? 1 : 0) : 0;
    for (const l of this.speakerLayers) {
      l.img.setVisible(on);
      this.setLayer(l, `club-parlante-${push}`, () => speakerPulse(push));
      l.img.setY(l.y0 + (push === 2 ? -1 : 0));
    }
    // Luces de la cabina que se turnan en cada tiempo.
    this.djGlows.forEach((g, k) => g.setVisible(on && Math.floor(b) % 2 === k).setAlpha(1 - frac * 0.6));
    // Rayos de colores que barren la pista.
    const map = this.map;
    const floor = map?.furniture.find((f) => f.type === "dance-floor" && inClub(map, f));
    if (floor) {
      const ts = this.map!.tileSize;
      this.beams.forEach((img, k) => {
        img.setVisible(on);
        if (!on) return;
        const a = b * 0.5 + (k * Math.PI * 2) / 3;
        const wx = (floor.x + floor.w / 2 + Math.cos(a) * floor.w * 0.32) * ts;
        const wy = (floor.y + floor.d / 2 + Math.sin(a * 1.3) * floor.d * 0.32) * ts;
        const p = worldToScreen(wx, wy);
        img.setPosition(Math.round(p.x), Math.round(p.y)).setAlpha(0.55 + 0.45 * (1 - frac));
      });
    }
  }

  private updateDancers(dancers: Record<string, ClubDancerView>, beat: number | null) {
    const map = this.map!;
    const ts = map.tileSize;
    const now = serverNow();
    const polesInUse = new Set<string>();
    const seen = new Set<string>();
    for (const [id, d] of [...Object.entries(dancers), ...this.djsAtBooth(dancers, beat)]) {
      const avatar = this.avatarOf(id);
      if (!avatar || avatar.isHidden) continue;
      // Si se está moviendo (el servidor todavía no lo sacó), ya no se ve bailando.
      const last = this.lastPos.get(id);
      this.lastPos.set(id, { x: avatar.x, y: avatar.y });
      if (last && Math.hypot(last.x - avatar.x, last.y - avatar.y) > 0.5) continue;
      const look = this.lookOf(id);
      if (!look) continue;
      if (d.kind === "pole") {
        const pole = map.furniture.find((f) => f.type === "dance-pole" && poleKey(f.x, f.y) === d.move);
        if (!pole) continue;
        polesInUse.add(d.move);
        // Con música sigue el ritmo; sin música, su propio tempo desde que empezó.
        const t = beat ?? ((now - d.since) * CLUB.poleBpm) / 60_000;
        const frame = Math.floor(t * 2) % POLE_ROUTINE.length;
        const texture = addSheet(this.scene, `${look.key}-tubo`, drawPoleDance(look.style), POLE_FRAME_W, POLE_FRAME_H);
        const cx = (pole.x + pole.w / 2) * ts;
        const cy = (pole.y + pole.d / 2) * ts;
        const p = worldToScreen(cx, cy);
        const img = this.danceImage(id, texture, POLE_FEET_Y / POLE_FRAME_H);
        img.setFrame(frame).setPosition(Math.round(p.x), Math.round(p.y)).setDepth(depthOf(cx, cy) + (POLE_ROUTINE[frame]!.behind ? -0.3 : 0.3));
        // El nombre y las burbujas van con quien baila, no donde quedaron sus pies.
        avatar.setOverlayAnchor({ x: cx, y: cy });
      } else {
        avatar.setOverlayAnchor(null);
        const row = Math.max(0, DANCE_MOVE_IDS.indexOf(d.move as DanceMoveId));
        const t = beat ?? 0;
        const frame = row * DANCE_FRAMES + (Math.floor(t * 2) % DANCE_FRAMES);
        const texture = addSheet(this.scene, `${look.key}-pista`, drawFloorDance(look.style), FRAME, FRAME);
        const p = worldToScreen(avatar.x, avatar.y);
        // Un saltito en cada tiempo.
        const hop = t - Math.floor(t) < 0.18 ? 1 : 0;
        const img = this.danceImage(id, texture, FEET_Y / FRAME);
        img.setFrame(frame).setPosition(Math.round(p.x), Math.round(p.y) + 1 - hop).setDepth(depthOf(avatar.x, avatar.y) + 0.5);
      }
      avatar.setBodyVisible(false);
      seen.add(id);
    }
    // Los que dejaron de bailar vuelven a verse como siempre.
    for (const [id, dance] of this.dances) {
      if (seen.has(id)) continue;
      dance.img.destroy();
      this.dances.delete(id);
      this.lastPos.delete(id);
      this.avatarOf(id)?.setBodyVisible(true);
      this.avatarOf(id)?.setOverlayAnchor(null);
    }
    // La tarima se enciende con alguien en el tubo (o toda la noche en el karaoke de los viernes: es el
    // escenario): los bombillos corren y el tubo brilla.
    const karaoke = useOfficeStore.getState().karaoke;
    const lit = polesInUse.size > 0 || karaoke;
    const phase = Math.floor((beat ?? now / 400) * 2) % 6;
    for (const l of this.stageLayers) {
      l.img.setVisible(lit);
      if (lit) this.setLayer(l, `club-tarima-${phase}`, () => poleStageLights(phase));
    }
    for (const [pole, glow] of this.poleGlows) glow.setVisible(karaoke || polesInUse.has(poleKey(pole.x, pole.y))).setAlpha(0.7 + 0.3 * Math.sin(now / 300));
  }

  /**
   * Quien está parado en la cabina mientras suena la música se mueve al ritmo (un vaivén). No pasa por el
   * servidor: la posición y el compás ya son los mismos para todos, así que todos lo ven igual.
   */
  private djsAtBooth(dancers: Record<string, ClubDancerView>, beat: number | null): [string, ClubDancerView][] {
    const map = this.map;
    const players = getRoom()?.state.players;
    if (beat === null || !map || !players) return [];
    const booths = pointsOfType(map, "dj_booth");
    if (!booths.length) return [];
    const reach = INTERACT_REACH_TILES * map.tileSize;
    const out: [string, ClubDancerView][] = [];
    players.forEach((_p, id) => {
      if (dancers[id]) return;
      const a = this.avatarOf(id);
      if (!a || a.isHidden || a.isSeated) return;
      if (booths.some((b) => Math.hypot(b.x - a.x, b.y - a.y) <= reach)) out.push([id, { kind: "floor", move: "vaiven", since: 0 }]);
    });
    return out;
  }

  private danceImage(id: string, texture: string, originY: number) {
    let d = this.dances.get(id);
    if (d && d.texture !== texture) {
      d.img.destroy();
      d = undefined;
    }
    if (!d) {
      d = { img: this.scene.add.image(0, 0, texture, 0).setOrigin(0.5, originY), texture };
      this.dances.set(id, d);
    }
    return d.img;
  }

  /** Clave de textura y dibujo del personaje de una sesión (el mismo look → las mismas hojas). */
  private lookOf(sessionId: string) {
    const p = getRoom()?.state.players.get(sessionId);
    if (!p) return null;
    const look = parseLook(p.look);
    return { key: characterKey(p.avatar, look), style: styleFor(p.avatar, look) };
  }

  // ---------- Propinas ----------

  /** El tubo con esa llave en este nivel. */
  private poleOf(key: string) {
    return this.map?.furniture.find((f) => f.type === "dance-pole" && poleKey(f.x, f.y) === key);
  }

  /** Quien baila en un tubo a mi alcance (la misma cuenta que el servidor), o null. */
  private tipTargetFor(dancers: Record<string, ClubDancerView>, myId: string | null): string | null {
    const me = this.local();
    const map = this.map;
    if (!me || !map) return null;
    const ts = map.tileSize;
    for (const [id, d] of Object.entries(dancers)) {
      if (id === myId || d.kind !== "pole") continue;
      const pole = this.poleOf(d.move);
      if (pole && Math.hypot((pole.x + pole.w / 2) * ts - me.x, (pole.y + pole.d / 2) * ts - me.y) <= CLUB_TIP.reachPx) return id;
    }
    return null;
  }

  /**
   * Alguien tiró billetes: vuelan en arco desde su mano hasta la tarima, dando vueltas, y quedan en uno de
   * los montoncitos alrededor del tubo. Suena la caja al caer el primero; sobre quien baila sube el monto.
   */
  private throwBills(e: ClubTipEvent) {
    const map = this.map;
    if (!map || map.id !== CLUB.area) return;
    const pole = this.poleOf(e.pole);
    if (!pole) return;
    const ts = map.tileSize;
    const cx = (pole.x + pole.w / 2) * ts;
    const cy = (pole.y + pole.d / 2) * ts;
    const from = this.avatarOf(e.fromSessionId);
    // Si no veo a quien tira, los billetes entran desde el borde de la tarima.
    const start = from && !from.isHidden ? worldToScreen(from.x, from.y, 20) : worldToScreen(cx + ts * 2, cy + ts * 2, 40);
    const n = billsFor(e.amount);
    const frames = Array.from({ length: BILL_FRAMES }, (_, f) => ensureTexture(this.scene, `billete-${e.amount}-${f}`, () => drawBill(e.amount, f)));
    for (let i = 0; i < n; i++) {
      const spot = Math.floor(Math.random() * PILE_SPOTS.length);
      const [dx, dy] = PILE_SPOTS[spot]!;
      const end = worldToScreen(cx + (dx + (Math.random() - 0.5) * 0.3) * ts, cy + (dy + (Math.random() - 0.5) * 0.3) * ts);
      const img = this.scene.add.image(Math.round(start.x), Math.round(start.y), frames[0]!).setDepth(DEPTH_OVERLAY + 5);
      const lift = 26 + Math.random() * 14;
      const spin = 6 + Math.floor(Math.random() * 4);
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        delay: i * 90,
        duration: 620 + Math.random() * 120,
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          img.setPosition(Math.round(start.x + (end.x - start.x) * t), Math.round(start.y + (end.y - start.y) * t - lift * 4 * t * (1 - t)));
          img.setTexture(frames[Math.floor(t * spin) % BILL_FRAMES]!);
        },
        onComplete: () => this.land(img, frames[0]!, spot, end, i === 0 ? { x: cx, y: cy } : null),
      });
    }
    // El aviso: a quien baila, de quién; a los demás, solo el monto (sobre quien baila).
    const mine = e.toSessionId === this.localId();
    const dancer = this.dances.get(e.toSessionId)?.img;
    const top = dancer ? { x: dancer.x, y: dancer.getBounds().top } : worldToScreen(cx, cy, 56);
    this.floatText(top.x, top.y - 2, mine ? `+${e.amount} de ${e.fromName}` : `+${e.amount}`, mine ? "10px" : "8px");
  }

  /** Un billete llega al piso: queda plano, un poco más arriba cuanto más alto es su montoncito. */
  private land(img: Phaser.GameObjects.Image, flat: string, spot: number, end: Point, ring: Point | null) {
    if (!this.map) return void img.destroy();
    const height = this.pileHeights.get(spot) ?? 0;
    this.pileHeights.set(spot, height + 1);
    img
      .setTexture(flat)
      .setPosition(Math.round(end.x), Math.round(end.y) - Math.min(height, 8))
      .setDepth(DEPTH_FLAT + 3 + this.pile.length * 1e-4);
    this.pile.push({ img, at: this.scene.time.now, spot });
    // La caja suena como cualquier otro ruido del nivel: más bajo cuanto más lejos del tubo.
    if (ring) sfx.chaChing(volAt(ring.x, ring.y));
    while (this.pile.length > BILL_PILE_MAX) this.dropBill(this.pile[0]!);
  }

  /** Los billetes viejos se desvanecen (y su montoncito baja). */
  private agePile() {
    const now = this.scene.time.now;
    for (const b of [...this.pile]) if (now - b.at > BILL_PILE_MS) this.dropBill(b);
  }

  private dropBill(b: LandedBill) {
    this.pile = this.pile.filter((x) => x !== b);
    this.pileHeights.set(b.spot, Math.max(0, (this.pileHeights.get(b.spot) ?? 1) - 1));
    this.scene.tweens.add({ targets: b.img, alpha: 0, duration: 600, onComplete: () => b.img.destroy() });
  }

  private floatText(x: number, y: number, text: string, size: string) {
    const label = this.scene.add
      .text(Math.round(x), Math.round(y), text, { fontFamily: cozyFontFamily(), fontSize: size, color: "#f3d672", stroke: COZY.frame, strokeThickness: 2, resolution: 6 })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY + 12);
    this.scene.tweens.add({ targets: label, y: label.y - 18, alpha: 0, duration: 1800, ease: "Sine.out", onComplete: () => label.destroy() });
  }

  /**
   * Clic sobre quien baila en el tubo (estando a su alcance): le tira un billete de 1. Devuelve si usó el
   * clic (así no se abre el menú de la persona ni se camina).
   */
  pointerDown(worldX: number, worldY: number): boolean {
    const target = useClubStore.getState().here.tipTarget;
    const img = target ? this.dances.get(target)?.img : undefined;
    if (!target || !img || !img.getBounds().contains(worldX, worldY)) return false;
    sendClubTip(target, 1);
    return true;
  }

  // ---------- Teclas ----------

  /**
   * E sobre la pista: bailar (o dejar de bailar; sin música el servidor avisa por qué). Devuelve si la usó. El tubo va por los
   * objetos interactivos (la tarima), como antes.
   */
  tapE(near: string | null): boolean {
    const { here, dancers, move, tipOpen, setTipOpen } = useClubStore.getState();
    // Junto a la tarima con alguien en el tubo, E abre (o cierra) los billetes.
    if (here.tipTarget && (!near || near === "pole")) {
      setTipOpen(!tipOpen);
      return true;
    }
    const id = this.localId();
    const mine = id ? dancers[id] : undefined;
    if (mine?.kind === "floor") {
      sendClubDance(null);
      return true;
    }
    // Junto a la cabina, la tarima o la barra, E abre lo suyo.
    if (near || !here.onFloor) return false;
    sendClubDance(move);
    return true;
  }

  /** Esc: soltar el tubo o dejar de bailar. Devuelve si la usó. */
  esc(): boolean {
    const club = useClubStore.getState();
    // Primero se achica el video si está en grande.
    if (club.videoBig) {
      club.setVideoBig(false);
      return true;
    }
    if (club.tipOpen) {
      club.setTipOpen(false);
      return true;
    }
    const id = this.localId();
    const mine = id ? club.dancers[id] : undefined;
    if (!mine) return false;
    if (mine.kind === "pole") sendClubPole(false);
    else sendClubDance(null);
    return true;
  }

  // ---------- Capas ----------

  private layer(f: PlacedFurniture, key: string, s: Sprite, depth?: number): Layer {
    const ts = this.map!.tileSize;
    const item = catalogItem(f.type);
    const flip = !item.fixed && (f.facing === "down" || f.facing === "up");
    const [w, d] = footprint(item, f.facing);
    const a = worldToScreen(f.x * ts, f.y * ts);
    ensureTexture(this.scene, key, () => s.canvas);
    const img = this.scene.add
      .image(a.x - (flip ? s.canvas.width - s.ox : s.ox), a.y - s.oy, key)
      .setOrigin(0, 0)
      .setFlipX(flip)
      .setDepth(depth ?? depthOf((f.x + w / 2) * ts, (f.y + d / 2) * ts) + 0.02);
    this.objects.push(img);
    this.view?.attach(f, img);
    return { f, img, key, y0: img.y };
  }

  private setLayer(l: Layer, key: string, make: () => Sprite) {
    if (l.key === key) return;
    ensureTexture(this.scene, key, () => make().canvas);
    l.img.setTexture(key);
    l.key = key;
  }

  /** Resplandor sumado sobre un mueble, a la altura `z` (px de arte). */
  private glow(f: PlacedFurniture, z: number, color: string, r: number, a: number) {
    const ts = this.map!.tileSize;
    const p = worldToScreen((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts, z);
    const key = ensureTexture(this.scene, `club-luz-${color}-${r}`, () => glowSprite(r, Math.round(r * 0.6), color, a));
    const img = this.scene.add.image(p.x, p.y, key).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_OVERLAY + 1);
    this.objects.push(img);
    this.view?.attach(f, img);
    return img;
  }

  private tickScreens() {
    this.screenFrame++;
    for (const s of this.screens) {
      const frame = s.kind === "off" ? this.screenFrame % 3 : this.screenFrame % 7;
      this.setLayer(s.layer, `arcade-pantalla-${s.kind}-${frame}`, () => arcadeScreen(s.kind, frame));
    }
  }

  private clear() {
    this.screenTimer?.remove();
    this.screenTimer = undefined;
    for (const o of this.objects) o.destroy();
    this.objects = [];
    for (const [id, d] of this.dances) {
      d.img.destroy();
      this.avatarOf(id)?.setBodyVisible(true);
      this.avatarOf(id)?.setOverlayAnchor(null);
    }
    this.dances.clear();
    this.lastPos.clear();
    for (const b of this.pile) b.img.destroy();
    this.pile = [];
    this.pileHeights.clear();
    this.floorLayers = [];
    this.stageLayers = [];
    this.eqLayers = [];
    this.speakerLayers = [];
    this.screens = [];
    this.beams = [];
    this.djGlows = [];
    this.poleGlows.clear();
  }
}
