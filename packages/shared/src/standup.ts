// Standup diario en el tablón del jardín: cada persona escribe qué hará hoy (uno por día de Bogotá, que se
// puede editar) y todos ven los de hoy. El primero del día da un bono chico (`POINTS.standupBonus`); editarlo
// no vuelve a dar. Sin Next ni Prisma, para probarlo con un almacén en memoria: la ruta
// (apps/web/src/app/api/standup) lee la petición y llama acá. "Mi día" (VIR-120) reusa lo mismo.
import { z } from "zod";
import type { Look } from "./look";
import { POINTS } from "./points";
import type { HumanAvatar } from "./protocol";

export const STANDUP = {
  /** Largo máximo del texto. */
  maxLength: 280,
} as const;

/** Día de Bogotá (UTC-5, sin horario de verano) como "AAAA-MM-DD": la clave del standup. */
export function standupDay(ts: number): string {
  return new Date(ts - 5 * 3_600_000).toISOString().slice(0, 10);
}

/** `refId` del bono del standup de un día (motivo DAILY): marca que ese día ya se pagó. */
export const standupRef = (day: string) => `standup:${day}`;

/** Cuerpo de PUT /api/standup. */
export const StandupInput = z.object({ text: z.string().max(STANDUP.maxLength * 2) });

/**
 * El texto como se guarda: sin espacios de sobra en cada renglón, a lo sumo un renglón vacío seguido y
 * cortado al largo máximo. "" = no hay nada que guardar.
 */
export function cleanStandup(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, STANDUP.maxLength)
    .trim();
}

/** Un standup guardado, con el nombre y el personaje de quien lo escribió. */
export interface StandupRecord {
  userId: string;
  name: string;
  avatar: HumanAvatar;
  look: Look | null;
  day: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Dónde se guardan (Prisma en la web, packages/db/src/standup.ts; en memoria en los tests). */
export interface StandupStore {
  /**
   * Crea o reemplaza el standup de `userId` en `day`. Solo si lo creó (el primero del día) paga `bonus`
   * con awardPoints, una sola vez por `bonus.refId`, todo en la misma transacción.
   */
  save(input: { userId: string; day: string; text: string; bonus: { amount: number; refId: string } }): Promise<{ created: boolean; awarded: number }>;
  /** Los standups de un día, del más viejo al más nuevo. */
  listDay(day: string): Promise<StandupRecord[]>;
}

/** Un standup como lo ve el tablón (GET /api/standup). */
export interface StandupDTO {
  userId: string;
  name: string;
  avatar: HumanAvatar;
  look: Look | null;
  text: string;
  mine: boolean;
  createdAt: string;
  edited: boolean;
}

export interface StandupBoard {
  day: string;
  /** Lo que da el primero del día (para mostrarlo antes de escribir). */
  bonus: number;
  standups: StandupDTO[];
}

export type StandupError = "auth" | "invalid" | "empty";

export const STANDUP_ERROR: Record<StandupError, { status: number; text: string }> = {
  auth: { status: 401, text: "No autenticado" },
  invalid: { status: 400, text: "No se entendió el standup." },
  empty: { status: 400, text: "Escribe qué harás hoy antes de publicarlo." },
};

export type StandupResult<T> = { ok: true; value: T } | { ok: false; error: StandupError };

const toDTO = (r: StandupRecord, me: string): StandupDTO => ({
  userId: r.userId,
  name: r.name,
  avatar: r.avatar,
  look: r.look,
  text: r.text,
  mine: r.userId === me,
  createdAt: r.createdAt.toISOString(),
  // Un segundo de gracia: crear escribe las dos fechas casi a la vez.
  edited: r.updatedAt.getTime() - r.createdAt.getTime() > 1000,
});

/** Los standups de hoy (el tuyo primero, después del más viejo al más nuevo). */
export async function standupBoardFor(store: StandupStore, user: { id: string } | null, now = Date.now()): Promise<StandupResult<StandupBoard>> {
  if (!user) return { ok: false, error: "auth" };
  const day = standupDay(now);
  const rows = await store.listDay(day);
  const standups = rows.map((r) => toDTO(r, user.id)).sort((a, b) => Number(b.mine) - Number(a.mine));
  return { ok: true, value: { day, bonus: POINTS.standupBonus, standups } };
}

/** Escribir o editar el standup de hoy. `awarded` = puntos del bono (0 si ya lo tenía hoy). */
export async function saveStandup(
  store: StandupStore,
  user: { id: string } | null,
  body: unknown,
  now = Date.now(),
): Promise<StandupResult<{ day: string; text: string; created: boolean; awarded: number }>> {
  if (!user) return { ok: false, error: "auth" };
  const parsed = StandupInput.safeParse(body);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const text = cleanStandup(parsed.data.text);
  if (!text) return { ok: false, error: "empty" };
  const day = standupDay(now);
  const { created, awarded } = await store.save({ userId: user.id, day, text, bonus: { amount: POINTS.standupBonus, refId: standupRef(day) } });
  return { ok: true, value: { day, text, created, awarded } };
}
