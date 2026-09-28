// Inventario (la mochila): los muebles guardados (sin poner) y lo que se agarra (`obj:<id>`, ver bolsa.ts
// de @hyvento/shared). La tienda suma muebles; el editor de oficina resta al poner uno y suma al quitarlo;
// el servidor de juego suma y resta los objetos (pedidos, cosechas, lo que se come).
import { BAG_SLOT_PREFIX, type InventoryEntry } from "@hyvento/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

// PrismaClient también sirve aquí: es un TransactionClient con más métodos.
type Db = Prisma.TransactionClient;

function assertQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Cantidad inválida: ${quantity}`);
}

/** Suma unidades de un artículo (crea la fila si no existía). Devuelve cuántas tiene ahora. */
export async function addInventoryTx(tx: Db, userId: string, itemId: string, quantity: number): Promise<number> {
  assertQuantity(quantity);
  const row = await tx.inventoryItem.upsert({
    where: { userId_itemId: { userId, itemId } },
    create: { userId, itemId, quantity },
    update: { quantity: { increment: quantity } },
    select: { quantity: true },
  });
  return row.quantity;
}

/**
 * Saca unidades solo si alcanzan (update condicional, como gastar puntos): `false` = no tenía tantas y
 * no se tocó nada. Para poner un mueble de la mochila en la oficina.
 */
export async function takeInventoryTx(tx: Db, userId: string, itemId: string, quantity = 1): Promise<boolean> {
  assertQuantity(quantity);
  const taken = await tx.inventoryItem.updateMany({
    where: { userId, itemId, quantity: { gte: quantity } },
    data: { quantity: { decrement: quantity } },
  });
  return taken.count > 0;
}

/** Lo que tiene alguien (solo lo que tiene al menos una unidad), ordenado por id. */
export function listInventory(client: Db, userId: string): Promise<InventoryEntry[]> {
  return client.inventoryItem.findMany({
    where: { userId, quantity: { gt: 0 } },
    select: { itemId: true, quantity: true },
    orderBy: { itemId: "asc" },
  });
}

// ---------- Casillas de la mochila ----------
// El orden de la mochila (qué va en cada una de las 36 casillas) se guarda en UserStat con la clave
// `bolsa:<itemId>` y la casilla como valor: así no hace falta una columna nueva en InventoryItem.

/** La casilla guardada de cada cosa de la mochila (itemId → 0..35). */
export async function loadBagSlots(client: Db, userId: string): Promise<Record<string, number>> {
  const rows = await client.userStat.findMany({ where: { userId, key: { startsWith: BAG_SLOT_PREFIX } }, select: { key: true, value: true } });
  return Object.fromEntries(rows.map((r) => [r.key.slice(BAG_SLOT_PREFIX.length), r.value]));
}

/** Guarda casillas nuevas o movidas y olvida las de lo que ya no está (`null`), todo junto. */
export async function saveBagSlots(client: PrismaClient, userId: string, changes: Record<string, number | null>): Promise<void> {
  const entries = Object.entries(changes);
  if (entries.length === 0) return;
  await client.$transaction(
    entries.map(([itemId, slot]) => {
      const key = `${BAG_SLOT_PREFIX}${itemId}`;
      return slot === null
        ? client.userStat.deleteMany({ where: { userId, key } })
        : client.userStat.upsert({ where: { userId_key: { userId, key } }, create: { userId, key, value: slot }, update: { value: slot } });
    }),
  );
}
