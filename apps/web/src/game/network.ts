import {
  CLOSE_CODE,
  DIRECTIONS,
  MSG,
  ROOM_NAME,
  menuItem,
  type BarItemId,
  type CafeItemId,
  type FurnitureEvent,
  type HeldUsedEvent,
  type CafeOrderResult,
  CASINO_ERROR_TEXT,
  type CasinoResult,
  type ChatEvent,
  type ChatScope,
  type BlackjackAction,
  type BlackjackSettled,
  type RouletteBetSpec,
  type RouletteSettled,
  type Direction,
  type EmoteEvent,
  type EmoteId,
  type JoinOptions,
  type KnockRequest,
  type KnockResult,
  type MoveCorrection,
  type MoveMessage,
  type OfficeEditError,
  type OfficeEditMessage,
  type OfficeEditResult,
  type PointsAwarded,
  type PresenceStatus,
  PET_MSG,
  type PetEvent,
} from "@hyvento/shared";
import { Client, getStateCallbacks, type Room } from "colyseus.js";
import { useCasinoStore, type RouletteBetView } from "./casino";
import { useOfficeStore, type Interactable } from "./store";

/** Forma del estado sincronizado (espejo de apps/server/src/state.ts). */
export interface RemotePlayer {
  userId: string;
  name: string;
  avatar: string;
  /** Look en JSON ("" = personaje fijo). */
  look: string;
  /** Nivel de la cabaña ("jardin", "planta-baja", "piso-2"). */
  area: string;
  x: number;
  y: number;
  dir: MoveMessage["dir"];
  moving: boolean;
  seated: boolean;
  status: PresenceStatus;
  zoneId: string;
  place: string;
  points: number;
  /** Lo que lleva en la mano (id de la carta de la cafetería o del bar; "" = nada). */
  held: string;
  /** Usos que le quedan a cada mano ("4,5"). */
  heldLeft: string;
}
export interface RemoteOfficeItem {
  id: string;
  type: string;
  x: number;
  y: number;
  facing: string;
}
export interface RemoteOffice {
  zoneId: string;
  name: string;
  ownerId: string;
  ownerName: string;
  locked: boolean;
  guests: string[];
  /** Fase 3c: decoración (ver OfficeView en store.ts). */
  customized: boolean;
  items: RemoteOfficeItem[];
  floor: string;
  wallpaper: string;
}
export interface RemoteRoulette {
  phase: "betting" | "spinning" | "result";
  round: number;
  endsAt: number;
  result: number;
  history: number[];
  bets: RouletteBetView[];
}
export interface RemoteBlackjackSeat {
  userId: string;
  name: string;
  bet: number;
  cards: number[];
  status: string;
  doubled: boolean;
  outcome: string;
  payout: number;
}
export interface RemoteBlackjack {
  phase: "waiting" | "betting" | "playing" | "dealer" | "result";
  round: number;
  endsAt: number;
  turn: number;
  dealer: number[];
  seats: RemoteBlackjackSeat[];
}
export interface OfficeStateView {
  players: Map<string, RemotePlayer>;
  offices: Map<string, RemoteOffice>;
  roulette: RemoteRoulette;
  blackjack: RemoteBlackjack;
  /** Muebles prendidos o apagados (tele, lámparas, tocadiscos), por `furnitureKey`. */
  switches: Map<string, boolean>;
  /** Casa viva: contadores (ajedrez, puzle, pizarras), cubículos ocupados (clave → userId) y mascotas. */
  counters: Map<string, number>;
  stalls: Map<string, string>;
  pets: Map<string, RemotePet>;
}

/** Casa viva: una mascota como viaja en el estado (espejo de `Pet` en apps/server/src/state.ts). */
export interface RemotePet {
  id: string;
  name: string;
  kind: string;
  coat: string;
  area: string;
  x: number;
  y: number;
  dir: string;
  pose: string;
}

export type OfficeRoom = Room<OfficeStateView>;

const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "ws://localhost:2567";
const MAX_RECONNECT_ATTEMPTS = 5;

let client: Client | null = null;
let room: OfficeRoom | null = null;
const correctionListeners = new Set<(c: MoveCorrection) => void>();
const roomListeners = new Set<(r: OfficeRoom) => void>();
const emoteListeners = new Set<(e: EmoteEvent) => void>();
const heldUsedListeners = new Set<(e: HeldUsedEvent) => void>();
const furnitureListeners = new Set<(e: FurnitureEvent) => void>();
const petListeners = new Set<(e: PetEvent) => void>();

// Al cerrar/recargar la pestaña, salir "con consentimiento" para que el avatar desaparezca
// al instante en vez de quedar esperando una reconexión.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    const current = room;
    room = null;
    void current?.leave(true).catch(() => undefined);
  });
  // Si el navegador la restaura desde el bfcache (botón atrás), la conexión ya se cerró: recargar.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) window.location.reload();
  });
}

export function getRoom() {
  return room;
}

/** Notifica cada vez que hay una sala activa (conexión inicial y reconexiones). */
export function onRoom(cb: (r: OfficeRoom) => void) {
  roomListeners.add(cb);
  if (room) cb(room);
  return () => roomListeners.delete(cb);
}

export function onMoveCorrection(cb: (c: MoveCorrection) => void) {
  correctionListeners.add(cb);
  return () => correctionListeners.delete(cb);
}

/** Emotes de quienes están en tu nivel (también los tuyos, cuando el servidor los acepta). */
export function onEmote(cb: (e: EmoteEvent) => void) {
  emoteListeners.add(cb);
  return () => emoteListeners.delete(cb);
}

export function sendEmote(emote: EmoteId) {
  room?.send(MSG.emote, { emote });
}

/** Alguien de tu nivel usó lo que tenía en la mano (también tú, cuando el servidor lo acepta). */
export function onHeldUsed(cb: (e: HeldUsedEvent) => void) {
  heldUsedListeners.add(cb);
  return () => heldUsedListeners.delete(cb);
}

/** Alguien de tu nivel tocó un instrumento o acarició al gato. */
export function onFurnitureEvent(cb: (e: FurnitureEvent) => void) {
  furnitureListeners.add(cb);
  return () => furnitureListeners.delete(cb);
}

/** Usar lo que tengo en la mano (F): el servidor valida que tenga algo y la pausa entre usos. */
export function sendUseHeld() {
  room?.send(MSG.useHeld);
}

/** Usar un mueble de mi nivel (tele, lámpara, piano…): el servidor valida que esté al alcance. */
export function sendFurnitureUse(type: string, x: number, y: number) {
  room?.send(MSG.furnitureUse, { type, x, y });
}

/** Casa viva: alguien de tu nivel llamó, acarició o le dio un premio a una mascota. */
export function onPetEvent(cb: (e: PetEvent) => void) {
  petListeners.add(cb);
  return () => petListeners.delete(cb);
}

/** Llamar a una mascota (clic): el servidor valida que esté en tu nivel y no muy lejos. */
export function sendPetCall(pet: string) {
  room?.send(PET_MSG.call, { pet });
}

/** Acariciar o dar un premio a una mascota (de cerca). */
export function sendPetAction(pet: string, action: "pet" | "treat") {
  room?.send(PET_MSG.action, { pet, action });
}

/** Apostar en la ruleta (el servidor valida que estés junto a la mesa y cobra). */
export function sendRouletteBet(bet: RouletteBetSpec, amount: number) {
  room?.send(MSG.rouletteBet, { bet, amount });
}

/** Blackjack: apostar en tu asiento o jugar tu turno. */
export function sendBlackjackBet(amount: number) {
  room?.send(MSG.blackjackBet, { amount });
}
export function sendBlackjackAction(action: BlackjackAction) {
  room?.send(MSG.blackjackAction, { action });
}

/** Usar un objeto interactivo: casi todos abren su panel; el tubo del sótano hace bailar. */
export function activateInteractable(kind: Interactable) {
  if (kind === "pole") return sendEmote("dance");
  useOfficeStore.getState().openPanel(kind, true);
}

export class ConnectionCancelled extends Error {}

/** Cada connect/disconnect invalida las conexiones anteriores que sigan en vuelo. */
let generation = 0;

export async function connect(options: JoinOptions): Promise<OfficeRoom> {
  const gen = ++generation;
  const store = useOfficeStore.getState();
  store.setConnection("connecting");
  client ??= new Client(SERVER_URL);
  let joined: OfficeRoom;
  try {
    joined = await client.joinOrCreate<OfficeStateView>(ROOM_NAME, options);
  } catch (err) {
    if (gen === generation) store.setConnection("error", describeError(err));
    throw err;
  }
  if (gen !== generation) {
    // Se desmontó (o se reconectó) mientras entrábamos: esta sesión sobra.
    void joined.leave(true).catch(() => undefined);
    throw new ConnectionCancelled();
  }
  attach(joined);
  return joined;
}

export async function disconnect() {
  generation++;
  const current = room;
  room = null;
  // Reset síncrono: si se reconecta enseguida (StrictMode), no debe borrar la sesión nueva.
  useOfficeStore.getState().reset();
  await current?.leave(true).catch(() => undefined);
}

export function sendMove(m: MoveMessage) {
  room?.send(MSG.move, m);
}

/** Avisa a la sala que la web guardó el perfil: el servidor lo relee y todos ven el cambio. */
export function sendProfileChanged() {
  room?.send(MSG.profileChanged);
}

/** Pide pasar a otro nivel por un portal (el servidor responde con una corrección con `area`). */
export function sendTravel(portal: string) {
  room?.send(MSG.travel, { portal });
}

/** Pide algo en la barra de la cafetería (el servidor valida que estés junto a ella y cobra). */
export function sendCafeOrder(item: CafeItemId) {
  room?.send(MSG.cafeOrder, { item });
}

/** Pide algo en la barra del club (igual que la cafetería, junto a la barra del sótano). */
export function sendBarOrder(item: BarItemId) {
  room?.send(MSG.barOrder, { item });
}

const CAFE_ERRORS: Record<Extract<CafeOrderResult, { ok: false }>["error"], string> = {
  far: "Acércate a la barra para pedir.",
  funds: "No te alcanzan los puntos.",
  busy: "Un momento, ya viene tu pedido.",
  failed: "No se pudo hacer el pedido. Intenta de nuevo.",
};

function handleCafeResult(r: CafeOrderResult) {
  const store = useOfficeStore.getState();
  const item = menuItem(r.item);
  const name = item?.name ?? "tu pedido";
  if (r.ok) {
    store.closePanel();
    store.notify(item?.menu === "bar" ? `Aquí tienes: ${name}. ¡Salud!` : `Aquí tienes: ${name}. ¡Buen provecho!`, "success");
  } else {
    store.notify(CAFE_ERRORS[r.error], "warning");
  }
}

/** Editor de oficina: poner, mover, quitar o cambiar piso/papel tapiz (lo valida el servidor). */
export function sendOfficeEdit(edit: OfficeEditMessage) {
  room?.send(MSG.officeEdit, edit);
}

/** Por qué no se pudo, en palabras (los mismos motivos que muestra el fantasma rojo). */
export const DECOR_ERRORS: Record<OfficeEditError, string> = {
  "not-owner": "Solo puedes decorar tu propia oficina.",
  "not-owned": "Ese mueble ya no está en tu mochila.",
  outside: "Tiene que quedar dentro de tu oficina.",
  blocked: "Ahí choca con otro mueble.",
  door: "Así taparías la puerta o el paso hasta tu escritorio.",
  occupied: "Hay alguien ahí.",
  fixed: "El escritorio con el PC y su silla no se mueven.",
  unknown: "Ese mueble no existe.",
  failed: "No se pudo guardar. Intenta de nuevo.",
};

function handleOfficeEditResult(r: OfficeEditResult) {
  const store = useOfficeStore.getState();
  store.setDecorResult(r);
  if (!r.ok) store.notify(DECOR_ERRORS[r.error], "warning");
}

/** Hubo actividad real (mouse/teclado): cuenta para los puntos de presencia. */
export function sendActivity() {
  room?.send(MSG.activity);
}

export function sendChat(text: string, scope: ChatScope) {
  room?.send(MSG.chatSend, { text, scope });
}

export function sendStatus(status: PresenceStatus) {
  room?.send(MSG.status, { status });
}

export function sendOfficeLock(locked: boolean) {
  room?.send(MSG.officeLock, { locked });
}

export function sendKnock(zoneId: string) {
  useOfficeStore.getState().setPendingKnock(zoneId);
  room?.send(MSG.knock, { zoneId });
}

export function respondKnock(requestId: string, accept: boolean) {
  useOfficeStore.getState().removeKnockRequest(requestId);
  room?.send(MSG.knockRespond, { requestId, accept });
}

function attach(r: OfficeRoom) {
  room = r;
  const store = useOfficeStore.getState();
  store.setSessionId(r.sessionId);
  store.setConnection("connected");

  const $ = getStateCallbacks(r);
  $(r.state).players.onAdd((player, sessionId) => {
    const sync = () =>
      useOfficeStore.getState().upsertPlayer({
        sessionId,
        userId: player.userId,
        name: player.name,
        avatar: player.avatar,
        area: player.area,
        zoneId: player.zoneId,
        place: player.place,
        status: player.status,
        points: player.points,
        held: player.held,
        heldLeft: player.heldLeft,
      });
    sync();
    $(player).listen("held", sync);
    $(player).listen("heldLeft", sync);
    $(player).listen("area", sync);
    $(player).listen("zoneId", sync);
    $(player).listen("place", sync);
    $(player).listen("status", sync);
    $(player).listen("name", sync);
    $(player).listen("points", sync);
  });
  $(r.state).players.onRemove((_player, sessionId) => useOfficeStore.getState().removePlayer(sessionId));

  $(r.state).offices.onAdd((office, zoneId) => {
    const push = () =>
      useOfficeStore.getState().upsertOffice({
        zoneId,
        name: office.name,
        ownerId: office.ownerId,
        ownerName: office.ownerName,
        locked: office.locked,
        guests: [...office.guests],
        customized: office.customized,
        items: [...office.items].map((i) => ({
          id: i.id,
          type: i.type,
          x: i.x,
          y: i.y,
          facing: (DIRECTIONS as readonly string[]).includes(i.facing) ? (i.facing as Direction) : "right",
        })),
        floor: office.floor,
        wallpaper: office.wallpaper,
      });
    // Un patch dispara un callback por cada cambio (la primera edición agrega ~10 muebles y marca
    // `customized`): se juntan y el store recibe la oficina una sola vez, ya completa.
    let queued = false;
    const sync = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (room === r && r.state.offices.get(zoneId) === office) push();
      });
    };
    push();
    const o$ = $(office);
    o$.onChange(sync);
    o$.guests.onAdd(sync);
    o$.guests.onRemove(sync);
    // Muebles: al ponerlos, quitarlos y moverlos (x, y, facing cambian en el mismo objeto).
    o$.items.onAdd((item) => {
      sync();
      $(item).onChange(sync);
    });
    o$.items.onRemove(sync);
  });
  $(r.state).offices.onRemove((_office, zoneId) => useOfficeStore.getState().removeOffice(zoneId));

  // Ruleta del sótano: una copia simple para React (fase, cuenta regresiva, apuestas y números).
  const syncRoulette = () => {
    const rl = r.state.roulette;
    if (!rl) return;
    useCasinoStore.getState().setRoulette({
      phase: rl.phase,
      round: rl.round,
      endsAt: rl.endsAt,
      result: rl.result,
      history: [...rl.history],
      bets: [...rl.bets].map((b) => ({ userId: b.userId, name: b.name, kind: b.kind, param: b.param, amount: b.amount })),
    });
  };
  // La mesa llega con el primer estado: los callbacks se enganchan cuando aparece (antes no tiene refId).
  $(r.state).listen("roulette", (table) => {
    if (!table) return;
    const rl$ = $(table);
    rl$.onChange(syncRoulette);
    rl$.bets.onAdd(syncRoulette);
    rl$.bets.onRemove(syncRoulette);
    rl$.history.onAdd(syncRoulette);
    rl$.history.onRemove(syncRoulette);
    syncRoulette();
  });
  // Blackjack: igual que la ruleta, más las cartas de cada asiento y del crupier.
  const syncBlackjack = () => {
    const bj = r.state.blackjack;
    if (!bj) return;
    useCasinoStore.getState().setBlackjack({
      phase: bj.phase,
      round: bj.round,
      endsAt: bj.endsAt,
      turn: bj.turn,
      dealer: [...bj.dealer],
      seats: [...bj.seats].map((s) => ({
        userId: s.userId,
        name: s.name,
        bet: s.bet,
        cards: [...s.cards],
        status: s.status,
        doubled: s.doubled,
        outcome: s.outcome,
        payout: s.payout,
      })),
    });
  };
  $(r.state).listen("blackjack", (table) => {
    if (!table) return;
    const bj$ = $(table);
    bj$.onChange(syncBlackjack);
    bj$.dealer.onAdd(syncBlackjack);
    bj$.dealer.onRemove(syncBlackjack);
    bj$.seats.onAdd((seat) => {
      const s$ = $(seat);
      s$.onChange(syncBlackjack);
      s$.cards.onAdd(syncBlackjack);
      s$.cards.onRemove(syncBlackjack);
      syncBlackjack();
    });
    syncBlackjack();
  });
  r.onMessage(MSG.blackjackSettled, (s: BlackjackSettled) => {
    useCasinoStore.getState().setBlackjackSettled(s);
    const text = { blackjack: `¡Blackjack! Ganaste ${s.won}.`, win: `Le ganaste al crupier: +${s.won - s.staked}.`, push: "Empate: te devuelven la apuesta.", lose: `Perdiste ${s.staked}.` }[s.outcome];
    useOfficeStore.getState().notify(text, s.outcome === "lose" ? "info" : "success");
  });
  r.onMessage(MSG.clock, (m: { now: number }) => useCasinoStore.getState().setOffset(m.now));
  r.onMessage(MSG.casinoResult, (res: CasinoResult) => {
    useCasinoStore.getState().setResult(res);
    if (!res.ok) useOfficeStore.getState().notify(CASINO_ERROR_TEXT[res.error], "warning");
  });
  r.onMessage(MSG.rouletteSettled, (s: RouletteSettled) => {
    useCasinoStore.getState().setSettled(s);
    const profit = s.won - s.staked;
    useOfficeStore
      .getState()
      .notify(
        s.won > 0 ? `Salió el ${s.result}: ganaste ${s.won} (${profit >= 0 ? "+" : ""}${profit}).` : `Salió el ${s.result}. Esta vez no hubo suerte.`,
        s.won > 0 ? "success" : "info",
      );
  });

  r.onMessage(MSG.chatHistory, (history: ChatEvent[]) => useOfficeStore.getState().addMessages(history));
  r.onMessage(MSG.chatEvent, (event: ChatEvent) => useOfficeStore.getState().addMessages([event]));
  r.onMessage(MSG.knockRequest, (req: KnockRequest) => useOfficeStore.getState().addKnockRequest(req));
  r.onMessage(MSG.knockResult, (res: KnockResult) => useOfficeStore.getState().handleKnockResult(res));
  r.onMessage(MSG.moveCorrection, (c: MoveCorrection) => correctionListeners.forEach((cb) => cb(c)));
  r.onMessage(MSG.pointsAwarded, (a: PointsAwarded) => useOfficeStore.getState().addAward(a));
  r.onMessage(MSG.cafeResult, handleCafeResult);
  r.onMessage(MSG.officeEditResult, handleOfficeEditResult);
  r.onMessage(MSG.emoteEvent, (e: EmoteEvent) => emoteListeners.forEach((cb) => cb(e)));
  r.onMessage(MSG.heldUsed, (e: HeldUsedEvent) => heldUsedListeners.forEach((cb) => cb(e)));
  r.onMessage(MSG.furnitureEvent, (e: FurnitureEvent) => furnitureListeners.forEach((cb) => cb(e)));
  r.onMessage(PET_MSG.event, (e: PetEvent) => petListeners.forEach((cb) => cb(e)));

  r.onLeave((code) => {
    if (room !== r) return; // salida voluntaria (disconnect)
    if (code === CLOSE_CODE.replaced) {
      // No reintentar: provocaría que las dos pestañas se expulsen mutuamente.
      room = null;
      useOfficeStore.getState().setConnection("error", "Entraste a la cabaña desde otra pestaña o dispositivo.");
      return;
    }
    // 1000 = cierre normal, 4000 = consentido. Cualquier otro código: intentar reconectar.
    if (code === 1000 || code === 4000) {
      useOfficeStore.getState().setConnection("error", "Te desconectaste de la cabaña.");
      return;
    }
    void reconnect(r.reconnectionToken);
  });

  roomListeners.forEach((cb) => cb(r));
}

async function reconnect(token: string) {
  const gen = generation;
  const store = useOfficeStore.getState();
  store.setConnection("reconnecting");
  for (let attempt = 1; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
    await new Promise((res) => setTimeout(res, 500 * 2 ** (attempt - 1)));
    if (gen !== generation) return; // el usuario salió mientras reintentábamos
    try {
      const r = await client!.reconnect<OfficeStateView>(token);
      if (gen !== generation) {
        void r.leave(true).catch(() => undefined);
        return;
      }
      attach(r);
      return;
    } catch {
      // siguiente intento
    }
  }
  store.setConnection("error", "Se perdió la conexión con la cabaña.");
}

function describeError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object" && "type" in err && (err as Event).type === "error") {
    return "No se pudo conectar con el servidor de juego. ¿Está corriendo `pnpm dev`?";
  }
  return "No se pudo conectar con la cabaña.";
}
