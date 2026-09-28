// Los niveles de la cabaña, uno por archivo. Ver docs/plan-rediseno.md para qué hace cada sala.
import type { AreaDef } from "../types";
import { jardin } from "./jardin";
import { piso2 } from "./piso-2";
import { piso3 } from "./piso-3";
import { plantaBaja } from "./planta-baja";
import { sotano } from "./sotano";
import { garaje } from "./garaje";
import { casaArbol } from "./casa-arbol";

export { CONEXIONES, type Conexion } from "./conexiones";
export { OFFICE_COUNT } from "./piso-2";
export { BLACKJACK_SEATS } from "./sotano";
export { BOARD_TABLES } from "./piso-3";

export const AREAS: AreaDef[] = [jardin, plantaBaja, piso2, piso3, sotano, garaje, casaArbol];
/** Donde aparece todo el mundo al entrar. */
export const SPAWN_AREA = "jardin";
