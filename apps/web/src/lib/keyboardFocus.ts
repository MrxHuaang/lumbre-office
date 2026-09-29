// ¿A quién le toca una tecla: al juego o al control de la interfaz que tiene el foco? El estado `typing`
// solo lo prenden algunos campos (el chat, las notas); un buscador, un select o un botón con foco no lo
// hacen, y ahí WASD movía al personaje o Enter abría el chat en vez de apretar el botón. Esto mira
// `document.activeElement`. Sin DOM (tests) trabaja con cualquier objeto que se parezca a un elemento.

/** Lo mínimo de un elemento que hace falta mirar (así se prueba sin navegador). */
export interface FocusLike {
  tagName: string;
  isContentEditable?: boolean;
  type?: string;
  getAttribute(name: string): string | null;
}

// Inputs que no son de escribir: se apretan (Enter/Espacio) o se mueven con flechas.
const PRESS_INPUTS = new Set(["button", "submit", "reset", "image", "checkbox", "radio", "file", "color"]);
const ARROW_INPUTS = new Set(["range", "radio"]);
// Roles ARIA que reciben texto: todas las teclas son suyas.
const TEXT_ROLES = new Set(["textbox", "searchbox", "combobox", "spinbutton"]);
// Roles que se apretan con Enter o Espacio.
const PRESS_ROLES = new Set(["button", "link", "checkbox", "radio", "switch", "tab", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "treeitem"]);
// Roles que se recorren con flechas (una lista de pestañas, un menú, un deslizador).
const ARROW_ROLES = new Set(["slider", "radio", "tab", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "treeitem", "listbox", "menu", "menubar", "tablist", "radiogroup", "grid", "gridcell"]);

const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);
const PRESS_KEYS = new Set(["Enter", " ", "Spacebar"]);

const tag = (el: FocusLike) => el.tagName.toLowerCase();
const role = (el: FocusLike) => (el.getAttribute("role") ?? "").toLowerCase();
const inputType = (el: FocusLike) => (el.type ?? el.getAttribute("type") ?? "text").toLowerCase();

/** El elemento con foco (null sin DOM o si es el body: el juego). */
export function activeElement(): FocusLike | null {
  if (typeof document === "undefined") return null;
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  return el as unknown as FocusLike;
}

/** ¿Es un control donde se escribe? (ahí todas las teclas son del texto). */
export function isEditableFocus(el: FocusLike | null = activeElement()): boolean {
  if (!el) return false;
  const t = tag(el);
  if (t === "textarea" || t === "select") return true;
  if (t === "input") return !PRESS_INPUTS.has(inputType(el)) && inputType(el) !== "range";
  if (el.isContentEditable) return true;
  return TEXT_ROLES.has(role(el));
}

/** ¿Es un control que se aprieta con Enter o Espacio (botón, enlace, casilla, pestaña)? */
export function isPressableFocus(el: FocusLike | null = activeElement()): boolean {
  if (!el) return false;
  const t = tag(el);
  if (t === "button" || t === "summary") return true;
  if (t === "a") return el.getAttribute("href") !== null;
  if (t === "input") return PRESS_INPUTS.has(inputType(el));
  return PRESS_ROLES.has(role(el));
}

/** ¿Es un control que se maneja con flechas (deslizador, radio, pestañas, menú)? */
function isArrowFocus(el: FocusLike): boolean {
  if (tag(el) === "input") return ARROW_INPUTS.has(inputType(el));
  return ARROW_ROLES.has(role(el));
}

/**
 * ¿Esta tecla (el `key` de KeyboardEvent) es del control con foco y no del juego? Escribiendo, todas;
 * en un botón, Enter y Espacio (las letras siguen siendo del juego: después de un clic en la barra, WASD
 * tiene que seguir caminando); en un deslizador o una lista, las flechas.
 */
export function focusOwnsKey(key: string, el: FocusLike | null = activeElement()): boolean {
  if (!el) return false;
  if (isEditableFocus(el)) return true;
  if (PRESS_KEYS.has(key) && isPressableFocus(el)) return true;
  if (ARROWS.has(key) && isArrowFocus(el)) return true;
  return false;
}
