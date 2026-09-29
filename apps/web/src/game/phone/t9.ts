// Escritura multi-toque del celular (la "T9" de antes): cada tecla trae varias letras y se aprieta
// varias veces para llegar a la que se quiere. La letra queda "a prueba" hasta que pasa un segundo o
// se aprieta otra tecla. Es lógica pura (sin DOM) para poder probarla.

/** Letras de cada tecla, en el orden en que aparecen (las del español al final, antes del número). */
export const T9_KEYS: Record<string, string> = {
  "1": ".,?!¿¡'-@:1",
  "2": "abcá2",
  "3": "defé3",
  "4": "ghií4",
  "5": "jkl5",
  "6": "mnoñó6",
  "7": "pqrs7",
  "8": "tuvúü8",
  "9": "wxyz9",
  "0": " 0",
};

/** Lo que se ve impreso debajo del número en la tecla. */
export const T9_LABELS: Record<string, string> = {
  "1": ".,?!",
  "2": "abc",
  "3": "def",
  "4": "ghi",
  "5": "jkl",
  "6": "mnoñ",
  "7": "pqrs",
  "8": "tuv",
  "9": "wxyz",
  "0": "espacio",
  "*": "Aa",
  "#": "para",
};

/** Cuánto espera una letra "a prueba" antes de quedar escrita (como los celulares de antes). */
export const MULTITAP_MS = 1000;
/** Lo que cabía en un SMS (el contador cuenta de a SMS, como antes). */
export const SMS_MAX = 160;
/** Lo que deja mandar el chat de la cabaña (el mismo tope que valida el servidor). */
export const CHAT_MAX = 500;

/** Abc = mayúscula al empezar una frase; abc/ABC fijos; 123 escribe el número directo. */
export type T9Mode = "Abc" | "abc" | "ABC" | "123";
const MODES: T9Mode[] = ["Abc", "abc", "ABC", "123"];

export interface T9State {
  /** Todo el texto, con la letra a prueba (si hay) al final. */
  text: string;
  mode: T9Mode;
  /** Largo máximo del texto. */
  max: number;
  /** La última letra todavía se puede cambiar apretando la misma tecla. */
  pending: { key: string; index: number; at: number } | null;
}

export const emptyT9 = (text = "", mode: T9Mode = "Abc", max = SMS_MAX): T9State => ({ text: text.slice(0, max), mode, max, pending: null });

/** ¿Toca mayúscula aquí? (modo Abc: al principio o después de un punto, signo de exclamación o pregunta). */
function capitalHere(before: string): boolean {
  return before.trim() === "" || /[.!?¡¿]\s+$/.test(before);
}

function cased(ch: string, mode: T9Mode, before: string): string {
  if (mode === "ABC" || (mode === "Abc" && capitalHere(before))) return ch.toUpperCase();
  return ch;
}

/** Deja escrita la letra a prueba (si pasó el tiempo, o siempre si no se da `now`). */
export function settle(s: T9State, now?: number): T9State {
  if (!s.pending) return s;
  if (now !== undefined && now - s.pending.at < MULTITAP_MS) return s;
  return { ...s, pending: null };
}

/** Una tecla del 0 al 9. */
export function pressKey(s: T9State, key: string, now: number): T9State {
  const letters = T9_KEYS[key];
  if (!letters) return s;
  if (s.mode === "123") return append(settle(s), key);
  const same = s.pending && s.pending.key === key && now - s.pending.at < MULTITAP_MS;
  if (same) {
    const index = (s.pending!.index + 1) % letters.length;
    const base = s.text.slice(0, -1);
    return { ...s, text: base + cased(letters[index]!, s.mode, base), pending: { key, index, at: now } };
  }
  const settled = settle(s);
  if (settled.text.length >= s.max) return settled;
  return { ...settled, text: settled.text + cased(letters[0]!, s.mode, settled.text), pending: { key, index: 0, at: now } };
}

/** Una letra del teclado de verdad (para quien no quiere escribir a lo antiguo). */
export function append(s: T9State, ch: string): T9State {
  const settled = settle(s);
  if (settled.text.length + ch.length > s.max) return settled;
  return { ...settled, text: settled.text + ch };
}

/** La tecla * cambia entre Abc, abc, ABC y 123. */
export function cycleMode(s: T9State): T9State {
  const settled = settle(s);
  return { ...settled, mode: MODES[(MODES.indexOf(s.mode) + 1) % MODES.length]! };
}

/** Borra la última letra (la que estaba a prueba, si hay). */
export function backspace(s: T9State): T9State {
  return { ...s, text: s.text.slice(0, -1), pending: null };
}

/** El contador de arriba, como en los celulares: "letras que quedan en este SMS/cuántos SMS" ("142/1"). */
export function smsCounter(s: T9State): string {
  const n = Math.max(1, Math.ceil(s.text.length / SMS_MAX));
  return `${n * SMS_MAX - s.text.length}/${n}`;
}
