import { describe, expect, it } from "vitest";
import { focusOwnsKey, isEditableFocus, isPressableFocus, type FocusLike } from "./keyboardFocus";

/** Un elemento de mentira: etiqueta y atributos. */
function el(tagName: string, attrs: Record<string, string> = {}, editable = false): FocusLike {
  return { tagName: tagName.toUpperCase(), isContentEditable: editable, type: attrs.type, getAttribute: (n) => attrs[n] ?? null };
}

describe("isEditableFocus", () => {
  it("sin foco (el body) es del juego", () => {
    expect(isEditableFocus(null)).toBe(false);
  });

  it("campos de texto, textarea, select y contenteditable son de escribir", () => {
    expect(isEditableFocus(el("input"))).toBe(true);
    expect(isEditableFocus(el("input", { type: "search" }))).toBe(true);
    expect(isEditableFocus(el("input", { type: "number" }))).toBe(true);
    expect(isEditableFocus(el("textarea"))).toBe(true);
    expect(isEditableFocus(el("select"))).toBe(true);
    expect(isEditableFocus(el("div", {}, true))).toBe(true);
    expect(isEditableFocus(el("div", { role: "textbox" }))).toBe(true);
    expect(isEditableFocus(el("div", { role: "combobox" }))).toBe(true);
  });

  it("botones, casillas y deslizadores no son de escribir", () => {
    expect(isEditableFocus(el("button"))).toBe(false);
    expect(isEditableFocus(el("input", { type: "checkbox" }))).toBe(false);
    expect(isEditableFocus(el("input", { type: "range" }))).toBe(false);
    expect(isEditableFocus(el("div", { role: "button" }))).toBe(false);
  });
});

describe("isPressableFocus", () => {
  it("botones, enlaces con href y roles que se aprietan", () => {
    expect(isPressableFocus(el("button"))).toBe(true);
    expect(isPressableFocus(el("a", { href: "/x" }))).toBe(true);
    expect(isPressableFocus(el("a"))).toBe(false);
    expect(isPressableFocus(el("input", { type: "submit" }))).toBe(true);
    expect(isPressableFocus(el("span", { role: "tab" }))).toBe(true);
    expect(isPressableFocus(el("div"))).toBe(false);
  });
});

describe("focusOwnsKey", () => {
  it("escribiendo, todas las teclas son del campo", () => {
    for (const k of ["w", "e", "Enter", " ", "ArrowUp", "t", "p"]) expect(focusOwnsKey(k, el("input"))).toBe(true);
  });

  it("en un botón, Enter y Espacio son del botón pero las letras y Tab siguen siendo del juego", () => {
    const b = el("button");
    expect(focusOwnsKey("Enter", b)).toBe(true);
    expect(focusOwnsKey(" ", b)).toBe(true);
    expect(focusOwnsKey("w", b)).toBe(false);
    expect(focusOwnsKey("e", b)).toBe(false);
    expect(focusOwnsKey("ArrowUp", b)).toBe(false);
    expect(focusOwnsKey("Tab", b)).toBe(false);
  });

  it("en un deslizador o una lista de pestañas, las flechas son del control", () => {
    expect(focusOwnsKey("ArrowLeft", el("input", { type: "range" }))).toBe(true);
    expect(focusOwnsKey("w", el("input", { type: "range" }))).toBe(false);
    expect(focusOwnsKey("ArrowRight", el("button", { role: "tab" }))).toBe(true);
    expect(focusOwnsKey("ArrowDown", el("div", { role: "listbox" }))).toBe(true);
  });

  it("sin foco nada es de la interfaz", () => {
    expect(focusOwnsKey("Enter", null)).toBe(false);
  });
});
