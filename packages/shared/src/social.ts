// Fase 5: regalos (por la web, llegan al buzón) e intercambios en vivo (por el servidor de juego, entre
// dos personas cerca). Los topes y los mensajes están aquí para que web, servidor y cliente usen lo mismo.
import { z } from "zod";
import { bagItemInfo } from "./bolsa";

/** Id de un objeto de la mochila: un mueble de la tienda o `obj:<id>` (lo que se agarra, ver bolsa.ts). */
export const ItemId = z.string().regex(/^[a-z0-9][a-z0-9:_-]{0,63}$/, "Objeto inválido");

/** Nombre de un objeto de la mochila para mostrar (uno sacado del id si no está en ningún catálogo). */
export function itemName(itemId: string): string {
  return bagItemInfo(itemId).name;
}

/** Un objeto y cuántas unidades (en un regalo o en un intercambio). */
export interface ItemStack {
  itemId: string;
  quantity: number;
}

// ---------- Regalos ----------

export const GIFT = {
  /** Máximo de puntos en un regalo. */
  maxPoints: 500,
  /** Máximo de unidades de un objeto en un regalo. */
  maxQuantity: 10,
  noteMax: 140,
  /** Por persona y por día (de Bogotá): cuántos regalos se mandan. */
  dailyGifts: 20,
  /**
   * Cuántos puntos puede dar alguien por día, sumando regalos e intercambios (los dos salen con motivo
   * GIFT): si no, un intercambio de un solo lado serviría para saltarse el tope de los regalos.
   */
  dailyPoints: 1000,
  /**
   * Cuántas unidades de muebles puede dar alguien por día, sumando regalos e intercambios: así un
   * intercambio desparejo (1 punto por 60 muebles) no sirve para pasar la mochila entera.
   */
  dailyItems: 20,
  /** Cuántos regalos (enviados y recibidos) muestra el historial del buzón. */
  historySize: 20,
} as const;

/** `refId` de los movimientos de un regalo (lo que sale y lo que llega al abrirlo). */
export const giftRefId = (giftId: string) => `gift:${giftId}`;

/** POST /api/gifts: puntos y/o un objeto de la mochila, con una nota. */
export const GiftCreateBody = z
  .object({
    toId: z.string().min(1).max(64),
    points: z.number().int().min(0).max(GIFT.maxPoints).default(0),
    itemId: ItemId.nullable().default(null),
    quantity: z.number().int().min(0).max(GIFT.maxQuantity).default(0),
    note: z.string().trim().max(GIFT.noteMax).default(""),
  })
  .superRefine((g, ctx) => {
    if (g.itemId && g.quantity < 1) ctx.addIssue({ code: "custom", path: ["quantity"], message: "Elige cuántas unidades regalar." });
    if (!g.itemId && g.quantity > 0) ctx.addIssue({ code: "custom", path: ["itemId"], message: "Falta el objeto." });
    if (g.points === 0 && !g.itemId) ctx.addIssue({ code: "custom", path: ["points"], message: "Un regalo lleva puntos, un objeto o las dos cosas." });
  });
export type GiftCreateBody = z.infer<typeof GiftCreateBody>;

/** Lo que alguien ya dio hoy (día de Bogotá): regalos mandados, puntos y unidades de muebles (regalos e intercambios). */
export interface GivenToday {
  gifts: number;
  points: number;
  items: number;
}

/**
 * ¿Cabe dar esto hoy? `sentToday`: lo que esa persona ya dio. Los intercambios no cuentan como regalos
 * (pasan `gifts: 0`), pero sus puntos y sus muebles sí suman para los topes.
 */
export function giftAllowedToday(sentToday: GivenToday, points: number, items = 0): "ok" | "gifts" | "points" | "items" {
  if (sentToday.gifts >= GIFT.dailyGifts) return "gifts";
  if (points > 0 && sentToday.points + points > GIFT.dailyPoints) return "points";
  if (items > 0 && sentToday.items + items > GIFT.dailyItems) return "items";
  return "ok";
}

/** Cuántas unidades hay en total en una lista de objetos. */
export const stackUnits = (items: readonly ItemStack[]) => items.reduce((sum, it) => sum + it.quantity, 0);

export interface GiftDTO {
  id: string;
  from: { id: string; name: string };
  to: { id: string; name: string };
  points: number;
  itemId: string | null;
  quantity: number;
  note: string;
  createdAt: string;
  openedAt: string | null;
}

/** GET /api/gifts: lo que llegó (sin abrir primero) y lo que mandaste. */
export interface GiftsState {
  unopened: number;
  received: GiftDTO[];
  sent: GiftDTO[];
  /** Lo que ya diste hoy: regalos mandados, puntos y muebles (regalos e intercambios), para avisar antes del tope. */
  today: GivenToday;
}

/** Web → servidor de juego (ruta interna `giftSent`): avisar a quien lo recibe si está conectado. */
export const GiftSentNotice = z.object({
  toId: z.string().min(1).max(64),
  fromName: z.string().max(64),
  points: z.number().int().min(0),
  itemId: z.string().max(64).nullable(),
  quantity: z.number().int().min(0),
});
export type GiftSentNotice = z.infer<typeof GiftSentNotice>;

/** Servidor → cliente (`MSG.giftReceived`): te llegó un regalo al buzón. */
export type GiftReceived = Omit<GiftSentNotice, "toId">;

/** "50 puntos y 2 × Planta": lo que trae un regalo o un lado del intercambio. */
export function describeBundle(points: number, items: readonly ItemStack[]): string {
  const parts: string[] = [];
  if (points > 0) parts.push(`${points} ${points === 1 ? "punto" : "puntos"}`);
  for (const it of items) parts.push(it.quantity > 1 ? `${it.quantity} × ${itemName(it.itemId)}` : itemName(it.itemId));
  if (parts.length === 0) return "nada";
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

// ---------- Intercambios ----------

export const TRADE = {
  /** Distancia máxima entre las dos personas (px de mundo, mismo nivel). Más lejos, se cancela. */
  reachPx: 4 * 32,
  /** Cuánto espera una invitación a que la otra persona responda. */
  requestTimeoutMs: 20_000,
  /** Pausa entre dos invitaciones a la misma persona. */
  requestCooldownMs: 4_000,
  /** Margen con el que el cliente da por vencida una invitación (la latencia se come parte del plazo). */
  inviteMarginMs: 750,
  /** Topes de lo que pone cada lado. */
  maxPoints: 1000,
  maxSlots: 6,
  maxQuantity: 10,
  /** Unidades de muebles en total que pone cada lado (sumando todos los objetos). */
  maxUnits: 10,
} as const;

/** `refId` de los movimientos de un intercambio (los dos lados usan el mismo). */
export const tradeRefId = (tradeId: string) => `trade:${tradeId}`;

export const TradeItem = z.object({ itemId: ItemId, quantity: z.number().int().min(1).max(TRADE.maxQuantity) });

/** Cliente → servidor: invitar a alguien (por su sesión) a intercambiar. */
export const TradeRequestMessage = z.object({ sessionId: z.string().min(1).max(64) });
export type TradeRequestMessage = z.infer<typeof TradeRequestMessage>;

/** Cliente → servidor: aceptar o rechazar una invitación. */
export const TradeRespondMessage = z.object({ requestId: z.string().min(1).max(64), accept: z.boolean() });
export type TradeRespondMessage = z.infer<typeof TradeRespondMessage>;

/** Cliente → servidor: lo que pongo yo (reemplaza lo anterior). Cualquier cambio desmarca el "Listo" de los dos. */
export const TradeOfferMessage = z
  .object({
    points: z.number().int().min(0).max(TRADE.maxPoints),
    items: z.array(TradeItem).max(TRADE.maxSlots),
  })
  .refine((o) => new Set(o.items.map((i) => i.itemId)).size === o.items.length, "Un objeto repetido")
  .refine((o) => stackUnits(o.items) <= TRADE.maxUnits, `Hasta ${TRADE.maxUnits} muebles por intercambio`);
export type TradeOfferMessage = z.infer<typeof TradeOfferMessage>;

/** Cliente → servidor: marcar o desmarcar "Listo". */
export const TradeReadyMessage = z.object({ ready: z.boolean() });
export type TradeReadyMessage = z.infer<typeof TradeReadyMessage>;

/** Servidor → invitada: alguien te invita a intercambiar. */
export interface TradeInvite {
  requestId: string;
  fromSessionId: string;
  fromName: string;
  /** Hasta cuándo se puede aceptar (hora del servidor). */
  expiresAt: number;
  /** Cuánto le queda al salir del servidor: el cliente cuenta desde que le llega (su reloj puede no coincidir). */
  ttlMs: number;
}

export interface TradeSideView {
  sessionId: string;
  name: string;
  points: number;
  items: ItemStack[];
  ready: boolean;
  confirmed: boolean;
}

/** Servidor → los dos: cómo está el intercambio (se manda entero en cada cambio). */
export interface TradeView {
  id: string;
  you: TradeSideView;
  them: TradeSideView;
  /** `offer`: armando la oferta; `confirm`: los dos están listos y falta el "Confirmar" final. */
  stage: "offer" | "confirm";
}

/**
 * Por qué terminó (o no empezó): `declined`/`timeout` responden a una invitación; `done` = se hizo.
 * `far`: alguien se alejó o cambió de nivel; `left`: alguien se desconectó.
 */
export type TradeCloseReason = "done" | "declined" | "timeout" | "cancelled" | "far" | "left";

export interface TradeClosed {
  /** Id del intercambio, o de la invitación si no llegó a empezar. */
  id: string;
  reason: TradeCloseReason;
  /** Nombre de la otra persona. */
  with: string;
  /** Si se hizo: lo que recibiste, lo que diste y tu saldo nuevo. */
  got?: { points: number; items: ItemStack[] };
  gave?: { points: number; items: ItemStack[] };
  balance?: number;
}

/** Algo que no se pudo (el intercambio sigue abierto, o la invitación no salió). */
export type TradeError =
  | "self"
  | "unknown"
  | "busy"
  | "far"
  | "dnd"
  | "too-soon"
  | "expired"
  | "funds"
  | "items"
  | "limit"
  | "limit-items"
  | "empty"
  | "one-sided"
  | "failed";

export interface TradeProblem {
  error: TradeError;
  /** Quién no tiene los puntos o los objetos, o llegó al tope (en `funds`/`items`/`limit`/`limit-items` al confirmar). */
  who?: string;
}

export const TRADE_ERROR_TEXT: Record<TradeError, string> = {
  self: "No puedes intercambiar contigo.",
  unknown: "Esa persona ya no está.",
  busy: "Esa persona ya está en otro intercambio.",
  far: "Tienen que estar cerca y en el mismo piso.",
  dnd: "Esa persona está en No molestar.",
  "too-soon": "Espera un momento antes de volver a invitar.",
  expired: "Esa invitación ya venció.",
  funds: "No alcanzan los puntos.",
  items: "Falta un objeto en la mochila.",
  limit: `Hoy ya se dieron muchos puntos: el tope es de ${GIFT.dailyPoints} al día, entre regalos e intercambios.`,
  "limit-items": `Hoy ya se dieron muchos muebles: el tope es de ${GIFT.dailyItems} al día, entre regalos e intercambios.`,
  empty: "Pongan algo antes de confirmar.",
  "one-sided": "Los dos tienen que poner algo. Para dar sin recibir nada, manda un regalo.",
  failed: "No se pudo hacer el intercambio. Intenten de nuevo.",
};

/**
 * ¿Qué falta para poder confirmar? Los dos lados tienen que poner algo: un intercambio de un solo lado es
 * un regalo y va por el buzón. Poner casi nada de un lado a cambio de mucho del otro se acepta, pero con
 * tope: cada lado pone hasta `TRADE.maxUnits` muebles, y lo que alguien da por día (puntos y muebles,
 * regalos e intercambios juntos) no pasa de `GIFT.dailyPoints` y `GIFT.dailyItems`. Se valida en el
 * servidor de juego y en la transacción.
 */
export function tradeGap(a: { points: number; items: readonly unknown[] }, b: { points: number; items: readonly unknown[] }): "ok" | "empty" | "one-sided" {
  const empty = (s: { points: number; items: readonly unknown[] }) => s.points <= 0 && s.items.length === 0;
  if (empty(a) && empty(b)) return "empty";
  return empty(a) || empty(b) ? "one-sided" : "ok";
}

/** ¿Están lo bastante cerca para intercambiar? (misma regla en el servidor y en el cliente). */
export function tradeReach(a: { area: string; x: number; y: number }, b: { area: string; x: number; y: number }): boolean {
  return a.area === b.area && Math.hypot(a.x - b.x, a.y - b.y) <= TRADE.reachPx;
}
