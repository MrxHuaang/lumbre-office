// Viaje rápido: ir de una a un lugar de la cabaña (una sala, una zona o un nivel) o junto a una persona,
// con un fundido a negro, sin caminar por los portales. Lo decide el servidor con las mismas reglas que
// cruzar un portal (`handleTravel`) y que las oficinas cerradas; el cliente solo lo anticipa (para no
// fundirse a negro y rebotar). Estas son las reglas puras: qué frena a quien viaja y qué frena el destino.
import { z } from "zod";
import { CASA_ARBOL, CASA_ARBOL_BLOCK_TEXT, type CasaArbolBlock } from "./casa-arbol";
import { PODCAST, podcastNoticeText, type PodcastBlock } from "./podcast";
import { CASA_PROPIA_BLOCK_TEXT, casaPropiaBlock } from "./casa-propia";

export const VIAJE = {
  /** Pausa entre dos viajes de la misma persona: es un atajo, no una forma de moverse. */
  cooldownMs: 8_000,
  /** Hasta cuántos tiles alrededor del destino se busca un lugar libre donde aparecer. */
  searchTiles: 6,
  /** Si la persona está a menos de esto (tiles) en el mismo nivel, se camina (no se viaja). */
  nearTiles: 4,
} as const;

/** Mensajes propios del viaje rápido (no van en MSG). */
export const VIAJE_MSG = {
  /** Cliente → servidor: `ViajeGoMessage`. */
  go: "viaje:go",
  /** Servidor → quien pidió el viaje, si no se pudo: `ViajeNotice`. Si se pudo llega la corrección de siempre. */
  notice: "viaje:notice",
} as const;

/** Adónde: un destino de la lista (`travelDestinations` de @hyvento/map) o junto a alguien (User.id). */
export const ViajeGoMessage = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("place"), id: z.string().min(1).max(80) }),
  z.object({ kind: z.literal("person"), userId: z.string().min(1).max(80) }),
]);
export type ViajeGoMessage = z.infer<typeof ViajeGoMessage>;

/** Por qué no se pudo viajar. */
export type ViajeBlock =
  // Lo de quien viaja.
  | "cooldown"
  | "seated"
  | "swimming"
  | "fainted"
  | "busy"
  | "route"
  // Lo del destino.
  | "bus"
  | "office"
  | "treeFull"
  | "treeLocked"
  | "studioFull"
  | "onAir"
  | "casaAjena"
  | "unknown"
  | "offline"
  | "here";

export interface ViajeNotice {
  code: ViajeBlock;
  /** Con `cooldown`: cuánto falta (ms). */
  waitMs?: number;
}

/** Lo que importa de quien quiere viajar (lo arma el servidor con su estado; el cliente, con lo que ve). */
export interface ViajeSelf {
  /** Sentado en una mesa de juego o del casino, o metido en la tina o en la sauna (ver `isGameSeat`). */
  gameSeat: boolean;
  swimming: boolean;
  fainted: boolean;
  /** Carrera de sillas, pesca, hockey u otro minijuego en curso. */
  playing: boolean;
  /** Adentro del Megabús con las puertas cerradas (en ruta o llegando). */
  onBusInRoute: boolean;
  /** Cuánto le falta a la pausa entre viajes (0 = nada). */
  cooldownLeftMs: number;
}

/** ¿Qué frena a quien viaja? (null = nada). El orden es el de lo más grave a lo más pasajero. */
export function viajeSelfBlock(s: ViajeSelf): ViajeBlock | null {
  if (s.fainted) return "fainted";
  if (s.swimming) return "swimming";
  if (s.gameSeat) return "seated";
  if (s.playing) return "busy";
  if (s.onBusInRoute) return "route";
  if (s.cooldownLeftMs > 0) return "cooldown";
  return null;
}

/**
 * ¿La pesca frena el viaje? Con la caña en el agua o en el minijuego sí; levantando el pez recién sacado
 * ("show:<pez>", unos segundos) no.
 */
export const fishingBlocksTravel = (fishing: string) => fishing !== "" && !fishing.startsWith("show:");

/** Al Megabús no se viaja: se sube en la estación con las puertas abiertas (ver `BUS_MSG.board`). */
export const VIAJE_NO_AREAS: readonly string[] = ["megabus"];

/** Niveles que no salen en la lista de destinos: al barrio todavía se llega solo en bus (VIR-142). */
export const VIAJE_OCULTAS: readonly string[] = ["barrio"];

/**
 * ¿Qué frena la llegada a un nivel? Los cupos y cierres de la casa del árbol y del estudio (los calcula
 * quien llama con `casaArbolBlock` y `podcastBlock`, como al cruzar su portal), el bus y la casa de otra
 * persona (junto a alguien que está en su casa no se viaja: adentro entra solo el dueño).
 */
export function viajeAreaBlock(
  area: string,
  rules: { userId: string; treeHouse: CasaArbolBlock | null; studio: PodcastBlock | null },
): ViajeBlock | null {
  if (VIAJE_NO_AREAS.includes(area)) return "bus";
  if (casaPropiaBlock(area, rules.userId)) return "casaAjena";
  if (area === CASA_ARBOL.area && rules.treeHouse) return rules.treeHouse === "full" ? "treeFull" : "treeLocked";
  if (area === PODCAST.area && rules.studio) return rules.studio === "full" ? "studioFull" : "onAir";
  return null;
}

/** El aviso para la persona. */
export function viajeNoticeText(n: ViajeNotice): string {
  switch (n.code) {
    case "cooldown":
      return `Espera ${Math.max(1, Math.ceil((n.waitMs ?? VIAJE.cooldownMs) / 1000))} s antes de volver a viajar.`;
    case "seated":
      return "Levántate primero: desde la mesa, la tina o la sauna no se viaja.";
    case "swimming":
      return "Sal de la piscina antes de viajar.";
    case "fainted":
      return "Estás en el piso: primero despierta.";
    case "busy":
      return "Termina lo que estás jugando antes de viajar.";
    case "route":
      return "El Megabús va en ruta: te bajas cuando llegue a la estación.";
    case "bus":
      return "Al Megabús se sube en la estación, con las puertas abiertas.";
    case "office":
      return "Esa oficina está cerrada: toca la puerta para entrar.";
    case "treeFull":
      return CASA_ARBOL_BLOCK_TEXT.full;
    case "treeLocked":
      return CASA_ARBOL_BLOCK_TEXT.locked;
    case "studioFull":
      return podcastNoticeText({ code: "full" });
    case "onAir":
      return podcastNoticeText({ code: "onAir" });
    case "casaAjena":
      return CASA_PROPIA_BLOCK_TEXT.ajena;
    case "unknown":
      return "No encontramos ese lugar.";
    case "offline":
      return "Esa persona ya no está conectada.";
    case "here":
      return "Ya estás ahí.";
  }
}
