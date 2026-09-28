import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  /** User.id (Auth.js). */
  @type("string") userId = "";
  @type("string") name = "";
  @type("string") avatar = "ada";
  /** Personaje personalizado como JSON (Look de @hyvento/shared); "" = usa `avatar`. */
  @type("string") look = "";
  /** Nivel de la cabaña donde está ("jardin", "planta-baja", "piso-2"). */
  @type("string") area = "";
  /** Posición de los pies, en px de mundo del nivel. */
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") dir = "down";
  @type("boolean") moving = false;
  /** Sentado en la silla/sofá de su posición (mira hacia `dir`). */
  @type("boolean") seated = false;
  /** Corriendo la carrera de sillas (se dibuja montado en una silla de oficina). */
  @type("boolean") racing = false;
  @type("string") status = "available";
  /** Saldo de puntos (lo lleva la base; aquí se refleja para el HUD y el ranking en vivo). */
  @type("number") points = 0;
  /** Lo que lleva en la mano, pedido en la cafetería o en el bar (id de CAFE_MENU o BAR_MENU; "" = nada). */
  @type("string") held = "";
  /** Zona actual ("" = sin zona). Define el aislamiento de chat/audio. */
  @type("string") zoneId = "";
  /** Lugar para mostrar (ver `placeAt`): zona, "door:<zona>" en una entrada, o "". */
  @type("string") place = "";
  /** Usos que le quedan a lo que lleva en cada mano ("4,5"; ver `parseHeldLeft`). */
  @type("string") heldLeft = "";
  /** Pesca (lo ven todos): "" nada, "wait" la boya flota, "bite" pica, "reel" el minijuego, "show:<pez>" lo levanta. */
  @type("string") fishing = "";
  /** Con qué caña pesca (lo ven todos, para el color: "" o "bambu" la de siempre, "fibra", "carbono"). */
  @type("string") fishingRod = "";
  /** Borrachera (0 sobrio … 3 borracho; ver DRUNK en @hyvento/shared): los demás lo ven tambalearse. */
  @type("uint8") drunk = 0;
  /** Nadando en la piscina del jardín (se dibuja de medio cuerpo; el servidor valida contra el agua). */
  @type("boolean") swimming = false;
  /** Recién salió del agua: gotea un rato (ver AGUA.wetMs). */
  @type("boolean") wet = false;
  /** Insignia destacada junto al nombre (id de un logro que tiene; "" = ninguna). La valida el servidor. */
  @type("string") badge = "";
  /** Energía de un plato de la cocina (id de la receta; "" = nada): camina un poco más rápido un rato. */
  @type("string") buff = "";
  /** Modo foco (focus.ts): "" nada, "work" concentrado (lleva el tomatito), "break" descanso. */
  @type("string") focus = "";
  /** Cuándo termina la fase del foco, en ms de la hora del servidor (0 = sin foco). */
  @type("number") focusEndsAt = 0;
  /** Preset del foco ("25-5" o "50-10"). */
  @type("string") focusPreset = "";
  /** Teléfono (phones.ts; lo ven todos): "" nada, "calling" llamando, "ringing" le suena, "talking" hablando. */
  @type("string") call = "";
  /** userId de la otra persona de la llamada: con ella se oyen sin importar dónde estén. */
  @type("string") callWith = "";
  /** Hora del servidor en que contestaron (0 mientras suena), para el reloj de la llamada. */
  @type("number") callSince = 0;
  /** Lo que le hizo la mercancía del Man del Sombrero (TripKind; "" = nada) y hasta cuándo (ms del servidor). */
  @type("string") trip = "";
  @type("number") tripUntil = 0;
}

/** Mueble puesto en una oficina decorada (tiles del nivel). */
export class OfficeItem extends Schema {
  @type("string") id = "";
  /** Tipo del catálogo de packages/map (p. ej. "plant"). */
  @type("string") type = "";
  @type("uint8") x = 0;
  @type("uint8") y = 0;
  @type("string") facing = "right";
}

export class OfficeInfo extends Schema {
  @type("string") zoneId = "";
  @type("string") name = "";
  /** User.id del dueño ("" = sin asignar: cualquiera puede entrar y nadie la puede cerrar). */
  @type("string") ownerId = "";
  @type("string") ownerName = "";
  @type("boolean") locked = false;
  /** Nota de la placa de la puerta (la pone el dueño; vive en la sala, no se guarda en la base). */
  @type("string") note = "";
  /** Notas sin leer que le dejaron al dueño en la puerta (solo la cuenta: el texto lo lee él por la web). */
  @type("uint8") notes = 0;
  /** La radio (office-radio.ts): video de YouTube que suena en bucle adentro ("" = apagada). */
  @type("string") radioVideo = "";
  @type("string") radioTitle = "";
  @type("number") radioStartedAt = 0;
  @type("boolean") radioPaused = false;
  @type("number") radioPausedAt = 0;
  @type("number") radioDurationMs = 0;
  /** User.id de quienes el dueño dejó pasar (se pierde al salir de la oficina). */
  @type(["string"]) guests = new ArraySchema<string>();
  /** Fase 3c: false = quedan los muebles del mapa; true = los de `items` (más el escritorio con PC y su silla). */
  @type("boolean") customized = false;
  @type([OfficeItem]) items = new ArraySchema<OfficeItem>();
  /** Piso y papel tapiz elegidos ("" = los del mapa). */
  @type("string") floor = "";
  @type("string") wallpaper = "";
}

/** Una apuesta de la ronda de ruleta (todos las ven sobre el paño). */
export class RouletteBet extends Schema {
  @type("string") userId = "";
  @type("string") name = "";
  /** Tipo de apuesta (RouletteBetSpec["kind"]). */
  @type("string") kind = "";
  /** Número del pleno, docena o columna (-1 si la apuesta no lleva). */
  @type("number") param = -1;
  @type("number") amount = 0;
}

/** Mesa de ruleta del sótano: la ronda en curso, el último número y los anteriores. */
export class RouletteState extends Schema {
  /** "betting" (se apuesta), "spinning" (gira; `result` ya está decidido) o "result" (se paga). */
  @type("string") phase = "betting";
  @type("number") round = 0;
  /** Cuándo termina la fase, en ms de la hora del servidor (el cliente corrige con `MSG.clock`). */
  @type("number") endsAt = 0;
  /** Número que salió (o que está saliendo); -1 = ninguno todavía. */
  @type("number") result = -1;
  /** Últimos números, el más reciente primero. */
  @type(["number"]) history = new ArraySchema<number>();
  @type([RouletteBet]) bets = new ArraySchema<RouletteBet>();
}

/** Una apuesta en una mesa de rondas compartidas (baccarat, dados o caballitos). */
export class MesaBet extends Schema {
  @type("string") userId = "";
  @type("string") name = "";
  /** La apuesta como la entiende la mesa ("banker", "t11", "h3"…). */
  @type("string") bet = "";
  @type("number") amount = 0;
}

/**
 * Mesa de rondas compartidas: se apuesta ("betting"), se juega ("playing": el resultado ya está y el
 * cliente lo anima) y se paga ("result").
 */
export class MesaState extends Schema {
  @type("string") phase = "betting";
  @type("number") round = 0;
  @type("number") endsAt = 0;
  /** Las cartas del baccarat, los dados o el orden de llegada de los caballitos (vacío mientras se apuesta). */
  @type(["number"]) result = new ArraySchema<number>();
  /** Resultados anteriores resumidos (ver `mesaSummary`), el más reciente primero. */
  @type(["number"]) history = new ArraySchema<number>();
  @type([MesaBet]) bets = new ArraySchema<MesaBet>();
}

/** Un asiento del blackjack (5 en total, en el orden de BLACKJACK_SEATS). */
export class BlackjackSeat extends Schema {
  @type("string") userId = "";
  @type("string") name = "";
  @type("number") bet = 0;
  @type(["number"]) cards = new ArraySchema<number>();
  /** "" (sin mano), "playing", "stand", "bust" o "blackjack". */
  @type("string") status = "";
  @type("boolean") doubled = false;
  /** Al terminar: "blackjack", "win", "push" o "lose" (y lo devuelto en `payout`). */
  @type("string") outcome = "";
  @type("number") payout = 0;
}

/** Mesa de blackjack del sótano. La carta tapada del crupier viaja como -1 hasta que se destapa. */
export class BlackjackState extends Schema {
  /** "waiting" (nadie apostó), "betting", "playing", "dealer" o "result". */
  @type("string") phase = "waiting";
  @type("number") round = 0;
  @type("number") endsAt = 0;
  /** Asiento que juega ahora (-1 = nadie). */
  @type("number") turn = -1;
  @type(["number"]) dealer = new ArraySchema<number>();
  @type([BlackjackSeat]) seats = new ArraySchema<BlackjackSeat>();
}

/** Un lado del hockey de mesa del arcade (0 = la punta del norte, 1 = la del sur). */
export class HockeyPlayer extends Schema {
  @type("string") userId = "";
  @type("string") name = "";
  @type("number") score = 0;
  /** Lo juega la máquina. */
  @type("boolean") bot = false;
}

/**
 * Hockey de mesa: lo que cambia poco (fase, jugadores, goles). El disco y los mazos van aparte, en
 * cuadros (`MSG.hockeyFrame`) solo a los del sótano.
 */
export class HockeyState extends Schema {
  /** "idle", "waiting" (uno pagó y espera rival), "countdown", "playing", "goal" (pausa) u "over". */
  @type("string") phase = "idle";
  @type("number") match = 0;
  /** Fin de la fase (o del partido, jugando), en ms de la hora del servidor. */
  @type("number") endsAt = 0;
  /** Al terminar: el lado que ganó (-1 = empate) y si fue porque el otro se fue. */
  @type("number") winner = -1;
  @type("boolean") forfeit = false;
  @type([HockeyPlayer]) sides = new ArraySchema<HockeyPlayer>(new HockeyPlayer(), new HockeyPlayer());
}

/** Una silla de una mesa de ajedrez o damas (0 = blancas, 1 = negras). */
export class BoardSeatState extends Schema {
  @type("string") userId = "";
  @type("string") name = "";
  /** Dijo "listo" (antes de empezar). */
  @type("boolean") ready = false;
  /** Jugando: desde cuándo no está sentado en su silla (0 = está). Si pasa BOARD.awayMs, pierde. */
  @type("number") awaySince = 0;
}

/**
 * Mesa de ajedrez o de damas de la sala de juegos (boardGames.ts). La posición va entera: los que miran
 * la ven en vivo y el navegador saca de ahí las jugadas legales para resaltarlas.
 */
export class BoardTableState extends Schema {
  @type("string") id = "";
  /** "ajedrez" o "damas". */
  @type("string") game = "";
  /** "idle" (esperando que los dos digan listo), "playing" u "over" (se ve el resultado). */
  @type("string") phase = "idle";
  @type("number") match = 0;
  /** FEN (ajedrez) o las 64 casillas (damas). */
  @type("string") position = "";
  /** Quién mueve: 0 = blancas, 1 = negras. */
  @type("number") turn = 0;
  /** Última jugada: las casillas del recorrido separadas por comas ("" si no hubo). */
  @type("string") last = "";
  /** El rey del que mueve está en jaque. */
  @type("boolean") check = false;
  @type("number") plies = 0;
  /** Reloj por jugada (segundos; 0 = sin reloj) y cuándo se acaba el turno (0 = sin reloj). */
  @type("number") clock = 0;
  @type("number") turnEndsAt = 0;
  /** Quién ofreció tablas (-1 = nadie). */
  @type("number") drawOffer = -1;
  /** Al terminar: quién ganó (-1 = tablas), por qué (BoardReason) y cuándo queda libre la mesa. */
  @type("number") winner = -1;
  @type("string") reason = "";
  @type("number") endsAt = 0;
  @type([BoardSeatState]) seats = new ArraySchema<BoardSeatState>(new BoardSeatState(), new BoardSeatState());
}

/** Casa viva: una mascota de la casa (la mueve el servidor; ver rooms/mascotas.ts). */
export class Pet extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  /** "gato" o "perro", y el pelaje (colores del dibujo). */
  @type("string") kind = "";
  @type("string") coat = "";
  @type("string") area = "";
  /** Posición en px de mundo del nivel. */
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") dir = "down";
  /** "stand", "walk", "sit", "sleep" o "eat" (PetPose). */
  @type("string") pose = "stand";
  /** Dueño si la adoptaron (User.id y nombre; "" = de la casa). */
  @type("string") ownerId = "";
  @type("string") ownerName = "";
  /** Cariño (0 a PET_BOND.max). */
  @type("uint8") love = 0;
}

/** Alguien bailando en el club: en la pista (con un paso) o en el tubo. */
export class ClubDancer extends Schema {
  /** "floor" (pista) o "pole" (tubo). */
  @type("string") kind = "floor";
  /** Paso de la pista (DANCE_MOVES) o, en el tubo, cuál es (`poleKey`). */
  @type("string") move = "";
  /** Hora del servidor al empezar: la rutina del tubo se cuenta desde ahí. */
  @type("number") since = 0;
}

/** Un video de YouTube de la cola del club (o el que suena, o uno que ya sonó). */
export class ClubVideo extends Schema {
  /** Id de la entrada (no del video: el mismo video puede entrar dos veces). */
  @type("string") id = "";
  @type("string") videoId = "";
  @type("string") title = "";
  /** Quién lo puso. */
  @type("string") by = "";
  /** User.id de quien lo puso (en el karaoke, quien canta). */
  @type("string") byId = "";
  /** Duración que dio el primer reproductor (0 = no se sabe todavía). */
  @type("number") durationMs = 0;
}

/** El club del sótano: lo que suena en la cabina (con la hora del servidor) y quién baila. */
/** Propinas del tubo de hoy (día de Bogotá, en memoria de la sala): la mayor y quién recibió más. */
export class ClubTipStats extends Schema {
  @type("number") best = 0;
  @type("string") bestFrom = "";
  @type("string") bestTo = "";
  @type("string") topName = "";
  @type("number") topTotal = 0;
}

export class ClubState extends Schema {
  /** Pista que suena (CLUB_TRACKS; "" = nada). */
  @type("string") track = "";
  /** Video que suena (`videoId` "" = ninguno); nunca a la vez que una pista. */
  @type(ClubVideo) video = new ClubVideo();
  /** Lo que viene después, en orden. */
  @type([ClubVideo]) queue = new ArraySchema<ClubVideo>();
  /** Lo que ya sonó, lo último primero (para volver a ponerlo). */
  @type([ClubVideo]) history = new ArraySchema<ClubVideo>();
  /** Hora del servidor en la que la pista estaba en 0 (todos cuentan el compás desde ahí). */
  @type("number") startedAt = 0;
  @type("boolean") paused = false;
  /** En pausa: en qué punto de la pista quedó (ms). */
  @type("number") pausedAt = 0;
  /** Quién puso la pista (se ve en la consola). */
  @type("string") dj = "";
  /** Quién baila, por sessionId. */
  @type({ map: ClubDancer }) dancers = new MapSchema<ClubDancer>();
  /** Las marcas de las propinas del tubo de hoy. */
  @type(ClubTipStats) tips = new ClubTipStats();
}

/** Eventos del calendario (rooms/events.ts): quién cumple hoy y si el club está en modo karaoke. */
export class EventsState extends Schema {
  /** Día de Bogotá al que corresponde (`eventDay`). */
  @type("number") day = 0;
  /** Quienes cumplen años hoy: userId → nombre (también los que no están conectados). */
  @type({ map: "string" }) birthdays = new MapSchema<string>();
  /** Viernes desde las 17:00 de Bogotá: el club es karaoke. */
  @type("boolean") karaoke = false;
}

/** El cine del sótano: la película que se proyecta (con la hora del servidor), la cola y lo que ya se vio. */
export class CinemaState extends Schema {
  /** La función de ahora (`videoId` "" = ninguna). */
  @type(ClubVideo) video = new ClubVideo();
  @type([ClubVideo]) queue = new ArraySchema<ClubVideo>();
  /** Lo que ya se vio, lo último primero (para volver a ponerlo). */
  @type([ClubVideo]) history = new ArraySchema<ClubVideo>();
  /** Hora del servidor en la que el video estaba en 0. */
  @type("number") startedAt = 0;
  @type("boolean") paused = false;
  /** En pausa: en qué punto del video quedó (ms). */
  @type("number") pausedAt = 0;
}

/** Jardín vivo: una parcela sembrada del huerto (PlotState de @hyvento/shared). La clave es su índice. */
export class GardenPlotState extends Schema {
  @type("string") crop = "";
  @type("string") plantedBy = "";
  @type("string") plantedByName = "";
  @type("number") plantedAt = 0;
  @type("number") growthMs = 0;
  @type("number") growthAt = 0;
  @type("number") wateredUntil = 0;
}

/** La casa del árbol (CasaArbolView de @hyvento/shared): la escalera recogida y el modo foco de adentro. */
export class TreeHouseState extends Schema {
  @type("boolean") locked = false;
  /** Quién recogió la escalera. */
  @type("string") lockedBy = "";
  /** "" apagado, "focus" o "break" (CasaArbolFocus). */
  @type("string") focus = "";
  /** Fin de la fase del modo foco, en ms de la hora del servidor. */
  @type("float64") focusEndsAt = 0;
}

/** Escenario del jardín: alguien de las gradas con la mano levantada (la fila de turnos, en orden). */
export class StageHand extends Schema {
  @type("string") sessionId = "";
  @type("string") userId = "";
  @type("string") name = "";
  @type("number") at = 0;
}

/** Escenario del jardín: la fila de turnos y quién tiene la palabra (se oye como si estuviera en la tarima). */
export class StageState extends Schema {
  @type([StageHand]) hands = new ArraySchema<StageHand>();
  /** userId de quien tiene la palabra ("" = nadie) y su nombre. */
  @type("string") floor = "";
  @type("string") floorName = "";
}

/**
 * El estudio de grabación (nivel `podcast`): "idle", "asking" (esperando el permiso de todos) o "recording" (EN
 * EL AIRE). El audio nunca llega al servidor: lo graba el navegador de `host`.
 */
export class PodcastState extends Schema {
  @type("string") phase = "idle";
  @type("string") host = "";
  @type("string") hostName = "";
  /** Cuándo se pidió permiso y cuándo empezó a grabar (hora del servidor). */
  @type("number") askedAt = 0;
  @type("number") startedAt = 0;
  /** Permiso de cada persona de adentro (userId → aceptó); quien pidió grabar ya aceptó. */
  @type({ map: "boolean" }) consents = new MapSchema<boolean>();
}

/** El Man del Sombrero (ver rooms/sombrero.ts): si anda por ahí y en qué escondite. */
export class SombreroState extends Schema {
  @type("boolean") present = false;
  /** Escondite del día (índice de SOMBRERO_HIDEOUTS) y dónde queda (se repite para el cliente). */
  @type("int8") hideout = -1;
  @type("string") area = "";
  @type("uint8") x = 0;
  @type("uint8") y = 0;
  @type("string") facing = "down";
}

/** El Megabús de la parada del jardín (ver rooms/bus.ts): la fase y cuándo empezó, con la hora del servidor. */
export class BusState extends Schema {
  /** BusPhase de @hyvento/shared: "away", "arriving", "open", "closing", "route" o "leaving". */
  @type("string") phase = "away";
  @type("float64") since = 0;
  /** Cuándo empieza a llegar el próximo bus del horario. */
  @type("float64") nextAt = 0;
  /** Número de pasada (para que el cliente note una llegada nueva). */
  @type("uint32") run = 0;
}

/** La granja: una gallina o la cabra (las mueve el servidor; ver rooms/granja.ts). */
export class FarmAnimal extends Schema {
  @type("string") id = "";
  /** "gallina" o "cabra", y el plumaje o pelaje (colores del dibujo). */
  @type("string") kind = "";
  @type("string") coat = "";
  /** El nombre que va ganando en la votación. */
  @type("string") name = "";
  /** Posición en px de mundo del jardín. */
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") dir = "down";
  /** "stand", "walk", "peck" o "sleep" (FarmArtPose). */
  @type("string") pose = "stand";
}

/** La parrilla: lo que alguien tiene en el fuego (una receta por persona; la clave es el userId). */
export class GrillJob extends Schema {
  @type("string") name = "";
  @type("string") recipe = "";
  /** "horno" o "parrilla": sobre cuál sale la barra. */
  @type("string") station = "";
  /** Lo cocinado (0 a 1) hasta `at` (hora del servidor), y desde ahí a ritmo `rate` (ver grillProgress). */
  @type("number") progress = 0;
  @type("number") rate = 1;
  @type("float64") at = 0;
  @type("number") cookMs = 0;
}

/** La granja del jardín: los animales, lo que está en el fuego y los huevos que quedan en el nido. */
export class GranjaState extends Schema {
  @type({ map: FarmAnimal }) animals = new MapSchema<FarmAnimal>();
  @type({ map: GrillJob }) grill = new MapSchema<GrillJob>();
  @type("uint8") eggs = 0;
}

export class OfficeState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: OfficeInfo }) offices = new MapSchema<OfficeInfo>();
  @type(RouletteState) roulette = new RouletteState();
  @type(BlackjackState) blackjack = new BlackjackState();
  @type(HockeyState) hockey = new HockeyState();
  /** Baccarat, dados y caballitos, por id de mesa (ver MESAS de @hyvento/shared). */
  @type({ map: MesaState }) mesas = new MapSchema<MesaState>();
  /** Mesas de ajedrez y damas de la sala de juegos, por id (ver BOARD_TABLES de @hyvento/map). */
  @type({ map: BoardTableState }) boards = new MapSchema<BoardTableState>();
  /** Muebles prendidos o apagados (tele, lámparas, tocadiscos), por `furnitureKey`; los que no están siguen como arrancan. */
  @type({ map: "boolean" }) switches = new MapSchema<boolean>();
  /** Cambios del editor de la casa por nivel (JSON de WorldEdits de @hyvento/map); sin entrada, el plano. */
  @type({ map: "string" }) worldEdits = new MapSchema<string>();
  /** Casa viva: contadores de los juegos de mesa y las pizarras (ajedrez, puzle), por `furnitureKey`. */
  @type({ map: "number" }) counters = new MapSchema<number>();
  /** Casa viva: cubículos del baño ocupados (`furnitureKey` → userId de quien está adentro). */
  @type({ map: "string" }) stalls = new MapSchema<string>();
  /** Casa viva: las mascotas, por id. */
  @type({ map: Pet }) pets = new MapSchema<Pet>();
  @type(ClubState) club = new ClubState();
  @type(CinemaState) cinema = new CinemaState();
  /** El escenario del jardín y el estudio de grabación del piso 3 (ver rooms/escenario.ts y rooms/podcast.ts). */
  @type(StageState) stage = new StageState();
  @type(PodcastState) podcast = new PodcastState();
  /** Jardín vivo: las parcelas sembradas del huerto, por índice de parcela (las vacías no están). */
  @type({ map: GardenPlotState }) garden = new MapSchema<GardenPlotState>();
  /** Clima de afuera (Weather de @hyvento/shared); lo sortea la sala cada 10-25 min (ver rooms/weather.ts). */
  @type("string") weather = "despejado";
  /**
   * Reloj del juego (GameClockState de @hyvento/shared): en el instante real `clockAnchorReal` iban
   * `clockAnchorMinute` minutos del juego. El cliente calcula la hora con su reloj; /time mueve el ancla.
   */
  @type("float64") clockAnchorReal = 0;
  @type("float64") clockAnchorMinute = 0;
  /** La casa del árbol del jardín (ver rooms/casaArbol.ts). */
  @type(TreeHouseState) treeHouse = new TreeHouseState();
  @type(BusState) bus = new BusState();
  @type(EventsState) events = new EventsState();
  /** El Man del Sombrero: si anda por ahí y dónde (lo decide la sala con el reloj del juego y el clima). */
  @type(SombreroState) sombrero = new SombreroState();
  /** La granja del jardín: el gallinero, la parrilla y lo que queda en el nido. */
  @type(GranjaState) granja = new GranjaState();
}
