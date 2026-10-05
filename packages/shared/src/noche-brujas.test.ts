import { describe, expect, it } from "vitest";
import { achievementById } from "./achievements";
import { bagItemInfo, objItemId } from "./bolsa";
import { DULCES } from "./brujas";
import { cineById, cineProblems } from "./cinematicas";
import {
  BRUJAS,
  BRUJAS_CINE,
  BRUJAS_NPCS,
  BRUJAS_SHOP,
  BrujasBuyMessage,
  TRUCOS,
  brujasActiva,
  brujasRefId,
  pumpkinStatKey,
  trickKey,
  trickLine,
  trickOutcome,
} from "./noche-brujas";

describe("la Noche de brujas: reglas", () => {
  it("solo se juega con el festival de brujas abierto", () => {
    expect(brujasActiva("brujas", "fiesta")).toBe(true);
    expect(brujasActiva("brujas", "previa")).toBe(false);
    expect(brujasActiva("brujas", "fin")).toBe(false);
    expect(brujasActiva("carnaval", "fiesta")).toBe(false);
  });

  it("dulce o truco: la tirada decide y la segunda elige cuál (los dos lados salen)", () => {
    expect(trickOutcome(BRUJAS.trickChance - 1, 0)).toEqual({ kind: "truco", truco: TRUCOS[0] });
    expect(trickOutcome(BRUJAS.trickChance, 0)).toEqual({ kind: "dulce", dulce: DULCES[0] });
    const dulces = new Set(Array.from({ length: 20 }, (_, i) => trickOutcome(99, i)).map((o) => (o.kind === "dulce" ? o.dulce : "")));
    expect(dulces).toEqual(new Set(DULCES));
    expect(trickKey("npc", "aurora")).not.toBe(trickKey("puerta", "aurora"));
  });

  it("los NPC tienen ids únicos y siempre dicen algo (los que no tienen frase de brujas, una de las de siempre)", () => {
    const ids = BRUJAS_NPCS.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["aurora", "gloria", "evelio", "portero", "astronoma"]));
    for (const id of ids) for (let seed = 0; seed < 6; seed++) expect(trickLine(id, seed).length, id).toBeGreaterThan(5);
  });

  it("el puesto vende lo que existe en la mochila, con precio y refId del festival", () => {
    for (const item of BRUJAS_SHOP) {
      expect(bagItemInfo(objItemId(item.id)).name, item.id).toBe(item.name);
      expect(item.price).toBeGreaterThan(0);
      expect(BrujasBuyMessage.safeParse({ item: item.id }).success).toBe(true);
    }
    expect(BrujasBuyMessage.safeParse({ item: "calabaza-dorada" }).success).toBe(false);
    expect(brujasRefId("chupeta")).toBe("festival:brujas:chupeta");
    expect(pumpkinStatKey(2)).toBe("festival:brujas:2:calabaza");
  });

  it("las cinemáticas de la calabaza y de cada truco están en el catálogo y están bien armadas", () => {
    for (const id of [BRUJAS_CINE.calabaza, ...TRUCOS.map(BRUJAS_CINE.truco)]) {
      const def = cineById(id);
      expect(def, id).toBeDefined();
      expect(def!.kind).toBe("momento");
      expect(cineProblems(def!)).toEqual([]);
    }
  });

  it("los logros de brujas existen", () => {
    expect(achievementById("calabaza-dorada")?.min).toBe(1);
    expect(achievementById("dulce-o-truco")?.min).toBeGreaterThan(1);
  });
});
