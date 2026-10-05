// La historia de la cabaña, "Lo que dejó E.", contada en capítulos. Cada capítulo es un dato (`CAPITULOS`):
// sus pasos son encargos de historia (período "historia", encadenados con `next`, ver encargos.ts) que siguen
// un contador que ya existe, se entregan con E junto a quien los da y pagan poquito (puntos QUEST que NO
// cuentan para el tope diario de los encargos: así la historia nunca le quita espacio al diario). Un paso
// puede pedir que se entreguen objetos de historia (`deliver`). Al entregar el último se pone la bandera del
// capítulo (`story_ch<n>`), llega su carta al buzón y se abre el siguiente (el que se abre con esa bandera).
// Capítulo 1, "La llegada": Doña Aurora, la casera, enseña lo básico en cinco pasos; al terminarlo (o al
// saltarlo) llega la primera carta del cuidador anterior y el logro "Recién llegado a la cabaña" (que sirve
// de insignia). Quien ya jugaba tiene esos pasos marcados solos. Es puro: lo usan el servidor, la web (el
// buzón) y el navegador (el cuadro de Aurora y el diario de la mochila).
import { STAT_KEYS, STAT_PREFIX } from "./achievements";
import type { BagObject } from "./bolsa";
import type { QuestDef, QuestSkill } from "./encargos";
import type { Weather } from "./weather";
import { capitulo2 } from "./capitulo2";

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
const LLEGADA_STEPS: readonly QuestDef[] = [
  step(1, `${STAT_PREFIX.order}tinto`, "cocina", "Un tintico pa' empezar", "Pida un tinto en la barra de la cafetería. Lo pedido va a la mochila y a la mano."),
  step(2, STAT_KEYS.ownOfficeSits, "social", "Su rinconcito", "Siéntese en una silla de su oficina, la del piso 2. Ahí queda el PC, para sus notas."),
  step(3, STAT_KEYS.emotes, "social", "Buenas, buenas", "Salude a alguien con un emote o con Saludar. Si no hay nadie, salúdeme a mí, que yo sí contesto."),
  step(4, STAT_KEYS.fishCaught, "pesca", "Pa' la olla de Aurora", "Saque algo del lago. Don Evelio le presta la caña y le enseña el truco."),
  step(5, STAT_KEYS.boardReads, "exploracion", "Lo que dice el tablón", "Vaya a leer el tablón del jardín: ahí salen las misiones y los encargos del día."),
];

/**
 * `refId` de lo que paga un paso de historia (encargo:<id>:historia): termina así, y con eso el tope diario
 * de QUEST no lo cuenta.
 */
export const STORY_REF_SUFFIX = ":historia";

/** Lo que enseña cada paso, dicho por Doña Aurora al hablarle. */
const LLEGADA_LESSONS: Readonly<Record<string, string>> = {
  "llegada-1": "La mochila es su despensa: se abre con la I. Lo que elige en la barra de abajo es lo de la mano, y con F se lo toma.",
  "llegada-2": "Donde vea una silla, E y se sienta. En su oficina, el PC guarda sus notas y la puerta se cierra con candado.",
  "llegada-3": "Aquí la gente se oye de cerquita, como en una casa de verdad: arrímese para conversar y aléjese para la intimidad.",
  "llegada-4": "E junto al agua pa' lanzar; cuando pique, dele y mantenga el pez en la barra verde. En el puesto venden cañas y carnada.",
  "llegada-5": "En el tablón hay misiones que ponen los compañeros y encargos de la casa. Cumpla y me cuenta.",
};

/** Dónde queda lo que pide un paso (para la flechita que lo señala). */
export interface StoryTarget {
  area: string;
  point?: string;
  office?: true;
}

const LLEGADA_TARGETS: Readonly<Record<string, StoryTarget>> = {
  "llegada-1": { area: "planta-baja", point: "cafe_counter" },
  "llegada-2": { area: "piso-2", office: true },
  "llegada-3": { area: "planta-baja" },
  "llegada-4": { area: "jardin", point: "fishing_spot" },
  "llegada-5": { area: "jardin", point: "task_board" },
};

/** Los pasos del capítulo 1 que alguien que ya jugaba tiene hechos desde antes (sus contadores ya llegan a la meta). */
export function storyStepsDone(stats: Readonly<Record<string, number>>): string[] {
  return LLEGADA_STEPS.filter((q) => (stats[q.stat] ?? 0) >= q.goal).map((q) => q.id);
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

// ---------- Los capítulos ----------

export interface Capitulo {
  /** No se cambia nunca (lo usan el diario y las pruebas). */
  id: string;
  /** El número (1, 2, 3…): el orden en el diario. */
  n: number;
  title: string;
  /** Lo que pasó, en una línea: el diario lo muestra cuando ya se terminó (antes, "???"). */
  summary: string;
  /** Los pasos en orden: encargos `kind: "story"` encadenados con `next` (el último sin `next`). */
  steps: readonly QuestDef[];
  /** El consejo de cada paso (el cuadro de quien lo da y el diario; solo se ve el del paso abierto). */
  lessons: Readonly<Record<string, string>>;
  /** Dónde queda lo que pide cada paso (la flechita dorada). */
  targets?: Readonly<Record<string, StoryTarget>>;
  /** La bandera que lo abre (la del capítulo anterior). Sin nada, lo tiene todo el mundo desde el principio. */
  opensWith?: string;
  /** La bandera de terminado (`story_ch<n>`, contador de máximo en STAT_KEYS: 1 = terminado). */
  flag: string;
  /** El logro que da (sale solo de la bandera, ver achievements.ts). */
  achievement?: string;
  /** La carta que llega al buzón al terminarlo. */
  letter?: StoryLetter;
  /** Quien ya jugaba tiene hechos solos los pasos cuyo contador ya llega a la meta (el 1: enseña lo básico). */
  fromStats?: boolean;
  /** Los objetos de historia del capítulo (van a BAG_OBJECTS con `story: true`: no se tiran, regalan ni intercambian). */
  items?: Readonly<Record<string, BagObject>>;
}

/** La bandera de terminado del capítulo n (`story_ch<n>`; las del 1 al 5 están en STAT_KEYS). */
export const storyFlag = (n: number) => `story_ch${n}`;

export const CAPITULO_1: Capitulo = {
  id: "llegada",
  n: 1,
  title: "La llegada",
  summary: "Doña Aurora le mostró la casa: el tinto, su oficina, el saludo, el lago y el tablón. Y llegó una carta firmada con una E.",
  steps: LLEGADA_STEPS,
  lessons: LLEGADA_LESSONS,
  targets: LLEGADA_TARGETS,
  flag: STAT_KEYS.storyCh1,
  achievement: "recien-llegado",
  letter: LETTER_CH1,
  fromStats: true,
};

/**
 * Los capítulos, en orden. Uno nuevo va acá: sus pasos (ids que no se cambian nunca), sus consejos, la
 * bandera del anterior en `opensWith`, la suya (`STAT_KEYS.storyCh<n>`) y, si trae, la carta y el logro.
 */
/** Capítulo 2, "El reloj de pie" (capitulo2.ts): lo abre terminar el 1. */
export const CAPITULO_2: Capitulo = capitulo2({ opensWith: STAT_KEYS.storyCh1, flag: STAT_KEYS.storyCh2 });

export const CAPITULOS: readonly Capitulo[] = [CAPITULO_1, CAPITULO_2];

/** Todos los pasos de historia (de todos los capítulos): van en el catálogo de encargos. */
export const STORY_QUESTS: readonly QuestDef[] = CAPITULOS.flatMap((c) => c.steps);

/** El primer y el último paso del capítulo 1 (el prólogo y "Saltar historia" son solo de él). */
export const STORY_FIRST = CAPITULO_1.steps[0]!.id;
export const STORY_LAST = CAPITULO_1.steps[CAPITULO_1.steps.length - 1]!.id;
export const isStoryQuest = (id: string) => STORY_QUESTS.some((q) => q.id === id);

/** El consejo de cada paso, de todos los capítulos. */
export const STORY_LESSONS: Readonly<Record<string, string>> = Object.assign({}, ...CAPITULOS.map((c) => c.lessons));
/** Dónde queda lo que pide cada paso, de todos los capítulos. */
export const STORY_TARGET: Readonly<Record<string, StoryTarget>> = Object.assign({}, ...CAPITULOS.map((c) => c.targets ?? {}));
/** Los objetos de historia de todos los capítulos (los suma BAG_OBJECTS). */
export const STORY_BAG_OBJECTS: Readonly<Record<string, BagObject>> = Object.assign({}, ...CAPITULOS.map((c) => c.items ?? {}));
/** Las banderas de todos los capítulos (lo que la web lee de UserStat para el buzón y el diario). */
export const STORY_FLAGS: readonly string[] = CAPITULOS.map((c) => c.flag);

/** El capítulo de un paso (en esa lista de capítulos). */
export function capituloOf(questId: string, chapters: readonly Capitulo[] = CAPITULOS): Capitulo | undefined {
  return chapters.find((c) => c.steps.some((s) => s.id === questId));
}

type StatOf = (key: string) => number | undefined;

/** ¿Lo tiene abierto? (lo que lo abre se cumple, según sus contadores). */
export const capituloAbierto = (c: Capitulo, stat: StatOf) => !c.opensWith || (stat(c.opensWith) ?? 0) >= 1;

/** ¿Lo terminó? */
export const capituloTerminado = (c: Capitulo, stat: StatOf) => (stat(c.flag) ?? 0) >= 1;

/** Las cartas que alguien tiene en el buzón (según sus contadores): las de los capítulos terminados, en orden. */
export function lettersFor(stats: Readonly<Record<string, number>>, chapters: readonly Capitulo[] = CAPITULOS): StoryLetter[] {
  const stat = (k: string) => stats[k];
  return chapters.flatMap((c) => (c.letter && capituloTerminado(c, stat) ? [c.letter] : []));
}

// ---------- El diario de la mochila ----------

/** Un paso en el diario: hecho, el abierto (`ready` si ya se cumplió y falta entregarlo) o todavía escondido. */
export type DiaryStepState = "done" | "open" | "ready" | "hidden";

export interface DiaryStep {
  questId: string;
  state: DiaryStepState;
}

export interface DiaryChapter {
  chapter: Capitulo;
  /** `done`: terminado (título y resumen); `current`: el de ahora (con sus pasos); `locked`: todavía no ("???"). */
  state: "done" | "current" | "locked";
  /** Solo el de ahora. */
  steps?: DiaryStep[];
}

/**
 * El diario de la historia: los capítulos terminados, el de ahora con sus pasos (sin decir lo que viene) y
 * los que faltan. `open` son los pasos de historia que tiene sin entregar (los de la libreta: ACTIVE o DONE).
 */
export function storyDiary(stat: StatOf, open: readonly { questId: string; status: string }[], chapters: readonly Capitulo[] = CAPITULOS): DiaryChapter[] {
  let current = false;
  return chapters.map((chapter): DiaryChapter => {
    if (capituloTerminado(chapter, stat)) return { chapter, state: "done" };
    if (current || !capituloAbierto(chapter, stat)) return { chapter, state: "locked" };
    current = true;
    const at = chapter.steps.findIndex((s) => open.some((o) => o.questId === s.id && o.status !== "CLAIMED"));
    const steps = chapter.steps.map((s, i): DiaryStep => {
      if (at < 0 || i > at) return { questId: s.id, state: "hidden" };
      if (i < at) return { questId: s.id, state: "done" };
      return { questId: s.id, state: open.find((o) => o.questId === s.id)?.status === "DONE" ? "ready" : "open" };
    });
    return { chapter, state: "current", steps };
  });
}

// ---------- Mensajes ----------

export const HISTORIA_MSG = {
  /** Servidor → cliente: la bienvenida de Doña Aurora (solo a quien recién llega; `byBus` si viene en el Megabús). */
  prologue: "historia:prologue",
  /** Cliente → servidor: saltar el capítulo 1 (se entregan todos sin pagar y llega la carta igual; los demás no se saltan). */
  skip: "historia:skip",
  /** Cliente → servidor: leyó el tablón (el servidor revisa que esté junto a él). */
  board: "historia:board",
  /** Servidor → cliente: terminó un capítulo y llegó su carta al buzón (`HistoriaLetter`). */
  letter: "historia:letter",
  /** Servidor → cliente: que se vea una cinemática de la historia (`HistoriaCine`). */
  cine: "historia:cine",
  /** Servidor → cliente: un aviso de la historia ("le faltan piezas"). */
  aviso: "historia:aviso",
  /** Cliente → servidor: comprarle el péndulo al Man del Sombrero (capítulo 2). */
  pendulo: "historia:pendulo",
} as const;

export interface HistoriaLetter {
  /** La carta (`StoryLetter.id`). */
  id: string;
  /** El capítulo que la trajo (`Capitulo.id`). */
  chapter: string;
}

export interface HistoriaCine {
  id: string;
  vars?: Record<string, string | number>;
}

export interface HistoriaPrologue {
  byBus: boolean;
}
