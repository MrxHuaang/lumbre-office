// La tira de conversación (VIR-167): la forma de hablar de la gente de la fiesta, y la que después usarán
// las cinemáticas, los encargos y los festivales nuevos. Una sola en pantalla y una cola (lib/dialogo.ts):
//
//   abrirDialogo({ quien, nombre, rol, retrato, lineas, opciones, voz, modo, alElegir, alCerrar, alcance })
//
// - `lineas`: cada una de 1 a 3 renglones; E, Enter o clic completa la línea y luego pasa a la siguiente.
// - `opciones`: salen al final como etiquetas al borde de la tira; `alElegir(id)` decide (devuelve true
//   para dejarla abierta, por ejemplo mientras el servidor contesta; si no, se cierra).
// - `alcance`: si deja de ser true (uno se alejó), se cierra sola.
// - `modo: "momento"`: avanza sola y se cierra al terminar (sin opciones).
// - `decirEnDialogo(quien, lineas, opciones?)` cambia lo que dice la de ahora (las gracias del pedido).
// La tira la dibuja components/dialogo/TiraDialogo.tsx; el "blip" de cada letra sale de aquí (`blipDeVoz`).
import { create } from "zustand";
import { abrir, avanzar, cerrar, conOpciones, decir, DIALOGO_VACIO, hayMas, mover, tonoDeVoz, type DialogoDef, type DialogoEstado, type DialogoOpcion } from "@/lib/dialogo";
import { sfxOut } from "./sfx";

export interface DialogoPedido extends DialogoDef {
  alElegir?: (id: string) => boolean | void;
  alCerrar?: () => void;
  alcance?: () => boolean;
}

interface DialogoStore extends DialogoEstado {
  /** Lo que no se guarda en el estado puro (funciones), por quien habla. */
  extras: Record<string, Pick<DialogoPedido, "alElegir" | "alCerrar" | "alcance">>;
}

export const useDialogo = create<DialogoStore>(() => ({ ...DIALOGO_VACIO, extras: {} }));

/** Abre una conversación (o la pone en la cola si ya hay otra de otra persona). */
export function abrirDialogo(d: DialogoPedido) {
  const { alElegir, alCerrar, alcance, ...def } = d;
  useDialogo.setState((s) => ({ ...abrir(s, def), extras: { ...s.extras, [d.quien]: { alElegir, alCerrar, alcance } } }));
}

/** Cierra la de ahora (y abre la siguiente de la cola). */
export function cerrarDialogo(quien?: string) {
  const s = useDialogo.getState();
  if (!s.actual || (quien && s.actual.quien !== quien)) return;
  const extra = s.extras[s.actual.quien];
  const { [s.actual.quien]: _, ...rest } = s.extras;
  useDialogo.setState({ ...cerrar(s), extras: rest });
  extra?.alCerrar?.();
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
