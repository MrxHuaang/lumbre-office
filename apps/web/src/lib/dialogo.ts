// La tira de conversación (VIR-167), lo puro: una sola conversación a la vez y una cola, línea por línea, y
// al final las opciones. Lo usan la tira (components/dialogo/TiraDialogo.tsx) y su store (game/dialogo.ts).
// También el tono de la voz de cada personaje y cuándo suena el "blip" de cada letra.

export interface DialogoOpcion {
  id: string;
  label: string;
}

export interface DialogoDef {
  /** Quién habla (un id: para no abrir dos veces lo mismo y cerrarlo si uno se aleja). */
  quien: string;
  nombre: string;
  /** Lo que es (sale chiquito junto al nombre). */
  rol?: string;
  /** El retrato (data URL) o null. */
  retrato?: string | null;
  /** De 1 a 3 líneas de texto cada una. */
  lineas: string[];
  /** Salen al terminar las líneas, como etiquetas al borde de la tira. */
  opciones?: DialogoOpcion[];
  /** Tono de la voz (0 grave .. 1 agudo). */
  voz?: number;
  /** `momento`: avanza sola y se cierra al terminar (para las cinemáticas cortas). */
  modo?: "charla" | "momento";
}

export interface DialogoAbierto extends DialogoDef {
  /** La línea que se ve. */
  linea: number;
  /** La opción marcada. */
  elegida: number;
  /** Cambia con cada línea nueva (reinicia el texto que se escribe). */
  key: number;
}

export interface DialogoEstado {
  actual: DialogoAbierto | null;
  cola: DialogoDef[];
}

export const DIALOGO_VACIO: DialogoEstado = { actual: null, cola: [] };

let keys = 0;
const abrirYa = (d: DialogoDef): DialogoAbierto => ({ ...d, lineas: d.lineas.length ? d.lineas : [""], linea: 0, elegida: 0, key: ++keys });

/** Abre una conversación: si no hay otra, ya; si es de quien ya habla, la reemplaza; si no, a la cola. */
export function abrir(e: DialogoEstado, d: DialogoDef): DialogoEstado {
  if (!e.actual || e.actual.quien === d.quien) return { ...e, actual: abrirYa(d) };
  return { ...e, cola: [...e.cola.filter((c) => c.quien !== d.quien), d] };
}

/** Cierra la de ahora y abre la siguiente de la cola (si hay). */
export function cerrar(e: DialogoEstado): DialogoEstado {
  const [next, ...rest] = e.cola;
  return { actual: next ? abrirYa(next) : null, cola: rest };
}

/** ¿Quedan líneas después de la de ahora? */
export const hayMas = (d: DialogoAbierto) => d.linea < d.lineas.length - 1;

/** ¿Se ven las opciones? (en la última línea, si tiene). */
export const conOpciones = (d: DialogoAbierto) => !hayMas(d) && Boolean(d.opciones?.length);

/** Pasa a la siguiente línea; en la última (sin opciones) se cierra. Con opciones no avanza: se elige. */
export function avanzar(e: DialogoEstado): DialogoEstado {
  const d = e.actual;
  if (!d) return e;
  if (hayMas(d)) return { ...e, actual: { ...d, linea: d.linea + 1, key: ++keys } };
  if (conOpciones(d)) return e;
  return cerrar(e);
}

/** Mueve la opción marcada (con vuelta). */
export function mover(e: DialogoEstado, delta: number): DialogoEstado {
  const d = e.actual;
  const n = d?.opciones?.length ?? 0;
  if (!d || !n) return e;
  return { ...e, actual: { ...d, elegida: (((d.elegida + delta) % n) + n) % n } };
}

/** Cambia lo que dice quien habla (las gracias después de entregar), sin cerrar. */
export function decir(e: DialogoEstado, quien: string, lineas: string[], opciones?: DialogoOpcion[]): DialogoEstado {
  if (e.actual?.quien !== quien) return e;
  return { ...e, actual: { ...e.actual, lineas: lineas.length ? lineas : [""], opciones, linea: 0, elegida: 0, key: ++keys } };
}

/** El tono de la voz en Hz (de grave a agudo). */
export const tonoDeVoz = (voz = 0.5) => 170 + Math.max(0, Math.min(1, voz)) * 520;

/** ¿Suena el blip en esta letra? Una de cada dos letras, sin espacios ni signos. */
export const blipEn = (i: number, ch: string) => i % 2 === 0 && /[\p{L}\p{N}]/u.test(ch);

/** Cuánto se queda una línea en el modo `momento` (ms): lo que tarda en escribirse más un rato para leerla. */
export const msMomento = (linea: string, cps: number) => Math.round((linea.length / cps) * 1000 + 1600);
