// Definición de los niveles de la cabaña, escrita en código (no hay editor externo).
// Coordenadas en tiles; el constructor (build.ts) las pasa a píxeles de mundo.

/** Direcciones del mundo: +x = "right", +y = "down" (en pantalla isométrica: sureste y suroeste). */
export type Facing = "down" | "left" | "right" | "up";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ZoneType = "office" | "meeting" | "table" | "common";
export type FloorKind =
  | "wood"
  | "carpet"
  | "tiles"
  | "stone"
  | "grass"
  | "path"
  | "doormat"
  | "casino"
  | "dance"
  | "cinema"
  | "arcade"
  /** Agua del estanque: no se camina (ver build.ts). */
  | "water"
  /** Muelle de tablas sobre el estanque. */
  | "dock"
  // Exterior rediseñado: el suelo del bosque (lo que no se pisa), la terraza de tablas, la tierra del
  // huerto y la arena de la orilla del lago y de la fogata.
  | "forest"
  | "deck"
  | "soil"
  | "sand"
  // Interiores del rediseño: parqué en espiga (salón, biblioteca), baldosa de cocina, mosaico blanco y
  // azul (los baños de la planta baja) y el deck del balcón y la terraza (tablas alineadas con la sala).
  | "parquet"
  | "kitchen"
  | "mosaic"
  | "terrace"
  // Sótano: mármol del vestíbulo, baldosas de los baños y madera oscura del club.
  | "marble"
  | "bath"
  | "lounge";
// Del rediseño de interiores: machimbre de madera, azulejos (cocina y baños) y verde bosque (biblioteca).
export type WallpaperKind = "sage" | "cream" | "blue" | "rose" | "wine" | "navy" | "violet" | "paneling" | "tile" | "forest";

export interface ZoneDef {
  id: string;
  name: string;
  type: ZoneType;
  rect: Rect;
  /** Audio/chat aislado del exterior (oficinas, sala de reuniones, mesas de la cafetería). */
  isolated: boolean;
  slot?: number;
  /** Tile justo afuera de la puerta (oficinas y salas cerradas). */
  door?: { x: number; y: number };
}

/** Habitación: piso, papel mural y paredes alrededor (salvo en las puertas). */
export interface RoomDef {
  id: string;
  rect: Rect;
  floor: FloorKind;
  wallpaper: WallpaperKind;
}

/**
 * Puerta: hueco en una pared de borde. `h` = borde horizontal sobre el tile (x, y) (entre y-1 e y);
 * `v` = borde vertical a la izquierda del tile (x, y) (entre x-1 y x).
 */
export interface DoorDef {
  edge: "h" | "v";
  x: number;
  y: number;
  width?: number;
}

// Del rediseño de interiores: espejo, paneles acústicos, ventanal de piso a techo, repisa, mapamundi y retrato.
export type WallFeatureKind = "window" | "picture" | "screen" | "menu" | "board" | "clock" | "whiteboard" | "neon" | "cinema-screen" | "poster" | "mirror" | "acoustic" | "ventanal" | "shelf" | "map" | "portrait";

/** Algo colgado en una pared alta (solo las del fondo: norte `h` y oeste `v`). */
export interface WallFeature {
  kind: WallFeatureKind;
  edge: "h" | "v";
  x: number;
  y: number;
  width?: number;
  /** Texto del letrero de neón (mayúsculas, sin tildes). */
  text?: string;
}

/** Un mueble u objeto: `type` es una clave del catálogo; (x, y) es la esquina mínima que ocupa. */
export interface Placement {
  type: string;
  x: number;
  y: number;
  facing?: Facing;
}

/** Tile que lleva a otro nivel (puerta de la cabaña, escaleras). */
export interface PortalDef {
  id: string;
  tiles: { x: number; y: number }[];
  to: { area: string; x: number; y: number; facing: Facing };
  label: string;
}

export interface PointDef {
  type:
    | "spawn"
    | "screen"
    | "task_board"
    | "mailbox"
    | "cafe_counter"
    | "shop_counter"
    | "fitting_room"
    | "roulette"
    | "casino_cashier"
    | "pole_stage"
    // Fase 5: una por parcela del huerto (en el orden de las parcelas), donde se pesca, frente a cada
    // máquina del arcade (en el orden de las máquinas) y junto al proyector del cine.
    | "garden_plot"
    | "fishing_spot"
    | "arcade"
    | "cinema"
    // Rediseño: frente a la barra del club, donde se piden tragos y cigarros.
    | "club_bar"
    // Club: delante de la cabina de DJ, donde se abre la consola para poner música.
    | "dj_booth"
    // Frente al tablón de fotos de la cafetería (ver la galería).
    | "photo_board";
  name: string;
  x: number;
  y: number;
  zone?: string;
}

export interface AreaDef {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Afuera (jardín): todo el terreno es transitable salvo los objetos. Adentro solo las habitaciones. */
  outdoor?: boolean;
  /**
   * Afuera: zona que se camina. Lo que queda fuera se dibuja (bosque, rocas) pero no se pisa: es el
   * límite invisible del mapa. Sin esto se camina todo el nivel.
   */
  playable?: Rect;
  /**
   * Afuera: lo que se ve más allá del borde del dibujo (un bosque que se repite sin fin), para que el
   * terreno no parezca una isla flotante. Con esto el borde del terreno no lleva losa.
   */
  surroundings?: "forest";
  /** Piso por tile en exteriores; en interiores lo define cada habitación. */
  ground?: (x: number, y: number) => FloorKind;
  /**
   * Afuera: el piso con precisión de píxel (x, y en tiles, con decimales), solo para el dibujo: así los
   * senderos, la orilla del lago y los canteros tienen bordes orgánicos. Lo que se camina sigue siendo
   * `ground` (por tile).
   */
  groundFine?: (x: number, y: number) => FloorKind;
  rooms: RoomDef[];
  doors: DoorDef[];
  /** Tiles transitables fuera de las habitaciones (umbral de la puerta de entrada). */
  thresholds?: { x: number; y: number }[];
  zones: ZoneDef[];
  features: WallFeature[];
  furniture: Placement[];
  portals: PortalDef[];
  points: PointDef[];
}
