// El observatorio del jardín (al este): la fogata de malvaviscos con su minijuego, el
// telescopio con el cielo y las estrellas fugaces, el radar de señales y el diario de exploración.
// Todo es puro: lo usan el servidor (las reglas, con el azar y la hora como parámetros), el cliente
// (qué dibujar) y los tests. "De noche" es la noche del reloj del juego (clock.ts), no la hora real.
import { z } from "zod";
import { STAT_KEYS, STAT_PREFIX } from "./achievements";

/** Mensajes propios del observatorio (así no se toca la lista general de protocol.ts). */
export const OBS_MSG = {
  /** Cliente → servidor: meter el malvavisco al fuego / sacarlo. */
  marshmallowStart: "obs:marshmallow:start",
  marshmallowPull: "obs:marshmallow:pull",
  /** Servidor → los del nivel: alguien lo metió, lo sacó o no pudo (MarshmallowEvent). */
  marshmallowEvent: "obs:marshmallow:event",
  /** Cliente → servidor: mirar por el telescopio / dejar de mirar. */
  telescopeLook: "obs:telescope:look",
  telescopeClose: "obs:telescope:close",
  /** Cliente → servidor: "¡la vi!" sobre una estrella fugaz ({ starId }). */
  starSpot: "obs:star:spot",
  /** Servidor → quien mira: el cielo, una estrella nueva o quién la vio primero (SkyEvent). */
  sky: "obs:sky",
  /** Servidor → los del observatorio: alguien tocó un instrumento en otro nivel (SignalPing, para el radar). */
  signal: "obs:signal",
  /** Cliente → servidor: E junto a la astrónoma (le pregunta por el cielo). */
  astronomerAsk: "obs:astronomer:ask",
  /** Servidor → los del observatorio: lo que contestó la astrónoma (AstronomerSay; todos ven la misma frase). */
  astronomerSay: "obs:astronomer:say",
} as const;

/** Lo que dijo la astrónoma y a quién (para que lo mire). */
export interface AstronomerSay {
  sessionId: string;
  text: string;
}

// ---------- Fogata de malvaviscos ----------

/**
 * El minijuego: E para meterlo al fuego y E para sacarlo a tiempo. Los tiempos son a fuego "normal"
 * (calor 100); cada malvavisco sale con un calor sorteado por el servidor, que acelera o frena todo, así
 * no hay un tiempo fijo que aprenderse (el cliente lo ve dorarse con el mismo calor).
 */
export const MARSHMALLOW = {
  /** Desde aquí ya está tostadito (antes, crudo). */
  toastedAtMs: 2_200,
  /** El punto exacto: dorado. */
  goldenAtMs: 4_000,
  /** Desde aquí se quema. */
  burntAtMs: 5_600,
  /** Si nadie lo saca, se cae al fuego. */
  dropAtMs: 9_000,
  /** Calor sorteado (en %), entre estos dos (incluidos). */
  heatMin: 80,
  heatMax: 125,
  /** Puntos (motivo LEISURE) según cómo salió. */
  points: { crudo: 0, tostado: 1, dorado: 3, quemado: 0 },
  /** Tope de puntos del malvavisco por persona y día de Bogotá (además del tope diario de LEISURE). */
  dailyPoints: 15,
  /** Pausa después de sacar uno (para ensartar el siguiente). */
  cooldownMs: 1_200,
  /** Hasta dónde se asa (tiles desde el punto de la fogata, como el resto de los objetos con E). */
  reachTiles: 1.4,
} as const;

export type MarshmallowTimings = Record<"toastedAtMs" | "goldenAtMs" | "burntAtMs" | "dropAtMs" | "cooldownMs", number>;

export const DONENESS = ["crudo", "tostado", "dorado", "quemado"] as const;
export type Doneness = (typeof DONENESS)[number];

export const DONENESS_TEXT: Record<Doneness, string> = {
  crudo: "Todavía estaba crudo",
  tostado: "Tostadito",
  dorado: "¡Dorado perfecto!",
  quemado: "Se quemó",
};

/** Tiempo "a fuego normal" que lleva asándose (el calor lo estira o lo encoge). */
export const roastedMs = (elapsedMs: number, heat: number) => Math.max(0, elapsedMs) * (heat / 100);

/** Cómo está el malvavisco después de `elapsedMs` al fuego con ese calor. */
export function doneness(elapsedMs: number, heat: number, t: MarshmallowTimings = MARSHMALLOW): Doneness {
  const ms = roastedMs(elapsedMs, heat);
  if (ms >= t.burntAtMs) return "quemado";
  if (ms >= t.goldenAtMs) return "dorado";
  if (ms >= t.toastedAtMs) return "tostado";
  return "crudo";
}

/** Tono del dibujo del palito (0 blanco, 1 tostadito, 2 dorado, 3 quemado; ver roastStick). */
export const donenessTone = (d: Doneness): 0 | 1 | 2 | 3 => DONENESS.indexOf(d) as 0 | 1 | 2 | 3;

/** Avance de 0 a 1 hasta quemarse (para la barrita del minijuego). */
export const roastProgress = (elapsedMs: number, heat: number, t: MarshmallowTimings = MARSHMALLOW) =>
  Math.min(1, roastedMs(elapsedMs, heat) / t.burntAtMs);

/** Calor del malvavisco a partir del azar (`random(n)` = entero en [0, n)). */
export const rollHeat = (random: (n: number) => number) => MARSHMALLOW.heatMin + random(MARSHMALLOW.heatMax - MARSHMALLOW.heatMin + 1);

/** Servidor → los del nivel. */
export type MarshmallowEvent =
  | { kind: "started"; sessionId: string; heat: number }
  | { kind: "result"; sessionId: string; doneness: Doneness; points: number; kept: boolean }
  | { kind: "error"; sessionId: string; reason: "far" | "busy" | "cooldown" };

export const MARSHMALLOW_ERROR_TEXT: Record<Extract<MarshmallowEvent, { kind: "error" }>["reason"], string> = {
  far: "Acércate a la fogata del observatorio.",
  busy: "Ya tienes uno en el fuego.",
  cooldown: "Ensarta el siguiente con calma.",
};

// ---------- Telescopio y estrellas fugaces ----------

/** El cielo del telescopio: coordenadas de 0 a 1000 (x) y 0 a 600 (y), el horizonte abajo. */
export const SKY = {
  width: 1000,
  height: 600,
  /** Cada cuánto pasa una estrella fugaz de noche (se sortea entre los dos). */
  starMinGapMs: 40_000,
  starMaxGapMs: 110_000,
  /** Lo que tarda en cruzar el cielo. */
  starFlightMs: 2_400,
  /** Después de cruzar, todavía se puede decir "¡la vi!". */
  starGraceMs: 1_600,
  /** Cada cuánto revisa el servidor el cielo. */
  tickMs: 1_000,
  /** Hasta dónde se mira por el telescopio (tiles desde su punto). */
  reachTiles: 1.4,
} as const;

export type SkyTimings = Record<"starMinGapMs" | "starMaxGapMs" | "starFlightMs" | "starGraceMs" | "tickMs", number>;

/** Una estrella fugaz: sale de (x, y) y cruza en la dirección `angle` (grados, 0 = derecha, 90 = abajo). */
export interface ShootingStar {
  id: string;
  x: number;
  y: number;
  angle: number;
  /** Largo del recorrido (unidades del cielo). */
  length: number;
  /** Hora del servidor en que aparece. */
  at: number;
  flightMs: number;
}

/** Sortea la estrella: arranca arriba y baja en diagonal (a veces a la izquierda, a veces a la derecha). */
export function rollStar(id: string, at: number, random: (n: number) => number, flightMs: number = SKY.starFlightMs): ShootingStar {
  const leftward = random(2) === 1;
  return {
    id,
    x: 120 + random(760),
    y: 40 + random(220),
    angle: leftward ? 150 - random(35) : 30 + random(35),
    length: 180 + random(160),
    at,
    flightMs,
  };
}

/** Servidor → quien mira por el telescopio. */
export type SkyEvent =
  /** Respuesta a mirar: si es de noche y la estrella que va pasando (si hay). */
  | { kind: "sky"; night: boolean; star: ShootingStar | null }
  | { kind: "star"; star: ShootingStar }
  /** Alguien dijo "¡la vi!" a tiempo: `first` si fue el primero (se lleva el logro). */
  | { kind: "spotted"; starId: string; name: string; first: boolean; mine: boolean }
  | { kind: "missed"; starId: string };

export const StarSpotMessage = z.object({ starId: z.string().min(1).max(40) });

export interface Constellation {
  id: string;
  name: string;
  /** Una línea con la historia (inventada por el equipo). */
  story: string;
  /** Estrellas [x, y, brillo 1..3] en coordenadas del cielo. */
  stars: [number, number, number][];
  /** Líneas entre estrellas (índices). */
  lines: [number, number][];
}

/** Las constelaciones del cielo de la cabaña: nombres y dibujos inventados por el equipo. */
export const CONSTELLATIONS: readonly Constellation[] = [
  {
    id: "tetera",
    name: "La Tetera",
    story: "Siempre está a punto de hervir. Nadie la ha visto servir.",
    stars: [
      [120, 150, 2],
      [175, 130, 3],
      [230, 150, 2],
      [240, 205, 2],
      [180, 225, 3],
      [115, 205, 1],
      [270, 170, 1],
      [85, 170, 1],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
      [2, 6],
      [0, 7],
    ],
  },
  {
    id: "hacha",
    name: "El Hacha del Leñador",
    story: "Cortó la primera leña de la chimenea y se quedó colgada del cielo.",
    stars: [
      [380, 90, 3],
      [420, 140, 2],
      [460, 190, 2],
      [500, 240, 1],
      [355, 60, 2],
      [410, 75, 2],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [4, 0],
      [0, 5],
      [5, 4],
    ],
  },
  {
    id: "hamaca",
    name: "La Hamaca",
    story: "Colgada entre dos estrellas, para la siesta de después del almuerzo.",
    stars: [
      [600, 110, 3],
      [640, 150, 1],
      [690, 165, 2],
      [740, 150, 1],
      [780, 105, 3],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
  {
    id: "tinto",
    name: "El Tinto",
    story: "La taza humeante que mira a la cafetería. Sale a las siete en punto.",
    stars: [
      [830, 250, 2],
      [900, 250, 2],
      [890, 310, 3],
      [840, 310, 1],
      [925, 270, 1],
      [850, 205, 1],
      [870, 185, 1],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [1, 4],
      [5, 6],
    ],
  },
  {
    id: "gato",
    name: "El Gato Dormido",
    story: "Ronronea tan bajito que solo se oye con el radar.",
    stars: [
      [270, 330, 2],
      [320, 300, 1],
      [370, 320, 2],
      [390, 360, 3],
      [340, 385, 1],
      [290, 370, 1],
      [255, 300, 1],
      [240, 325, 1],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
      [0, 6],
      [6, 7],
      [7, 0],
    ],
  },
  {
    id: "remo",
    name: "El Remo",
    story: "Se le cayó al bote del muelle una noche de pesca y siguió flotando para arriba.",
    stars: [
      [560, 300, 1],
      [600, 330, 2],
      [640, 360, 2],
      [690, 395, 3],
      [715, 380, 1],
      [705, 420, 1],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [3, 5],
    ],
  },
];

/** Estrellas sueltas del fondo (siempre las mismas: todos ven el mismo cielo). */
export function backgroundStars(n = 140): [number, number, number][] {
  const out: [number, number, number][] = [];
  let s = 7;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < n; i++) out.push([Math.floor(rnd() * SKY.width), Math.floor(rnd() * (SKY.height - 60)), rnd() < 0.12 ? 2 : 1]);
  return out;
}

// ---------- Radar de señales ----------

export type SignalKind = "radio" | "club" | "piano" | "persona";

/** Algo que suena, en tiles del jardín (lo de adentro de la casa se proyecta sobre su dibujo). */
export interface SignalSource {
  id: string;
  label: string;
  kind: SignalKind;
  x: number;
  y: number;
  /** Qué tan fuerte suena en su lugar (0 a 1). */
  loudness: number;
}

/** Alguien tocó un instrumento (el piano, la guitarra): el radar lo oye un rato. */
export interface SignalPing {
  area: string;
  type: string;
  x: number;
  y: number;
}

export const RADAR = {
  /** Cuánto se oye un instrumento después de tocarlo (ms). */
  pingMs: 8_000,
  /** Qué tan ancho "oye" el radar: a esta distancia angular (grados) la señal baja a ~37 %. */
  beamDeg: 28,
  /** A esta distancia (tiles) la señal llega a la mitad. */
  halfTiles: 30,
  /** Por debajo de esto no se muestra ni suena. */
  floor: 0.04,
} as const;

/**
 * Dirección de `to` vista desde `from` en la pantalla (grados, 0 = derecha, 90 = abajo): el mundo es
 * isométrico, así que se proyecta igual que el dibujo y el dial del radar coincide con lo que se ve.
 */
export function screenBearing(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const sx = dx - dy;
  const sy = (dx + dy) / 2;
  return ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
}

/** Diferencia entre dos ángulos (0 a 180). */
export const angleGap = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
};

export interface Signal {
  source: SignalSource;
  /** Lo que se oye apuntando a `aim` (0 a 1). */
  strength: number;
  bearing: number;
  dist: number;
}

/** Lo que capta el radar en (origin) apuntando a `aim` grados, de lo más fuerte a lo más débil. */
export function radarSignals(origin: { x: number; y: number }, aim: number, sources: readonly SignalSource[]): Signal[] {
  const out: Signal[] = [];
  for (const source of sources) {
    const dist = Math.hypot(source.x - origin.x, source.y - origin.y);
    const bearing = dist < 0.5 ? aim : screenBearing(origin, source);
    const beam = Math.exp(-((angleGap(aim, bearing) / RADAR.beamDeg) ** 2));
    const fall = 1 / (1 + dist / RADAR.halfTiles);
    const strength = Math.min(1, source.loudness * beam * fall * 1.6);
    if (strength >= RADAR.floor) out.push({ source, strength, bearing, dist });
  }
  return out.sort((a, b) => b.strength - a.strength);
}

// ---------- Diario de exploración ----------

/** Niveles para el diario (el test del mapa revisa que estén todos los del mundo). */
export const LOG_AREAS: readonly { id: string; name: string; note: string }[] = [
  { id: "jardin", name: "El jardín", note: "Donde empieza todo: el portón, el lago y la fogata." },
  { id: "planta-baja", name: "La planta baja", note: "Olor a tinto recién hecho y la tienda de muebles." },
  { id: "piso-2", name: "El piso 2", note: "Las oficinas, la sala de reuniones y las cabinas." },
  { id: "piso-3", name: "El piso 3", note: "La biblioteca y la terraza con vista al lago." },
  { id: "sotano", name: "El sótano", note: "Casino, club, cine y arcade. Mejor no contarle a nadie." },
  { id: "garaje", name: "El garaje", note: "Llantas, herramientas y un carro tapado que nadie destapa." },
  { id: "casa-arbol", name: "La casa del árbol", note: "Tres cojines, una escalera de cuerda y silencio para concentrarse." },
  { id: "megabus", name: "El Megabús", note: "Verde lima, vidrios oscuros y un fuelle que se dobla en las curvas." },
  { id: "podcast", name: "El estudio de grabación", note: "Ocho micrófonos, una mesa larga y el cartel de EN EL AIRE." },
  { id: "observatorio", name: "El observatorio", note: "Una torre de piedra que mira al cielo desde la lomita." },
  // Todas las casas cuentan como una (ver CASA_PROPIA.statArea en casa-propia.ts).
  { id: "casa-propia", name: "Tu casa", note: "Una casona de finca con su patio, su barra y una cama que espera." },
];

export interface LogEntry {
  id: string;
  title: string;
  /** Lo que se anota al descubrirlo. */
  note: string;
  /** Pista para lo que falta. */
  hint: string;
  found: boolean;
  /** Logro que va con este descubrimiento (si hay). */
  achievementId?: string;
  group: "lugares" | "cielo" | "fogata" | "lago";
}

/** Las páginas del diario a partir de los contadores del perfil (los de todas las ramas). */
export function explorationLog(stats: Readonly<Record<string, number>>): LogEntry[] {
  const has = (k: string, min = 1) => (stats[k] ?? 0) >= min;
  const places: LogEntry[] = LOG_AREAS.map((a) => ({
    id: `lugar-${a.id}`,
    title: a.name,
    note: a.note,
    hint: "Todavía no has pasado por aquí.",
    found: has(`${STAT_PREFIX.visit}${a.id}`),
    achievementId: "turista",
    group: "lugares",
  }));
  return [
    ...places,
    {
      id: "cielo-telescopio",
      title: "Mirar las constelaciones",
      note: "La Tetera, el Hacha del Leñador, la Hamaca… el cielo de la cabaña tiene nombre.",
      hint: "El telescopio del observatorio solo sirve de noche.",
      found: has(STAT_KEYS.stargazing),
      achievementId: "astronomo-de-patio",
      group: "cielo",
    },
    {
      id: "cielo-fugaz",
      title: "Una estrella fugaz",
      note: "Cruzó el cielo en un parpadeo. Alcanzaste a verla.",
      hint: "Hay que tener paciencia frente al telescopio.",
      found: has(STAT_KEYS.shootingStars),
      achievementId: "cazaestrellas",
      group: "cielo",
    },
    {
      id: "cielo-deseo",
      title: "El primer deseo",
      note: "La viste antes que nadie: el deseo es tuyo.",
      hint: "Sé el primero en ver pasar una estrella fugaz.",
      found: has(STAT_KEYS.shootingStarsFirst),
      achievementId: "pide-un-deseo",
      group: "cielo",
    },
    {
      id: "fogata-dorado",
      title: "El malvavisco perfecto",
      note: "Dorado por fuera, derretido por dentro.",
      hint: "En la fogata del observatorio: sácalo justo a tiempo.",
      found: has(STAT_KEYS.goldenMarshmallows),
      achievementId: "punto-exacto",
      group: "fogata",
    },
    {
      id: "fogata-quemado",
      title: "Una antorcha",
      note: "Nadie te juzga. Bueno, un poquito.",
      hint: "¿Qué pasa si lo dejas demasiado?",
      found: has(STAT_KEYS.burntMarshmallows),
      achievementId: "antorcha-humana",
      group: "fogata",
    },
    {
      id: "lago-raro",
      title: "Algo raro en el lago",
      note: "Un pez que casi nadie ha visto. Ahora tú sí.",
      hint: "Dicen que en el lago hay peces de leyenda.",
      found: has(STAT_KEYS.legendaryFish) || has(STAT_KEYS.mythicFish),
      achievementId: "pescador-legendario",
      group: "lago",
    },
    {
      id: "lago-tesoro",
      title: "Un cofre en el fondo",
      note: "Alguien lo tiró al lago hace mucho. Adentro, más lago.",
      hint: "A veces el anzuelo trae algo que no es un pez.",
      found: has(STAT_KEYS.fishTreasures),
      achievementId: "cazatesoros",
      group: "lago",
    },
  ];
}
