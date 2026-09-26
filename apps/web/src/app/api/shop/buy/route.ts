import { prisma } from "@hyvento/db";
import { ShopBuyBody } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { publishPointsChanged } from "@/lib/events";
import { buyTx, furnitureForSale, NotEnoughPoints } from "@/lib/shop-buy";

/** Comprar muebles en la tienda (de a varios). Responde el saldo y la mochila. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const parsed = ShopBuyBody.safeParse((await req.json().catch(() => null)) ?? {});
  const item = parsed.success ? furnitureForSale(parsed.data.itemId) : undefined;
  if (!parsed.success || !item) return NextResponse.json({ error: "Ese mueble no está en la tienda." }, { status: 400 });

  try {
    const result = await prisma.$transaction((tx) => buyTx(tx, user.id, item, parsed.data.quantity));
    await publishPointsChanged(user.id);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof NotEnoughPoints) return NextResponse.json({ error: err.message }, { status: 402 });
    throw err;
  }
}
