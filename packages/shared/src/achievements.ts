// Logros y estadísticas del perfil: las claves de los contadores (STAT_KEYS), el catálogo de logros con
// su regla (un contador y un umbral), el progreso y el "título" divertido que sale de los contadores.
// Es puro: lo usan el servidor de juego (suma y desbloquea), la base (guarda) y la web (el perfil).
import { FISH, bogotaHour } from "./fishing";
import type { Look } from "./look";

/**
 * Claves de los contadores (UserStat.key). Las que dicen "máximo" guardan el valor más alto visto; las
 * demás se suman. Otras ramas pueden sumar a estas claves sin tocar el catálogo: basta con llamar al
 * rastreador de logros del servidor (`achievements.bump(userId, STAT_KEYS.toasts)`).
 */
export const STAT_KEYS = {
  // Cafetería y bar (pedidos y lo que se usa con F)
  cafeOrders: "cafe_orders",
  barOrders: "bar_orders",
  /** Pedidos que traen café (tinto, café con leche, los desayunos). */
  coffees: "coffees",
  /** Habanos pedidos. */
  habanos: "habanos",
  sips: "sips",
  bites: "bites",
  puffs: "puffs",
  /** Sorbos de algo con alcohol. */
  alcoholSips: "alcohol_sips",
  // Borrachera
  blackouts: "blackouts",
  /** Se despertó del desmayo acostado en un sofá de la zona de descanso. */
  sofaNaps: "sofa_naps",
  // Pesca
  fishCaught: "fish_caught",
  /** Especies distintas sacadas (sin contar la basura). */
  fishSpecies: "fish_species",
  fishTrash: "fish_trash",
  boots: "fish_boots",
  legendaryFish: "fish_legendary",
  mythicFish: "fish_mythic",
  fishTreasures: "fish_treasures",
  /** Máximo: el pez más grande, en cm. */
  fishBestCm: "fish_best_cm",
  // Casino
  casinoBets: "casino_bets",
  casinoWagered: "casino_wagered",
  /** Lo que devolvió el casino (premios con la apuesta incluida). */
  casinoReturned: "casino_returned",
  /** Lo perdido, sumando solo las rondas en que se perdió (nunca baja). */
  casinoLost: "casino_lost",
  /** Máximo: la mayor ganancia neta de una ronda. */
  casinoBestWin: "casino_best_win",
  rouletteStraights: "roulette_straights",
  blackjackNaturals: "blackjack_naturals",
  // Muebles que se usan
  pianoPlays: "piano_plays",
  guitarPlays: "guitar_plays",
  catPets: "cat_pets",
  recordsPlayed: "records_played",
  lightsToggled: "lights_toggled",
  tvToggles: "tv_toggles",
  // Tiempo y lugares
  /** Segundos activos en la cabaña (los mismos que dan puntos de presencia). */
  secondsOnline: "seconds_online",
  /** Máximo: niveles distintos visitados. */
  areasVisited: "areas_visited",
  /** Días con actividad entre las 4 y las 7 de la mañana (Bogotá). */
  earlyDays: "early_days",
  /** Días con actividad entre la medianoche y las 4 (Bogotá). */
  owlDays: "owl_days",
  /** Tiles caminados. */
  tilesWalked: "tiles_walked",
  // Puntos y web
  /** Máximo: el saldo más alto que tuvo. */
  pointsPeak: "points_peak",
  /** Máximo: la racha más larga del buzón (la suma la web al reclamar). */
  streakBest: "streak_best",
  missionsDone: "missions_done",
  decorEdits: "decor_edits",
  // Social
  emotes: "emotes",
  dances: "dances",
  chatMessages: "chat_messages",
  knocks: "knocks",
  /** Para otras ramas: fotos con la cámara, brindis y vueltas en la silla giratoria. */
  photosTaken: "photos_taken",
  toasts: "toasts",
  chairSpins: "chair_spins",
} as const;

export type StatKey = (typeof STAT_KEYS)[keyof typeof STAT_KEYS];

/** Contadores con prefijo (uno por cosa): `use:tinto`, `visit:sotano`, `sec_zone:biblioteca`… */
export const STAT_PREFIX = {
  /** Usos de lo que se tiene en la mano, por dibujo (tinto, habano…). */
  use: "use:",
  /** Pedidos por producto de la carta. */
  order: "order:",
  /** 1 = alguna vez estuvo en ese nivel. */
  visit: "visit:",
  /** Segundos activos en cada nivel y en cada zona. */
  secArea: "sec_area:",
  secZone: "sec_zone:",
  /** Máximo: último día (número de día de Bogotá) contado para `early_days` / `owl_days`. */
  lastDay: "last_day:",
} as const;

/** Cambio de un contador, como lo guarda la base (`inc` suma, `max` se queda con el mayor). */
export interface StatChange {
  key: string;
  op: "inc" | "max";
  value: number;
}

/** Claves que guardan el máximo (el resto se suma). */
export const MAX_STATS: ReadonlySet<string> = new Set([
  STAT_KEYS.fishBestCm,
  STAT_KEYS.casinoBestWin,
  STAT_KEYS.areasVisited,
  STAT_KEYS.pointsPeak,
  STAT_KEYS.streakBest,
]);

export const ACHIEVEMENT_RARITIES = ["comun", "raro", "epico", "legendario"] as const;
export type AchievementRarity = (typeof ACHIEVEMENT_RARITIES)[number];

export const ACHIEVEMENT_RARITY: Record<AchievementRarity, { label: string; color: string }> = {
  comun: { label: "Común", color: "#9a6a40" },
  raro: { label: "Raro", color: "#4a70a0" },
  epico: { label: "Épico", color: "#6e3a96" },
  legendario: { label: "Legendario", color: "#dcae3f" },
};

/** Dibujos de las insignias (packages/map/src/art/badges.ts). */
export const BADGE_ICONS = [
  "cup",
  "bread",
  "cigar",
  "smoke",
  "bottle",
  "sofa",
  "fish",
  "boot",
  "can",
  "chest",
  "crown",
  "chip",
  "wheel",
  "cards",
  "sunrise",
  "owl",
  "flame",
  "map",
  "clock",
  "shoe",
  "piano",
  "cat",
  "record",
  "coin",
  "brush",
  "note",
  "camera",
  "glass",
  "chair",
  "scroll",
] as const;
export type BadgeIcon = (typeof BADGE_ICONS)[number];

export interface Achievement {
  id: string;
  name: string;
  /** Una línea con humor (se ve al pasar el mouse y en la grilla). */
  description: string;
  /** Qué hay que hacer, dicho claro (para el progreso). */
  goal: string;
  icon: BadgeIcon;
  rarity: AchievementRarity;
  /** Secreto: bloqueado se ve como "???" (sin pista). */
  secret: boolean;
  /** Se desbloquea cuando el contador `stat` llega a `min`. */
  stat: string;
  min: number;
}

const a = (
  id: string,
  name: string,
  icon: BadgeIcon,
  rarity: AchievementRarity,
  stat: string,
  min: number,
  goal: string,
  description: string,
  secret = false,
): Achievement => ({ id, name, icon, rarity, stat, min, goal, description, secret });

/** Especies del álbum de pesca (sin la basura): "Álbum completo" pide todas. */
export const ALBUM_SPECIES = FISH.filter((f) => f.rarity !== "basura").length;

/** Niveles de la cabaña (el test del servidor revisa que "Turista" pida todos). */
export const TOURIST_AREAS = 7;

export const ACHIEVEMENTS: readonly Achievement[] = [
  // Cafetería y bar
  a("buenos-dias", "Buenos días, cafetería", "cup", "comun", STAT_KEYS.cafeOrders, 1, "Pide algo en la cafetería", "El primer tinto nunca se olvida."),
  a("cliente-frecuente", "Cliente frecuente", "cup", "raro", STAT_KEYS.coffees, 50, "Pide 50 cafés", "Ya te saben el pedido de memoria."),
  a("adicto-al-tinto", "Adicto al tinto", "cup", "epico", `${STAT_PREFIX.use}tinto`, 150, "Dale 150 sorbos al tinto", "Tus venas ya son 40% tinto."),
  a("pandebonero", "Pandebonero oficial", "bread", "comun", STAT_KEYS.bites, 30, "Da 30 mordiscos", "Migas en el teclado desde el primer día."),
  a("fumador-de-habanos", "Fumador de habanos", "cigar", "raro", STAT_KEYS.habanos, 5, "Pide 5 habanos en el club", "Como un magnate, pero en pantuflas."),
  a("chimenea-humana", "Chimenea humana", "smoke", "raro", STAT_KEYS.puffs, 100, "Da 100 pitadas", "La chimenea de la cabaña te mira con envidia."),
  a("habitual-del-bar", "Habitual del bar", "glass", "comun", STAT_KEYS.barOrders, 25, "Pide 25 cosas en el bar del club", "El bartender ya te guarda la banqueta."),
  // Borrachera (secretos)
  a("primera-borrachera", "Primera borrachera", "bottle", "comun", STAT_KEYS.blackouts, 1, "Desmáyate de tanto tomar", "Nadie vio nada. Todos vieron todo.", true),
  a("durmio-en-el-sofa", "Durmió en el sofá", "sofa", "raro", STAT_KEYS.sofaNaps, 5, "Despierta 5 veces en el sofá de la zona de descanso", "El sofá del piso 2 ya tiene tu forma.", true),
  a("higado-de-acero", "Hígado de vacaciones", "bottle", "epico", STAT_KEYS.blackouts, 10, "Desmáyate 10 veces", "Tu hígado pidió una licencia no remunerada.", true),
  // Pesca
  a("primera-picada", "Primera picada", "fish", "comun", STAT_KEYS.fishCaught, 1, "Saca tu primer pez del lago", "Era chiquito, pero era tuyo."),
  a("pesco-una-bota", "Pescó una bota", "boot", "comun", STAT_KEYS.boots, 1, "Saca una bota vieja del lago", "Talla 42. La otra sigue allá abajo.", true),
  a("limpia-lagos", "Limpiador del lago", "can", "comun", STAT_KEYS.fishTrash, 10, "Saca 10 cosas de basura del lago", "El lago te lo agradece. Los peces, no tanto."),
  a("pescador", "Pescador de fin de semana", "fish", "raro", STAT_KEYS.fishCaught, 50, "Saca 50 peces", "Ya tienes historias del que se te escapó."),
  a("coleccionista", "Coleccionista de escamas", "fish", "epico", STAT_KEYS.fishSpecies, 15, "Saca 15 especies distintas", "Tu álbum huele un poquito a lago."),
  a("cazatesoros", "Cazatesoros", "chest", "raro", STAT_KEYS.fishTreasures, 1, "Saca un cofre mientras pescas", "¡Un cofre! Adentro había… más lago."),
  a("pescador-legendario", "Pescador legendario", "crown", "legendario", STAT_KEYS.legendaryFish, 1, "Saca un pez legendario", "Nadie te cree. Menos mal que hay álbum."),
  a("pescador-mitico", "Pescador de leyendas", "crown", "legendario", STAT_KEYS.mythicFish, 1, "Saca un pez mítico", "Los abuelos tenían razón. Y tú tienes la foto.", true),
  a("album-completo", "Álbum completo", "fish", "legendario", STAT_KEYS.fishSpecies, ALBUM_SPECIES, `Saca las ${ALBUM_SPECIES} especies del lago`, "Ya no queda nada nuevo en el lago. ¿O sí?"),
  // Casino
  a("hagan-sus-apuestas", "Hagan sus apuestas", "chip", "comun", STAT_KEYS.casinoBets, 1, "Apuesta en el casino", "Solo una, para probar. (Nunca es solo una.)"),
  a("la-casa-siempre-gana", "La casa siempre gana", "chip", "raro", STAT_KEYS.casinoLost, 1000, "Pierde 1000 puntos en el casino", "Gracias por financiar las lámparas nuevas del casino."),
  a("suertudo", "Suertudo", "wheel", "epico", STAT_KEYS.rouletteStraights, 1, "Acierta un pleno en la ruleta", "Un número, una ficha, un grito."),
  a("blackjack-natural", "Blackjack natural", "cards", "raro", STAT_KEYS.blackjackNaturals, 1, "Saca 21 con las dos primeras cartas", "As y figura. El crupier suspira."),
  // Tiempo y lugares
  a("turista", "Turista", "map", "comun", STAT_KEYS.areasVisited, TOURIST_AREAS, "Visita todos los niveles de la cabaña", "Del sótano al piso 3, el garaje y la casa del árbol, con foto mental en cada uno."),
  a("caminante", "Pantuflas gastadas", "shoe", "raro", STAT_KEYS.tilesWalked, 10_000, "Camina 10.000 baldosas", "Tus pantuflas piden jubilación."),
  a("madrugador", "Madrugador", "sunrise", "raro", STAT_KEYS.earlyDays, 1, "Está activo antes de las 7 de la mañana (Bogotá)", "Llegaste antes que el café."),
  a("buho", "Búho", "owl", "raro", STAT_KEYS.owlDays, 1, "Está activo después de medianoche (Bogotá)", "¿Trabajando o huyendo del sueño?", true),
  a("siete-de-siete", "Siete de siete", "flame", "raro", STAT_KEYS.streakBest, 7, "Reclama el buzón 7 días seguidos", "Una semana entera sin fallarle al buzón."),
  a("inquilino-fijo", "Inquilino fijo", "flame", "legendario", STAT_KEYS.streakBest, 30, "Reclama el buzón 30 días seguidos", "A esta altura ya pagas arriendo."),
  a("veterano", "Veterano de la cabaña", "clock", "epico", STAT_KEYS.secondsOnline, 100 * 3600, "Pasa 100 horas activas en la cabaña", "Conoces cada tabla que cruje."),
  // Muebles
  a("pianista", "Pianista", "piano", "comun", STAT_KEYS.pianoPlays, 25, "Toca el piano 25 veces", "Para Elisa, pero con más entusiasmo."),
  a("amigo-de-los-gatos", "Amigo de los gatos", "cat", "comun", STAT_KEYS.catPets, 20, "Acaricia al gato 20 veces", "Ronronea solo cuando llegas tú."),
  // Puntos, casa y social
  a("millonario", "Millonario", "coin", "epico", STAT_KEYS.pointsPeak, 5000, "Junta 5000 puntos a la vez", "Contar monedas ya es tu cardio."),
  a("decorador", "Decorador", "brush", "comun", STAT_KEYS.decorEdits, 10, "Haz 10 cambios en la decoración de tu oficina", "Mover el sofá tres centímetros también cuenta."),
  a("manos-a-la-obra", "Manos a la obra", "scroll", "raro", STAT_KEYS.missionsDone, 5, "Completa 5 misiones del tablón", "El tablón ya tiene tu nombre escrito a mano."),
  a("paparazzi", "Paparazzi", "camera", "raro", STAT_KEYS.photosTaken, 25, "Toma 25 fotos", "Nadie sale mal en tus fotos. Casi nadie."),
  a("salud", "¡Salud!", "glass", "comun", STAT_KEYS.toasts, 10, "Brinda 10 veces", "Chocar copas es tu idioma del amor."),
  a("mareo-voluntario", "Mareo voluntario", "chair", "comun", STAT_KEYS.chairSpins, 50, "Da 50 vueltas en la silla giratoria", "Productividad: 0. Diversión: toda.", true),
];

const BY_ID = new Map(ACHIEVEMENTS.map((x) => [x.id, x]));
export const achievementById = (id: string): Achievement | undefined => BY_ID.get(id);

/** Qué tanto falta (0 a 1). */
export function achievementProgress(ach: Achievement, stats: Readonly<Record<string, number>>): number {
  return Math.max(0, Math.min(1, (stats[ach.stat] ?? 0) / ach.min));
}

/** Logros que ya cumplen su regla y todavía no están desbloqueados (en el orden del catálogo). */
export function newlyUnlocked(stats: Readonly<Record<string, number>>, unlocked: ReadonlySet<string> | readonly string[]): Achievement[] {
  const have = unlocked instanceof Set ? unlocked : new Set(unlocked as readonly string[]);
  return ACHIEVEMENTS.filter((x) => !have.has(x.id) && (stats[x.stat] ?? 0) >= x.min);
}

/** Logros que suben con un contador (para revisar solo esos al sumar). */
export function achievementsOfStat(key: string): readonly Achievement[] {
  return BY_STAT.get(key) ?? [];
}
const BY_STAT = new Map<string, Achievement[]>();
for (const x of ACHIEVEMENTS) BY_STAT.set(x.stat, [...(BY_STAT.get(x.stat) ?? []), x]);

/** Servidor → los del nivel (`MSG.achievementUnlocked`): alguien desbloqueó un logro. */
export interface AchievementUnlockedEvent {
  sessionId: string;
  name: string;
  achievementId: string;
}

// ---------- El título del perfil ----------

const sum = (stats: Readonly<Record<string, number>>, keys: readonly string[]) => keys.reduce((t, k) => t + (stats[k] ?? 0), 0);
const sumPrefix = (stats: Readonly<Record<string, number>>, prefix: string) =>
  Object.entries(stats).reduce((t, [k, v]) => (k.startsWith(prefix) ? t + v : t), 0);
const HOUR = 3600;

/**
 * Títulos que salen de los contadores: cada uno mide qué tanto pasó su umbral y gana el que más lo pasó.
 * Ninguno llega a 1: título de consolación.
 */
const TITLES: { title: string; score: (s: Readonly<Record<string, number>>) => number }[] = [
  { title: "Adicto al tinto", score: (s) => (s[`${STAT_PREFIX.use}tinto`] ?? 0) / 40 },
  { title: "Barista honorario", score: (s) => (s[STAT_KEYS.coffees] ?? 0) / 25 },
  { title: "Alma de la fiesta", score: (s) => sum(s, [STAT_KEYS.dances, STAT_KEYS.toasts, STAT_KEYS.barOrders]) / 30 },
  { title: "Rey del sofá", score: (s) => (s[STAT_KEYS.sofaNaps] ?? 0) / 3 },
  { title: "Ermitaño de la biblioteca", score: (s) => (s[`${STAT_PREFIX.secZone}biblioteca`] ?? 0) / (5 * HOUR) },
  { title: "Habitante de la cafetería", score: (s) => (s[`${STAT_PREFIX.secZone}cafeteria`] ?? 0) / (5 * HOUR) },
  { title: "Nunca sale de su oficina", score: (s) => sumPrefix(s, `${STAT_PREFIX.secZone}office-`) / (15 * HOUR) },
  { title: "Espíritu del jardín", score: (s) => (s[`${STAT_PREFIX.secZone}jardin`] ?? 0) / (15 * HOUR) },
  { title: "Tahúr del sótano", score: (s) => (s[STAT_KEYS.casinoBets] ?? 0) / 40 },
  { title: "Lobo de lago", score: (s) => (s[STAT_KEYS.fishCaught] ?? 0) / 30 },
  { title: "Susurrador de gatos", score: (s) => (s[STAT_KEYS.catPets] ?? 0) / 30 },
  { title: "Virtuoso del piano", score: (s) => (s[STAT_KEYS.pianoPlays] ?? 0) / 40 },
  { title: "Fumador empedernido", score: (s) => (s[STAT_KEYS.puffs] ?? 0) / 80 },
  { title: "Maratonista de pasillo", score: (s) => (s[STAT_KEYS.tilesWalked] ?? 0) / 8000 },
  { title: "Paparazzi de guardia", score: (s) => (s[STAT_KEYS.photosTaken] ?? 0) / 20 },
  { title: "Bailarín incansable", score: (s) => (s[STAT_KEYS.dances] ?? 0) / 25 },
  { title: "Charlatán oficial", score: (s) => (s[STAT_KEYS.chatMessages] ?? 0) / 200 },
];

export function profileTitle(stats: Readonly<Record<string, number>>): string {
  let best = { title: "", score: 1 };
  for (const t of TITLES) {
    const score = t.score(stats);
    if (score >= best.score) best = { title: t.title, score };
  }
  if (best.title) return best.title;
  return (stats[STAT_KEYS.secondsOnline] ?? 0) < 2 * HOUR ? "Recién llegado" : "Vecino tranquilo";
}

/** La clave con más valor entre las que empiezan con `prefix` (sin el prefijo), o null. */
export function topByPrefix(stats: Readonly<Record<string, number>>, prefix: string): { id: string; value: number } | null {
  let top: { id: string; value: number } | null = null;
  for (const [k, v] of Object.entries(stats)) {
    if (!k.startsWith(prefix) || v <= 0) continue;
    if (!top || v > top.value) top = { id: k.slice(prefix.length), value: v };
  }
  return top;
}

// ---------- Horas de Bogotá (madrugador y búho) ----------

/** Número de día de Bogotá (para contar una vez por día). */
export const bogotaDay = (ts: number) => Math.floor((ts - 5 * 3_600_000) / 86_400_000);

/** ¿Esta hora cuenta para madrugador ("early") o búho ("owl")? */
export function oddHour(ts: number): "early" | "owl" | null {
  const h = bogotaHour(ts);
  if (h >= 4 && h < 7) return "early";
  if (h < 4) return "owl";
  return null;
}

// ---------- El perfil (lo que devuelve la API) ----------

export interface ProfileAchievementDTO {
  id: string;
  /** ISO; null = bloqueado. */
  unlockedAt: string | null;
  /** 0 a 1. */
  progress: number;
  /** Personas del equipo que lo tienen. */
  owners: number;
}

export interface ProfileDTO {
  id: string;
  name: string;
  avatar: string;
  look: Look | null;
  status: string;
  officeName: string | null;
  points: number;
  streak: number;
  memberSince: string;
  title: string;
  /** Contadores crudos (solo los públicos del catálogo; los de otras ramas también). */
  stats: Record<string, number>;
  /** Mejor pez: especie y cm. */
  bestFish: { species: string; size: number } | null;
  /** Ganancia (o pérdida) neta en el casino. */
  casinoNet: number;
  favoriteArea: string | null;
  favoriteZone: string | null;
  achievements: ProfileAchievementDTO[];
  /** Cuántas personas hay en el equipo (para el % de cada logro). */
  teamSize: number;
  isMe: boolean;
}
