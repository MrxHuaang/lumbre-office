// Inventario: los muebles que cada persona tiene guardados (sin poner). La tienda suma; el editor de
// oficina resta al poner un mueble y suma al quitarlo.
import type { InventoryEntry } from "@hyvento/shared";
import type { Prisma } from "@prisma/client";

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
