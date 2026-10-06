import { afterEach, describe, expect, it } from "vitest";
import { COMETA_FORMAS, cometaCode, type CometaFormaLetra } from "@hyvento/shared";
import { arbolCometa, cometaCielo, COMETA_FRAMES, escaleraGaraje, mangaViento } from "./art/cometas";
import { drawHeldItem } from "./art/items";
import { enVoladero, festivalDecorAreas, festivalDecorOf, findPath, getWorld, isBlockedTile, planDef, pointsOfType, setFestivalDecor, VOLADERO, type OfficeMap } from "./index";

afterEach(() => {
  setFestivalDecor(null);
});

const targets = (map: OfficeMap) => [
  ...map.portals.flatMap((p) => p.tiles.map((t) => ({ what: `portal ${p.id}`, ...t }))),
  ...map.points.map((p) => ({ what: `${p.type} ${p.name}`, x: p.tileX, y: p.tileY })),
];
const startOf = (map: OfficeMap) => {
  const spawn = pointsOfType(map, "spawn")[0]!;
  return { x: spawn.tileX, y: spawn.tileY };
};
const opaque = (c: { data: Uint8ClampedArray }) => c.data.filter((_, i) => i % 4 === 3 && c.data[i]! > 0).length;
const same = (a: { data: Uint8ClampedArray }, b: { data: Uint8ClampedArray }) => a.data.length === b.data.length && a.data.every((v, i) => v === b.data[i]);

describe("la decoración del Festival de cometas", () => {
  it("pone todo en la loma (nada se salta) y se apaga sin dejar nada", () => {
    const before = getWorld().areas.get("jardin")!.furniture.length;
    expect(setFestivalDecor("cometas", 5)).toEqual(["jardin"]);
    const jardin = getWorld().areas.get("jardin")!;
    expect(jardin.furniture.length - before).toBe(festivalDecorOf("cometas", planDef("jardin")!, 5)!.furniture.length);
    expect(pointsOfType(jardin, "cometas_taller")).toHaveLength(1);
    expect(pointsOfType(jardin, "cometas_concurso")).toHaveLength(1);
    expect(pointsOfType(jardin, "cometas_techo")).toHaveLength(1);
    expect(pointsOfType(jardin, "festival_shop")).toHaveLength(2);
    setFestivalDecor(null);
    expect(getWorld().areas.get("jardin")!.furniture.length).toBe(before);
  });

  it("no tapa caminos ni puntos: desde la entrada se llega a todo lo de antes y a lo nuevo", () => {
    const plain = new Map(festivalDecorAreas("cometas").map((a) => [a, targets(getWorld().areas.get(a)!).filter((t) => findPath(getWorld().areas.get(a)!, startOf(getWorld().areas.get(a)!), t))]));
    setFestivalDecor("cometas", 0);
    for (const [area, before] of plain) {
      const map = getWorld().areas.get(area)!;
      const from = startOf(map);
      for (const t of before) expect(findPath(map, from, t), `${area}: ${t.what}`).not.toBeNull();
      const nuevos = ["cometas_taller", "cometas_concurso", "cometas_techo", "festival_shop"] as const;
      for (const p of nuevos.flatMap((t) => pointsOfType(map, t))) expect(findPath(map, from, { x: p.tileX, y: p.tileY }), `${area}: ${p.name}`).not.toBeNull();
    }
  });

  it("el voladero es pasto que se camina casi todo, y el mantel del picnic tiene sus tres puestos", () => {
    setFestivalDecor("cometas", 0);
    const map = getWorld().areas.get("jardin")!;
    let free = 0;
    for (let y = VOLADERO.y; y < VOLADERO.y + VOLADERO.h; y++) for (let x = VOLADERO.x; x < VOLADERO.x + VOLADERO.w; x++) if (!isBlockedTile(map, x, y)) free++;
    expect(free / (VOLADERO.w * VOLADERO.h)).toBeGreaterThan(0.8);
    expect(enVoladero(120, 60)).toBe(true);
    expect(enVoladero(60, 60)).toBe(false);
    const mantel = map.furniture.find((f) => f.type === "mantel-picnic")!;
    expect([...map.seats.values()].filter((s) => s.type === "mantel-picnic" && s.tileX >= mantel.x && s.tileX < mantel.x + 3 && s.tileY >= mantel.y && s.tileY < mantel.y + 2)).toHaveLength(3);
  });
});

describe("el dibujo de las cometas", () => {
  const formas = Object.keys(COMETA_FORMAS) as CometaFormaLetra[];

  it("cada forma se ve distinta, en el cielo y en la mano, y los colores cambian el dibujo", () => {
    const cielo = formas.map((f) => cometaCielo(cometaCode({ forma: f, color1: "r", color2: "a", cola: 2 })).canvas);
    const mano = formas.map((f) => drawHeldItem(`cometa:${cometaCode({ forma: f, color1: "r", color2: "a", cola: 2 })}`));
    for (let i = 0; i < formas.length; i++)
      for (let j = i + 1; j < formas.length; j++) {
        expect(same(cielo[i]!, cielo[j]!), `${formas[i]} = ${formas[j]} en el cielo`).toBe(false);
        expect(same(mano[i]!, mano[j]!), `${formas[i]} = ${formas[j]} en la mano`).toBe(false);
      }
    for (const c of mano) {
      expect(c.width).toBeLessThanOrEqual(10);
      expect(c.height).toBeLessThanOrEqual(10);
      expect(opaque(c)).toBeGreaterThan(20);
    }
    expect(same(cometaCielo("rra2").canvas, cometaCielo("rza2").canvas)).toBe(false);
  });

  it("la cola se mece (cada cuadro cambia) y la cola larga es más larga", () => {
    for (let f = 0; f < COMETA_FRAMES; f++) expect(same(cometaCielo("hzb2", f).canvas, cometaCielo("hzb2", (f + 1) % COMETA_FRAMES).canvas)).toBe(false);
    expect(cometaCielo("rra3").canvas.height).toBeGreaterThan(cometaCielo("rra1").canvas.height);
  });

  it("la manga de viento cambia con la fuerza y la dirección, y el árbol y la escalera tienen su versión sin cometa", () => {
    expect(same(mangaViento(0, 0).canvas, mangaViento(0, 2).canvas)).toBe(false);
    expect(same(mangaViento(0, 2).canvas, mangaViento(1, 2).canvas)).toBe(false);
    expect(same(mangaViento(0, 2, 0).canvas, mangaViento(0, 2, 1).canvas)).toBe(false);
    expect(opaque(arbolCometa(true).canvas)).toBeGreaterThan(opaque(arbolCometa(false).canvas));
    expect(opaque(escaleraGaraje(true).canvas)).toBeGreaterThan(opaque(escaleraGaraje(false).canvas));
  });
});
