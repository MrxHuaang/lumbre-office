import { describe, expect, it } from "vitest";
import { bagItemInfo, objItemId } from "./bolsa";
import { CALABAZA_DORADA, CANASTA_DULCES, DULCES } from "./brujas";
import { CONSUMABLES, usesOf } from "./consumables";

describe("lo de la Noche de brujas en la mochila", () => {
  it("los dulces son comida, tienen nombre y se comen a mordiscos (más de uno, para ver el mordisco)", () => {
    for (const d of DULCES) {
      const info = bagItemInfo(objItemId(d));
      expect(info.kind, d).toBe("comida");
      expect(info.use, d).toBe("consume");
      expect(info.blurb, d).not.toBe("");
      expect(CONSUMABLES[d]?.action, d).toBe("bite");
      expect(usesOf(d), d).toBeGreaterThan(1);
    }
  });

  it("la canasta es una herramienta que no se gasta y la calabaza dorada no se come", () => {
    const canasta = bagItemInfo(objItemId(CANASTA_DULCES));
    expect([canasta.kind, canasta.max, canasta.durable]).toEqual(["herramienta", 1, true]);
    expect(canasta.use).toBeNull();
    const premio = bagItemInfo(objItemId(CALABAZA_DORADA));
    expect([premio.kind, premio.use, premio.name]).toEqual(["objeto", null, "Calabaza dorada"]);
  });
});
