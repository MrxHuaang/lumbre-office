// El puesto de pesca en la orilla oeste del lago del jardín, al lado de la playita del muelle (tiles del
// nivel). Todo sale del tile de Don Evelio (PESCA_NPC en @hyvento/shared), así el puesto y él no se
// desencuadran: la caseta atrás (oeste), las cañas y la nevera a sus lados, el mostrador adelante (este)
// y, frente al mostrador, el punto donde se compra. El senderito que llega desde la playita está en los
// senderos del jardín (jardin.ts).
import { PESCA_NPC } from "@hyvento/shared";
import type { Placement, PointDef } from "../types";
import { place } from "./place";

const NPC = PESCA_NPC.tile;

export const PUESTO_PESCA = {
  npc: NPC,
  caseta: { x: NPC.x - 2, y: NPC.y - 1 },
  canas: { x: NPC.x, y: NPC.y - 1 },
  nevera: { x: NPC.x, y: NPC.y + 1 },
  mostrador: { x: NPC.x + 1, y: NPC.y - 1 },
  /** Frente al mostrador: ahí se para quien compra. */
  punto: { x: NPC.x + 2, y: NPC.y },
} as const;

export const PUESTO_PESCA_MUEBLES: readonly Placement[] = [
  place("pesca-caseta", PUESTO_PESCA.caseta.x, PUESTO_PESCA.caseta.y),
  place("pesca-canas", PUESTO_PESCA.canas.x, PUESTO_PESCA.canas.y),
  place("pesca-nevera", PUESTO_PESCA.nevera.x, PUESTO_PESCA.nevera.y),
  place("pesca-mostrador", PUESTO_PESCA.mostrador.x, PUESTO_PESCA.mostrador.y),
];

export const PUESTO_PESCA_PUNTO: PointDef = { type: "fishing_shop", name: "Puesto de pesca", x: PUESTO_PESCA.punto.x, y: PUESTO_PESCA.punto.y };
