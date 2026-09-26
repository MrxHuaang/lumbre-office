import Anthropic from "@anthropic-ai/sdk";
import type { AgentChatJob, AgentEvent, AgentStatus, AgentTool } from "@hyvento/shared";
import { modelCaps } from "./models";

type BetaParams = Anthropic.Beta.Messages.MessageCreateParamsStreaming;
type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaMessage = Anthropic.Beta.Messages.BetaMessage;

export interface AgentRecord {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  effort: string;
  tools: string[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Persistencia que necesita un run de chat (Prisma en producción, memoria en tests). */
export interface ChatStore {
  getAgent(agentId: string): Promise<AgentRecord | null>;
  /** Últimos turnos del hilo (agente, persona), del más antiguo al más reciente. */
  history(agentId: string, userId: string, limit: number): Promise<ChatTurn[]>;
  saveTurn(agentId: string, userId: string, turn: ChatTurn, runId: string): Promise<void>;
  logEvent(event: AgentEvent): Promise<void>;
}

/** Lo único del SDK que usamos: abrir un stream en el endpoint beta. */
export interface ClaudeClient {
  beta: { messages: { stream(params: BetaParams): ClaudeStream } };
}
export interface ClaudeStream extends AsyncIterable<Anthropic.Beta.Messages.BetaRawMessageStreamEvent> {
  finalMessage(): Promise<BetaMessage>;
}

export interface ChatDeps {
  /** Se crea al usarse: si falta la API key, el error llega como respuesta del agente. */
  client: () => ClaudeClient;
  store: ChatStore;
  publish: (event: AgentEvent) => Promise<void>;
  /** Estado visible del agente (el worker lo agrega entre runs concurrentes). */
  setStatus: (agentId: string, runId: string, status: AgentStatus, detail?: string) => Promise<void>;
}

const HISTORY_TURNS = 20;
const MAX_TOKENS = 16_000;
/** Máximo de reanudaciones tras `pause_turn` (búsquedas web largas). */
const MAX_CONTINUATIONS = 4;
/** Se agrupan los fragmentos de texto para no inundar Redis con un mensaje por token. */
const DELTA_FLUSH_CHARS = 32;

function toolsFor(enabled: string[]): BetaParams["tools"] {
  const tools: NonNullable<BetaParams["tools"]> = [];
  if (enabled.includes("web_search" satisfies AgentTool)) {
    tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 5 });
  }
  if (enabled.includes("web_fetch" satisfies AgentTool)) {
    tools.push({ type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 });
  }
  return tools.length ? tools : undefined;
}

export function buildParams(agent: AgentRecord, userName: string, messages: BetaMessageParam[]): BetaParams {
  const caps = modelCaps(agent.model);
  const today = new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const params: BetaParams = {
    model: agent.model,
    max_tokens: MAX_TOKENS,
    stream: true,
    // Bloque estable primero (cacheable); lo variable (persona, fecha) después.
    system: [
      { type: "text", text: agent.systemPrompt, cache_control: { type: "ephemeral" } },
      { type: "text", text: `Estás hablando con ${userName}. Hoy es ${today}.` },
    ],
    messages,
    tools: toolsFor(agent.tools),
  };
  if (caps.adaptiveThinking) {
    params.thinking = { type: "adaptive" };
    params.output_config = { effort: agent.effort as "low" | "medium" | "high" | "xhigh" | "max" };
  }
  if (caps.serverFallback) {
    params.betas = ["server-side-fallback-2026-07-01"];
    params.fallbacks = "default";
  }
  return params;
}

/** Texto final: bloques de texto + lista de fuentes citadas (búsqueda web). */
export function extractReply(messages: BetaMessage[]): string {
  let text = "";
  const sources = new Map<string, string>();
  for (const m of messages) {
    for (const block of m.content) {
      if (block.type !== "text") continue;
      text += block.text;
      for (const c of block.citations ?? []) {
        if (c.type === "web_search_result_location" && !sources.has(c.url)) sources.set(c.url, c.title ?? c.url);
      }
    }
  }
  text = text.trim();
  if (sources.size > 0) {
    const list = [...sources].map(([url, title]) => `- [${title}](${url})`).join("\n");
    text += `\n\n**Fuentes**\n${list}`;
  }
  return text;
}

function errorText(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "No puedo responder: falta configurar una API key válida de Anthropic (ANTHROPIC_API_KEY).";
  }
  if (err instanceof Anthropic.RateLimitError) return "Estoy recibiendo demasiadas solicitudes. Intenta de nuevo en un momento.";
  if (err instanceof Anthropic.APIError) return `Tuve un problema con el modelo (${err.status ?? "sin código"}). Intenta de nuevo.`;
  if (err instanceof Anthropic.AnthropicError) {
    return "No puedo responder: falta configurar ANTHROPIC_API_KEY en el servidor de agentes.";
  }
  return "Tuve un problema inesperado al responder. Intenta de nuevo.";
}

/** Ejecuta un turno de chat persona → agente, emitiendo eventos visuales en cada paso. */
export async function runChat(job: AgentChatJob, deps: ChatDeps): Promise<{ text: string; error: boolean }> {
  const { store } = deps;
  let seq = 0;
  const event = async (e: AgentEvent) => {
    await deps.publish(e);
    await store.logEvent(e).catch(() => undefined);
  };
  const base = () => ({ agentId: job.agentId, runId: job.runId, seq: seq++, ts: Date.now() });
  const status = (s: AgentStatus, detail?: string) => deps.setStatus(job.agentId, job.runId, s, detail);

  const agent = await store.getAgent(job.agentId);
  if (!agent) {
    const text = "Este agente ya no existe.";
    await event({ ...base(), type: "agent.reply", userId: job.userId, text, error: true });
    return { text, error: true };
  }

  const history = await store.history(job.agentId, job.userId, HISTORY_TURNS);
  await store.saveTurn(job.agentId, job.userId, { role: "user", content: job.message }, job.runId);

  const messages: BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
  // El primer mensaje debe ser del usuario.
  while (messages[0]?.role === "assistant") messages.shift();
  messages.push({ role: "user", content: job.message });

  let buffer = "";
  const flush = async () => {
    if (!buffer) return;
    const text = buffer;
    buffer = "";
    await event({ ...base(), type: "agent.delta", userId: job.userId, text });
  };

  const finals: BetaMessage[] = [];
  let reply: string;
  let failed = false;
  try {
    await status("thinking");
    const client = deps.client();
    for (let turn = 0; ; turn++) {
      const stream = client.beta.messages.stream(buildParams(agent, job.userName, messages));
      const toolInput = new Map<number, string>();
      for await (const ev of stream) {
        if (ev.type === "content_block_start") {
          const block = ev.content_block;
          if (block.type === "thinking" || block.type === "redacted_thinking") await status("thinking");
          else if (block.type === "server_tool_use") {
            toolInput.set(ev.index, "");
            await status("searching", block.name === "web_fetch" ? "Leyendo una página" : "Buscando en la web");
          } else if (block.type === "text") await status("writing");
        } else if (ev.type === "content_block_delta") {
          if (ev.delta.type === "text_delta") {
            buffer += ev.delta.text;
            if (buffer.length >= DELTA_FLUSH_CHARS) await flush();
          } else if (ev.delta.type === "input_json_delta" && toolInput.has(ev.index)) {
            toolInput.set(ev.index, toolInput.get(ev.index)! + ev.delta.partial_json);
          }
        } else if (ev.type === "content_block_stop") {
          await flush();
          const raw = toolInput.get(ev.index);
          if (raw !== undefined) {
            try {
              const input = JSON.parse(raw) as { query?: string; url?: string };
              const detail = input.query ? `Buscando: ${input.query}` : input.url ? `Leyendo: ${input.url}` : undefined;
              if (detail) await status("searching", detail.slice(0, 80));
            } catch {
              // entrada parcial: no hace falta mostrar el detalle
            }
          }
        }
      }
      await flush();
      const message = await stream.finalMessage();
      finals.push(message);

      if (message.stop_reason === "pause_turn" && turn < MAX_CONTINUATIONS) {
        // Búsqueda web larga: reanudar enviando el turno del asistente tal cual.
        messages.push({ role: "assistant", content: message.content });
        continue;
      }
      if (message.stop_reason === "refusal") {
        reply = "No puedo ayudarte con eso.";
        failed = true;
      } else {
        reply = extractReply(finals) || "…";
      }
      break;
    }
  } catch (err) {
    console.error(`[agents] run ${job.runId} falló:`, err instanceof Error ? err.message : err);
    reply = errorText(err);
    failed = true;
  }

  await store.saveTurn(job.agentId, job.userId, { role: "assistant", content: reply }, job.runId).catch(() => undefined);
  await event({ ...base(), type: "agent.reply", userId: job.userId, text: reply, error: failed || undefined });
  await status(failed ? "error" : "idle");
  return { text: reply, error: failed };
}
