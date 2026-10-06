// La decoración del Año viejo (world/festivales/ano-viejo.ts): entra entera, no tapa portales, puntos ni
// caminos, la vuelta de la maleta se puede caminar entera y cada parada tiene su letrerito.
import { ANO_VIEJO_PLAZA, MALETA_RUTA } from "@hyvento/shared";
import { afterEach, describe, expect, it } from "vitest";
import { fuegoBrasero, munecoEnSilla, MUNECO_ETAPAS } from "./art/ano-viejo";
import { drawFurniture } from "./art/furniture";
import { festivalDecorAreas, festivalDecorOf, findPath, getWorld, isBlockedTile, planDef, pointsOfType, setFestivalDecor, type OfficeMap } from "./index";

afterEach(() => {
  setFestivalDecor(null);
});

const targets = (map: OfficeMap) => [
  ...map.portals.flatMap((p) => p.tiles.map((t) => ({ what: `portal ${p.id}`, ...t }))),
  ...map.points.map((p) => ({ what: `${p.type} ${p.name}`, x: p.tileX, y: p.tileY })),
];
const startOf = (map: OfficeMap) => {
  const spawn = pointsOfType(map, "spawn")[0];
  return spawn ? { x: spawn.tileX, y: spawn.tileY } : map.portals[0]!.tiles[0]!;
};

describe("la decoración del Año viejo", () => {
  it("pone la plaza en el jardín y el costal en el taller, entera, y se apaga sin dejar nada", () => {
    const before = getWorld().areas.get("jardin")!.furniture.length;
    expect(setFestivalDecor("ano-viejo", 83).sort()).toEqual(["garaje", "jardin"]);
    const jardin = getWorld().areas.get("jardin")!;
    expect(jardin.furniture.length - before).toBe(festivalDecorOf("ano-viejo", planDef("jardin")!, 83)!.furniture.length);
    for (const type of ["brasero-piedra", "silla-muneco", "cartel-testamentos", "puesto-uvas"]) expect(jardin.furniture.some((f) => f.type === type), type).toBe(true);
    const silla = jardin.furniture.find((f) => f.type === "silla-muneco")!;
    expect({ x: silla.x, y: silla.y }).toEqual(ANO_VIEJO_PLAZA.silla);
    expect(pointsOfType(jardin, "ano_viejo_muneco")).toHaveLength(1);
    expect(pointsOfType(jardin, "ano_viejo_cartel")).toHaveLength(1);
    expect(pointsOfType(jardin, "festival_shop")).toHaveLength(1);
    expect(pointsOfType(jardin, "ano_viejo_relleno")).toHaveLength(1);
    expect(pointsOfType(getWorld().areas.get("garaje")!, "ano_viejo_relleno")).toHaveLength(1);
    // Cada parada de la maleta tiene su letrerito al lado.
    const letreros = jardin.furniture.filter((f) => f.type === "parada-maleta");
    expect(letreros).toHaveLength(MALETA_RUTA.length);
    for (const p of MALETA_RUTA) expect(letreros.some((l) => Math.abs(l.x - p.x) <= 2 && Math.abs(l.y - p.y) <= 2), `${p.x},${p.y}`).toBe(true);
    setFestivalDecor(null);
    expect(getWorld().areas.get("jardin")!.furniture.length).toBe(before);
  });

  it("no tapa portales, puntos ni caminos, y la vuelta de la maleta se camina de parada en parada", () => {
    const plain = new Map(
      festivalDecorAreas("ano-viejo").map((a) => {
        const map = getWorld().areas.get(a)!;
        return [a, targets(map).filter((t) => findPath(map, startOf(map), t) !== null)] as const;
      }),
    );
    setFestivalDecor("ano-viejo", 83);
    for (const [area, before] of plain) {
      const map = getWorld().areas.get(area)!;
      const from = startOf(map);
      for (const t of before) expect(findPath(map, from, t), `${area}: ${t.what}`).not.toBeNull();
      for (const p of map.points.filter((q) => q.type.startsWith("ano_viejo") || q.type === "festival_shop"))
        expect(findPath(map, from, { x: p.tileX, y: p.tileY }), `${area}: ${p.name}`).not.toBeNull();
    }
    const jardin = getWorld().areas.get("jardin")!;
    MALETA_RUTA.forEach((p, i) => {
      expect(isBlockedTile(jardin, p.x, p.y), `parada ${i}`).toBe(false);
      const next = MALETA_RUTA[(i + 1) % MALETA_RUTA.length]!;
      expect(findPath(jardin, p, next), `de la parada ${i} a la siguiente`).not.toBeNull();
    });
  });

  it("el muñeco cambia con cada etapa y calza encima de la silla; el fuego se mueve", () => {
    const silla = drawFurniture("silla-muneco", "front", false);
    const etapas = Array.from({ length: MUNECO_ETAPAS }, (_, e) => munecoEnSilla(e));
    // El origen de cada dibujo es el del tile de la silla: puesto en el mismo ancla, cae encima.
    for (const s of etapas) expect(s.canvas.width).toBeGreaterThanOrEqual(silla.canvas.width - 2);
    const firma = (s: { canvas: { data: Uint8ClampedArray } }) => Array.from(s.canvas.data).join(",");
    expect(new Set(etapas.map(firma)).size).toBe(MUNECO_ETAPAS);
    expect(firma(fuegoBrasero(0, true))).not.toBe(firma(fuegoBrasero(1, true)));
  });
});
