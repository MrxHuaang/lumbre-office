// La historia de la cabaña. Capítulo 1, "La llegada": Doña Aurora, la casera, enseña lo básico en cinco
// pasos. Cada paso es un encargo de historia (período "historia", encadenado con `next`, ver encargos.ts):
// sigue un contador que ya existe, se entrega con E junto a ella y paga poquito (puntos QUEST que NO
// cuentan para el tope diario de los encargos: así la historia nunca le quita espacio al diario). Al
// entregar el último (o al saltarla) llega al buzón la primera carta del cuidador anterior, y con ella el
// logro "Recién llegado a la cabaña" (que sirve de insignia). Quien ya jugaba tiene los pasos que ya hizo
// marcados solos. Es puro: lo usan el servidor, la web (el buzón) y el navegador.
import { STAT_KEYS, STAT_PREFIX } from "./achievements";
import type { QuestDef, QuestSkill } from "./encargos";
import type { Weather } from "./weather";

export const CAPITULO_1 = { id: "llegada", title: "La llegada" } as const;

const step = (n: number, stat: string, skill: QuestSkill, title: string, text: string): QuestDef => ({
  id: `llegada-${n}`,
  kind: "story",
  giver: "aurora",
  title,
  text,
  stat,
  goal: 1,
  reward: { points: 5, skill, xp: 15 },
  ...(n < 5 ? { next: `llegada-${n + 1}` } : {}),
});

/** Los cinco pasos del capítulo 1, en orden. */
export const STORY_QUESTS: readonly QuestDef[] = [
  step(1, `${STAT_PREFIX.order}tinto`, "cocina", "Un tintico pa' empezar", "Pida un tinto en la barra de la cafetería. Lo pedido va a la mochila y a la mano."),
  step(2, STAT_KEYS.ownOfficeSits, "social", "Su rinconcito", "Siéntese en una silla de su oficina, la del piso 2. Ahí queda el PC, para sus notas."),
  step(3, STAT_KEYS.emotes, "social", "Buenas, buenas", "Salude a alguien con un emote o con Saludar. Si no hay nadie, salúdeme a mí, que yo sí contesto."),
  step(4, STAT_KEYS.fishCaught, "pesca", "Pa' la olla de Aurora", "Saque algo del lago. Don Evelio le presta la caña y le enseña el truco."),
  step(5, STAT_KEYS.boardReads, "exploracion", "Lo que dice el tablón", "Vaya a leer el tablón del jardín: ahí salen las misiones y los encargos del día."),
];

export const STORY_FIRST = STORY_QUESTS[0]!.id;
export const STORY_LAST = STORY_QUESTS[STORY_QUESTS.length - 1]!.id;
export const isStoryQuest = (id: string) => STORY_QUESTS.some((q) => q.id === id);

/**
 * `refId` de lo que paga un paso de historia (encargo:<id>:historia): termina así, y con eso el tope diario
 * de QUEST no lo cuenta.
 */
export const STORY_REF_SUFFIX = ":historia";

/** Lo que enseña cada paso, dicho por Doña Aurora al hablarle. */
export const STORY_LESSONS: Readonly<Record<string, string>> = {
  "llegada-1": "La mochila es su despensa: se abre con la I. Lo que elige en la barra de abajo es lo de la mano, y con F se lo toma.",
  "llegada-2": "Donde vea una silla, E y se sienta. En su oficina, el PC guarda sus notas y la puerta se cierra con candado.",
  "llegada-3": "Aquí la gente se oye de cerquita, como en una casa de verdad: arrímese para conversar y aléjese para la intimidad.",
  "llegada-4": "E junto al agua pa' lanzar; cuando pique, dele y mantenga el pez en la barra verde. En el puesto venden cañas y carnada.",
  "llegada-5": "En el tablón hay misiones que ponen los compañeros y encargos de la casa. Cumpla y me cuenta.",
};

/** Dónde queda lo que pide cada paso (para la flechita que lo señala). */
export const STORY_TARGET: Readonly<Record<string, { area: string; point?: string; office?: true }>> = {
  "llegada-1": { area: "planta-baja", point: "cafe_counter" },
  "llegada-2": { area: "piso-2", office: true },
  "llegada-3": { area: "planta-baja" },
  "llegada-4": { area: "jardin", point: "fishing_spot" },
  "llegada-5": { area: "jardin", point: "task_board" },
};

/** Los pasos que alguien que ya jugaba tiene hechos desde antes (sus contadores ya llegan a la meta). */
export function storyStepsDone(stats: Readonly<Record<string, number>>): string[] {
  return STORY_QUESTS.filter((q) => (stats[q.stat] ?? 0) >= q.goal).map((q) => q.id);
}

/** ¿Recién llegó? (entró por primera vez hace menos de 3 días): a esa persona la recibe el prólogo. */
export function isNewcomer(onboardedAt: number | undefined, now: number): boolean {
  return onboardedAt !== undefined && now - onboardedAt >= 0 && now - onboardedAt < 3 * 86_400_000;
}

// ---------- Lo que dice Doña Aurora ----------

export const AURORA_WELCOME = [
  "¡Ay, bienvenido, mijo! Yo soy Aurora, la que cuida esta casa desde que el cuidador de antes se fue… sin decir ni adiós.",
  "Le enseño lo básico en cinco pasitos, sin afán. Cuando termine cada uno, venga y me cuenta.",
];

export const AURORA_WELCOME_BUS = "¡Llegó en el Megabús! Bájese con cuidado, que el escaloncito engaña. Venga, que le muestro la casa.";

/** Lo que dice de vez en cuando (la misma frase para todos en ese rato), según la hora del juego y el clima. */
export function auroraIdleLine(hour: number, weather: Weather, seed: number): string {
  const pick = (lines: readonly string[]) => lines[Math.abs(seed) % lines.length]!;
  if (weather === "tormenta") return pick(["Con estos truenos, mejor quedarse adentro con un chocolatico.", "¡Jesús! Ese rayo cayó cerquita. Cierre esa ventana, mijo."]);
  if (weather === "lluvia") return pick(["Lluvia buena pa' las matas. Y pa' dormir la siesta.", "Se me mojó la ropa en el patio. Otra vez."]);
  if (weather === "nieve") return pick(["¿Nieve? En mis tiempos esto no pasaba. Póngase ruana.", "Qué frío tan berraco. Ya pongo agua pa' la aguapanela."]);
  if (hour < 6) return pick(["¿Todavía despierto? Yo tampoco duermo: esta casa hace ruiditos.", "A esta hora solo andamos los búhos y yo."]);
  if (hour < 12) return pick(["Buenos días, mijo. ¿Ya se tomó el tinto?", "Madrugar es bueno. Lo digo yo, que madrugo por dos."]);
  if (hour < 18) return pick(["A esta hora me provoca un pandebono. ¿Y a usted?", "El cuidador de antes a esta hora arreglaba el reloj. Nunca supe pa' qué."]);
  return pick(["Ya prendieron los faroles del jardín. Qué bonito.", "De noche la casa se pone pensativa. Como yo.", "Si oye pasos en el piso 3, no es nadie. Creo."]);
}

// ---------- La carta del cuidador anterior ----------

export interface StoryLetter {
  id: string;
  from: string;
  title: string;
  body: string;
}

/** La primera carta: cálida, misteriosa, firmada con una inicial y con una pista de algo cerrado en la cabaña. */
export const LETTER_CH1: StoryLetter = {
  id: "carta-1",
  from: "E.",
  title: "Para quien llegue a cuidar la cabaña",
  body: [
    "Si esta carta le llegó es porque Aurora ya le mostró la casa. Ella no lo sabe, pero sin ella yo no me hubiera ido tranquilo.",
    "Le dejé todo en orden, o casi todo. La puertica del sótano que da al cuarto del fondo no la pude arreglar: la cerradura está trabada y la llave… digamos que la guardé donde se guardan las cosas que uno quiere que alguien encuentre.",
    "Cuide el reloj de pie del recibidor. Cuando vuelva a dar la hora, sabrá que va por buen camino.",
    "Con cariño, y perdón por irme sin despedirme.",
  ].join("\n\n"),
};

/** Las cartas que alguien tiene en el buzón (según sus contadores). */
export function lettersFor(stats: Readonly<Record<string, number>>): StoryLetter[] {
  return (stats[STAT_KEYS.storyCh1] ?? 0) >= 1 ? [LETTER_CH1] : [];
}

// ---------- Mensajes ----------

export const HISTORIA_MSG = {
  /** Servidor → cliente: la bienvenida de Doña Aurora (solo a quien recién llega; `byBus` si viene en el Megabús). */
  prologue: "historia:prologue",
  /** Cliente → servidor: saltar el capítulo (se entregan todos sin pagar y llega la carta igual). */
  skip: "historia:skip",
  /** Cliente → servidor: leyó el tablón (el servidor revisa que esté junto a él). */
  board: "historia:board",
  /** Servidor → cliente: llegó una carta al buzón. */
  letter: "historia:letter",
} as const;

export interface HistoriaPrologue {
  byBus: boolean;
}
