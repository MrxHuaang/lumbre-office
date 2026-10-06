// Los aguinaldos de las Novenas (VIR-159): juegos cortos entre dos personas, como se juegan en diciembre.
// Quien pierde le debe un aguinaldo al otro (unos pocos puntos, motivo GIFT con refId `aguinaldo:…`, con su
// tope diario). Se reta desde el menú de la persona; lo valida todo la sala (apps/server/src/rooms/aguinaldos.ts).
// - "Pajita en boca": durante un rato ninguno de los dos puede escribir en el chat ni hacer emotes; pierde
//   el primero que lo haga.
// - "Sí y no": el servidor hace preguntas por turnos y no se puede contestar ni "sí" ni "no"; quedarse
//   callado también pierde.
import { z } from "zod";

export const AGUINALDO_JUEGOS = ["pajita", "si-no"] as const;
export type AguinaldoJuego = (typeof AGUINALDO_JUEGOS)[number];

export const AGUINALDO_NOMBRE: Record<AguinaldoJuego, string> = {
  pajita: "Pajita en boca",
  "si-no": "Sí y no",
};

export const AGUINALDO = {
  /** Cuánto espera una invitación. */
  inviteMs: 20_000,
  /** Pausa entre dos retos de la misma persona a la misma persona. */
  cooldownMs: 15_000,
  /** Lo que dura la pajita en boca (si nadie habla, empatan). */
  pajitaMs: 60_000,
  /** Tiempo para contestar cada pregunta del sí y no. */
  turnoMs: 20_000,
  /** Preguntas para cada uno en el sí y no (si nadie cae, empatan). */
  rondas: 3,
  /** El aguinaldo: lo que paga quien pierde. */
  puntos: 5,
  /** Tope diario (día de Bogotá) de lo que alguien paga en aguinaldos. */
  topeDiario: 25,
  refPrefix: "aguinaldo:",
  /** Largo máximo de una respuesta. */
  maxRespuesta: 120,
} as const;

export const aguinaldoRefId = (id: string) => `${AGUINALDO.refPrefix}${id}`;

/** ¿Se puede pagar este aguinaldo con lo que ya pagó hoy? */
export const aguinaldoCabe = (pagadoHoy: number, amount: number) => pagadoHoy + amount <= AGUINALDO.topeDiario;

/** Sin tildes, en minúscula (para buscar las palabras prohibidas). */
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Las formas de "sí" y "no" que pierden (también estiradas: "siii", "noooo", "nop", "sip"). */
const SI_NO = /^(s+i+p*|n+o+p*e?|sep+|nel|simon)$/;

/** La palabra prohibida que dijo (sí o no), o null si se salvó. */
export function dijoSiONo(text: string): string | null {
  for (const word of plain(text).split(/[^a-zñ]+/)) {
    if (word && SI_NO.test(word)) return word;
  }
  return null;
}

/** Las preguntas del sí y no: todas invitan a contestar "sí" o "no". */
export const SI_NO_PREGUNTAS: readonly string[] = [
  "¿Te gusta la natilla?",
  "¿Ya pusiste tu figura en el pesebre?",
  "¿Te comiste el último buñuelo?",
  "¿Sabes rezar la novena de memoria?",
  "¿Estás jugando ahora mismo?",
  "¿Te gusta el tinto con azúcar?",
  "¿Has pescado un pez dorado alguna vez?",
  "¿Tienes frío?",
  "¿Ya le diste tu aguinaldo a alguien?",
  "¿Es de noche en la cabaña?",
  "¿Te sabes algún villancico?",
  "¿Te gustan los buñuelos más que la natilla?",
  "¿Vas a perder este juego?",
  "¿Estás seguro de lo que acabas de decir?",
  "¿Conoces a Doña Aurora?",
  "¿Te quedarías a la cena de Navidad?",
  "¿Has ido al sótano de noche?",
  "¿Tu mascota se llama como tú?",
  "¿Te gusta la lluvia?",
  "¿Me estás contestando en serio?",
];

// ---------- Mensajes ----------

export const AGUINALDO_MSG = {
  /** Cliente → servidor: retar a alguien a un juego. */
  reto: "aguinaldo:reto",
  /** Servidor → retado: la invitación. */
  invitacion: "aguinaldo:invitacion",
  /** Cliente → servidor: aceptar o no la invitación. */
  responder: "aguinaldo:responder",
  /** Servidor → los dos: cómo va el juego. */
  juego: "aguinaldo:juego",
  /** Cliente → servidor: contestar la pregunta del sí y no. */
  respuesta: "aguinaldo:respuesta",
  /** Cliente → servidor: rendirse (pierde quien se rinde). */
  rendirse: "aguinaldo:rendirse",
  /** Servidor → los dos: cómo terminó. */
  fin: "aguinaldo:fin",
  /** Servidor → quien lo intentó: por qué no se pudo. */
  problema: "aguinaldo:problema",
} as const;

export const AguinaldoRetoMessage = z.object({ sessionId: z.string().min(1).max(64), juego: z.enum(AGUINALDO_JUEGOS) });
export const AguinaldoResponderMessage = z.object({ id: z.string().min(1).max(64), accept: z.boolean() });
export const AguinaldoRespuestaMessage = z.object({ text: z.string().max(AGUINALDO.maxRespuesta) });

export interface AguinaldoInvitacion {
  id: string;
  juego: AguinaldoJuego;
  fromSessionId: string;
  fromName: string;
  ttlMs: number;
}

/** El juego en curso, como lo ven los dos. */
export interface AguinaldoView {
  id: string;
  juego: AguinaldoJuego;
  a: { sessionId: string; name: string };
  b: { sessionId: string; name: string };
  /** Cuánto le queda al juego (pajita) o al turno (sí y no), en ms desde que salió del servidor. */
  leftMs: number;
  /** Sí y no: a quién le toca, la pregunta y en qué pregunta va (1..rondas*2). */
  turno?: string;
  pregunta?: string;
  numero?: number;
  /** La última respuesta que se salvó (para que el otro la lea). */
  ultima?: { name: string; text: string };
}

export type AguinaldoFinMotivo = "chat" | "emote" | "dijo" | "callado" | "rindio" | "seFue" | "empate";

export interface AguinaldoFin {
  id: string;
  juego: AguinaldoJuego;
  motivo: AguinaldoFinMotivo;
  ganador: { sessionId: string; name: string } | null;
  perdedor: { sessionId: string; name: string } | null;
  /** La palabra que dijo (motivo "dijo"). */
  palabra?: string;
  /** Lo que se pagó de aguinaldo (0: no alcanzó el saldo o el tope del día). */
  pagado: number;
}

export type AguinaldoProblemaCode = "noNovena" | "lejos" | "ocupado" | "pronto" | "dnd" | "unoMismo" | "vencida" | "noQuiso";

export interface AguinaldoProblema {
  code: AguinaldoProblemaCode;
  with?: string;
}

export function aguinaldoProblemaText(p: AguinaldoProblema): string {
  const w = p.with ?? "esa persona";
  switch (p.code) {
    case "noNovena":
      return "Los aguinaldos se juegan en las novenas, del 12 al 20 del invierno.";
    case "lejos":
      return `Acércate a ${w} para retarle.`;
    case "ocupado":
      return `${w === "esa persona" ? "Alguien" : w} ya está en otro juego.`;
    case "pronto":
      return "Espera un momentico antes de volver a retar.";
    case "dnd":
      return `${w} está en "No molestar".`;
    case "unoMismo":
      return "No te puedes retar a ti mismo.";
    case "vencida":
      return "Esa invitación ya no está.";
    case "noQuiso":
      return `${w} no quiso jugar ahora.`;
  }
}

/** El texto de cómo terminó, para quien lo lee (`yo` = mi sessionId). */
export function aguinaldoFinText(f: AguinaldoFin, yo: string): string {
  const juego = AGUINALDO_NOMBRE[f.juego];
  if (!f.ganador || !f.perdedor) return `${juego}: ¡empate! Nadie le debe aguinaldo a nadie.`;
  const gane = f.ganador.sessionId === yo;
  const otro = gane ? f.perdedor.name : f.ganador.name;
  const porque: Record<Exclude<AguinaldoFinMotivo, "empate">, string> = {
    chat: gane ? `${otro} habló en el chat` : "hablaste en el chat",
    emote: gane ? `${otro} hizo un gesto` : "hiciste un gesto",
    dijo: gane ? `${otro} dijo "${f.palabra ?? "sí"}"` : `dijiste "${f.palabra ?? "sí"}"`,
    callado: gane ? `${otro} se quedó callado` : "te quedaste callado",
    rindio: gane ? `${otro} se rindió` : "te rendiste",
    seFue: gane ? `${otro} se fue` : "te fuiste",
  };
  const pago = f.pagado > 0 ? ` (${f.pagado} puntos)` : " (no alcanzó para pagarlo hoy)";
  return gane
    ? `${juego}: ¡ganaste! ${porque[f.motivo as Exclude<AguinaldoFinMotivo, "empate">]}. ${otro} te dio tu aguinaldo${pago}.`
    : `${juego}: perdiste, ${porque[f.motivo as Exclude<AguinaldoFinMotivo, "empate">]}. Le debías un aguinaldo a ${otro}${pago}.`;
}
