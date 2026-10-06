// La decoración del Festival de cometas (ver festival-decor.ts): la loma del observatorio, en el prado al
// suroeste de la torre (x 108..134, y 51..69, tiles del nivel), se vuelve el voladero: el taller de
// cometas, el puesto de Chepe, el tablero del concurso, el carrito del raspao, la manga de viento,
// banderines en las cuatro esquinas, cometas de adorno amarradas, el mantel del picnic y el árbol con la
// cometa de Mateo enredada. Junto al garaje, la escalera con la cometa de Santiago en el alero.
import type { Facing, Placement, PointDef } from "../types";
import type { FestivalDecorDef } from "../../festival-decor";

/** El voladero: donde se puede soltar la cometa (tiles del jardín). */
export const VOLADERO = { x: 108, y: 51, w: 27, h: 19 } as const;

/** ¿Ese tile del jardín es del voladero? */
export const enVoladero = (tx: number, ty: number) => tx >= VOLADERO.x && ty >= VOLADERO.y && tx < VOLADERO.x + VOLADERO.w && ty < VOLADERO.y + VOLADERO.h;

/** La mesa del taller, el puesto, el tablero y la escalera del garaje (sus puntos van delante, al sur). */
export const TALLER_COMETAS = { x: 113, y: 53 };
export const PUESTO_COMETAS = { x: 117, y: 53 };
export const TABLERO_COMETAS = { x: 121, y: 53 };
export const MANGA_VIENTO = { x: 131, y: 57 };
export const CARRITO_RASPAO = { x: 126, y: 56 };
export const ARBOL_COMETA = { x: 130, y: 62 };
export const MANTEL_PICNIC = { x: 118, y: 60 };
export const ESCALERA_GARAJE = { x: 51, y: 28 };

const put = (type: string, x: number, y: number, facing: Facing = "right"): Placement => ({ type, x, y, facing });

export const COMETAS_DECOR: FestivalDecorDef = {
  areas: ["jardin"],
  build(def) {
    if (def.id !== "jardin") return null;
    const furniture: Placement[] = [
      put("taller-cometas", TALLER_COMETAS.x, TALLER_COMETAS.y),
      put("puesto-cometas", PUESTO_COMETAS.x, PUESTO_COMETAS.y),
      put("tablero-cometas", TABLERO_COMETAS.x, TABLERO_COMETAS.y),
      put("carrito-raspao", CARRITO_RASPAO.x, CARRITO_RASPAO.y),
      put("manga-viento", MANGA_VIENTO.x, MANGA_VIENTO.y),
      put("mantel-picnic", MANTEL_PICNIC.x, MANTEL_PICNIC.y),
      put("arbol-cometa", ARBOL_COMETA.x, ARBOL_COMETA.y),
      // Banderines en las esquinas del voladero.
      put("banderines-cometas", 111, 52),
      put("banderines-cometas", 130, 52),
      put("banderines-cometas", 112, 68),
      put("banderines-cometas", 132, 68),
      // Cometas de adorno amarradas a su estaca.
      put("cometa-amarrada", 115, 66),
      put("cometa-amarrada-2", 125, 67),
      put("cometa-amarrada-3", 133, 61),
      // La escalera recostada al garaje, con la cometa de Santiago en el alero.
      put("escalera-garaje", ESCALERA_GARAJE.x, ESCALERA_GARAJE.y),
    ];
    const points: PointDef[] = [
      { type: "cometas_taller", name: "Taller de cometas", x: TALLER_COMETAS.x, y: TALLER_COMETAS.y + 1 },
      { type: "festival_shop", name: "Puesto de cometas", x: PUESTO_COMETAS.x, y: PUESTO_COMETAS.y + 1 },
      // El carrito del raspao también es el puesto (Don Efraín vende el raspao y el salpicón).
      { type: "festival_shop", name: "Carrito del raspao", x: CARRITO_RASPAO.x, y: CARRITO_RASPAO.y + 1 },
      { type: "cometas_concurso", name: "Tablero del concurso", x: TABLERO_COMETAS.x, y: TABLERO_COMETAS.y + 1 },
      { type: "cometas_techo", name: "Escalera del garaje", x: ESCALERA_GARAJE.x, y: ESCALERA_GARAJE.y + 1 },
    ];
    return { furniture, points };
  },
};
