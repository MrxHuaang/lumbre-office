// Rediseño: usar lo que se tiene en la mano (F) y los muebles que se usan (E). El servidor valida y
// avisa a los del mismo nivel; cada cliente dibuja la animación.
import { z } from "zod";

/** Cómo se consume cada cosa: pitada (cigarro, habano), sorbo (bebidas) o mordisco (comida). */
export type ConsumeAction = "smoke" | "sip" | "bite";

/**
 * Cada cosa que se puede llevar en la mano (los `holds` de las cartas en cafe.ts): cómo se usa y cuántas
 * veces. Al gastar el último uso desaparece de la mano.
 */
export const CONSUMABLES: Record<string, { action: ConsumeAction; uses: number }> = {
  tinto: { action: "sip", uses: 3 },
  "cafe-leche": { action: "sip", uses: 4 },
  aromatica: { action: "sip", uses: 4 },
  chocolate: { action: "sip", uses: 4 },
  "coca-cola": { action: "sip", uses: 4 },
  pandebono: { action: "bite", uses: 3 },
  bunuelo: { action: "bite", uses: 3 },
  torta: { action: "bite", uses: 4 },
  cigarro: { action: "smoke", uses: 5 },
  cerveza: { action: "sip", uses: 5 },
  vino: { action: "sip", uses: 4 },
  coctel: { action: "sip", uses: 4 },
  whisky: { action: "sip", uses: 3 },
  habano: { action: "smoke", uses: 8 },
};

/** Usos de algo en la mano (1 si no está en la tabla: se usa una vez y se va). */
export const usesOf = (art: string) => CONSUMABLES[art]?.uses ?? 1;
export const consumeActionOf = (art: string): ConsumeAction => CONSUMABLES[art]?.action ?? "bite";

export const CONSUME = {
  /** Pausa mínima entre dos usos de la misma persona (dura lo que la animación). */
  cooldownMs: 1600,
} as const;

/** Usos que le quedan a cada mano, como viajan en el estado (`Player.heldLeft`): "4,5". */
export function parseHeldLeft(s: string): number[] {
  if (!s) return [];
  return s.split(",").map((n) => Math.max(0, Number.parseInt(n, 10) || 0));
}
export const formatHeldLeft = (left: readonly number[]) => left.join(",");

/** Cliente → servidor (`MSG.useHeld`): usar lo que tengo en la mano. `part` elige la mano (combos). */
export const UseHeldMessage = z.object({ part: z.number().int().min(0).max(1).optional() }).optional();
export type UseHeldMessage = z.infer<typeof UseHeldMessage>;

/** Servidor → clientes del mismo nivel (`MSG.heldUsed`): alguien usó lo que tenía en una mano. */
export interface HeldUsedEvent {
  sessionId: string;
  /** Mano (0 o 1, en el orden de `holds`). */
  part: number;
  /** Id del dibujo (p. ej. "cigarro"). */
  art: string;
  action: ConsumeAction;
  /** Usos que le quedan a esa mano después de este (0 = se acabó). */
  left: number;
}

// ---------- Muebles que se usan ----------

/**
 * `toggle`: se prende y apaga, y lo ven todos (el estado lo guarda el servidor). `play` (instrumentos) y
 * `pet` (el gato) son un evento: una animación y un sonido para los del mismo nivel.
 */
export type FurnitureAction = "toggle" | "play" | "pet";

export interface UsableSpec {
  action: FurnitureAction;
  /** Qué dice la ayuda: para `toggle`, cuando está apagado (`label`) y prendido (`labelOn`). */
  label: string;
  labelOn?: string;
  /** Cómo arranca un `toggle` (las lámparas, prendidas; la tele y el tocadiscos, apagados). */
  defaultOn?: boolean;
  /** Pausa mínima entre dos usos de la misma persona. */
  cooldownMs: number;
}

export const USABLE_FURNITURE: Record<string, UsableSpec> = {
  piano: { action: "play", label: "Tocar el piano", cooldownMs: 2600 },
  guitar: { action: "play", label: "Tocar la guitarra", cooldownMs: 2600 },
  "record-player": { action: "toggle", label: "Poner un disco", labelOn: "Quitar el disco", defaultOn: false, cooldownMs: 800 },
  "tv-retro": { action: "toggle", label: "Prender la tele", labelOn: "Apagar la tele", defaultOn: false, cooldownMs: 600 },
  lamp: { action: "toggle", label: "Prender la lámpara", labelOn: "Apagar la lámpara", defaultOn: true, cooldownMs: 400 },
  "lamp-mushroom": { action: "toggle", label: "Prender la lámpara", labelOn: "Apagar la lámpara", defaultOn: true, cooldownMs: 400 },
  "cat-bed": { action: "pet", label: "Acariciar al gato", cooldownMs: 1500 },
};

export const usableSpec = (type: string): UsableSpec | undefined => USABLE_FURNITURE[type];

/** Clave de un mueble en el estado (`OfficeState.switches`): nivel, tipo y esquina en tiles. */
export const furnitureKey = (area: string, type: string, x: number, y: number) => `${area}:${type}:${x},${y}`;

/** ¿Está prendido? Lo que no está en `switches` sigue como arranca (`defaultOn`). */
export function isSwitchedOn(switches: { get(key: string): boolean | undefined }, area: string, type: string, x: number, y: number) {
  return switches.get(furnitureKey(area, type, x, y)) ?? usableSpec(type)?.defaultOn ?? false;
}

/** Cliente → servidor (`MSG.furnitureUse`): usar el mueble de ese tipo con esquina en (x, y) de mi nivel. */
export const FurnitureUseMessage = z.object({
  type: z.string().min(1).max(40),
  x: z.number().int().min(0).max(255),
  y: z.number().int().min(0).max(255),
});
export type FurnitureUseMessage = z.infer<typeof FurnitureUseMessage>;

/** Servidor → clientes del mismo nivel (`MSG.furnitureEvent`): alguien tocó un instrumento o acarició al gato. */
export interface FurnitureEvent {
  sessionId: string;
  type: string;
  x: number;
  y: number;
  action: Exclude<FurnitureAction, "toggle">;
  /** Semilla de la melodía: todos oyen las mismas notas. */
  seed: number;
}
