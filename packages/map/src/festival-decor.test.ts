import { afterEach, describe, expect, it } from "vitest";
import {
  applyFestivalDecor,
  festivalDecorAreas,
  festivalDecorNow,
  festivalDecorOf,
  findPath,
  getWorld,
  isBlockedTile,
  LABERINTO_ENTRADA,
  planDef,
  pointsOfType,
  PUMPKIN_SPOTS,
  pumpkinSpotOf,
  setFestivalDecor,
  type OfficeMap,
} from "./index";

afterEach(() => {
  setFestivalDecor(null);
});

/** Los destinos de un nivel: cada tile de portal y cada punto de interacción. */
const targets = (map: OfficeMap) => [
  ...map.portals.flatMap((p) => p.tiles.map((t) => ({ what: `portal ${p.id}`, ...t }))),
  ...map.points.map((p) => ({ what: `${p.type} ${p.name}`, x: p.tileX, y: p.tileY })),
];

/** Desde dónde se camina: el punto de aparición del jardín o la primera puerta del nivel. */
const startOf = (map: OfficeMap) => {
  const spawn = pointsOfType(map, "spawn")[0];
  return spawn ? { x: spawn.tileX, y: spawn.tileY } : map.portals[0]!.tiles[0]!;
};

/** Los destinos a los que se llega sin decoración: con ella se tiene que seguir llegando a todos. */
function reachable(map: OfficeMap) {
  const from = startOf(map);
  return targets(map).filter((t) => findPath(map, from, t) !== null);
}

describe("la decoración de la Noche de brujas", () => {
  it("decora el jardín, la planta baja y el sótano, y se apaga sin dejar nada", () => {
    const before = getWorld().areas.get("jardin")!.furniture.length;
    expect(setFestivalDecor("brujas", 3).sort()).toEqual(["jardin", "planta-baja", "sotano"]);
    expect(festivalDecorNow()).toEqual({ id: "brujas", day: 3 });
    expect(setFestivalDecor("brujas", 3)).toEqual([]);
    const jardin = getWorld().areas.get("jardin")!;
    expect(jardin.furniture.length).toBeGreaterThan(before + 100);
    expect(pointsOfType(jardin, "festival_shop")).toHaveLength(1);
    expect(pointsOfType(jardin, "golden_pumpkin")).toHaveLength(1);
    expect(getWorld().areas.get("planta-baja")!.furniture.some((f) => f.type === "carved-pumpkin-big")).toBe(true);
    setFestivalDecor(null);
    expect(festivalDecorNow()).toBeNull();
    expect(getWorld().areas.get("jardin")!.furniture.length).toBe(before);
    expect(pointsOfType(getWorld().areas.get("jardin")!, "golden_pumpkin")).toHaveLength(0);
    // Un festival sin decoración no cambia nada.
    expect(setFestivalDecor("carnaval", 3)).toEqual([]);
  });

  it("no tapa ningún portal ni punto: desde la entrada se llega a todo lo que se llegaba", () => {
    const plain = new Map(festivalDecorAreas("brujas").map((a) => [a, reachable(getWorld().areas.get(a)!)]));
    for (const day of [0, 1, 7]) {
      setFestivalDecor("brujas", day);
      for (const [area, before] of plain) {
        const map = getWorld().areas.get(area)!;
        const from = startOf(map);
        for (const t of before) expect(findPath(map, from, t), `${area} día ${day}: ${t.what} (${t.x}, ${t.y})`).not.toBeNull();
        // Y a lo nuevo del festival (el puesto y la calabaza dorada).
        for (const p of [...pointsOfType(map, "festival_shop"), ...pointsOfType(map, "golden_pumpkin")])
          expect(findPath(map, from, { x: p.tileX, y: p.tileY }), `${area} día ${day}: ${p.type}`).not.toBeNull();
      }
    }
  });

  it("el laberinto queda entero (ninguna pared se salta) y cada rincón de la calabaza se alcanza desde el arco", () => {
    const def = planDef("jardin")!;
    const decor = festivalDecorOf("brujas", def, 0)!;
    const applied = applyFestivalDecor(def, decor);
    const corn = (fs: readonly { type: string }[]) => fs.filter((f) => f.type.startsWith("corn-maze-") || f.type === "maze-arch").length;
    expect(corn(applied.furniture) - corn(def.furniture)).toBe(corn(decor.furniture));
    expect(PUMPKIN_SPOTS.length).toBeGreaterThanOrEqual(4);
    setFestivalDecor("brujas", 0);
    const map = getWorld().areas.get("jardin")!;
    for (const s of PUMPKIN_SPOTS) {
      expect(findPath(map, LABERINTO_ENTRADA, s.point), `${s.point.x},${s.point.y}`).not.toBeNull();
      // El rincón es un callejón: la calabaza (sólida) no corta el paso a nada.
      expect(Math.abs(s.point.x - s.pumpkin.x) + Math.abs(s.point.y - s.pumpkin.y)).toBe(1);
    }
    const today = pumpkinSpotOf(0).pumpkin;
    expect(isBlockedTile(map, today.x, today.y)).toBe(true);
  });

  it("la calabaza cambia de rincón según el día, igual para todos", () => {
    expect(pumpkinSpotOf(5)).toEqual(pumpkinSpotOf(5));
    const spots = new Set(Array.from({ length: 30 }, (_, d) => `${pumpkinSpotOf(d).pumpkin.x},${pumpkinSpotOf(d).pumpkin.y}`));
    expect(spots.size).toBeGreaterThan(2);
  });

  it("lo que cae encima de un mueble, un portal o un punto no se pone", () => {
    const def = planDef("jardin")!;
    const f = def.furniture.find((p) => p.type === "mailbox")!;
    const point = def.points[0]!;
    const out = applyFestivalDecor(def, {
      furniture: [
        { type: "carved-pumpkin", x: f.x, y: f.y },
        { type: "carved-pumpkin", x: point.x, y: point.y },
        // Fuera de lo jugable (el bosque del margen).
        { type: "carved-pumpkin", x: 0, y: 0 },
      ],
    });
    expect(out.furniture.length).toBe(def.furniture.length);
  });
});
