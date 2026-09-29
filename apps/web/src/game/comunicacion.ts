// Comunicación rápida en el navegador (reglas en packages/shared/src/comunicacion.ts): llamar a cualquiera
// sin teléfono (o sumarlo a la llamada en curso), saludar con un toque en el hombro, seguir a alguien por
// toda la cabaña y el anuncio de un admin (texto y voz). Las acciones de abajo son la API para el resto del
// cliente (el menú de la persona, la lista de Conectados y, más adelante, la paleta de comandos):
// `callPerson`, `addToCall`, `wavePerson`, `followPerson`, `stopFollowing`, `announce`,
// `startBroadcast` y `stopBroadcast`. Todas reciben el userId de la persona.
// Seguir es solo del cliente: repite "Ir hasta" (walkToPlayer, que cruza portales) mientras haga falta.
import {
  ANNOUNCE_ERROR_TEXT,
  announcementTime,
  broadcastEndText,
  COM_MSG,
  COMUNICACION,
  followNeedsWalk,
  reduceBroadcast,
  PODCAST,
  WAVE_RESULT_TEXT,
  type Announcement,
  type AnnounceResult,
  type BroadcastEvent,
  type WaveEvent,
  type WaveResult,
} from "@hyvento/shared";
import type { Room } from "colyseus.js";
import { create } from "zustand";
import { useCasinoStore } from "./casino";
import { useEscenarioStore } from "./escenario/store";
import { announceChime, shoulderTap } from "./comunicacionSonidos";
import { media, useMediaStore } from "./media";
import { browserNotify } from "./notify";
import { dial, usePhoneStore } from "./phone";
import { useOfficeStore } from "./store";

/** Lo que este módulo lee del estado de un jugador (espejo de `Player` en apps/server/src/state.ts). */
interface StatePlayer {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
  zoneId: string;
  call?: string;
  callId?: string;
  broadcastUntil?: number;
  status?: string;
}
interface StateView {
  players: { get(id: string): StatePlayer | undefined; forEach(fn: (p: StatePlayer, sessionId: string) => void): void };
}

export interface Following {
  userId: string;
  name: string;
}

export interface LiveBroadcast {
  userId: string;
  name: string;
  /** Hora local en que se corta sola (el tope). */
  endsAt: number;
}

interface ComStore {
  /** A quién sigo (null = a nadie). */
  following: Following | null;
  /** Saludos recibidos que siguen a la vista. */
  waves: WaveEvent[];
  /** El aviso de texto grande que se está mostrando. */
  announcement: Announcement | null;
  /** Quién le está hablando por voz a toda la cabaña. */
  broadcast: LiveBroadcast | null;
  /** El panel del admin para anunciar (texto y voz). */
  announceOpen: boolean;
}

export const useComStore = create<ComStore>(() => ({ following: null, waves: [], announcement: null, broadcast: null, announceOpen: false }));

let room: Room<StateView> | null = null;
let followTimer: ReturnType<typeof setInterval> | null = null;
let announceTimer: ReturnType<typeof setTimeout> | null = null;

/** Hora del servidor → hora local (el casino ya mide la diferencia al entrar). */
const localTime = (serverMs: number) => serverMs - useCasinoStore.getState().offset;

const notify = (text: string, tone: "info" | "warning" = "info") => useOfficeStore.getState().notify(text, tone);

function myUserId(): string {
  const me = room ? room.state.players.get(room.sessionId) : undefined;
  return me?.userId ?? "";
}

function findUser(userId: string): { sessionId: string; player: StatePlayer } | null {
  let found: { sessionId: string; player: StatePlayer } | null = null;
  room?.state.players.forEach((player, sessionId) => {
    if (player.userId === userId) found = { sessionId, player };
  });
  return found;
}

// ---------- Acciones ----------

/**
 * Llamar a alguien desde donde sea. Si ya estoy hablando en una llamada, lo suma a esa llamada (el
 * servidor valida el cupo, "No molestar", ocupado y la pausa entre llamadas).
 */
export function callPerson(userId: string) {
  const call = usePhoneStore.getState().call;
  if (call?.phase === "talking") return addToCall(userId);
  if (call) return notify("Ya estás en una llamada.", "info");
  dial(`user:${userId}`, COM_MSG.call, { userId });
}

/** Sumar a alguien a la llamada en la que estoy hablando. */
export function addToCall(userId: string) {
  dial(`add:${userId}`, COM_MSG.add, { userId });
}

/** Saludar (toque en el hombro): le llega un aviso suave con "Ir" y "Llamar". */
export function wavePerson(userId: string) {
  room?.send(COM_MSG.wave, { userId });
}

/** Seguir a alguien por toda la cabaña (también entre niveles), hasta moverme a mano o dejar de seguir. */
export function followPerson(userId: string) {
  const who = findUser(userId);
  if (!who || userId === myUserId()) return;
  useComStore.setState({ following: { userId, name: who.player.name } });
  resetFollowProgress();
  if (!followTimer) followTimer = setInterval(followTick, FOLLOW_TICK_MS);
  notify(`Sigues a ${who.player.name}. Muévete o pulsa "Dejar de seguir" para soltarle.`);
  followTick();
}

/** Deja de seguir (con `why` como aviso, o en silencio). */
export function stopFollowing(why?: string) {
  if (followTimer) clearInterval(followTimer);
  followTimer = null;
  if (!useComStore.getState().following) return;
  useComStore.setState({ following: null });
  if (why) notify(why);
}

/** La escena avisa que me moví a mano (teclado o clic en el piso): se deja de seguir. */
export function noteManualMove() {
  const f = useComStore.getState().following;
  if (f) stopFollowing(`Dejaste de seguir a ${f.name}.`);
}

/** Admins: aviso de texto grande para todos los conectados. */
export function announce(text: string) {
  room?.send(COM_MSG.announce, { text });
}

/** Admins: hablarle por voz a toda la cabaña (se prende el micrófono si estaba apagado). */
export function startBroadcast() {
  if (!room) return;
  room.send(COM_MSG.broadcastStart);
}

export function stopBroadcast() {
  room?.send(COM_MSG.broadcastStop);
}

export function openAnnounce(open = true) {
  useComStore.setState({ announceOpen: open });
}

export function dismissWave(waveId: string) {
  useComStore.setState((s) => ({ waves: s.waves.filter((w) => w.waveId !== waveId) }));
}

export function dismissAnnouncement() {
  if (announceTimer) clearTimeout(announceTimer);
  announceTimer = null;
  useComStore.setState({ announcement: null });
}

/** Del saludo: caminar hasta quien saludó. */
export function goToWave(w: WaveEvent) {
  dismissWave(w.waveId);
  const who = findUser(w.fromUserId);
  if (!who) return notify(`${w.fromName} ya no está conectado.`);
  useOfficeStore.getState().walkToPlayer(who.sessionId);
}

/** Del saludo: llamar a quien saludó. */
export function callBackWave(w: WaveEvent) {
  dismissWave(w.waveId);
  callPerson(w.fromUserId);
}

// ---------- Para la escena (quién se oye) ----------

type VoiceFlags = { call?: string; broadcast?: boolean; onAir?: boolean };
let flagsCache: Map<string, VoiceFlags> | null = null;
let flagsAt = 0;

/**
 * Lo que la llamada y el anuncio le suman a `Positioned` (ver `hearing` en @hyvento/shared): `call` si está
 * hablando en una llamada, `broadcast` si le habla a toda la cabaña y `onAir` si está adentro del estudio
 * mientras se graba el podcast (ahí no llega el anuncio). Se arma una vez cada 100 ms.
 */
export function voiceFlags(userId: string): VoiceFlags {
  if (!room || !userId) return {};
  const now = performance.now();
  if (!flagsCache || now - flagsAt > 100) {
    flagsCache = new Map();
    flagsAt = now;
    const recording = useEscenarioStore.getState().podcast.phase === "recording";
    room.state.players.forEach((p) => {
      const call = p.call === "talking" && p.callId ? p.callId : undefined;
      const broadcast = (p.broadcastUntil ?? 0) > 0;
      const onAir = recording && p.area === PODCAST.area;
      if (call || broadcast || onAir) flagsCache!.set(p.userId, { ...(call ? { call } : {}), ...(broadcast ? { broadcast } : {}), ...(onAir ? { onAir } : {}) });
    });
  }
  return flagsCache.get(userId) ?? {};
}

/** ¿Alguien le habla a toda la cabaña? Entonces hay que tener abierta la sala de voz. */
export function broadcastActive(): boolean {
  return useComStore.getState().broadcast !== null;
}

// ---------- Seguir ----------

const FOLLOW_TICK_MS = 500;
/** Cuánto sin moverme (lejos de la persona) cuenta como que la ruta se quedó corta. */
const FOLLOW_STUCK_MS = 1200;
/** Tras tantos intentos sin avanzar, no hay cómo llegar: se deja de seguir. */
const FOLLOW_MAX_STUCK = 2;

let lastGoal: { area: string; x: number; y: number } | null = null;
let lastTriggerAt = 0;
let myLastPos = "";
let myLastMoveAt = 0;
let stuckTries = 0;

function resetFollowProgress() {
  lastGoal = null;
  lastTriggerAt = 0;
  myLastPos = "";
  myLastMoveAt = Date.now();
  stuckTries = 0;
}

function followTick() {
  const f = useComStore.getState().following;
  if (!f || !room) return stopFollowing();
  const me = room.state.players.get(room.sessionId);
  const target = findUser(f.userId);
  if (!me) return;
  if (!target) return stopFollowing(`${f.name} se fue de la cabaña: dejas de seguirle.`);
  const t = target.player;
  // Una oficina cerrada donde no puedo entrar: no me quedo pegado a la puerta.
  const office = t.zoneId ? useOfficeStore.getState().offices[t.zoneId] : undefined;
  if (office?.locked && office.ownerId !== me.userId && !office.guests.includes(me.userId))
    return stopFollowing(`${f.name} entró a una oficina cerrada: dejas de seguirle.`);

  const now = Date.now();
  const pos = `${me.area}:${Math.round(me.x)}:${Math.round(me.y)}`;
  if (pos !== myLastPos) {
    myLastPos = pos;
    myLastMoveAt = now;
    stuckTries = 0;
  }
  if (!followNeedsWalk(me, t)) {
    lastGoal = null;
    stuckTries = 0;
    return;
  }
  const moved = !lastGoal || lastGoal.area !== t.area || Math.hypot(lastGoal.x - t.x, lastGoal.y - t.y) > 2 * 32;
  const stuck = now - myLastMoveAt > FOLLOW_STUCK_MS && now - lastTriggerAt > FOLLOW_STUCK_MS;
  if (!moved && !stuck) return;
  if (stuck) {
    // En otro nivel sin camino, "Ir hasta" ya avisó que no encuentra cómo llegar: se suelta sin repetirlo.
    if (me.area !== t.area && stuckTries > 0) return stopFollowing();
    if (++stuckTries > FOLLOW_MAX_STUCK) return stopFollowing(`No encuentro cómo llegar hasta ${f.name}: dejas de seguirle.`);
  }
  lastGoal = { area: t.area, x: t.x, y: t.y };
  lastTriggerAt = now;
  useOfficeStore.getState().walkToPlayer(target.sessionId);
}

// ---------- Mensajes de la sala ----------

function handleWave(w: WaveEvent) {
  useComStore.setState((s) => ({ waves: [...s.waves.filter((x) => x.fromUserId !== w.fromUserId), w].slice(-3) }));
  setTimeout(() => dismissWave(w.waveId), COMUNICACION.waveShowMs);
  shoulderTap();
  browserNotify("wave", `${w.fromName} te saluda. Haz clic para ir hasta allá.`, { onClick: () => goToWave(w) });
}

/** En "No molestar" el aviso se ve, pero sin timbre. */
function chimeUnlessDnd() {
  const me = room ? room.state.players.get(room.sessionId) : undefined;
  if (me?.status !== "dnd") announceChime();
}

function handleAnnouncement(a: Announcement) {
  if (announceTimer) clearTimeout(announceTimer);
  useComStore.setState({ announcement: a });
  announceTimer = setTimeout(() => dismissAnnouncement(), COMUNICACION.announceShowMs);
  chimeUnlessDnd();
  browserNotify("announce", a.text, { title: `${a.fromName} · ${announcementTime(a.at)}` });
}

/**
 * ¿El anuncio me prendió el micrófono? Entonces al terminar se apaga, para no quedar con el micrófono
 * abierto por proximidad. Si ya lo tenía prendido, se deja como estaba.
 */
let micByBroadcast = false;

function handleBroadcast(e: BroadcastEvent) {
  const mine = e.userId === myUserId();
  // Un solo chip: el reductor decide si es un inicio nuevo o el mismo anuncio que sigue (reduceBroadcast).
  const { next, fresh, ended } = reduceBroadcast(useComStore.getState().broadcast, e, localTime);
  useComStore.setState({ broadcast: next });
  if (e.kind === "start") {
    // Ya estaba sonando (al entrar o recargar): sin timbre y sin prender nada solo.
    if (!fresh) {
      if (mine && e.resumed && !useMediaStore.getState().mic) notify("Sigues anunciando a toda la cabaña: prende el micrófono para que te oigan.", "warning");
      return;
    }
    if (mine) {
      // Para que te oigan hay que tener el micrófono prendido.
      micByBroadcast = !useMediaStore.getState().mic;
      if (micByBroadcast) void media.toggleMic();
      notify("Estás hablándole a toda la cabaña: todos te oyen, estén donde estén.");
    } else {
      chimeUnlessDnd();
      notify(`${e.name} está hablando a toda la cabaña.`);
      browserNotify("announce", `${e.name} está hablando a toda la cabaña.`);
    }
    return;
  }
  if (!ended && !mine) return;
  if (mine && micByBroadcast && useMediaStore.getState().mic) void media.toggleMic();
  if (mine) micByBroadcast = false;
  notify(broadcastEndText(e, mine));
}

export function bindComunicacion(r: Room) {
  room = r as Room<StateView>;
  stopFollowing();
  useComStore.setState({ waves: [], announcement: null, broadcast: null, announceOpen: false });
  r.onMessage(COM_MSG.waved, handleWave);
  r.onMessage(COM_MSG.waveResult, (res: WaveResult) => notify(WAVE_RESULT_TEXT[res.outcome](res.toName), res.outcome === "sent" ? "info" : "warning"));
  r.onMessage(COM_MSG.announcement, handleAnnouncement);
  r.onMessage(COM_MSG.broadcastEvent, handleBroadcast);
  r.onMessage(COM_MSG.announceResult, (res: AnnounceResult) => notify(ANNOUNCE_ERROR_TEXT[res.error](res.name ?? ""), "warning"));
}

/** Al salir de la cabaña. */
export function resetComunicacion() {
  stopFollowing();
  dismissAnnouncement();
  room = null;
  flagsCache = null;
  micByBroadcast = false;
  useComStore.setState({ waves: [], broadcast: null, announceOpen: false });
}
