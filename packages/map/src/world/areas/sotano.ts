import type { AreaDef } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- Sótano: casino, club y cine ----------
// Se baja por la escalera del recibidor y se llega al casino (arriba a la izquierda): la ruleta y el
// blackjack al centro, tragamonedas contra las paredes del fondo, la caja, una mesa de póker, la fuente
// y un rincón con sofás. Una puerta lleva al club (arriba a la derecha: la barra, la cabina de DJ y el
// tubo) y otra al cine (abajo: la pantalla con telón en la pared oeste y filas de butacas).

const CASINO_ROOM = { x: 0, y: 0, w: 18, h: 12 };
const CLUB_ROOM = { x: 18, y: 0, w: 10, h: 12 };
const CINEMA_ROOM = { x: 0, y: 12, w: 16, h: 6 };
/** Arcade (fase 5): abajo a la derecha, con puertas al club y al cine. */
const ARCADE_ROOM = { x: 16, y: 12, w: 12, h: 6 };
/** Máquinas de arcade contra la pared del club (miran hacia el sur); se juega parado delante. */
const ARCADE_CABINETS = [17, 18, 22, 23, 24, 25].map((x) => ({ x, y: ARCADE_ROOM.y }));

/** Paño de la ruleta (3x4) con la rueda (2x2) a su derecha, en la parte de arriba. */
const ROULETTE = { x: 5, y: 3 };
const BLACKJACK = { x: 11, y: 4 };
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
const POKER = { x: 3, y: 8 };
/** Tarima del club, de 3x3, con el tubo en el tile del medio. */
const STAGE = { x: 22, y: 5 };
/** Columnas de butacas del cine (miran a la pantalla, al oeste) y filas que ocupan. */
const CINEMA_COLUMNS = [4, 6, 8, 10];
const CINEMA_ROWS = [13, 14, 15, 16];

export const sotano: AreaDef = {
  id: "sotano",
  name: "Sótano",
  width: 28,
  height: 18,
  rooms: [
    { id: "casino", rect: CASINO_ROOM, floor: "casino", wallpaper: "wine" },
    { id: "club", rect: CLUB_ROOM, floor: "dance", wallpaper: "violet" },
    { id: "cine", rect: CINEMA_ROOM, floor: "cinema", wallpaper: "navy" },
    { id: "arcade", rect: ARCADE_ROOM, floor: "arcade", wallpaper: "violet" },
  ],
  doors: [
    { edge: "v", x: CLUB_ROOM.x, y: 5, width: 2 },
    { edge: "h", x: 10, y: CINEMA_ROOM.y, width: 2 },
    { edge: "h", x: 19, y: ARCADE_ROOM.y, width: 2 },
    { edge: "v", x: ARCADE_ROOM.x, y: 14, width: 2 },
  ],
  zones: [
    { id: "casino", name: "Casino", type: "common", rect: CASINO_ROOM, isolated: false },
    { id: "club", name: "Club", type: "common", rect: CLUB_ROOM, isolated: true },
    { id: "cine", name: "Cine", type: "common", rect: CINEMA_ROOM, isolated: true },
    { id: "arcade", name: "Arcade", type: "common", rect: ARCADE_ROOM, isolated: false },
  ],
  features: [
    // Casino: letreros de neón sobre los tragamonedas, reloj y cuadros.
    { kind: "clock", edge: "h", x: 4, y: 0 },
    { kind: "neon", edge: "h", x: 6, y: 0, width: 4, text: "JACKPOT" },
    { kind: "picture", edge: "h", x: 11, y: 0 },
    { kind: "picture", edge: "h", x: 15, y: 0 },
    { kind: "neon", edge: "v", x: 0, y: 5, width: 4, text: "CASINO" },
    { kind: "picture", edge: "v", x: 0, y: 10 },
    // Club: el letrero sobre la cabina de DJ y afiches junto a la barra.
    { kind: "poster", edge: "h", x: 18, y: 0 },
    { kind: "neon", edge: "h", x: 23, y: 0, width: 4, text: "CLUB" },
    // Cine: la pantalla ocupa toda la pared oeste.
    { kind: "cinema-screen", edge: "v", x: 0, y: CINEMA_ROOM.y, width: CINEMA_ROOM.h },
  ],
  furniture: [
    // ---- Casino ----
    place("stairs-up", 1, 0),
    ...[6, 7, 8, 9].map((x) => place("slot-machine", x, 0, "down")),
    ...[5, 6, 7, 8].map((y) => place("slot-machine", 0, y)),
    place("lamp", 4, 0),
    place("lamp", 11, 0),
    place("casino-cashier", 13, 0, "down"),
    place("fortune-wheel", 16, 0, "down"),
    place("palm", 17, 0),
    place("roulette-table", ROULETTE.x, ROULETTE.y),
    place("roulette-wheel", ROULETTE.x + 3, ROULETTE.y),
    place("blackjack-table", BLACKJACK.x, BLACKJACK.y),
    // Banquetas del blackjack (ver BLACKJACK_SEATS), mirando a la mesa.
    ...BLACKJACK_SEATS.map((s) => place("stool", s.x, s.y, s.facing)),
    // Póker de adorno, con banquetas a los dos lados para sentarse a conversar.
    place("poker-table", POKER.x, POKER.y),
    ...[0, 1, 2].map((dy) => place("stool", POKER.x - 1, POKER.y + dy, "right")),
    ...[0, 1, 2].map((dy) => place("stool", POKER.x + 2, POKER.y + dy, "left")),
    place("coin-fountain", 8, 8),
    // Rincón de sofás frente a frente con una mesita.
    place("lounge-sofa", 14, 8, "down"),
    place("cocktail-table", 14, 9),
    place("lounge-sofa", 14, 10, "up"),
    // Cordones a los lados de la puerta del club y afiches junto a la del cine.
    place("velvet-rope", 17, 4),
    place("velvet-rope", 17, 7),
    place("poster-stand", 9, 11, "down"),
    place("poster-stand", 12, 11, "down"),
    place("palm", 0, 11),
    place("palm", 17, 11),
    // ---- Club ----
    place("lamp-mushroom", 18, 0),
    place("bar-shelf", 19, 0, "down"),
    place("bar-shelf", 21, 0, "down"),
    ...[19, 20, 21, 22].map((x) => place("bar-counter", x, 1, "down")),
    ...[19, 20, 21, 22].map((x) => place("stool", x, 2, "up")),
    place("speaker", 23, 0, "down"),
    place("dj-booth", 24, 0, "down"),
    place("speaker", 26, 0, "down"),
    place("palm", 27, 0),
    place("pole-stage", STAGE.x, STAGE.y),
    place("dance-pole", STAGE.x + 1, STAGE.y + 1),
    // Sofás alrededor de la tarima.
    place("lounge-sofa", 19, 8),
    place("lounge-sofa", 26, 5, "left"),
    place("lounge-sofa", 22, 10, "up"),
    place("cocktail-table", 20, 8),
    place("cocktail-table", 26, 8),
    place("cocktail-table", 24, 10),
    place("speaker", 18, 11, "down"),
    place("speaker", 27, 11, "down"),
    // ---- Cine ----
    ...CINEMA_COLUMNS.flatMap((x) => CINEMA_ROWS.map((y) => place("cinema-seat", x, y, "left"))),
    place("speaker", 1, CINEMA_ROOM.y),
    place("speaker", 1, CINEMA_ROOM.y + CINEMA_ROOM.h - 1),
    place("projector", 13, 14, "left"),
    place("popcorn-machine", 15, CINEMA_ROOM.y, "down"),
    place("plant", 15, CINEMA_ROOM.y + CINEMA_ROOM.h - 1),
    // ---- Arcade ----
    ...ARCADE_CABINETS.map((c) => place("arcade-cabinet", c.x, c.y, "down")),
    place("claw-machine", 26, ARCADE_ROOM.y, "down"),
    place("claw-machine", 27, ARCADE_ROOM.y, "down"),
    place("plant", 16, ARCADE_ROOM.y),
    place("air-hockey", 20, 15, "down"),
    place("beanbag", 25, 16, "up"),
    place("beanbag", 26, 16, "up"),
    place("lamp-mushroom", 16, 17),
    place("lamp-mushroom", 27, 17),
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
    // Alrededor de la mesa de ruleta (desde cualquiera de esos lugares se apuesta).
    ...[
      [ROULETTE.x - 1, ROULETTE.y],
      [ROULETTE.x - 1, ROULETTE.y + 1],
      [ROULETTE.x - 1, ROULETTE.y + 2],
      [ROULETTE.x - 1, ROULETTE.y + 3],
      [ROULETTE.x + 3, ROULETTE.y + 2],
      [ROULETTE.x + 3, ROULETTE.y + 3],
      [ROULETTE.x, ROULETTE.y + 4],
      [ROULETTE.x + 1, ROULETTE.y + 4],
      [ROULETTE.x + 2, ROULETTE.y + 4],
      [ROULETTE.x, ROULETTE.y - 1],
      [ROULETTE.x + 1, ROULETTE.y - 1],
      [ROULETTE.x + 2, ROULETTE.y - 1],
    ].map(([x, y]) => ({ type: "roulette" as const, name: "Ruleta", x: x!, y: y! })),
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
    { type: "casino_cashier", name: "Caja", x: 13, y: 1 },
    { type: "casino_cashier", name: "Caja", x: 14, y: 1 },
    // Delante de cada máquina del arcade, en el orden de ARCADE_CABINETS.
    ...ARCADE_CABINETS.map((c, i) => ({ type: "arcade" as const, name: `Máquina ${i + 1}`, x: c.x, y: c.y + 1 })),
    // Junto al proyector: desde ahí se elige qué se ve en el cine.
    { type: "cinema", name: "Proyector", x: 14, y: 14 },
  ],
};
