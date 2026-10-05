// La entrada a las cinemáticas sin Phaser: lo que importan los módulos que también cargan los componentes
// (game/historia.ts, que usa el cuadro de Doña Aurora) sin arrastrar el motor del juego al render del
// servidor. El reproductor (player.ts, que sí usa Phaser y lo carga la escena) se registra aquí al estar
// lista la escena; antes de eso, lo que se pide no se ve (y se responde la primera opción).
import { cineById, type CineDef, type CineStep } from "@hyvento/shared";
import { usePrefsStore } from "../../lib/prefs";

type Vars = Readonly<Record<string, string | number>>;
type Runner = (def: CineDef, vars: Vars) => Promise<string | null>;

let runner: Runner | null = null;
let ready: (() => void) | null = null;
let readyP = new Promise<void>((r) => (ready = r));

/** Lo llama el reproductor: con la escena lista, o null al cerrarla. */
export function setCineRunner(fn: Runner | null) {
  runner = fn;
  if (fn) ready?.();
  else readyP = new Promise<void>((r) => (ready = r));
}

/** Se resuelve cuando la escena está lista para reproducir (lo que llega del servidor antes la espera). */
export function whenCineReady(): Promise<void> {
  return readyP;
}

/** La primera opción de una cinemática (la que vale si se salta o no se ve), o null si no tiene. */
export function firstChoiceOf(def: CineDef | undefined): string | null {
  const step = def?.steps.find((s): s is Extract<CineStep, { op: "choice" }> => s.op === "choice");
  return step?.options[0]?.id ?? null;
}

/** ¿Se ve esta cinemática con las preferencias de ahora? */
export function cinePrefAllows(def: CineDef): boolean {
  const { cine, workMode } = usePrefsStore.getState();
  if (cine === "ninguna") return false;
  if (def.kind === "momento") return cine === "todas" && !workMode;
  return true;
}

/** ¿Las preferencias dejan ver esa cinemática? (sin mirar si la escena ya está). */
export function cineWanted(id: string): boolean {
  const def = cineById(id);
  return Boolean(def && cinePrefAllows(def));
}

/** Reproduce una cinemática del catálogo; devuelve la opción elegida (o la primera si no se vio). */
export function playCinematic(id: string, vars: Vars = {}): Promise<string | null> {
  return playCineDef(cineById(id), vars);
}

/** Reproduce una cinemática dada (la del catálogo, o una que se está escribiendo, en desarrollo). */
export function playCineDef(def: CineDef | undefined, vars: Vars = {}): Promise<string | null> {
  if (!def || !runner) return Promise.resolve(firstChoiceOf(def));
  return runner(def, vars);
}

// Lo que hace el navegador al elegir una opción con `action` (p. ej. saltar la historia).
const actions = new Map<string, () => void>();
export function onCineAction(action: string, fn: () => void) {
  actions.set(action, fn);
}
export function runCineAction(action: string) {
  actions.get(action)?.();
}
