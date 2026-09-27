// Modo mesa del blackjack: la cámara se acerca a la mesa y las cartas se reparten sobre el paño, frente
// a cada banqueta y al crupier; las fichas quedan en los círculos de apuesta. Lo que se muestra sale del
// estado sincronizado (useCasinoStore): las jugadas se hacen con los botones de la tira de abajo.
import type { OfficeMap, PlacedFurniture } from "@hyvento/map";
import {
  betStack,
  blackjackFeltOverlay,
  blackjackSpotMark,
  cardSprite,
  localToScreen,
  mesaFrame,
  screenToLocal,
  tagSprite,
  BLACKJACK_DEALER,
  BLACKJACK_SHOE,
  BLACKJACK_SPOTS,
  BLACKJACK_TOP_Z,
  CARD_H,
  DEALER_FAN,
  PLAYER_FAN,
  type MesaFrame,
} from "@hyvento/map/art";
import { handValue, HIDDEN_CARD, isBlackjack } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { useCasinoStore, type BlackjackSeatView, type BlackjackView } from "../casino";
import { sendBlackjackBet } from "../network";
import { selectMyUserId, useOfficeStore } from "../store";
import { rectOf, type ScreenRect, type TableCamera } from "./camera";
import { furnitureDepth, overlayImage, pieceImage } from "./draw";

let textureSeq = 0;
const DEAL_MS = 260;

/** Lo que hay dibujado de una mano (un asiento o el crupier), para rehacerla solo si cambió. */
interface HandView {
  sig: string;
  cards: number[];
  objects: Phaser.GameObjects.GameObject[];
}

/** Total de una mano como se escribe en la placa ("7/17" si es blanda, "BJ" si es blackjack). */
function totalLabel(cards: number[]): { text: string; tone: "plain" | "good" | "bad" | "gold" } {
  if (cards.includes(HIDDEN_CARD)) return { text: String(handValue(cards).total), tone: "plain" };
  if (isBlackjack(cards)) return { text: "BJ", tone: "gold" };
  const { total, soft } = handValue(cards);
  if (total > 21) return { text: String(total), tone: "bad" };
  return { text: soft && total < 21 ? `${total - 10}/${total}` : String(total), tone: "plain" };
}

const OUTCOME: Record<string, { text: (won: number, bet: number) => string; tone: "good" | "bad" | "gold" | "plain" }> = {
  blackjack: { text: (won, bet) => `BLACKJACK +${won - bet}`, tone: "gold" },
  win: { text: (won, bet) => `GANA +${won - bet}`, tone: "good" },
  push: { text: () => "EMPATE", tone: "plain" },
  lose: { text: () => "PIERDE", tone: "bad" },
};

export class BlackjackTableView {
  readonly kind = "blackjack" as const;
  private readonly fr: MesaFrame;
  readonly depth: number;
  private readonly rect: ScreenRect;
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
    const pts = [0, BLACKJACK_TOP_Z + 6].flatMap((z) => [localToScreen(this.fr, 0, 0, z), localToScreen(this.fr, 32, 0, z), localToScreen(this.fr, 0, 48, z), localToScreen(this.fr, 32, 48, z)]);
    this.rect = rectOf(pts, 6);
  }

  start() {
    const zoom = this.cam.fitZoom(this.rect, 6, 12);
    this.R = zoom / 2;
    this.cam.focus(this.rect, zoom);
    this.objects.push(overlayImage(this.scene, `mesa-blackjack-pano-${++textureSeq}`, blackjackFeltOverlay(this.fr, this.R), this.depth + 0.3));
    this.unsub = useCasinoStore.subscribe((s, prev) => {
      if (s.blackjack !== prev.blackjack) this.sync(s.blackjack);
    });
    this.sync(useCasinoStore.getState().blackjack);
  }

  /** Las banquetas están a los costados y las cartas quedan a la vista: no se atenúa a nadie. */
  get cover(): ScreenRect {
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
    const spot = BLACKJACK_SPOTS[i]!;
    const base = this.depth + 0.5 + (spot.u + spot.v) / 1000;
    if (seat.bet > 0) {
      const stack = betStack(seat.bet, seat.doubled ? 2 : 1, R, mine);
      const p = this.at(spot.u, spot.v);
      const img = pieceImage(this.scene, `mesa-fichas-${seat.bet}-${seat.doubled ? 2 : 1}-${mine ? 1 : 0}-${R}`, () => stack.canvas, p.x, p.y, R, base, stack);
      h.objects.push(img);
      if (seat.cards.length === 0 && prevCards.length === 0) this.scene.tweens.add({ targets: img, y: { from: p.y - 5, to: p.y }, duration: 220, ease: "Bounce.out" });
    }
    // Las cartas, delante de la ficha (hacia el crupier), abiertas hacia arriba: la primera adelante.
    const slot = this.at(spot.u - 3.2, spot.v);
    const n = seat.cards.length;
    seat.cards.forEach((card, k) => {
      const x = slot.x + (k * PLAYER_FAN.dx) / R;
      const y = slot.y + (k * PLAYER_FAN.dy) / R;
      const img = this.card(card, x, y, base + 0.02 + (n - k) * 0.001, k >= prevCards.length ? (k - prevCards.length) * 90 : -1);
      h.objects.push(img);
    });
    if (n > 0) {
      const total = totalLabel(seat.cards);
      const tag = pieceImage(this.scene, `mesa-placa-${total.text}-${total.tone}`, () => tagSprite(total.text, total.tone), slot.x - 10 / R, slot.y - 2 / R, R, base + 0.03);
      tag.setOrigin(1, 1);
      h.objects.push(tag);
    }
    if (result && seat.outcome && OUTCOME[seat.outcome]) {
      const o = OUTCOME[seat.outcome]!;
      const text = o.text(seat.payout, seat.bet);
      const top = slot.y + ((n - 1) * PLAYER_FAN.dy - CARD_H - 6) / R;
      const tag = pieceImage(this.scene, `mesa-placa-${text}-${o.tone}`, () => tagSprite(text, o.tone), slot.x, top, R, base + 0.04);
      tag.setOrigin(0.5, 1);
      h.objects.push(tag);
      this.scene.tweens.add({ targets: tag, y: { from: top + 4 / R * 2, to: top }, alpha: { from: 0, to: 1 }, duration: 300, ease: "Back.out" });
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
    const R = this.R;
    const { u, v } = BLACKJACK_DEALER;
    const slot = this.at(u + 1.5, v);
    const n = cards.length;
    cards.forEach((card, k) => {
      const x = slot.x + ((k - (n - 1) / 2) * DEALER_FAN.dx) / R;
      // La carta tapada que se destapa se da vuelta en su lugar; las nuevas llegan del sabot.
      const flipped = prev[k] === HIDDEN_CARD && card !== HIDDEN_CARD;
      const img = this.card(card, x, slot.y, this.depth + 0.52 + k * 0.001, k >= prev.length ? (k - prev.length) * 90 : -1);
      if (flipped) this.scene.tweens.add({ targets: img, scaleX: { from: 0, to: 1 / R }, duration: 200, ease: "Sine.out" });
      h.objects.push(img);
    });
    if (n > 0) {
      const total = totalLabel(cards);
      const tag = pieceImage(this.scene, `mesa-placa-${total.text}-${total.tone}`, () => tagSprite(total.text, total.tone), slot.x + (((n - 1) / 2) * DEALER_FAN.dx + 12) / R, slot.y - 2 / R, R, this.depth + 0.53);
      tag.setOrigin(0, 1);
      h.objects.push(tag);
    }
  }

  /** Una carta derecha con la base en (x, y); si `dealDelay` ≥ 0 llega volando desde el sabot. */
  private card(card: number, x: number, y: number, depth: number, dealDelay: number) {
    const img = pieceImage(this.scene, `mesa-carta-${card}`, () => cardSprite(card), x, y, this.R, depth);
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
