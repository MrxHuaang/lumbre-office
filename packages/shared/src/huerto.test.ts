import { describe, expect, it } from "vitest";
import { CONSUMABLES, usesOf, usableSpec } from "./consumables";
import { FREE_HOLDS, FREE_NAMES, isFreeHold } from "./casa";
import { heldParts } from "./cafe";
import {
  CROPS,
  EMPTY_CAN,
  GREENHOUSE_PLOT_BASE,
  isGreenhousePlot,
  HUERTO,
  HUERTO_TOOLS,
  SHED_ITEMS,
  ShedTakeMessage,
  WATERING_CAN,
  canHarvest,
  canWater,
  cropById,
  cropOfSeeds,
  durationText,
  huertoNoticeText,
  HuertoNoticeCode,
  isHuertoTool,
  plantPlot,
  plotGrowth,
  plotReady,
  plotReadyAt,
  plotStage,
  seedsOf,
  waterPlot,
  wetMsOf,
} from "./huerto";
import { seasonGrowth } from "./estaciones";

const T0 = Date.UTC(2026, 8, 27, 15, 0, 0);
const alice = { userId: "u-alice", name: "Alice" };
/** Las parcelas se siembran en otoño del juego: las cuentas de abajo llevan su ritmo. */
const k = (crop: string) => seasonGrowth(crop, "otono", { greenhouse: Boolean(cropById(crop)?.indoor) });

describe("huerto: cómo crece", () => {
  const tomate = cropById("tomate")!;

  it("seca crece despacio y húmeda a ritmo completo", () => {
    const p = plantPlot("tomate", alice, T0, "otono");
    expect(plotGrowth(p, T0)).toBe(0);
    expect(plotGrowth(p, T0 + 60_000)).toBeCloseTo(60_000 * HUERTO.dryRate * k("tomate"));
    const wet = waterPlot(p, T0);
    expect(wet.wateredUntil).toBe(T0 + wetMsOf(tomate));
    expect(plotGrowth(wet, T0 + 60_000)).toBeCloseTo(60_000 * k("tomate"));
    // Pasada la humedad vuelve al ritmo seco.
    const after = T0 + wetMsOf(tomate) + 60_000;
    expect(plotGrowth(wet, after)).toBeCloseTo((wetMsOf(tomate) + 60_000 * HUERTO.dryRate) * k("tomate"));
  });

  it("nunca pasa de lo que tarda el cultivo, y el momento en que queda lista es exacto", () => {
    for (const crop of CROPS) {
      const p = waterPlot(plantPlot(crop.id, alice, T0, "otono"), T0);
      const ready = plotReadyAt(p);
      expect(plotReady(p, ready - 1), crop.id).toBe(false);
      expect(plotReady(p, ready), crop.id).toBe(true);
      expect(plotGrowth(p, ready + 10 * 60 * 60_000), crop.id).toBe(crop.growMs);
      // Regando lo más posible tarda lo de la tabla; sin regar, 1/dryRate veces más (en el invernadero, igual).
      const dry = plantPlot(crop.id, alice, T0, "otono");
      expect(plotReadyAt(dry) - T0, crop.id).toBeCloseTo((crop.indoor ? crop.growMs : crop.growMs / HUERTO.dryRate) / k(crop.id));
    }
  });

  it("pasa por las cuatro etapas", () => {
    const p = waterPlot(plantPlot("cilantro", alice, T0, "otono"), T0);
    const stages = [0, 0.3, 0.7, 1].map((k) => plotStage(p, T0 + cropById("cilantro")!.growMs * k));
    expect(stages).toEqual([0, 1, 2, 3]);
  });

  it("regar guarda lo que ya creció y no se riega mientras siga húmeda", () => {
    const p = plantPlot("papa", alice, T0, "otono");
    const later = T0 + 20 * 60_000;
    expect(canWater(p, later)).toBe(true);
    const wet = waterPlot(p, later);
    expect(wet.growthMs).toBeCloseTo(20 * 60_000 * HUERTO.dryRate * k("papa"));
    expect(canWater(wet, later + 60_000)).toBe(false);
    const wetMs = wetMsOf(cropById("papa")!);
    expect(canWater(wet, later + wetMs * (1 - HUERTO.rewaterShare) + 1)).toBe(true);
    // Lista, ya no se riega.
    expect(canWater(wet, plotReadyAt(wet))).toBe(false);
  });

  it("cosecha quien sembró; el resto, pasada la hora de gracia", () => {
    const p = waterPlot(plantPlot("fresa", alice, T0, "otono"), T0);
    const ready = plotReadyAt(p);
    expect(canHarvest(p, "u-alice", ready - 1)).toBe(false);
    expect(canHarvest(p, "u-alice", ready)).toBe(true);
    expect(canHarvest(p, "u-bob", ready)).toBe(false);
    expect(canHarvest(p, "u-bob", ready + HUERTO.ownerHarvestMs)).toBe(true);
  });
});

describe("invernadero", () => {
  it("lo de tierra caliente crece a ritmo completo sin regar, y no se riega", () => {
    const indoor = CROPS.filter((c) => c.indoor);
    expect(indoor.map((c) => c.id)).toEqual(["uchuva", "pitahaya", "cacao", "cafe"]);
    for (const c of indoor) {
      const p = plantPlot(c.id, alice, T0, "otono");
      expect(plotGrowth(p, T0 + 60_000), c.id).toBe(60_000);
      expect(plotReadyAt(p), c.id).toBe(T0 + c.growMs);
      expect(canWater(p, T0 + 60_000), c.id).toBe(false);
    }
    expect(isGreenhousePlot(GREENHOUSE_PLOT_BASE)).toBe(true);
    expect(isGreenhousePlot(19)).toBe(false);
  });
});

describe("huerto: lo que se lleva en la mano", () => {
  it("las semillas dicen su cultivo y el cobertizo tiene la regadera y una bolsa de cada uno (las flores no: son de la feria)", () => {
    for (const c of CROPS) {
      expect(cropOfSeeds(seedsOf(c.id))?.id).toBe(c.id);
      if (c.flower) expect(SHED_ITEMS).not.toContain(seedsOf(c.id));
      else expect(SHED_ITEMS).toContain(seedsOf(c.id));
    }
    expect(SHED_ITEMS).toContain(EMPTY_CAN);
    expect(cropOfSeeds("tinto")).toBeUndefined();
    expect(ShedTakeMessage.safeParse({ item: seedsOf("lulo") }).success).toBe(true);
    expect(ShedTakeMessage.safeParse({ item: "whisky" }).success).toBe(false);
  });

  it("todo es gratis (se cambia por otra cosa gratis), tiene nombre y ocupa una mano", () => {
    const all = [...Object.keys(HUERTO_TOOLS), ...CROPS.map((c) => c.product), "miel"];
    for (const id of all) {
      expect(isFreeHold(id), id).toBe(true);
      expect(FREE_NAMES[id], id).toBeTruthy();
      expect(heldParts(id), id).toEqual([id]);
      expect(FREE_HOLDS[id], id).toEqual([id]);
    }
  });

  it("las herramientas no se comen (no son consumibles) y traen sus usos; lo cosechado sí se come", () => {
    expect(isHuertoTool(WATERING_CAN)).toBe(true);
    expect(CONSUMABLES[WATERING_CAN]).toBeUndefined();
    expect(usesOf(WATERING_CAN)).toBe(HUERTO.canUses);
    expect(usesOf(seedsOf("maiz"))).toBe(HUERTO.seedUses);
    for (const c of CROPS) expect(CONSUMABLES[c.product]?.action, c.product).toBe(c.flower ? undefined : c.id === "cafe" ? "sip" : "bite");
    expect(CONSUMABLES.miel?.action).toBe("spoon");
  });

  it("parcelas, barriles, pozo, colmenas y la glorieta se usan con E", () => {
    expect(usableSpec("garden-plot")?.action).toBe("plot");
    expect(usableSpec("water-barrel")?.action).toBe("fill");
    expect(usableSpec("well")?.action).toBe("fill");
    expect(usableSpec("beehive")?.action).toBe("honey");
    expect(usableSpec("gazebo-roof")?.action).toBe("ring");
  });

  it("cada aviso tiene su texto", () => {
    for (const code of HuertoNoticeCode.options) expect(huertoNoticeText({ code, waitMs: 90_000, name: "Bob", crop: "papa" }).length, code).toBeGreaterThan(10);
    expect(durationText(30_000)).toBe("1 min");
    expect(durationText(80 * 60_000)).toBe("1 h 20 min");
    expect(durationText(2 * 60 * 60_000)).toBe("2 h");
  });
});
