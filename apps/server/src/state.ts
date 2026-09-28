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
  /** Borrachera (0 sobrio … 3 borracho; ver DRUNK en @hyvento/shared): los demás lo ven tambalearse. */
  @type("uint8") drunk = 0;
  /** Insignia destacada junto al nombre (id de un logro que tiene; "" = ninguna). La valida el servidor. */
  @type("string") badge = "";
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
  /** Duración que dio el primer reproductor (0 = no se sabe todavía). */
  @type("number") durationMs = 0;
}

/** El club del sótano: lo que suena en la cabina (con la hora del servidor) y quién baila. */
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

export class OfficeState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: OfficeInfo }) offices = new MapSchema<OfficeInfo>();
  @type(RouletteState) roulette = new RouletteState();
  @type(BlackjackState) blackjack = new BlackjackState();
  @type(HockeyState) hockey = new HockeyState();
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
  /** Jardín vivo: las parcelas sembradas del huerto, por índice de parcela (las vacías no están). */
  @type({ map: GardenPlotState }) garden = new MapSchema<GardenPlotState>();
  /** Clima de afuera (Weather de @hyvento/shared); lo sortea la sala cada 10-25 min (ver rooms/weather.ts). */
  @type("string") weather = "despejado";
}
