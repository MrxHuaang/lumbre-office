import "server-only";
import type { Prisma } from "@hyvento/db";
import type { MissionDTO, MissionStatus } from "@hyvento/shared";

/** Lo que se lee de una misión para mandarla al cliente. */
export const MISSION_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.MissionInclude;

type MissionRow = Prisma.MissionGetPayload<{ include: typeof MISSION_INCLUDE }>;

export function toMissionDTO(m: MissionRow): MissionDTO {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    reward: m.reward,
    status: m.status as MissionStatus,
    createdBy: { id: m.createdBy.id, name: m.createdBy.name || "Alguien" },
    assignee: m.assignee ? { id: m.assignee.id, name: m.assignee.name || "Alguien" } : null,
    createdAt: m.createdAt.toISOString(),
    completedAt: m.completedAt?.toISOString() ?? null,
  };
}
