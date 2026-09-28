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
  /** Llamadas hechas desde un teléfono de escritorio. */
  phoneCalls: "phone_calls",
  /** Propinas tiradas en el tubo (en puntos) y las recibidas bailando. */
  tipsGiven: "tips_given",
  tipsReceived: "tips_received",
  // Mascotas, huerto y cocina
  /** Caricias y premios a las mascotas de la casa. */
  petCares: "pet_cares",
  /** Veces que una mascota comió de tu mano. */
  petTreats: "pet_treats",
  plantings: "plantings",
  harvests: "harvests",
  dishesCooked: "dishes_cooked",
  // Juegos
  /** Partidas terminadas en las máquinas del arcade. */
  arcadeGames: "arcade_games",
  /** Récords de la semana en el arcade. */
  arcadeRecords: "arcade_records",
  /** Victorias en ajedrez o damas. */
  boardWins: "board_wins",
  /** Carreras de sillas terminadas (llegando a la meta). */
  racesFinished: "races_finished",
  /** Bloques de foco (pomodoro) completos. */
  focusBlocks: "focus_blocks",
  /** Máximo: cuántos logros tiene (para los logros de logros). */
  achievementsUnlocked: "achievements_unlocked",
  // Observatorio: mirar el cielo de noche, estrellas fugaces vistas (y las vistas primero que nadie) y
  // los malvaviscos de su fogata.
  stargazing: "stargazing",
  shootingStars: "shooting_stars",
  shootingStarsFirst: "shooting_stars_first",
  marshmallows: "marshmallows",
  goldenMarshmallows: "marshmallows_golden",
  burntMarshmallows: "marshmallows_burnt",
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
  STAT_KEYS.achievementsUnlocked,
]);

export const ACHIEVEMENT_RARITIES = ["comun", "raro", "epico", "legendario"] as const;
export type AchievementRarity = (typeof ACHIEVEMENT_RARITIES)[number];

export const ACHIEVEMENT_RARITY: Record<AchievementRarity, { label: string; color: string }> = {
  comun: { label: "Común", color: "#9a6a40" },
  raro: { label: "Raro", color: "#4a70a0" },
  epico: { label: "Épico", color: "#6e3a96" },
  legendario: { label: "Legendario", color: "#dcae3f" },
};

/** Puntaje de logros: cuánto vale cada uno según su rareza (se ve en el perfil; no son puntos de la tienda). */
export const ACHIEVEMENT_SCORE: Record<AchievementRarity, number> = { comun: 10, raro: 25, epico: 50, legendario: 100 };

/** Grupos del perfil (pestañas de la grilla de logros). */
export const ACHIEVEMENT_CATEGORIES = ["cafe", "pesca", "casino", "vida", "juegos", "social", "cabana"] as const;
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

export const ACHIEVEMENT_CATEGORY: Record<AchievementCategory, { label: string; icon: BadgeIcon }> = {
  cafe: { label: "Cafetería y bar", icon: "cup" },
  pesca: { label: "Pesca", icon: "fish" },
  casino: { label: "Casino", icon: "chip" },
  vida: { label: "Huerto, cocina y mascotas", icon: "sprout" },
  juegos: { label: "Juegos", icon: "joystick" },
  social: { label: "Social", icon: "note" },
  cabana: { label: "La cabaña", icon: "map" },
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
  "paw",
  "sprout",
  "pan",
  "pawn",
  "joystick",
  "tomato",
  "phone",
  "trophy",
  "guitar",
  "bulb",
  "star",
  "telescope",
  "marshmallow",
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
  category: AchievementCategory;
  /** Secreto: bloqueado se ve como "???" (sin pista). */
  secret: boolean;
  /** Se desbloquea cuando el contador `stat` llega a `min`. */
  stat: string;
  min: number;
}

type Entry = Omit<Achievement, "category">;

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
): Entry => ({ id, name, icon, rarity, stat, min, goal, description, secret });

/** Un bloque del catálogo: todos sus logros van al mismo grupo del perfil. */
const section = (category: AchievementCategory, list: Entry[]): Achievement[] => list.map((x) => ({ ...x, category }));

/** Especies del álbum de pesca (sin la basura): "Álbum completo" pide todas. */
export const ALBUM_SPECIES = FISH.filter((f) => f.rarity !== "basura").length;

/** Niveles de la cabaña (el test del servidor revisa que "Turista" pida todos). */
export const TOURIST_AREAS = 9;

/** Logros de logros: cuántos hay que juntar (el último pide casi todo el catálogo). */
export const COLLECTOR_TIERS = [10, 30, 60] as const;

const HOUR = 3600;

// Los ids no se cambian nunca: son los que quedaron guardados en la base (UserAchievement).
export const ACHIEVEMENTS: readonly Achievement[] = [
  ...section("cafe", [
    a("buenos-dias", "Buenos días, cafetería", "cup", "comun", STAT_KEYS.cafeOrders, 1, "Pide algo en la cafetería", "El primer tinto nunca se olvida."),
    a("cliente-frecuente", "Cliente frecuente", "cup", "raro", STAT_KEYS.coffees, 50, "Pide 50 cafés", "Ya te saben el pedido de memoria."),
    a("cafeina-pura", "Cafeína pura", "cup", "legendario", STAT_KEYS.coffees, 300, "Pide 300 cafés", "Ya no parpadeas. Vibras."),
    a("adicto-al-tinto", "Adicto al tinto", "cup", "epico", `${STAT_PREFIX.use}tinto`, 150, "Dale 150 sorbos al tinto", "Tus venas ya son 40% tinto."),
    a("pandebonero", "Pandebonero oficial", "bread", "comun", STAT_KEYS.bites, 30, "Da 30 mordiscos", "Migas en el teclado desde el primer día."),
    a("buen-diente", "Buen diente", "bread", "raro", STAT_KEYS.bites, 300, "Da 300 mordiscos", "La cafetería ya hace pedidos pensando en ti."),
    a("fumador-de-habanos", "Fumador de habanos", "cigar", "raro", STAT_KEYS.habanos, 5, "Pide 5 habanos en el club", "Como un magnate, pero en pantuflas."),
    a("chimenea-humana", "Chimenea humana", "smoke", "raro", STAT_KEYS.puffs, 100, "Da 100 pitadas", "La chimenea de la cabaña te mira con envidia."),
    a("habitual-del-bar", "Habitual del bar", "glass", "comun", STAT_KEYS.barOrders, 25, "Pide 25 cosas en el bar del club", "El bartender ya te guarda la banqueta."),
    a("catador", "Catador de la casa", "glass", "raro", STAT_KEYS.alcoholSips, 100, "Dale 100 sorbos a algo con alcohol", "Notas de roble, vainilla y malas decisiones."),
    // Borrachera (secretos)
    a("primera-borrachera", "Primera borrachera", "bottle", "comun", STAT_KEYS.blackouts, 1, "Desmáyate de tanto tomar", "Nadie vio nada. Todos vieron todo.", true),
    a("durmio-en-el-sofa", "Durmió en el sofá", "sofa", "raro", STAT_KEYS.sofaNaps, 5, "Despierta 5 veces en el sofá de la zona de descanso", "El sofá del piso 2 ya tiene tu forma.", true),
    a("higado-de-acero", "Hígado de vacaciones", "bottle", "epico", STAT_KEYS.blackouts, 10, "Desmáyate 10 veces", "Tu hígado pidió una licencia no remunerada.", true),
  ]),
  ...section("pesca", [
    a("primera-picada", "Primera picada", "fish", "comun", STAT_KEYS.fishCaught, 1, "Saca tu primer pez del lago", "Era chiquito, pero era tuyo."),
    a("pesco-una-bota", "Pescó una bota", "boot", "comun", STAT_KEYS.boots, 1, "Saca una bota vieja del lago", "Talla 42. La otra sigue allá abajo.", true),
    a("limpia-lagos", "Limpiador del lago", "can", "comun", STAT_KEYS.fishTrash, 10, "Saca 10 cosas de basura del lago", "El lago te lo agradece. Los peces, no tanto."),
    a("pescador", "Pescador de fin de semana", "fish", "raro", STAT_KEYS.fishCaught, 50, "Saca 50 peces", "Ya tienes historias del que se te escapó."),
    a("lobo-de-lago", "Lobo de lago", "fish", "epico", STAT_KEYS.fishCaught, 250, "Saca 250 peces", "Los peces cuentan historias de terror sobre ti."),
    a("pez-gordo", "Pez gordo", "fish", "epico", STAT_KEYS.fishBestCm, 100, "Saca un pez de un metro o más", "Necesitaste las dos manos y un testigo."),
    a("coleccionista", "Coleccionista de escamas", "fish", "epico", STAT_KEYS.fishSpecies, 15, "Saca 15 especies distintas", "Tu álbum huele un poquito a lago."),
    a("cazatesoros", "Cazatesoros", "chest", "raro", STAT_KEYS.fishTreasures, 1, "Saca un cofre mientras pescas", "¡Un cofre! Adentro había… más lago."),
    a("pescador-legendario", "Pescador legendario", "crown", "legendario", STAT_KEYS.legendaryFish, 1, "Saca un pez legendario", "Nadie te cree. Menos mal que hay álbum."),
    a("pescador-mitico", "Pescador de leyendas", "crown", "legendario", STAT_KEYS.mythicFish, 1, "Saca un pez mítico", "Los abuelos tenían razón. Y tú tienes la foto.", true),
    a("album-completo", "Álbum completo", "fish", "legendario", STAT_KEYS.fishSpecies, ALBUM_SPECIES, `Saca las ${ALBUM_SPECIES} especies del lago`, "Ya no queda nada nuevo en el lago. ¿O sí?"),
  ]),
  ...section("casino", [
    a("hagan-sus-apuestas", "Hagan sus apuestas", "chip", "comun", STAT_KEYS.casinoBets, 1, "Apuesta en el casino", "Solo una, para probar. (Nunca es solo una.)"),
    a("cliente-de-la-casa", "Cliente de la casa", "chip", "raro", STAT_KEYS.casinoBets, 100, "Haz 100 apuestas", "El crupier ya sabe cómo tomas el café."),
    a("la-casa-siempre-gana", "La casa siempre gana", "chip", "raro", STAT_KEYS.casinoLost, 1000, "Pierde 1000 puntos en el casino", "Gracias por financiar las lámparas nuevas del casino."),
    a("gran-golpe", "El gran golpe", "coin", "epico", STAT_KEYS.casinoBestWin, 500, "Gana 500 puntos netos en una sola ronda", "Saliste del casino silbando."),
    a("ballena", "Ballena del sótano", "chip", "legendario", STAT_KEYS.casinoWagered, 20_000, "Apuesta 20.000 puntos en total", "Te mandaron una canasta de frutas de la gerencia."),
    a("suertudo", "Suertudo", "wheel", "epico", STAT_KEYS.rouletteStraights, 1, "Acierta un pleno en la ruleta", "Un número, una ficha, un grito."),
    a("blackjack-natural", "Blackjack natural", "cards", "raro", STAT_KEYS.blackjackNaturals, 1, "Saca 21 con las dos primeras cartas", "As y figura. El crupier suspira."),
    a("mano-caliente", "Mano caliente", "cards", "epico", STAT_KEYS.blackjackNaturals, 10, "Saca 10 blackjacks naturales", "Revisaron tus mangas. Nada. Todavía."),
  ]),
  ...section("vida", [
    a("mejor-amigo", "Mejor amigo", "paw", "comun", STAT_KEYS.petCares, 1, "Acaricia o consiente a una mascota", "Te ganaste una amistad con pelos."),
    a("encantador", "Encantador de mascotas", "paw", "raro", STAT_KEYS.petCares, 100, "Cuida 100 veces a las mascotas", "Te siguen por los pasillos. Todas."),
    a("de-mi-mano", "De mi mano", "paw", "raro", STAT_KEYS.petTreats, 20, "Dale de comer de tu mano a una mascota 20 veces", "Ya nadie se acuerda de la dieta."),
    a("amigo-de-los-gatos", "Amigo de los gatos", "cat", "comun", STAT_KEYS.catPets, 20, "Acaricia al gato 20 veces", "Ronronea solo cuando llegas tú."),
    a("sembrador", "Sembrador", "sprout", "comun", STAT_KEYS.plantings, 10, "Siembra 10 veces en el huerto", "Donde pones una semilla, algo sale."),
    a("pulgar-verde", "Pulgar verde", "sprout", "comun", STAT_KEYS.harvests, 1, "Cosecha algo del huerto", "Lo cuidaste, lo regaste, te lo vas a comer."),
    a("granjero", "Granjero de la cabaña", "sprout", "epico", STAT_KEYS.harvests, 100, "Cosecha 100 veces", "Las abejas ya te consideran de la familia."),
    a("primer-plato", "Primer plato", "pan", "comun", STAT_KEYS.dishesCooked, 1, "Cocina un plato en la estufa", "Nadie se enfermó. Éxito rotundo."),
    a("chef-de-la-casa", "Chef de la casa", "pan", "epico", STAT_KEYS.dishesCooked, 50, "Cocina 50 platos", "Del huerto a la mesa, con delantal y todo."),
  ]),
  ...section("juegos", [
    a("ficha-uno", "Ficha uno", "joystick", "comun", STAT_KEYS.arcadeGames, 1, "Juega una partida en el arcade", "Soplaste el cartucho por si acaso."),
    a("arcadero", "Rata de arcade", "joystick", "raro", STAT_KEYS.arcadeGames, 100, "Juega 100 partidas en el arcade", "Tienes los pulgares más fuertes del equipo."),
    a("record-semanal", "Récord de la semana", "trophy", "epico", STAT_KEYS.arcadeRecords, 1, "Supera el récord de la semana de un juego del arcade", "Tres letras en la pantalla. Las tuyas."),
    a("jaque-mate", "Jaque mate", "pawn", "raro", STAT_KEYS.boardWins, 1, "Gana una partida de ajedrez o damas", "El rey cayó. Tú no te lo crees."),
    a("gran-maestro", "Gran maestro", "pawn", "legendario", STAT_KEYS.boardWins, 25, "Gana 25 partidas de ajedrez o damas", "Piensas en 12 jugadas. Hasta para el almuerzo."),
    a("piloto", "Piloto de oficina", "chair", "comun", STAT_KEYS.racesFinished, 1, "Termina una carrera de sillas", "Ruedas, pasillo y cero seguro médico."),
    a("rueda-de-oro", "Rueda de oro", "chair", "raro", STAT_KEYS.racesFinished, 25, "Termina 25 carreras de sillas", "Tu silla tiene más kilómetros que tu carro."),
    a("mareo-voluntario", "Mareo voluntario", "chair", "comun", STAT_KEYS.chairSpins, 50, "Da 50 vueltas en la silla giratoria", "Productividad: 0. Diversión: toda.", true),
    a("pianista", "Pianista", "piano", "comun", STAT_KEYS.pianoPlays, 25, "Toca el piano 25 veces", "Para Elisa, pero con más entusiasmo."),
    a("concertista", "Concertista", "piano", "epico", STAT_KEYS.pianoPlays, 250, "Toca el piano 250 veces", "Los vecinos ya pidieron un bis. O silencio."),
    a("guitarrista", "Guitarrista de fogata", "guitar", "comun", STAT_KEYS.guitarPlays, 25, "Toca la guitarra 25 veces", "Wonderwall, obviamente."),
    a("pinchadiscos", "Pinchadiscos", "record", "comun", STAT_KEYS.recordsPlayed, 20, "Pon 20 discos en el tocadiscos", "Solo vinilo. Lo digital no tiene alma."),
  ]),
  ...section("social", [
    a("charlatan", "Charlatán", "note", "comun", STAT_KEYS.chatMessages, 100, "Manda 100 mensajes en el chat", "Tienes opiniones. Muchas."),
    a("tertuliano", "Tertuliano", "note", "raro", STAT_KEYS.chatMessages, 1000, "Manda 1000 mensajes en el chat", "El chat tiene tu voz en la cabeza."),
    a("expresivo", "Expresivo", "star", "comun", STAT_KEYS.emotes, 50, "Usa 50 emotes", "¿Para qué palabras si hay caritas?"),
    a("rey-de-la-pista", "Rey de la pista", "record", "raro", STAT_KEYS.dances, 100, "Baila 100 veces", "La pista del club tiene tus huellas."),
    a("salud", "¡Salud!", "glass", "comun", STAT_KEYS.toasts, 10, "Brinda 10 veces", "Chocar copas es tu idioma del amor."),
    a("alma-del-brindis", "Alma del brindis", "glass", "epico", STAT_KEYS.toasts, 100, "Brinda 100 veces", "Siempre hay algo que celebrar si estás tú."),
    a("toc-toc", "Toc, toc", "scroll", "comun", STAT_KEYS.knocks, 10, "Toca 10 puertas", "¿Quién es? Tú. Siempre tú."),
    a("ring-ring", "Ring, ring", "phone", "comun", STAT_KEYS.phoneCalls, 1, "Llama a alguien por el teléfono de escritorio", "Nadie contesta el teléfono. Tú sí llamas."),
    a("operadora", "Operadora", "phone", "raro", STAT_KEYS.phoneCalls, 50, "Haz 50 llamadas", "Ya te saben el tono de memoria."),
    a("paparazzi", "Paparazzi", "camera", "raro", STAT_KEYS.photosTaken, 25, "Toma 25 fotos", "Nadie sale mal en tus fotos. Casi nadie."),
    a("mecenas", "Mecenas del tubo", "coin", "raro", STAT_KEYS.tipsGiven, 100, "Tira 100 puntos en propinas en el tubo", "El arte hay que apoyarlo.", true),
    a("estrella-del-tubo", "Estrella del tubo", "star", "epico", STAT_KEYS.tipsReceived, 250, "Recibe 250 puntos en propinas bailando", "Llueven billetes. Literalmente.", true),
  ]),
  ...section("cabana", [
    a("primer-dia", "Primer día", "clock", "comun", STAT_KEYS.secondsOnline, HOUR, "Pasa una hora activa en la cabaña", "Ya sabes dónde queda el baño."),
    a("veterano", "Veterano de la cabaña", "clock", "epico", STAT_KEYS.secondsOnline, 100 * HOUR, "Pasa 100 horas activas en la cabaña", "Conoces cada tabla que cruje."),
    a("parte-del-mobiliario", "Parte del mobiliario", "clock", "legendario", STAT_KEYS.secondsOnline, 500 * HOUR, "Pasa 500 horas activas en la cabaña", "Te iban a inventariar con los muebles."),
    a("turista", "Turista", "map", "comun", STAT_KEYS.areasVisited, TOURIST_AREAS, "Visita todos los niveles de la cabaña", "Del sótano al observatorio, y hasta el Megabús por dentro."),
    a("paseante", "Paseante", "shoe", "comun", STAT_KEYS.tilesWalked, 1000, "Camina 1.000 baldosas", "Estirar las piernas también es trabajo."),
    a("caminante", "Pantuflas gastadas", "shoe", "raro", STAT_KEYS.tilesWalked, 10_000, "Camina 10.000 baldosas", "Tus pantuflas piden jubilación."),
    a("maratonista", "Maratonista de pasillo", "shoe", "epico", STAT_KEYS.tilesWalked, 100_000, "Camina 100.000 baldosas", "Ya diste la vuelta a la cabaña… mil veces."),
    a("madrugador", "Madrugador", "sunrise", "raro", STAT_KEYS.earlyDays, 1, "Está activo antes de las 7 de la mañana (Bogotá)", "Llegaste antes que el café."),
    a("buho", "Búho", "owl", "raro", STAT_KEYS.owlDays, 1, "Está activo después de medianoche (Bogotá)", "¿Trabajando o huyendo del sueño?", true),
    a("siete-de-siete", "Siete de siete", "flame", "raro", STAT_KEYS.streakBest, 7, "Reclama el buzón 7 días seguidos", "Una semana entera sin fallarle al buzón."),
    a("inquilino-fijo", "Inquilino fijo", "flame", "legendario", STAT_KEYS.streakBest, 30, "Reclama el buzón 30 días seguidos", "A esta altura ya pagas arriendo."),
    a("concentrado", "Concentrado", "tomato", "comun", STAT_KEYS.focusBlocks, 1, "Completa un bloque de foco (pomodoro)", "25 minutos sin mirar el chat. Heroico."),
    a("monje-del-foco", "Monje del foco", "tomato", "epico", STAT_KEYS.focusBlocks, 50, "Completa 50 bloques de foco", "El ruido del mundo ya no te alcanza."),
    a("ahorrador", "Ahorrador", "coin", "raro", STAT_KEYS.pointsPeak, 1000, "Junta 1000 puntos a la vez", "La alcancía ya pesa."),
    a("millonario", "Millonario", "coin", "epico", STAT_KEYS.pointsPeak, 5000, "Junta 5000 puntos a la vez", "Contar monedas ya es tu cardio."),
    a("magnate", "Magnate", "crown", "legendario", STAT_KEYS.pointsPeak, 20_000, "Junta 20.000 puntos a la vez", "Tienes un cuarto solo para las monedas."),
    a("decorador", "Decorador", "brush", "comun", STAT_KEYS.decorEdits, 10, "Haz 10 cambios en la decoración de tu oficina", "Mover el sofá tres centímetros también cuenta."),
    a("interiorista", "Interiorista", "brush", "raro", STAT_KEYS.decorEdits, 100, "Haz 100 cambios en la decoración de tu oficina", "Ya van cuatro versiones del mismo rincón."),
    a("manos-a-la-obra", "Manos a la obra", "scroll", "raro", STAT_KEYS.missionsDone, 5, "Completa 5 misiones del tablón", "El tablón ya tiene tu nombre escrito a mano."),
    a("electricista", "Electricista", "bulb", "comun", STAT_KEYS.lightsToggled, 100, "Prende o apaga una lámpara 100 veces", "Prendido, apagado, prendido… ¿se arregló?", true),
    a("coleccionista-de-logros", "Coleccionista de logros", "trophy", "raro", STAT_KEYS.achievementsUnlocked, COLLECTOR_TIERS[0], `Consigue ${COLLECTOR_TIERS[0]} logros`, "La vitrina de tu oficina empieza a llenarse."),
    a("vitrina-llena", "Vitrina llena", "trophy", "epico", STAT_KEYS.achievementsUnlocked, COLLECTOR_TIERS[1], `Consigue ${COLLECTOR_TIERS[1]} logros`, "Ya hubo que comprar otra repisa."),
    // Observatorio
    a("astronomo-de-patio", "Astrónomo de patio", "telescope", "comun", STAT_KEYS.stargazing, 1, "Mira por el telescopio del observatorio de noche", "Resulta que las estrellas tienen nombre. Y chisme."),
    a("cazaestrellas", "Cazaestrellas", "star", "raro", STAT_KEYS.shootingStars, 5, "Ve 5 estrellas fugaces por el telescopio", "Ya no pides deseos: los coleccionas."),
    a("pide-un-deseo", "Pide un deseo", "star", "epico", STAT_KEYS.shootingStarsFirst, 1, "Sé el primero en ver una estrella fugaz", "La viste antes que nadie. El deseo es tuyo (no lo cuentes)."),
    a("punto-exacto", "Punto exacto", "marshmallow", "comun", STAT_KEYS.goldenMarshmallows, 1, "Saca un malvavisco dorado de la fogata del observatorio", "Ni crudo ni carbón: el punto de la abuela."),
    a("maestro-malvavisquero", "Maestro malvavisquero", "marshmallow", "raro", STAT_KEYS.goldenMarshmallows, 25, "Saca 25 malvaviscos dorados", "Tu palito ya tiene nombre propio."),
    a("antorcha-humana", "Antorcha humana", "flame", "comun", STAT_KEYS.burntMarshmallows, 5, "Quema 5 malvaviscos", "Técnicamente también es cocinar.", true),
    a("leyenda-de-la-cabana", "Leyenda de la cabaña", "crown", "legendario", STAT_KEYS.achievementsUnlocked, COLLECTOR_TIERS[2], `Consigue ${COLLECTOR_TIERS[2]} logros`, "Cuentan historias de ti junto a la chimenea."),
  ]),
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

/** Puntaje de logros de alguien: la suma de lo que vale cada uno que tiene (según su rareza). */
export function achievementScore(unlocked: Iterable<string>): number {
  let total = 0;
  for (const id of unlocked) {
    const x = BY_ID.get(id);
    if (x) total += ACHIEVEMENT_SCORE[x.rarity];
  }
  return total;
}

/** El puntaje de tener todo el catálogo. */
export const MAX_ACHIEVEMENT_SCORE = ACHIEVEMENTS.reduce((t, x) => t + ACHIEVEMENT_SCORE[x.rarity], 0);

/**
 * Los que están más cerca de salir (sin los secretos, que no dan pista): para sugerir "lo próximo" en el
 * perfil. Empata el más barato de conseguir (menos rareza).
 */
export function nearestAchievements(
  stats: Readonly<Record<string, number>>,
  unlocked: ReadonlySet<string>,
  limit = 3,
): { achievement: Achievement; progress: number; value: number }[] {
  const order = ACHIEVEMENT_RARITIES;
  return ACHIEVEMENTS.filter((x) => !x.secret && !unlocked.has(x.id))
    .map((x) => ({ achievement: x, progress: achievementProgress(x, stats), value: Math.min(stats[x.stat] ?? 0, x.min) }))
    .filter((r) => r.progress > 0 && r.progress < 1)
    .sort((p, q) => q.progress - p.progress || order.indexOf(p.achievement.rarity) - order.indexOf(q.achievement.rarity))
    .slice(0, limit);
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
  { title: "Chef de la casa", score: (s) => (s[STAT_KEYS.dishesCooked] ?? 0) / 20 },
  { title: "Granjero de corazón", score: (s) => (s[STAT_KEYS.harvests] ?? 0) / 40 },
  { title: "Amigo de los animales", score: (s) => (s[STAT_KEYS.petCares] ?? 0) / 50 },
  { title: "Estratega de tablero", score: (s) => (s[STAT_KEYS.boardWins] ?? 0) / 10 },
  { title: "Rata de arcade", score: (s) => (s[STAT_KEYS.arcadeGames] ?? 0) / 40 },
  { title: "Monje del foco", score: (s) => (s[STAT_KEYS.focusBlocks] ?? 0) / 20 },
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
