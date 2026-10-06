import { prisma, spendPointsTx } from "@hyvento/db";
import { MissionCreate, POINTS } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { publishPointsChanged } from "@/lib/events";
import { MISSION_INCLUDE, toMissionDTO } from "@/lib/points";

/** El tablón: misiones abiertas, tomadas y por revisar, más las últimas terminadas. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const [active, done] = await Promise.all([
    prisma.mission.findMany({
      where: { status: { in: ["OPEN", "TAKEN", "REVIEW"] } },
      orderBy: { createdAt: "desc" },
      include: MISSION_INCLUDE,
    }),
    prisma.mission.findMany({ where: { status: "DONE" }, orderBy: { completedAt: "desc" }, take: 8, include: MISSION_INCLUDE }),
  ]);
  return NextResponse.json(
    { missions: [...active, ...done].map(toMissionDTO), me: user.id, isAdmin: user.role === "ADMIN" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Publicar una misión. La recompensa máxima depende del rol y sale del saldo de quien la publica (queda
 * en depósito hasta que se aprueba, y se devuelve si se cancela): así no se pueden fabricar puntos.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const parsed = MissionCreate.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Revisa el título (3 a 80 letras) y la recompensa" }, { status: 400 });
  const max = POINTS.missionMaxReward[user.role];
  if (parsed.data.reward > max) {
    return NextResponse.json({ error: `La recompensa máxima es de ${max} puntos` }, { status: 400 });
  }
  const mission = await prisma
    .$transaction(async (tx) => {
      const created = await tx.mission.create({ data: { ...parsed.data, createdById: user.id }, include: MISSION_INCLUDE });
      const deposit = await spendPointsTx(tx, { userId: user.id, amount: created.reward, reason: "MISSION", refId: created.id });
      if (!deposit.ok) throw new NoFunds();
      return created;
    })
    .catch((err) => {
      if (err instanceof NoFunds) return null;
      throw err;
    });
  if (!mission) return NextResponse.json({ error: "No te alcanzan los puntos para esa recompensa" }, { status: 402 });
  await publishPointsChanged(user.id);
  return NextResponse.json({ mission: toMissionDTO(mission) }, { status: 201 });
}

/** Para deshacer la transacción (y la misión creada) si no alcanza el depósito. */
class NoFunds extends Error {}
