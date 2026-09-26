// Economía de puntos (fase 2): cuánto se gana, los topes y qué cuenta como "hoy". Lo usan el
// servidor de juego, la web y la base de datos, para que las reglas estén en un solo lugar.
import { z } from "zod";

/** Motivo de un movimiento de puntos (mismo nombre que el enum PointReason de Prisma). `PURCHASE` es un gasto (monto negativo). */
export const POINT_REASONS = ["PRESENCE", "MEETING", "DAILY", "MISSION", "ADMIN", "PURCHASE", "CASINO"] as const;
export type PointReason = (typeof POINT_REASONS)[number];

export const POINTS = {
  /** Cada cuánto se reparten los puntos de presencia. */
  tickMs: 5 * 60_000,
  /** Sin actividad (mouse, teclado, moverse) en este tiempo, ya no cuenta como presente. */
  idleMs: 5 * 60_000,
  presence: 1,
  /** Tope diario de presencia: 8 horas activas. */
  presenceDailyCap: 96,
  /** Extra por estar en la sala de reuniones con alguien más. */
  meeting: 1,
  meetingDailyCap: 24,
  /** Recompensa diaria del buzón: base + extra por racha (hasta `dailyStreakMaxDays` días seguidos). */
  dailyBase: 10,
  dailyStreakBonus: 5,
  dailyStreakMaxDays: 7,
  /** Recompensa máxima de una misión según quién la crea. */
  missionMaxReward: { MEMBER: 50, ADMIN: 500 },
  missionMinReward: 5,
  /** Ranking: puntos ganados en los últimos N días. */
  rankingDays: 7,
} as const;

/** Tope diario por motivo (null = sin tope). */
export const DAILY_CAPS: Record<PointReason, number | null> = {
  PRESENCE: POINTS.presenceDailyCap,
  MEETING: POINTS.meetingDailyCap,
  DAILY: null,
  MISSION: null,
  ADMIN: null,
  PURCHASE: null,
  CASINO: null,
};

// El equipo está en Colombia (UTC-5, sin horario de verano): los días cambian a la medianoche de Bogotá.
const OFFSET_MS = -5 * 3_600_000;
const DAY_MS = 86_400_000;

/** Inicio (en ms UTC) del día de Bogotá que contiene `ts`. */
export function dayStart(ts: number): number {
  return Math.floor((ts + OFFSET_MS) / DAY_MS) * DAY_MS - OFFSET_MS;
}

/** Racha del buzón al reclamar hoy: sigue si el último reclamo fue ayer, vuelve a 1 si no. */
export function nextStreak(lastClaim: Date | null, streak: number, now = Date.now()): number {
  if (!lastClaim) return 1;
  const days = Math.round((dayStart(now) - dayStart(lastClaim.getTime())) / DAY_MS);
  if (days <= 0) return streak;
  return days === 1 ? streak + 1 : 1;
}

/** ¿Ya reclamó la recompensa del buzón hoy? */
export function claimedToday(lastClaim: Date | null, now = Date.now()): boolean {
  return lastClaim !== null && dayStart(lastClaim.getTime()) === dayStart(now);
}

/** Puntos de la recompensa diaria para una racha dada. */
export function dailyReward(streak: number): number {
  return POINTS.dailyBase + POINTS.dailyStreakBonus * (Math.min(streak, POINTS.dailyStreakMaxDays) - 1);
}

// ---------- Mensajes ----------

/** Cliente → servidor: hubo actividad (mouse/teclado). Se manda como mucho una vez por minuto. */
export const ACTIVITY_PING_MS = 60_000;

/** Servidor → cliente: ganaste puntos (para el "+N" sobre el personaje y el contador). */
export interface PointsAwarded {
  amount: number;
  reason: PointReason;
  balance: number;
}

// ---------- Misiones ----------

export const MISSION_STATUSES = ["OPEN", "TAKEN", "REVIEW", "DONE", "CANCELLED"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const MissionCreate = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(500).default(""),
  reward: z.number().int().min(POINTS.missionMinReward).max(POINTS.missionMaxReward.ADMIN),
});
export type MissionCreate = z.infer<typeof MissionCreate>;

export const MISSION_ACTIONS = ["take", "release", "submit", "approve", "reject", "cancel"] as const;
export type MissionAction = (typeof MISSION_ACTIONS)[number];

export interface MissionDTO {
  id: string;
  title: string;
  description: string;
  reward: number;
  status: MissionStatus;
  createdBy: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  createdAt: string;
  completedAt: string | null;
}
