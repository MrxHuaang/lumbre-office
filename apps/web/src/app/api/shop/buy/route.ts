import { loadSkillLevels, prisma } from "@hyvento/db";
import { SHOP_MAX_QUANTITY, ShopBuyBody, canBuyExclusive, unlockText } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { publishPointsChanged } from "@/lib/events";
import { buyTx, furnitureForSale, NotEnoughPoints } from "@/lib/shop-buy";

/**
 * Comprar muebles en la tienda (de a varios). Responde el saldo y la mochila. La ropa es gratis (se
 * cambia en el probador) y responde 400. La cercanía al mostrador solo la controla el cliente, como el
 * buzón: la web no conoce la posición del jugador (se cobra el precio completo desde cualquier lado).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const parsed = ShopBuyBody.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: `Pedido inválido: elige un mueble y de 1 a ${SHOP_MAX_QUANTITY} unidades.` }, { status: 400 });
  }
  const item = furnitureForSale(parsed.data.itemId);
  if (!item) return NextResponse.json({ error: "Ese mueble no está en la tienda." }, { status: 400 });
  // Los exclusivos de los oficios se venden desde su nivel.
  if (item.requires && !canBuyExclusive(item, await loadSkillLevels(prisma, user.id))) {
    return NextResponse.json({ error: `Ese mueble es de ${unlockText(item.requires)}.` }, { status: 403 });
  }

  try {
    const result = await prisma.$transaction((tx) => buyTx(tx, user.id, item, parsed.data.quantity));
    await publishPointsChanged(user.id);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof NotEnoughPoints) return NextResponse.json({ error: err.message }, { status: 402 });
    throw err;
  }
}
