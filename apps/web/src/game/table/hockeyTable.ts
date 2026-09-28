// Modo mesa del hockey: la cámara se acerca a la mesa del arcade y el partido se juega sobre la cancha
// dibujada en alta resolución. El mouse lleva tu mazo (el servidor lo limita a tu mitad y a su
// velocidad; también se puede con las flechas o WASD); el disco y el mazo rival se interpolan entre los cuadros del servidor, un poco en el
// pasado para que se muevan parejo. Tu mazo se adelanta en el navegador y se corrige si se aleja.
import type { OfficeMap, PlacedFurniture } from "@hyvento/map";
import {
  C,
  hockeyBanner,
  hockeyRinkOverlay,
  hockeyRinkRect,
  malletPiece,
  mesaFrame,
  puckPiece,
  rinkToScreen,
  scoreboardPiece,
  screenToRink,
  tableZoom,
  HOCKEY_BOARD,
  HOCKEY_TOP_Z,
  localToScreen,
  TABLE_MAX_ZOOM,
  type HockeyPiece,
  type MesaFrame,
  type ScreenBox,
} from "@hyvento/map/art";
import { clampToHalf, HOCKEY, HOCKEY_MID, malletHome, type HockeySide } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { hockeyPose, mySide, sendHockeyMove, useHockeyStore, type HockeyView } from "../arcade/hockey";
import { useCasinoStore } from "../casino";
import { sfx } from "../sfx";
import { selectMyUserId, useOfficeStore } from "../store";
import type { TableCamera } from "./camera";
import { furnitureDepth, overlayImage, pieceImage } from "./draw";

/** Cuánto en el pasado se dibuja lo que manda el servidor (dos cuadros): así siempre hay entre qué interpolar. */
const INTERP_MS = 100;
/** Cada cuánto se manda a dónde va el mazo (como mucho). */
const SEND_MS = 50;
/**
 * Si mi mazo adelantado se aleja más que esto del que simula el servidor, se lo acerca. El del servidor
 * se ve 100 ms tarde (a toda velocidad, ~10 unidades atrás): con menos margen el mazo tironearía.
 */
const DRIFT = 12;
/** Teclas que mueven el mazo, con su dirección en la pantalla. */
const KEY_DIR: Record<string, Pt> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};
/** La mesa no tiene letras chicas: se acerca un poco menos que el casino como mínimo. */
const HOCKEY_MIN_ZOOM = 6;
let textureSeq = 0;

type Pt = { x: number; y: number };

export class HockeyTableView {
  readonly kind = "hockey" as const;
  private readonly fr: MesaFrame;
  readonly depth: number;
  private readonly rect: ScreenBox;
  private R = 4;
  private rink?: Phaser.GameObjects.Image;
  private puck?: Phaser.GameObjects.Image;
  private mallets: (Phaser.GameObjects.Image | undefined)[] = [];
  private malletKeys = ["", ""];
  private board?: { key: string; img: Phaser.GameObjects.Image };
  private banner?: { key: string; img: Phaser.GameObjects.Image };
  /** Mi mazo adelantado (coordenadas de la cancha) y a dónde lo llevo. */
  private mine: Pt | null = null;
  private target: Pt | null = null;
  private sentAt = 0;
  private sent = "";
  private lastTick = performance.now();
  /** Último cuadro ya sonado (golpes, bandas, goles). */
  private heardT = 0;
  /** Teclas de dirección apretadas (las lee la mesa: en el hockey no mueven al personaje). */
  private held = new Set<string>();
  private readonly onKey = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!KEY_DIR[k]) return;
    if (e.type === "keydown") this.held.add(k);
    else this.held.delete(k);
  };
  private readonly onBlur = () => this.held.clear();

  constructor(
    private readonly scene: Phaser.Scene,
    map: OfficeMap,
    table: PlacedFurniture,
    private readonly cam: TableCamera,
  ) {
    this.fr = mesaFrame(table);
    this.depth = furnitureDepth(map, table);
    this.rect = hockeyRinkRect(this.fr);
  }

  start() {
    const zoom = tableZoom(this.cam.viewport, this.rect, HOCKEY_MIN_ZOOM, TABLE_MAX_ZOOM);
    this.R = zoom / 2;
    this.cam.focus(this.rect, zoom);
    this.rink = overlayImage(this.scene, `mesa-hockey-cancha-${++textureSeq}`, hockeyRinkOverlay(this.fr, this.R), this.depth + 0.3);
    this.puck = this.pieceAt(`mesa-hockey-disco-${this.R}`, () => puckPiece(this.R), { x: 0, y: 0 }, this.depth + 0.5);
    // Los cuadros que ya estaban no suenan.
    this.heardT = useHockeyStore.getState().frames.at(-1)?.t ?? 0;
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    window.addEventListener("blur", this.onBlur);
    this.update();
  }

  /** Lo que no deben tapar los personajes que están delante: la mesa con el marcador. */
  get cover(): ScreenBox {
    return this.rect;
  }

  /**
   * Una pieza suelta con su punto de apoyo en `s` (pantalla). La textura se guarda por clave (el disco y
   * los mazos se reusan); el dibujo se rehace solo para saber dónde va su ancla, que es barato.
   */
  private pieceAt(texKey: string, make: () => HockeyPiece, s: Pt, depth: number) {
    const p = make();
    const img = pieceImage(this.scene, texKey, () => p.canvas, s.x, s.y, this.R, depth);
    img.setOrigin(p.ax / img.width, p.ay / img.height);
    return img;
  }

  /** Pone una pieza sobre la cancha en (x, y), con la profundidad de su lugar (la de adelante tapa). */
  private place(img: Phaser.GameObjects.Image | undefined, p: Pt) {
    if (!img) return;
    const s = rinkToScreen(this.fr, p.x, p.y, HOCKEY_TOP_Z);
    img.setPosition(s.x, s.y).setDepth(this.depth + 0.5 + (p.x + p.y) / 1000);
  }

  /** Cada cuadro: dónde van el disco y los mazos, el marcador, el cartel y los sonidos. */
  update() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now;
    const { table, frames } = useHockeyStore.getState();
    const offset = useCasinoStore.getState().offset;
    const serverNow = Date.now() + offset;
    const me = mySide(table, selectMyUserId(useOfficeStore.getState()));
    const live = table.phase === "countdown" || table.phase === "playing" || table.phase === "goal";
    const pose = live || table.phase === "over" ? hockeyPose(frames, serverNow - INTERP_MS) : null;

    for (const side of [0, 1] as const) {
      const key = `${side}:${side === me ? 1 : 0}`;
      if (this.malletKeys[side] !== key) {
        this.mallets[side]?.destroy();
        this.mallets[side] = this.pieceAt(`mesa-hockey-mazo-${side}-${side === me ? 1 : 0}-${this.R}`, () => malletPiece(this.R, side, side === me), { x: 0, y: 0 }, this.depth + 0.5);
        this.malletKeys[side] = key;
      }
    }

    // Mi mazo: se adelanta hacia el mouse con la misma velocidad y límites que en el servidor.
    if (me !== null && live) {
      const server = pose?.mallets[me] ?? malletHome(me);
      this.mine ??= { ...server };
      this.keyTarget(me);
      if (this.target) {
        const dx = this.target.x - this.mine.x;
        const dy = this.target.y - this.mine.y;
        const len = Math.hypot(dx, dy);
        const step = HOCKEY.malletSpeed * dt;
        if (len <= step) this.mine = { ...this.target };
        else this.mine = { x: this.mine.x + (dx / len) * step, y: this.mine.y + (dy / len) * step };
      }
      // El servidor manda: si nos alejamos de más (un mensaje perdido), se acerca de a poco (sin saltos).
      const drift = Math.hypot(server.x - this.mine.x, server.y - this.mine.y);
      if (drift > DRIFT) this.mine = { x: this.mine.x + (server.x - this.mine.x) * 0.15, y: this.mine.y + (server.y - this.mine.y) * 0.15 };
      this.flushTarget(now);
    } else {
      this.mine = null;
      this.target = null;
    }

    for (const side of [0, 1] as const) {
      const p = side === me && this.mine ? this.mine : (pose?.mallets[side] ?? malletHome(side));
      this.place(this.mallets[side], p);
    }
    this.place(this.puck, pose?.puck ?? { x: HOCKEY.width / 2, y: HOCKEY_MID });
    this.puck?.setVisible(table.phase !== "goal");

    this.syncBoard(table);
    this.syncBanner(table, me, serverNow);
    this.hear(frames);
  }

  /** Con flechas o WASD: el destino va un poco por delante del mazo, en la dirección de la pantalla. */
  private keyTarget(me: HockeySide) {
    if (!this.held.size || !this.mine || useOfficeStore.getState().typing) return;
    let dx = 0;
    let dy = 0;
    for (const k of this.held) {
      dx += KEY_DIR[k]!.x;
      dy += KEY_DIR[k]!.y;
    }
    if (!dx && !dy) return;
    // Una dirección de la pantalla, pasada a la cancha (que se ve en diagonal).
    const s0 = rinkToScreen(this.fr, this.mine.x, this.mine.y);
    const p = screenToRink(this.fr, s0.x + dx * 2, s0.y + dy);
    const ux = p.x - this.mine.x;
    const uy = p.y - this.mine.y;
    const len = Math.hypot(ux, uy) || 1;
    this.target = clampToHalf(me, this.mine.x + (ux / len) * 6, this.mine.y + (uy / len) * 6);
  }

  /** Manda a dónde va mi mazo (si cambió y como mucho cada SEND_MS). */
  private flushTarget(now: number) {
    if (!this.target || now - this.sentAt < SEND_MS) return;
    const key = `${this.target.x.toFixed(2)},${this.target.y.toFixed(2)}`;
    if (key === this.sent) return;
    this.sent = key;
    this.sentAt = now;
    sendHockeyMove(this.target.x, this.target.y);
  }

  private syncBoard(t: HockeyView) {
    const score: [number, number] = [t.sides[0].score, t.sides[1].score];
    // En el resultado, el marcador del ganador parpadea.
    const blink = t.phase === "over" && t.winner >= 0 && Math.floor(performance.now() / 400) % 2 === 0 ? t.winner : -1;
    const key = `${score[0]}-${score[1]}-${blink}-${this.R}`;
    if (this.board?.key === key) return;
    this.board?.img.destroy();
    const s = localToScreen(this.fr, HOCKEY_BOARD.u, HOCKEY_BOARD.v, HOCKEY_BOARD.z);
    const texKey = `mesa-hockey-marcador-${key}`;
    const img = this.pieceAt(texKey, () => scoreboardPiece(this.R, score, blink), s, this.depth + 0.45);
    this.board = { key, img };
  }

  /** El cartel grande sobre la cancha: la cuenta regresiva, "GOL!" y cómo terminó. */
  private syncBanner(t: HockeyView, me: HockeySide | null, serverNow: number) {
    let text = "";
    let ramp: "gold" | "neon" | "cyan" = "gold";
    if (t.phase === "countdown") text = String(Math.max(1, Math.ceil((t.endsAt - serverNow) / 1000)));
    else if (t.phase === "goal") text = "GOL!";
    else if (t.phase === "over") {
      if (t.winner === -1) text = "EMPATE";
      else if (me !== null) text = t.winner === me ? "GANASTE" : "PERDISTE";
      else {
        text = t.winner === 0 ? "GANA ROSA" : "GANA AZUL";
        ramp = t.winner === 0 ? "neon" : "cyan";
      }
    }
    const key = text ? `${text}-${ramp}-${this.R}` : "";
    if ((this.banner?.key ?? "") === key) return;
    // Suena lo que cambió: cada segundo de la cuenta y, al final, si ganaste o perdiste.
    if (t.phase === "countdown") sfx.countdown(text === "1");
    else if (t.phase === "over" && me !== null) {
      if (t.winner === me) sfx.win();
      else if (t.winner === -1) sfx.push();
      else sfx.lose();
    }
    this.banner?.img.destroy();
    this.banner = undefined;
    if (!text) return;
    const s = rinkToScreen(this.fr, HOCKEY.width / 2, HOCKEY_MID, HOCKEY_TOP_Z + 6);
    const img = this.pieceAt(`mesa-hockey-cartel-${key}`, () => hockeyBanner(text, this.R, ramp === "gold" ? C.gold : ramp === "neon" ? C.neon : C.cyan), s, this.depth + 0.9);
    this.scene.tweens.add({ targets: img, scale: { from: img.scale * 1.25, to: img.scale }, duration: 180, ease: "Back.out" });
    this.banner = { key, img };
  }

  /** Suenan los golpes, las bandas y los goles de los cuadros nuevos. */
  private hear(frames: readonly { t: number; ev?: string[] }[]) {
    for (const f of frames) {
      if (f.t <= this.heardT) continue;
      this.heardT = f.t;
      if (f.ev?.includes("goal")) sfx.goalHorn();
      else if (f.ev?.includes("hit")) sfx.puckHit();
      else if (f.ev?.includes("wall")) sfx.puckWall();
    }
  }

  // ---------- Puntero ----------

  pointerMove(x: number, y: number) {
    const { table } = useHockeyStore.getState();
    const me = mySide(table, selectMyUserId(useOfficeStore.getState()));
    if (me === null) {
      this.scene.input.manager.canvas.style.cursor = "";
      return;
    }
    const p = screenToRink(this.fr, x, y);
    this.target = clampToHalf(me, p.x, p.y);
    this.scene.input.manager.canvas.style.cursor = "none";
    this.flushTarget(performance.now());
  }

  pointerDown(x: number, y: number) {
    this.pointerMove(x, y);
  }

  destroy() {
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    window.removeEventListener("blur", this.onBlur);
    this.rink?.destroy();
    this.puck?.destroy();
    for (const m of this.mallets) m?.destroy();
    this.board?.img.destroy();
    this.banner?.img.destroy();
    for (const key of this.scene.textures.getTextureKeys()) if (key.startsWith("mesa-hockey-")) this.scene.textures.remove(key);
    this.scene.input.manager.canvas.style.cursor = "";
  }
}
