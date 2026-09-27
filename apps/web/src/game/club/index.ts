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
  type ArcadeScreenKind,
  type PixelCanvas,
  type Sprite,
} from "@hyvento/map/art";
import { ARCADE_MACHINES, CLUB, DANCE_MOVE_IDS, isPlaying, poleKey, type DanceMoveId } from "@hyvento/shared";
import * as Phaser from "phaser";
import type { Avatar } from "../Avatar";
import { AreaView, DEPTH_FLAT, DEPTH_OVERLAY, depthOf, ensureTexture, toHtmlCanvas, worldToScreen } from "../iso/view";
import { characterKey, parseLook } from "../looks";
import { getRoom } from "../network";
import { useOfficeStore } from "../store";
import { clubMusic, disposeClubMusic } from "./music";
import { sendClubDance, sendClubPole } from "./net";
import { clubBeat, serverNow, useClubStore, type ClubDancerView } from "./store";

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

/** ¿Están los pies en (x, y) sobre la pista de baile? (la misma cuenta que el servidor). */
function onFloor(map: OfficeMap, x: number, y: number) {
  const ts = map.tileSize;
  return map.furniture.some((f) => f.type === "dance-floor" && x >= f.x * ts && x < (f.x + f.w) * ts && y >= f.y * ts && y < (f.y + f.d) * ts);
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

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly avatarOf: (sessionId: string) => Avatar | undefined,
    private readonly local: () => Avatar | undefined,
    private readonly localId: () => string | null,
  ) {}

  /** Se dibujó un nivel: capas nuevas para sus muebles del club y del arcade. */
  setArea(map: OfficeMap, _view: AreaView) {
    this.clear();
    this.map = map;
    let cabinet = 0;
    for (const f of map.furniture) {
      if (f.type === "dance-floor") this.floorLayers.push(this.layer(f, "club-pista-0", danceFloorLights(0), DEPTH_FLAT + 1));
      else if (f.type === "pole-stage") this.stageLayers.push(this.layer(f, "club-tarima-0", poleStageLights(0), DEPTH_FLAT + 1));
      else if (f.type === "dj-booth") this.eqLayers.push(this.layer(f, "club-eq-0", djBoothEq(EQ_LEVELS[0]!)));
      else if (f.type === "speaker" && zoneAt(map, (f.x + 0.5) * map.tileSize, (f.y + 0.5) * map.tileSize)?.id === CLUB.zone)
        this.speakerLayers.push(this.layer(f, "club-parlante-0", speakerPulse(0)));
      else if (f.type === "arcade-cabinet") {
        const kind = ARCADE_MACHINES[cabinet++] ?? null;
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
    const floor = map.furniture.find((f) => f.type === "dance-floor");
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

    const mine = myId ? club.dancers[myId] : undefined;
    club.setHere({
      inClub,
      onFloor: Boolean(me && map && !me.isSeated && onFloor(map, me.x, me.y)),
      dancing: mine ? mine.kind : null,
    });
    if (!map) return;

    this.updateLights(beat);
    this.updateDancers(club.dancers, beat);
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
    const floor = this.map?.furniture.find((f) => f.type === "dance-floor");
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
      } else {
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
    }
    // La tarima se enciende con alguien en el tubo: los bombillos corren y el tubo brilla.
    const lit = polesInUse.size > 0;
    const phase = Math.floor((beat ?? now / 400) * 2) % 6;
    for (const l of this.stageLayers) {
      l.img.setVisible(lit);
      if (lit) this.setLayer(l, `club-tarima-${phase}`, () => poleStageLights(phase));
    }
    for (const [pole, glow] of this.poleGlows) glow.setVisible(polesInUse.has(poleKey(pole.x, pole.y))).setAlpha(0.7 + 0.3 * Math.sin(now / 300));
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

  // ---------- Teclas ----------

  /**
   * E sobre la pista: bailar (o dejar de bailar; sin música el servidor avisa por qué). Devuelve si la usó. El tubo va por los
   * objetos interactivos (la tarima), como antes.
   */
  tapE(near: string | null): boolean {
    const { here, dancers, move } = useClubStore.getState();
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
    const id = this.localId();
    const mine = id ? useClubStore.getState().dancers[id] : undefined;
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
    }
    this.dances.clear();
    this.lastPos.clear();
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
