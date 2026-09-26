import { z } from "zod";

// ---------- Estado visible de un agente ----------

export const AGENT_STATUSES = ["idle", "thinking", "searching", "writing", "error"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

/** Ícono sobre el agente en la oficina. */
export const AGENT_STATUS_ICON: Record<AgentStatus, string> = {
  idle: "",
  thinking: "💭",
  searching: "🔍",
  writing: "⌨️",
  error: "⚠️",
};

/** Spritesheets disponibles para agentes (generados en packages/map). */
export const AGENT_SPRITES = ["bot-amber", "bot-blue", "bot-pink", "bot-green", "bot-violet", "bot-orange"] as const;

// ---------- Herramientas habilitables por agente ----------

export const AGENT_TOOLS = ["web_search", "web_fetch"] as const;
export type AgentTool = (typeof AGENT_TOOLS)[number];

// ---------- Eventos worker → servidor de juego (Redis pub/sub) ----------

const base = {
  agentId: z.string(),
  runId: z.string(),
  /** Orden dentro del run: los clientes reproducen en orden y descartan duplicados. */
  seq: z.number().int().nonnegative(),
  ts: z.number(),
};

export const AgentEvent = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("agent.status"), status: z.enum(AGENT_STATUSES), detail: z.string().optional() }),
  /** Fragmento de texto de la respuesta (solo para quien preguntó). */
  z.object({ ...base, type: z.literal("agent.delta"), userId: z.string(), text: z.string() }),
  /** Respuesta final completa. */
  z.object({ ...base, type: z.literal("agent.reply"), userId: z.string(), text: z.string(), error: z.boolean().optional() }),
]);
export type AgentEvent = z.infer<typeof AgentEvent>;

/** Trabajo en la cola `agent-runs`. */
export const AgentChatJob = z.object({
  kind: z.literal("chat"),
  runId: z.string(),
  agentId: z.string(),
  userId: z.string(),
  userName: z.string(),
  message: z.string().min(1).max(4000),
});
export type AgentChatJob = z.infer<typeof AgentChatJob>;

export const AGENT_QUEUE = "agent-runs";

// ---------- Cliente ↔ servidor de juego ----------

export const AgentAskMessage = z.object({ agentId: z.string().min(1), text: z.string().trim().min(1).max(4000) });
export type AgentAskMessage = z.infer<typeof AgentAskMessage>;

export interface AgentAck {
  agentId: string;
  runId: string | null;
  /** Motivo si no se aceptó (p. ej. ya hay una respuesta en curso). */
  error?: string;
}

/** Fragmento o respuesta final de un agente, enviado solo a quien preguntó. */
export interface AgentStreamMessage {
  agentId: string;
  runId: string;
  seq: number;
  text: string;
  done: boolean;
  error?: boolean;
}

/** Globo corto sobre el agente para quienes están cerca. */
export interface AgentSay {
  agentId: string;
  text: string;
}

// ---------- Presets ----------

export interface AgentPreset {
  key: string;
  name: string;
  role: string;
  sprite: string;
  deskId: string;
  tools: AgentTool[];
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  systemPrompt: string;
}

export const AGENT_PRESETS: AgentPreset[] = [
  {
    key: "nova",
    name: "Nova",
    role: "Asistente general",
    sprite: "bot-amber",
    deskId: "desk-1",
    tools: ["web_search", "web_fetch"],
    effort: "medium",
    systemPrompt: `Eres Nova, la asistente general de la oficina virtual del equipo Hyvento.
Trabajas en el laboratorio de IA de la oficina y las personas del equipo se acercan a tu escritorio para pedirte ayuda.

Cómo respondes:
- En español, con un tono cercano y profesional.
- Directo al punto: respuestas breves por defecto; te extiendes solo cuando la tarea lo pide.
- Usa Markdown ligero (listas, negritas) cuando ayude a leer; nada de títulos grandes en respuestas cortas.
- Cuando la respuesta dependa de información actual o que no conoces con certeza, búscala en la web y cita las fuentes con su enlace.
- Si algo no está claro, pregunta antes de suponer.`,
  },
];
