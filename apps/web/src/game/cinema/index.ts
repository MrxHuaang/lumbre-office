// El cine en la escena: la función de YouTube proyectada sobre la pantalla de la pared oeste (con la hora
// del servidor, así todos ven el mismo segundo), que solo se oye dentro de la sala y con el volumen
// propio; las luces que bajan mientras hay función y el haz del proyector. La escena solo tiene ganchos
// chicos: setArea, update, esc y destroy.
import { nearPointOfType, zoneAt, type OfficeMap, type Zone } from "@hyvento/map";
import { CINEMA_SCREEN, L, WORLD_TO_ART } from "@hyvento/map/art";
import { CINEMA, isShowing } from "@hyvento/shared";
import * as Phaser from "phaser";
import type { Avatar } from "../Avatar";
import { DEPTH_OVERLAY, worldToScreen } from "../iso/view";
import { useOfficeStore } from "../store";
import { serverNow } from "../club/store";
import { wallQuad, type Point } from "../wallMount";
import { YoutubeScreen } from "../youtube";
import { sendCinema } from "./net";
import { penumbraOutline } from "./penumbra";
import { useCinemaStore } from "./store";

/** Penumbra de la sala con función (0 a 1 de este alfa) y cuánto queda en pausa (las luces a media). */
const DIM_ALPHA = 0.6;
const PAUSED_DIM = 0.45;
/** Cuánto tarda en bajar o subir la luz (ms, de todo a nada). */
const FADE_MS = 1600;
/** Color de la penumbra (azul noche, como la alfombra del cine) y del haz del proyector. */
const DIM_COLOR = 0x0b0818;
const BEAM_COLOR = 0xfff1c9;

/** Lo que el cine hace con los avisos de su reproductor: la cola la lleva el servidor. */
function cinemaScreen(parent: HTMLElement) {
  return new YoutubeScreen(parent, {
    onDuration: (id, ms) => sendCinema({ action: "duration", id, ms }),
    onEnded: (id) => sendCinema({ action: "ended", id }),
    // La película no se puede ver (la borraron, no deja insertarse): se salta para todos.
    onError: (id, code) => {
      useOfficeStore
        .getState()
        .notify(code === 101 || code === 150 ? "Esa película no deja verse fuera de YouTube: pasa a la siguiente." : "Esa película no se pudo proyectar: pasa a la siguiente.", "warning");
      sendCinema({ action: "skip", id });
    },
    onNeedsTap: (needs) => useCinemaStore.getState().setNeedsTap(needs),
    onClick: () => {
      const s = useCinemaStore.getState();
      s.setBig(!s.big);
    },
    titles: { small: "Ver la función en grande", big: "Volver a la sala" },
    bigFrame: "0 0 0 4px #1b0f14, 0 0 0 7px #d9a441, 8px 8px 0 7px #1b0f14",
  });
}

/** Envoltura convexa (para el haz: el lente y las cuatro esquinas de la tela). */
function hull(points: Point[]): Point[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Point[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export class CinemaMode {
  private map?: OfficeMap;
  private zone?: Zone;
  private dim?: Phaser.GameObjects.Graphics;
  private beam?: Phaser.GameObjects.Graphics;
  private video: YoutubeScreen | null = null;
  /** Luz de la sala: 0 = prendida, 1 = función a oscuras. */
  private level = 0;
  private lastTime = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly local: () => Avatar | undefined,
  ) {}

  setArea(map: OfficeMap) {
    this.clear();
    this.map = map;
    if (map.id !== CINEMA.area) {
      this.dropVideo();
      return;
    }
    this.zone = map.zones.find((z) => z.id === CINEMA.zone);
    if (!this.zone) return;
    this.dim = this.scene.add.graphics().setDepth(DEPTH_OVERLAY - 2).setVisible(false);
    this.drawDim(map, this.zone);
    this.beam = this.scene.add.graphics().setDepth(DEPTH_OVERLAY - 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.drawBeam(map);
  }

  destroy() {
    this.clear();
    this.dropVideo();
  }

  /** Esc con la función en grande: vuelve a la pantalla. Devuelve si la usó. */
  esc(): boolean {
    const s = useCinemaStore.getState();
    if (!s.big) return false;
    s.setBig(false);
    return true;
  }

  update(time: number) {
    const map = this.map;
    const me = this.local();
    const cine = useCinemaStore.getState();
    const office = useOfficeStore.getState();
    const inCinema = Boolean(me && map && map.id === CINEMA.area && office.zone?.id === CINEMA.zone);
    const atBooth = Boolean(inCinema && me && map && nearPointOfType(map, CINEMA.boothPoint, me.x, me.y));
    cine.setHere({ inCinema, atBooth });
    if (!map || map.id !== CINEMA.area) return;

    this.updateVideo(inCinema && !cine.muted ? cine.volume : 0);

    // Las luces bajan con la función y suben al terminar (a media luz en pausa).
    const target = cine.now ? (isShowing(cine) ? 1 : PAUSED_DIM) : 0;
    const dt = this.lastTime ? Math.min(100, time - this.lastTime) : 16;
    this.lastTime = time;
    const step = dt / FADE_MS;
    this.level = this.level < target ? Math.min(target, this.level + step) : Math.max(target, this.level - step);
    this.dim?.setVisible(this.level > 0).setAlpha(this.level);
    // El haz solo con la película corriendo, y titila apenas (el obturador del proyector).
    const beamOn = isShowing(cine) && this.level > 0.2;
    this.beam?.setVisible(beamOn).setAlpha(beamOn ? this.level * (0.9 + 0.1 * Math.sin(time / 90)) : 0);
  }

  // ---------- Video ----------

  /** El reproductor existe mientras hay función y estoy en el sótano; se oye solo dentro de la sala. */
  private updateVideo(level: number) {
    const cine = useCinemaStore.getState();
    const parent = this.scene.game.canvas.parentElement;
    if (!parent) return;
    if (!this.video && cine.now) this.video = cinemaScreen(parent);
    const f = this.map!.def.features.find((w) => w.kind === "cinema-screen");
    this.video?.update({
      entry: cine.now,
      elapsedMs: cine.paused ? cine.pausedAt : serverNow() - cine.startedAt,
      paused: cine.paused,
      volume: level,
      quad: f ? wallQuad(this.scene, this.map!, f, CINEMA_SCREEN, parent) : null,
      big: cine.big,
    });
    if (!cine.now && cine.big) cine.setBig(false);
  }

  private dropVideo() {
    this.video?.destroy();
    this.video = null;
    const s = useCinemaStore.getState();
    s.setBig(false);
    s.setHere({ inCinema: false, atBooth: false });
  }

  // ---------- Penumbra y haz ----------

  /** La penumbra: un polígono sobre la sala (ver penumbra.ts), que se prende y apaga con su alfa. */
  private drawDim(map: OfficeMap, zone: Zone) {
    const pts = penumbraOutline(map, zone).map((p) => worldToScreen(p.x, p.y, p.z));
    this.dim!.fillStyle(DIM_COLOR, DIM_ALPHA).fillPoints(pts.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
  }

  /** El haz del proyector: del lente a las cuatro esquinas de la tela, sumado encima de la penumbra. */
  private drawBeam(map: OfficeMap) {
    const f = map.def.features.find((w) => w.kind === "cinema-screen");
    const projector = map.furniture.find((p) => p.type === "projector" && zoneAt(map, (p.x + 0.5) * map.tileSize, (p.y + 0.5) * map.tileSize)?.id === CINEMA.zone);
    if (!f || !projector) return;
    const ts = map.tileSize;
    const len = (f.width ?? 1) * L;
    const x0 = f.x * ts;
    const y0 = f.y * ts;
    const corner = (u: number, hv: number) => worldToScreen(x0, y0 + (len - u) / WORLD_TO_ART, hv);
    const u1 = len - CINEMA_SCREEN.uPad;
    const corners = [
      corner(CINEMA_SCREEN.u0, CINEMA_SCREEN.hv0),
      corner(CINEMA_SCREEN.u0, CINEMA_SCREEN.hv1),
      corner(u1, CINEMA_SCREEN.hv0),
      corner(u1, CINEMA_SCREEN.hv1),
    ];
    // El lente, del lado de la pantalla (el proyector mira al oeste), a la altura de su luz.
    const lens = worldToScreen((projector.x + 0.2) * ts, (projector.y + 0.5) * ts, 15);
    const shape = hull([lens, ...corners]).map((p) => new Phaser.Geom.Point(p.x, p.y));
    const g = this.beam!;
    g.fillStyle(BEAM_COLOR, 0.07).fillPoints(shape, true);
    // Un núcleo más angosto y un poco más claro, hacia el centro de la tela.
    const mid = { x: (corners[0]!.x + corners[3]!.x) / 2, y: (corners[0]!.y + corners[3]!.y) / 2 };
    const core = hull([lens, ...corners.map((c) => ({ x: mid.x + (c.x - mid.x) * 0.55, y: mid.y + (c.y - mid.y) * 0.55 }))]);
    g.fillStyle(BEAM_COLOR, 0.06).fillPoints(core.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
  }

  private clear() {
    this.dim?.destroy();
    this.beam?.destroy();
    this.dim = undefined;
    this.beam = undefined;
    this.zone = undefined;
    this.level = 0;
    this.lastTime = 0;
  }
}
