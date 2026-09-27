// Pesca (fase 5): cada pez atrapado queda en FishCatch y sus puntos entran con awardPointsTx (motivo
// LEISURE, con su tope diario), en la misma transacción. El álbum sale de agrupar por especie.
import type { FishAlbumEntry } from "@hyvento/shared";
import type { PrismaClient } from "@prisma/client";
import { awardPointsTx } from "./points";

export interface FishCatchInput {
  userId: string;
  species: string;
  /** Centímetros (ya sorteados por el servidor de juego). */
  size: number;
  /** Puntos a sumar (0 = solo se guarda la captura). */
  points: number;
  now?: number;
}

export interface FishCatchSaved {
  /** El más grande de esa especie antes de esta captura (null = es la primera). */
  previousBest: number | null;
  /** Lo que se sumó de verdad (menos si se llegó al tope diario) y el saldo. */
  awarded: number;
  balance: number;
}

export function recordFishCatch(client: PrismaClient, input: FishCatchInput): Promise<FishCatchSaved> {
  const { userId, species, size, points } = input;
  const now = input.now ?? Date.now();
  return client.$transaction(async (tx) => {
    const before = await tx.fishCatch.aggregate({ where: { userId, species }, _max: { size: true } });
    await tx.fishCatch.create({ data: { userId, species, size, caughtAt: new Date(now) } });
    const award =
      points > 0
        ? await awardPointsTx(tx, { userId, amount: points, reason: "LEISURE", refId: `fish:${species}`, now })
        : { awarded: 0, balance: (await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } })).points };
    return { previousBest: before._max.size ?? null, awarded: award.awarded, balance: award.balance };
  });
}

/** El álbum de pesca de alguien: por especie, cuántas veces, el más grande y la última vez. */
export async function fishAlbum(client: PrismaClient, userId: string): Promise<FishAlbumEntry[]> {
  const rows = await client.fishCatch.groupBy({
    by: ["species"],
    where: { userId },
    _count: { _all: true },
    _max: { size: true, caughtAt: true },
  });
  return rows.map((r) => ({
    species: r.species,
    count: r._count._all,
    best: r._max.size ?? 0,
    lastAt: (r._max.caughtAt ?? new Date(0)).toISOString(),
  }));
}
