import type { AreaDef, PointDef, Rect } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- Sótano: el entretenimiento ----------
// Se baja por la escalera al vestíbulo (arriba al centro), que sobresale hacia el norte: así tiene
// paredes altas para un letrero de neón por sala y el guardarropa. Del vestíbulo se entra al casino
// (oeste) y al club (este, con el bar integrado), y por el pasillo de abajo al cine, al arcade y a los
// baños. Ninguna sala se cruza para llegar a otra.

/** El vestíbulo, justo de ancho para los tres neones del norte y la escalera; el resto va al casino. */
const VESTIBULO: Rect = { x: 18, y: 0, w: 12, h: 18 };
const CASINO_ROOM: Rect = { x: 0, y: 4, w: 18, h: 14 };
const CLUB_ROOM: Rect = { x: 30, y: 4, w: 15, h: 14 };
const PASILLO: Rect = { x: 0, y: 18, w: 45, h: 3 };
const CINEMA_ROOM: Rect = { x: 0, y: 21, w: 16, h: 9 };
const ARCADE_ROOM: Rect = { x: 16, y: 21, w: 17, h: 9 };
/**
 * Baños en la punta este, cortos: debajo queda afuera. Van al borde del edificio a propósito: una sala
 * con vacío a su oeste tendría ahí una pared alta, que taparía lo de atrás.
 */
const DAMAS: Rect = { x: 33, y: 21, w: 6, h: 4 };
const CABALLEROS: Rect = { x: 39, y: 21, w: 6, h: 4 };

/** Puertas del vestíbulo y del pasillo (el primer tile de cada una). */
const PUERTA_CASINO = { x: VESTIBULO.x, y: 10 };
const PUERTA_CLUB = { x: CLUB_ROOM.x, y: 10 };
const PUERTA_PASILLO = { x: 23, y: PASILLO.y };

// ---- Casino ----
/**
 * Paño de la ruleta (3x4); la rueda (2x2) va en su cabecera, del lado de -y. Entre los puntos de la
 * ruleta y el blackjack quedan 4 tiles libres, para pasar aunque haya gente jugando.
 */
const ROULETTE = { x: 4, y: 9 };
const BLACKJACK = { x: 12, y: 9 };
/**
 * Banquetas del blackjack en el orden de los asientos 1 a 5: una en la punta de arriba, tres frente a la
 * mesa y una en la punta de abajo (el crupier es automático, del otro lado).
 */
export const BLACKJACK_SEATS: readonly { x: number; y: number; facing: "left" | "down" | "up" }[] = [
  { x: BLACKJACK.x + 1, y: BLACKJACK.y - 1, facing: "down" },
  { x: BLACKJACK.x + 2, y: BLACKJACK.y, facing: "left" },
  { x: BLACKJACK.x + 2, y: BLACKJACK.y + 1, facing: "left" },
  { x: BLACKJACK.x + 2, y: BLACKJACK.y + 2, facing: "left" },
  { x: BLACKJACK.x + 1, y: BLACKJACK.y + 3, facing: "up" },
];
/** Póker de adorno, atravesado (3x2), con banquetas arriba y abajo. */
const POKER = { x: 2, y: 15 };

// ---- Club ----
/** Barra larga contra la pared norte: estante de botellas detrás, pasillo del barman y la barra. */
const BAR = { x: 31, y: 6, w: 7 };
/** Tarima del club, de 3x3, con el tubo en el tile del medio. */
const STAGE = { x: 40, y: 7 };

// ---- Cine ----
/** Filas de butacas (columnas en x, miran a la pantalla del oeste); la primera va en el piso y las demás en gradas. */
const CINEMA_ROWS = [4, 6, 8, 10];
/** Butacas de cada fila (en y), con un pasillo al medio y otro a cada lado. */
const CINEMA_SEATS_Y = [22, 23, 24, 26, 27, 28];

// ---- Arcade ----
/**
 * Máquinas de arcade: una fila contra la pared del pasillo (miran al sur) y otra contra la pared del
 * cine (miran al este). Se juega parado delante.
 */
const ARCADE_CABINETS: { x: number; y: number; facing: "down" | "right" }[] = [
  ...[18, 19, 20, 21, 22, 23].map((x) => ({ x, y: ARCADE_ROOM.y, facing: "down" as const })),
  ...[23, 24, 25, 26, 27, 28].map((y) => ({ x: ARCADE_ROOM.x, y, facing: "right" as const })),
];

const ruleta = (x: number, y: number): PointDef => ({ type: "roulette", name: "Ruleta", x, y });

export const sotano: AreaDef = {
  id: "sotano",
  name: "Sótano",
  width: 45,
  height: 30,
  rooms: [
    { id: "vestibulo", rect: VESTIBULO, floor: "marble", wallpaper: "wine" },
    { id: "casino", rect: CASINO_ROOM, floor: "casino", wallpaper: "wine" },
    { id: "club", rect: CLUB_ROOM, floor: "lounge", wallpaper: "violet" },
    { id: "pasillo", rect: PASILLO, floor: "carpet", wallpaper: "wine" },
    { id: "cine", rect: CINEMA_ROOM, floor: "cinema", wallpaper: "navy" },
    { id: "arcade", rect: ARCADE_ROOM, floor: "arcade", wallpaper: "violet" },
    { id: "banos-damas", rect: DAMAS, floor: "bath", wallpaper: "rose" },
    { id: "banos-caballeros", rect: CABALLEROS, floor: "bath", wallpaper: "blue" },
  ],
  doors: [
    { edge: "v", x: PUERTA_CASINO.x, y: PUERTA_CASINO.y, width: 2 },
    { edge: "v", x: PUERTA_CLUB.x, y: PUERTA_CLUB.y, width: 2 },
    { edge: "h", x: PUERTA_PASILLO.x, y: PUERTA_PASILLO.y, width: 2 },
    // Del pasillo: el cine (por atrás, junto al proyector), el arcade y los baños.
    { edge: "h", x: 12, y: CINEMA_ROOM.y, width: 2 },
    { edge: "h", x: 26, y: ARCADE_ROOM.y, width: 2 },
    { edge: "h", x: 35, y: DAMAS.y },
    { edge: "h", x: 41, y: CABALLEROS.y },
  ],
  zones: [
    { id: "vestibulo", name: "Vestíbulo", type: "common", rect: VESTIBULO, isolated: false },
    { id: "casino", name: "Casino", type: "common", rect: CASINO_ROOM, isolated: false },
    { id: "club", name: "Club", type: "common", rect: CLUB_ROOM, isolated: true },
    { id: "pasillo-sotano", name: "Pasillo", type: "common", rect: PASILLO, isolated: false },
    { id: "cine", name: "Cine", type: "common", rect: CINEMA_ROOM, isolated: true },
    { id: "arcade", name: "Arcade", type: "common", rect: ARCADE_ROOM, isolated: false },
    { id: "banos-damas", name: "Baño de damas", type: "common", rect: DAMAS, isolated: false },
    { id: "banos-caballeros", name: "Baño de caballeros", type: "common", rect: CABALLEROS, isolated: false },
  ],
  features: [
    // Vestíbulo: un neón por sala. El del casino en la pared oeste (queda de su lado); los demás al norte.
    { kind: "neon", edge: "v", x: VESTIBULO.x, y: 0, width: 4, text: "CASINO" },
    { kind: "neon", edge: "h", x: 18, y: 0, width: 3, text: "CINE" },
    { kind: "neon", edge: "h", x: 21, y: 0, width: 4, text: "ARCADE" },
    { kind: "neon", edge: "h", x: 25, y: 0, width: 3, text: "CLUB" },
    // Casino: letreros sobre los tragamonedas y la caja, reloj y cuadros.
    { kind: "neon", edge: "h", x: 1, y: CASINO_ROOM.y, width: 4, text: "JACKPOT" },
    { kind: "clock", edge: "h", x: 7, y: CASINO_ROOM.y },
    { kind: "picture", edge: "h", x: 9, y: CASINO_ROOM.y },
    { kind: "neon", edge: "h", x: 12, y: CASINO_ROOM.y, width: 3, text: "CAJA" },
    { kind: "neon", edge: "v", x: 0, y: 6, width: 4, text: "SLOTS" },
    { kind: "picture", edge: "v", x: 0, y: 11 },
    { kind: "neon", edge: "v", x: 0, y: 13, width: 3, text: "777" },
    // Club: el letrero del bar sobre el humidor (los estantes de botellas lo taparían) y el del DJ sobre la cabina.
    { kind: "neon", edge: "h", x: 37, y: CLUB_ROOM.y, width: 3, text: "BAR" },
    { kind: "neon", edge: "h", x: 41, y: CLUB_ROOM.y, width: 2, text: "DJ" },
    // Pasillo: un afiche al fondo.
    { kind: "poster", edge: "v", x: 0, y: 19 },
    // Cine: la pantalla con telón al centro de la pared oeste, con un afiche a cada lado.
    { kind: "poster", edge: "v", x: 0, y: CINEMA_ROOM.y },
    { kind: "cinema-screen", edge: "v", x: 0, y: CINEMA_ROOM.y + 1, width: 7 },
    { kind: "poster", edge: "v", x: 0, y: CINEMA_ROOM.y + 8 },
  ],
  furniture: [
    // ---- Vestíbulo ----
    // Alfombras primero (van debajo de todo, en este orden).
    place("lobby-rug", 21, 5),
    // La escalera contra la esquina noreste, sin dejar un rincón detrás.
    place("stairs-up", 28, 0),
    // Guardarropa en el rincón oeste: percheros con abrigos contra la pared y el mostrador delante.
    place("coat-rail", 18, 0),
    place("coat-rail", 18, 2),
    place("coat-check", 20, 1),
    place("lobby-statue", 23, 9),
    // Sofás a los dos lados de la estatua, mirándola.
    place("lounge-sofa", 21, 9),
    place("lounge-sofa", 26, 9, "left"),
    place("monstera", 20, 5),
    place("velvet-rope", 19, 9),
    place("velvet-rope", 19, 12),
    place("velvet-rope", 29, 9),
    place("velvet-rope", 29, 12),
    // Sala de espera a cada lado.
    place("lounge-sofa", 18, 14),
    place("cocktail-table", 19, 14),
    place("lounge-sofa", 29, 14, "left"),
    place("cocktail-table", 28, 14),
    place("lamp", 18, 5),
    place("lamp", 29, 5),
    place("palm", 18, 17),
    place("palm", 29, 17),
    place("monstera", 26, 4),
    place("poster-stand", 21, 17, "down"),
    place("poster-stand", 26, 17, "down"),
    place("lobby-sign", 25, 16),
    // ---- Casino ----
    place("palm", 0, 4),
    ...[1, 2, 3, 4].map((x) => place("slot-machine", x, CASINO_ROOM.y, "down")),
    place("wall-sconce", 6, CASINO_ROOM.y, "down"),
    place("lamp", 8, CASINO_ROOM.y),
    place("wall-sconce", 10, CASINO_ROOM.y, "down"),
    place("casino-cashier", 12, CASINO_ROOM.y, "down"),
    place("fortune-wheel", 15, CASINO_ROOM.y, "down"),
    place("palm", 17, CASINO_ROOM.y),
    ...[6, 7, 8, 9].map((y) => place("slot-machine", 0, y)),
    ...[13, 14, 15].map((y) => place("slot-machine", 0, y)),
    place("wall-sconce", 0, 11),
    place("roulette-table", ROULETTE.x, ROULETTE.y),
    place("roulette-wheel", ROULETTE.x + 1, ROULETTE.y - 2),
    place("blackjack-table", BLACKJACK.x, BLACKJACK.y),
    // Banquetas del blackjack (ver BLACKJACK_SEATS), mirando a la mesa.
    ...BLACKJACK_SEATS.map((s) => place("stool", s.x, s.y, s.facing)),
    // Póker de adorno, con banquetas a los dos lados para sentarse a conversar.
    place("poker-table", POKER.x, POKER.y, "down"),
    ...[0, 2].map((dx) => place("stool", POKER.x + dx, POKER.y - 1, "down")),
    ...[0, 1].map((dx) => place("stool", POKER.x + dx, POKER.y + 2, "up")),
    place("coin-fountain", 9, 15),
    // Rincón de sofás frente a frente con una mesita, junto a la puerta.
    place("lounge-sofa", 13, 14, "down"),
    place("cocktail-table", 13, 15),
    place("lounge-sofa", 13, 16, "up"),
    place("lamp", 16, 15),
    place("velvet-rope", 17, 9),
    place("velvet-rope", 17, 12),
    place("palm", 0, 17),
    // ---- Club ----
    place("dance-floor", 34, 9),
    place("pole-stage", STAGE.x, STAGE.y),
    place("dance-pole", STAGE.x + 1, STAGE.y + 1),
    place("plant", 30, 4),
    place("bar-shelf", 31, 4, "down"),
    place("bar-shelf", 33, 4, "down"),
    place("bar-shelf", 35, 4, "down"),
    place("cigar-humidor", 37, 4, "down"),
    // Los grifos de cerveza quedan frente a los lugares para pedir parado.
    ...Array.from({ length: BAR.w }, (_, i) => place(i === 2 || i === 5 ? "bar-taps" : "bar-counter", BAR.x + i, BAR.y, "down")),
    place("cigar-case", BAR.x + BAR.w, BAR.y, "down"),
    // Banquetas en pares: entre un par y otro queda lugar para pedir parado (los puntos club_bar).
    ...[0, 1, 3, 4, 6].map((i) => place("stool", BAR.x + i, BAR.y + 1, "up")),
    place("speaker", 40, CLUB_ROOM.y, "down"),
    place("dj-booth", 41, CLUB_ROOM.y, "down"),
    place("speaker", 43, CLUB_ROOM.y, "down"),
    place("palm", 44, CLUB_ROOM.y),
    // Sofás de terciopelo con mesas de cóctel alrededor de la pista.
    place("lounge-sofa", 44, 11, "left"),
    place("cocktail-table", 43, 11),
    place("lounge-sofa", 44, 14, "left"),
    place("cocktail-table", 43, 14),
    place("lounge-sofa", 32, 17, "up"),
    place("cocktail-table", 32, 16),
    place("lounge-sofa", 37, 17, "up"),
    place("cocktail-table", 37, 16),
    place("palm", 30, 14),
    place("speaker", 33, 9, "down"),
    place("speaker", 33, 13, "down"),
    place("lamp-mushroom", 30, 17),
    place("lamp-mushroom", 44, 17),
    // ---- Pasillo ----
    place("hall-runner", 2, 19),
    place("hall-runner", 16, 19),
    place("hall-runner", 30, 19),
    place("plant", 1, 18),
    place("bench", 6, 18, "down"),
    place("plant", 15, 18),
    place("plant", 30, 18),
    place("bench", 36, 18, "down"),
    place("plant", 44, 18),
    place("poster-stand", 11, 20, "down"),
    place("poster-stand", 14, 20, "down"),
    // ---- Cine ----
    place("cinema-stage", 0, CINEMA_ROOM.y + 1),
    place("cinema-tier-1", 5, CINEMA_ROOM.y),
    place("cinema-tier-2", 7, CINEMA_ROOM.y),
    place("cinema-tier-3", 9, CINEMA_ROOM.y),
    ...CINEMA_ROWS.flatMap((x, row) =>
      CINEMA_SEATS_Y.map((y) => place(row === 0 ? "cinema-seat" : `cinema-seat-${row}`, x, y, "left")),
    ),
    place("speaker", 1, CINEMA_ROOM.y),
    place("speaker", 1, CINEMA_ROOM.y + CINEMA_ROOM.h - 1),
    place("projector", 13, 25, "left"),
    place("popcorn-machine", 15, CINEMA_ROOM.y, "down"),
    place("plant", 15, CINEMA_ROOM.y + CINEMA_ROOM.h - 1),
    // ---- Arcade ----
    ...ARCADE_CABINETS.map((c) => place("arcade-cabinet", c.x, c.y, c.facing)),
    // La planta un tile adentro: pegada a la pared taparía la máquina de crispetas del cine.
    place("plant", ARCADE_ROOM.x + 1, ARCADE_ROOM.y),
    place("lamp-mushroom", 24, ARCADE_ROOM.y),
    place("claw-machine", 29, ARCADE_ROOM.y, "down"),
    place("claw-machine", 30, ARCADE_ROOM.y, "down"),
    place("prize-shelf", 31, ARCADE_ROOM.y, "down"),
    place("air-hockey", 23, 25),
    // Pinballs en fila; se juega parado del lado +x.
    place("pinball", 29, 24),
    place("pinball", 29, 26),
    place("pinball", 29, 28),
    // Rincón de la consola: la tele retro y puffs para jugar sentado.
    place("tv-retro", 20, 27, "down"),
    place("beanbag", 20, 29, "up"),
    place("beanbag", 21, 29, "up"),
    place("lamp-mushroom", 19, 27),
    place("lamp-mushroom", ARCADE_ROOM.x, 29),
    place("lamp-mushroom", 32, 29),
    // ---- Baños (de adorno) ----
    place("plant", DAMAS.x, DAMAS.y),
    ...[22, 23, 24].map((y) => place("bath-stall", DAMAS.x, y)),
    place("bath-sink", 37, DAMAS.y, "down"),
    place("bath-sink", 38, DAMAS.y, "down"),
    place("plant", CABALLEROS.x, CABALLEROS.y),
    ...[22, 23, 24].map((y) => place("bath-stall", CABALLEROS.x, y)),
    place("bath-sink", 43, CABALLEROS.y, "down"),
    place("bath-sink", 44, CABALLEROS.y, "down"),
  ],
  portals: [
    {
      id: "sotano-escalera",
      label: "Subir a la planta baja",
      tiles: CONEXIONES.sotano.escalera.tiles,
      to: hacia("planta-baja", CONEXIONES.plantaBaja.escaleraSotano),
    },
  ],
  points: [
    // Alrededor del paño de la ruleta (a los dos lados y al pie): desde ahí se apuesta.
    ...[0, 1, 2, 3].map((dy) => ruleta(ROULETTE.x - 1, ROULETTE.y + dy)),
    ...[0, 1, 2, 3].map((dy) => ruleta(ROULETTE.x + 3, ROULETTE.y + dy)),
    ...[0, 1, 2].map((dx) => ruleta(ROULETTE.x + dx, ROULETTE.y + 4)),
    // Sobre la tarima, alrededor del tubo: ahí se baila.
    ...[
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ].map(([dx, dy]) => ({ type: "pole_stage" as const, name: "Escenario", x: STAGE.x + dx!, y: STAGE.y + dy! })),
    // Frente a la barra del club, entre las banquetas: ahí se piden tragos y cigarros.
    ...[2, 5, 7].map((i) => ({ type: "club_bar" as const, name: "Barra del club", x: BAR.x + i, y: BAR.y + 1 })),
    { type: "casino_cashier", name: "Caja", x: 12, y: CASINO_ROOM.y + 1 },
    { type: "casino_cashier", name: "Caja", x: 13, y: CASINO_ROOM.y + 1 },
    // Delante de cada máquina del arcade, en el orden de ARCADE_CABINETS.
    ...ARCADE_CABINETS.map((c, i) => ({
      type: "arcade" as const,
      name: `Máquina ${i + 1}`,
      x: c.facing === "down" ? c.x : c.x + 1,
      y: c.facing === "down" ? c.y + 1 : c.y,
    })),
    // Junto al proyector: desde ahí se elige qué se ve en el cine.
    { type: "cinema", name: "Proyector", x: 13, y: 24 },
  ],
};
