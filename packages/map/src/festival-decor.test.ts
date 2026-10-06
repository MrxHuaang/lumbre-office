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
  SILLETA_STANDS,
  standOfPoint,
  type OfficeMap,
} from "./index";
import { silletaOnStand } from "./art/feria-flores";
import { drawFurniture } from "./art/furniture";

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

describe("la decoración de la Feria de las flores", () => {
  it("pone la plaza en el jardín (exhibidores, mesa del silletero, puesto) y flores en el recibidor; se apaga sin dejar nada", () => {
    const before = getWorld().areas.get("jardin")!.furniture.length;
    expect(setFestivalDecor("feria-flores", 5).sort()).toEqual(["jardin", "planta-baja"]);
    const jardin = getWorld().areas.get("jardin")!;
    // Todo lo de la decoración entra (nada se salta por caer encima de otra cosa).
    expect(jardin.furniture.length - before).toBe(festivalDecorOf("feria-flores", planDef("jardin")!, 5)!.furniture.length);
    expect(pointsOfType(jardin, "silleta_stand")).toHaveLength(SILLETA_STANDS.length);
    expect(pointsOfType(jardin, "silletero_table")).toHaveLength(1);
    expect(pointsOfType(jardin, "feria_shop")).toHaveLength(1);
    // Cada punto de exhibidor tiene su exhibidor justo al norte.
    for (const p of pointsOfType(jardin, "silleta_stand")) {
      const s = standOfPoint(p);
      expect(jardin.furniture.some((f) => f.type === "silleta-stand" && f.x === s.x && f.y === s.y), `${s.x},${s.y}`).toBe(true);
    }
    expect(getWorld().areas.get("planta-baja")!.furniture.some((f) => f.type === "flower-bucket")).toBe(true);
    setFestivalDecor(null);
    expect(getWorld().areas.get("jardin")!.furniture.length).toBe(before);
    expect(pointsOfType(getWorld().areas.get("jardin")!, "silleta_stand")).toHaveLength(0);
  });

  it("no tapa ningún portal ni punto: desde la entrada se llega a todo y a lo nuevo de la feria", () => {
    const plain = new Map(festivalDecorAreas("feria-flores").map((a) => [a, reachable(getWorld().areas.get(a)!)]));
    setFestivalDecor("feria-flores", 0);
    for (const [area, before] of plain) {
      const map = getWorld().areas.get(area)!;
      const from = startOf(map);
      for (const t of before) expect(findPath(map, from, t), `${area}: ${t.what} (${t.x}, ${t.y})`).not.toBeNull();
      for (const p of [...pointsOfType(map, "silleta_stand"), ...pointsOfType(map, "silletero_table"), ...pointsOfType(map, "feria_shop")])
        expect(findPath(map, from, { x: p.tileX, y: p.tileY }), `${area}: ${p.type} ${p.name}`).not.toBeNull();
    }
  });

  it("por debajo de los arcos de flores se sigue caminando el camino de piedra", () => {
    setFestivalDecor("feria-flores", 0);
    const map = getWorld().areas.get("jardin")!;
    for (const f of map.furniture.filter((f) => f.type === "flower-arch")) {
      for (const x of [f.x + 1, f.x + 2, f.x + 3]) expect(isBlockedTile(map, x, f.y), `${x},${f.y}`).toBe(false);
      expect(isBlockedTile(map, f.x, f.y)).toBe(true);
      expect(isBlockedTile(map, f.x + 4, f.y)).toBe(true);
    }
  });

  it("la silleta del exhibidor calza encima del exhibidor (mismo origen) y cambia con su código", () => {
    const base = drawFurniture("silleta-stand", "front");
    const a = silletaOnStand("cccccccccccc");
    const b = silletaOnStand("hhhhhhhhhhhh");
    // Puesta con el mismo ancla que el mueble, tapa todo el exhibidor vacío (la tarima y los parales).
    let covered = 0;
    let total = 0;
    for (let y = 0; y < base.canvas.height; y++)
      for (let x = 0; x < base.canvas.width; x++) {
        if (base.canvas.data[(y * base.canvas.width + x) * 4 + 3] !== 255) continue;
        total++;
        const lx = x - base.ox + a.ox;
        const ly = y - base.oy + a.oy;
        if (lx >= 0 && ly >= 0 && lx < a.canvas.width && ly < a.canvas.height && a.canvas.data[(ly * a.canvas.width + lx) * 4 + 3]) covered++;
      }
    expect(covered / total).toBeGreaterThan(0.97);
    expect(a.canvas.data.some((v, i) => v !== b.canvas.data[i])).toBe(true);
  });
});
