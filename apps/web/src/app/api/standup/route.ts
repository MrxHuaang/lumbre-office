import { saveStandup, standupBoardFor } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { publishPointsChanged } from "@/lib/events";
import { standupFail, standupStore } from "@/lib/standup";

/** Los standups de hoy (día de Bogotá) de todos, el tuyo primero. */
export async function GET() {
  const user = await getCurrentUser();
  const res = await standupBoardFor(standupStore, user);
  if (!res.ok) return standupFail(res.error);
  return NextResponse.json(res.value, { headers: { "Cache-Control": "no-store" } });
}

/** Escribir o editar tu standup de hoy (`{ text }`). El primero del día da el bono; editarlo, no. */
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  const res = await saveStandup(standupStore, user, await req.json().catch(() => null));
  if (!res.ok) return standupFail(res.error);
  // El servidor de juego relee el saldo para el contador y el "+N".
  if (res.value.awarded > 0 && user) await publishPointsChanged(user.id);
  return NextResponse.json(res.value);
}
