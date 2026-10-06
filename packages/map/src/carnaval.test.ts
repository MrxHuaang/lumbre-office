import { CARROZA_IDS } from "@hyvento/shared";
import { afterEach, describe, expect, it } from "vitest";
import {
  CARNAVAL_PUESTO,
  CARNAVAL_TARIMA,
  DESFILE_BAJADA_X,
  DESFILE_PALCO_X,
  DESFILE_PARADAS_X,
  DESFILE_PORTON_X,
  DESFILE_UNIDADES,
  DESFILE_Y,
  ROAD,
  bailarinPuesto,
  bajadaMs,
  cabanaPuesto,
  cabanaX,
  canStandAt,
  desfileDuracionMs,
  desfileEstado,
  findPath,
  getWorld,
  pointsOfType,
  setFestivalDecor,
  type OfficeMap,
} from "./index";
import { carrozaSprite, CARROZA_FRAMES } from "./art/carnaval";

afterEach(() => {
  setFestivalDecor(null);
});

const targets = (map: OfficeMap) => [
  ...map.portals.flatMap((p) => p.tiles.map((t) => ({ what: `portal ${p.id}`, ...t }))),
  ...map.points.map((p) => ({ what: `${p.type} ${p.name}`, x: p.tileX, y: p.tileY })),
];
const spawnOf = (map: OfficeMap) => {
  const s = pointsOfType(map, "spawn")[0]!;
  return { x: s.tileX, y: s.tileY };
};

describe("la decoración del Carnaval", () => {
  it("decora la vereda del jardín con el puesto y el palco, y se apaga sin dejar nada", () => {
    const before = getWorld().areas.get("jardin")!.furniture.length;
    expect(setFestivalDecor("carnaval", 2)).toEqual(["jardin"]);
    const jardin = getWorld().areas.get("jardin")!;
    expect(jardin.furniture.length).toBeGreaterThan(before + 60);
    expect(pointsOfType(jardin, "festival_shop")[0]).toMatchObject({ tileX: CARNAVAL_PUESTO.punto.x, tileY: CARNAVAL_PUESTO.punto.y });
    expect(pointsOfType(jardin, "carnaval_contest")[0]).toMatchObject({ tileX: CARNAVAL_TARIMA.punto.x, tileY: CARNAVAL_TARIMA.punto.y });
    for (const t of ["tarima-comparsa", "puesto-carnaval", "banderines-carnaval", "farol-carnaval", "mascaron"]) expect(jardin.furniture.some((f) => f.type === t), t).toBe(true);
    setFestivalDecor(null);
    expect(getWorld().areas.get("jardin")!.furniture.length).toBe(before);
  });

  it("no tapa ningún portal ni punto: desde la entrada se llega a todo lo que se llegaba, y a lo nuevo", () => {
    const plain = getWorld().areas.get("jardin")!;
    const from = spawnOf(plain);
    const before = targets(plain).filter((t) => findPath(plain, from, t) !== null);
    setFestivalDecor("carnaval", 0);
    const map = getWorld().areas.get("jardin")!;
    for (const t of before) expect(findPath(map, from, t), `${t.what} (${t.x}, ${t.y})`).not.toBeNull();
    for (const p of [...pointsOfType(map, "festival_shop"), ...pointsOfType(map, "carnaval_contest")]) expect(findPath(map, from, { x: p.tileX, y: p.tileY }), p.type).not.toBeNull();
    // La vereda sigue caminable de punta a punta (por ahí se mira el desfile y se suma uno a la comparsa).
    expect(findPath(map, { x: 14, y: 131 }, { x: 138, y: 131 })).not.toBeNull();
  });
});

describe("el desfile por la calle del Megabús", () => {
  it("lleva el abanderado adelante, las carrozas en orden y la comparsa de la cabaña al final", () => {
    expect(DESFILE_UNIDADES.map((u) => u.id)).toEqual(["abanderado", ...CARROZA_IDS, "cabana"]);
  });

  it("para frente al portón y frente al palco, y la comparsa de la cabaña queda enfrente en cada parada", () => {
    const dur = desfileDuracionMs();
    expect(dur).toBeGreaterThan(100_000);
    expect(dur).toBeLessThan(160_000);
    const stops: number[] = [];
    let last: number | null = null;
    for (let ms = 0; ms < dur; ms += 250) {
      const e = desfileEstado(ms);
      if (e.parada !== null && e.parada !== last) stops.push(e.parada);
      last = e.parada;
      if (e.parada !== null) expect(e.cabeza).toBe(DESFILE_PARADAS_X[e.parada]);
    }
    expect(stops).toEqual([0, 1]);
    expect(cabanaX(DESFILE_PARADAS_X[0]!)).toBe(DESFILE_PORTON_X);
    expect(cabanaX(DESFILE_PARADAS_X[1]!)).toBe(DESFILE_PALCO_X);
    expect(desfileEstado(dur + 1).fin).toBe(true);
  });

  it("la cabeza siempre avanza (nunca retrocede) y la gente de la cabaña se baja antes del bosque", () => {
    let prev = -Infinity;
    for (let ms = 0; ms < desfileDuracionMs(); ms += 500) {
      const x = desfileEstado(ms).cabeza;
      expect(x).toBeGreaterThanOrEqual(prev);
      prev = x;
    }
    const at = bajadaMs();
    expect(cabanaX(desfileEstado(at).cabeza)).toBeCloseTo(DESFILE_BAJADA_X, 3);
    expect(at).toBeLessThan(desfileDuracionMs());
  });

  it("todos van por la calle: las carrozas y la gente en el carril exclusivo, los bailarines en el mixto", () => {
    const map = getWorld().areas.get("jardin")!;
    for (let i = 0; i < 12; i++) {
      const p = cabanaPuesto(i, 120);
      expect(p.y).toBeGreaterThan(ROAD.y0);
      expect(p.y).toBeLessThan(ROAD.laneY);
      // La calle no se camina: solo se está ahí bailando (lo lleva la sala).
      expect(canStandAt(map, p.x * map.tileSize, p.y * map.tileSize)).toBe(false);
    }
    for (let k = 1; k < DESFILE_UNIDADES.length - 1; k++)
      for (let i = 0; i < 4; i++) {
        const b = bailarinPuesto(k, i, 100);
        expect(b.y).toBeGreaterThan(ROAD.laneY);
        expect(b.y).toBeLessThan(ROAD.y1);
      }
    expect(DESFILE_Y.carroza).toBeGreaterThan(ROAD.y0);
  });

  it("cada carroza tiene sus cuadros dibujados, de día y de noche", () => {
    for (const id of CARROZA_IDS)
      for (let f = 0; f < CARROZA_FRAMES; f++)
        for (const night of [false, true]) {
          const s = carrozaSprite(id, f, night);
          expect(s.canvas.width, id).toBeGreaterThan(40);
        }
  });
});
