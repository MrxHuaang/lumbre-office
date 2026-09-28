// Logros a la vista: la insignia destacada que cada persona lleva junto a su nombre y la vitrina de
// trofeos de las oficinas. Se construye encima del catálogo de achievements.ts (sin tocarlo).
import { z } from "zod";
import { achievementById, type AchievementRarity } from "./achievements";

/** Lo que manda la web al elegir la insignia destacada (null = ninguna). */
export const FeaturedBadgeUpdate = z.object({ achievementId: z.string().min(1).max(40).nullable() });
export type FeaturedBadgeUpdate = z.infer<typeof FeaturedBadgeUpdate>;

/**
 * La insignia que se puede mostrar: un logro del catálogo que la persona ya desbloqueó, o "" (ninguna).
 * El servidor lo revisa con lo que sabe de sus logros; la web, con la base, antes de guardar.
 */
export function validFeaturedBadge(achievementId: string | null | undefined, unlocked: ReadonlySet<string> | readonly string[]): string {
  if (!achievementId || !achievementById(achievementId)) return "";
  const have = unlocked instanceof Set ? unlocked : new Set(unlocked as readonly string[]);
  return have.has(achievementId) ? achievementId : "";
}

/** GET /api/trophies: cuántos logros tiene el dueño de cada oficina (para dibujar los trofeos de su vitrina). */
export interface TrophyCaseDTO {
  zoneId: string;
  ownerId: string;
  ownerName: string;
  count: number;
  /** Cuántos de cada rareza (cada uno es un trofeo distinto en la vitrina). */
  rarities: Record<AchievementRarity, number>;
}

/** Cuántos logros de cada rareza hay en una lista de ids (los que no están en el catálogo no cuentan). */
export function rarityCounts(ids: readonly string[]): Record<AchievementRarity, number> {
  const out: Record<AchievementRarity, number> = { comun: 0, raro: 0, epico: 0, legendario: 0 };
  for (const id of ids) {
    const a = achievementById(id);
    if (a) out[a.rarity]++;
  }
  return out;
}
