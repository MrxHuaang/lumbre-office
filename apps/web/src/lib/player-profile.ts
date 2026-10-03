import "server-only";
// El perfil público de una persona del equipo: personaje, oficina, puntos, estadísticas graciosas,
// título y logros. Lo usan GET /api/profile/[id] (el perfil dentro de la cabaña) y la página /perfil/[id].
import { achievementCounts, loadAchievementRecord, loadSkills, prisma } from "@hyvento/db";
import { allZones, getWorld } from "@hyvento/map";
import {
  OFICIOS,
  levelOf,
  neighborLevel,
  ACHIEVEMENTS,
  CASA_PROPIA,
  FISH,
  STAT_PREFIX,
  achievementProgress,
  profileTitle,
  topByPrefix,
  type ProfileDTO,
} from "@hyvento/shared";
import { asLook } from "./current-user";

const TRASH = FISH.filter((f) => f.rarity === "basura").map((f) => f.id);

/** Nombres de niveles y zonas (para "nivel favorito" y "zona favorita"). */
function placeNames() {
  const world = getWorld();
  const areas = new Map([...world.areas.values()].map((a) => [a.id, a.name]));
  // Todas las casas de cada persona cuentan como un solo nivel (`casa-propia`).
  areas.set(CASA_PROPIA.statArea, "Su casa");
  const zones = new Map(allZones(world).map((z) => [z.id, z.name]));
  return { areas, zones };
}

/** null = no existe esa persona. `viewerId` marca si es el propio perfil. */
export async function loadPlayerProfile(userId: string, viewerId: string): Promise<ProfileDTO | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      look: true,
      status: true,
      points: true,
      streak: true,
      createdAt: true,
      office: { select: { name: true } },
    },
  });
  if (!user) return null;
  const [record, counts, teamSize, bestFish, casino, skills] = await Promise.all([
    loadAchievementRecord(prisma, userId),
    achievementCounts(prisma),
    prisma.user.count(),
    prisma.fishCatch.findFirst({ where: { userId, species: { notIn: TRASH } }, orderBy: { size: "desc" }, select: { species: true, size: true } }),
    prisma.pointTransaction.aggregate({ where: { userId, reason: "CASINO" }, _sum: { amount: true } }),
    // La primera vez también calcula la experiencia de los veteranos (oficios.ts).
    loadSkills(prisma, userId),
  ]);
  const oficios = Object.fromEntries(OFICIOS.map((o) => [o, { xp: skills.xp[o], level: levelOf(skills.xp[o]) }]));
  // Los marcadores internos (qué día ya contó para madrugador) no son estadísticas.
  const stats = Object.fromEntries(Object.entries(record.stats).filter(([k]) => !k.startsWith(STAT_PREFIX.lastDay)));
  const names = placeNames();
  const area = topByPrefix(stats, STAT_PREFIX.secArea);
  const zone = topByPrefix(stats, STAT_PREFIX.secZone);
  return {
    oficios,
    neighborLevel: neighborLevel(Object.fromEntries(OFICIOS.map((o) => [o, oficios[o]!.level]))),
    id: user.id,
    // Como en la cabaña: sin nombre visible, el correo (antes del onboarding).
    name: user.name || user.email.split("@")[0]!,
    avatar: user.avatar,
    look: asLook(user.look),
    status: user.status.toLowerCase(),
    officeName: user.office?.name ?? null,
    points: user.points,
    streak: user.streak,
    memberSince: user.createdAt.toISOString(),
    title: profileTitle(stats),
    stats,
    bestFish: bestFish ?? null,
    casinoNet: casino._sum.amount ?? 0,
    favoriteArea: area ? (names.areas.get(area.id) ?? null) : null,
    favoriteZone: zone ? (names.zones.get(zone.id) ?? null) : null,
    achievements: ACHIEVEMENTS.map((a) => ({
      id: a.id,
      unlockedAt: record.unlocked[a.id]?.toISOString() ?? null,
      progress: record.unlocked[a.id] ? 1 : achievementProgress(a, stats),
      owners: counts[a.id] ?? 0,
    })),
    teamSize,
    isMe: user.id === viewerId,
  };
}
