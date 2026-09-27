import { awardPointsTx, bumpStat, prisma, type MissionStatus, type Prisma } from "@hyvento/db";
import { MISSION_ACTIONS, missionRefundRef, STAT_KEYS, type MissionAction } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/current-user";
import { publishPointsChanged } from "@/lib/events";
import { MISSION_INCLUDE, toMissionDTO } from "@/lib/points";

const Body = z.object({ action: z.enum(MISSION_ACTIONS) });

const fail = (error: string, status = 409) => NextResponse.json({ error }, { status });

/**
 * Cambiar el estado de una misión:
 * - tomar (quien no la creó) → soltar o entregar (quien la tomó);
 * - aprobar (paga la recompensa que dejó en depósito quien la creó), rechazar o cancelar (le devuelve el
 *   depósito): quien la creó o un admin.
 * Cada cambio es un update condicional sobre el estado esperado, así dos clics no pagan dos veces.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("No autenticado", 401);
  const parsed = Body.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) return fail("Acción inválida", 400);
  const { id } = await params;
  const mission = await prisma.mission.findUnique({ where: { id } });
  if (!mission) return fail("Esa misión ya no existe", 404);

  const action: MissionAction = parsed.data.action;
  const manager = mission.createdById === user.id || user.role === "ADMIN";
  const assignee = mission.assigneeId === user.id;

  const rules: Record<MissionAction, { from: MissionStatus[]; allowed: boolean; data: Prisma.MissionUpdateManyMutationInput & { assigneeId?: string | null }; denied: string }> = {
    take: { from: ["OPEN"], allowed: mission.createdById !== user.id, data: { status: "TAKEN", assigneeId: user.id }, denied: "No puedes tomar tu propia misión" },
    release: { from: ["TAKEN", "REVIEW"], allowed: assignee, data: { status: "OPEN", assigneeId: null }, denied: "Solo quien la tomó puede soltarla" },
    submit: { from: ["TAKEN"], allowed: assignee, data: { status: "REVIEW" }, denied: "Solo quien la tomó puede entregarla" },
    approve: { from: ["REVIEW"], allowed: manager && !assignee, data: { status: "DONE", completedAt: new Date() }, denied: "Solo quien la creó (o un admin) puede aprobarla" },
    reject: { from: ["REVIEW"], allowed: manager, data: { status: "TAKEN" }, denied: "Solo quien la creó (o un admin) puede rechazarla" },
    cancel: { from: ["OPEN", "TAKEN", "REVIEW"], allowed: manager, data: { status: "CANCELLED" }, denied: "Solo quien la creó (o un admin) puede cancelarla" },
  };
  const rule = rules[action];
  if (!rule.allowed) return fail(rule.denied, 403);

  const paid = await prisma.$transaction(async (tx) => {
    // También con el mismo asignado que se leyó: si alguien la soltó y otra persona la tomó entremedio, no se paga al equivocado.
    const changed = await tx.mission.updateMany({
      where: { id, status: { in: rule.from }, assigneeId: mission.assigneeId },
      data: rule.data,
    });
    if (changed.count === 0) return false;
    if (action === "cancel") {
      // Solo si hubo depósito: las misiones publicadas antes de que se cobrara no tienen nada que devolver.
      const deposit = await tx.pointTransaction.findFirst({
        where: { userId: mission.createdById, reason: "MISSION", refId: mission.id, amount: { lt: 0 } },
        select: { amount: true },
      });
      if (deposit) {
        await awardPointsTx(tx, { userId: mission.createdById, amount: -deposit.amount, reason: "MISSION", refId: missionRefundRef(mission.id) });
      }
    }
    if (action === "approve" && mission.assigneeId) {
      await awardPointsTx(tx, { userId: mission.assigneeId, amount: mission.reward, reason: "MISSION", refId: mission.id });
      // Para el logro "Manos a la obra" (el servidor de juego lo relee con el aviso de puntos).
      await bumpStat(tx, mission.assigneeId, STAT_KEYS.missionsDone);
    }
    return true;
  });
  if (!paid) return fail("Alguien cambió la misión recién. Actualiza el tablón.");
  if (action === "approve" && mission.assigneeId) await publishPointsChanged(mission.assigneeId);
  if (action === "cancel") await publishPointsChanged(mission.createdById);

  const updated = await prisma.mission.findUniqueOrThrow({ where: { id }, include: MISSION_INCLUDE });
  return NextResponse.json({ mission: toMissionDTO(updated) });
}
