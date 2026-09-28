// Viaje rápido en el cliente (reglas en viaje.ts de @hyvento/shared; lo decide el servidor): anticipa si
// se puede (así no se funde a negro para rebotar), pide el viaje, funde a negro mientras llega la
// corrección con el nivel nuevo y, si el servidor dice que no, vuelve la imagen y avisa por qué. La
// escena engancha el fundido con `bindViajeScene`; la paleta, el mapa y la lista de conectados llaman a
// `travelTo` / `travelToPerson`.
import {
  BUS,
  CASA_ARBOL,
  PODCAST,
  VIAJE,
  VIAJE_MSG,
  viajeAreaBlock,
  viajeNoticeText,
  viajeSelfBlock,
  type ViajeBlock,
  type ViajeGoMessage,
  type ViajeNotice,
} from "@hyvento/shared";
import { getWorld, isGameSeat, seatAtPoint, travelDestination, travelDestinations, type TravelDestination } from "@hyvento/map";
import { busDoorsOpenNow } from "./busStore";
import { casaArbolBlockFor } from "./casaArbol";
import { podcastBlockFor } from "./escenario/net";
import { getRoom, onRoom, type OfficeRoom } from "./network";
import { canEnterOffice, selectMyUserId, useOfficeStore, type PanelKind } from "./store";

/** Lo que hace la escena: fundir a negro (false si no puede: ya viajando, sin personaje) y volver. */
export interface ViajeScene {
  begin: () => boolean;
  cancel: () => void;
}

let scene: ViajeScene | null = null;
/** Cuándo se pidió el último viaje que salió bien (para anticipar la pausa). */
let lastAt = -Infinity;
/** El viaje pedido y todavía sin respuesta (si el servidor dice que no, se deshace lo anticipado). */
let pending: { at: number; prevLastAt: number } | null = null;
const boundRooms = new WeakSet<OfficeRoom>();

/** La escena se engancha al crearse (y se suelta al destruirse). */
export function bindViajeScene(s: ViajeScene): () => void {
  scene = s;
  return () => {
    if (scene === s) scene = null;
  };
}

/** Los avisos del servidor (una vez por sala: al reconectar llega otra). */
export function bindViajeNet(): () => void {
  return onRoom((r) => {
    if (boundRooms.has(r)) return;
    boundRooms.add(r);
    r.onMessage(VIAJE_MSG.notice, (n: ViajeNotice) => {
      if (pending) {
        // La pausa que se anticipó no corre si no se viajó (salvo que la pausa sea el motivo).
        if (n.code !== "cooldown") lastAt = pending.prevLastAt;
        pending = null;
      }
      scene?.cancel();
      useOfficeStore.getState().notify(viajeNoticeText(n), n.code === "here" ? "info" : "warning");
    });
  });
}

/** Paneles de juego abiertos (mesas, arcade, carrera): mientras tanto no se viaja. */
const PLAYING_PANELS = new Set<PanelKind>(["roulette", "blackjack", "hockey", "boardgame", "baccarat", "dados", "caballos", "arcade", "race"]);

/** Todos los destinos (lugares) del mundo. */
export function destinations(): TravelDestination[] {
  return travelDestinations(getWorld().areas.values());
}

/** Lo que frena al jugador local, con lo que se ve del estado (el servidor decide igual). */
function selfBlock(): ViajeBlock | null {
  const room = getRoom();
  const s = useOfficeStore.getState();
  const me = s.sessionId ? room?.state.players.get(s.sessionId) : undefined;
  if (!me) return "unknown";
  const map = getWorld().areas.get(me.area);
  const seat = map && me.seated ? seatAtPoint(map, me.x, me.y) : undefined;
  return viajeSelfBlock({
    gameSeat: Boolean(map && me.seated && isGameSeat(map, me.x, me.y, seat?.type)),
    swimming: me.swimming,
    fainted: false,
    playing: me.racing || me.fishing !== "" || (s.panel !== null && PLAYING_PANELS.has(s.panel.kind)),
    onBusInRoute: me.area === BUS.area && !busDoorsOpenNow(),
    cooldownLeftMs: Math.max(0, lastAt + VIAJE.cooldownMs - performance.now()),
  });
}

function areaBlock(area: string): ViajeBlock | null {
  const myUserId = selectMyUserId(useOfficeStore.getState());
  return viajeAreaBlock(area, {
    treeHouse: area === CASA_ARBOL.area ? casaArbolBlockFor(myUserId) : null,
    studio: area === PODCAST.area ? podcastBlockFor(myUserId) : null,
  });
}

/**
 * ¿Se puede viajar ahí ahora? Devuelve el motivo si no (lo mismo que diría el servidor, con lo que se ve).
 * Para la paleta y el mapa: mostrar el lugar apagado con el motivo.
 */
export function travelBlockFor(target: ViajeGoMessage): ViajeBlock | null {
  const self = selfBlock();
  if (self) return self;
  if (target.kind === "place") {
    const d = travelDestination(getWorld().areas.values(), target.id);
    if (!d) return "unknown";
    if (d.zoneId && useOfficeStore.getState().zone?.id === d.zoneId) return "here";
    return areaBlock(d.area);
  }
  const room = getRoom();
  let who: { area: string; zoneId: string } | undefined;
  room?.state.players.forEach((p) => {
    if (p.userId === target.userId) who = p;
  });
  if (!who) return "offline";
  const block = areaBlock(who.area);
  if (block) return block;
  // En una oficina cerrada donde no puedo entrar: igual se viaja (a la puerta), no es un bloqueo.
  return null;
}

/** Texto del motivo (para la paleta y los avisos). */
export const travelBlockText = (code: ViajeBlock) => viajeNoticeText({ code, waitMs: Math.max(0, lastAt + VIAJE.cooldownMs - performance.now()) });

function go(target: ViajeGoMessage): boolean {
  const room = getRoom();
  const block = travelBlockFor(target);
  if (block) {
    useOfficeStore.getState().notify(travelBlockText(block), block === "here" ? "info" : "warning");
    return false;
  }
  if (!room || !scene?.begin()) return false;
  pending = { at: performance.now(), prevLastAt: lastAt };
  lastAt = performance.now();
  room.send(VIAJE_MSG.go, target);
  // Si no hay respuesta en un rato (se perdió), la escena ya vuelve sola; aquí solo se olvida.
  setTimeout(() => {
    if (pending && performance.now() - pending.at >= 2500) pending = null;
  }, 3000);
  return true;
}

/** Viaje rápido a un lugar de la lista (`nivel:<area>` o `zona:<zoneId>`). */
export const travelTo = (id: string) => go({ kind: "place", id });

/**
 * Junto a alguien: si está en mi nivel y cerca, caminando (como "Ir hasta"); si no, de una. Devuelve
 * si hizo algo.
 */
export function travelToPerson(sessionId: string): boolean {
  const room = getRoom();
  const s = useOfficeStore.getState();
  const who = room?.state.players.get(sessionId);
  const me = s.sessionId ? room?.state.players.get(s.sessionId) : undefined;
  if (!who || !me) return false;
  if (who.area === me.area && Math.hypot(who.x - me.x, who.y - me.y) < VIAJE.nearTiles * 32) {
    s.walkToPlayer(sessionId);
    return true;
  }
  return go({ kind: "person", userId: who.userId });
}

/** Lugar de destino caminando o viajando: si queda en mi nivel y cerca, se camina. */
export function goToPlace(id: string): boolean {
  const d = travelDestination(getWorld().areas.values(), id);
  const room = getRoom();
  const s = useOfficeStore.getState();
  const me = s.sessionId ? room?.state.players.get(s.sessionId) : undefined;
  if (!d || !me) return false;
  const ts = 32;
  if (d.area === me.area && Math.hypot((d.tile.x + 0.5) * ts - me.x, (d.tile.y + 0.5) * ts - me.y) < 12 * ts) {
    if (d.zoneId) s.walkToZone(d.zoneId);
    else s.walkToPoint((d.tile.x + 0.5) * ts, (d.tile.y + 0.5) * ts);
    return true;
  }
  return travelTo(id);
}

/** ¿Puedo entrar a la oficina de ese destino? (para mostrar el candado en la lista). */
export function officeOpenFor(d: TravelDestination): boolean {
  if (d.zoneType !== "office" || !d.zoneId) return true;
  const s = useOfficeStore.getState();
  return canEnterOffice(s.offices[d.zoneId], selectMyUserId(s));
}
