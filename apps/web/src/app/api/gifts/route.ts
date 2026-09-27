import { prisma } from "@hyvento/db";
import { GIFT, type GiftsState } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { GIFT_INCLUDE, giftNotify, givenToday, postGift, toGiftDTO } from "@/lib/gifts";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** El buzón de regalos: lo recibido (sin abrir primero), lo enviado y lo que ya mandaste hoy. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("No autenticado", 401);
  const [unopened, received, sent, today] = await Promise.all([
    prisma.gift.count({ where: { toId: user.id, openedAt: null } }),
    prisma.gift.findMany({
      where: { toId: user.id },
      orderBy: [{ openedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      take: GIFT.historySize,
      include: GIFT_INCLUDE,
    }),
    prisma.gift.findMany({ where: { fromId: user.id }, orderBy: { createdAt: "desc" }, take: GIFT.historySize, include: GIFT_INCLUDE }),
    givenToday(prisma, user.id),
  ]);
  const body: GiftsState = { unopened, received: received.map(toGiftDTO), sent: sent.map(toGiftDTO), today };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Mandar un regalo (puntos y/o un objeto de la mochila, con nota) a alguien del equipo, esté o no
 * conectado. La lógica (y sus tests) está en `lib/gift-service.ts`.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("No autenticado", 401);
  const reply = await postGift(prisma, user, await req.json().catch(() => null), giftNotify);
  return NextResponse.json(reply.body, { status: reply.status, headers: { "Cache-Control": "no-store" } });
}
