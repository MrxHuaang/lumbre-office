import "server-only";
// Standup del tablón: el almacén de Prisma para el servicio de @hyvento/shared (standup.ts) y la respuesta
// de error de /api/standup.
import { listStandupRows, prisma, saveStandupRow } from "@hyvento/db";
import { STANDUP_ERROR, type StandupError, type StandupStore } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { asAvatar, asLook } from "@/lib/current-user";

export const standupStore: StandupStore = {
  save: (input) => saveStandupRow(prisma, input),
  listDay: async (day) =>
    (await listStandupRows(prisma, day)).map((r) => ({
      userId: r.userId,
      name: r.user.name || "Alguien",
      avatar: asAvatar(r.user.avatar),
      look: asLook(r.user.look),
      day: r.day,
      text: r.text,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
};

export function standupFail(error: StandupError) {
  const { status, text } = STANDUP_ERROR[error];
  return NextResponse.json({ error: text, code: error }, { status });
}
