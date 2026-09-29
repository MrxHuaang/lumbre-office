// Cuadros de la app Pintura: la fila guarda los píxeles y el cuadro vive en la mochila como el mueble
// `cuadro:<id>` (lo pone y lo guarda el editor de oficina, como cualquier mueble). Las reglas (tope,
// lienzo válido, quién borra) están en @hyvento/shared (painting-service.ts).
import { paintingItemId, type PaintingRecord } from "@hyvento/shared";
import type { PrismaClient } from "@prisma/client";
import { addInventoryTx, takeInventoryTx } from "./inventory";

const SELECT = { id: true, userId: true, title: true, pixels: true, createdAt: true, user: { select: { name: true, email: true } } } as const;

type Row = { id: string; userId: string; title: string; pixels: string; createdAt: Date; user: { name: string | null; email: string } };
const toRecord = (r: Row): PaintingRecord => ({
  id: r.id,
  userId: r.userId,
  authorName: r.user.name || r.user.email,
  title: r.title,
  pixels: r.pixels,
  createdAt: r.createdAt,
});

/** Guarda un cuadro y lo deja en la mochila, si no pasó el tope de cuadros de esa persona. */
export async function createPainting(
  client: PrismaClient,
  input: { userId: string; title: string; pixels: string },
  rules: { max: number },
): Promise<PaintingRecord | "limit"> {
  return client.$transaction(async (tx) => {
    // Se bloquea la fila de quien pinta: dos guardados a la vez no se saltan el tope.
    await tx.$executeRaw`SELECT 1 FROM "User" WHERE id = ${input.userId} FOR UPDATE`;
    if ((await tx.painting.count({ where: { userId: input.userId } })) >= rules.max) return "limit" as const;
    const row = await tx.painting.create({ data: input, select: SELECT });
    await addInventoryTx(tx, input.userId, paintingItemId(row.id), 1);
    return toRecord(row);
  });
}

/** Los cuadros de alguien, más nuevos primero, y si cada uno está en la mochila (o colgado). */
export async function listPaintings(client: PrismaClient, userId: string): Promise<(PaintingRecord & { inBackpack: boolean })[]> {
  const [rows, inv] = await Promise.all([
    client.painting.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: SELECT }),
    client.inventoryItem.findMany({ where: { userId, itemId: { startsWith: paintingItemId("") }, quantity: { gt: 0 } }, select: { itemId: true } }),
  ]);
  const inBag = new Set(inv.map((i) => i.itemId));
  return rows.map((r) => ({ ...toRecord(r), inBackpack: inBag.has(paintingItemId(r.id)) }));
}

export async function findPainting(client: PrismaClient, id: string): Promise<PaintingRecord | null> {
  const row = await client.painting.findUnique({ where: { id }, select: SELECT });
  return row ? toRecord(row) : null;
}

/** Borra un cuadro propio que está en la mochila; si está colgado ("hung") no se toca. */
export async function removePaintingFromBackpack(client: PrismaClient, userId: string, id: string): Promise<"ok" | "not-found" | "hung"> {
  return client.$transaction(async (tx) => {
    const row = await tx.painting.findFirst({ where: { id, userId }, select: { id: true } });
    if (!row) return "not-found" as const;
    // Sacarlo de la mochila es condicional: si justo lo estaban colgando, gana el que llegó primero.
    if (!(await takeInventoryTx(tx, userId, paintingItemId(id)))) return "hung" as const;
    await tx.inventoryItem.deleteMany({ where: { userId, itemId: paintingItemId(id), quantity: { lte: 0 } } });
    await tx.painting.delete({ where: { id } });
    return "ok" as const;
  });
}
