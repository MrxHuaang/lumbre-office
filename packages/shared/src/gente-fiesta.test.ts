import { describe, expect, it } from "vitest";
import { BAG_OBJECTS } from "./bolsa";
import { festivalById, FESTIVAL_HORAS, type FestivalId } from "./festivales";
import {
  charlaDe,
  conClima,
  corrilloDe,
  diaDelFestival,
  ENTREGAR_ERROR_TEXT,
  EntregarMessage,
  frasesDeAhora,
  genteDelFestival,
  GENTE_FIESTA,
  GENTE_REGLAS,
  horarioDe,
  murmulloDe,
  pedidosDe,
  pedidoStatKey,
  VECINOS,
  type FiestaNpc,
} from "./gente-fiesta";
import { VECINO_IDS } from "./gente-fiesta/vecinos";
import { Look } from "./look";

const FESTIVALES = Object.keys(GENTE_FIESTA) as FestivalId[];
const todos = (id: FestivalId, dia = 1): FiestaNpc[] => GENTE_FIESTA[id]!(dia, "despejado");

describe("la gente de la fiesta: los datos", () => {
  it.each(FESTIVALES)("%s: ids únicos, pintas válidas y murmullos cortitos", (id) => {
    const npcs = todos(id);
    expect(new Set(npcs.map((n) => n.id)).size).toBe(npcs.length);
    for (const n of npcs) {
      expect(n.id.startsWith(`${id}:`), n.id).toBe(true);
      expect(Look.safeParse(n.look).success, `${n.id}: pinta`).toBe(true);
      expect(n.frases.hola.length, `${n.id}: sin saludo`).toBeGreaterThan(0);
      for (const m of n.murmullos) expect(m.length, `${n.id}: «${m}»`).toBeLessThanOrEqual(GENTE_REGLAS.murmulloMax);
      if (n.comportamiento.tipo === "sigue") expect(npcs.some((o) => o.id === (n.comportamiento as { a: string }).a), `${n.id} sigue a nadie`).toBe(true);
    }
  });

  it.each(FESTIVALES)("%s: uno o dos pedidos (el Carnaval, tres), con objetos que existen", (id) => {
    const pedidos = pedidosDe(todos(id));
    expect(pedidos.length).toBeGreaterThanOrEqual(1);
    expect(pedidos.length).toBeLessThanOrEqual(id === "carnaval" ? 3 : 2);
    expect(new Set(pedidos.map((p) => p.pedido.id)).size).toBe(pedidos.length);
    let puntos = 0;
    for (const { pedido } of pedidos) {
      for (const p of pedido.pide) expect(BAG_OBJECTS[p.item], `${pedido.id} pide ${p.item}`).toBeDefined();
      if (pedido.da.item) expect(BAG_OBJECTS[pedido.da.item], `${pedido.id} da ${pedido.da.item}`).toBeDefined();
      expect(Boolean(pedido.da.item) || (pedido.da.puntos ?? 0) > 0).toBe(true);
      puntos += pedido.da.puntos ?? 0;
    }
    // Los puntos de los pedidos caben en el tope del festival.
    expect(puntos).toBeLessThanOrEqual(GENTE_REGLAS.topePuntos);
  });

  it("los vecinos de la vereda: una docena, y ningún festival les cambia la piel", () => {
    expect(VECINO_IDS.length).toBeGreaterThanOrEqual(12);
    for (const v of Object.values(VECINOS)) expect(v.frase.length).toBeGreaterThan(0);
    for (const id of FESTIVALES)
      for (const n of todos(id)) if (n.vecino && !n.animal) expect(n.look.skin, `${n.id}`).toBe(VECINOS[n.vecino].look.skin);
  });

  it("cada festival con gente tiene vendedores que abren el puesto (salvo las novenas, que no tienen puesto)", () => {
    for (const id of ["brujas", "carnaval", "feria-flores"] as const) expect(todos(id).some((n) => n.accion?.tipo === "puesto"), id).toBe(true);
  });

  it("con lluvia: los que se van, se van; los demás buscan techo; los que siguen corren la suerte de su guía", () => {
    const npcs = todos("brujas");
    const mojado = conClima(npcs, "lluvia");
    expect(mojado.length).toBeLessThan(npcs.length);
    expect(conClima(npcs, "nublado")).toEqual(npcs);
    for (const n of mojado) {
      const orig = npcs.find((o) => o.id === n.id)!;
      if ((orig.lluvia ?? "techo") === "sigue") expect(n).toEqual(orig);
      else expect(n.refugio && n.comportamiento.tipo === "quieto").toBe(true);
    }
    const mariana = mojado.some((n) => n.id === "brujas:mariana");
    expect(mojado.some((n) => n.id === "brujas:canelo")).toBe(mariana);
    expect(genteDelFestival("brujas", 1, "tormenta").length).toBe(conClima(npcs, "tormenta").length);
    expect(genteDelFestival("ano-viejo", 1, "despejado")).toEqual([]);
  });

  it("lo que dicen cambia con la hora, el clima y el día, y todos ven lo mismo con la misma semilla", () => {
    const rubiela = todos("novenas").find((n) => n.id === "novenas:rubiela")!;
    expect(frasesDeAhora(rubiela, { minuto: 600, clima: "despejado", dia: 9 }).some((l) => l.includes("Último día"))).toBe(true);
    expect(frasesDeAhora(rubiela, { minuto: 600, clima: "despejado", dia: 3 }).some((l) => l.includes("Último día"))).toBe(false);
    const ctx = { minuto: 700, clima: "despejado" as const, dia: 1 };
    expect(charlaDe(rubiela, ctx, 42)).toEqual(charlaDe(rubiela, ctx, 42));
    expect(charlaDe(rubiela, ctx, 42).length).toBeGreaterThanOrEqual(1);
    expect(murmulloDe(rubiela, 3)).toBe(murmulloDe(rubiela, 3));
    const fogata = todos("brujas").filter((n) => corrilloDe(n) === "fogata");
    expect(fogata.length).toBe(4);
  });

  it("el día del festival, el mensaje de entrega y la marca en UserStat", () => {
    const novenas = festivalById("novenas")!;
    expect(diaDelFestival(novenas, 12)).toBe(1);
    expect(diaDelFestival(novenas, 20)).toBe(9);
    expect(diaDelFestival(novenas, 3)).toBe(1);
    expect(EntregarMessage.safeParse({ npc: "brujas:efrain", pedido: "mazorcas-efrain" }).success).toBe(true);
    expect(EntregarMessage.safeParse({ npc: "" }).success).toBe(false);
    expect(pedidoStatKey("brujas", 2, "x")).toBe("festival:brujas:2:pedido:x");
    expect(Object.keys(ENTREGAR_ERROR_TEXT).length).toBeGreaterThan(5);
  });

  it.each(FESTIVALES)("%s: nadie se queda después del cierre del festival", (id) => {
    const cierre = (festivalById(id)!.cierre ?? FESTIVAL_HORAS.cierre) * 60;
    for (const clima of ["despejado", "lluvia"] as const)
      for (const n of genteDelFestival(id, 1, clima)) {
        expect(n.horario, n.id).toBeDefined();
        expect(n.horario!.hasta, n.id).toBeLessThanOrEqual(cierre);
        expect(n.horario!.desde, n.id).toBeLessThanOrEqual(n.horario!.hasta);
      }
  });

  it("el Carnaval cierra a las 18:30 y su gente se va con él; sin horario, va de la apertura al cierre", () => {
    const carnaval = festivalById("carnaval")!;
    expect(carnaval.cierre).toBe(18.5);
    const sinHorario = { ...todos("carnaval")[0]!, horario: undefined };
    expect(horarioDe(sinHorario, carnaval)).toEqual({ desde: 9 * 60, hasta: 18 * 60 + 30 });
    expect(horarioDe(sinHorario)).toEqual({ desde: 9 * 60, hasta: 22 * 60 });
    expect(horarioDe({ ...sinHorario, horario: { desde: 600, hasta: 1300 } }, carnaval)).toEqual({ desde: 600, hasta: 18 * 60 + 30 });
    expect(Math.max(...genteDelFestival("carnaval", 1, "despejado").map((n) => n.horario!.hasta))).toBe(18 * 60 + 30);
  });
});
