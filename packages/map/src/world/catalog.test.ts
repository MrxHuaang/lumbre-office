import { describe, expect, it } from "vitest";
import { CASINO_DRAW } from "../art/casino";
import { CINEMA_DRAW } from "../art/cinema";
import { CLUB_DRAW } from "../art/club";
import { DECOR } from "../art/decor";
import { EXTERIOR_DRAW } from "../art/exterior";
import { INTERIOR_DRAW } from "../art/interior";
import { LEISURE_DRAW } from "../art/leisure";
import { SHOP } from "../art/shop";
import { SOTANO_DRAW } from "../art/sotano";
import { EXTERIOR_CATALOG } from "./catalog-exterior";
import { INTERIOR_CATALOG } from "./catalog-interior";
import { SOTANO_CATALOG } from "./catalog-sotano";
import { GARAJE_CATALOG } from "./catalog-garaje";
import { GARAJE_DRAW } from "../art/garaje";
import { CASA_ARBOL_CATALOG } from "./catalog-casa-arbol";
import { CASA_ARBOL_DRAW } from "../art/casa-arbol";

/** Claves repetidas entre grupos: "clave (grupo a, grupo b)". */
function repeated(groups: Record<string, object>): string[] {
  const owner = new Map<string, string>();
  const out: string[] = [];
  for (const [name, group] of Object.entries(groups))
    for (const key of Object.keys(group)) {
      const prev = owner.get(key);
      if (prev) out.push(`${key} (${prev}, ${name})`);
      else owner.set(key, name);
    }
  return out;
}

// CATALOG y DRAW se arman con spread: si dos partes usan el mismo id, gana la última sin ningún aviso
// (otro tamaño, otra colisión, otro dibujo). Cada parte del rediseño tiene que usar ids propios.
describe("registro de muebles", () => {
  it("los catálogos del rediseño no comparten ids", () => {
    expect(repeated({ exterior: EXTERIOR_CATALOG, interior: INTERIOR_CATALOG, sotano: SOTANO_CATALOG, garaje: GARAJE_CATALOG, casaArbol: CASA_ARBOL_CATALOG })).toEqual([]);
  });

  it("los grupos de dibujos no comparten ids", () => {
    expect(
      repeated({
        decor: DECOR,
        shop: SHOP,
        casino: CASINO_DRAW,
        club: CLUB_DRAW,
        cinema: CINEMA_DRAW,
        leisure: LEISURE_DRAW,
        exterior: EXTERIOR_DRAW,
        interior: INTERIOR_DRAW,
        sotano: SOTANO_DRAW,
        garaje: GARAJE_DRAW,
        casaArbol: CASA_ARBOL_DRAW,
      }),
    ).toEqual([]);
  });
});
