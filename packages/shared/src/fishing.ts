// Fase 5: la pesca en el lago del jardín, estilo Stardew Valley. Aquí están el catálogo de peces (y la
// basura), la rareza con sus pesos, el horario (hora de Bogotá), los tiempos del lance y los mensajes. El
// minijuego (que repiten igual el cliente y el servidor) está en fishing-sim.ts.
import { z } from "zod";
import { dayStart } from "./points";
import { SIM_FRAME_MS, SIM_MAX_FRAMES, minReelFrames } from "./fishing-sim";

export const FISH_RARITIES = ["comun", "poco-comun", "raro", "epico", "legendario", "basura"] as const;
export type FishRarity = (typeof FISH_RARITIES)[number];

/**
 * Cómo se mueve el pez en la barra (los mismos de Stardew): `mixed` va y viene, `smooth` se desliza
 * parejo, `sinker` tira hacia el fondo, `floater` hacia arriba y `dart` pega saltos bruscos.
 */
export const FISH_BEHAVIORS = ["mixed", "smooth", "sinker", "floater", "dart"] as const;
export type FishBehavior = (typeof FISH_BEHAVIORS)[number];

/** Cuándo pica: de día (6:00 a 18:00 de Bogotá), de noche o siempre. */
export type FishTime = "dia" | "noche" | "siempre";

export interface RarityInfo {
  label: string;
  /** Peso de probabilidad de cada especie de esta rareza (se reparte entre las que pican a esa hora). */
  weight: number;
  /** Dificultad del minijuego (0 a 110, como en Stardew): la de cada pez cae en este rango. */
  difficulty: [number, number];
  /** Puntos (motivo LEISURE, con el tope diario) por atrapar uno. */
  points: number;
  /** Color del brillo (hex) en el arte y en la interfaz. */
  color: string;
}

export const RARITY: Record<FishRarity, RarityInfo> = {
  comun: { label: "Común", weight: 100, difficulty: [12, 35], points: 2, color: "#9a95a0" },
  "poco-comun": { label: "Poco común", weight: 45, difficulty: [35, 55], points: 4, color: "#5f9a6d" },
  raro: { label: "Raro", weight: 18, difficulty: [55, 75], points: 7, color: "#4a70a0" },
  epico: { label: "Épico", weight: 7, difficulty: [75, 92], points: 12, color: "#9459ba" },
  legendario: { label: "Legendario", weight: 2, difficulty: [95, 110], points: 25, color: "#dcae3f" },
  basura: { label: "Basura", weight: 14, difficulty: [0, 0], points: 0, color: "#76727c" },
};

export interface FishSpecies {
  id: string;
  name: string;
  rarity: FishRarity;
  /** Tamaño en centímetros (el servidor sortea uno en este rango al atraparlo). */
  size: [number, number];
  time: FishTime;
  behavior: FishBehavior;
  /** Dificultad (0 a 110): dentro del rango de su rareza. */
  difficulty: number;
  description: string;
}

const fish = (
  id: string,
  name: string,
  rarity: FishRarity,
  size: [number, number],
  time: FishTime,
  behavior: FishBehavior,
  difficulty: number,
  description: string,
): FishSpecies => ({ id, name, rarity, size, time, behavior, difficulty, description });

/** Todo lo que sale del lago, de lo más común a lo legendario, y la basura al final. */
export const FISH: readonly FishSpecies[] = [
  // Comunes
  fish("mojarra", "Mojarra", "comun", [10, 22], "siempre", "mixed", 15, "La de todos los días: plateada, chiquita y confiada."),
  fish("sardinata", "Sardinata", "comun", [8, 18], "siempre", "dart", 22, "Flaca y nerviosa; se mueve a los saltos."),
  fish("carpa", "Carpa", "comun", [25, 60], "siempre", "smooth", 18, "Tranquila y panzona. Vive en el barro del fondo."),
  fish("bocachico", "Bocachico", "comun", [20, 40], "dia", "sinker", 24, "Se asoma con la boquita fruncida buscando algas."),
  fish("tilapia", "Tilapia roja", "comun", [15, 35], "dia", "mixed", 20, "Rosada como un atardecer; favorita del almuerzo."),
  fish("guppy", "Guppy", "comun", [3, 6], "dia", "dart", 26, "Diminuto y con una cola de colores de fiesta."),
  fish("perca", "Perca", "comun", [15, 35], "siempre", "mixed", 30, "Rayada como tigre y con la aleta de espinas."),
  fish("pez-dorado", "Pececito dorado", "comun", [5, 15], "siempre", "floater", 14, "Alguien lo soltó en el lago y se quedó a vivir."),
  fish("barbudo", "Barbudo", "comun", [20, 45], "noche", "sinker", 28, "Bigotes largos para buscar comida a oscuras."),
  fish("corroncho", "Corroncho", "comun", [10, 25], "noche", "sinker", 33, "Acorazado y terco: se pega a las piedras."),
  // Poco comunes
  fish("trucha", "Trucha arcoíris", "poco-comun", [25, 55], "dia", "mixed", 40, "Una franja rosada de punta a punta. Le gusta el agua fría."),
  fish("cachama", "Cachama", "poco-comun", [30, 70], "dia", "smooth", 38, "Redonda y fuerte; tira parejo, sin prisa."),
  fish("bagre-rayado", "Bagre rayado", "poco-comun", [40, 90], "noche", "sinker", 46, "Sale de noche, con rayas oscuras y bigotes de señor."),
  fish("anguila", "Anguila", "poco-comun", [40, 100], "noche", "smooth", 50, "Larga como una media. Resbala entre los dedos."),
  fish("lucio", "Lucio", "poco-comun", [40, 90], "siempre", "dart", 53, "Cazador de hocico largo que ataca de sorpresa."),
  fish("pez-luna", "Pez luna", "poco-comun", [10, 25], "dia", "floater", 36, "Plano y brillante, con un lunar azul en la cara."),
  fish("capitan", "Capitán de la sabana", "poco-comun", [10, 30], "noche", "sinker", 43, "Un bagrecito de la sabana de Bogotá. ¡Qué suerte verlo!"),
  fish("pirana", "Piraña", "poco-comun", [15, 30], "dia", "dart", 48, "Barriga roja y dientes de serrucho. Mejor no la toques."),
  // Raros
  fish("arawana", "Arawana", "raro", [50, 90], "dia", "floater", 60, "Salta fuera del agua para cazar insectos al vuelo."),
  fish("pavon", "Pavón", "raro", [30, 70], "dia", "dart", 68, "Un ojo pintado en la cola para confundir a los demás."),
  fish("koi", "Koi", "raro", [30, 70], "siempre", "smooth", 58, "Manchas blancas, rojas y negras. Dicen que trae suerte."),
  fish("esturion", "Esturión", "raro", [80, 160], "siempre", "sinker", 72, "Tiene placas de hueso en el lomo; es más viejo que la casa."),
  fish("pez-globo", "Pez globo", "raro", [10, 30], "dia", "floater", 63, "Se infla del susto. No es nada personal."),
  fish("pez-linterna", "Pez linterna", "raro", [8, 20], "noche", "mixed", 66, "Lleva una lucecita colgando para alumbrar el fondo."),
  // Épicos
  fish("pirarucu", "Pirarucú", "epico", [150, 280], "dia", "smooth", 80, "Un gigante de escamas rojas que respira aire."),
  fish("dorado", "Dorado", "epico", [50, 100], "dia", "dart", 88, "El tigre del río: dorado entero y con la cola rayada."),
  fish("raya", "Raya de agua dulce", "epico", [40, 90], "noche", "sinker", 84, "Un plato con lunares que planea pegado al fondo."),
  fish("pez-fantasma", "Pez fantasma", "epico", [20, 40], "noche", "mixed", 79, "Casi transparente. Se le ven las espinas."),
  // Legendarios
  fish("bigoton", "El Bigotón", "legendario", [180, 260], "siempre", "sinker", 98, "El bagre más viejo del lago. Nadie lo ha visto dos veces."),
  fish("carpa-jade", "Carpa de jade", "legendario", [60, 110], "dia", "smooth", 104, "Verde como la piedra, con aletas de velo. Brilla bajo el sol."),
  fish("luminaria", "Luminaria de medianoche", "legendario", [40, 80], "noche", "mixed", 108, "Solo pica de noche: un destello azul que nada como estrella fugaz."),
  // Basura (sin minijuego ni puntos)
  fish("bota", "Bota vieja", "basura", [25, 30], "siempre", "sinker", 0, "Llena de agua y de un poco de lodo. ¿De quién será?"),
  fish("alga", "Alga", "basura", [10, 60], "siempre", "floater", 0, "Verde, viscosa y enredada en el anzuelo."),
  fish("lata", "Lata oxidada", "basura", [8, 12], "siempre", "sinker", 0, "Alguien no reciclaba. Ahora el lago está un poco más limpio."),
];

const BY_ID = new Map(FISH.map((f) => [f.id, f]));
export const fishById = (id: string): FishSpecies | undefined => BY_ID.get(id);
export const isTrash = (f: FishSpecies) => f.rarity === "basura";

// ---------- Horario (hora de Bogotá) ----------

/** Hora de Bogotá (0 a 23) de `ts`. */
export function bogotaHour(ts: number): number {
  return Math.floor((ts - dayStart(ts)) / 3_600_000);
}

/** ¿Es de día en Bogotá? (6:00 a 17:59). */
export const isBogotaDay = (ts: number) => {
  const h = bogotaHour(ts);
  return h >= 6 && h < 18;
};

/** ¿Pica este pez a esta hora? */
export function fishAvailable(f: FishSpecies, ts: number): boolean {
  if (f.time === "siempre") return true;
  return (f.time === "dia") === isBogotaDay(ts);
}

/**
 * Lo que puede picar ahora, con su peso: cada especie pesa lo de su rareza. `random(n)` da un entero en
 * [0, n) (en el servidor, `crypto.randomInt`; en los tests, uno fijo).
 */
export function fishPool(ts: number): { fish: FishSpecies; weight: number }[] {
  return FISH.filter((f) => fishAvailable(f, ts)).map((f) => ({ fish: f, weight: RARITY[f.rarity].weight }));
}

export function pickFish(ts: number, random: (n: number) => number): FishSpecies {
  const pool = fishPool(ts);
  const total = pool.reduce((a, p) => a + p.weight, 0);
  let r = random(total);
  for (const p of pool) {
    if (r < p.weight) return p.fish;
    r -= p.weight;
  }
  return pool.at(-1)!.fish;
}

/**
 * Tamaño al atraparlo: los grandes cuestan más (la curva favorece los chicos, así un récord vale algo).
 * Siempre dentro de [mín, máx].
 */
export function rollSize(f: FishSpecies, random: (n: number) => number): number {
  const [min, max] = f.size;
  const u = random(10_001) / 10_000;
  return Math.min(max, Math.max(min, min + Math.round((max - min) * u ** 1.5)));
}

// ---------- Reglas del lance ----------

export const FISHING = {
  /** Espera hasta que pica (al azar entre estos dos). */
  biteMinMs: 2_500,
  biteMaxMs: 9_000,
  /** Cuánto dura la picada: si no respondes a tiempo, el pez se va. */
  biteWindowMs: 1_600,
  /** Tope del minijuego: pasado este tiempo el pez se suelta. */
  reelMaxMs: 120_000,
  /** Margen para la latencia al comparar el tiempo del minijuego con el reloj del servidor. */
  slackMs: 1_200,
  /** Cuánto se ve el pez levantado sobre la cabeza al atraparlo. */
  showMs: 2_600,
  /** Probabilidad (en milésimas) de que aparezca un cofre de tesoro en el minijuego. */
  treasurePerMil: 150,
  /** Puntos extra (LEISURE) por sacar el cofre. */
  treasureBonus: 3,
  /** Si te mueves más que esto (px de mundo) se recoge el sedal. */
  moveTolerancePx: 6,
} as const;

export type FishingTimings = Pick<typeof FISHING, "biteMinMs" | "biteMaxMs" | "biteWindowMs" | "reelMaxMs" | "slackMs" | "showMs">;

/** Puntos por un pez (la basura no da). */
export const fishPoints = (f: FishSpecies) => RARITY[f.rarity].points;

/** Tiempo mínimo posible del minijuego para esta dificultad (el pez siempre dentro de la barra). */
export const minReelMs = (difficulty: number) => minReelFrames(difficulty) * SIM_FRAME_MS;

/** Estado de pesca de cada persona como viaja en `Player.fishing` (lo ven todos los del nivel). */
export type FishingPhase = "" | "wait" | "bite" | "reel" | `show:${string}`;

// ---------- Mensajes ----------

/** Cliente → servidor (`MSG.fishHook`): respondo a la picada. */
export const FishHookMessage = z.object({ castId: z.string().min(1).max(64) });
export type FishHookMessage = z.infer<typeof FishHookMessage>;

/**
 * Cliente → servidor (`MSG.fishFinish`): terminé el minijuego. `inputs` son los frames en los que cambió
 * el botón (apretado/suelto, empezando suelto) y `frames` cuántos duró: el servidor lo repite igual.
 */
export const FishFinishMessage = z.object({
  castId: z.string().min(1).max(64),
  frames: z.number().int().min(1).max(SIM_MAX_FRAMES),
  inputs: z.array(z.number().int().min(0).max(SIM_MAX_FRAMES)).max(8_000),
});
export type FishFinishMessage = z.infer<typeof FishFinishMessage>;

/** Lo que el cliente necesita para jugar el minijuego (no dice qué pez es: se sabe al sacarlo). */
export interface FishingChallenge {
  seed: number;
  difficulty: number;
  behavior: FishBehavior;
  rarity: FishRarity;
  /** Si aparece el cofre de tesoro (lo sortea el servidor). */
  treasure: boolean;
}

export interface FishCatchResult {
  species: string;
  size: number;
  /** Más grande que todos los anteriores de esa especie (o el primero). */
  record: boolean;
  /** Primera vez que la atrapa. */
  first: boolean;
  /** Puntos que se sumaron de verdad (pez + tesoro, con el tope diario). */
  points: number;
  treasure: boolean;
}

export type FishOutcome = "caught" | "escaped" | "missed" | "early" | "cancelled" | "invalid" | "timeout";
export type FishRefusal = "far" | "busy" | "seated";

/** Servidor → quien pesca (`MSG.fishEvent`). */
export type FishingEvent =
  | { type: "cast"; castId: string }
  | { type: "bite"; castId: string; windowMs: number }
  | { type: "start"; castId: string; challenge: FishingChallenge }
  | { type: "end"; castId: string; outcome: FishOutcome; catch?: FishCatchResult }
  | { type: "refused"; error: FishRefusal };

/** Un renglón del álbum (GET /api/fishing): cuántos, el más grande y cuándo fue el último. */
export interface FishAlbumEntry {
  species: string;
  count: number;
  best: number;
  lastAt: string;
}
