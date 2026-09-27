// Modo mesa del blackjack: la cámara se acerca a la mesa y las cartas se reparten sobre el paño, frente
// a cada banqueta y al crupier; las fichas quedan en los círculos de apuesta. Lo que se muestra sale del
// estado sincronizado (useCasinoStore): las jugadas se hacen con los botones de la tira de abajo. Dónde
// va cada pieza lo decide blackjackHandPlan (@hyvento/map/art), que tiene tests de que nada se tapa.
import type { OfficeMap, PlacedFurniture } from "@hyvento/map";
import {
  betChips,
  blackjackDealerPlan,
  blackjackFeltOverlay,
  blackjackFeltRect,
  blackjackHandPlan,
  blackjackSpotMark,
  cardSprite,
  discardSprite,
  localToScreen,
  mesaFrame,
  screenToLocal,
  shoeSprite,
  tableZoom,
  tagSprite,
  BLACKJACK_DISCARD,
  BLACKJACK_SHOE,
  BLACKJACK_SPOTS,
  BLACKJACK_TOP_Z,
  TABLE_MAX_ZOOM,
  TABLE_MIN_ZOOM,
  type MesaFrame,
  type ScreenBox,
} from "@hyvento/map/art";
import { handValue, HIDDEN_CARD, isBlackjack } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { useCasinoStore, type BlackjackSeatView, type BlackjackView } from "../casino";
import { sendBlackjackBet } from "../network";
import { selectMyUserId, useOfficeStore } from "../store";
import type { TableCamera } from "./camera";
import { furnitureDepth, overlayImage, pieceImage } from "./draw";

let textureSeq = 0;
const DEAL_MS = 260;

type Tone = "plain" | "good" | "bad" | "gold";

/** Lo que hay dibujado de una mano (un asiento o el crupier), para rehacerla solo si cambió. */
interface HandView {
  sig: string;
  cards: number[];
  objects: Phaser.GameObjects.GameObject[];
}

/**
 * Total de una mano como se escribe en la placa: "7/17" si es blanda y hay lugar, "BJ" si es
 * blackjack. Con R chico, solo el mejor total (la placa angosta no tapa al vecino).
 */
function totalLabel(cards: number[], wide: boolean): { text: string; tone: Tone } {
  if (cards.includes(HIDDEN_CARD)) return { text: String(handValue(cards).total), tone: "plain" };
  if (isBlackjack(cards)) return { text: "BJ", tone: "gold" };
  const { total, soft } = handValue(cards);
  if (total > 21) return { text: String(total), tone: "bad" };
  return { text: wide && soft && total < 21 ? `${total - 10}/${total}` : String(total), tone: "plain" };
}

/** Resultado de la mano en la placa (corto con R chico: "+10", "-10", "=", "BJ+15"). */
function outcomeLabel(outcome: string, won: number, bet: number, wide: boolean): { text: string; tone: Tone } | null {
  const net = won - bet;
  switch (outcome) {
    case "blackjack":
      return { text: wide ? `BJ +${net}` : `BJ+${net}`, tone: "gold" };
    case "win":
      return { text: wide ? `GANA +${net}` : `+${net}`, tone: "good" };
    case "push":
      return { text: wide ? "EMPATE" : "=", tone: "plain" };
    case "lose":
      return { text: wide ? "PIERDE" : `-${bet}`, tone: "bad" };
    default:
      return null;
  }
}

export class BlackjackTableView {
  readonly kind = "blackjack" as const;
  private readonly fr: MesaFrame;
  readonly depth: number;
  private readonly rect: ScreenBox;
  private R = 5;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private seats: HandView[] = [];
  private dealer: HandView = { sig: "", cards: [], objects: [] };
  private turn?: { seat: number; img: Phaser.GameObjects.Image; tween: Phaser.Tweens.Tween };
  private unsub: () => void = () => undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    map: OfficeMap,
    table: PlacedFurniture,
    private readonly cam: TableCamera,
    private readonly mySeat: () => number | null,
  ) {
    this.fr = mesaFrame(table);
    this.depth = furnitureDepth(map, table);
    this.rect = blackjackFeltRect(this.fr);
  }

  start() {
    // Desde R4: a esa resolución las cinco manos entran sin tocarse (lo prueba casino-mesa.test.ts).
    const zoom = tableZoom(this.cam.viewport, this.rect, TABLE_MIN_ZOOM, TABLE_MAX_ZOOM);
    this.R = zoom / 2;
    this.cam.focus(this.rect, zoom);
    const R = this.R;
    this.objects.push(overlayImage(this.scene, `mesa-blackjack-pano-${++textureSeq}`, blackjackFeltOverlay(this.fr, R), this.depth + 0.3));
    // El sabot y el descarte, encima del paño nuevo (en el mueble son cajas que el paño taparía).
    for (const [key, sprite, at] of [
      ["descarte", discardSprite(this.fr, R), BLACKJACK_DISCARD],
      ["sabot", shoeSprite(this.fr, R), BLACKJACK_SHOE],
    ] as const) {
      const p = this.at(at.u, at.v);
      this.objects.push(pieceImage(this.scene, `mesa-blackjack-${key}-${++textureSeq}`, () => sprite.canvas, p.x, p.y, R, this.depth + 0.45, sprite));
    }
    this.unsub = useCasinoStore.subscribe((s, prev) => {
      if (s.blackjack !== prev.blackjack) this.sync(s.blackjack);
    });
    this.sync(useCasinoStore.getState().blackjack);
  }

  /** Las banquetas están a los costados y las cartas quedan a la vista: no se atenúa a nadie. */
  get cover(): ScreenBox {
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  update() {
    // Todo cambia con el estado: no hay nada que animar cuadro a cuadro.
  }

  private at(u: number, v: number, lift = 0) {
    return localToScreen(this.fr, u, v, BLACKJACK_TOP_Z + lift);
  }

  private sync(t: BlackjackView) {
    const me = selectMyUserId(useOfficeStore.getState());
    t.seats.forEach((seat, i) => {
      if (i >= BLACKJACK_SPOTS.length) return;
      this.seats[i] ??= { sig: "", cards: [], objects: [] };
      this.syncSeat(this.seats[i]!, i, seat, seat.userId === me && !!me, t.phase === "result");
    });
    this.syncDealer(t.dealer);
    this.syncTurn(t.phase === "playing" ? t.turn : -1);
  }

  private clear(h: HandView) {
    for (const o of h.objects) o.destroy();
    h.objects = [];
  }

  private syncSeat(h: HandView, i: number, seat: BlackjackSeatView, mine: boolean, result: boolean) {
    const sig = `${seat.bet}:${seat.doubled}:${seat.cards.join(",")}:${seat.outcome}:${seat.payout}:${mine}:${result}`;
    if (sig === h.sig) return;
    const prevCards = h.cards;
    h.sig = sig;
    h.cards = [...seat.cards];
    this.clear(h);
    if (seat.bet <= 0 && seat.cards.length === 0) return;
    const R = this.R;
    const wide = R >= 5;
    const spot = BLACKJACK_SPOTS[i]!;
    const base = this.depth + 0.5 + (spot.u + spot.v) / 1000;
    const amount = seat.doubled ? seat.bet * 2 : seat.bet;
    const chips = seat.bet > 0 ? betChips(amount, R, mine, seat.doubled ? 1 : 0) : null;
    // Al final de la mano la placa muestra el resultado; antes, el total.
    const label = (result && seat.outcome ? outcomeLabel(seat.outcome, seat.payout, seat.bet, wide) : null) ?? totalLabel(seat.cards, wide);
    const tag = tagSprite(label.text, label.tone);
    const plan = blackjackHandPlan(this.fr, R, i, seat.cards.length, chips, tag);
    if (chips) {
      const img = pieceImage(this.scene, `mesa-fichas-${amount}-${seat.doubled ? 1 : 0}-${mine ? 1 : 0}-${R}`, () => chips.canvas, plan.chip.x, plan.chip.y, R, base, chips);
      h.objects.push(img);
      if (seat.cards.length === 0 && prevCards.length === 0) this.scene.tweens.add({ targets: img, y: { from: plan.chip.y - 5, to: plan.chip.y }, duration: 220, ease: "Bounce.out" });
    }
    // Cada carta nueva va a la derecha y delante de la anterior: el valor de todas queda a la vista.
    plan.cards.forEach((p, k) => {
      const card = seat.cards[k]!;
      h.objects.push(this.card(card, p.x, p.y, base + 0.02 + k * 0.001, k >= prevCards.length ? (k - prevCards.length) * 90 : -1));
    });
    if (plan.tag.w > 0) {
      const img = pieceImage(this.scene, `mesa-placa-${label.text}-${label.tone}`, () => tag, plan.tag.x, plan.tag.y, R, base + 0.03);
      img.setOrigin(0, 0);
      h.objects.push(img);
      if (result && seat.outcome) this.scene.tweens.add({ targets: img, y: { from: plan.tag.y + 2, to: plan.tag.y }, alpha: { from: 0, to: 1 }, duration: 300, ease: "Back.out" });
    }
  }

  private syncDealer(cards: number[]) {
    const h = this.dealer;
    const sig = cards.join(",");
    if (sig === h.sig) return;
    const prev = h.cards;
    h.sig = sig;
    h.cards = [...cards];
    this.clear(h);
    if (cards.length === 0) return;
    const R = this.R;
    const label = totalLabel(cards, R >= 5);
    const tag = tagSprite(label.text, label.tone);
    const plan = blackjackDealerPlan(this.fr, R, cards.length, tag);
    plan.cards.forEach((p, k) => {
      const card = cards[k]!;
      // La carta tapada que se destapa se da vuelta en su lugar; las nuevas llegan del sabot.
      const flipped = prev[k] === HIDDEN_CARD && card !== HIDDEN_CARD;
      const img = this.card(card, p.x, p.y, this.depth + 0.52 + k * 0.001, k >= prev.length ? (k - prev.length) * 90 : -1);
      if (flipped) this.scene.tweens.add({ targets: img, scaleX: { from: 0, to: 1 / R }, duration: 200, ease: "Sine.out" });
      h.objects.push(img);
    });
    const img = pieceImage(this.scene, `mesa-placa-${label.text}-${label.tone}`, () => tag, plan.tag.x, plan.tag.y, R, this.depth + 0.53);
    img.setOrigin(0, 0);
    h.objects.push(img);
  }

  /** Una carta derecha con la base en (x, y); si `dealDelay` ≥ 0 llega volando desde el sabot. */
  private card(card: number, x: number, y: number, depth: number, dealDelay: number) {
    const R = this.R;
    const img = pieceImage(this.scene, `mesa-carta-${card}-${R < 5 ? "chica" : "grande"}`, () => cardSprite(card, R), x, y, R, depth);
    img.setOrigin(0.5, 1);
    if (dealDelay >= 0) {
      const shoe = this.at(BLACKJACK_SHOE.u, BLACKJACK_SHOE.v, 3);
      img.setPosition(shoe.x, shoe.y).setAlpha(0);
      this.scene.tweens.add({ targets: img, x, y, alpha: 1, delay: dealDelay, duration: DEAL_MS, ease: "Quad.out" });
    }
    return img;
  }

  /** Anillo que late alrededor del círculo del asiento al que le toca. */
  private syncTurn(seat: number) {
    if ((this.turn?.seat ?? -1) === seat) return;
    if (this.turn) {
      this.turn.tween.stop();
      const key = this.turn.img.texture.key;
      this.turn.img.destroy();
      this.scene.textures.remove(key);
      this.turn = undefined;
    }
    const spot = BLACKJACK_SPOTS[seat];
    if (!spot) return;
    const img = overlayImage(this.scene, `mesa-blackjack-turno-${++textureSeq}`, blackjackSpotMark(this.fr, this.R, spot), this.depth + 0.4);
    const tween = this.scene.tweens.add({ targets: img, alpha: { from: 1, to: 0.35 }, duration: 480, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.turn = { seat, img, tween };
  }

  pointerMove(x: number, y: number) {
    this.scene.input.manager.canvas.style.cursor = this.onMySpot(x, y) && this.canBet() ? "pointer" : "";
  }

  /** Clic en tu círculo de apuesta: apuesta la ficha elegida (lo mismo que el botón de la tira). */
  pointerDown(x: number, y: number) {
    if (!this.onMySpot(x, y) || !this.canBet()) return;
    sendBlackjackBet(useCasinoStore.getState().chip);
  }

  private onMySpot(x: number, y: number): boolean {
    const i = this.mySeat();
    const spot = i === null ? undefined : BLACKJACK_SPOTS[i];
    if (!spot) return false;
    const l = screenToLocal(this.fr, x, y, BLACKJACK_TOP_Z);
    return Math.hypot(l.u - spot.u, l.v - spot.v) < 3.2;
  }

  private canBet(): boolean {
    const t = useCasinoStore.getState().blackjack;
    const i = this.mySeat();
    return i !== null && (t.phase === "waiting" || t.phase === "betting") && (t.seats[i]?.bet ?? 0) === 0;
  }

  destroy() {
    this.unsub();
    this.turn?.tween.stop();
    this.turn?.img.destroy();
    for (const h of [...this.seats, this.dealer]) this.clear(h);
    for (const o of this.objects) o.destroy();
    this.objects = [];
    for (const key of this.scene.textures.getTextureKeys()) if (key.startsWith("mesa-blackjack-")) this.scene.textures.remove(key);
    this.scene.input.manager.canvas.style.cursor = "";
  }
}
