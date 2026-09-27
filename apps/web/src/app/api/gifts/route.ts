import { prisma } from "@hyvento/db";
import { GIFT, GiftCreateBody, type GiftsState } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { publishGiftSent, publishPointsChanged } from "@/lib/events";
import { GIFT_INCLUDE, GiftFailed, givenToday, sendGiftTx, toGiftDTO } from "@/lib/gifts";

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
 * conectado. Se cobra en la misma transacción en que se crea; llega a su buzón sin abrir.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("No autenticado", 401);
  const parsed = GiftCreateBody.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Regalo inválido");
  const body = parsed.data;
  if (body.toId === user.id) return fail("No puedes regalarte a ti.");
  // Solo a quien ya entró alguna vez (como la lista de /recipients).
  const to = await prisma.user.findFirst({ where: { id: body.toId, onboardedAt: { not: null } }, select: { id: true } });
  if (!to) return fail("Esa persona no está en el equipo.", 404);

  // El tope del día se revisa dentro de la transacción (sendGiftTx), con la fila de quien regala bloqueada.
  try {
    const result = await prisma.$transaction((tx) => sendGiftTx(tx, user.id, body));
    if (body.points > 0) await publishPointsChanged(user.id);
    await publishGiftSent({ toId: body.toId, fromName: user.name || "Alguien", points: body.points, itemId: body.itemId, quantity: body.quantity });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof GiftFailed) return fail(err.message, err.status);
    throw err;
  }
}
