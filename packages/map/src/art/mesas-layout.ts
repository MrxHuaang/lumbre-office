// Geometría de las mesas de rondas compartidas del casino (baccarat, dados y carrera de caballitos): dónde está cada casilla de apuesta, dónde van las cartas, el cubilete y los carriles. La usan
// el dibujo del mueble (art/mesas.ts, a la escala del nivel) y el modo mesa (el mismo archivo, en alta
// resolución, y los clics). Todo en unidades de arte locales del mueble mirando hacia "right".
import { DADOS_TOTALS, HORSES, type MesaId } from "@hyvento/shared";

/** Una casilla de apuesta del paño. */
export interface MesaCell {
  /** La apuesta tal como viaja al servidor ("banker", "t11", "h3"…). */
  bet: string;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Texto de la casilla (en el paño en alta resolución) y una segunda línea más chica. */
  label: string;
  label2?: string;
  /** Color del fondo: el paño, un color de apuesta o el de un caballito (índice). */
  fill: "felt" | "red" | "blue" | "gold" | "dark" | number;
  /** Dónde van el texto y las fichas. */
  text: { u: number; v: number };
  chip: { u: number; v: number };
  /** Puntos de dado en vez de texto (las apuestas a un número de los dados). */
  pips?: number;
}

function cell(bet: string, u0: number, v0: number, u1: number, v1: number, fill: MesaCell["fill"], label: string, opts: { label2?: string; pips?: number; chip?: "center" | "after" } = {}): MesaCell {
  const cu = (u0 + u1) / 2;
  const cv = (v0 + v1) / 2;
  // Con fichas "after", la ficha va junto al borde de quien apuesta (+u) y el texto hacia atrás.
  const after = opts.chip === "after";
  return {
    bet,
    u0,
    v0,
    u1,
    v1,
    fill,
    label,
    label2: opts.label2,
    pips: opts.pips,
    text: after ? { u: cu - (u1 - u0) * 0.2, v: cv } : { u: cu, v: cv },
    chip: after ? { u: u1 - 2.4, v: cv } : { u: cu, v: cv },
  };
}

export const insideMesaCell = (c: MesaCell, u: number, v: number) => u >= c.u0 && u < c.u1 && v >= c.v0 && v < c.v1;

// ---------- Baccarat (2x3 tiles = 32x48): el crupier en -u, quienes apuestan en +u ----------

export const BACCARAT_TOP_Z = 14;
export const BACCARAT_SHAPE = { u0: 1, u1: 31, v0: 1, v1: 47, rDealer: 3, rPlayers: 9 } as const;

/** Distancia (aprox.) de (u, v) al borde de la mesa; negativa afuera. Esquinas redondas, más del lado de la gente. */
export function baccaratInset(u: number, v: number): number {
  const { u0, u1, v0, v1, rDealer, rPlayers } = BACCARAT_SHAPE;
  if (u < u0 || u > u1 || v < v0 || v > v1) return -1;
  const r = u > (u0 + u1) / 2 ? rPlayers : rDealer;
  const cu = u > (u0 + u1) / 2 ? u1 - r : u0 + r;
  const cv = v < v0 + r ? v0 + r : v > v1 - r ? v1 - r : v;
  const inCorner = (u > u1 - r || u < u0 + r) && (v < v0 + r || v > v1 - r);
  if (inCorner) return r - Math.hypot(u - cu, v - cv);
  return Math.min(u - u0, u1 - u, v - v0, v1 - v);
}

/**
 * Las casillas en fila frente a la gente, de punta a punta: las parejas en las esquinas y, al medio,
 * el jugador, el empate y la banca (en diagonal en la pantalla: así los rótulos no se pisan).
 */
export const BACCARAT_CELLS: readonly MesaCell[] = [
  cell("pplayer", 15, 3.5, 25.5, 9, "dark", "PJ", { label2: "11:1" }),
  cell("player", 15, 9.5, 27.5, 20, "blue", "JUGADOR", { label2: "1 A 1", chip: "after" }),
  cell("tie", 15, 20.5, 27.5, 27.5, "gold", "EMPATE", { label2: "8 A 1", chip: "after" }),
  cell("banker", 15, 28, 27.5, 38.5, "red", "BANCA", { label2: "1 A 1", chip: "after" }),
  cell("pbanker", 15, 39, 25.5, 44.5, "dark", "PB", { label2: "11:1" }),
];

/** Dónde van las cartas de cada mano (la base, sobre el paño del crupier) y sus rótulos. */
export const BACCARAT_HANDS = {
  player: { u: 8.5, v: 15 },
  banker: { u: 8.5, v: 33 },
} as const;
/** El sabot y el descarte, en las puntas del lado del crupier. */
export const BACCARAT_SHOE = { u: 5, v: 43 } as const;
export const BACCARAT_DISCARD = { u: 4.5, v: 5 } as const;

// ---------- Dados (2x2 tiles = 32x32): el cubilete atrás y la grilla de apuestas delante ----------

export const DADOS_TOP_Z = 14;
export const DADOS_FELT = { u0: 1.5, v0: 1.5, u1: 30.5, v1: 30.5 } as const;
/** El cubilete de vidrio con los tres dados, en el rincón de atrás. */
export const DADOS_DOME = { u: 7, v: 7, r: 4.6, h: 5.5 } as const;

export const DADOS_CELLS: readonly MesaCell[] = (() => {
  const cells: MesaCell[] = [
    // Al lado del cubilete: chico, grande, par e impar (de la gente de atrás).
    cell("small", 2.5, 13, 7, 21.5, "blue", "CHICO"),
    cell("big", 2.5, 22, 7, 30, "red", "GRANDE"),
    cell("even", 7.5, 13, 12, 21.5, "felt", "PAR"),
    cell("odd", 7.5, 22, 12, 30, "felt", "IMPAR"),
    // Delante del cubilete, a lo ancho: cualquier trío.
    cell("triple", 12.5, 2.5, 17, 30, "gold", "TRIO 30:1"),
  ];
  // Las sumas en dos filas de 7 (de 4 a 10 y de 11 a 17).
  const w = (30 - 2.5) / 7;
  DADOS_TOTALS.forEach((t, i) => {
    const u0 = i < 7 ? 17.5 : 22;
    const col = i % 7;
    cells.push(cell(`t${t}`, u0, 2.5 + col * w, u0 + 4, 2.5 + (col + 1) * w, "felt", String(t)));
  });
  // Los seis números con sus puntos, en la fila de adelante.
  const dw = (30 - 2.5) / 6;
  for (let n = 1; n <= 6; n++) cells.push(cell(`d${n}`, 26.5, 2.5 + (n - 1) * dw, 30, 2.5 + n * dw, "dark", "", { pips: n }));
  return cells;
})();

// ---------- Carrera de caballitos (3x2 tiles = 48x32): seis carriles a lo largo de u ----------

export const RACE_TOP_Z = 12;
export const RACE_TRACK = { u0: 3, u1: 45, v0: 2.5, v1: 21.5 } as const;
/** Donde largan (el cajón) y la meta. */
export const RACE_START_U = 6.5;
export const RACE_FINISH_U = 41.5;
export const RACE_LANE_W = (RACE_TRACK.v1 - RACE_TRACK.v0) / HORSES.length;
/** Centro del carril de cada caballito. */
export const laneV = (horse: number) => RACE_TRACK.v0 + RACE_LANE_W * (horse + 0.5);
/** Dónde está un caballito que avanzó `p` (0 = largada, 1 = meta). */
export const horseU = (p: number) => RACE_START_U + (RACE_FINISH_U - RACE_START_U) * p;

export const RACE_CELLS: readonly MesaCell[] = HORSES.map((h, i) => {
  const u0 = 3 + i * 7;
  return cell(`h${i}`, u0 + 0.3, 23, u0 + 6.7, 30.5, i, String(i + 1), { label2: `X${h.returns}` });
});

// ---------- Comunes ----------

export const MESA_CELLS: Record<MesaId, readonly MesaCell[]> = { baccarat: BACCARAT_CELLS, dados: DADOS_CELLS, caballos: RACE_CELLS };
export const MESA_TOP_Z: Record<MesaId, number> = { baccarat: BACCARAT_TOP_Z, dados: DADOS_TOP_Z, caballos: RACE_TOP_Z };
/** El mueble de cada mesa. */
export const MESA_FURNITURE: Record<MesaId, string> = { baccarat: "baccarat-table", dados: "sicbo-table", caballos: "horse-race-table" };

/** Casilla bajo (u, v) en esa mesa, o null. */
export function mesaCellAt(table: MesaId, u: number, v: number): MesaCell | null {
  return MESA_CELLS[table].find((c) => insideMesaCell(c, u, v)) ?? null;
}

export const mesaCellOf = (table: MesaId, bet: string) => MESA_CELLS[table].find((c) => c.bet === bet);
