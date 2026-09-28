// El acuario de la sala: el álbum de pesca de todo el equipo, por especie, con quién sacó cada una.
import { AQUARIUM, type TeamFishEntry } from "@hyvento/shared";
import type { PrismaClient } from "@prisma/client";

export async function teamFishAlbum(client: PrismaClient): Promise<TeamFishEntry[]> {
  const rows = await client.fishCatch.groupBy({
    by: ["species", "userId"],
    _count: { _all: true },
    _max: { size: true, caughtAt: true },
  });
  if (rows.length === 0) return [];
  const users = await client.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, name: true } });
  const names = new Map(users.map((u) => [u.id, u.name || "Alguien"]));
  const bySpecies = new Map<string, typeof rows>();
  for (const r of rows) bySpecies.set(r.species, [...(bySpecies.get(r.species) ?? []), r]);
  return [...bySpecies].map(([species, list]) => {
    const byCount = [...list].sort((a, b) => b._count._all - a._count._all);
    const best = list.reduce((a, b) => ((b._max.size ?? 0) > (a._max.size ?? 0) ? b : a));
    const last = Math.max(...list.map((r) => (r._max.caughtAt ?? new Date(0)).getTime()));
    return {
      species,
      count: list.reduce((n, r) => n + r._count._all, 0),
      best: best._max.size ?? 0,
      bestBy: names.get(best.userId) ?? "Alguien",
      catchers: byCount.slice(0, AQUARIUM.catchersShown).map((r) => ({ name: names.get(r.userId) ?? "Alguien", count: r._count._all })),
      people: list.length,
      lastAt: new Date(last).toISOString(),
    };
  });
}
