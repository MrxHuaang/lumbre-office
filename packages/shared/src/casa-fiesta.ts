// Las fiestas en la casa de cada persona (VIR-149, docs/plan-casas.md): el equipo de sonido de la sala de
// fiestas pone música para todos los de la casa (un video de YouTube, como la radio de las oficinas: suena
// en cualquier piso, al mismo segundo, y lo maneja el dueño), el modo fiesta abre la casa mientras dura,
// prende las luces de la bola de discoteca y avisa en el chat global, y la rana y el billar del cuarto de
// juegos responden a E con una frase (sin puntos: es para pasarla bien). La barra ya sirve la carta del bar.
import { z } from "zod";
import type { UsableSpec } from "./consumables";
import { OfficeRadioMessage } from "./office-radio";

export const CASA_FIESTA = {
  /** Entre dos avisos de fiesta de la misma persona en el chat global (para no llenarlo). */
  announceCooldownMs: 10 * 60_000,
  /** Lo que dura tirar argollas a la rana y tacar en el billar (y la pausa entre dos usos). */
  frogMs: 1_800,
  poolMs: 1_600,
} as const;

/** Mensajes de la fiesta (con los de la casa: `casaPropia:`). */
export const CASA_FIESTA_MSG = {
  /** Dueño → servidor: la música de la casa (lo mismo que la radio de una oficina). */
  radio: "casaPropia:radio",
  /** Dueño → servidor: prender o apagar el modo fiesta. */
  fiesta: "casaPropia:fiesta",
} as const;

export const CasaRadioMessage = OfficeRadioMessage;
export const CasaFiestaMessage = z.object({ on: z.boolean() }).strict();

/** El aviso del chat global cuando alguien prende la fiesta. */
export function fiestaAnnouncement(name: string): string {
  return `🎉 ${name} armó fiesta en su casa: toma el Megabús en la estación y elige su casa.`;
}

// ---------- Los juegos del cuarto de juegos ----------

/** - `frog`: tirar argollas al juego de la rana; - `pool`: tacar en el billar. */
export type JuegoAction = "frog" | "pool";
const JUEGO_ACTIONS: ReadonlySet<string> = new Set<JuegoAction>(["frog", "pool"]);
export const isJuegoAction = (action: string): action is JuegoAction => JUEGO_ACTIONS.has(action);

export const JUEGOS_USABLES: Record<string, UsableSpec> = {
  "juego-rana": { action: "frog", label: "Tirar argollas a la rana", cooldownMs: CASA_FIESTA.frogMs },
  "mesa-billar": { action: "pool", label: "Tacar en el billar", cooldownMs: CASA_FIESTA.poolMs },
};

export const JUEGO_LINES: Record<JuegoAction, readonly string[]> = {
  frog: ["¡RANA! En toda la boca.", "Al hueco del 50, nada mal.", "Pegó en el puente y se fue al 10.", "Se fue por fuera… otra vez.", "¡Al molinete! 100 puntos.", "Tres argollas, cero ranas."],
  pool: ["¡Bola a la buchaca!", "Carambola de tres bandas.", "Rayó el paño… shhh.", "Le pegó a la negra, ¡ay!", "Tiza, mucha tiza.", "Tacazo limpio."],
};

export const juegoLine = (action: JuegoAction, seed: number) => {
  const lines = JUEGO_LINES[action];
  return lines[Math.abs(Math.floor(seed)) % lines.length]!;
};
