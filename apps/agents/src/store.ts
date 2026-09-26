import { prisma } from "@hyvento/db";
import type { AgentEvent } from "@hyvento/shared";
import type { AgentRecord, ChatStore, ChatTurn } from "./run-chat";

export class PrismaChatStore implements ChatStore {
  async getAgent(agentId: string): Promise<AgentRecord | null> {
    const a = await prisma.agentDefinition.findFirst({ where: { id: agentId, isActive: true } });
    return a && { id: a.id, name: a.name, systemPrompt: a.systemPrompt, model: a.model, effort: a.effort, tools: a.tools };
  }

  async history(agentId: string, userId: string, limit: number): Promise<ChatTurn[]> {
    const rows = await prisma.agentChat.findMany({
      where: { agentId, userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { role: true, content: true },
    });
    return rows.reverse().map((r) => ({ role: r.role === "assistant" ? "assistant" : "user", content: r.content }));
  }

  async saveTurn(agentId: string, userId: string, turn: ChatTurn, runId: string) {
    await prisma.agentChat.create({ data: { agentId, userId, role: turn.role, content: turn.content, runId } });
  }

  async logEvent(event: AgentEvent) {
    // Los fragmentos de texto no se guardan: la respuesta completa queda en agent.reply.
    if (event.type === "agent.delta") return;
    const { agentId, runId, seq, type, ts: _ts, ...payload } = event;
    await prisma.agentRunLog.create({ data: { agentId, runId, seq, type, payload } });
  }
}
