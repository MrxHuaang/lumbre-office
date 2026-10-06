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
  | "lounge"
  // Variedad de interiores: baldosa hidráulica de dibujo, parqué en damero, terrazo, ladrillo de barro,
  // moqueta con dibujo y tablas anchas claras.
  | "hydraulic"
  | "checker"
  | "terrazzo"
  | "brick"
  | "moquette"
  | "planks"
  // Garaje: concreto gastado con manchas de aceite, los tablones gastados del taller y la gravilla de la
  // entrada (afuera).
  | "concrete"
  | "planks-worn"
  | "gravel"
  // Parada del bus: la calle (asfalto, carril exclusivo pintado, líneas y cordones; el dibujo depende de
  // dónde cae, ver art/bus-calle.ts). No se camina: queda fuera de la zona jugable.
  | "road"
  // El Megabús por dentro: piso de caucho antideslizante.
  | "rubber";
// Del rediseño de interiores: machimbre de madera, azulejos (cocina y baños) y verde bosque (biblioteca).
// Variedad: rayas finas, damasco dorado, ladrillo visto, listones de madera clara y estuco con zócalo.
export type WallpaperKind =
  | "sage"
  | "cream"
  | "blue"
  | "rose"
  | "wine"
  | "navy"
  | "violet"
  | "paneling"
  | "tile"
  | "forest"
  | "stripes"
  | "damask"
  | "brick"
  | "slats"
  | "colonial"
  // Garaje: bloque de cemento sin pintar y tablas sobre zócalo de piedra (el taller).
  | "cinderblock"
  | "boards"
  // Casa del árbol: tablones horizontales clavados con la viga redonda arriba.
  | "treehouse"
  // El Megabús por dentro: paneles claros con la franja verde lima, y los pliegues grises del fuelle.
  | "megabus"
  | "fuelle"
  // Estudio de grabación: zócalo de madera y paneles acústicos de tela acolchada.
  | "estudio"
  // Observatorio: piedra de la torre con vigas de madera (curva, como la torre por fuera).
  | "stonework";

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
export type WallFeatureKind = "window" | "picture" | "screen" | "menu" | "board" | "clock" | "whiteboard" | "neon" | "cinema-screen" | "video-wall" | "poster" | "mirror" | "acoustic" | "ventanal" | "shelf" | "map" | "portrait"
  // Garaje: tablero de herramientas, el portón de tablas por dentro, calendario viejo, telaraña y la ventana
  // empolvada.
  | "pegboard" | "barn-door" | "calendar" | "cobweb" | "dusty-window"
  // Casa del árbol: la ventana a la copa y la guirnalda de banderines.
  | "treehouse-window" | "bunting"
  // Megabús: las ventanas oscuras de piso a techo (con `text`, la pantalla de ruta encima).
  | "bus-window"
  // Estudio de grabación (art/podcast-room.ts): el cartel "EN EL AIRE", la puerta del pasillo del piso 3,
  // la ventana de estrellas y los afiches del espacio, del viaje de los planetitas de madera, del mapa de
  // los tres carriles y de programación.
  | "onair-sign" | "studio-door" | "star-window" | "poster-planets" | "poster-nebula" | "poster-rocket" | "star-map"
  | "poster-campfire" | "explore-log" | "lanes-map" | "sword-shield" | "poster-hello" | "poster-duck" | "diagram-board"
  // Observatorio: mapa estelar, el mural del cielo y la ventana redonda de ojo de buey.
  | "star-chart" | "mural" | "porthole";

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

/** Una mesa de ajedrez o de damas con sus dos sillas (la primera juega con blancas). */
export interface BoardTableDef {
  id: string;
  game: "ajedrez" | "damas";
  area: string;
  /** Tipo del mueble de la mesa (1x1). */
  type: string;
  x: number;
  y: number;
  seats: readonly [BoardSeatDef, BoardSeatDef];
}

export interface BoardSeatDef {
  x: number;
  y: number;
  facing: "left" | "right";
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
    // Frente a cada armario de la casa propia: cambiarse de ropa como en el probador.
    | "wardrobe"
    | "roulette"
    | "casino_cashier"
    | "pole_stage"
    // Fase 5: una por parcela del huerto (en el orden de las parcelas), donde se pesca, frente a cada
    // máquina del arcade (en el orden de las máquinas) y junto al proyector del cine.
    | "garden_plot"
    | "fishing_spot"
    | "arcade"
    // Las dos puntas del hockey de mesa del arcade (primero la del norte: el lado 0).
    | "air_hockey"
    // Alrededor de las mesas de rondas compartidas del casino: el baccarat, los dados y la carrera de
    // caballitos (desde ahí se apuesta).
    | "baccarat"
    | "sicbo"
    | "horse_race"
    | "cinema"
    // Frente a la máquina de crispetas del cine: la confitería.
    | "cinema_snacks"
    // Rediseño: frente a la barra del club, donde se piden tragos y cigarros.
    | "club_bar"
    // Club: delante de la cabina de DJ, donde se abre la consola para poner música.
    | "dj_booth"
    // Frente al tablón de fotos de la cafetería (ver la galería).
    | "photo_board"
    // Frente al acuario de la sala (ver qué peces nadan y quién los sacó).
    | "aquarium"
    // Salida de la carrera de sillas (pasillo del piso 2, junto a la bandera).
    | "chair_race"
    // Frente al cobertizo del huerto, donde se sacan la regadera y las semillas.
    | "tool_shed"
    // Junto a una mesa de ajedrez o de damas de la sala de juegos: desde ahí se mira la partida.
    | "board_game"
    // Uno por bancal del invernadero, en el orden de los bancales (ids GREENHOUSE_PLOT_BASE + índice).
    | "greenhouse_plot"
    // Parada del bus: uno frente a cada puerta de la estación (ahí se toma el bus y ahí se baja la gente).
    | "bus_stop"
    // La parada "Casa" de la casa de cada persona: bajo el refugio, donde se espera el bus de vuelta.
    | "home_bus_stop"
    // La piscina del jardín: junto a las escaleritas y detrás del trampolín.
    | "pool_steps"
    | "diving_board"
    // Frente a la vitrina de trofeos de cada oficina (los logros de su dueño).
    | "trophy_case"
    // Frente a cada estufa de la cocina (planta baja): ahí se cocina con lo del huerto.
    | "kitchen_stove"
    // Escenario del jardín: frente a la escalerita de la tarima ("Subir al escenario").
    | "stage"
    // Estudio de grabación: la consola de la mesa ("Grabar").
    | "podcast"
    // La granja del jardín: frente al horno y a la parrilla (el panel de cocinar) y el letrero del
    // gallinero (los nombres de los animales).
    | "grill"
    | "farm_sign"
    // Observatorio: frente al telescopio, junto a la fogata de malvaviscos, frente al orrery (el modelo del
    // sistema solar), frente al radar de señales y frente al escritorio con el diario de exploración.
    | "telescope"
    | "marshmallow_fire"
    | "orrery"
    | "signal_radar"
    | "logbook"
    // Frente al mostrador del puesto de pesca del lago (comprarle cañas y carnada a Don Evelio).
    | "fishing_shop"
    // Delante de la astrónoma del observatorio: E le pregunta por el cielo (el servidor contesta a todos).
    | "astronomer"
    // Delante del mostrador de la recepción (planta baja): Doña Gloria dice dónde está cada uno.
    | "reception"
    // Los festivales (festival-decor.ts): el puesto del festival y, en la Noche de brujas, junto a la
    // calabaza dorada del laberinto (cambia de rincón cada día).
    | "festival_shop"
    | "golden_pumpkin"
    // La Feria de las flores: la mesa del silletero (armar la silleta), el puesto de las semillas y,
    // delante de cada exhibidor, donde se exhibe y se vota.
    | "silletero_table"
    | "feria_shop"
    | "silleta_stand"
    // El Carnaval: el palco de la tarima (el concurso de disfraces).
    | "carnaval_contest"
    // El Año viejo: delante del muñeco (darle prendas y relleno), del cartel de los testamentos y de donde
    // se saca relleno (el costal de aserrín del taller y la paca de paja del gallinero).
    | "ano_viejo_muneco"
    | "ano_viejo_cartel"
    | "ano_viejo_relleno"
    // Amor y amistad: delante del cofre del amigo secreto y delante del trío de la serenata.
    | "amigo_secreto"
    | "amor_serenata";
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
  /**
   * Afuera, con `groundFine`: distancia (en tiles, con decimales; negativa adentro) de un punto del nivel
   * al claro, solo para el dibujo. El pasto se apaga hacia el bosque y empieza la copa siguiendo esa
   * orilla, que puede ser orgánica. Sin esto se mide al borde de `playable` (un rectángulo). En el borde
   * del nivel tiene que pasar de 5 (la copa empalma con el bosque de alrededor).
   */
  forestDistance?: (x: number, y: number) => number;
  rooms: RoomDef[];
  doors: DoorDef[];
  /** Tiles transitables fuera de las habitaciones (umbral de la puerta de entrada). */
  thresholds?: { x: number; y: number }[];
  zones: ZoneDef[];
  features: WallFeature[];
  furniture: Placement[];
  portals: PortalDef[];
  points: PointDef[];
  /** Tiles donde está parado alguien del personal (los NPC del casino, ver npcs.ts de shared): no se caminan. */
  npcTiles?: readonly { x: number; y: number }[];
}
