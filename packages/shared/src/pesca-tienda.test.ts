import { describe, expect, it } from "vitest";
import { BAG_OBJECTS, bagItemInfo } from "./bolsa";
import { FISH, fishPool, pickFish, LUCKY_RARITIES } from "./fishing";
import { FISHING_RODS, FishingSim, ROD_TUNING, autoplay, barHeightFor, replayFishing } from "./fishing-sim";
import {
  BAIT_TUNING,
  PESCA,
  PESCA_LINES,
  PESCA_NPC,
  PESCA_SHOP,
  PescaBuyMessage,
  ROD_ITEM,
  biteWindowWith,
  fishingGear,
  pescaGreetLine,
  pescaIdleLine,
  pescaItem,
  pescaMood,
  pescaRefId,
  pescaSoldLine,
  rodOfItem,
} from "./pesca-tienda";

const have = (stock: Record<string, number>) => (art: string) => stock[art] ?? 0;

describe("lo que vende el puesto de pesca", () => {
  it("tres cañas (fibra de vidrio, carbono y la dorada, de a una) y dos carnadas (de a 10), con precios en puntos", () => {
    expect(PESCA_SHOP.map((i) => i.id)).toEqual(["cana-fibra", "cana-carbono", "cana-dorada", "carnada", "carnada-buena"]);
    for (const i of PESCA_SHOP) {
      expect(Number.isInteger(i.price) && i.price > 0, i.id).toBe(true);
      expect(i.gives, i.id).toBe(i.kind === "rod" ? 1 : 10);
    }
    // Cada caña vale más que la anterior (la dorada es la meta de largo plazo), y la carnada buena más que la común.
    expect(pescaItem("cana-carbono")!.price).toBeGreaterThan(pescaItem("cana-fibra")!.price);
    expect(pescaItem("cana-dorada")!.price).toBeGreaterThanOrEqual(pescaItem("cana-carbono")!.price * 2);
    expect(pescaItem("carnada-buena")!.price).toBeGreaterThan(pescaItem("carnada")!.price);
    expect(pescaRefId("carnada")).toBe("pesca:carnada");
    // La de bambú no se vende: es la de siempre.
    expect(PescaBuyMessage.safeParse({ item: "cana-bambu" }).success).toBe(false);
    expect(PescaBuyMessage.safeParse({ item: "carnada" }).success).toBe(true);
  });

  it("todo va a la mochila: las cañas de a una y sin gastarse, la carnada en pila", () => {
    for (const i of PESCA_SHOP) {
      expect(BAG_OBJECTS[i.id], i.id).toBeDefined();
      const info = bagItemInfo(`obj:${i.id}`);
      expect(info.name).toBe(i.name);
      if (i.kind === "rod") expect([info.max, info.durable, info.kind]).toEqual([1, true, "herramienta"]);
      else expect(info.max).toBe(PESCA.baitMax);
      // No se comen ni son del huerto: solo se llevan (el puesto las usa al lanzar).
      expect(info.use).toBeNull();
    }
    expect(rodOfItem("cana-fibra")).toBe("fibra");
    expect(rodOfItem("cana-carbono")).toBe("carbono");
    expect(rodOfItem("cana-dorada")).toBe("dorada");
    expect(rodOfItem("carnada")).toBeNull();
  });
});

describe("con qué se pesca", () => {
  it("sin nada comprado, la caña de bambú y sin carnada (como siempre)", () => {
    expect(fishingGear(have({}))).toEqual({ rod: "bambu", bait: null });
  });

  it("la mejor que se tenga, salvo que lo de la mano sea una caña o una carnada", () => {
    const all = have({ [ROD_ITEM.fibra]: 1, [ROD_ITEM.carbono]: 1, carnada: 5, "carnada-buena": 3 });
    expect(fishingGear(all)).toEqual({ rod: "carbono", bait: "carnada-buena" });
    expect(fishingGear(have({ [ROD_ITEM.carbono]: 1, [ROD_ITEM.dorada]: 1 }))).toEqual({ rod: "dorada", bait: null });
    expect(fishingGear(all, "cana-fibra")).toEqual({ rod: "fibra", bait: "carnada-buena" });
    expect(fishingGear(all, "carnada")).toEqual({ rod: "carbono", bait: "carnada" });
    expect(fishingGear(have({ [ROD_ITEM.fibra]: 1, carnada: 2 }), "tinto")).toEqual({ rod: "fibra", bait: "carnada" });
    // Lo de la mano tiene que tenerse de verdad.
    expect(fishingGear(have({}), "cana-carbono")).toEqual({ rod: "bambu", bait: null });
  });
});

describe("las cañas en el minijuego", () => {
  const hard = FISH.filter((f) => f.rarity === "legendario" || f.rarity === "mitico");

  it("la de bambú deja el minijuego igual que antes; cada una de las otras alarga más la barra y frena más al pez", () => {
    for (let i = 1; i < FISHING_RODS.length; i++) {
      const [a, b] = [ROD_TUNING[FISHING_RODS[i - 1]!], ROD_TUNING[FISHING_RODS[i]!]];
      expect(b.bar).toBeGreaterThan(a.bar);
      expect(b.move).toBeLessThan(a.move);
    }
    const setup = { seed: 4242, difficulty: 90, behavior: "mixed" as const, treasure: false };
    const run = autoplay(setup);
    expect(replayFishing({ ...setup, rod: "bambu" }, run.inputs, run.frames)).toEqual(replayFishing(setup, run.inputs, run.frames));
    expect(new FishingSim({ ...setup, rod: "bambu" }).barHeight).toBe(barHeightFor(90));
    const fibra = new FishingSim({ ...setup, rod: "fibra" }).barHeight;
    const carbono = new FishingSim({ ...setup, rod: "carbono" }).barHeight;
    expect(fibra).toBe(Math.round(barHeightFor(90) * ROD_TUNING.fibra.bar));
    expect(carbono).toBeGreaterThan(fibra);
    expect(fibra).toBeGreaterThan(barHeightFor(90));
    expect(new FishingSim({ ...setup, rod: "dorada" }).barHeight).toBeGreaterThan(carbono);
  });

  it("con la caña buena el jugador automático saca más legendarios y míticos", () => {
    const wins = (rod: (typeof FISHING_RODS)[number]) => {
      let won = 0;
      for (const f of hard)
        for (let seed = 1; seed <= 20; seed++) if (autoplay({ seed: seed * 7919, difficulty: f.difficulty, behavior: f.behavior, treasure: false, rod }).caught) won++;
      return won;
    };
    const bambu = wins("bambu");
    const fibra = wins("fibra");
    const carbono = wins("carbono");
    const dorada = wins("dorada");
    expect(fibra).toBeGreaterThan(bambu);
    expect(carbono).toBeGreaterThan(fibra);
    expect(dorada).toBeGreaterThan(carbono);
  });

  it("la partida se repite igual con la misma caña (el servidor la valida con la que uno tiene)", () => {
    const setup = { seed: 777, difficulty: 104, behavior: "dart" as const, treasure: false, rod: "carbono" as const };
    const run = autoplay(setup);
    const again = replayFishing(setup, run.inputs, run.frames)!;
    expect([again.caught, again.frame]).toEqual([run.caught, run.frames]);
  });
});

describe("la carnada", () => {
  it("pica antes: la espera se acorta (más con la buena)", () => {
    expect(biteWindowWith(null, 2500, 9000)).toEqual({ min: 2500, max: 9000 });
    const comun = biteWindowWith("carnada", 2500, 9000);
    const buena = biteWindowWith("carnada-buena", 2500, 9000);
    expect(comun.max).toBeLessThan(9000);
    expect(buena.max).toBeLessThan(comun.max);
    expect(buena.min).toBeLessThan(comun.min);
  });

  it("sube un poco la probabilidad de lo raro (y sin carnada los pesos no cambian)", () => {
    const share = (luck: number) => {
      const pool = fishPool(12, "despejado", luck);
      const total = pool.reduce((a, p) => a + p.weight, 0);
      return pool.filter((p) => LUCKY_RARITIES.includes(p.fish.rarity)).reduce((a, p) => a + p.weight, 0) / total;
    };
    expect(fishPool(12, "despejado", 1)).toEqual(fishPool(12, "despejado"));
    const base = share(1);
    const comun = share(BAIT_TUNING.carnada.luck);
    const buena = share(BAIT_TUNING["carnada-buena"].luck);
    expect(comun).toBeGreaterThan(base);
    expect(buena).toBeGreaterThan(comun);
    // "Un poco": ni la buena duplica lo raro.
    expect(buena).toBeLessThan(base * 2);
    // Con el mismo azar, sin carnada sale lo mismo que antes.
    expect(pickFish(12, () => 0, "despejado", 1).id).toBe(pickFish(12, () => 0, "despejado").id);
  });
});

describe("Don Evelio", () => {
  it("es un pescador pastuso del jardín con su look (sombrero de pescador, ruana y botas de caucho)", () => {
    expect(PESCA_NPC.role).toBe("pescador");
    expect(PESCA_NPC.area).toBe("jardin");
    expect(PESCA_NPC.solid).toBe(true);
    expect([PESCA_NPC.look.head, PESCA_NPC.look.outfit, PESCA_NPC.look.shoes]).toEqual(["bucket-hat", "ruana", "rain-boots"]);
    // Habla como en Pasto: "pues" al final, "mijo", "achichay" con el frío…
    const all = Object.values(PESCA_LINES).flat().join(" ");
    for (const word of ["pues", "mijo", "Achichay", "Ananay", "Atatay", "longo", "guagua", "Cocha", "Galeras"]) expect(all, word).toContain(word);
  });

  it("lo que dice cambia con la hora del juego y el clima (y es el mismo para una semilla)", () => {
    expect(pescaMood(3)).toBe("madrugada");
    expect(pescaMood(8)).toBe("manana");
    expect(pescaMood(18)).toBe("atardecer");
    expect(pescaMood(22)).toBe("noche");
    expect(PESCA_LINES.manana).toContain(pescaIdleLine(8, "despejado", 5));
    expect(PESCA_LINES.noche).toContain(pescaIdleLine(22, "nublado", 5));
    expect(PESCA_LINES.lluvia).toContain(pescaIdleLine(8, "lluvia", 5));
    expect(PESCA_LINES.tormenta).toContain(pescaIdleLine(22, "tormenta", 1));
    expect(pescaIdleLine(14, "niebla", 9)).toBe(pescaIdleLine(14, "niebla", 9));
    const hello = pescaGreetLine("Ana", 18, "despejado", 123);
    expect(hello).toContain("Ana");
    expect(PESCA_LINES.atardecer.some((l) => hello.endsWith(l))).toBe(true);
  });

  it("al vender dice algo de la caña o de la carnada, igual para todos los que lo ven", () => {
    const sold = { sessionId: "s1", item: "cana-fibra" as const, at: 1000 };
    expect(PESCA_LINES.soldRod).toContain(pescaSoldLine(sold));
    expect(pescaSoldLine(sold)).toBe(pescaSoldLine({ ...sold }));
    expect(PESCA_LINES.soldBait).toContain(pescaSoldLine({ ...sold, item: "carnada" }));
  });
});
