// Casa viva: las mascotas de la casa. Las mueve el servidor (deambulan a paso lento por su nivel, con
// rutas del A* del mundo, y a veces duermen en su cama); todos las ven por el estado de la sala. Se les
// hace clic para llamarlas, y de cerca se acarician o se les da un premio.
import { z } from "zod";

export type PetKind = "gato" | "perro";
/** Pelaje: define los colores del dibujo (packages/map/src/art/mascotas.ts). */
export type PetCoat = "naranja" | "gris" | "cafe";

export interface PetDef {
  id: string;
  name: string;
  kind: PetKind;
  coat: PetCoat;
  /** Nivel donde vive: nunca sale de él. */
  area: string;
  /** Tile de su cama (un mueble "pet-bed" del nivel). */
  bed: { x: number; y: number };
  /** Por dónde deambula (tiles del nivel): los destinos al azar se eligen adentro. */
  roam: { x: number; y: number; w: number; h: number };
}

export const PETS: readonly PetDef[] = [
  // Canela, la gata del salón: la chimenea, el pasillo y el recibidor.
  { id: "canela", name: "Canela", kind: "gato", coat: "naranja", area: "planta-baja", bed: { x: 10, y: 2 }, roam: { x: 0, y: 0, w: 24, h: 26 } },
  // Tobi, el perro del jardín: frente a la casa, entre el camino, la fogata y el lago.
  { id: "tobi", name: "Tobi", kind: "perro", coat: "cafe", area: "jardin", bed: { x: 58, y: 39 }, roam: { x: 22, y: 28, w: 40, h: 26 } },
  // Nube, el gato gris del piso 3: la sala de estar, el rincón de lectura y el pasillo.
  { id: "nube", name: "Nube", kind: "gato", coat: "gris", area: "piso-3", bed: { x: 9, y: 16 }, roam: { x: 0, y: 8, w: 32, h: 13 } },
];

export const petDef = (id: string) => PETS.find((p) => p.id === id);

export const PET = {
  /** Paso lento (px de mundo por segundo): las personas caminan a 150. */
  speed: 40,
  /** Cada cuánto las mueve el servidor. */
  tickMs: 150,
  /** Cuánto se queda quieta entre un paseo y otro. */
  idleMs: [3_000, 9_000] as const,
  /** Cuánto duerme cuando va a su cama, y la probabilidad de ir a dormir en vez de pasear. */
  sleepMs: [18_000, 40_000] as const,
  sleepChance: 0.2,
  /** Hasta dónde va a pasear desde donde está (tiles). */
  wanderTiles: 9,
  /** Desde qué distancia se la llama con un clic (tiles) y cuánto se queda mirándote. */
  callTiles: 14,
  followMs: 9_000,
  /** Desde dónde se acaricia o se le da un premio (tiles). */
  reachTiles: 1.8,
  petCooldownMs: 1_500,
  /** Pausa entre dos premios de la misma persona. */
  treatCooldownMs: 20_000,
  /** Cuánto dura comerse el premio. */
  eatMs: 2_500,
} as const;

/** Qué está haciendo (viaja en el estado): de pie, caminando, sentada, durmiendo o comiendo. */
export type PetPose = "stand" | "walk" | "sit" | "sleep" | "eat";

/** Nombres de los mensajes de las mascotas (aparte de MSG para no pisarse con lo demás). */
export const PET_MSG = {
  /** Cliente → servidor: "ven" (clic en la mascota). */
  call: "pet:call",
  /** Cliente → servidor: acariciar o dar un premio. */
  action: "pet:action",
  /** Servidor → clientes del nivel: alguien acarició, dio un premio o llamó a una mascota. */
  event: "pet:event",
} as const;

export const PetCallMessage = z.object({ pet: z.string().min(1).max(24) });
export type PetCallMessage = z.infer<typeof PetCallMessage>;

export const PetActionMessage = z.object({ pet: z.string().min(1).max(24), action: z.enum(["pet", "treat"]) });
export type PetActionMessage = z.infer<typeof PetActionMessage>;

export interface PetEvent {
  pet: string;
  sessionId: string;
  action: "pet" | "treat" | "call";
}
