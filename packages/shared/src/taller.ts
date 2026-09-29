// El taller del garaje: el compresor, el carro tapado, el banco de trabajo y la caja de herramientas
// responden a E con una animación, un sonido y un mensaje. Son interacciones cortas y sin economía (no
// dan ni cobran puntos). Se suman a USABLE_FURNITURE por casa.ts: mismo mensaje (`MSG.furnitureUse`) y
// mismas reglas de alcance que el resto de la casa viva. Lo único que valida aparte el servidor es el
// carro: una persona al volante a la vez (`TALLER.driveMs`). En el navegador: game/taller.ts.
import type { UsableSpec } from "./consumables";

/**
 * - `inflate`: el compresor infla una llanta (o lo que haya a mano);
 * - `drive`: se destapa el carro y te subes a "manejar" sin moverte del garaje;
 * - `sand`: lijar una tabla en el banco de trabajo;
 * - `rattle`: esculcar la caja de herramientas.
 */
export type TallerAction = "inflate" | "drive" | "sand" | "rattle";

export const TALLER = {
  /** Cuánto dura cada cosa (y la pausa del servidor entre dos usos de la misma persona). */
  inflateMs: 2_200,
  sandMs: 2_400,
  rattleMs: 1_400,
  /** Cuánto se queda el carro destapado con alguien al volante; mientras, nadie más se sube. */
  driveMs: 6_500,
} as const;

export const TALLER_USABLES: Record<string, UsableSpec> = {
  compressor: { action: "inflate", label: "Prender el compresor", cooldownMs: TALLER.inflateMs },
  "tarp-car": { action: "drive", label: "Destapar el carro y manejar", cooldownMs: TALLER.driveMs },
  workbench: { action: "sand", label: "Lijar en el banco", cooldownMs: TALLER.sandMs },
  "tool-chest": { action: "rattle", label: "Esculcar la caja de herramientas", cooldownMs: TALLER.rattleMs },
};

const TALLER_ACTIONS = new Set<string>(["inflate", "drive", "sand", "rattle"]);
export const isTallerAction = (action: string): action is TallerAction => TALLER_ACTIONS.has(action);

/** Lo que dice quien usa cada cosa (la semilla del servidor elige cuál: todos ven la misma). */
export const TALLER_LINES: Record<TallerAction, readonly string[]> = {
  inflate: ["¡Llanta inflada!", "Pssssh… a 32 libras.", "Esta sí aguanta otro viaje.", "¿Alguien trajo un balón?"],
  drive: ["¡Brrrum! Rumbo a ninguna parte.", "Pi pi, ¡abran paso!", "Tanque lleno y cero kilómetros.", "Un día de estos lo saco del garaje."],
  sand: ["Lijando una tablita…", "Queda lisita, lisita.", "Aserrín por todas partes.", "Grano 120 y paciencia."],
  rattle: ["¿Dónde quedó la llave del 10?", "Tornillos, tuercas… y una media.", "Aquí está el destornillador.", "Todo menos lo que buscaba."],
};

export const tallerLine = (action: TallerAction, seed: number) => {
  const lines = TALLER_LINES[action];
  return lines[Math.abs(Math.floor(seed)) % lines.length]!;
};

/** Quién va al volante del carro de cada clave (`furnitureKey`) y hasta cuándo (lo lleva el servidor). */
export interface CarSeat {
  userId: string;
  until: number;
}

/** ¿Hay otra persona al volante? (el mismo carro lo puede volver a usar quien ya está adentro). */
export const carTaken = (seat: CarSeat | undefined, userId: string, now: number) => Boolean(seat && seat.until > now && seat.userId !== userId);
