// Fase 5: la pesca en el lago del jardín, estilo Stardew Valley. Aquí están el catálogo de peces (y la
// basura), la rareza con sus pesos, el horario (hora de Bogotá), el clima que piden algunos, los tiempos
// del lance y los mensajes. El minijuego (que repiten igual el cliente y el servidor) está en fishing-sim.ts.
import { z } from "zod";
import type { Weather } from "./weather";
import { dayStart } from "./points";
import { SIM_FRAME_MS, SIM_MAX_FRAMES, minReelFrames, type FishingRod } from "./fishing-sim";

export const FISH_RARITIES = ["comun", "poco-comun", "raro", "epico", "legendario", "mitico", "basura"] as const;
export type FishRarity = (typeof FISH_RARITIES)[number];

/**
 * Cómo se mueve el pez en la barra (los mismos de Stardew): `mixed` va y viene, `smooth` se desliza
 * parejo, `sinker` tira hacia el fondo, `floater` hacia arriba y `dart` pega saltos bruscos.
 */
export const FISH_BEHAVIORS = ["mixed", "smooth", "sinker", "floater", "dart"] as const;
export type FishBehavior = (typeof FISH_BEHAVIORS)[number];

/**
 * Cuándo pica (hora de Bogotá): de día (6:00 a 17:59), de noche, siempre, al atardecer (17:00 a 19:59) o
 * en la madrugada (0:00 a 3:59).
 */
export type FishTime = "dia" | "noche" | "siempre" | "atardecer" | "madrugada";

/** Clima que pide un pez para picar: `lluvia` vale con lluvia o tormenta; `tormenta` y `niebla`, solo esas. */
export type FishWeather = "lluvia" | "tormenta" | "niebla";

export interface RarityInfo {
  label: string;
  /** Peso de probabilidad de cada especie de esta rareza (se reparte entre las que pican a esa hora). */
  weight: number;
  /** Dificultad del minijuego (0 a 120; Stardew llega a 110): la de cada pez cae en este rango. */
  difficulty: [number, number];
  /** Puntos (motivo LEISURE, con el tope diario) por atrapar uno. */
  points: number;
  /** Color del brillo (hex) en el arte y en la interfaz. */
  color: string;
}

export const RARITY: Record<FishRarity, RarityInfo> = {
  comun: { label: "Común", weight: 200, difficulty: [18, 42], points: 2, color: "#9a95a0" },
  "poco-comun": { label: "Poco común", weight: 80, difficulty: [42, 62], points: 5, color: "#5f9a6d" },
  raro: { label: "Raro", weight: 28, difficulty: [62, 80], points: 9, color: "#4a70a0" },
  epico: { label: "Épico", weight: 9, difficulty: [80, 95], points: 16, color: "#9459ba" },
  legendario: { label: "Legendario", weight: 3, difficulty: [98, 112], points: 32, color: "#dcae3f" },
  mitico: { label: "Mítico", weight: 1, difficulty: [114, 120], points: 60, color: "#e0359f" },
  basura: { label: "Basura", weight: 22, difficulty: [0, 0], points: 0, color: "#76727c" },
};

export interface FishSpecies {
  id: string;
  name: string;
  rarity: FishRarity;
  /** Tamaño en centímetros (el servidor sortea uno en este rango al atraparlo). */
  size: [number, number];
  time: FishTime;
  behavior: FishBehavior;
  /** Dificultad (0 a 120): dentro del rango de su rareza. */
  difficulty: number;
  description: string;
  /** Si solo pica con cierto clima. */
  weather?: FishWeather;
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
  weather?: FishWeather,
): FishSpecies => ({ id, name, rarity, size, time, behavior, difficulty, description, ...(weather ? { weather } : {}) });

/** Todo lo que sale del lago, de lo más común a lo mítico, y la basura al final. */
export const FISH: readonly FishSpecies[] = [
  // Comunes
  fish("mojarra", "Mojarra", "comun", [10, 22], "siempre", "mixed", 18, "La de todos los días: plateada, chiquita y confiada."),
  fish("sardinata", "Sardinata", "comun", [8, 18], "siempre", "dart", 26, "Flaca y nerviosa; se mueve a los saltos."),
  fish("carpa", "Carpa", "comun", [25, 60], "siempre", "smooth", 22, "Tranquila y panzona. Vive en el barro del fondo."),
  fish("bocachico", "Bocachico", "comun", [20, 40], "dia", "sinker", 28, "Se asoma con la boquita fruncida buscando algas."),
  fish("tilapia", "Tilapia roja", "comun", [15, 35], "dia", "mixed", 24, "Rosada como un atardecer; favorita del almuerzo."),
  fish("guppy", "Guppy", "comun", [3, 6], "dia", "dart", 30, "Diminuto y con una cola de colores de fiesta."),
  fish("perca", "Perca", "comun", [15, 35], "siempre", "mixed", 34, "Rayada como tigre y con la aleta de espinas."),
  fish("pez-dorado", "Pececito dorado", "comun", [5, 15], "siempre", "floater", 19, "Alguien lo soltó en el lago y se quedó a vivir."),
  fish("barbudo", "Barbudo", "comun", [20, 45], "noche", "sinker", 32, "Bigotes largos para buscar comida a oscuras."),
  fish("corroncho", "Corroncho", "comun", [10, 25], "noche", "sinker", 37, "Acorazado y terco: se pega a las piedras."),
  fish("sabaleta", "Sabaleta", "comun", [12, 28], "dia", "mixed", 31, "Plateada y con la cola roja; salta contra la corriente."),
  fish("pez-cebra", "Pez cebra", "comun", [3, 5], "dia", "dart", 35, "Rayas azules de pijama. Nunca anda solo."),
  fish("moncholo", "Moncholo", "comun", [15, 35], "noche", "mixed", 38, "Cabezón y bocón; muerde lo que sea que se mueva."),
  fish("cucha", "Cucha", "comun", [10, 30], "siempre", "sinker", 40, "Con ventosa en la boca: limpia las piedras del muelle."),
  fish("tetra", "Tetra neón", "comun", [2, 4], "siempre", "dart", 41, "Una rayita azul que brilla hasta en el agua turbia."),
  fish("renacuajo", "Pez renacuajo", "comun", [4, 8], "siempre", "floater", 27, "Cabeza gorda y cola larga. Sale a jugar cuando llueve.", "lluvia"),
  // Poco comunes
  fish("trucha", "Trucha arcoíris", "poco-comun", [25, 55], "dia", "mixed", 45, "Una franja rosada de punta a punta. Le gusta el agua fría."),
  fish("cachama", "Cachama", "poco-comun", [30, 70], "dia", "smooth", 43, "Redonda y fuerte; tira parejo, sin prisa."),
  fish("bagre-rayado", "Bagre rayado", "poco-comun", [40, 90], "noche", "sinker", 51, "Sale de noche, con rayas oscuras y bigotes de señor."),
  fish("anguila", "Anguila", "poco-comun", [40, 100], "noche", "smooth", 55, "Larga como una media. Resbala entre los dedos."),
  fish("lucio", "Lucio", "poco-comun", [40, 90], "siempre", "dart", 58, "Cazador de hocico largo que ataca de sorpresa."),
  fish("pez-luna", "Pez luna", "poco-comun", [10, 25], "dia", "floater", 42, "Plano y brillante, con un lunar azul en la cara."),
  fish("capitan", "Capitán de la sabana", "poco-comun", [10, 30], "noche", "sinker", 48, "Un bagrecito de la sabana de Bogotá. ¡Qué suerte verlo!"),
  fish("pirana", "Piraña", "poco-comun", [15, 30], "dia", "dart", 54, "Barriga roja y dientes de serrucho. Mejor no la toques."),
  fish("mojarra-azul", "Mojarra azul", "poco-comun", [12, 28], "dia", "mixed", 47, "La prima elegante de la mojarra: azul con escamas de espejo."),
  fish("rubio", "Rubio", "poco-comun", [30, 60], "dia", "smooth", 50, "Dorado pálido; tira con más fuerza de la que aparenta."),
  fish("pez-angel", "Pez ángel", "poco-comun", [8, 20], "dia", "floater", 53, "Aletas de bandera y paso de desfile."),
  fish("blanquillo", "Blanquillo", "poco-comun", [30, 70], "noche", "smooth", 57, "Un bagre blanco como la luna llena."),
  fish("guabina", "Guabina", "poco-comun", [15, 35], "atardecer", "dart", 60, "Espera quieta entre las raíces y muerde de golpe al caer el sol."),
  fish("pez-hoja", "Pez hoja", "poco-comun", [6, 12], "siempre", "floater", 61, "Se hace pasar por hoja seca. Con la neblina casi funciona.", "niebla"),
  fish("bagre-sapo", "Bagre sapo", "poco-comun", [20, 45], "noche", "sinker", 59, "Boca de sapo y cara de pocos amigos. Sale con el aguacero.", "lluvia"),
  // Raros
  fish("arawana", "Arawana", "raro", [50, 90], "dia", "floater", 65, "Salta fuera del agua para cazar insectos al vuelo."),
  fish("pavon", "Pavón", "raro", [30, 70], "dia", "dart", 73, "Un ojo pintado en la cola para confundir a los demás."),
  fish("koi", "Koi", "raro", [30, 70], "siempre", "smooth", 63, "Manchas blancas, rojas y negras. Dicen que trae suerte."),
  fish("esturion", "Esturión", "raro", [80, 160], "siempre", "sinker", 77, "Tiene placas de hueso en el lomo; es más viejo que la casa."),
  fish("pez-globo", "Pez globo", "raro", [10, 30], "dia", "floater", 68, "Se infla del susto. No es nada personal."),
  fish("pez-linterna", "Pez linterna", "raro", [8, 20], "noche", "mixed", 71, "Lleva una lucecita colgando para alumbrar el fondo."),
  fish("disco", "Pez disco", "raro", [12, 20], "dia", "floater", 70, "Redondo como un plato y pintado con mil rayitas."),
  fish("payara", "Payara", "raro", [40, 90], "noche", "dart", 79, "El pez vampiro: dos colmillos que le atraviesan la cara."),
  fish("bagre-amarillo", "Bagre amarillo", "raro", [70, 140], "siempre", "sinker", 76, "Un bagre enorme y color mostaza. Tira como un burro."),
  fish("pez-mariposa", "Pez mariposa", "raro", [8, 18], "dia", "floater", 66, "Con las aletas abiertas planea sobre el agua."),
  fish("arcoiris", "Pez arcoíris", "raro", [6, 14], "siempre", "mixed", 74, "Solo sale cuando llueve. Trae todos los colores encima.", "lluvia"),
  fish("temblon", "Temblón", "raro", [60, 150], "siempre", "smooth", 80, "Una anguila eléctrica. Con los truenos se pone contenta.", "tormenta"),
  // Épicos
  fish("pirarucu", "Pirarucú", "epico", [150, 280], "dia", "smooth", 85, "Un gigante de escamas rojas que respira aire."),
  fish("dorado", "Dorado", "epico", [50, 100], "dia", "dart", 92, "El tigre del río: dorado entero y con la cola rayada."),
  fish("raya", "Raya de agua dulce", "epico", [40, 90], "noche", "sinker", 89, "Un plato con lunares que planea pegado al fondo."),
  fish("pez-fantasma", "Pez fantasma", "epico", [20, 40], "noche", "mixed", 84, "Casi transparente. Se le ven las espinas."),
  fish("lau-lau", "Lau-lau", "epico", [100, 250], "siempre", "sinker", 91, "El bagre valentón del Amazonas. Se traga lo que le quepa."),
  fish("tiburon-toro", "Tiburón toro", "epico", [150, 250], "siempre", "dart", 94, "Sube por los ríos desde el mar. Nadie sabe cómo llegó aquí."),
  fish("sol-poniente", "Pez sol poniente", "epico", [20, 45], "atardecer", "floater", 86, "Naranja y violeta: solo pica mientras se esconde el sol."),
  fish("cuchillo", "Pez cuchillo", "epico", [30, 50], "noche", "smooth", 88, "Negro como la noche y con la cola blanca. Nada para atrás."),
  fish("pez-niebla", "Pez niebla", "epico", [30, 60], "siempre", "mixed", 90, "Se ve y no se ve. Aparece con la neblina.", "niebla"),
  // Legendarios
  fish("bigoton", "El Bigotón", "legendario", [180, 260], "siempre", "sinker", 102, "El bagre más viejo del lago. Nadie lo ha visto dos veces."),
  fish("carpa-jade", "Carpa de jade", "legendario", [60, 110], "dia", "smooth", 110, "Verde como la piedra, con aletas de velo. Brilla bajo el sol."),
  fish("luminaria", "Luminaria de medianoche", "legendario", [40, 80], "noche", "mixed", 108, "Solo pica de noche: un destello azul que nada como estrella fugaz."),
  fish("rey-tormenta", "Rey de la tormenta", "legendario", [90, 170], "siempre", "dart", 100, "Plateado y rayado de relámpagos. Solo sale bajo los truenos.", "tormenta"),
  fish("madre-agua", "La Madre de agua", "legendario", [120, 200], "madrugada", "smooth", 112, "Dicen que cuida el lago. Pica en la madrugada, cuando nadie mira."),
  // Míticos
  fish("guatavita", "Pez de Guatavita", "mitico", [50, 90], "dia", "mixed", 114, "De oro puro, como las ofrendas de la laguna sagrada. ¿Leyenda? Ya no."),
  fish("monstruo-tota", "El monstruo de Tota", "mitico", [300, 500], "madrugada", "sinker", 116, "La serpiente negra de la laguna de Tota. Nadie creía que existiera."),
  fish("estrella-lluvia", "Estrella de lluvia", "mitico", [20, 40], "noche", "smooth", 118, "Cae con el aguacero nocturno y se desliza como un cometa.", "lluvia"),
  // Basura (sin minijuego ni puntos)
  fish("bota", "Bota vieja", "basura", [25, 30], "siempre", "sinker", 0, "Llena de agua y de un poco de lodo. ¿De quién será?"),
  fish("alga", "Alga", "basura", [10, 60], "siempre", "floater", 0, "Verde, viscosa y enredada en el anzuelo."),
  fish("botella", "Botella con mensaje", "basura", [20, 30], "siempre", "floater", 0, "Adentro dice: \"Buen trabajo, equipo\". Nadie firmó."),
  fish("calcetin", "Calcetín", "basura", [15, 25], "siempre", "sinker", 0, "El que se perdió en la lavadora. Ahora vive aquí."),
  fish("patito", "Patito de hule", "basura", [6, 10], "siempre", "floater", 0, "Amarillo, sonriente y sin idea de cómo llegó al lago."),
  fish("lata", "Lata oxidada", "basura", [8, 12], "siempre", "sinker", 0, "Alguien no reciclaba. Ahora el lago está un poco más limpio."),
];

const BY_ID = new Map(FISH.map((f) => [f.id, f]));
export const fishById = (id: string): FishSpecies | undefined => BY_ID.get(id);
export const isTrash = (f: FishSpecies) => f.rarity === "basura";

// ---------- Horario (hora del juego) ----------

/** Hora de Bogotá (0 a 23) de `ts`. Solo para lo que va con la hora real (logros de madrugador y búho). */
export function bogotaHour(ts: number): number {
  return Math.floor((ts - dayStart(ts)) / 3_600_000);
}

/** ¿Es de día para los peces? (6:00 a 17:59 del reloj del juego). */
export const isFishDayHour = (hour: number) => hour >= 6 && hour < 18;

/**
 * ¿Pica este pez a esta hora del juego (0 a 23, ver clock.ts) y con este clima? Sin clima conocido, los
 * que piden uno no pican.
 */
export function fishAvailable(f: FishSpecies, hour: number, weather?: Weather): boolean {
  if (f.weather && !weatherMatches(f.weather, weather)) return false;
  switch (f.time) {
    case "siempre":
      return true;
    case "atardecer":
      return hour >= 17 && hour < 20;
    case "madrugada":
      return hour < 4;
    default:
      return (f.time === "dia") === isFishDayHour(hour);
  }
}

function weatherMatches(want: FishWeather, now: Weather | undefined): boolean {
  if (want === "lluvia") return now === "lluvia" || now === "tormenta";
  return now === want;
}

/** Las rarezas que la carnada hace picar más (ver `luck`). */
export const LUCKY_RARITIES: readonly FishRarity[] = ["raro", "epico", "legendario", "mitico"];

/**
 * Lo que puede picar a esta hora del juego, con su peso: cada especie pesa lo de su rareza. `random(n)` da un entero en
 * [0, n) (en el servidor, `crypto.randomInt`; en los tests, uno fijo). Con `luck` > 1 (la carnada del
 * puesto de pesca) los raros y lo de más arriba pesan más: los pesos se pasan a décimas para que hasta el
 * mítico (peso 1) note la diferencia. Sin carnada (`luck` = 1) quedan los pesos de siempre.
 */
export function fishPool(hour: number, weather?: Weather, luck = 1): { fish: FishSpecies; weight: number }[] {
  const weightOf = (f: FishSpecies) => {
    const w = RARITY[f.rarity].weight;
    if (luck === 1) return w;
    return Math.round(w * 10 * (LUCKY_RARITIES.includes(f.rarity) ? luck : 1));
  };
  return FISH.filter((f) => fishAvailable(f, hour, weather)).map((f) => ({ fish: f, weight: weightOf(f) }));
}

/** Elige el pez que pica a esta hora del juego (`luck`: la carnada, ver `fishPool`). */
export function pickFish(hour: number, random: (n: number) => number, weather?: Weather, luck = 1): FishSpecies {
  const pool = fishPool(hour, weather, luck);
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
  biteWindowMs: 1_100,
  /** Tope del minijuego: pasado este tiempo el pez se suelta. */
  reelMaxMs: 120_000,
  /** Margen para la latencia al comparar el tiempo del minijuego con el reloj del servidor. */
  slackMs: 1_200,
  /** Cuánto se ve el pez levantado sobre la cabeza al atraparlo. */
  showMs: 2_600,
  /** Probabilidad (en milésimas) de que aparezca un cofre de tesoro en el minijuego. */
  treasurePerMil: 120,
  /** Puntos extra (LEISURE) por sacar el cofre. */
  treasureBonus: 3,
  /** Si te mueves más que esto (px de mundo) se recoge el sedal. */
  moveTolerancePx: 6,
} as const;

/** Los tiempos del lance (el servidor los toma de `FISHING`; los tests los acortan). */
export interface FishingTimings {
  biteMinMs: number;
  biteMaxMs: number;
  biteWindowMs: number;
  reelMaxMs: number;
  slackMs: number;
  showMs: number;
}

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
  /** La caña con que se pesca (la decide el servidor con lo que uno tiene; sin esto, la de bambú). */
  rod?: FishingRod;
  /** Barra más larga por el oficio de Pesca (lo decide el servidor con el nivel; ver oficios.ts). */
  barBonus?: number;
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
