// Pizarras compartidas: una por oficina y otra en la sala de reuniones. Los que están en la sala dibujan
// a la vez (el servidor reparte cada trazo a quienes la tienen abierta) y queda guardada en la base.
// Las coordenadas van en una grilla fija de BOARD.width x BOARD.height, así se ve igual en toda pantalla.
import { z } from "zod";

export const BOARD_COLORS = ["#2b2233", "#d93a2b", "#3a6fb0", "#4f8a3c", "#e0923e", "#7a4bb0"] as const;
/** El borrador pinta con el color del fondo (es un trazo más: se deshace igual que los otros). */
export const BOARD_ERASER = "eraser";
export const BOARD_BACKGROUND = "#fbf7ea";
export const BOARD_WIDTHS = [3, 7, 16] as const;

export const BOARD = {
  width: 1000,
  height: 620,
  /** Puntos de un trazo (x e y cuentan como dos) y trazos que guarda cada pizarra. */
  maxPoints: 1200,
  maxStrokes: 600,
  /** Tope de puntos de toda la pizarra: si se pasa, se van los trazos más viejos. */
  maxTotalPoints: 120_000,
  /** Pausa mínima entre dos trazos de la misma persona (un trazo es un gesto completo). */
  strokeCooldownMs: 60,
  /** Tiempo sin cambios antes de guardar en la base. */
  saveDelayMs: 4000,
} as const;

/** Tipos de zona que tienen pizarra. */
export const BOARD_ZONE_TYPES: readonly string[] = ["office", "meeting"];

const coord = z.number().int().min(0).max(BOARD.width);

export const BoardStrokeInput = z
  .object({
    color: z.enum([...BOARD_COLORS, BOARD_ERASER]),
    width: z.union([z.literal(BOARD_WIDTHS[0]), z.literal(BOARD_WIDTHS[1]), z.literal(BOARD_WIDTHS[2])]),
    /** [x0, y0, x1, y1, …] */
    points: z.array(coord).min(2).max(BOARD.maxPoints),
  })
  .refine((s) => s.points.length % 2 === 0, "puntos incompletos")
  .refine((s) => s.points.every((v, i) => i % 2 === 0 || v <= BOARD.height), "fuera de la pizarra");
export type BoardStrokeInput = z.infer<typeof BoardStrokeInput>;

/** Un trazo guardado: quién lo hizo (para deshacer los propios) y con qué. */
export interface BoardStroke extends BoardStrokeInput {
  id: string;
  by: string;
}

const board = z.string().min(1).max(40);

/** Cliente → servidor: abrir la pizarra de la sala donde estoy (`MSG.boardOpen`) o cerrarla (`boardClose`). */
export const BoardOpenMessage = z.object({ board });
/** Cliente → servidor (`MSG.boardStroke`): un trazo terminado. */
export const BoardStrokeMessage = z.object({ board, stroke: BoardStrokeInput });
/** Cliente → servidor: deshacer mi último trazo (`boardUndo`) o borrar toda la pizarra (`boardClear`). */
export const BoardActionMessage = z.object({ board });

/** Servidor → cliente: la pizarra entera al abrirla. */
export interface BoardStateEvent {
  board: string;
  strokes: BoardStroke[];
  /** ¿Puedo borrarla entera? (el dueño de la oficina; en la sala de reuniones, cualquiera). */
  canClear: boolean;
}
/** Servidor → los que la tienen abierta: un trazo nuevo. */
export interface BoardStrokeEvent {
  board: string;
  stroke: BoardStroke;
}
/** Servidor → los que la tienen abierta: trazos que se fueron (deshacer) o todos (borrar). */
export interface BoardRemoveEvent {
  board: string;
  ids: string[] | "all";
}

/**
 * Agrega un trazo a la lista respetando los topes (se van los más viejos). Devuelve los ids que se
 * cayeron por el tope, para avisar a los clientes.
 */
export function addStroke(list: BoardStroke[], stroke: BoardStroke): string[] {
  list.push(stroke);
  const dropped: string[] = [];
  let total = list.reduce((n, s) => n + s.points.length, 0);
  while (list.length > 1 && (list.length > BOARD.maxStrokes || total > BOARD.maxTotalPoints)) {
    const old = list.shift()!;
    total -= old.points.length;
    dropped.push(old.id);
  }
  return dropped;
}

/** Lee trazos guardados (de la base) descartando lo que no tenga forma de trazo. */
export function parseStoredStrokes(raw: unknown): BoardStroke[] {
  if (!Array.isArray(raw)) return [];
  const out: BoardStroke[] = [];
  for (const item of raw) {
    const s = BoardStrokeInput.safeParse(item);
    const meta = item as { id?: unknown; by?: unknown };
    if (s.success && typeof meta.id === "string" && typeof meta.by === "string") out.push({ ...s.data, id: meta.id, by: meta.by });
  }
  return out;
}
