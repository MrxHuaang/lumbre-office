"use client";

// Foco atrapado en una ventana (PanelShell, OfficeDialog): al abrir entra, Tab y Shift+Tab dan la vuelta
// adentro y al cerrar vuelve a donde estaba (el botón de la barra que la abrió). Sin esto, con el teclado
// el foco se iba detrás del fondo oscuro, a la barra o al canvas.
import { useEffect, type RefObject } from "react";

/**
 * Adónde saltar con Tab: `index` es la posición del foco entre los `count` enfocables (-1 si está afuera
 * o en la ventana misma). Devuelve el índice a enfocar, o null si el navegador puede seguir solo.
 */
export function trapStep(count: number, index: number, shift: boolean): number | null {
  if (count === 0) return -1; // nada enfocable: el foco se queda en la ventana
  if (index < 0) return shift ? count - 1 : 0;
  if (shift && index === 0) return count - 1;
  if (!shift && index === count - 1) return 0;
  return null;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

function focusables(box: HTMLElement): HTMLElement[] {
  return [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
}

// Ventanas abiertas, la última encima: solo esa atrapa (un regalo abierto desde un panel, por ejemplo).
const stack: HTMLElement[] = [];

/** Atrapa el foco dentro de `ref` mientras el componente está montado (y `active`). */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const box = ref.current;
    if (!active || !box) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stack.push(box);
    // Si algo de adentro ya pidió el foco (autoFocus), se respeta; si no, la ventana misma (así un lector
    // de pantalla lee el título y Tab lleva al primer control sin prender un campo de golpe).
    if (!box.contains(document.activeElement)) {
      if (box.tabIndex < 0 && !box.hasAttribute("tabindex")) box.tabIndex = -1;
      box.focus({ preventScroll: true });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || stack[stack.length - 1] !== box) return;
      const list = focusables(box);
      const step = trapStep(list.length, list.indexOf(document.activeElement as HTMLElement), e.shiftKey);
      if (step === null) return;
      e.preventDefault();
      // Tab no es de la barra de la mochila mientras hay una ventana.
      e.stopPropagation();
      (step < 0 ? box : list[step]!).focus({ preventScroll: true });
    };
    // En captura: llega antes que los atajos de window (Tab de la barra).
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      const i = stack.lastIndexOf(box);
      if (i >= 0) stack.splice(i, 1);
      // Vuelve adonde estaba, si sigue en la página (y no se fue a otra ventana mientras tanto).
      if (before && before.isConnected && before !== document.body) before.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
