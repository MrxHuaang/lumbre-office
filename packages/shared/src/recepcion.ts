// La recepción del recibidor (planta baja): Doña Gloria atiende detrás del mostrador. Saluda a quien entra
// al recibidor y, con E, pregunta "¿A quién busca?": la lista de conectados con dónde está cada uno y un
// botón para ir hasta la persona. Lo que se dice de una oficina cerrada es solo "en su oficina" (o "en una
// oficina", si es la de otro): no se cuenta quién está adentro de qué. Todo es del navegador (dónde está
// cada uno ya lo ve cualquiera en la lista de conectados); aquí van el personaje y las reglas.
import type { GameNpc } from "./npcs";
import { pickLine } from "./npcs";

export const RECEPCION = {
  /** Punto del mapa delante del mostrador (la "E"). */
  point: "reception",
  /** Zona del recibidor: quien entra ahí recibe el saludo. */
  zone: "recibidor",
} as const;

/** Doña Gloria: saco de lana tejido, blusa crema, gafas de leer y el pelo recogido con canas. */
export const RECEPCION_NPC: GameNpc = {
  id: "gloria",
  role: "recepcionista",
  name: "Doña Gloria",
  voz: 0.58,
  area: "planta-baja",
  // Detrás del mostrador de la recepción, mirando a la puerta.
  tile: { x: 14, y: 20 },
  facing: "down",
  solid: true,
  look: {
    skin: "#e8b98a",
    hair: "#bdb3aa",
    shirt: "#f1e6cf",
    pants: "#5a3b2a",
    accent: "#9a4a38",
    top: "cardigan",
    face: "round-glasses",
    hairStyle: "bun",
    eyes: "happy",
    blush: true,
    neck: "pearls",
    accessories: [],
    shoes: "boots",
    shoeColor: "#4a3020",
  },
  idle: [
    "¿Le provoca un tintico? En la cafetería lo hacen bien bueno.",
    "Qué alegría ver la casa llena, mijo.",
    "Si se pierde, venga y yo le digo dónde anda cada uno.",
    "Abríguese, que afuera está haciendo frío.",
  ],
};

/** Saludos a quien entra al recibidor (`{name}` = su nombre corto). */
export const RECEPCION_GREET = [
  "¡Buenas, {name}! Siga, que la casa es suya.",
  "Siga, {name}, siga, que está en su casa.",
  "¡Ay, {name}! ¿Cómo me le va? ¿A quién busca?",
  "Buenos días, {name}. Límpiese los pies, mi amor.",
  "¡Quiubo, {name}! Pase, que ya casi está el tinto.",
] as const;

export const recepcionGreeting = (name: string, seed: number) => pickLine(RECEPCION_GREET, seed).replace("{name}", name);

/** Lo que dice al abrir el panel. */
export const RECEPCION_ASK = ["¿A quién busca, sumercé?", "¿A quién le anuncio, mijo?", "Dígame a quién busca y yo le digo dónde anda."] as const;

/** Lo que se sabe de alguien para decir dónde está. */
export interface WhereInput {
  /** Nombre del nivel ("Planta baja"). */
  areaName: string;
  /** Nombre de la zona donde está ("" = en un pasillo o afuera sin zona). */
  zoneName: string;
  /** Si la zona es una oficina: de quién es y si está cerrada. */
  office?: { mine: boolean; locked: boolean };
  /** Está en la puerta de una sala (el `place` "door:<zona>"). */
  atDoor?: boolean;
}

/**
 * Dónde está alguien, como lo dice Doña Gloria. Una oficina cerrada no dice cuál ni de quién: "en su
 * oficina" si es la suya, "en una oficina" si es de otro.
 */
export function whereText(w: WhereInput): string {
  if (w.office?.locked) return w.office.mine ? "En su oficina" : "En una oficina";
  if (w.office) return w.office.mine ? `En su oficina · ${w.areaName}` : `${w.zoneName} · ${w.areaName}`;
  if (!w.zoneName) return w.areaName;
  return `${w.atDoor ? "Entrada · " : ""}${w.zoneName} · ${w.areaName}`;
}
