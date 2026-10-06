import { describe, expect, it } from "vitest";
import { AHUYAMA, ahuyamaDagOf, ahuyamaId, ahuyamaName, cuidadoAhuyama, pesoAhuyama, pesoTexto } from "./ahuyama";
import { BAG_OBJECTS, bagItemInfo, objItemId } from "./bolsa";
import { cineById, cineProblems } from "./cinematicas";
import { recipeById } from "./cocina";
import {
  COMPRAR_ERROR_TEXT,
  COSECHA,
  COSECHA_CINE,
  COSECHA_CINEMATICAS,
  COSECHA_MUEBLES,
  COSECHA_PUESTOS,
  OLLA_RECETA,
  PRECIO_BASE,
  VENDER_ERROR_TEXT,
  VenderMessage,
  ganadorAhuyama,
  mejorPuestoPara,
  ollaFaltan,
  ollaLlena,
  ollaProgreso,
  precioDeCompra,
  precioDeVenta,
  puestoQueMasPaga,
  rankingAhuyamas,
  sorteoTombola,
  tramoDelDia,
  unidadesQueCaben,
} from "./cosecha";
import { festivalById } from "./festivales";
import { GENTE_FIESTA } from "./gente-fiesta";
import { CROPS, SHED_ITEMS, seedsOf } from "./huerto";

const DAY = 30;

describe("la Feria de la cosecha: el mercado", () => {
  it("cinco puestos, cada uno con lo que compra (que existe en la mochila) y su vendedor de la vereda", () => {
    expect(COSECHA_PUESTOS).toHaveLength(5);
    const gente = GENTE_FIESTA.cosecha!(1, "despejado");
    for (const p of COSECHA_PUESTOS) {
      expect(p.compra.length).toBeGreaterThan(0);
      for (const item of p.compra) {
        expect(PRECIO_BASE[item], `${p.id} compra ${item}`).toBeDefined();
        expect(BAG_OBJECTS[item], `${p.id} compra ${item}`).toBeDefined();
      }
      for (const v of p.vende) expect(v.mueble ? COSECHA_MUEBLES[v.id] : BAG_OBJECTS[v.id], `${p.id} vende ${v.id}`).toBeDefined();
      expect(gente.some((n) => n.accion?.puesto === p.id), `${p.id} sin vendedor`).toBe(true);
    }
  });

  it("los precios del día son iguales para todos, cambian de un día a otro y quedan dentro del rango", () => {
    expect(precioDeCompra("tuberculos", "papa", DAY, 600)).toBe(precioDeCompra("tuberculos", "papa", DAY, 600));
    const dias = new Set(Array.from({ length: 12 }, (_, d) => precioDeCompra("ahuyamas", "ahuyama", d, 600)));
    expect(dias.size).toBeGreaterThan(1);
    for (const p of COSECHA_PUESTOS)
      for (const item of p.compra)
        for (const m of [600, 800, 1000, 1300]) {
          const precio = precioDeCompra(p.id, item, DAY, m)!;
          expect(precio).toBeGreaterThanOrEqual(1);
          expect(precio).toBeLessThanOrEqual(Math.round(PRECIO_BASE[item]! * COSECHA.factorMax * COSECHA.bonoTop));
        }
    // Lo que el puesto no compra no tiene precio.
    expect(precioDeCompra("frutas", "papa", DAY, 600)).toBeNull();
    expect(precioDeCompra("nadie", "papa", DAY, 600)).toBeNull();
  });

  it("el que más paga rota cada dos horas, nunca repite seguido y en el día pasan todos", () => {
    expect(tramoDelDia(9 * 60)).toBe(0);
    expect(tramoDelDia(11 * 60)).toBe(1);
    const tops = [9, 11, 13, 15, 17, 19, 21].map((h) => puestoQueMasPaga(DAY, h * 60));
    for (let i = 1; i < tops.length; i++) expect(tops[i]).not.toBe(tops[i - 1]);
    expect(new Set(tops).size).toBe(COSECHA_PUESTOS.length);
    // El que más paga, paga más por lo mismo que en otro tramo.
    const top = puestoQueMasPaga(DAY, 600);
    const item = COSECHA_PUESTOS.find((p) => p.id === top)!.compra[0]!;
    const otroTramo = [11, 13, 15, 17].map((h) => h * 60).find((m) => puestoQueMasPaga(DAY, m) !== top)!;
    expect(precioDeCompra(top, item, DAY, 600)!).toBeGreaterThanOrEqual(precioDeCompra(top, item, DAY, otroTramo)!);
    expect(mejorPuestoPara("papa", DAY, 600)?.precio).toBeGreaterThan(0);
  });

  it("lo que venden los puestos de la cosecha cuesta más de lo que cualquiera paga (no se puede revender)", () => {
    for (const p of COSECHA_PUESTOS)
      for (const v of p.vende)
        if (PRECIO_BASE[v.id] !== undefined) {
          expect(v.price).toBe(precioDeVenta(v.id));
          for (const q of COSECHA_PUESTOS) for (const m of [600, 900, 1200]) expect(v.price).toBeGreaterThan(precioDeCompra(q.id, v.id, DAY, m) ?? 0);
        }
  });

  it("el tope de ventas por feria: cuántas caben y nunca se pasa", () => {
    expect(unidadesQueCaben(3, 5, 0)).toBe(5);
    expect(unidadesQueCaben(4, 10, COSECHA.topeVentas - 10)).toBe(2);
    expect(unidadesQueCaben(4, 10, COSECHA.topeVentas)).toBe(0);
    expect(unidadesQueCaben(100, 1, 0)).toBe(0);
    expect(VenderMessage.safeParse({ puesto: "tuberculos", item: "papa", n: 3 }).success).toBe(true);
    expect(VenderMessage.safeParse({ puesto: "tuberculos", item: "papa", n: 99 }).success).toBe(false);
    expect(VenderMessage.safeParse({ puesto: "x", item: "papa", n: 1 }).success).toBe(false);
    expect(Object.keys(VENDER_ERROR_TEXT).length).toBeGreaterThan(4);
    expect(Object.keys(COMPRAR_ERROR_TEXT).length).toBeGreaterThan(4);
  });

  it("las semillas raras no salen del cobertizo: las vende el mercado", () => {
    const raras = CROPS.filter((c) => c.rare);
    expect(raras.length).toBeGreaterThanOrEqual(2);
    const vende = COSECHA_PUESTOS.flatMap((p) => p.vende.map((v) => v.id));
    for (const c of raras) {
      expect(SHED_ITEMS).not.toContain(seedsOf(c.id));
      expect(vende).toContain(seedsOf(c.id));
    }
    // Lo nuevo del huerto sí sale del cobertizo.
    for (const id of ["yuca", "cebolla", "ahuyama", "platano"]) expect(SHED_ITEMS).toContain(seedsOf(id));
  });
});

describe("la Feria de la cosecha: el sancocho", () => {
  it("lo que lleva la olla existe en la mochila y se cuenta lo que falta", () => {
    for (const item of Object.keys(OLLA_RECETA)) expect(BAG_OBJECTS[item], item).toBeDefined();
    expect(ollaLlena({})).toBe(false);
    expect(ollaProgreso({})).toBe(0);
    expect(ollaFaltan({ papa: 4 }).papa).toBe(OLLA_RECETA.papa! - 4);
    // Lo de más no cuenta de más.
    expect(ollaProgreso({ papa: 100 })).toBeCloseTo(OLLA_RECETA.papa! / Object.values(OLLA_RECETA).reduce((a, b) => a + b, 0));
    expect(ollaLlena({ ...OLLA_RECETA })).toBe(true);
    expect(ollaProgreso({ ...OLLA_RECETA })).toBe(1);
  });

  it("el plato da energía, es de la cosecha y no sale de la estufa", () => {
    const r = recipeById("sancocho-olla")!;
    expect(r.olla).toBe(true);
    expect(r.festival).toBe("cosecha");
    expect(r.effect.kind).toBe("speed");
    expect(bagItemInfo(objItemId(r.id)).use).toBe("consume");
  });
});

describe("la Feria de la cosecha: la ahuyama más grande", () => {
  const base = { growMs: 50 * 60_000, plantedAt: 1_000_000, plantedBy: "u-ana" };

  it("el peso sale del cuidado (regada y en temporada pesa más) y es siempre el mismo", () => {
    const consentida = { ...base, readyAt: base.plantedAt + base.growMs / 1.4 };
    const olvidada = { ...base, readyAt: base.plantedAt + base.growMs * 4 };
    expect(cuidadoAhuyama(consentida)).toBeCloseTo(1);
    expect(cuidadoAhuyama(olvidada)).toBe(0);
    expect(pesoAhuyama(consentida)).toBe(pesoAhuyama(consentida));
    expect(pesoAhuyama(consentida)).toBeGreaterThan(pesoAhuyama(olvidada) + 400);
    for (const p of [consentida, olvidada]) {
      expect(pesoAhuyama(p)).toBeGreaterThanOrEqual(AHUYAMA.minDag);
      expect(pesoAhuyama(p)).toBeLessThanOrEqual(AHUYAMA.maxDag);
    }
    // La suerte cambia con quien la sembró, sin pasar de 2,5 kg.
    const otra = pesoAhuyama({ ...consentida, plantedBy: "u-beto" });
    expect(Math.abs(otra - pesoAhuyama(consentida))).toBeLessThanOrEqual(250);
  });

  it("el peso va en el id: se lee, se nombra y lo raro no es una ahuyama", () => {
    expect(ahuyamaDagOf(ahuyamaId(742))).toBe(742);
    expect(ahuyamaDagOf(objItemId(ahuyamaId(742)))).toBe(742);
    expect(ahuyamaDagOf("ahuyama")).toBeNull();
    expect(ahuyamaDagOf("ahuyama:99999")).toBeNull();
    expect(ahuyamaDagOf("ahuyama:7x")).toBeNull();
    expect(pesoTexto(742)).toBe("7,42 kg");
    expect(ahuyamaName(742)).toBe("Ahuyama de 7,42 kg");
    expect(bagItemInfo(objItemId(ahuyamaId(742)))).toMatchObject({ name: "Ahuyama de 7,42 kg", kind: "cosecha", max: AHUYAMA.stackMax });
  });

  it("el ranking: la más pesada primero y en un empate la que se pesó antes", () => {
    const e = [
      { userId: "a", name: "Ana", dag: 600, at: 3 },
      { userId: "b", name: "Beto", dag: 900, at: 2 },
      { userId: "c", name: "Caro", dag: 900, at: 1 },
    ];
    expect(rankingAhuyamas(e).map((x) => x.userId)).toEqual(["c", "b", "a"]);
    expect(ganadorAhuyama(e)?.userId).toBe("c");
    expect(ganadorAhuyama([])).toBeNull();
  });
});

describe("la Feria de la cosecha: la tómbola", () => {
  it("cada boleta es una oportunidad y el sorteo fijado da siempre lo mismo", () => {
    const boletas = [
      { userId: "a", name: "Ana", n: 1 },
      { userId: "b", name: "Beto", n: 3 },
      { userId: "c", name: "Caro", n: 0 },
    ];
    expect(sorteoTombola(boletas, () => 0)?.userId).toBe("a");
    expect(sorteoTombola(boletas, () => 1)?.userId).toBe("b");
    expect(sorteoTombola(boletas, () => 3)?.userId).toBe("b");
    expect(sorteoTombola([], () => 0)).toBeNull();
    const pedidos: number[] = [];
    sorteoTombola(boletas, (max) => (pedidos.push(max), 0));
    expect(pedidos).toEqual([4]);
  });
});

describe("la Feria de la cosecha: el festival y sus cinemáticas", () => {
  it("cae el 10 del otoño, con el baile al atardecer", () => {
    const f = festivalById("cosecha")!;
    expect(f.estacion).toBe("otono");
    expect(f.dia).toBe(10);
    expect(f.momentos?.some((m) => m.cine === COSECHA_CINE.baile && m.minuto >= 17 * 60)).toBe(true);
  });

  it("las cinemáticas están en el catálogo y no tienen problemas", () => {
    for (const d of COSECHA_CINEMATICAS) {
      expect(cineById(d.id)).toBe(d);
      expect(cineProblems(d), d.id).toEqual([]);
    }
  });
});
