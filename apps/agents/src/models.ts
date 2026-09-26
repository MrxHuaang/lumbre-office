/** Modelos seleccionables para un agente y qué parámetros admite cada uno. */
export const AGENT_MODELS = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"] as const;
export const DEFAULT_MODEL = "claude-opus-5";

export interface ModelCaps {
  /** Pensamiento adaptativo + `output_config.effort`. */
  adaptiveThinking: boolean;
  /** Respaldo del lado del servidor ante rechazos (`fallbacks: "default"`). */
  serverFallback: boolean;
}

export function modelCaps(model: string): ModelCaps {
  if (model.startsWith("claude-haiku-4-5")) return { adaptiveThinking: false, serverFallback: false };
  if (model === "claude-opus-5" || model === "claude-fable-5-1") return { adaptiveThinking: true, serverFallback: true };
  return { adaptiveThinking: true, serverFallback: false };
}
