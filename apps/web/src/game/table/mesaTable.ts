// Modo mesa del baccarat, los dados y la carrera de caballitos: el tablero se vuelve el paño (clic para
// poner fichas, se ven las de todos) y, al jugar, las cartas se reparten una por una, los dados saltan
// en el cubilete o los caballitos corren por sus carriles hasta el resultado que mandó el servidor. Todo
// sale del estado sincronizado (useMesasStore): no hay reglas acá.
import type { OfficeMap, PlacedFurniture } from "@hyvento/map";
import {
  baccaratCardPlan,
  betChips,
  cardSprite,
  dieSprite,
  domeOverlay,
  horseSprite,
  horseU,
  laneV,
  localToScreen,
  mesaCellAt,
  mesaCellMark,
  mesaCellOf,
  mesaFeltOverlay,
  mesaFrame,
  mesaRect,
  screenToLocal,
  tableZoom,
  tagSprite,
  DICE_SPOTS,
  MESA_CELLS,
  MESA_TOP_Z,
  TABLE_MAX_ZOOM,
  TABLE_MIN_ZOOM,
  type MesaCell,
  type MesaFrame,
  type PieceSprite,
  type ScreenBox,
} from "@hyvento/map/art";
import {
  baccaratTotal,
  baccaratWinner,
  CASINO_ERROR_TEXT,
  HORSES,
  MESA,
  mesaPlayMs,
  mesaReturn,
  raceProgress,
  type MesaId,
} from "@hyvento/shared";
import type * as Phaser from "phaser";
import { rouletteRemaining, useCasinoStore } from "../casino";
import { ensureTexture } from "../iso/view";
import { sendMesaBet, useMesasStore, type MesaView } from "../mesas";
import { sfx } from "../sfx";
import { selectMyUserId, useOfficeStore } from "../store";
import type { TableCamera } from "./camera";
import { furnitureDepth, overlayImage, pieceImage } from "./draw";

let textureSeq = 0;

function dropImage(scene: Phaser.Scene, img: Phaser.GameObjects.Image) {
  const key = img.texture.key;
  img.destroy();
  if (scene.textures.exists(key)) scene.textures.remove(key);
}

/** Azar de mentira (igual en todos los clientes) para lo que solo es animación. */
function hash(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Orden de reparto del baccarat → mano de cada casilla (jugador, banca, jugador, banca, terceras). */
const DEAL_HAND = ["player", "banker", "player", "banker", "player", "banker"] as const;

export class MesaTableView {
  private readonly fr: MesaFrame;
  readonly depth: number;
  private readonly rect: ScreenBox;
  private readonly z: number;
  private R = 4;
  private felt?: Phaser.GameObjects.Image;
  private hover?: { key: string; img: Phaser.GameObjects.Image };
  private wins: { key: string; imgs: Phaser.GameObjects.Image[]; tweens: Phaser.Tweens.Tween[] } = { key: "", imgs: [], tweens: [] };
  private chips = new Map<string, { sig: string; img: Phaser.GameObjects.Image; cell: MesaCell }>();
  private chipRound = -1;
  private chipsReady = false;
  /** Cartas, dados, cubilete, placas o caballitos: lo que se rehace o se mueve en cada cuadro. */
  private pieces = new Map<string, Phaser.GameObjects.Image>();
  private shown = "";
  private dealt = -1;
  private unsub: () => void = () => undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    map: OfficeMap,
    table: PlacedFurniture,
    readonly kind: MesaId,
    private readonly cam: TableCamera,
  ) {
    this.fr = mesaFrame(table);
    this.depth = furnitureDepth(map, table);
    this.rect = mesaRect(kind, this.fr);
    this.z = MESA_TOP_Z[kind];
  }

  start() {
    const zoom = tableZoom(this.cam.viewport, this.rect, TABLE_MIN_ZOOM, TABLE_MAX_ZOOM);
    this.R = zoom / 2;
    this.felt = overlayImage(this.scene, `mesa-${this.kind}-pano-${++textureSeq}`, mesaFeltOverlay(this.kind, this.fr, this.R), this.depth + 0.3);
    this.cam.focus(this.rect, zoom);
    this.unsub = useMesasStore.subscribe((s, prev) => {
      if (s.tables[this.kind] !== prev.tables[this.kind]) this.syncChips(s.tables[this.kind]);
    });
    this.syncChips(this.view);
    this.update();
  }

  private get view(): MesaView {
    return useMesasStore.getState().tables[this.kind];
  }

  get cover(): ScreenBox {
    return this.rect;
  }

  /** Cuánto va del juego (ms desde que empezó a jugarse la ronda), o null si no se está jugando. */
  private playT(t: MesaView, now: number): number | null {
    if (t.phase === "playing" && t.result.length) return mesaPlayMs(this.kind, t.result) - (t.endsAt - now);
    if (t.phase === "result" && t.result.length) return Infinity;
    return null;
  }

  update() {
    const t = this.view;
    const now = Date.now() + useCasinoStore.getState().offset;
    const played = this.playT(t, now);
    if (this.kind === "baccarat") this.updateCards(t, played);
    else if (this.kind === "dados") this.updateDice(t, played, now);
    else this.updateHorses(t, played, now);
    this.updateWins(t, played);
  }

  // ---------- Piezas ----------

  /** Punto de apoyo de cada textura de pieza (fracción del lienzo), para reusarlas entre cuadros. */
  private anchors = new Map<string, { x: number; y: number }>();

  /** Pone (o mueve) una pieza con la textura `key`; la dibuja con `make` la primera vez. */
  private piece(id: string, key: string, make: () => PieceSprite, at: { x: number; y: number }, depth: number) {
    let a = this.anchors.get(key);
    if (!a || !this.scene.textures.exists(key)) {
      const sp = make();
      a = { x: sp.ax / sp.canvas.width, y: sp.ay / sp.canvas.height };
      this.anchors.set(key, a);
      ensureTexture(this.scene, key, () => sp.canvas);
    }
    let img = this.pieces.get(id);
    if (!img) {
      img = this.scene.add.image(at.x, at.y, key).setScale(1 / this.R);
      this.pieces.set(id, img);
    } else if (img.texture.key !== key) img.setTexture(key);
    img.setOrigin(a.x, a.y).setPosition(at.x, at.y).setDepth(depth);
    return img;
  }

  private clearPieces(prefix = "") {
    for (const [id, img] of this.pieces) {
      if (!id.startsWith(prefix)) continue;
      img.destroy();
      this.pieces.delete(id);
    }
  }

  // ---------- Baccarat ----------

  private updateCards(t: MesaView, played: number | null) {
    const n = played === null ? 0 : Math.min(t.result.filter((c) => c >= 0).length, Math.floor(played / MESA.cardMs) + 1);
    const key = `${t.round}:${n}:${t.phase}`;
    if (key === this.shown) return;
    this.shown = key;
    this.clearPieces();
    if (n > this.dealt && this.dealt >= 0 && n > 0) sfx.card();
    this.dealt = n;
    if (n === 0) return;
    // Las cartas repartidas hasta ahora, en su mano.
    const dealt: Record<"player" | "banker", number[]> = { player: [], banker: [] };
    let k = 0;
    t.result.forEach((c, slot) => {
      if (c < 0 || k >= n) return;
      dealt[DEAL_HAND[slot]!].push(c);
      k++;
    });
    const R = this.R;
    const done = t.phase === "result" || n === t.result.filter((c) => c >= 0).length;
    const winner = done ? baccaratWinner(t.result) : null;
    for (const hand of ["player", "banker"] as const) {
      const cards = dealt[hand];
      if (!cards.length) continue;
      const plan = baccaratCardPlan(this.fr, R, hand, cards.length);
      cards.forEach((c, i) => {
        const cv = cardSprite(c, R);
        this.piece(`carta-${hand}-${i}`, `mesa-carta-${c}-${R}`, () => ({ canvas: cv, ax: cv.width / 2, ay: cv.height }), plan.cards[i]!, this.depth + 0.6 + i / 100);
      });
      const total = String(baccaratTotal(cards));
      const tone = winner === hand || winner === "tie" ? "gold" : "plain";
      const tag = tagSprite(total, tone);
      this.piece(`placa-${hand}`, `mesa-placa-${total}-${tone}`, () => ({ canvas: tag, ax: tag.width, ay: tag.height }), plan.tag, this.depth + 0.7);
    }
  }

  // ---------- Dados ----------

  private updateDice(t: MesaView, played: number | null, now: number) {
    const R = this.R;
    const settleMs = 650;
    const shaking = played !== null && played < MESA.diceMs - settleMs;
    const bucket = Math.floor(now / 90);
    const key = shaking ? `sacude:${bucket}` : `quietos:${t.round}:${played === null ? "antes" : "fin"}`;
    if (key === this.shown) return;
    const wasShaking = this.shown.startsWith("sacude");
    this.shown = key;
    // Antes de jugar se ven los dados de la ronda anterior (o 1-2-3 al llegar).
    const last = t.history[0];
    const faces = played === null ? (last !== undefined ? [Math.floor(last / 100), Math.floor(last / 10) % 10, last % 10] : [1, 2, 3]) : t.result;
    DICE_SPOTS.forEach((spot, i) => {
      let face = faces[i] ?? 1;
      let du = 0;
      let dv = 0;
      let lift = 0;
      if (shaking) {
        face = 1 + Math.floor(hash(bucket, i) * 6);
        du = (hash(bucket, i + 10) - 0.5) * 1.8;
        dv = (hash(bucket, i + 20) - 0.5) * 1.8;
        lift = hash(bucket, i + 30) * 1.8;
      }
      const at = localToScreen(this.fr, spot.u + du, spot.v + dv, this.z + lift);
      this.piece(`dado-${i}`, `mesa-dado-${face}-${R}`, () => dieSprite(this.fr, R, face), at, this.depth + 0.6 + (spot.u + spot.v) / 1000);
    });
    if (wasShaking && !shaking) sfx.chip();
    // El vidrio encima de los dados (tiembla mientras se sacude).
    const shake = shaking ? (hash(bucket, 99) - 0.5) * 1.2 : 0;
    const old = this.pieces.get("cupula");
    if (old) dropImage(this.scene, old);
    this.pieces.delete("cupula");
    this.pieces.set("cupula", overlayImage(this.scene, `mesa-cupula-${++textureSeq}`, domeOverlay(this.fr, R, shake), this.depth + 0.8));
  }

  // ---------- Caballitos ----------

  private updateHorses(t: MesaView, played: number | null, now: number) {
    const R = this.R;
    const order = played !== null ? t.result : null;
    const running = order !== null && played !== null && played < MESA.raceMs;
    const pos = order ? raceProgress(order, t.round, Math.min(played ?? 0, MESA.raceMs)) : HORSES.map(() => 0);
    const frame = Math.floor(now / 110);
    const key = running ? `corre:${Math.floor(now / 33)}` : `quietos:${t.round}:${t.phase}`;
    if (key === this.shown) return;
    if (running && !this.shown.startsWith("corre")) sfx.whoosh(0.6, 700);
    this.shown = key;
    HORSES.forEach((_, h) => {
      const moving = running && pos[h]! < 1;
      const f = moving ? (frame + h) % 4 : 1;
      const at = localToScreen(this.fr, horseU(pos[h]!), laneV(h), this.z);
      this.piece(`caballo-${h}`, `mesa-caballo-${h}-${f}-${R}`, () => horseSprite(this.fr, R, h, f), at, this.depth + 0.6 + laneV(h) / 1000);
    });
  }

  // ---------- Resultado ----------

  /** Al terminar: brillan las casillas que ganaron y las fichas que perdieron se apagan. */
  private updateWins(t: MesaView, played: number | null) {
    const over = t.phase === "result" || (played !== null && this.kind === "caballos" && played >= MESA.raceMs * 0.9);
    const winners = over && t.result.length ? MESA_CELLS[this.kind].filter((c) => mesaReturn(this.kind, c.bet, t.result, 2) > 2) : [];
    const key = winners.map((c) => c.bet).join(",") + `@${over ? t.round : ""}`;
    if (key === this.wins.key) return;
    for (const tw of this.wins.tweens) tw.stop();
    for (const img of this.wins.imgs) dropImage(this.scene, img);
    this.wins = { key, imgs: [], tweens: [] };
    for (const g of this.chips.values()) g.img.setAlpha(over && !winners.includes(g.cell) ? 0.35 : 1);
    if (!over) return;
    for (const cell of winners) {
      const img = overlayImage(this.scene, `mesa-${this.kind}-gana-${++textureSeq}`, mesaCellMark(this.kind, this.fr, this.R, cell, "win"), this.depth + 0.4);
      this.wins.imgs.push(img);
      this.wins.tweens.push(this.scene.tweens.add({ targets: img, alpha: { from: 1, to: 0.55 }, duration: 520, yoyo: true, repeat: -1, ease: "Sine.inOut" }));
    }
  }

  // ---------- Fichas ----------

  private syncChips(t: MesaView) {
    if (t.round !== this.chipRound) {
      this.chipRound = t.round;
      for (const g of this.chips.values()) g.img.destroy();
      this.chips.clear();
    }
    const me = selectMyUserId(useOfficeStore.getState());
    const groups = new Map<string, { cell: MesaCell; amount: number; bets: number; mine: boolean }>();
    for (const b of t.bets) {
      const cell = mesaCellOf(this.kind, b.bet);
      if (!cell) continue;
      const mine = b.userId === me;
      const id = `${cell.bet}|${mine ? "yo" : "otros"}`;
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
      const both = groups.has(`${g.cell.bet}|yo`) && groups.has(`${g.cell.bet}|otros`);
      const dv = both && !g.mine ? 1.6 : 0;
      const p = localToScreen(this.fr, g.cell.chip.u, g.cell.chip.v + dv, this.z);
      const R = this.R;
      const stack = betChips(g.amount, R, g.mine);
      const img = pieceImage(this.scene, `mesa-fichas-${g.amount}-${g.mine ? 1 : 0}-${R}`, () => stack.canvas, p.x, p.y, R, this.depth + 0.5 + (g.cell.chip.u + g.cell.chip.v) / 1000, stack);
      this.chips.set(id, { sig, img, cell: g.cell });
      if (this.chipsReady) sfx.chip();
      if (!old) this.scene.tweens.add({ targets: img, y: { from: p.y - 5, to: p.y }, alpha: { from: 0, to: 1 }, duration: 220, ease: "Bounce.out" });
    }
    this.chipsReady = true;
  }

  // ---------- Puntero ----------

  private cellAt(x: number, y: number): MesaCell | null {
    const l = screenToLocal(this.fr, x, y, this.z);
    return mesaCellAt(this.kind, l.u, l.v);
  }

  private canBet(): boolean {
    const t = this.view;
    return t.phase === "betting" && rouletteRemaining(t, useCasinoStore.getState().offset) > 0;
  }

  pointerMove(x: number, y: number) {
    this.setHover(this.canBet() ? this.cellAt(x, y) : null);
  }

  private setHover(cell: MesaCell | null) {
    const key = cell?.bet ?? "";
    if ((this.hover?.key ?? "") === key) return;
    if (this.hover) dropImage(this.scene, this.hover.img);
    this.hover = undefined;
    this.scene.input.manager.canvas.style.cursor = cell ? "pointer" : "";
    if (!cell) return;
    const img = overlayImage(this.scene, `mesa-${this.kind}-sobre-${++textureSeq}`, mesaCellMark(this.kind, this.fr, this.R, cell, "hover"), this.depth + 0.35);
    this.hover = { key, img };
  }

  /** Clic en el paño: una ficha de la elegida en esa casilla (el servidor valida y cobra). */
  pointerDown(x: number, y: number) {
    const cell = this.cellAt(x, y);
    if (!cell) return;
    const s = useOfficeStore.getState();
    if (!this.canBet()) return s.notify(CASINO_ERROR_TEXT.closed, "info");
    const me = selectMyUserId(s);
    const { chip } = useCasinoStore.getState();
    const points = s.sessionId ? (s.players[s.sessionId]?.points ?? 0) : 0;
    if (points < chip) return s.notify(CASINO_ERROR_TEXT.funds, "warning");
    if (this.view.bets.filter((b) => b.userId === me).length >= MESA.maxBetsPerRound) return s.notify(CASINO_ERROR_TEXT["max-bets"], "warning");
    sendMesaBet(this.kind, cell.bet, chip);
  }

  destroy() {
    this.unsub();
    for (const tw of this.wins.tweens) tw.stop();
    for (const img of this.wins.imgs) img.destroy();
    this.hover?.img.destroy();
    this.felt?.destroy();
    for (const g of this.chips.values()) g.img.destroy();
    this.chips.clear();
    this.clearPieces();
    for (const key of this.scene.textures.getTextureKeys()) if (key.startsWith(`mesa-${this.kind}-`) || key.startsWith("mesa-cupula-")) this.scene.textures.remove(key);
    this.scene.input.manager.canvas.style.cursor = "";
  }
}
