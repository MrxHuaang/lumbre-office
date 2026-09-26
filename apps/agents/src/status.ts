import type { AgentEvent, AgentStatus } from "@hyvento/shared";

/** Prioridad visual cuando un agente atiende varios runs a la vez. */
const PRIORITY: Record<AgentStatus, number> = { writing: 4, searching: 3, thinking: 2, error: 1, idle: 0 };
const ERROR_VISIBLE_MS = 4000;

/**
 * Agrega el estado de varios runs concurrentes de un mismo agente en un solo estado visible
 * y lo publica solo cuando cambia.
 */
export class StatusAggregator {
  private runs = new Map<string, Map<string, { status: AgentStatus; detail?: string }>>();
  private last = new Map<string, string>();
  private seq = new Map<string, number>();

  constructor(
    private readonly publish: (e: AgentEvent) => Promise<void>,
    private readonly schedule: (fn: () => void, ms: number) => void = (fn, ms) => void setTimeout(fn, ms),
  ) {}

  async set(agentId: string, runId: string, status: AgentStatus, detail?: string) {
    const runs = this.runs.get(agentId) ?? new Map();
    this.runs.set(agentId, runs);
    if (status === "idle") runs.delete(runId);
    else runs.set(runId, { status, detail });
    if (status === "error") {
      // El error se ve unos segundos y luego el run deja de contar.
      this.schedule(() => {
        if (runs.get(runId)?.status === "error") {
          runs.delete(runId);
          void this.emit(agentId);
        }
      }, ERROR_VISIBLE_MS);
    }
    await this.emit(agentId);
  }

  current(agentId: string): { status: AgentStatus; detail?: string } {
    let best: { status: AgentStatus; detail?: string } = { status: "idle" };
    for (const s of this.runs.get(agentId)?.values() ?? []) {
      if (PRIORITY[s.status] > PRIORITY[best.status]) best = s;
    }
    return best;
  }

  private async emit(agentId: string) {
    const { status, detail } = this.current(agentId);
    const key = `${status}|${detail ?? ""}`;
    if (this.last.get(agentId) === key) return;
    this.last.set(agentId, key);
    const seq = (this.seq.get(agentId) ?? 0) + 1;
    this.seq.set(agentId, seq);
    await this.publish({ type: "agent.status", agentId, runId: "status", seq, ts: Date.now(), status, detail });
  }
}
