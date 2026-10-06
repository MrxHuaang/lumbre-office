import { prisma } from "@hyvento/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { giftNotify, postOpenGift } from "@/lib/gifts";

/** Abrir un regalo del buzón: solo quien lo recibe y una sola vez. Responde el regalo y el saldo. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const { id } = await params;
  const reply = await postOpenGift(prisma, user.id, id, giftNotify);
  return NextResponse.json(reply.body, { status: reply.status, headers: { "Cache-Control": "no-store" } });
}
