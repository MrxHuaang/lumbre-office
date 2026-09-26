import "server-only";
// La compra en la tienda (la usa POST /api/shop/buy).
import { addInventoryTx, listInventory, spendPointsTx, type Prisma } from "@hyvento/db";
import { SHOP_FURNITURE, shopRefId, type InventoryEntry, type ShopItem } from "@hyvento/shared";

/** Mueble a la venta con ese id. La ropa es gratis (se cambia en el probador): no se vende. */
export function furnitureForSale(itemId: string): ShopItem | undefined {
  return SHOP_FURNITURE.find((i) => i.id === itemId);
}

/** No alcanzan los puntos: lanzado dentro de la transacción, deshace lo que ya se hizo. */
export class NotEnoughPoints extends Error {
  constructor() {
    super("No te alcanzan los puntos.");
  }
}

/**
 * Cobra con `spendPointsTx` (solo si alcanza) y guarda los muebles en la mochila. Va dentro de una
 * transacción: si lanza `NotEnoughPoints`, no se cobra ni se guarda nada.
 */
export async function buyTx(
  tx: Prisma.TransactionClient,
  userId: string,
  item: ShopItem,
  quantity: number,
): Promise<{ balance: number; inventory: InventoryEntry[] }> {
  const spent = await spendPointsTx(tx, { userId, amount: item.price * quantity, reason: "PURCHASE", refId: shopRefId(item.id) });
  if (!spent.ok) throw new NotEnoughPoints();
  await addInventoryTx(tx, userId, item.id, quantity);
  return { balance: spent.balance, inventory: await listInventory(tx, userId) };
}
