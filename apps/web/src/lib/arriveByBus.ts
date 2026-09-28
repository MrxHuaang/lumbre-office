// "Llegar en bus" (opción de "Mi personaje"): aparecer adentro del Megabús, que te deja en la Estación
// Hyvento, en vez de en el portón. Es una preferencia de este navegador (no va a la base).
const KEY = "hyvento:llegar-en-bus";

export function getArriveByBus(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setArriveByBus(on: boolean) {
  try {
    if (on) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // Sin almacenamiento (ventana privada): la opción no se recuerda.
  }
}
