// La tira de conversación (VIR-167, VIR-171), lo puro: una sola conversación a la vez y una cola, línea por
// línea, y al final las opciones. Lo usan la tira (components/dialogo/TiraDialogo.tsx) y su store
// (game/dialogo.ts). Las cinemáticas hablan por aquí con `prioridad` (la que estaba abierta vuelve a la cola,
// adelante) y, mientras una de historia toma la pantalla, la tira queda `retenida`: lo que no es de la
// cinemática espera en la cola hasta que termine. También el tono de la voz y cuándo suena el "blip".

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
  /** En el modo `momento`, cuánto se queda cada línea (ms); sin esto, lo que tarda en leerse. */
  ms?: number;
  /** El narrador: sin medallón, sin nombre y sin blip, en cursiva. */
  narrador?: boolean;
  /** Sin retrato, el dibujito del medallón (un nombre de `PixelIcon`; por defecto, el globito). */
  icono?: string;
  /** La primera línea sale ya escrita (lo que se acaba de decir, repetido como pregunta de las opciones). */
  escrita?: boolean;
  /** De una cinemática: pasa delante de la que estaba abierta (que vuelve a la cola, adelante). */
  prioridad?: boolean;
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
  /** Una cinemática de historia toma la pantalla: solo se abre lo que trae `prioridad`; lo demás espera. */
  retenida?: boolean;
}

export const DIALOGO_VACIO: DialogoEstado = { actual: null, cola: [] };

let keys = 0;
const abrirYa = (d: DialogoDef): DialogoAbierto => ({ ...d, lineas: d.lineas.length ? d.lineas : [""], linea: 0, elegida: 0, key: ++keys });

/** Lo abierto, otra vez como pedido (para devolverlo a la cola: vuelve desde su primera línea). */
const comoPedido = ({ linea: _l, elegida: _e, key: _k, ...d }: DialogoAbierto): DialogoDef => d;

/**
 * Abre una conversación: si no hay otra, ya; si es de quien ya habla, la reemplaza; si no, a la cola. Con
 * `prioridad` (una cinemática) pasa delante de la de ahora, que vuelve a la cola adelante. Con la tira
 * retenida, lo que no trae `prioridad` espera en la cola.
 */
export function abrir(e: DialogoEstado, d: DialogoDef): DialogoEstado {
  const cola = e.cola.filter((c) => c.quien !== d.quien);
  if (e.retenida && !d.prioridad && e.actual?.quien !== d.quien) return { ...e, cola: [...cola, d] };
  if (!e.actual || e.actual.quien === d.quien) return { ...e, actual: abrirYa(d), cola };
  if (d.prioridad && !e.actual.prioridad) return { ...e, actual: abrirYa(d), cola: [comoPedido(e.actual), ...cola] };
  // Otra cinemática hablando: va primera en la cola.
  if (d.prioridad) return { ...e, cola: [d, ...cola] };
  return { ...e, cola: [...cola, d] };
}

/** La siguiente de la cola que se puede abrir ya (con la tira retenida, solo una con `prioridad`). */
function siguiente(cola: DialogoDef[], retenida: boolean | undefined): { actual: DialogoAbierto | null; cola: DialogoDef[] } {
  const i = cola.findIndex((c) => !retenida || c.prioridad);
  if (i < 0) return { actual: null, cola };
  return { actual: abrirYa(cola[i]!), cola: cola.filter((_, j) => j !== i) };
}

/** Cierra la de ahora y abre la siguiente de la cola (si hay y se puede). */
export function cerrar(e: DialogoEstado): DialogoEstado {
  return { ...e, ...siguiente(e.cola, e.retenida) };
}

/** Retiene la tira (empieza una cinemática de historia) o la suelta (al soltarla, sale lo que esperaba). */
export function retener(e: DialogoEstado, on: boolean): DialogoEstado {
  if (Boolean(e.retenida) === on) return e;
  if (on || e.actual) return { ...e, retenida: on };
  return { ...siguiente(e.cola, false), retenida: false };
}

/** Quita de la tira lo que no es de una cinemática (la de ahora y la cola): lo que se cierra, para avisarle. */
export function vaciar(e: DialogoEstado): { estado: DialogoEstado; cerradas: string[] } {
  const quedan = e.cola.filter((c) => c.prioridad);
  const cerradas = [...(e.actual && !e.actual.prioridad ? [e.actual.quien] : []), ...e.cola.filter((c) => !c.prioridad).map((c) => c.quien)];
  if (e.actual?.prioridad) return { estado: { ...e, cola: quedan }, cerradas };
  return { estado: { ...e, ...siguiente(quedan, e.retenida) }, cerradas };
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

/**
 * Cuánto se queda la línea de ahora en el modo `momento`: la que pidió quien habla (pero nunca menos de lo
 * que tarda en escribirse, más un respiro) o lo que tarda en leerse.
 */
export const msDeLinea = (d: Pick<DialogoDef, "ms">, linea: string, cps: number) =>
  d.ms === undefined ? msMomento(linea, cps) : Math.max(d.ms, Math.round((linea.length / cps) * 1000) + 500);
