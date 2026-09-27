import { prisma } from "@hyvento/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { publishPointsChanged } from "@/lib/events";
import { GiftFailed, openGiftTx } from "@/lib/gifts";

/** Abrir un regalo del buzón: solo quien lo recibe y una sola vez. Responde el regalo y el saldo. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  try {
    const result = await prisma.$transaction((tx) => openGiftTx(tx, user.id, id));
    if (result.gift.points > 0) await publishPointsChanged(user.id);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof GiftFailed) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
