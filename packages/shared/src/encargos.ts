// Encargos: lo que le piden a uno el tablón del jardín y los personajes de la cabaña. Cada día (día de
// Bogotá, como los puntos) hay 3 diarios —1 igual para todos y 2 propios— y 1 semanal más grande. Cada
// encargo sigue un contador que ya existe (achievements.ts: STAT_KEYS y los de prefijo `visit:`, `use:`,
// `order:`, `sec_zone:`), se cumple solo al llegar a su meta y se entrega con E junto a quien lo dio: paga
// puntos (motivo QUEST, con tope diario), experiencia de un oficio y, a veces, algo para la mochila.
// El motor también sirve para historias: un paso de historia es un encargo con período "historia" que, al
// entregarlo, abre el siguiente (`next`). Es puro: lo usan el servidor (avanza y entrega), la base (guarda)
// y el navegador (la libreta y las marcas sobre los personajes).
import { z } from "zod";
import { MAX_STATS, STAT_KEYS, STAT_PREFIX } from "./achievements";
import { weekStart } from "./arcade";
import type { Season } from "./estaciones";
import { GRANJA_STATS } from "./granja";
import { STORY_QUESTS } from "./historia";
import { ALL_NPCS, type GameNpc } from "./npcs";
import { PESCA_NPC } from "./pesca-tienda";
import { dayStart } from "./points";
import type { Weather } from "./weather";

// ---------- Oficios y quién da los encargos ----------

/** Los oficios que suben con los encargos (el nivel de cada uno llega con los oficios). */
export const QUEST_SKILLS = ["pesca", "huerta", "cocina", "social", "exploracion"] as const;
export type QuestSkill = (typeof QUEST_SKILLS)[number];

export const QUEST_SKILL_TEXT: Record<QuestSkill, string> = {
  pesca: "Pesca",
  huerta: "Huerta",
  cocina: "Cocina",
  social: "Social",
  exploracion: "Exploración",
};

export interface QuestGiver {
  id: string;
  name: string;
  /** El personaje que lo da (su tile marca dónde entregar), o nada si es un objeto (el tablón). */
  npc?: string;
  /** Punto del mapa desde donde también se le habla (el mostrador de Don Evelio, el tablón). */
  point?: string;
  /** Lo que dice al mostrar sus encargos y al recibir uno cumplido. */
  hello: readonly string[];
  thanks: readonly string[];
}

export const QUEST_GIVERS = {
  tablon: {
    id: "tablon",
    name: "El tablón",
    point: "task_board",
    hello: ["Entre tachuelas y papelitos, alguien dejó esto:", "Una nota con letra de afán dice:", "Debajo de un volante de empanadas hay otra nota:"],
    thanks: ["Tachas la nota con un chulito. Alguien, en algún lado, sonríe.", "La nota se despega sola, como si supiera.", "Queda un corazoncito dibujado donde estaba la nota."],
  },
  evelio: {
    id: "evelio",
    name: PESCA_NPC.name,
    npc: PESCA_NPC.id,
    point: "fishing_shop",
    hello: ["¡Ve, mijo! Le tengo un favorcito, pues.", "Venga le cuento lo que necesito, sin afán.", "Usted tiene cara de buen pescador, ¿oyó?"],
    thanks: ["¡A la final sí era cuestión de paciencia! Gracias, mijo.", "¡Ananay, qué belleza! Tome su parte.", "Esto se lo cuento a mi compadre en Pasto."],
  },
  celeste: {
    id: "celeste",
    name: "Profe Celeste",
    npc: "astronoma",
    point: "astronomer",
    hello: ["Uy, justo lo estaba esperando. ¿Me ayuda con algo?", "Anote esto en su diario, que es importante:", "El cielo anda raro hoy. Me sirve otro par de ojos."],
    thanks: ["Lo voy a apuntar con tinta dorada.", "¡Eso! Las estrellas le deben una.", "Gracias. El cielo también se lo agradece, a su manera."],
  },
  crupier: {
    id: "crupier",
    name: "Don Chucho Ruletas",
    npc: "crupier",
    point: "roulette",
    hello: ["Hagan juego, señores… y usted, venga un momentico.", "Entre ronda y ronda, le tengo una propuesta:"],
    thanks: ["La casa agradece. Y la casa casi nunca agradece.", "¡No va más! Tome, que se lo ganó."],
  },
  dealer: {
    id: "dealer",
    name: "Yurani Blackjack",
    npc: "dealer",
    hello: ["Mientras barajo, le cuento una cosita:", "Psst. ¿Tiene un ratico?"],
    thanks: ["¡Veintiuno! Gracias, parce.", "Uy, sí cumplió. Eso no lo hace cualquiera."],
  },
  cajera: {
    id: "cajera",
    name: "Doña Marleny",
    npc: "cajera",
    point: "casino_cashier",
    hello: ["Mijito, ya que está por aquí, hágame un mandado:", "Venga, que la caja no se mueve pero yo sí necesito cosas:"],
    thanks: ["Ay, bendito. Tome, que eso no se queda así.", "Cuadrado como la caja. Gracias, mi amor."],
  },
  aurora: {
    id: "aurora",
    name: "Doña Aurora",
    npc: "aurora",
    hello: ["Venga, mijo, siéntese un momentico que le cuento.", "Ay, qué bueno verlo. ¿Cómo le fue con lo que le dije?"],
    thanks: ["¡Eso! Así se hace. Tome, pa' que se compre algo.", "Muy bien, mijo. Usted aprende rápido, no como el de antes."],
  },
  portero: {
    id: "portero",
    name: "Toño Tres Puertas",
    npc: "portero",
    hello: ["Quieto ahí. Mentiras, mentiras: le tengo un encargo.", "Usted, el de la cara conocida: venga."],
    thanks: ["Bien hecho. Queda en la lista buena.", "Eso. Pase, pase, que usted es de la casa."],
  },
} as const satisfies Record<string, QuestGiver>;

export type QuestGiverId = keyof typeof QUEST_GIVERS;
export const QUEST_GIVER_IDS = Object.keys(QUEST_GIVERS) as QuestGiverId[];

export const questGiver = (id: string): QuestGiver | undefined => (QUEST_GIVERS as Record<string, QuestGiver>)[id];

/** El personaje que da ese encargo (con su nivel y su tile), o undefined si es el tablón. */
export function questGiverNpc(id: string): GameNpc | undefined {
  const npc = questGiver(id)?.npc;
  if (!npc) return undefined;
  return npc === PESCA_NPC.id ? PESCA_NPC : ALL_NPCS.find((n) => n.id === npc);
}

// ---------- El catálogo ----------

export const QUEST_KINDS = ["daily", "weekly", "story"] as const;
export type QuestKind = (typeof QUEST_KINDS)[number];

/**
 * Cuándo cuenta o cuándo sale. `night` y `weather` se miran al sumar (una picada de día no cuenta para "de
 * noche"); `seasons` se mira al repartir (fuera de su estación no le toca a nadie).
 */
export interface QuestWhen {
  night?: boolean;
  weather?: readonly Weather[];
  seasons?: readonly Season[];
}

export interface QuestReward {
  points: number;
  skill: QuestSkill;
  xp: number;
  /** Algo para la mochila: el id de un dibujo de items.ts (va como `obj:<id>`). */
  item?: { id: string; qty: number };
}

export interface QuestDef {
  /** No se cambia nunca: es lo que queda guardado (QuestProgress.questId). */
  id: string;
  kind: QuestKind;
  giver: QuestGiverId;
  title: string;
  text: string;
  /** El contador que sigue (se cumple cuando suma `goal` desde que se asignó). */
  stat: string;
  goal: number;
  reward: QuestReward;
  when?: QuestWhen;
  /** Historias: el paso que se abre al entregar este. */
  next?: string;
  /**
   * Historias: objetos que hay que entregar con el paso (itemId de la mochila, `obj:<id>`, y cuántos). Se
   * revisan y se sacan al entregar, todo o nada (ver rooms/encargos.ts del servidor).
   */
  deliver?: readonly { itemId: string; n: number }[];
}

type Entry = Omit<QuestDef, "kind">;

const daily = (list: Entry[]): QuestDef[] => list.map((q) => ({ ...q, kind: "daily" }));
const weekly = (list: Entry[]): QuestDef[] => list.map((q) => ({ ...q, kind: "weekly" }));

const r = (points: number, skill: QuestSkill, xp: number, item?: { id: string; qty: number }): QuestReward => ({ points, skill, xp, ...(item ? { item } : {}) });
const MIN = 60;

/**
 * Lo que pagan: los diarios de 6 a 15 y los semanales de 40 a 55, así el peor día (los 3 diarios más caros
 * y el semanal más caro) llega justo al tope de QUEST (100) y nunca lo pasa (lo revisa un test).
 */
export const QUESTS: readonly QuestDef[] = [
  ...daily([
    // El tablón del jardín: la vida de la casa.
    { id: "tablon-tinto", giver: "tablon", title: "Tinto de media mañana", text: "«Se necesita quien pruebe el tinto de hoy. Dicen que quedó cargadito.» Pide dos cafés en la cafetería.", stat: STAT_KEYS.coffees, goal: 2, reward: r(9, "social", 15) },
    { id: "tablon-sembrar", giver: "tablon", title: "Manos a la tierra", text: "El huerto tiene tres huequitos vacíos que dan tristeza. Siembra 3 veces.", stat: STAT_KEYS.plantings, goal: 3, reward: r(11, "huerta", 20) },
    { id: "tablon-cosecha", giver: "tablon", title: "Canasta llena", text: "Alguien dejó una canasta vacía con una nota: «¿me la llenan?». Cosecha 3 veces.", stat: STAT_KEYS.harvests, goal: 3, reward: r(12, "huerta", 25) },
    { id: "tablon-gallinas", giver: "tablon", title: "Maíz pa' las gallinas", text: "Las gallinas miran feo desde que amaneció. Dales de comer en el comedero del gallinero.", stat: GRANJA_STATS.feeds, goal: 1, reward: r(7, "huerta", 15) },
    { id: "tablon-huevos", giver: "tablon", title: "Huevos del día", text: "Para el desayuno de mañana faltan huevos. Recoge 2 en el gallinero.", stat: GRANJA_STATS.eggs, goal: 2, reward: r(9, "huerta", 20) },
    { id: "tablon-molino", giver: "tablon", title: "Harina fresca", text: "El molino del arroyo lleva días quieto. Muele una mazorca.", stat: GRANJA_STATS.grinds, goal: 1, reward: r(9, "cocina", 20) },
    { id: "tablon-parrilla", giver: "tablon", title: "Olor a leña", text: "Nadie sabe quién escribió «hoy hay asado», pero ya todos lo esperan. Saca un plato de la parrilla o del horno.", stat: GRANJA_STATS.dishes, goal: 1, reward: r(12, "cocina", 25) },
    { id: "tablon-estufa", giver: "tablon", title: "Algo rico en la estufa", text: "La cocina de la planta baja huele a nada. Cocina un plato en la estufa.", stat: STAT_KEYS.dishesCooked, goal: 1, reward: r(11, "cocina", 25) },
    { id: "tablon-caminar", giver: "tablon", title: "Estirar las piernas", text: "El médico de la casa (nadie lo ha visto) recomienda caminar. Camina 300 baldosas.", stat: STAT_KEYS.tilesWalked, goal: 300, reward: r(7, "exploracion", 15) },
    { id: "tablon-mascotas", giver: "tablon", title: "Cariño de la casa", text: "Las mascotas firmaron una queja: poca atención. Consiéntelas 3 veces.", stat: STAT_KEYS.petCares, goal: 3, reward: r(7, "social", 15) },
    { id: "tablon-foto", giver: "tablon", title: "Recuerdo del día", text: "Al tablón le faltan fotos nuevas. Toma una con la cámara (tecla P).", stat: STAT_KEYS.photosTaken, goal: 1, reward: r(7, "social", 15) },
    { id: "tablon-foco", giver: "tablon", title: "Veinticinco minuticos", text: "«Un bloque de foco, sin mirar el chat. Tú puedes.» Completa un bloque de foco.", stat: STAT_KEYS.focusBlocks, goal: 1, reward: r(12, "social", 20) },
    { id: "tablon-biblioteca", giver: "tablon", title: "Silencio de biblioteca", text: "Un libro de la biblioteca quedó abierto en una página marcada. Pasa 10 minutos allá.", stat: `${STAT_PREFIX.secZone}biblioteca`, goal: 10 * MIN, reward: r(9, "exploracion", 20) },
    { id: "tablon-brindis", giver: "tablon", title: "¡Salud por el equipo!", text: "Hoy se celebra algo (nadie sabe qué). Brinda 2 veces con alguien.", stat: STAT_KEYS.toasts, goal: 2, reward: r(9, "social", 20) },
    { id: "tablon-tina", giver: "tablon", title: "A soltar los hombros", text: "La tina del lago está calientita y sola. Descansa un rato en la tina o en la sauna.", stat: STAT_KEYS.spaRests, goal: 1, reward: r(7, "social", 15) },
    // Don Evelio, el del puesto de pesca.
    { id: "evelio-olla", giver: "evelio", title: "Pa' la olla", text: "Hoy hay caldo en la casa y faltan pescados. Saque 3 del lago.", stat: STAT_KEYS.fishCaught, goal: 3, reward: r(11, "pesca", 25, { id: "carnada", qty: 3 }) },
    { id: "evelio-basura", giver: "evelio", title: "El lago no es caneca", text: "Alguien anda botando cosas al agua. Saque 2 cosas de basura, que el lago se lo agradece.", stat: STAT_KEYS.fishTrash, goal: 2, reward: r(9, "pesca", 20) },
    { id: "evelio-luna", giver: "evelio", title: "Pesca de luna", text: "De noche pican los raros, dicen. Saque 2 pescados cuando ya esté oscuro.", stat: STAT_KEYS.fishCaught, goal: 2, when: { night: true }, reward: r(13, "pesca", 30) },
    { id: "evelio-paciencia", giver: "evelio", title: "Cuestión de paciencia", text: "El que tiene paciencia saca el pescado, pues. Saque 5 del lago.", stat: STAT_KEYS.fishCaught, goal: 5, reward: r(15, "pesca", 35) },
    // Profe Celeste, la astrónoma del observatorio.
    { id: "celeste-cielo", giver: "celeste", title: "Una miradita al cielo", text: "Las constelaciones se mueven aunque nadie las mire. Mire por el telescopio una noche.", stat: STAT_KEYS.stargazing, goal: 1, reward: r(9, "exploracion", 20) },
    { id: "celeste-fugaz", giver: "celeste", title: "Deseo pendiente", text: "Me debo un deseo desde hace años. Vea una estrella fugaz por el telescopio y guárdemelo.", stat: STAT_KEYS.shootingStars, goal: 1, reward: r(13, "exploracion", 30) },
    { id: "celeste-malvavisco", giver: "celeste", title: "El punto de la abuela", text: "Ni crudo ni carbón. Saque un malvavisco dorado de la fogata del observatorio.", stat: STAT_KEYS.goldenMarshmallows, goal: 1, reward: r(9, "cocina", 20) },
    { id: "celeste-arbol", giver: "celeste", title: "Vista desde las ramas", text: "Dicen que desde la casa del árbol se ve un lucero que no sale en mis mapas. Suba a mirar.", stat: `${STAT_PREFIX.visit}casa-arbol`, goal: 1, reward: r(7, "exploracion", 20) },
    { id: "celeste-fogata", giver: "celeste", title: "Fogata bajo las estrellas", text: "Ase un malvavisco de noche. Con el cielo encima sabe distinto, se lo juro.", stat: STAT_KEYS.marshmallows, goal: 1, when: { night: true }, reward: r(9, "exploracion", 20) },
    // El personal del casino.
    { id: "crupier-juego", giver: "crupier", title: "Hagan juego", text: "La mesa está muy callada. Haga 3 apuestas en el casino, las que quiera.", stat: STAT_KEYS.casinoBets, goal: 3, reward: r(9, "social", 15) },
    { id: "crupier-piano", giver: "crupier", title: "Música pa' la ruleta", text: "La rueda gira mejor con música. Toque el piano 3 veces, donde sea.", stat: STAT_KEYS.pianoPlays, goal: 3, reward: r(7, "social", 15) },
    { id: "dealer-arcade", giver: "dealer", title: "Pulgares calientes", text: "Pa' tener buenas manos hay que entrenar. Juegue 2 partidas en el arcade.", stat: STAT_KEYS.arcadeGames, goal: 2, reward: r(9, "social", 15) },
    { id: "dealer-carrera", giver: "dealer", title: "Ruedas y pasillo", text: "Apuesto a que no termina una carrera de sillas. ¿O sí?", stat: STAT_KEYS.racesFinished, goal: 1, reward: r(11, "exploracion", 20) },
    { id: "dealer-giro", giver: "dealer", title: "Mareo de práctica", text: "Pa' repartir rápido hay que girar rápido. Dé 10 vueltas en una silla giratoria.", stat: STAT_KEYS.chairSpins, goal: 10, reward: r(6, "social", 10) },
    { id: "cajera-onces", giver: "cajera", title: "Las onces", text: "Tráigase algo de la cafetería, mijito, que con hambre no se cuadra caja. Pida 2 cosas allá.", stat: STAT_KEYS.cafeOrders, goal: 2, reward: r(9, "cocina", 15, { id: "bocadillo", qty: 1 }) },
    { id: "cajera-pandebono", giver: "cajera", title: "Pandebono calientico", text: "Se me antojó un pandebono y no puedo dejar la caja. Pídase uno en la cafetería, aunque sea pa' usted.", stat: `${STAT_PREFIX.order}pandebono`, goal: 1, reward: r(7, "cocina", 15) },
    { id: "cajera-detalle", giver: "cajera", title: "Un detallito", text: "A la gente hay que consentirla, mijito. Mándele un regalo a alguien del equipo (clic en la persona → Regalar).", stat: STAT_KEYS.giftsGiven, goal: 1, reward: r(9, "social", 20) },
    { id: "cajera-polita", giver: "cajera", title: "Una polita", text: "El bartender del club está aburrido. Pídale algo en la barra del club.", stat: STAT_KEYS.barOrders, goal: 1, reward: r(7, "social", 15) },
    { id: "portero-puertas", giver: "portero", title: "Toc, toc", text: "Revise que las oficinas estén vivas: toque 2 puertas.", stat: STAT_KEYS.knocks, goal: 2, reward: r(7, "social", 15) },
    { id: "portero-pista", giver: "portero", title: "Pa' la pista", text: "La pista del club no se baila sola. Baile 3 veces.", stat: STAT_KEYS.dances, goal: 3, reward: r(7, "social", 15) },
    { id: "portero-garaje", giver: "portero", title: "¿Y el garaje qué?", text: "Hay un ruido raro en el garaje. Vaya a ver y me cuenta.", stat: `${STAT_PREFIX.visit}garaje`, goal: 1, reward: r(7, "exploracion", 20) },
    { id: "portero-bus", giver: "portero", title: "Una vuelta en el Megabús", text: "El bus pasa y pasa y nadie se sube. Súbase una vez, aunque sea por el conductor.", stat: `${STAT_PREFIX.visit}megabus`, goal: 1, reward: r(9, "exploracion", 20) },
    { id: "portero-chisme", giver: "portero", title: "Chisme de pasillo", text: "Uno aquí se aburre. Mande 5 mensajes en el chat, a ver si me entero de algo.", stat: STAT_KEYS.chatMessages, goal: 5, reward: r(6, "social", 10) },
    // De temporada (solo salen en su estación).
    { id: "tablon-otono", giver: "tablon", title: "Cosecha de otoño", text: "Las hojas caen y el huerto pide manos. Cosecha 5 veces antes de que llegue el frío.", stat: STAT_KEYS.harvests, goal: 5, when: { seasons: ["otono"] }, reward: r(15, "huerta", 35) },
    { id: "tablon-primavera", giver: "tablon", title: "Siembra de primavera", text: "Todo quiere nacer. Siembra 5 veces mientras dura la primavera.", stat: STAT_KEYS.plantings, goal: 5, when: { seasons: ["primavera"] }, reward: r(15, "huerta", 35) },
    { id: "celeste-invierno", giver: "celeste", title: "Vapor y escarcha", text: "Con este frío, el vapor de la tina hace figuras. Descanse ahí 2 ratos y me cuenta qué vio.", stat: STAT_KEYS.spaRests, goal: 2, when: { seasons: ["invierno"] }, reward: r(12, "social", 25) },
    { id: "evelio-verano", giver: "evelio", title: "Subienda de verano", text: "En verano el lago se alborota. Saque 4 pescados, que hay subienda.", stat: STAT_KEYS.fishCaught, goal: 4, when: { seasons: ["verano"] }, reward: r(13, "pesca", 30) },
  ]),
  ...weekly([
    { id: "semana-lago", giver: "evelio", title: "El gran pescador de la semana", text: "Esta semana quiero ver la nevera llena. Saque 20 pescados del lago.", stat: STAT_KEYS.fishCaught, goal: 20, reward: r(47, "pesca", 100, { id: "carnada-buena", qty: 5 }) },
    { id: "semana-aguacero", giver: "evelio", title: "Pesca con aguacero", text: "Con lluvia pican distinto. Saque 5 pescados mientras llueve (o truena, si es valiente).", stat: STAT_KEYS.fishCaught, goal: 5, when: { weather: ["lluvia", "tormenta"] }, reward: r(47, "pesca", 90) },
    { id: "semana-huerta", giver: "tablon", title: "La despensa de la semana", text: "La despensa de la cabaña está en los huesos. Cosecha 15 veces esta semana.", stat: STAT_KEYS.harvests, goal: 15, reward: r(47, "huerta", 100, { id: "miel", qty: 1 }) },
    { id: "semana-cocina", giver: "tablon", title: "Chef de la semana", text: "El domingo hay almuerzo de la casa. Cocina 5 platos en la estufa esta semana.", stat: STAT_KEYS.dishesCooked, goal: 5, reward: r(47, "cocina", 100) },
    { id: "semana-estrellas", giver: "celeste", title: "Cazadora de fugaces", text: "Necesito datos para mi tesis (llevo 30 años escribiéndola). Vea 3 estrellas fugaces esta semana.", stat: STAT_KEYS.shootingStars, goal: 3, reward: r(55, "exploracion", 100) },
    { id: "semana-caminante", giver: "portero", title: "Ronda de vigilancia", text: "Alguien tiene que conocerse cada rincón. Camine 5.000 baldosas esta semana.", stat: STAT_KEYS.tilesWalked, goal: 5000, reward: r(40, "exploracion", 90) },
    { id: "semana-parche", giver: "portero", title: "El alma del parche", text: "Esta semana quiero ver ambiente. Brinde 10 veces con la gente.", stat: STAT_KEYS.toasts, goal: 10, reward: r(47, "social", 90) },
    { id: "semana-casino", giver: "crupier", title: "Cliente de la semana", text: "Haga 25 apuestas esta semana. Gane o pierda, la ruleta no olvida.", stat: STAT_KEYS.casinoBets, goal: 25, reward: r(40, "social", 80) },
    { id: "semana-foco", giver: "tablon", title: "Semana concentrada", text: "«Cinco bloques de foco esta semana. El chat sigue ahí cuando vuelvas.»", stat: STAT_KEYS.focusBlocks, goal: 5, reward: r(55, "social", 90) },
  ]),
  // La historia (historia.ts): los pasos de todos los capítulos.
  ...STORY_QUESTS,
];

const BY_ID = new Map(QUESTS.map((q) => [q.id, q]));
export const questById = (id: string): QuestDef | undefined => BY_ID.get(id);

/** ¿Se puede seguir ese contador? (los de máximo no sirven: solo suben al pasar el récord). */
export function isQuestStat(key: string): boolean {
  if (MAX_STATS.has(key)) return false;
  if (key.startsWith(STAT_PREFIX.lastDay)) return false;
  return true;
}

// ---------- Períodos (día de Bogotá, semana ISO) ----------

const DAY_MS = 86_400_000;
const OFFSET_MS = -5 * 3_600_000;

/** Período de los pasos de historia (no vencen). */
export const STORY_PERIOD = "historia";

/** "2026-09-28": la fecha de Bogotá de `ts`. */
export function questDate(ts: number): string {
  return new Date(dayStart(ts) + OFFSET_MS).toISOString().slice(0, 10);
}

/** "d:2026-09-28". */
export const dailyPeriod = (ts: number) => `d:${questDate(ts)}`;

/** "w:2026-W40": la semana ISO (de lunes a domingo, en Bogotá) de `ts`. */
export function weeklyPeriod(ts: number): string {
  const monday = new Date(weekStart(ts) + OFFSET_MS);
  const thursday = new Date(monday.getTime() + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = 1 + Math.floor((thursday.getTime() - jan1) / DAY_MS / 7);
  return `w:${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * ¿Se puede entregar un encargo de ese período? "open": es el de hoy (o esta semana, o una historia);
 * "grace": es el de ayer (o el de la semana que terminó ayer), se entrega hoy nomás; "closed": ya venció.
 */
export function claimWindow(period: string, now: number): "open" | "grace" | "closed" {
  if (period === STORY_PERIOD) return "open";
  if (period.startsWith("d:")) return period === dailyPeriod(now) ? "open" : period === dailyPeriod(now - DAY_MS) ? "grace" : "closed";
  if (period.startsWith("w:")) return period === weeklyPeriod(now) ? "open" : period === weeklyPeriod(now - DAY_MS) ? "grace" : "closed";
  return "closed";
}

/** Los períodos que importan hoy: los de ahora y los de la gracia (sin repetir), y el de las historias. */
export function questPeriods(now: number): string[] {
  return [...new Set([dailyPeriod(now), dailyPeriod(now - DAY_MS), weeklyPeriod(now), weeklyPeriod(now - DAY_MS), STORY_PERIOD])];
}

// ---------- A quién le toca qué ----------

/** FNV-1a de 32 bits: una semilla estable a partir de un texto. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: números entre 0 y 1, siempre los mismos para la misma semilla. */
function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffled<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** ¿Sale en esa estación? */
export const questInSeason = (q: QuestDef, season: Season) => !q.when?.seasons || q.when.seasons.includes(season);

/**
 * La estación del juego con que se reparte cada período (la del día y la de la semana). La fija el
 * servidor la primera vez que reparte en ese período, para que lo asignado no cambie si la estación del
 * juego cambia a mitad del día o de la semana.
 */
export interface QuestSeasons {
  daily: Season;
  weekly: Season;
}

/** Los diarios que pueden salir en esa estación. */
export const dailyPool = (season: Season) => QUESTS.filter((q) => q.kind === "daily" && questInSeason(q, season));

/**
 * Los 3 diarios de alguien ese día: el primero es igual para todos (semilla del día) y los otros dos son
 * propios (semilla de la persona y el día). Nunca repite uno y, si se puede, tampoco el contador ni quién
 * lo da (para que no sean tres veces lo mismo).
 */
export function pickDaily(userId: string, now: number, season: Season): { shared: QuestDef; own: QuestDef[] } {
  const date = questDate(now);
  const pool = dailyPool(season);
  const shared = pool[Math.floor(rng(`encargos:dia:${date}`)() * pool.length)]!;
  const rest = shuffled(
    pool.filter((q) => q.id !== shared.id),
    rng(`encargos:${userId}:${date}`),
  );
  const own: QuestDef[] = [];
  const chosen = () => [shared, ...own];
  const tries: ((q: QuestDef) => boolean)[] = [
    (q) => chosen().every((c) => c.stat !== q.stat && c.giver !== q.giver),
    (q) => chosen().every((c) => c.stat !== q.stat),
    (q) => chosen().every((c) => c.id !== q.id),
  ];
  while (own.length < 2) {
    let next: QuestDef | undefined;
    for (const ok of tries) if ((next = rest.find((q) => !own.includes(q) && ok(q)))) break;
    if (!next) break;
    own.push(next);
  }
  return { shared, own };
}

/** El semanal: uno más grande, igual para todos esa semana. */
export function pickWeekly(now: number, season: Season): QuestDef {
  const pool = QUESTS.filter((q) => q.kind === "weekly" && questInSeason(q, season));
  return pool[Math.floor(rng(`encargos:semana:${weeklyPeriod(now)}`)() * pool.length)]!;
}

/** Un encargo asignado: cuál, de qué período y si es el mismo para todos. */
export interface ActiveQuest {
  def: QuestDef;
  period: string;
  shared: boolean;
}

/** Lo que le toca a alguien ahora: los 3 diarios de hoy y el semanal. */
export function currentQuests(userId: string, now: number, seasons: QuestSeasons): ActiveQuest[] {
  const day = dailyPeriod(now);
  const { shared, own } = pickDaily(userId, now, seasons.daily);
  return [
    { def: shared, period: day, shared: true },
    ...own.map((def) => ({ def, period: day, shared: false })),
    { def: pickWeekly(now, seasons.weekly), period: weeklyPeriod(now), shared: true },
  ];
}

// ---------- Avanzar ----------

/** Cómo está el mundo cuando se suma algo (lo que no se sabe cuenta como "no": la web no sabe si es de noche). */
export interface QuestContext {
  night?: boolean;
  weather?: Weather;
}

/** ¿Cuenta lo que pasó ahora para ese encargo? (la noche y el clima; la estación ya se miró al repartir). */
export function questCounts(q: QuestDef, ctx: QuestContext): boolean {
  const w = q.when;
  if (!w) return true;
  if (w.night !== undefined && ctx.night !== w.night) return false;
  if (w.weather && (!ctx.weather || !w.weather.includes(ctx.weather))) return false;
  return true;
}

/** Cuánto avanza un encargo (lo que se guarda: se suma en la base sin pasarse de la meta). */
export interface QuestDelta {
  questId: string;
  period: string;
  delta: number;
  goal: number;
}

/** Subió un contador: cuánto avanza cada encargo asignado que lo sigue. */
export function questDeltas(active: readonly ActiveQuest[], key: string, delta: number, ctx: QuestContext): QuestDelta[] {
  if (!(delta > 0)) return [];
  const n = Math.round(delta);
  return active.filter((a) => a.def.stat === key && questCounts(a.def, ctx)).map((a) => ({ questId: a.def.id, period: a.period, delta: n, goal: a.def.goal }));
}

/** Junta dos avances del mismo encargo (lo que se acumula entre guardado y guardado). */
export const questKey = (questId: string, period: string) => `${questId}|${period}`;

// ---------- Lo que ve el jugador ----------

export const QUEST_STATUSES = ["ACTIVE", "DONE", "CLAIMED"] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number];

/** Un encargo como lo guarda la base (QuestProgress). */
export interface QuestRecord {
  questId: string;
  period: string;
  progress: number;
  goal: number;
  status: QuestStatus;
}

export interface QuestView extends QuestRecord {
  /** Igual para todos (el diario del día y el semanal). */
  shared: boolean;
  /** De ayer o de la semana pasada: cumplido, se puede entregar solo hoy. */
  late: boolean;
}

/**
 * La libreta de alguien: lo asignado ahora (con lo que lleve), lo de la gracia que quedó cumplido sin
 * entregar y los pasos de historia abiertos. `records` es lo guardado (puede faltar lo que no avanzó).
 */
export function questViews(active: readonly ActiveQuest[], records: readonly QuestRecord[], now: number): QuestView[] {
  const byKey = new Map(records.map((x) => [questKey(x.questId, x.period), x]));
  const out: QuestView[] = active.map((a) => {
    const rec = byKey.get(questKey(a.def.id, a.period));
    return { questId: a.def.id, period: a.period, goal: a.def.goal, progress: rec?.progress ?? 0, status: rec?.status ?? "ACTIVE", shared: a.shared, late: false };
  });
  const seen = new Set(out.map((v) => questKey(v.questId, v.period)));
  for (const rec of records) {
    if (seen.has(questKey(rec.questId, rec.period)) || !questById(rec.questId)) continue;
    const window = claimWindow(rec.period, now);
    if (rec.period === STORY_PERIOD ? rec.status === "CLAIMED" : window !== "grace" || rec.status !== "DONE") continue;
    out.push({ ...rec, shared: false, late: rec.period !== STORY_PERIOD });
  }
  return out;
}

/** "3/5", o en minutos si se cuenta el tiempo. */
export function questProgressText(q: Pick<QuestView, "progress" | "goal">, def: QuestDef | undefined): string {
  if (def?.stat.startsWith(STAT_PREFIX.secZone) || def?.stat.startsWith(STAT_PREFIX.secArea)) return `${Math.floor(q.progress / MIN)}/${Math.round(q.goal / MIN)} min`;
  return `${q.progress}/${q.goal}`;
}

// ---------- Mensajes ----------

export const QUEST = {
  /** Distancia (tiles) al personaje que dio el encargo para entregarlo. */
  reachTiles: 2.6,
  /** Pausa entre dos entregas (para que el doble clic no pida dos veces). */
  claimCooldownMs: 700,
} as const;

/** Mensajes propios de los encargos (no van en MSG). */
export const QUEST_MSG = {
  /** Servidor → cliente: la libreta entera (al entrar, al cambiar el día y al entregar). */
  list: "encargos:list",
  /** Servidor → cliente: solo los encargos que avanzaron (como mucho una vez por segundo). */
  progress: "encargos:progress",
  /** Servidor → cliente: se cumplió uno (falta entregarlo). */
  done: "encargos:done",
  /** Cliente → servidor: entregar un encargo cumplido a quien lo dio. */
  claim: "encargos:claim",
  /** Servidor → cliente: cómo salió la entrega. */
  result: "encargos:result",
} as const;

export const QuestClaimMessage = z.object({ questId: z.string().min(1).max(64), period: z.string().min(1).max(24) });
export type QuestClaimMessage = z.infer<typeof QuestClaimMessage>;

export interface QuestListEvent {
  quests: QuestView[];
}

export interface QuestDoneEvent {
  questId: string;
  period: string;
}

export type QuestClaimError = "unknown" | "far" | "not-done" | "claimed" | "expired" | "full" | "stack" | "busy" | "capped" | "missing" | "failed";

export type QuestClaimResult =
  | { ok: true; questId: string; period: string; points: number; capped: boolean; skill: QuestSkill; xp: number; item: string | null; balance: number }
  | { ok: false; questId: string; period: string; error: QuestClaimError };

export const QUEST_ERROR_TEXT: Record<QuestClaimError, string> = {
  unknown: "Ese encargo ya no existe. Abre la libreta otra vez.",
  far: "Acércate a quien te dio el encargo para entregarlo.",
  "not-done": "Todavía no lo has cumplido.",
  claimed: "Ese encargo ya lo entregaste.",
  expired: "Ese encargo ya venció.",
  full: "Haz espacio en la mochila: la recompensa no cabe.",
  stack: "Haz espacio en la mochila: no te cabe una más de eso.",
  capped: "Ya llenaste los puntos de encargos de hoy: entrégalo mañana.",
  missing: "Te falta algo en la mochila para entregar este paso.",
  busy: "Espera un momentico y vuelve a intentarlo.",
  failed: "No se pudo entregar. Intenta otra vez.",
};

/** Una frase de quien da el encargo (la misma para todos en ese rato). */
export function giverLine(lines: readonly string[], seed: string): string {
  return lines[hash(seed) % lines.length] ?? "";
}
