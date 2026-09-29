// Fondos de pantalla del escritorio de Hyvento OS: la lista y la preferencia guardada en el navegador.
// El dibujo de cada uno está en `fondos-arte.ts` (pixel en un canvas chico) y la ventana para elegir
// en `FondosApp.tsx`. Todos son gratis por ahora (la pregunta del desbloqueo quedó en VIR-140).
import { seasonOf, type Season } from "@hyvento/shared";

export const FONDO_IDS = ["cielo", "noche", "espacio", "lago", "otono", "lluvia", "madera", "liso", "estacion"] as const;
export type FondoId = (typeof FONDO_IDS)[number];

export interface Fondo {
  id: FondoId;
  nombre: string;
  /** Una frase para el `title` de la miniatura. */
  descripcion: string;
}

/** El de siempre: el cielo pixel con la cabaña del login. */
export const FONDO_POR_DEFECTO: FondoId = "cielo";

export const FONDOS: readonly Fondo[] = [
  { id: "cielo", nombre: "Cielo de la cabaña", descripcion: "El cielo pixel con la cabaña, como en la entrada." },
  { id: "noche", nombre: "Cabaña de noche", descripcion: "La cabaña con la ventana prendida bajo las estrellas." },
  { id: "espacio", nombre: "Fogata en el espacio", descripcion: "Un planetita con su fogata, pinos y una nave, entre las estrellas." },
  { id: "lago", nombre: "El lago", descripcion: "El lago del jardín con el muelle y los cerros." },
  { id: "otono", nombre: "Bosque de otoño", descripcion: "Árboles naranjas y hojas que caen." },
  { id: "lluvia", nombre: "Lluvia en la ventana", descripcion: "Gotas en el vidrio y el jardín mojado afuera." },
  { id: "madera", nombre: "Madera", descripcion: "Tablas de madera, como el piso de la cabaña." },
  { id: "liso", nombre: "Salvia", descripcion: "Un verde suave, liso, con puntitos." },
  { id: "estacion", nombre: "La estación", descripcion: "El jardín según la estación de Bogotá: cambia solo." },
];

export const isFondoId = (x: unknown): x is FondoId => typeof x === "string" && (FONDO_IDS as readonly string[]).includes(x);

/** Lo guardado, o el fondo por defecto si no hay nada o es un id que ya no existe. */
export const parseFondo = (raw: string | null | undefined): FondoId => (isFondoId(raw) ? raw : FONDO_POR_DEFECTO);

export const fondoPorId = (id: FondoId): Fondo => FONDOS.find((f) => f.id === id) ?? FONDOS[0]!;

/** Cada persona en su navegador (como los favoritos del PC). */
export const FONDO_KEY = "hyvento.pc.fondo";

type Lector = Pick<Storage, "getItem">;
type Escritor = Pick<Storage, "setItem">;

/** Lee el fondo guardado; si el almacenamiento no está o falla (modo privado), el de siempre. */
export function leerFondo(storage: Lector | null | undefined): FondoId {
  try {
    return parseFondo(storage?.getItem(FONDO_KEY));
  } catch {
    return FONDO_POR_DEFECTO;
  }
}

/** Guarda el fondo elegido; devuelve false si no se pudo (no pasa nada: queda solo por esta vez). */
export function guardarFondo(storage: Escritor | null | undefined, id: FondoId): boolean {
  try {
    if (!storage) return false;
    storage.setItem(FONDO_KEY, id);
    return true;
  } catch {
    return false;
  }
}

/** La estación que dibuja el fondo "La estación" en el instante `ts`. */
export const estacionDelFondo = (ts: number): Season => seasonOf(ts);
