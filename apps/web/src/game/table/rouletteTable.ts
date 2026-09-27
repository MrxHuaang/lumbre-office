// Modo mesa de la ruleta: el paño con los números se vuelve el tablero (clic para poner fichas, se ven
// las de todos) y, al girar, la cámara va a la rueda, donde la bola corre al revés, rebota y cae en el
// número que mandó el servidor. Todo sale del estado sincronizado (useCasinoStore): no hay reglas acá.
import type { OfficeMap, PlacedFurniture } from "@hyvento/map";
import {
  betChips,
  betKey,
  localToScreen,
  mesaFrame,
  restPose,
  rouletteCellAt,
  rouletteCellMark,
  rouletteCellOf,
  rouletteFeltOverlay,
  rouletteFeltRect,
  screenToLocal,
  spinPose,
  tableZoom,
  wheelBowlRect,
  wheelZoom,
  ROULETTE_TOP_Z,
  TABLE_MAX_ZOOM,
  TABLE_MIN_ZOOM,
  WheelPainter,
  type BallPose,
  type MesaFrame,
  type RouletteCell,
  type ScreenBox,
} from "@hyvento/map/art";
import { CASINO, CASINO_ERROR_TEXT, rouletteWins } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { rouletteRemaining, useCasinoStore, type RouletteView } from "../casino";
import { sendRouletteBet } from "../network";
import { selectMyUserId, useOfficeStore } from "../store";
import type { TableCamera } from "./camera";
import { furnitureDepth, overlayImage, pieceImage } from "./draw";

/** Cuánto se queda la cámara mirando la rueda después de que cae la bola. */
const HOLD_ON_WHEEL_MS = 1600;
let textureSeq = 0;

/** Borra una imagen de un solo uso junto con su textura (las marcas se rehacen seguido). */
function dropImage(scene: Phaser.Scene, img: Phaser.GameObjects.Image) {
  const key = img.texture.key;
  img.destroy();
  if (scene.textures.exists(key)) scene.textures.remove(key);
}

interface ChipGroup {
  sig: string;
  img: Phaser.GameObjects.Image;
  cell: RouletteCell;
}

export class RouletteTableView {
  readonly kind = "roulette" as const;
  private readonly fr: MesaFrame;
  private readonly wheelFr: MesaFrame | null;
  readonly depth: number;
  private readonly wheelDepth: number;
  private readonly panoRect: ScreenBox;
  private readonly wheelRect: ScreenBox | null;
  private zoomPano = 8;
  private zoomWheel = 14;
  /** Resolución del dibujo de la rueda cuando la cámara la mira (puntos de 2 píxeles o de 1). */
  private wheelR = 7;
  private R = 4;
  private felt?: Phaser.GameObjects.Image;
  private hover?: { key: string; img: Phaser.GameObjects.Image };
  private win?: { key: string; img: Phaser.GameObjects.Image; tween: Phaser.Tweens.Tween };
  private chips = new Map<string, ChipGroup>();
  private chipRound = -1;
  private wheel?: { painter: WheelPainter; tex: Phaser.Textures.CanvasTexture; img: Phaser.GameObjects.Image; pose: string; paintedAt: number };
  private focusOn: "pano" | "rueda" | null = null;
  private unsub: () => void = () => undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    map: OfficeMap,
    table: PlacedFurniture,
    wheel: PlacedFurniture | undefined,
    private readonly cam: TableCamera,
  ) {
    this.fr = mesaFrame(table);
    this.wheelFr = wheel ? mesaFrame(wheel) : null;
    this.depth = furnitureDepth(map, table);
    this.wheelDepth = wheel ? furnitureDepth(map, wheel) : this.depth;
    // La cámara encuadra solo el plano del paño (y el cuenco de la rueda): así entra con más zoom.
    this.panoRect = rouletteFeltRect(this.fr);
    this.wheelRect = this.wheelFr ? wheelBowlRect(this.wheelFr) : null;
  }

  start() {
    const view = this.cam.viewport;
    this.zoomPano = tableZoom(view, this.panoRect, TABLE_MIN_ZOOM, TABLE_MAX_ZOOM);
    if (this.wheelRect) {
      const w = wheelZoom(view, this.wheelRect, this.zoomPano);
      this.zoomWheel = w.zoom;
      this.wheelR = w.R;
    }
    this.R = this.zoomPano / 2;
    this.felt = overlayImage(this.scene, `mesa-ruleta-pano-${++textureSeq}`, rouletteFeltOverlay(this.fr, this.R), this.depth + 0.3);
    this.unsub = useCasinoStore.subscribe((s, prev) => {
      if (s.roulette !== prev.roulette) this.syncChips(s.roulette);
    });
    this.syncChips(useCasinoStore.getState().roulette);
    this.update();
  }

  /** Lo que no deben tapar los personajes que están delante (el paño, o la rueda mientras gira). */
  get cover(): ScreenBox {
    return this.focusOn === "rueda" && this.wheelRect ? this.wheelRect : this.panoRect;
  }

  /** Cada cuadro: a dónde mira la cámara y cómo va la rueda. */
  update() {
    const { roulette: r, offset } = useCasinoStore.getState();
    const now = Date.now() + offset;
    const resultStart = r.endsAt - CASINO.roulette.resultMs;
    const onWheel = this.wheelRect !== null && (r.phase === "spinning" || (r.phase === "result" && now < resultStart + HOLD_ON_WHEEL_MS));
    const focus = onWheel ? "rueda" : "pano";
    if (focus !== this.focusOn) {
      this.focusOn = focus;
      if (focus === "rueda") {
        this.cam.focus(this.wheelRect!, this.zoomWheel);
        this.ensureWheel(this.wheelR);
      } else {
        this.cam.focus(this.panoRect, this.zoomPano);
        // Vista del paño: la rueda de al lado con puntos de 1 píxel (a zoom 8 los números ya caben).
        this.ensureWheel(this.zoomPano);
      }
      this.setHover(null);
    }
    this.updateWheel(r, now);
    this.updateWin(r, now >= resultStart + HOLD_ON_WHEEL_MS * 0.6);
  }

  // ---------- Rueda ----------

  private ensureWheel(R: number) {
    if (!this.wheelFr || this.wheel?.painter.R === R) return;
    if (this.wheel) {
      this.wheel.img.destroy();
      this.scene.textures.remove(this.wheel.tex);
    }
    const painter = new WheelPainter(this.wheelFr, R);
    const { canvas, sx, sy } = painter.overlay;
    const tex = this.scene.textures.createCanvas(`mesa-rueda-${++textureSeq}`, canvas.width, canvas.height)!;
    const img = this.scene.add.image(sx, sy, tex).setOrigin(0, 0).setScale(1 / R).setDepth(this.wheelDepth + 0.3);
    this.wheel = { painter, tex, img, pose: "", paintedAt: 0 };
  }

  private updateWheel(r: RouletteView, now: number) {
    const w = this.wheel;
    if (!w) return;
    const from = r.history[0] ?? -1;
    let pose: { spin: number; ball: BallPose | null };
    let key: string;
    let highlight = -1;
    if (r.phase === "spinning" && r.result >= 0) {
      const t = CASINO.roulette.spinMs - (r.endsAt - now);
      pose = spinPose(t, CASINO.roulette.spinMs, r.round, r.result, from);
      key = t >= CASINO.roulette.spinMs ? `fin:${r.round}` : `giro:${t}`;
      // Una rueda muy grande (sin lugar para los puntos de 2 píxeles) se pinta a 30 cuadros por segundo.
      if (w.painter.R > 9 && now - w.paintedAt < 30 && !key.startsWith("fin")) return;
    } else if (r.phase === "result" && r.result >= 0) {
      pose = restPose(r.round, r.result);
      highlight = r.result;
      key = `resultado:${r.round}`;
    } else {
      pose = restPose(r.round - 1, from);
      key = `quieta:${r.round}:${from}`;
    }
    if (key === w.pose) return;
    w.pose = key;
    w.paintedAt = now;
    const canvas = w.painter.paint(pose.spin, pose.ball, highlight);
    const ctx = w.tex.getContext();
    ctx.putImageData(new ImageData(canvas.data as Uint8ClampedArray<ArrayBuffer>, canvas.width, canvas.height), 0, 0);
    w.tex.refresh();
  }

  // ---------- Fichas ----------

  /** Una pila por lugar y por dueño (las tuyas y las de los demás), con el total arriba. */
  private syncChips(r: RouletteView) {
    if (r.round !== this.chipRound) {
      this.chipRound = r.round;
      for (const g of this.chips.values()) g.img.destroy();
      this.chips.clear();
    }
    const me = selectMyUserId(useOfficeStore.getState());
    const groups = new Map<string, { cell: RouletteCell; amount: number; bets: number; mine: boolean }>();
    for (const b of r.bets) {
      const cell = rouletteCellOf(betKey(b.kind, b.param));
      if (!cell) continue;
      const mine = b.userId === me;
      const id = `${cell.key}|${mine ? "yo" : "otros"}`;
      const g = groups.get(id) ?? { cell, amount: 0, bets: 0, mine };
      g.amount += b.amount;
      g.bets += 1;
      groups.set(id, g);
    }
    for (const [id, g] of this.chips) {
      if (!groups.has(id)) {
        g.img.destroy();
        this.chips.delete(id);
      }
    }
    for (const [id, g] of groups) {
      const sig = `${g.amount}:${g.bets}`;
      const old = this.chips.get(id);
      if (old?.sig === sig) continue;
      old?.img.destroy();
      // Si hay fichas tuyas y de otros en el mismo lugar, las de los demás van un poco al lado.
      const both = groups.has(`${g.cell.key}|yo`) && groups.has(`${g.cell.key}|otros`);
      const du = both && !g.mine ? -1.6 : 0;
      const p = localToScreen(this.fr, g.cell.chip.u + du, g.cell.chip.v, ROULETTE_TOP_Z);
      const R = this.R;
      const stack = betChips(g.amount, R, g.mine);
      const texKey = `mesa-fichas-${g.amount}-${g.mine ? 1 : 0}-${R}`;
      const img = pieceImage(this.scene, texKey, () => stack.canvas, p.x, p.y, R, this.depth + 0.5 + (g.cell.chip.u + g.cell.chip.v) / 1000, stack);
      this.chips.set(id, { sig, img, cell: g.cell });
      // Cae sobre el paño.
      if (!old) this.scene.tweens.add({ targets: img, y: { from: p.y - 5, to: p.y }, alpha: { from: 0, to: 1 }, duration: 220, ease: "Bounce.out" });
    }
  }

  /** En el resultado: el número ganador brilla en el paño y las fichas que perdieron se apagan. */
  private updateWin(r: RouletteView, show: boolean) {
    const want = r.phase === "result" && r.result >= 0 && show ? `number:${r.result}` : "";
    if ((this.win?.key ?? "") === want) return;
    if (this.win) {
      this.win.tween.stop();
      dropImage(this.scene, this.win.img);
      this.win = undefined;
    }
    for (const g of this.chips.values()) g.img.setAlpha(want && !rouletteWins(g.cell.spec, r.result) ? 0.35 : 1);
    if (!want) return;
    const cell = rouletteCellOf(want);
    if (!cell) return;
    const img = overlayImage(this.scene, `mesa-ruleta-gana-${++textureSeq}`, rouletteCellMark(this.fr, this.R, cell, "win"), this.depth + 0.4);
    const tween = this.scene.tweens.add({ targets: img, alpha: { from: 1, to: 0.55 }, duration: 520, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.win = { key: want, img, tween };
  }

  // ---------- Puntero ----------

  private cellAt(x: number, y: number): RouletteCell | null {
    if (this.focusOn !== "pano") return null;
    const l = screenToLocal(this.fr, x, y, ROULETTE_TOP_Z);
    return rouletteCellAt(l.u, l.v);
  }

  private canBet(): boolean {
    const { roulette: r, offset } = useCasinoStore.getState();
    return r.phase === "betting" && rouletteRemaining(r, offset) > 0;
  }

  pointerMove(x: number, y: number) {
    const cell = this.canBet() ? this.cellAt(x, y) : null;
    this.setHover(cell);
  }

  private setHover(cell: RouletteCell | null) {
    const key = cell?.key ?? "";
    if ((this.hover?.key ?? "") === key) return;
    if (this.hover) dropImage(this.scene, this.hover.img);
    this.hover = undefined;
    this.scene.input.manager.canvas.style.cursor = cell ? "pointer" : "";
    if (!cell) return;
    const img = overlayImage(this.scene, `mesa-ruleta-sobre-${++textureSeq}`, rouletteCellMark(this.fr, this.R, cell, "hover"), this.depth + 0.35);
    this.hover = { key, img };
  }

  /** Clic en el paño: una ficha de la elegida en esa casilla (el servidor valida y cobra). */
  pointerDown(x: number, y: number) {
    const cell = this.cellAt(x, y);
    if (!cell) return;
    const s = useOfficeStore.getState();
    if (!this.canBet()) return s.notify(CASINO_ERROR_TEXT.closed, "info");
    const me = selectMyUserId(s);
    const { chip, roulette } = useCasinoStore.getState();
    const points = s.sessionId ? (s.players[s.sessionId]?.points ?? 0) : 0;
    if (points < chip) return s.notify(CASINO_ERROR_TEXT.funds, "warning");
    if (roulette.bets.filter((b) => b.userId === me).length >= CASINO.roulette.maxBetsPerRound) return s.notify(CASINO_ERROR_TEXT["max-bets"], "warning");
    sendRouletteBet(cell.spec, chip);
  }

  destroy() {
    this.unsub();
    this.win?.tween.stop();
    this.win?.img.destroy();
    this.hover?.img.destroy();
    this.felt?.destroy();
    for (const g of this.chips.values()) g.img.destroy();
    this.chips.clear();
    if (this.wheel) {
      this.wheel.img.destroy();
      this.scene.textures.remove(this.wheel.tex);
      this.wheel = undefined;
    }
    for (const key of this.scene.textures.getTextureKeys()) if (key.startsWith("mesa-ruleta-")) this.scene.textures.remove(key);
    this.scene.input.manager.canvas.style.cursor = "";
  }
}
