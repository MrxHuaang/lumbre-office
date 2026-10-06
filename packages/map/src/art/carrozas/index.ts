// Las carrozas del Carnaval (VIR-173): esculturas de papel maché armadas por partes (ver escultura.ts y
// partes.ts). Para sumar una carroza basta con su función aquí (y su comparsa en @hyvento/shared). El
// navegador pide cada una una vez y mueve sus partes con `posesCarroza`.
import type { CarrozaId } from "@hyvento/shared";
import { calavera } from "./calavera";
import { castaneda } from "./castaneda";
import { condor } from "./condor";
import { galeras } from "./galeras";
import { juglar } from "./juglar";
import { luna } from "./luna";
import { megabus } from "./megabus";
import { minga } from "./minga";
import { paramo } from "./paramo";
import { monstruo } from "./monstruo";
import type { CarrozaArte } from "./partes";
import { tinto } from "./tinto";

export { cajaDeParte, posesCarroza, type CarrozaArte, type LuzCarroza, type Movimiento, type Parte, type ParteMovil, type Pose } from "./partes";

export const CARROZAS_ARTE: Record<CarrozaId, () => CarrozaArte> = {
  castaneda,
  condor,
  galeras,
  tablero: calavera,
  reloj: monstruo,
  luna,
  paramo,
  minga,
  tinto,
  megabus,
  juglar,
};

const cache = new Map<string, CarrozaArte>();

/** Las partes de una carroza. Se arman una vez (son las texturas que el navegador mueve). */
export function carrozaArte(id: CarrozaId): CarrozaArte {
  let a = cache.get(id);
  if (!a) {
    const make = CARROZAS_ARTE[id];
    cache.set(id, (a = make()));
  }
  return a;
}
