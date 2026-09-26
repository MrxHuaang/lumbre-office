import { prisma } from "@hyvento/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

const LIMIT = 50;

/** Historial de la conversación del usuario actual con un agente (solo su propio hilo). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;

  const rows = await prisma.agentChat.findMany({
    where: { agentId: id, userId: user.id },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: { id: true, role: true, content: true, runId: true },
  });
  const messages = rows.reverse().map((r) => ({
    // Las respuestas usan el runId como id, igual que las que llegan en vivo (evita duplicados).
    id: r.role === "assistant" && r.runId ? r.runId : r.id,
    role: r.role === "assistant" ? "assistant" : "user",
    text: r.content,
  }));
  return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}
