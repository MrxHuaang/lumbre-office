import {
  CLOSE_CODE,
  DIRECTIONS,
  MSG,
  ROOM_NAME,
  cafeItem,
  type CafeItemId,
  type CafeOrderResult,
  type ChatEvent,
  type ChatScope,
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
} from "@hyvento/shared";
import { Client, getStateCallbacks, type Room } from "colyseus.js";
import { useOfficeStore } from "./store";

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
  /** Lo que lleva en la mano (id del menú de la cafetería; "" = nada). */
  held: string;
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
export interface OfficeStateView {
  players: Map<string, RemotePlayer>;
  offices: Map<string, RemoteOffice>;
}

export type OfficeRoom = Room<OfficeStateView>;

const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "ws://localhost:2567";
const MAX_RECONNECT_ATTEMPTS = 5;

let client: Client | null = null;
let room: OfficeRoom | null = null;
const correctionListeners = new Set<(c: MoveCorrection) => void>();
const roomListeners = new Set<(r: OfficeRoom) => void>();
const emoteListeners = new Set<(e: EmoteEvent) => void>();

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

const CAFE_ERRORS: Record<Extract<CafeOrderResult, { ok: false }>["error"], string> = {
  far: "Acércate a la barra para pedir.",
  funds: "No te alcanzan los puntos.",
  busy: "Un momento, ya viene tu pedido.",
  failed: "No se pudo hacer el pedido. Intenta de nuevo.",
};

function handleCafeResult(r: CafeOrderResult) {
  const store = useOfficeStore.getState();
  const name = cafeItem(r.item)?.name ?? "tu pedido";
  if (r.ok) {
    store.closePanel();
    store.notify(`Aquí tienes: ${name}. ¡Buen provecho!`, "success");
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
      });
    sync();
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

  r.onMessage(MSG.chatHistory, (history: ChatEvent[]) => useOfficeStore.getState().addMessages(history));
  r.onMessage(MSG.chatEvent, (event: ChatEvent) => useOfficeStore.getState().addMessages([event]));
  r.onMessage(MSG.knockRequest, (req: KnockRequest) => useOfficeStore.getState().addKnockRequest(req));
  r.onMessage(MSG.knockResult, (res: KnockResult) => useOfficeStore.getState().handleKnockResult(res));
  r.onMessage(MSG.moveCorrection, (c: MoveCorrection) => correctionListeners.forEach((cb) => cb(c)));
  r.onMessage(MSG.pointsAwarded, (a: PointsAwarded) => useOfficeStore.getState().addAward(a));
  r.onMessage(MSG.cafeResult, handleCafeResult);
  r.onMessage(MSG.officeEditResult, handleOfficeEditResult);
  r.onMessage(MSG.emoteEvent, (e: EmoteEvent) => emoteListeners.forEach((cb) => cb(e)));

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
