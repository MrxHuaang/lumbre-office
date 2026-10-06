import {
  INVITE_TIMEOUT_MS,
  KNOCK_TIMEOUT_MS,
  type Invitation,
  type InviteOutcome,
  type InviteResult,
  type GameClockState,
  type ChatEvent,
  type Direction,
  type HumanAvatar,
  type Look,
  type KnockOutcome,
  type KnockRequest,
  type KnockResult,
  type OfficeEditResult,
  type OfficeItemDTO,
  type FocusPhase,
  type FocusPresetId,
  type OfficeRadioState,
  type PointsAwarded,
  type LeisureState,
  type PresenceStatus,
  type SpaKind,
  type Weather,
} from "@hyvento/shared";
import { create } from "zustand";

export interface Profile {
  name: string;
  avatar: HumanAvatar;
  /** Personaje personalizado; null = usa `avatar`. */
  look: Look | null;
}

export interface PlayerInfo {
  sessionId: string;
  userId: string;
  name: string;
  avatar: string;
  /** Nivel de la cabaña donde está. */
  area: string;
  zoneId: string;
  /** Lugar para mostrar (zona, "door:<zona>" o ""). */
  place: string;
  status: PresenceStatus;
  points: number;
  /** Lo que lleva en la mano (id de la carta) y los usos que le quedan a cada mano ("4,5"). */
  held: string;
  heldLeft: string;
  /** Modo foco: la fase ("" sin foco), cuándo termina (hora del servidor) y el preset. */
  focus: FocusPhase;
  focusEndsAt: number;
  focusPreset: FocusPresetId | "";
  /** Teléfono (CallPhase: "", "calling", "ringing", "talking") y con quién (userId). */
  call: string;
  callWith: string;
}

/**
 * Objetos con los que se interactúa (tecla E o clic): buzón y tablón del jardín, barra de la cafetería,
 * mostrador de la tienda y probador.
 */
export type Interactable = "mailbox" | "board" | "cafe" | "shop" | "fitting" | "wardrobe" | "pole" | "roulette" | "cashier" | "blackjack" | "bar" | "fishing" | "photos"
  // Club y arcade del sótano: la consola de la cabina de DJ y las máquinas.
  | "dj"
  | "arcade"
  // Cine del sótano: la cabina del proyector (programar, pausar y seguir la función) y la confitería.
  | "cinema"
  | "snacks"
  // El hockey de mesa del arcade (se juega en modo mesa, parado en una punta).
  | "hockey"
  // Las mesas de rondas compartidas del casino: baccarat, dados y carrera de caballitos (modo mesa).
  | "baccarat"
  | "dados"
  | "caballos"
  // Ajedrez y damas de la sala de juegos (piso 3): se juega sentado en una silla de la mesa o se mira.
  | "boardgame"
  // Carrera de sillas: la salida junto a la bandera del pasillo del piso 2.
  | "race"
  // El acuario del salón (planta baja): qué peces nadan y quién los sacó.
  | "aquarium"
  // El teléfono de escritorio (oficinas y recepción): el directorio para llamar.
  | "phone"
  // Jardín vivo: el cobertizo del huerto (la regadera y las semillas).
  | "shed"
  // La piscina: meterse por la escalera, tirarse del trampolín y (nadando, junto al borde) salir.
  | "pool"
  | "dive"
  | "swimOut"
  // La vitrina de trofeos de cada oficina (los logros de su dueño).
  | "trophies"
  // La cocina de la planta baja: la estufa (cocinar con lo del huerto y la miel).
  | "kitchen"
  // Escenario del jardín: la escalerita de la tarima (subir o bajar); estudio de grabación: la consola.
  | "stage"
  | "podcast"
  // Observatorio: el telescopio, la fogata de malvaviscos, el orrery, el radar de señales y el diario.
  | "telescope"
  | "marshmallow"
  | "orrery"
  | "radar"
  | "logbook"
  // La astrónoma del observatorio: E le pregunta por el cielo (contesta con una burbuja que ven todos).
  | "astronomer"
  // El Man del Sombrero (cuando está, en su escondite del día): su menú de diálogo y tienda.
  | "sombrero"
  // La estación del Megabús (afuera del portón): E sube al bus con las puertas abiertas (sin panel).
  | "bus"
  // La parada "Casa" de la casa propia: E llama el bus que vuelve a la estación (sin panel).
  | "homeBus"
  // La granja del jardín: el horno y la parrilla (cocinar) y el letrero del gallinero (los nombres).
  | "grill"
  | "coop"
  // El puesto de pesca del lago: el mostrador de Don Evelio (cañas y carnada).
  | "pesca"
  // La recepción del recibidor: Doña Gloria dice dónde anda cada uno (mundo lleno).
  | "reception"
  // El pesebre de las novenas (recibidor): E pone la figura del día (sin panel).
  | "pesebre"
  // Un personaje que te dio un encargo (y no tiene otro objeto al lado): E abre lo que te pidió.
  | "encargo"
  // La Noche de brujas: el puesto del caldero (dulces y el sombrero) y la calabaza dorada del laberinto.
  | "brujasShop"
  | "goldenPumpkin"
  // La Feria de las flores: la mesa del silletero (armar la silleta), el puesto de las semillas y los
  // exhibidores del patio (exhibir la silleta y votar).
  | "feriaTable"
  | "feriaShop"
  | "silletaStand"
  // El Carnaval: el puesto de máscaras, maicena y serpentinas, y el palco del concurso de disfraces.
  | "carnavalShop"
  | "carnavalConcurso"
  // El Festival de cometas: el taller, el puesto (y el carrito del raspao), el tablero del concurso y la
  // escalera del garaje (E baja la cometa de Santiago, sin panel).
  | "cometasTaller"
  | "cometasShop"
  | "cometasConcurso"
  | "cometaTecho"
  // La gente de la fiesta (genteFiesta.ts): E habla con quien está al lado en la tira de conversación.
  | "fiestaNpc";

/** `type` de la ayuda "E" cuando lo de al lado es una mascota (acariciarla): "mascota:<id>". */
export const PET_USABLE_PREFIX = "mascota:";

/** Mueble que se usa al alcance (tele, lámpara, piano…): para la ayuda "E" y el botón. */
export interface UsableNear {
  type: string;
  x: number;
  y: number;
  label: string;
}
/**
 * Brindis al alcance: "invite" (hay alguien cerca con bebida), "join" (alguien de al lado invita: `name`)
 * o "waiting" (ya levanté el vaso y espero a los demás).
 */
export interface ToastPrompt {
  mode: "invite" | "join" | "waiting";
  name?: string;
}

/** Paneles sobre la cabaña: los de los objetos y la mochila (se abre desde el HUD). */
export type PanelKind =
  | Interactable
  | "backpack"
  | "fishAlbum"
  | "whiteboard"
  // Notas en la puerta: escribir una en la puerta de otra oficina, o leer las de la tuya.
  | "doorNote"
  | "doorNotes"
  // Mundo lleno (se abren desde el mueble): tragamonedas, máquina de peluches, estante de premios y rueda.
  | "slots"
  | "claw"
  | "prizes"
  | "fortune"
  // La Noche de velitas: escribir el deseo del farol (en el muelle).
  | "deseo";

export interface OfficeView {
  zoneId: string;
  name: string;
  ownerId: string;
  ownerName: string;
  locked: boolean;
  /** Nota de la placa de la puerta (la pone el dueño). */
  note: string;
  /** Notas sin leer que le dejaron al dueño en la puerta (se ven como post-its). */
  notes: number;
  /** La radio de la oficina (suena solo adentro), o null si está apagada. */
  radio: OfficeRadioState | null;
  guests: string[];
  /** Fase 3c: false = quedan los muebles del mapa; true = los de `items` (más el escritorio con PC y su silla). */
  customized: boolean;
  items: OfficeItemDTO[];
  /** Piso y papel tapiz elegidos ("" = los del mapa). */
  floor: string;
  wallpaper: string;
}

/**
 * Mueble elegido en el modo decorar: uno de la mochila (`type`) para ponerlo, o uno ya puesto
 * (`itemId`) para moverlo o quitarlo.
 */
export interface DecorPick {
  type: string;
  itemId?: string;
}

const TURN: Record<Direction, Direction> = { right: "down", down: "left", left: "up", up: "right" };

export interface ZoneInfo {
  id: string;
  name: string;
  type: string;
  isolated: boolean;
}

export interface Notice {
  id: number;
  text: string;
  tone: "info" | "success" | "warning";
  /** Cuántas veces seguidas salió el mismo aviso (se muestra "×N" desde 2). */
  count?: number;
  action?: { label: string; run: () => void };
}

export type WalkTarget = ({ kind: "zone"; zoneId: string } | { kind: "player"; sessionId: string } | { kind: "point"; x: number; y: number }) & { nonce: number };

type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface OfficeStore {
  connection: ConnectionStatus;
  error: string | null;
  sessionId: string | null;
  players: Record<string, PlayerInfo>;
  offices: Record<string, OfficeView>;
  zone: ZoneInfo | null;
  /** Lugar actual del jugador local (ver `placeAt`), calculado en el cliente. */
  place: string;
  /** Nombres de las zonas del mapa, por id. */
  zoneNames: Record<string, string>;
  /** El chat de la cabaña (se lee y se escribe en Mensajes del celular). */
  messages: ChatEvent[];
  /** Hay un input de texto enfocado: el juego no debe leer el teclado. */
  typing: boolean;
  /**
   * Cuántos lo pidieron (chat, paneles, selector de emotes, intercambio): `typing` sigue mientras quede
   * alguno. Si fuera un solo booleano, cerrar un panel soltaría el teclado con otro todavía abierto.
   */
  typingHolds: number;
  /** Oficina cerrada frente a cuya puerta está el jugador (para ofrecer "tocar"). */
  doorPrompt: string | null;
  /** Junto a un asiento libre ("sit") o sentado ("stand"), para mostrar la ayuda de la tecla E. */
  seatPrompt: "sit" | "stand" | null;
  /** Sentado frente a un escritorio con computador (se puede prender el PC). */
  atComputer: boolean;
  /** Sentado en una silla que gira (la del escritorio con PC): R da unas vueltas. */
  atSwivel: boolean;
  /** El asiento de la ayuda "E" es una reposera de la piscina (se lee "tomar el sol"). */
  seatSun: boolean;
  /** El asiento de la ayuda "E" es de la tina o de la sauna del lago (se lee "meterse a la tina"…). */
  seatSpa: SpaKind | null;
  /** Sentado con un teléfono al alcance (de pie, el teléfono sale como objeto con "E"). */
  atPhone: boolean;
  /** Se puede brindar (B): invitar a alguien cerca con bebida, o sumarse al brindis de al lado. */
  toastPrompt: ToastPrompt | null;
  /** El PC está prendido: el mapa no responde a clics ni teclas. */
  pcOn: boolean;
  /** Oficina a la que tocamos y cuya respuesta esperamos. */
  pendingKnock: string | null;
  /** Toques recibidos en mi oficina, pendientes de respuesta. */
  knockRequests: (KnockRequest & { expiresAt: number })[];
  notices: Notice[];
  /**
   * Pedido a la escena de caminar hasta una zona o hasta alguien (por sessionId), aunque esté en otro
   * nivel (cambia `nonce` para repetir).
   */
  walkTarget: WalkTarget | null;
  /** Invitaciones recibidas ("te invita a su oficina"), pendientes de respuesta. */
  invitations: (Invitation & { expiresAt: number })[];
  /**
   * Última invitación que llegó (cambia `id` en cada una). Es el "evento" para engancharse desde afuera
   * (p. ej. una notificación del navegador): `useOfficeStore.subscribe((s, prev) => s.lastInvitation !== prev.lastInvitation …)`.
   */
  lastInvitation: (Invitation & { id: number }) | null;
  /** Nivel en el que está el jugador local. */
  area: string;
  /** Modo noche (luces encendidas): lo manda solo el reloj del juego, que lleva el servidor. */
  night: boolean;
  autoNight: boolean;
  /** Modo privado: dentro de una oficina o la sala de reuniones, paredes altas y lo de afuera a oscuras. */
  privateWalls: boolean;
  setPrivateWalls: (on: boolean) => void;
  /** Cómo se ven los nombres sobre los personajes (se recuerda en este navegador; tecla N para cambiar). */
  nameTags: NameTagMode;
  setNameTags: (mode: NameTagMode) => void;
  cycleNameTags: () => void;
  /** Estoy en un nivel de adentro de la casa (el modo privado sirve en cualquier sala). */
  indoors: boolean;
  setIndoors: (on: boolean) => void;
  /** Clima de afuera (lo decide el servidor: `state.weather`). */
  weather: Weather;
  setWeather: (weather: Weather) => void;
  /** Reloj del juego (lo lleva el servidor: `state.clockAnchor*`); null hasta que llega. Ver game/gameClock.ts. */
  gameClock: GameClockState | null;
  setGameClock: (clock: GameClockState) => void;
  /** El festival del día del calendario del juego (`state.festival`, "" = ninguno) y su fase. */
  festival: { id: string; fase: string };
  /** Quienes cumplen años hoy (userId → nombre) y si el club está en modo karaoke (`state.events`). */
  birthdays: Record<string, string>;
  karaoke: boolean;
  setEvents: (e: { birthdays: Record<string, string>; karaoke: boolean }) => void;
  /** A quiénes ya felicité hoy (para no ofrecer el botón otra vez). */
  congratulated: Record<string, true>;
  markCongratulated: (userId: string) => void;
  /** Confeti en pantalla: cambia cada vez que hay que tirarlo (0 = nunca). */
  confetti: number;
  throwConfetti: () => void;
  /** Ya se dibujó el primer nivel (el jardín grande tarda un poco: mientras, el cartel de "Entrando"). */
  mapReady: boolean;
  setMapReady: (ready: boolean) => void;
  /** Objeto al alcance del jugador (para ofrecer "E: abrir"). */
  interact: Interactable | null;
  /** Mueble que se usa al alcance (si le gana al asiento más cercano). */
  usable: UsableNear | null;
  /** Panel abierto (buzón o tablón); `atObject` = se abrió junto al objeto (permite reclamar). */
  panel: { kind: PanelKind; atObject: boolean } | null;
  /** Último premio de puntos (cambia `id` en cada uno, para animarlo). */
  lastAward: (PointsAwarded & { id: number }) | null;
  /** Ocio ganado hoy contra el tope diario (null hasta que el servidor lo diga). */
  leisure: LeisureState | null;
  setLeisure: (l: LeisureState) => void;
  /** Modo decorar tu oficina: el clic pone o elige muebles en vez de caminar. */
  decorating: boolean;
  /** Editor de la casa (solo admins): usa decorPick/decorFacing igual que el editor de oficina. */
  worldEditing: boolean;
  setWorldEditing: (on: boolean) => void;
  /** Mueble elegido para poner o mover (null = ninguno: el clic elige uno puesto). */
  decorPick: DecorPick | null;
  /** Hacia dónde mira el mueble elegido (R lo gira). */
  decorFacing: Direction;
  /** Última respuesta del servidor al editor (cambia `id` en cada una: la mochila se vuelve a pedir). */
  decorResult: (OfficeEditResult & { id: number }) | null;

  setConnection: (c: ConnectionStatus, error?: string | null) => void;
  setSessionId: (id: string | null) => void;
  upsertPlayer: (p: PlayerInfo) => void;
  removePlayer: (sessionId: string) => void;
  upsertOffice: (o: OfficeView) => void;
  removeOffice: (zoneId: string) => void;
  setZone: (z: ZoneInfo | null) => void;
  setPlace: (place: string) => void;
  setZoneNames: (names: Record<string, string>) => void;
  addMessages: (m: ChatEvent[]) => void;
  setTyping: (t: boolean) => void;
  setDoorPrompt: (zoneId: string | null) => void;
  setSeatPrompt: (prompt: "sit" | "stand" | null) => void;
  setAtComputer: (at: boolean) => void;
  setAtSwivel: (at: boolean) => void;
  setSeatSpa: (spa: SpaKind | null) => void;
  setSeatSun: (sun: boolean) => void;
  setAtPhone: (at: boolean) => void;
  setToastPrompt: (prompt: ToastPrompt | null) => void;
  setPcOn: (on: boolean) => void;
  setPendingKnock: (zoneId: string | null) => void;
  addKnockRequest: (r: KnockRequest) => void;
  removeKnockRequest: (requestId: string) => void;
  handleKnockResult: (r: KnockResult) => void;
  notify: (text: string, tone?: Notice["tone"], action?: Notice["action"]) => void;
  dismissNotice: (id: number) => void;
  walkToZone: (zoneId: string) => void;
  /** Caminar hasta alguien (a un tile libre a su lado; si está en otro nivel, por los portales). */
  walkToPlayer: (sessionId: string) => void;
  /** Caminar a un punto del nivel actual (px de mundo), p. ej. desde el minimapa. */
  walkToPoint: (x: number, y: number) => void;
  addInvitation: (inv: Invitation) => void;
  removeInvitation: (inviteId: string) => void;
  handleInviteResult: (r: InviteResult) => void;
  setArea: (area: string) => void;
  /** El reloj del juego cruzó las 19:00 o las 7:00 (o llegó por primera vez). */
  setAutoNight: (auto: boolean) => void;
  setInteract: (i: Interactable | null) => void;
  setUsable: (u: UsableNear | null) => void;
  openPanel: (kind: PanelKind, atObject: boolean) => void;
  closePanel: () => void;
  addAward: (a: PointsAwarded) => void;
  setDecorating: (on: boolean) => void;
  pickDecor: (pick: DecorPick | null, facing?: Direction) => void;
  rotateDecor: () => void;
  setDecorResult: (r: OfficeEditResult) => void;
  reset: () => void;
}

const MAX_MESSAGES = 200;
const NOTICE_MS = 4500;
let noticeId = 0;

const KNOCK_TEXT: Record<KnockOutcome, (owner: string) => { text: string; tone: Notice["tone"] }> = {
  accepted: (o) => ({ text: `${o} te dejó pasar.`, tone: "success" }),
  declined: (o) => ({ text: `${o} no puede atenderte ahora.`, tone: "warning" }),
  timeout: (o) => ({ text: `${o} no respondió.`, tone: "warning" }),
  "owner-away": (o) => ({ text: `${o} no está conectado ahora.`, tone: "info" }),
  "not-locked": () => ({ text: "La puerta está abierta, puedes entrar.", tone: "info" }),
  "too-soon": () => ({ text: "Espera un momento antes de volver a tocar.", tone: "info" }),
  dnd: (o) => ({ text: `${o} está en "No molestar". Prueba más tarde.`, tone: "warning" }),
};

const INVITE_TEXT: Record<InviteOutcome, (name: string) => { text: string; tone: Notice["tone"] }> = {
  sent: (n) => ({ text: `Le avisamos a ${n}.`, tone: "success" }),
  accepted: (n) => ({ text: `${n} va para allá.`, tone: "success" }),
  declined: (n) => ({ text: `${n} no puede ahora.`, tone: "info" }),
  timeout: (n) => ({ text: `${n} no respondió la invitación.`, tone: "info" }),
  offline: () => ({ text: "Esa persona ya no está conectada.", tone: "warning" }),
  "too-soon": (n) => ({ text: `Ya invitaste a ${n} hace poco. Espera un momento.`, tone: "info" }),
  dnd: (n) => ({ text: `${n} está en No molestar.`, tone: "info" }),
};

// Clave nueva: al pasar las paredes altas a predeterminadas, todos arrancan con ellas una vez (lo que se
// eligió con la clave vieja, "hyvento:paredes-altas", arrancaba apagado).
const PRIVATE_WALLS_KEY = "hyvento:paredes-altas-v2";

/**
 * Nombres sobre los personajes: completos, cortos ("Juan J.", sin el propio) u ocultos. En cualquier modo,
 * al pasar el mouse por encima de alguien se ve su nombre completo.
 */
export const NAME_TAG_MODES = ["corto", "completo", "oculto"] as const;
export type NameTagMode = (typeof NAME_TAG_MODES)[number];
export const NAME_TAG_LABEL: Record<NameTagMode, string> = { corto: "Nombres cortos", completo: "Nombres completos", oculto: "Nombres ocultos" };
const NAME_TAGS_KEY = "hyvento:nombres";

function loadNameTags(): NameTagMode {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(NAME_TAGS_KEY) : null;
    return (NAME_TAG_MODES as readonly string[]).includes(v ?? "") ? (v as NameTagMode) : "corto";
  } catch {
    return "corto";
  }
}

/** El modo privado se recuerda en este navegador: arranca prendido (paredes altas al entrar a la cabaña). */
function loadPrivateWalls(): boolean {
  try {
    return typeof localStorage === "undefined" || localStorage.getItem(PRIVATE_WALLS_KEY) !== "0";
  } catch {
    return true;
  }
}

const initial = {
  connection: "idle" as ConnectionStatus,
  error: null,
  sessionId: null,
  players: {},
  offices: {},
  zone: null,
  place: "",
  zoneNames: {},
  messages: [],
  typing: false,
  typingHolds: 0,
  doorPrompt: null,
  seatPrompt: null as "sit" | "stand" | null,
  atComputer: false,
  atSwivel: false,
  seatSun: false,
  seatSpa: null as SpaKind | null,
  atPhone: false,
  toastPrompt: null as ToastPrompt | null,
  pcOn: false,
  pendingKnock: null,
  knockRequests: [],
  notices: [],
  walkTarget: null as WalkTarget | null,
  invitations: [] as (Invitation & { expiresAt: number })[],
  lastInvitation: null as (Invitation & { id: number }) | null,
  area: "",
  night: false,
  autoNight: false,
  privateWalls: loadPrivateWalls(),
  nameTags: loadNameTags(),
  indoors: false,
  weather: "despejado" as Weather,
  gameClock: null as GameClockState | null,
  festival: { id: "", fase: "" },
  birthdays: {} as Record<string, string>,
  karaoke: false,
  congratulated: {} as Record<string, true>,
  confetti: 0,
  mapReady: false,
  interact: null as Interactable | null,
  usable: null as UsableNear | null,
  panel: null as { kind: PanelKind; atObject: boolean } | null,
  lastAward: null as (PointsAwarded & { id: number }) | null,
  leisure: null as LeisureState | null,
  decorating: false,
  worldEditing: false,
  decorPick: null as DecorPick | null,
  decorFacing: "right" as Direction,
  decorResult: null as (OfficeEditResult & { id: number }) | null,
};

export const useOfficeStore = create<OfficeStore>((set, get) => ({
  ...initial,
  setConnection: (connection, error = null) => set({ connection, error }),
  setSessionId: (sessionId) => set({ sessionId }),
  upsertPlayer: (p) => set((s) => ({ players: { ...s.players, [p.sessionId]: p } })),
  removePlayer: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.players;
      return { players: rest };
    }),
  upsertOffice: (o) => set((s) => ({ offices: { ...s.offices, [o.zoneId]: o } })),
  removeOffice: (zoneId) =>
    set((s) => {
      const { [zoneId]: _removed, ...rest } = s.offices;
      return { offices: rest };
    }),
  setZone: (zone) => set({ zone }),
  setPlace: (place) => set({ place }),
  setZoneNames: (zoneNames) => set({ zoneNames }),
  addMessages: (m) =>
    set((s) => {
      const known = new Set(s.messages.map((x) => x.id));
      const fresh = m.filter((x) => !known.has(x.id));
      return { messages: [...s.messages, ...fresh].slice(-MAX_MESSAGES) };
    }),
  // Cada `true` se suelta con un `false` (foco y blur, montar y desmontar).
  setTyping: (on) =>
    set((s) => {
      const typingHolds = Math.max(0, s.typingHolds + (on ? 1 : -1));
      return { typingHolds, typing: typingHolds > 0 };
    }),
  setDoorPrompt: (doorPrompt) => set({ doorPrompt }),
  setSeatPrompt: (seatPrompt) => set({ seatPrompt }),
  setAtComputer: (atComputer) => set({ atComputer }),
  setAtSwivel: (atSwivel) => set({ atSwivel }),
  setSeatSun: (seatSun) => set({ seatSun }),
  setSeatSpa: (seatSpa) => set({ seatSpa }),
  setAtPhone: (atPhone) => set({ atPhone }),
  setToastPrompt: (toastPrompt) => set({ toastPrompt }),
  setPcOn: (pcOn) => set({ pcOn }),
  setPendingKnock: (pendingKnock) => set({ pendingKnock }),
  addKnockRequest: (r) => {
    const expiresAt = Date.now() + KNOCK_TIMEOUT_MS;
    set((s) => ({ knockRequests: [...s.knockRequests, { ...r, expiresAt }] }));
    setTimeout(() => get().removeKnockRequest(r.requestId), KNOCK_TIMEOUT_MS);
  },
  removeKnockRequest: (requestId) =>
    set((s) => ({ knockRequests: s.knockRequests.filter((k) => k.requestId !== requestId) })),
  handleKnockResult: (r) => {
    if (get().pendingKnock === r.zoneId) set({ pendingKnock: null });
    const { text, tone } = KNOCK_TEXT[r.outcome](r.ownerName || "La persona");
    get().notify(text, tone);
  },
  notify: (text, tone = "info", action) => {
    const id = ++noticeId;
    set((s) => {
      // El mismo aviso seguido no se apila: sube el "×N" y se renueva el tiempo (el id nuevo evita que
      // el temporizador del anterior lo cierre antes).
      const last = s.notices[s.notices.length - 1];
      if (last && !action && !last.action && last.text === text && last.tone === tone)
        return { notices: [...s.notices.slice(0, -1), { id, text, tone, count: (last.count ?? 1) + 1 }] };
      return { notices: [...s.notices.slice(-3), { id, text, tone, action }] };
    });
    setTimeout(() => get().dismissNotice(id), action ? NOTICE_MS * 2 : NOTICE_MS);
  },
  dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
  walkToZone: (zoneId) => set({ walkTarget: { kind: "zone", zoneId, nonce: Date.now() } }),
  walkToPlayer: (sessionId) => set({ walkTarget: { kind: "player", sessionId, nonce: Date.now() } }),
  walkToPoint: (x, y) => set({ walkTarget: { kind: "point", x, y, nonce: Date.now() } }),
  addInvitation: (inv) => {
    const expiresAt = Date.now() + INVITE_TIMEOUT_MS;
    set((s) => ({
      // Una nueva de la misma persona reemplaza la anterior.
      invitations: [...s.invitations.filter((i) => i.fromUserId !== inv.fromUserId), { ...inv, expiresAt }].slice(-3),
      lastInvitation: { ...inv, id: ++noticeId },
    }));
    setTimeout(() => get().removeInvitation(inv.inviteId), INVITE_TIMEOUT_MS);
  },
  removeInvitation: (inviteId) => set((s) => ({ invitations: s.invitations.filter((i) => i.inviteId !== inviteId) })),
  handleInviteResult: (r) => {
    const { text, tone } = INVITE_TEXT[r.outcome](r.toName || "La persona");
    get().notify(text, tone);
  },
  setArea: (area) => set({ area }),
  setAutoNight: (auto) => set({ autoNight: auto, night: auto }),
  setIndoors: (indoors) => set({ indoors }),
  setPrivateWalls: (privateWalls) => {
    set({ privateWalls });
    try {
      localStorage.setItem(PRIVATE_WALLS_KEY, privateWalls ? "1" : "0");
    } catch {
      // sin almacenamiento: vale solo para esta visita
    }
  },
  setNameTags: (nameTags) => {
    set({ nameTags });
    try {
      localStorage.setItem(NAME_TAGS_KEY, nameTags);
    } catch {
      // sin almacenamiento: vale solo para esta visita
    }
  },
  cycleNameTags: () => {
    const i = NAME_TAG_MODES.indexOf(get().nameTags);
    get().setNameTags(NAME_TAG_MODES[(i + 1) % NAME_TAG_MODES.length]!);
  },
  setWeather: (weather) => set({ weather }),
  setGameClock: (gameClock) => set({ gameClock }),
  setEvents: ({ birthdays, karaoke }) => set({ birthdays, karaoke }),
  markCongratulated: (userId) => set((s) => ({ congratulated: { ...s.congratulated, [userId]: true } })),
  throwConfetti: () => set({ confetti: Date.now() }),
  setMapReady: (mapReady) => set({ mapReady }),
  setInteract: (interact) => set({ interact }),
  setUsable: (usable) => set({ usable }),
  openPanel: (kind, atObject) => set({ panel: { kind, atObject } }),
  closePanel: () => set({ panel: null }),
  addAward: (a) => set({ lastAward: { ...a, id: ++noticeId } }),
  setLeisure: (leisure) => set({ leisure }),
  // Al entrar o salir del modo decorar no queda nada elegido.
  setDecorating: (decorating) => set({ decorating, worldEditing: false, decorPick: null, panel: decorating ? null : get().panel }),
  setWorldEditing: (worldEditing) => set({ worldEditing, decorating: false, decorPick: null, panel: worldEditing ? null : get().panel }),
  pickDecor: (decorPick, facing) => set((s) => ({ decorPick, decorFacing: facing ?? s.decorFacing })),
  rotateDecor: () => set((s) => ({ decorFacing: TURN[s.decorFacing] })),
  setDecorResult: (r) => set({ decorResult: { ...r, id: ++noticeId } }),
  // Las felicitaciones de hoy sobreviven a una reconexión (el servidor igual las recuerda).
  reset: () =>
    set((s) => ({
      ...initial,
      zoneNames: s.zoneNames,
      night: s.night,
      autoNight: s.autoNight,
      privateWalls: s.privateWalls,
      nameTags: s.nameTags,
      congratulated: s.congratulated,
    })),
}));

/** User.id del jugador local. */
export function selectMyUserId(s: Pick<OfficeStore, "sessionId" | "players">): string | null {
  return s.sessionId ? (s.players[s.sessionId]?.userId ?? null) : null;
}

/** ¿Estoy en un bloque de enfoque? (el chat no suena ni muestra el contador mientras tanto). */
export function selectFocusing(s: Pick<OfficeStore, "sessionId" | "players">): boolean {
  return Boolean(s.sessionId && s.players[s.sessionId]?.focus === "work");
}

/** Oficina de la que el jugador local es dueño. */
export function selectMyOffice(s: Pick<OfficeStore, "sessionId" | "players" | "offices">): OfficeView | null {
  const me = selectMyUserId(s);
  if (!me) return null;
  return Object.values(s.offices).find((o) => o.ownerId === me) ?? null;
}

/** ¿Puede este usuario entrar a la oficina? (misma regla que el servidor). */
export function canEnterOffice(office: OfficeView | undefined, userId: string | null): boolean {
  if (!office || !office.locked || !office.ownerId) return true;
  return userId !== null && (office.ownerId === userId || office.guests.includes(userId));
}
