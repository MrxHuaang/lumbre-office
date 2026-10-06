// La decoración de la Feria de la cosecha (world/festivales/cosecha.ts) y su arte: entra entera, no tapa
// caminos ni puntos, cada puesto tiene su punto delante y sus dibujos existen (también la mula y las
// ahuyamas pesadas en la mano).
import { COSECHA_PUESTOS, COSECHA_SITIOS, ahuyamaId, puestoPunto } from "@hyvento/shared";
import { afterEach, describe, expect, it } from "vitest";
import { drawMula } from "./art/cosecha";
import { drawFurniture, hasDrawing } from "./art/furniture";
import { cropSprite, bedCropSprite } from "./art/huerto";
import { drawHeldItem } from "./art/items";
import { COSECHA_CATALOG } from "./world/catalog-cosecha";
import { festivalDecorAreas, festivalDecorOf, findPath, getWorld, isBlockedTile, planDef, pointsOfType, puestoDePunto, setFestivalDecor, type OfficeMap } from "./index";

afterEach(() => {
  setFestivalDecor(null);
});

const opaque = (c: { data: Uint8ClampedArray }) => {
  let n = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i]) n++;
  return n;
};

const targets = (map: OfficeMap) => [
  ...map.portals.flatMap((p) => p.tiles.map((t) => ({ what: `portal ${p.id}`, ...t }))),
  ...map.points.map((p) => ({ what: `${p.type} ${p.name}`, x: p.tileX, y: p.tileY })),
];
const startOf = (map: OfficeMap) => {
  const spawn = pointsOfType(map, "spawn")[0];
  return spawn ? { x: spawn.tileX, y: spawn.tileY } : map.portals[0]!.tiles[0]!;
};

describe("la decoración de la Feria de la cosecha", () => {
  it("pone el mercado, la olla, el concurso y la tómbola en el jardín y canastos en el recibidor; se apaga sin dejar nada", () => {
    const before = getWorld().areas.get("jardin")!.furniture.length;
    expect(setFestivalDecor("cosecha", 30).sort()).toEqual(["jardin", "planta-baja"]);
    const jardin = getWorld().areas.get("jardin")!;
    // Todo entra (nada se salta por caer encima de otra cosa).
    expect(jardin.furniture.length - before).toBe(festivalDecorOf("cosecha", planDef("jardin")!, 30)!.furniture.length);
    expect(pointsOfType(jardin, "cosecha_puesto")).toHaveLength(COSECHA_PUESTOS.length);
    for (const t of ["cosecha_olla", "cosecha_bascula", "cosecha_tablero", "cosecha_tombola"] as const) expect(pointsOfType(jardin, t), t).toHaveLength(1);
    // Cada punto de puesto tiene su puesto justo al norte y se sabe de cuál es.
    for (const p of pointsOfType(jardin, "cosecha_puesto")) {
      const id = puestoDePunto(p);
      const puesto = COSECHA_PUESTOS.find((q) => q.id === id)!;
      expect(puestoPunto(puesto)).toEqual({ x: p.tileX, y: p.tileY });
      expect(jardin.furniture.some((f) => f.type.startsWith("puesto-cosecha-") && f.x === puesto.tile.x && f.y === puesto.tile.y), id!).toBe(true);
    }
    const o = COSECHA_SITIOS.olla;
    expect(jardin.furniture.some((f) => f.type === "olla-sancocho" && f.x === o.x && f.y === o.y)).toBe(true);
    expect(getWorld().areas.get("planta-baja")!.furniture.some((f) => f.type === "canasto-lleno")).toBe(true);
    setFestivalDecor(null);
    expect(getWorld().areas.get("jardin")!.furniture.length).toBe(before);
    expect(pointsOfType(getWorld().areas.get("jardin")!, "cosecha_puesto")).toHaveLength(0);
  });

  it("no tapa ningún portal ni punto: desde la entrada se llega a todo y a lo nuevo de la feria", () => {
    const plain = new Map(festivalDecorAreas("cosecha").map((a) => [a, targets(getWorld().areas.get(a)!).filter((t) => findPath(getWorld().areas.get(a)!, startOf(getWorld().areas.get(a)!), t) !== null)]));
    setFestivalDecor("cosecha", 30);
    for (const [area, before] of plain) {
      const map = getWorld().areas.get(area)!;
      const from = startOf(map);
      for (const t of before) expect(findPath(map, from, t), `${area}: ${t.what} (${t.x}, ${t.y})`).not.toBeNull();
      for (const p of map.points.filter((p) => p.type.startsWith("cosecha_"))) expect(findPath(map, from, { x: p.tileX, y: p.tileY }), `${area}: ${p.type} ${p.name}`).not.toBeNull();
    }
  });

  it("por debajo de los arcos de mazorcas se sigue caminando el camino de piedra", () => {
    setFestivalDecor("cosecha", 30);
    const map = getWorld().areas.get("jardin")!;
    const arcos = map.furniture.filter((f) => f.type === "arco-mazorcas");
    expect(arcos.length).toBe(2);
    for (const f of arcos) {
      for (const x of [f.x + 1, f.x + 2, f.x + 3]) expect(isBlockedTile(map, x, f.y), `${x},${f.y}`).toBe(false);
      expect(isBlockedTile(map, f.x, f.y)).toBe(true);
    }
  });
});

describe("el arte de la Feria de la cosecha", () => {
  it("cada mueble tiene su dibujo; la olla cambia de noche", () => {
    for (const type of Object.keys(COSECHA_CATALOG)) {
      expect(hasDrawing(type), type).toBe(true);
      expect(opaque(drawFurniture(type, "front").canvas), type).toBeGreaterThan(80);
    }
    const dia = drawFurniture("olla-sancocho", "front", false).canvas;
    const noche = drawFurniture("olla-sancocho", "front", true).canvas;
    expect(dia.data.some((v, i) => v !== noche.data[i])).toBe(true);
    // Los cinco toldos son distintos.
    const toldos = Object.keys(COSECHA_CATALOG).filter((t) => t.startsWith("puesto-cosecha-")).map((t) => Array.from(drawFurniture(t, "front").canvas.data).join(","));
    expect(new Set(toldos).size).toBe(5);
  });

  it("lo nuevo del huerto crece en cuatro etapas distintas", () => {
    for (const crop of ["cebolla", "yuca", "ahuyama", "frijol", "arracacha"]) {
      const listo = cropSprite(crop, 3).canvas;
      const creciendo = cropSprite(crop, 2).canvas;
      expect(listo.data.some((v, i) => v !== creciendo.data[i]), crop).toBe(true);
    }
    expect(opaque(bedCropSprite("platano", 3).canvas)).toBeGreaterThan(opaque(bedCropSprite("platano", 1).canvas));
  });

  it("la ahuyama pesada se dibuja más grande cuanto más pesa y cabe en la mano", () => {
    const chica = drawHeldItem(ahuyamaId(300));
    const grande = drawHeldItem(ahuyamaId(1100));
    for (const c of [chica, grande]) {
      expect(c.width).toBeLessThanOrEqual(10);
      expect(c.height).toBeLessThanOrEqual(10);
    }
    expect(opaque(grande)).toBeGreaterThan(opaque(chica));
    expect(drawHeldItem("ahuyama:5").width).toBe(1);
  });

  it("la mula camina (dos cuadros distintos) y se ve de frente y de espaldas", () => {
    const a = drawMula("side", 0);
    const b = drawMula("side", 1);
    expect(a.data.some((v, i) => v !== b.data[i])).toBe(true);
    for (const v of ["side", "front", "back"] as const) expect(opaque(drawMula(v)), v).toBeGreaterThan(100);
  });
});
