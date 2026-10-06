// La Feria de las flores jugable (VIR-161, docs/plan-festivales.md): el festival del día 15 de la primavera.
// Las flores se siembran en el huerto (clavel, astromelia, girasol y hortensia en `CROPS`, con semillas que
// solo vende el puesto de la feria), se arma la silleta en la mesa del silletero (el código va en el id del
// objeto: silleta.ts), se exhibe en el patio de la feria y se vota; al cierre gana la más votada. A las
// 16:00 del juego pasa el desfile de silleteros. Aquí las reglas puras; la decoración está en packages/map
// (festivales/feria-flores.ts) y lo decide la sala (apps/server/src/rooms/feriaFlores.ts).
import { z } from "zod";
import type { CineDef, CineStep } from "./cinematicas";
import { FLOWER_CROPS, seedsOf } from "./huerto";
import { SILLETA, silletaFlowers, validSilletaCode } from "./silleta";

export const FERIA = {
  id: "feria-flores",
  /** Pausa entre dos acciones de la feria de la misma persona (armar, exhibir, votar, comprar). */
  cooldownMs: 1200,
  /** La hora del juego del desfile de silleteros. */
  desfileHora: 16,
  /** Lo que gana la silleta más votada (una vez por feria; ocio, con el tope del día). */
  premio: 40,
  /** La premiación sale un rato después del cierre, para no pisarse con la cinemática de cierre. */
  premiacionDelayMs: 18_000,
} as const;

/** ¿Está abierta la feria? (de las 9:00 a las 22:00 del juego). */
export const feriaActiva = (festival: string, fase: string) => festival === FERIA.id && fase === "fiesta";

export const FERIA_MSG = {
  /** Cliente → servidor: armar una silleta en la mesa del silletero (`{ code }`). */
  build: "feria:armar",
  buildResult: "feria:armar:resultado",
  /** Cliente → servidor: exhibir la silleta de la mano en un exhibidor (`{ stand }`). */
  exhibit: "feria:exhibir",
  exhibitResult: "feria:exhibir:resultado",
  /** Cliente → servidor: votar por la silleta de un exhibidor (`{ stand }`). */
  vote: "feria:votar",
  voteResult: "feria:votar:resultado",
  /** Cliente → servidor: comprar semillas en el puesto de la feria (`{ item }`). */
  buy: "feria:comprar",
  buyResult: "feria:comprar:resultado",
  /** Servidor → uno: si ya votó en esta feria y por cuál (`FeriaMine`). */
  mine: "feria:mio",
  /** Servidor → los que no están en el jardín: que el desfile está pasando. */
  desfile: "feria:desfile",
} as const;

/** Un exhibidor se nombra por su tile (estable aunque la decoración cambie de orden). */
export const standKey = (x: number, y: number) => `${x},${y}`;

const StandKey = z.string().regex(/^\d{1,3},\d{1,3}$/);
export const SilletaBuildMessage = z.object({ code: z.string().length(SILLETA.cells) });
export const SilletaStandMessage = z.object({ stand: StandKey });

/** Lo que se sabe de cada silleta exhibida (lo publica la sala en `state.feria`). */
export interface SilletaExhibitView {
  stand: string;
  ownerId: string;
  ownerName: string;
  code: string;
  votes: number;
}

export interface FeriaMine {
  voted: boolean;
  /** El exhibidor por el que votó (si la sala lo sabe). */
  stand: string | null;
}

// ---------- Armar ----------

export type BuildError = "off" | "far" | "code" | "flowers" | "full" | "busy";
export type BuildResult = { ok: true; code: string } | { ok: false; error: BuildError; missing?: Record<string, number> };

export const BUILD_ERROR_TEXT: Record<BuildError, string> = {
  off: "La mesa del silletero abre solo en la Feria de las flores.",
  far: "Arrímate a la mesa del silletero.",
  code: `Una silleta lleva por lo menos ${SILLETA.minFlores} flores.`,
  flowers: "No te alcanzan las flores: siembra y cosecha más en el huerto.",
  full: "No te cabe la silleta en la mochila.",
  busy: "Un momentico…",
};

/** Lo que le falta para armar una silleta con lo que lleva en la mochila (vacío = alcanza). */
export function missingFlowers(code: string, have: (flower: string) => number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [flower, n] of Object.entries(silletaFlowers(code))) if (have(flower) < n) out[flower] = n - have(flower);
  return out;
}

/** ¿El código sirve para armar? (bien formado y con flores suficientes). */
export const canBuildSilleta = (code: string) => validSilletaCode(code);

// ---------- Exhibir y votar ----------

export type ExhibitError = "off" | "far" | "none" | "taken" | "already" | "busy";
export type ExhibitResult = { ok: true; stand: string } | { ok: false; error: ExhibitError };

export const EXHIBIT_ERROR_TEXT: Record<ExhibitError, string> = {
  off: "Las silletas se exhiben durante la Feria de las flores.",
  far: "Arrímate al exhibidor.",
  none: "Lleva tu silleta en la mano para exhibirla.",
  taken: "Ese exhibidor ya tiene silleta: busca uno libre.",
  already: "Tu silleta ya está exhibida en esta feria.",
  busy: "Un momentico…",
};

export type VoteError = "off" | "far" | "empty" | "own" | "voted" | "busy";
export type VoteResult = { ok: true; stand: string } | { ok: false; error: VoteError };

export const VOTE_ERROR_TEXT: Record<VoteError, string> = {
  off: "La votación es durante la Feria de las flores.",
  far: "Arrímate a la silleta para votar.",
  empty: "Ese exhibidor está vacío.",
  own: "Por la tuya no se vale votar.",
  voted: "Ya votaste en esta feria. ¡Un voto por persona!",
  busy: "Un momentico…",
};

/** Clave de `UserStat` (máximo 1) del voto de un año del juego: un voto por persona por feria. */
export const feriaVoteKey = (año: number) => `festival:${FERIA.id}:${año}:voto`;
/** `refId` del premio de la silleta de oro (se paga una sola vez por feria). */
export const feriaPrizeRef = (año: number) => `festival:${FERIA.id}:${año}:silleta-de-oro`;

/**
 * La ganadora: la más votada (con al menos un voto); en un empate, la que se exhibió primero. Null si
 * nadie votó.
 */
export function feriaGanadora<T extends { votes: number; at: number }>(exhibits: readonly T[]): T | null {
  let best: T | null = null;
  for (const e of exhibits) if (e.votes > 0 && (!best || e.votes > best.votes || (e.votes === best.votes && e.at < best.at))) best = e;
  return best;
}

// ---------- El puesto de semillas ----------

export interface FeriaShopItem {
  /** Id del objeto de la mochila (sin `obj:`): las semillas de una flor. */
  id: string;
  name: string;
  price: number;
}

export const FERIA_SHOP: readonly FeriaShopItem[] = FLOWER_CROPS.map((c, i) => ({
  id: seedsOf(c.id),
  name: `Semillas de ${c.name.toLowerCase()}`,
  // Las que tardan más cuestan un poco más.
  price: 10 + i * 2,
}));

export const feriaShopItem = (id: string): FeriaShopItem | undefined => FERIA_SHOP.find((i) => i.id === id);
/** El `refId` de la compra (`PURCHASE`). */
export const feriaRefId = (id: string) => `festival:${FERIA.id}:${id}`;

export const FeriaBuyMessage = z.object({ item: z.string().refine((v) => Boolean(feriaShopItem(v))) });

export type FeriaBuyError = "off" | "far" | "funds" | "full" | "stack" | "busy" | "failed";
export type FeriaBuyResult = { ok: true; item: string; balance: number } | { ok: false; item: string; error: FeriaBuyError };

export const FERIA_BUY_ERROR_TEXT: Record<FeriaBuyError, string> = {
  off: "El puesto de semillas abre solo en la Feria de las flores.",
  far: "Arrímate al puesto de las flores.",
  funds: "No te alcanzan los puntos.",
  full: "La mochila está llena.",
  stack: "Ya llevas muchas bolsas de esas.",
  busy: "Un momentico…",
  failed: "No se pudo comprar. Intenta de nuevo.",
};

// ---------- El desfile y las cinemáticas ----------

export const FERIA_CINE = {
  desfile: "feria-desfile",
  premiacion: "feria-premiacion",
  armada: "feria-silleta",
} as const;

/**
 * El desfile de silleteros: baja por el camino de piedra del portón hacia la casa (tiles del jardín, x 62
 * y 63), cruza el arco de flores y entra a la plaza de la feria. `DESFILE_FILA` son los que cargan (cada
 * uno con su silleta): Doña Aurora adelante.
 */
export const DESFILE = {
  from: 74,
  to: 47,
  /** Hasta dónde llegan en la plaza (doblan al este). */
  plazaX: 70,
} as const;

const DESFILE_FILA = [
  { id: "aurora", like: "aurora", silleta: "hhhhhgghcaac" },
  { id: "gloria", like: "gloria", silleta: "cccccaaccggc" },
  { id: "evelio", like: "evelio", silleta: "gagagagagaga" },
  { id: "portero", like: "portero", silleta: "hchchchchchc" },
  { id: "cajera", like: "cajera", silleta: "aaaaaggaacca" },
] as const;

/** Las silletas que cargan los del desfile (para el arte y los tests). */
export const DESFILE_SILLETAS: readonly string[] = DESFILE_FILA.map((f) => f.silleta);

const fila = (k: number) => ({ x: 62 + (k % 2), y: DESFILE.from + k * 2 });

/** Las cinemáticas de la Feria de las flores (se suman al catálogo). */
export const FERIA_CINEMATICAS: readonly CineDef[] = [
  {
    id: FERIA_CINE.desfile,
    kind: "momento",
    steps: [
      ...DESFILE_FILA.map((f, k): CineStep => ({ op: "spawn", id: f.id, like: f.like, name: "Silletero", at: fila(k), facing: "up", holds: `silleta:${f.silleta}` })),
      { op: "sound", sound: "tambor" },
      { op: "title", text: "¡El desfile de silleteros!", sub: "Bajan por el camino de piedra con sus silletas", ms: 2600 },
      { op: "camera", to: "aurora", zoom: 1.15, follow: true },
      {
        op: "together",
        steps: [
          ...DESFILE_FILA.map(
            (f, k): CineStep => ({
              op: "walk",
              who: f.id,
              path: [
                { x: fila(k).x, y: DESFILE.to + k * 2 + 6 },
                { x: fila(k).x, y: DESFILE.to + k },
                { x: DESFILE.plazaX - k * 2, y: DESFILE.to + k },
              ],
            }),
          ),
          { op: "sound", sound: "aplausos" },
          { op: "emote", who: "yo", emote: "clap" },
        ],
      },
      {
        op: "together",
        steps: [
          ...DESFILE_FILA.map((f, k): CineStep => ({ op: "act", who: f.id, action: k % 2 ? "saltar" : "bailar" })),
          { op: "fx", fx: "confeti", who: "aurora" },
          { op: "say", who: "aurora", text: "¡Que vivan las flores! Esta silleta la cargó mi abuela y la abuela de mi abuela.", ms: 3200 },
        ],
      },
      { op: "together", steps: [{ op: "sound", sound: "aplausos" }, { op: "emote", who: "yo", emote: "clap" }, { op: "bubble", who: "evelio", text: "¡La de juncos es la mía!" }] },
      { op: "camera", to: "yo" },
      { op: "together", steps: DESFILE_FILA.map((f, k): CineStep => ({ op: "walk", who: f.id, to: { x: DESFILE.plazaX + 8 - k, y: DESFILE.to - 3 } })) },
      ...DESFILE_FILA.map((f): CineStep => ({ op: "despawn", id: f.id })),
    ],
  },
  {
    id: FERIA_CINE.premiacion,
    kind: "momento",
    steps: [
      { op: "spawn", id: "aurora", like: "aurora", at: { dx: 5, dy: 2 }, facing: "left", holds: "silleta:{silleta}" },
      { op: "spawn", id: "gloria", like: "gloria", at: { dx: 6, dy: 3 }, facing: "left" },
      { op: "together", steps: [{ op: "walk", who: "aurora", to: { dx: 2, dy: 1 } }, { op: "walk", who: "gloria", to: { dx: 2, dy: 2 } }] },
      { op: "together", steps: [{ op: "face", who: "aurora", toward: "yo" }, { op: "face", who: "gloria", toward: "yo" }] },
      { op: "sound", sound: "fanfarria" },
      {
        op: "together",
        steps: [
          { op: "flash", color: "oro", ms: 400 },
          { op: "title", text: "¡Silletero de oro!", sub: "{ganador} · {votos} votos", ms: 3000 },
          { op: "fx", fx: "confeti" },
          { op: "act", who: "aurora", action: "celebrar" },
          { op: "act", who: "gloria", action: "saltar" },
        ],
      },
      { op: "say", who: "gloria", text: "El jurado habló: la silleta de {ganador} se lleva la cinta de oro de la feria.", ms: 3200 },
      { op: "together", steps: [{ op: "sound", sound: "aplausos" }, { op: "emote", who: "yo", emote: "clap" }, { op: "act", who: "aurora", action: "saludar" }] },
      { op: "together", steps: [{ op: "walk", who: "aurora", to: { dx: -3, dy: 5 } }, { op: "walk", who: "gloria", to: { dx: -2, dy: 6 } }] },
      { op: "despawn", id: "aurora" },
      { op: "despawn", id: "gloria" },
    ],
  },
  {
    id: FERIA_CINE.armada,
    kind: "momento",
    steps: [
      { op: "flash", color: "rosa", ms: 350 },
      { op: "sound", sound: "destello" },
      { op: "fx", fx: "chispas", who: "yo" },
      { op: "title", text: "¡Silleta lista!", sub: "{nombre}: exhíbela en el patio de la feria", ms: 2600 },
    ],
  },
];
