// La gente de la fiesta en los niveles (gente-fiesta.ts): la simulación es determinista, nadie se queda
// parado sobre un mueble, un portal, un punto o un NPC fijo, nadie atraviesa nada al caminar (cada paso es un
// tile libre) y las rondas y paseos tienen recorrido. Con la decoración de cada festival puesta.
import {
  DIAS_POR_ESTACION,
  FESTIVAL_HORAS,
  festivalById,
  genteDelFestival,
  GENTE_FIESTA,
  SEASONS,
  type FestivalId,
  type Weather,
} from "@hyvento/shared";
import { afterEach, describe, expect, it } from "vitest";
import { genteDelNivel, GenteNivel, getWorld, isBlockedTile, pointsOfType, setFestivalDecor, type OfficeMap } from "./index";

afterEach(() => {
  setFestivalDecor(null);
});

const FESTIVALES = Object.keys(GENTE_FIESTA) as FestivalId[];

/** El día del juego en que cae el festival (año 1). */
function dayOf(id: FestivalId): number {
  const f = festivalById(id)!;
  return SEASONS.indexOf(f.estacion) * DIAS_POR_ESTACION + (f.dia - 1);
}

/** Los niveles con gente de ese festival, ya decorados. */
function niveles(id: FestivalId, clima: Weather = "despejado"): GenteNivel[] {
  const day = dayOf(id);
  setFestivalDecor(id, day);
  const areas = [...new Set(genteDelFestival(id, 1, clima).map((n) => n.area))];
  return areas.map((a) => genteDelNivel(getWorld().areas.get(a)!, id, day, clima)!).filter(Boolean);
}

const tileOf = (map: OfficeMap, p: { x: number; y: number }) => ({ x: Math.floor(p.x / map.tileSize), y: Math.floor(p.y / map.tileSize) });

/** Lo que no se tapa en un nivel. */
function reserved(map: OfficeMap): Set<string> {
  const out = new Set<string>();
  for (const p of map.portals) for (const t of p.tiles) out.add(`${t.x},${t.y}`);
  for (const p of map.points) out.add(`${p.tileX},${p.tileY}`);
  for (const t of map.def.npcTiles ?? []) out.add(`${t.x},${t.y}`);
  return out;
}

const MINUTOS: number[] = [];
for (let m = FESTIVAL_HORAS.apertura * 60; m < FESTIVAL_HORAS.cierre * 60; m += 0.71) MINUTOS.push(m);

describe("la gente de la fiesta en los niveles", () => {
  it.each(FESTIVALES)("%s: cada uno tiene su sitio libre y camina por tiles libres", (id) => {
    for (const nivel of niveles(id)) {
      const map = nivel.map;
      const res = reserved(map);
      for (const npc of nivel.npcs) {
        for (const s of nivel.stops(npc.id)) {
          if (s.asiento) continue;
          const t = tileOf(map, s);
          expect(isBlockedTile(map, t.x, t.y), `${npc.id} parado en ${t.x},${t.y}`).toBe(false);
          expect(res.has(`${t.x},${t.y}`), `${npc.id} tapa un portal o punto en ${t.x},${t.y}`).toBe(false);
        }
        for (const w of nivel.walks(npc.id))
          for (const p of w) {
            const t = tileOf(map, p);
            expect(isBlockedTile(map, t.x, t.y), `${npc.id} camina por ${t.x},${t.y}`).toBe(false);
          }
      }
    }
  });

  it.each(FESTIVALES)("%s: en todo el día nadie pisa algo bloqueado ni salta de un lado a otro", (id) => {
    for (const nivel of niveles(id)) {
      const map = nivel.map;
      for (const npc of nivel.npcs) {
        let prev: { x: number; y: number } | null = null;
        for (const m of MINUTOS) {
          const p = nivel.pose(npc.id, m);
          if (!p.visible) {
            prev = null;
            continue;
          }
          if (!p.asiento) {
            const t = tileOf(map, p);
            expect(isBlockedTile(map, t.x, t.y), `${npc.id} a las ${m.toFixed(1)} en ${t.x},${t.y}`).toBe(false);
            if (prev) expect(Math.hypot(p.x - prev.x, p.y - prev.y), `${npc.id} salta a las ${m.toFixed(1)}`).toBeLessThan(map.tileSize * 6);
          }
          prev = p.asiento ? null : p;
        }
      }
    }
  });

  it.each(FESTIVALES)("%s: las rondas y los paseos tienen recorrido, y los sentados, su asiento", (id) => {
    for (const nivel of niveles(id))
      for (const npc of nivel.npcs) {
        const tipo = npc.comportamiento.tipo;
        if (tipo === "ronda" || tipo === "deambula") expect(nivel.loops(npc.id), `${npc.id} sin recorrido`).toBe(true);
        if (tipo === "sentado") expect(nivel.stops(npc.id).some((s) => s.asiento), `${npc.id} sin asiento`).toBe(true);
      }
  });

  it.each(FESTIVALES)("%s: la simulación es determinista (dos armadas dan lo mismo)", (id) => {
    const day = dayOf(id);
    for (const a of niveles(id)) {
      const b = new GenteNivel(a.map, genteDelFestival(id, 1, "despejado"), day);
      for (const npc of a.npcs) for (const m of [600, 731.3, 900.9, 1100.25]) expect(b.pose(npc.id, m)).toEqual(a.pose(npc.id, m));
    }
  });

  it.each(FESTIVALES)("%s: entre 8 y 15 en el jardín (el Carnaval, con el público del desfile, hasta 36), y los vendedores junto a su puesto", (id) => {
    const nivel = niveles(id).find((n) => n.map.id === "jardin")!;
    expect(nivel.npcs.length).toBeGreaterThanOrEqual(8);
    expect(nivel.npcs.length).toBeLessThanOrEqual(id === "carnaval" ? 36 : 15);
    const puestos = [...pointsOfType(nivel.map, "festival_shop"), ...pointsOfType(nivel.map, "feria_shop"), ...pointsOfType(nivel.map, "cosecha_puesto")];
    for (const npc of nivel.npcs.filter((n) => n.accion?.tipo === "puesto" && n.comportamiento.tipo === "quieto")) {
      const p = nivel.pose(npc.id, 600);
      expect(puestos.some((q) => Math.hypot(q.x - p.x, q.y - p.y) <= 3 * nivel.map.tileSize), `${npc.id} lejos del puesto`).toBe(true);
    }
  });

  it("con lluvia salen menos y los que se quedan afuera buscan techo, sin pararse donde no se puede", () => {
    const seco = niveles("brujas").find((n) => n.map.id === "jardin")!;
    const mojado = niveles("brujas", "lluvia").find((n) => n.map.id === "jardin")!;
    expect(mojado.npcs.length).toBeLessThan(seco.npcs.length);
    const res = reserved(mojado.map);
    for (const npc of mojado.npcs.filter((n) => n.refugio)) {
      const p = mojado.pose(npc.id, 700);
      const t = tileOf(mojado.map, p);
      expect(p.camina).toBe(false);
      expect(isBlockedTile(mojado.map, t.x, t.y)).toBe(false);
      expect(res.has(`${t.x},${t.y}`)).toBe(false);
    }
  });

  it("los que siguen a otro van detrás por su camino; fuera del horario nadie está", () => {
    const nivel = niveles("brujas").find((n) => n.map.id === "jardin")!;
    const mariana = nivel.pose("brujas:mariana", 700);
    const canelo = nivel.pose("brujas:canelo", 700);
    expect(Math.hypot(mariana.x - canelo.x, mariana.y - canelo.y)).toBeLessThan(nivel.map.tileSize * 3);
    expect(nivel.pose("brujas:mariana", 8 * 60).visible).toBe(false);
    expect(nivel.pose("brujas:canelo", 23 * 60).visible).toBe(false);
  });

  it("la cercanía para hablar se mide con la misma pose", () => {
    const nivel = niveles("brujas").find((n) => n.map.id === "jardin")!;
    const p = nivel.pose("brujas:rubiela", 700);
    expect(nivel.near("brujas:rubiela", 700, p.x + 20, p.y, 1.8)).toBe(true);
    expect(nivel.near("brujas:rubiela", 700, p.x + 200, p.y, 1.8)).toBe(false);
    expect(nivel.near("brujas:nadie", 700, p.x, p.y, 1.8)).toBe(false);
  });

  it("los de la novena llegan por la puerta del recibidor y se sientan a las 20:00", () => {
    const nivel = niveles("novenas").find((n) => n.map.id === "planta-baja")!;
    expect(nivel.pose("novenas:marina", 18 * 60).visible).toBe(false);
    expect(nivel.pose("novenas:marina", 20 * 60).asiento).not.toBeNull();
    const llegando = nivel.pose("novenas:aurelio", 19 * 60 + 36);
    expect(llegando.visible && llegando.camina).toBe(true);
  });
});
