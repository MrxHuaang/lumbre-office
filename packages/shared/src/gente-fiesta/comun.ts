// Atajos para declarar la gente de un festival (ver gente-fiesta.ts): un vecino de la vereda en su papel de
// la fiesta (con su nombre, voz y pinta, más lo que el festival le cambie de ropa) o alguien suelto (un niño
// disfrazado, un turista, el perro de Mariana).
import type { FiestaNpc } from "../gente-fiesta";
import type { Look } from "../look";
import { VECINOS, vestirVecino, type CambioDePinta, type VecinoId } from "./vecinos";

/** Minuto del día del juego. */
export const hora = (h: number, m = 0) => h * 60 + m;

/** Un vecino de la vereda en un papel de la fiesta. El id lleva el prefijo del festival. */
export function papel(
  festival: string,
  id: VecinoId,
  datos: Omit<FiestaNpc, "id" | "nombre" | "look" | "voz" | "vecino"> & { pinta?: CambioDePinta },
): FiestaNpc {
  const { pinta, ...rest } = datos;
  const v = VECINOS[id];
  return { ...rest, id: `${festival}:${id}`, nombre: v.nombre, look: vestirVecino(id, pinta), voz: v.voz, vecino: id };
}

/** Alguien que no es de los vecinos (un niño disfrazado, un turista): con su pinta completa. */
export function suelto(festival: string, id: string, nombre: string, look: Omit<Look, "accessories">, datos: Omit<FiestaNpc, "id" | "nombre" | "look">): FiestaNpc {
  return { ...datos, id: `${festival}:${id}`, nombre, look: { accessories: [], ...look } };
}

/** Pinta de un niño (para los que no son vecinos). */
export const nino = (skin: string, hair: string, extra: Partial<Omit<Look, "accessories">> = {}): Omit<Look, "accessories"> => ({
  skin,
  hair,
  shirt: "#e0923e",
  pants: "#3a4a6a",
  accent: "#f2c84a",
  hairStyle: "short",
  eyes: "big",
  top: "tshirt",
  bottom: "shorts",
  shoes: "sneakers",
  shoeColor: "#e8e4dc",
  ...extra,
});

/** Canelo, el perro de Mariana: la sigue a donde vaya. */
export function canelo(festival: string, sigueA: string, tile: { x: number; y: number }, extra: Partial<FiestaNpc> = {}): FiestaNpc {
  return {
    id: `${festival}:canelo`,
    nombre: "Canelo",
    rol: "El perro de Mariana",
    area: "jardin",
    tile,
    comportamiento: { tipo: "sigue", a: sigueA, distancia: 1.1, corre: true },
    look: { ...vestirVecino("mariana"), accessories: [] },
    animal: { especie: "perro", pelaje: "cafe" },
    frases: { hola: ["¡Guau!", "Canelo mueve la cola y le olfatea los zapatos.", "Canelo se sienta y le pone la pata."] },
    murmullos: ["¡Guau!", "¡Guau, guau!"],
    voz: 0.85,
    ...extra,
  };
}
