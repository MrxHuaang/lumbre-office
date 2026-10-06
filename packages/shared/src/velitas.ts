// La Noche de velitas (día 7 del invierno del juego, VIR-158): entre todos se prenden velitas en el
// jardín (cada quien las suyas, con un tope por persona y uno total, y metas del equipo con su cinemática)
// y desde el muelle del lago se suelta un farol de deseos con un deseo corto (uno por persona). A las 21:00
// del juego, la suelta de faroles: todos los deseos de la noche suben juntos. Aquí solo los datos y las
// reglas puras; dónde se puede poner una velita lo dice `velitaBlock` de @hyvento/map, y lo decide la
// sala (apps/server/src/rooms/velitas.ts).
import { z } from "zod";
import type { BagObject } from "./bolsa";
import type { CineDef } from "./cinematicas";

/** Ids de los objetos de la mochila (dibujos en packages/map/src/art/items.ts). */
export const VELITA = "velita";
export const FAROL_DESEOS = "farol-deseos";
export const VELITA_ITEM = `obj:${VELITA}`;
export const FAROL_ITEM = `obj:${FAROL_DESEOS}`;

export const VELITAS = {
  /** Solo se prenden en el jardín. */
  area: "jardin",
  /** Las que el festival le deja a cada quien en la mochila (completa hasta este número). */
  regalo: 20,
  /** Las que una persona puede tener prendidas a la vez. */
  porPersona: 20,
  /** Las que caben en el jardín entre todos. */
  total: 300,
  /** Metas del equipo: al llegar a cada una sale una cinemática corta para todos. */
  metas: [50, 100, 200],
  /** Hasta dónde se alcanza a poner una (tiles, de los pies al centro del tile). */
  reachTiles: 1.8,
  /** Pausa mínima entre dos velitas de la misma persona. */
  pausaMs: 200,
  /** Largo máximo del deseo (letras). */
  deseoMax: 80,
  /** Hasta dónde llega "el muelle" para soltar el farol (tiles desde la punta, sobre las tablas). */
  muelleTiles: 10,
} as const;

/** Lo que el festival deja en la mochila: se gastan al ponerlas o al soltarlo. */
export const VELITAS_BAG_OBJECTS: Record<string, BagObject> = {
  [VELITA]: {
    name: "Velita",
    blurb: "Una velita en su vasito de papel de color. En la Noche de velitas, E (o un clic cerca) la prende en el jardín.",
    kind: "objeto",
    max: 40,
  },
  [FAROL_DESEOS]: {
    name: "Farol de deseos",
    blurb: "Un farolito de papel de seda. En la Noche de velitas, llévalo en la mano al muelle del lago y suelta tu deseo.",
    kind: "objeto",
    max: 3,
  },
};

// ---------- Mensajes ----------

export const VELITAS_MSG = {
  /** Cliente → servidor: prender una velita en un tile del jardín (`VelitaPlace`). */
  place: "velitas:place",
  /** Cliente → servidor: soltar el farol con un deseo (`DeseoMessage`). */
  wish: "velitas:wish",
  /** Servidor → quien lo pidió: por qué no (o lo que le regalaron), `VelitasNotice`. */
  notice: "velitas:notice",
  /** Servidor → todos: alguien soltó su farol (la animación), `FarolEvent`. */
  farol: "velitas:farol",
} as const;

export const VelitaPlace = z.object({ x: z.number().int().min(0).max(4096), y: z.number().int().min(0).max(4096) });
export type VelitaPlace = z.infer<typeof VelitaPlace>;

/** El deseo viaja sin limpiar (lo limpia y lo revisa `cleanDeseo`): el tope aquí es solo de tamaño. */
export const DeseoMessage = z.object({ text: z.string().max(VELITAS.deseoMax * 4) });
export type DeseoMessage = z.infer<typeof DeseoMessage>;

export interface FarolEvent {
  sessionId: string;
  name: string;
  text: string;
  /** Desde dónde sube (px de mundo del jardín). */
  x: number;
  y: number;
}

export type VelitasNoticeCode =
  | "cerrado"
  | "lejos"
  | "ocupado"
  | "bloqueado"
  | "tope"
  | "lleno"
  | "sinVelitas"
  | "llena"
  | "regalo"
  | "muelle"
  | "sinFarol"
  | "yaDeseo"
  | "vacio"
  | "largo"
  | "enlace"
  | "soltado";

export interface VelitasNotice {
  code: VelitasNoticeCode;
  /** Las velitas regaladas (con `regalo`) y si venía el farol. */
  n?: number;
  farol?: boolean;
}

export function velitasNoticeText(n: VelitasNotice): string {
  switch (n.code) {
    case "cerrado":
      return "Las velitas se prenden en la Noche de velitas, de 9:00 a 22:00.";
    case "lejos":
      return "Las velitas van en el jardín, cerquita de ti.";
    case "ocupado":
      return "Ahí ya hay una velita prendida.";
    case "bloqueado":
      return "Ahí no: que no quede encima de un mueble, una puerta o donde se usa algo.";
    case "tope":
      return `Ya prendiste tus ${VELITAS.porPersona} velitas. ¡Gracias!`;
    case "lleno":
      return "El jardín ya no tiene espacio para más velitas.";
    case "sinVelitas":
      return "No te quedan velitas en la mochila.";
    case "llena":
      return "Tu mochila está llena: haz espacio para las velitas del festival.";
    case "regalo": {
      const v = n.n ? `${n.n} velitas` : "";
      const what = v && n.farol ? `${v} y un farol de deseos` : v || "un farol de deseos";
      return `Doña Gloria te dejó ${what} en la mochila. ¡Feliz Noche de velitas!`;
    }
    case "muelle":
      return "El farol de deseos se suelta desde el muelle del lago.";
    case "sinFarol":
      return "Lleva el farol de deseos en la mano.";
    case "yaDeseo":
      return "Ya soltaste tu farol esta noche.";
    case "vacio":
      return "Escribe un deseo cortito.";
    case "largo":
      return `El deseo es de ${VELITAS.deseoMax} letras como mucho.`;
    case "enlace":
      return "Nada de enlaces en el deseo: solo palabras.";
    case "soltado":
      return "Tu farol va subiendo con el deseo.";
  }
}

// ---------- El deseo ----------

/** Un enlace o algo que lo parece (un dominio suelto): en el deseo no van. */
const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|co|net|org|io|app|dev|me|ly|gg|tv|xyz|info|biz|link|site|online|store|shop|es|us)\b)/i;

export type DeseoCheck = { ok: true; text: string } | { ok: false; error: "vacio" | "largo" | "enlace" };

/**
 * El deseo como se suelta: en un renglón, sin caracteres de control ni espacios de sobra, hasta
 * `VELITAS.deseoMax` letras y sin enlaces (se ve encima del farol para todos).
 */
export function cleanDeseo(raw: string): DeseoCheck {
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, error: "vacio" };
  if ([...text].length > VELITAS.deseoMax) return { ok: false, error: "largo" };
  if (LINK_RE.test(text)) return { ok: false, error: "enlace" };
  return { ok: true, text };
}

// ---------- El equipo ----------

/** La meta que se acaba de alcanzar al llegar a `lit` velitas (o null). */
export function metaAlcanzada(lit: number): number | null {
  return (VELITAS.metas as readonly number[]).includes(lit) ? lit : null;
}

/** El texto del contador del equipo ("velitas prendidas: N"). */
export const velitasTexto = (n: number) => `${n} ${n === 1 ? "velita prendida" : "velitas prendidas"}`;

// ---------- Las cinemáticas ----------

/** Ids de las cinemáticas de la noche (se suman al catálogo con las del festival). */
export const VELITAS_CINE = {
  meta: (n: number) => `festival-velitas-meta-${n}`,
  /** La suelta de faroles (el momento del festival a las 21:00, ver `momentos` en festivales.ts). */
  faroles: "festival-velitas-faroles",
} as const;

/** Minuto del día del juego de la suelta de faroles: una hora antes del cierre, ya de noche. */
export const SUELTA_MINUTO = 21 * 60;

const META_LINES: Record<number, readonly [string, string]> = {
  50: ["¡Cincuenta velitas! El jardín ya parece un pesebre.", "Sigan, que todavía hay oscuridad por alumbrar."],
  100: ["¡Cien velitas prendidas! Desde el observatorio se ve el jardín brillando.", "Con tanta lucecita, hasta las estrellas se pusieron celosas."],
  200: ["¡Doscientas velitas! Nunca había visto la cabaña tan iluminada.", "Esta es la Noche de velitas más bonita que ha tenido esta casa."],
};

export const VELITAS_CINEMATICAS: readonly CineDef[] = [
  ...VELITAS.metas.map(
    (n): CineDef => ({
      id: VELITAS_CINE.meta(n),
      kind: "momento",
      steps: [
        { op: "flash", color: "oro", ms: 350 },
        { op: "sound", sound: "campanada" },
        { op: "fx", fx: "estrellas" },
        { op: "title", text: `¡${n} velitas prendidas!`, sub: "Noche de velitas", ms: 2400 },
        { op: "say", who: "gloria", text: META_LINES[n]![0], ms: 3000 },
        { op: "say", who: "astronoma", text: META_LINES[n]![1], ms: 3000 },
      ],
    }),
  ),
  {
    id: VELITAS_CINE.faroles,
    kind: "momento",
    steps: [
      { op: "sound", sound: "campanadas" },
      { op: "flash", color: "oro", ms: 500 },
      { op: "title", text: "La suelta de faroles", sub: "Todos los deseos de la noche suben juntos", ms: 3200 },
      { op: "fx", fx: "estrellas" },
      { op: "say", who: "astronoma", text: "Miren pa'l lago: todos los faroles van subiendo con sus deseos.", ms: 3600 },
      { op: "say", who: "aurora", text: "Que se cumplan, mijo. Los de todos, hasta los que no se dicen.", ms: 3600 },
    ],
  },
];
