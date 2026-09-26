import Anthropic from "@anthropic-ai/sdk";
import type { AgentChatJob, AgentEvent, AgentStatus } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { buildParams, runChat, type AgentRecord, type ChatStore, type ChatTurn, type ClaudeClient } from "../src/run-chat";
import { StatusAggregator } from "../src/status";

// ---------- Dobles de prueba ----------

type RawEvent = Anthropic.Beta.Messages.BetaRawMessageStreamEvent;
type BetaMessage = Anthropic.Beta.Messages.BetaMessage;

const agent: AgentRecord = {
  id: "a1",
  name: "Nova",
  systemPrompt: "Eres Nova.",
  model: "claude-opus-5",
  effort: "medium",
  tools: ["web_search"],
};
const job: AgentChatJob = { kind: "chat", runId: "r1", agentId: "a1", userId: "u1", userName: "Juanjo", message: "Hola" };

function textTurn(text: string, stop: BetaMessage["stop_reason"] = "end_turn", extra: object[] = []): { events: RawEvent[]; final: BetaMessage } {
  const events = [
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "", citations: null } },
    ...text.match(/.{1,5}/g)!.map((chunk) => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: chunk } })),
    { type: "content_block_stop", index: 0 },
  ] as unknown as RawEvent[];
  const final = {
    stop_reason: stop,
    content: [...extra, { type: "text", text, citations: null }],
  } as unknown as BetaMessage;
  return { events, final };
}

function fakeClient(turns: { events: RawEvent[]; final: BetaMessage }[]) {
  const calls: Anthropic.Beta.Messages.MessageCreateParamsStreaming[] = [];
  const client: ClaudeClient = {
    beta: {
      messages: {
        stream(params) {
          // Copia: el run muta el arreglo de mensajes después de la llamada.
          calls.push({ ...params, messages: [...params.messages] });
          const turn = turns.shift();
          if (!turn) throw new Error("llamada inesperada");
          return {
            async *[Symbol.asyncIterator]() {
              for (const e of turn.events) yield e;
            },
            finalMessage: async () => turn.final,
          };
        },
      },
    },
  };
  return { client, calls };
}

function memoryStore(history: ChatTurn[] = []) {
  const saved: ChatTurn[] = [];
  const store: ChatStore = {
    getAgent: async (id) => (id === agent.id ? agent : null),
    history: async () => history,
    saveTurn: async (_a, _u, turn) => {
      saved.push(turn);
    },
    logEvent: async () => undefined,
  };
  return { store, saved };
}

function harness(turns: { events: RawEvent[]; final: BetaMessage }[], history: ChatTurn[] = []) {
  const { client, calls } = fakeClient(turns);
  const { store, saved } = memoryStore(history);
  const events: AgentEvent[] = [];
  const statuses: { status: AgentStatus; detail?: string }[] = [];
  const deps = {
    client: () => client,
    store,
    publish: async (e: AgentEvent) => {
      events.push(e);
    },
    setStatus: async (_a: string, _r: string, status: AgentStatus, detail?: string) => {
      statuses.push({ status, detail });
    },
  };
  return { deps, calls, saved, events, statuses };
}

// ---------- Tests ----------

describe("runChat", () => {
  it("transmite la respuesta por fragmentos, la guarda y termina en idle", async () => {
    const h = harness([textTurn("¡Hola Juanjo! ¿En qué te ayudo hoy? Tengo varias ideas.")], [
      { role: "assistant", content: "turno huérfano" }, // el hilo debe empezar por el usuario
      { role: "user", content: "antes" },
      { role: "assistant", content: "respuesta previa" },
    ]);
    const result = await runChat(job, h.deps);

    expect(result.error).toBe(false);
    const deltas = h.events.filter((e) => e.type === "agent.delta").map((e) => (e as { text: string }).text);
    expect(deltas.join("")).toBe("¡Hola Juanjo! ¿En qué te ayudo hoy? Tengo varias ideas.");
    expect(deltas.length).toBeGreaterThan(1);
    const reply = h.events.at(-1)!;
    expect(reply).toMatchObject({ type: "agent.reply", userId: "u1", text: result.text });
    expect(h.events.map((e) => e.seq)).toEqual(h.events.map((_, i) => i)); // seq consecutivo
    expect(h.statuses.map((s) => s.status)).toEqual(["thinking", "writing", "idle"]);
    expect(h.saved.map((t) => t.role)).toEqual(["user", "assistant"]);
    expect(h.calls[0]!.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  });

  it("muestra la búsqueda web en curso y agrega las fuentes citadas", async () => {
    const search = [
      { type: "content_block_start", index: 0, content_block: { type: "server_tool_use", id: "s1", name: "web_search", input: {} } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"query":' } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '"clima Bogotá"}' } },
      { type: "content_block_stop", index: 0 },
    ] as unknown as RawEvent[];
    const answer = textTurn("Hoy hace 18 °C.");
    const final = {
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "Hoy hace 18 °C.",
          citations: [{ type: "web_search_result_location", url: "https://clima.example", title: "Clima", cited_text: "18" }],
        },
      ],
    } as unknown as BetaMessage;
    const h = harness([{ events: [...search, ...answer.events], final }]);
    const result = await runChat(job, h.deps);

    expect(h.statuses).toContainEqual({ status: "searching", detail: "Buscando: clima Bogotá" });
    expect(result.text).toContain("**Fuentes**");
    expect(result.text).toContain("[Clima](https://clima.example)");
  });

  it("reanuda tras pause_turn reenviando el turno del asistente", async () => {
    const first = textTurn("Primera parte. ", "pause_turn");
    const second = textTurn("Segunda parte.");
    const h = harness([first, second]);
    const result = await runChat(job, h.deps);

    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.messages.at(-1)).toMatchObject({ role: "assistant" });
    expect(result.text).toBe("Primera parte. Segunda parte.");
  });

  it("responde con un aviso si el modelo rechaza la solicitud", async () => {
    const h = harness([textTurn("x", "refusal")]);
    const result = await runChat(job, h.deps);
    expect(result).toEqual({ text: "No puedo ayudarte con eso.", error: true });
    expect(h.statuses.at(-1)!.status).toBe("error");
  });

  it("explica que falta la API key en vez de fallar en silencio", async () => {
    const h = harness([]);
    h.deps.client = () => {
      throw new Anthropic.AnthropicError("missing api key");
    };
    const result = await runChat(job, h.deps);
    expect(result.error).toBe(true);
    expect(result.text).toMatch(/ANTHROPIC_API_KEY/);
    expect(h.events.at(-1)).toMatchObject({ type: "agent.reply", error: true });
    expect(h.saved.map((t) => t.role)).toEqual(["user", "assistant"]);
  });

  it("explica una API key inválida (401)", async () => {
    const h = harness([]);
    h.deps.client = () => ({
      beta: {
        messages: {
          stream() {
            throw new Anthropic.AuthenticationError(401, { type: "error" }, "invalid x-api-key", new Headers());
          },
        },
      },
    });
    const result = await runChat(job, h.deps);
    expect(result.text).toMatch(/API key válida/);
  });
});

describe("buildParams", () => {
  it("Opus 5: pensamiento adaptativo, effort, respaldo del servidor y búsqueda web", () => {
    const p = buildParams(agent, "Juanjo", [{ role: "user", content: "hola" }]);
    expect(p.model).toBe("claude-opus-5");
    expect(p.thinking).toEqual({ type: "adaptive" });
    expect(p.output_config).toEqual({ effort: "medium" });
    expect(p.fallbacks).toBe("default");
    expect(p.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(p.tools).toEqual([{ type: "web_search_20260209", name: "web_search", max_uses: 5 }]);
    expect(Array.isArray(p.system) && p.system[0]).toMatchObject({ cache_control: { type: "ephemeral" } });
  });

  it("Haiku 4.5: sin pensamiento adaptativo ni respaldo (no los admite)", () => {
    const p = buildParams({ ...agent, model: "claude-haiku-4-5", tools: [] }, "Juanjo", [{ role: "user", content: "hola" }]);
    expect(p.thinking).toBeUndefined();
    expect(p.output_config).toBeUndefined();
    expect(p.fallbacks).toBeUndefined();
    expect(p.tools).toBeUndefined();
  });
});

describe("StatusAggregator", () => {
  it("con varios runs muestra el estado más activo y solo publica cambios", async () => {
    const published: AgentEvent[] = [];
    const agg = new StatusAggregator(async (e) => void published.push(e), () => undefined);
    await agg.set("a1", "r1", "thinking");
    await agg.set("a1", "r2", "writing");
    await agg.set("a1", "r1", "thinking"); // sin cambio visible
    await agg.set("a1", "r2", "idle");
    await agg.set("a1", "r1", "idle");
    expect(published.map((e) => (e as { status: string }).status)).toEqual(["thinking", "writing", "thinking", "idle"]);
  });
});
