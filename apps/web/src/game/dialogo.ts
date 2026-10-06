// La tira de conversación (VIR-167, VIR-171): la única forma de hablar de los NPC en todo el juego (la gente
// de la fiesta, las cinemáticas, los encargos y la historia). Una sola en pantalla y una cola (lib/dialogo.ts):
//
//   abrirDialogo({ quien, nombre, rol, retrato, lineas, opciones, voz, modo, alElegir, alCerrar, alcance })
//
// - `lineas`: cada una de 1 a 3 renglones; E, Enter o clic completa la línea y luego pasa a la siguiente.
// - `opciones`: salen al final como etiquetas al borde de la tira; `alElegir(id)` decide (devuelve true
//   para dejarla abierta, por ejemplo mientras el servidor contesta; si no, se cierra).
// - `alcance`: si deja de ser true (uno se alejó), se cierra sola.
// - `modo: "momento"`: avanza sola y se cierra al terminar (sin opciones).
// - `decirEnDialogo(quien, lineas, opciones?)` cambia lo que dice la de ahora (las gracias del pedido).
// - `narrador`, `icono`, `escrita`, `ms` y `prioridad`: ver `DialogoDef` (las cinemáticas los usan); `alEscapar`
//   cambia lo que hace Esc (en una cinemática, saltarla).
// La tira la dibuja components/dialogo/TiraDialogo.tsx; el "blip" de cada letra sale de aquí (`blipDeVoz`).
// El retrato de un NPC fijo lo da `retratoDe(id)` (lo pinta la escena, que se registra con `registrarRetratista`).
import { create } from "zustand";
import { abrir, avanzar, cerrar, conOpciones, decir, DIALOGO_VACIO, hayMas, mover, retener, tonoDeVoz, vaciar, type DialogoDef, type DialogoEstado, type DialogoOpcion } from "../lib/dialogo";
import { sfxOut } from "./sfx";

export interface DialogoPedido extends DialogoDef {
  alElegir?: (id: string) => boolean | void;
  alCerrar?: () => void;
  alcance?: () => boolean;
  /** Lo que hace Esc (sin esto, cierra la tira). */
  alEscapar?: () => void;
}

type Extras = Pick<DialogoPedido, "alElegir" | "alCerrar" | "alcance" | "alEscapar">;

interface DialogoStore extends DialogoEstado {
  /** Lo que no se guarda en el estado puro (funciones), por quien habla. */
  extras: Record<string, Extras>;
}

export const useDialogo = create<DialogoStore>(() => ({ ...DIALOGO_VACIO, extras: {} }));

/** Abre una conversación (o la pone en la cola si ya hay otra de otra persona). */
export function abrirDialogo(d: DialogoPedido) {
  const { alElegir, alCerrar, alcance, alEscapar, ...def } = d;
  useDialogo.setState((s) => ({ ...abrir(s, def), extras: { ...s.extras, [d.quien]: { alElegir, alCerrar, alcance, alEscapar } } }));
}

/**
 * Cierra la de ahora (y abre la siguiente de la cola). Con `quien`, solo si es de él; si la suya está en la
 * cola, la saca de ahí (sin avisarle: la quita quien la puso).
 */
export function cerrarDialogo(quien?: string) {
  const s = useDialogo.getState();
  if (quien && s.actual?.quien !== quien) {
    if (!s.cola.some((c) => c.quien === quien)) return;
    const { [quien]: _, ...rest } = s.extras;
    useDialogo.setState({ cola: s.cola.filter((c) => c.quien !== quien), extras: rest });
    return;
  }
  if (!s.actual) return;
  const extra = s.extras[s.actual.quien];
  const next = cerrar(s);
  // Si la que sigue es otra vez la misma (volvió de la cola), sus funciones se quedan.
  const { [s.actual.quien]: _, ...rest } = s.extras;
  useDialogo.setState({ ...next, extras: s.cola.some((c) => c.quien === s.actual!.quien) ? s.extras : rest });
  extra?.alCerrar?.();
}

/** Esc: lo que pidió quien habla (en una cinemática, saltarla) o cerrar. */
export function escaparDialogo() {
  const s = useDialogo.getState();
  const fn = s.actual ? s.extras[s.actual.quien]?.alEscapar : undefined;
  if (fn) fn();
  else cerrarDialogo();
}

/** Una cinemática de historia toma la pantalla (o la suelta): mientras tanto, lo que no es de ella espera. */
export function retenerDialogos(on: boolean) {
  useDialogo.setState((s) => retener(s, on));
}

/** Cierra lo que no es de una cinemática (la de ahora y la cola), avisando a cada uno. */
export function vaciarDialogos() {
  const s = useDialogo.getState();
  const { estado, cerradas } = vaciar(s);
  if (!cerradas.length) return;
  const extras = { ...s.extras };
  const avisos = cerradas.map((q) => extras[q]?.alCerrar);
  for (const q of cerradas) delete extras[q];
  useDialogo.setState({ ...estado, extras });
  for (const fn of avisos) fn?.();
}

/** Siguiente línea (o cierra al final, si no hay opciones). */
export function avanzarDialogo() {
  const s = useDialogo.getState();
  if (!s.actual) return;
  if (hayMas(s.actual)) return useDialogo.setState(avanzar(s));
  // En la última: con opciones se elige; sin ellas, se cierra (con su `alCerrar`).
  if (!conOpciones(s.actual)) cerrarDialogo();
}

/** Marca otra opción (flechas). */
export function moverOpcion(delta: number) {
  useDialogo.setState((s) => mover(s, delta));
}

/** Elige una opción: lo decide quien abrió la conversación. */
export function elegirOpcion(id?: string) {
  const s = useDialogo.getState();
  const d = s.actual;
  if (!d?.opciones?.length) return;
  const opcion = id ?? d.opciones[d.elegida]?.id;
  if (!opcion) return;
  const keep = s.extras[d.quien]?.alElegir?.(opcion);
  if (!keep) cerrarDialogo(d.quien);
}

/** Cambia lo que dice quien habla ahora (sin cerrar la tira). */
export function decirEnDialogo(quien: string, lineas: string[], opciones?: DialogoOpcion[]) {
  useDialogo.setState((s) => decir(s, quien, lineas, opciones));
}

/** ¿Hay una conversación abierta? (los murmullos de alrededor se esconden mientras tanto). */
export const dialogoAbierto = () => useDialogo.getState().actual !== null;

// ---------- Retratos de los NPC fijos ----------

let retratista: ((npcId: string) => string | null) | null = null;

/** Lo llama la escena (con Phaser): sabe pintar la cabeza de un NPC fijo desde su hoja. */
export function registrarRetratista(fn: ((npcId: string) => string | null) | null) {
  retratista = fn;
}

/** El retrato de un NPC fijo (data URL), o null si la escena todavía no está. */
export const retratoDe = (npcId: string): string | null => retratista?.(npcId) ?? null;

/** Revisa si quien habla sigue al alcance (la tira lo llama cada tanto). */
export function revisarAlcance() {
  const s = useDialogo.getState();
  const d = s.actual;
  if (d && s.extras[d.quien]?.alcance && !s.extras[d.quien]!.alcance!()) cerrarDialogo(d.quien);
}

/** El "blip" de una letra: un tic cortito con el tono de la voz de cada uno. */
export function blipDeVoz(voz?: number) {
  const a = sfxOut();
  if (!a) return;
  const { ctx } = a;
  const t = ctx.currentTime + 0.005;
  const f = tonoDeVoz(voz) * (0.94 + Math.random() * 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.09, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  g.connect(a.out);
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(f, t);
  osc.frequency.exponentialRampToValueAtTime(f * 0.82, t + 0.05);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2200;
  osc.connect(filter).connect(g);
  osc.start(t);
  osc.stop(t + 0.06);
}
