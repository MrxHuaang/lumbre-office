import { CARNAVAL, CARROZA_IDS, COMPARSAS, DESFILE_ORDEN, festivalById, GAME_DAY_REAL_MS, GAME_MINUTES_PER_DAY } from "@hyvento/shared";
import { afterEach, describe, expect, it } from "vitest";
import {
  atrasParaSumarse,
  CARNAVAL_PUESTO,
  CARNAVAL_TARIMA,
  CARROZA_TILES,
  DESFILE_ATRAS,
  DESFILE_BAJADA_X,
  DESFILE_LARGO,
  DESFILE_PALCO_X,
  DESFILE_PARADAS_X,
  DESFILE_UNIDADES,
  DESFILE_Y,
  ROAD,
  bailarinPuesto,
  canStandAt,
  desfileDuracionMs,
  desfileEstado,
  filaEn,
  findPath,
  getWorld,
  pointsOfType,
  setFestivalDecor,
  sumadoPuesto,
  unidadX,
  type OfficeMap,
} from "./index";

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

describe("el Desfile Magno por la calle del Megabús", () => {
  it("lleva el abanderado adelante, las carrozas, murgas y disfraces en su orden y la comparsa de la cabaña al final", () => {
    expect(DESFILE_UNIDADES.map((u) => u.id)).toEqual(["abanderado", ...DESFILE_ORDEN.map((d) => d.id), "cabana"]);
    expect(DESFILE_UNIDADES.filter((u) => u.tipo === "carroza").map((u) => u.id)).toEqual([...CARROZA_IDS]);
    expect(DESFILE_UNIDADES.filter((u) => u.tipo === "murga").length).toBeGreaterThanOrEqual(3);
    expect(DESFILE_UNIDADES.filter((u) => u.tipo === "disfraces").length).toBeGreaterThanOrEqual(3);
  });

  it("la fila es más larga que la calle y para dos veces frente al palco", () => {
    expect(DESFILE_LARGO).toBeGreaterThan(ROAD.x1 - ROAD.x0);
    const dur = desfileDuracionMs();
    const stops: number[] = [];
    let last: number | null = null;
    for (let ms = 0; ms < dur; ms += 250) {
      const e = desfileEstado(ms);
      if (e.parada !== null && e.parada !== last) stops.push(e.parada);
      last = e.parada;
      if (e.parada !== null) expect(e.cabeza).toBe(DESFILE_PARADAS_X[e.parada]);
    }
    expect(stops).toEqual([0, 1]);
    // En cada parada hay algo de la fila frente al palco.
    for (const px of DESFILE_PARADAS_X) expect(filaEn(DESFILE_PALCO_X, px)).toBe(true);
    expect(desfileEstado(dur + 1).fin).toBe(true);
  });

  it("la cabeza siempre avanza (nunca retrocede) y siempre hay algo en la calle mientras dura", () => {
    let prev = -Infinity;
    const dur = desfileDuracionMs();
    for (let ms = 0; ms < dur; ms += 1000) {
      const e = desfileEstado(ms);
      expect(e.cabeza).toBeGreaterThanOrEqual(prev);
      prev = e.cabeza;
      // Pasados los primeros segundos (la cabeza sale del bosque), hasta que la cola entra al bosque del este.
      if (e.cabeza > ROAD.x0 + 2 && e.cabeza - DESFILE_LARGO < ROAD.x1 - 2) {
        const algo = DESFILE_UNIDADES.some((_, k) => {
          const x = unidadX(k, e.cabeza);
          return x > ROAD.x0 && x - DESFILE_UNIDADES[k]!.largo < ROAD.x1;
        });
        expect(algo, `${ms}`).toBe(true);
      }
    }
  });

  it("todos van por la calle: carrozas, murgas y la gente en el carril exclusivo, las comparsas en el mixto", () => {
    const map = getWorld().areas.get("jardin")!;
    DESFILE_UNIDADES.forEach((u, k) => {
      const n = u.tipo === "carroza" ? COMPARSAS.find((c) => c.id === u.id)!.bailarines.length : u.tipo === "murga" || u.tipo === "disfraces" ? u.cuantos : 0;
      for (let i = 0; i < n; i++) {
        const b = bailarinPuesto(k, i, 100);
        expect(b.y, `${u.id} ${i}`).toBeGreaterThan(ROAD.y0);
        expect(b.y, `${u.id} ${i}`).toBeLessThan(ROAD.y1);
        // Cada uno va dentro de su unidad (no se monta en la de atrás).
        expect(b.x, `${u.id} ${i}`).toBeGreaterThan(unidadX(k, 100) - u.largo);
        if (u.tipo === "carroza") expect(b.y).toBeGreaterThan(ROAD.laneY);
      }
    });
    for (let f = 0; f < 3; f++) {
      const p = sumadoPuesto(50, f, 120);
      expect(p.y).toBeGreaterThan(ROAD.y0);
      expect(p.y).toBeLessThan(ROAD.laneY);
      // La calle no se camina: solo se está ahí bailando (lo lleva la sala).
      expect(canStandAt(map, p.x * map.tileSize, p.y * map.tileSize)).toBe(false);
    }
    expect(DESFILE_Y.carroza).toBeGreaterThan(ROAD.y0);
  });

  it("quien se suma baila en el hueco detrás de una carroza, nunca encima de ella", () => {
    const cabeza = 200;
    for (let x = ROAD.x0; x < DESFILE_BAJADA_X - 2; x += 0.7) {
      if (!filaEn(x, cabeza)) continue;
      const a = atrasParaSumarse(x, cabeza);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(DESFILE_LARGO);
      DESFILE_UNIDADES.forEach((u, k) => {
        if (u.tipo !== "carroza") return;
        const at = DESFILE_ATRAS[k]!;
        expect(a > at && a < at + CARROZA_TILES[u.id], `${x} sobre ${u.id}`).toBe(false);
      });
    }
  });

  it("cada carroza cabe en su puesto de la fila (no se monta sobre la de adelante)", () => {
    for (const id of CARROZA_IDS) {
      const u = DESFILE_UNIDADES.find((x) => x.id === id)!;
      expect(CARROZA_TILES[id], id).toBeLessThan(u.largo);
    }
  });

  it("el Desfile Magno dura unos 17 minutos y la cola pasa entera antes del concurso y del cierre", () => {
    const dur = desfileDuracionMs();
    expect(dur).toBeGreaterThan(15 * 60_000);
    expect(dur).toBeLessThan(20 * 60_000);
    // Aunque salga al final de su ventana (porque el bus estaba en la calle), la cola ya se perdió en el
    // bosque antes de que cierre el concurso (y todo es de día).
    const realMsPorMinuto = GAME_DAY_REAL_MS / GAME_MINUTES_PER_DAY;
    const hora = CARNAVAL.desfileHoras[0]!;
    expect(CARNAVAL.desfileHoras).toHaveLength(1);
    expect(CARNAVAL.ventanaMin * realMsPorMinuto + dur).toBeLessThan((CARNAVAL.concursoCierre - hora) * 60 * realMsPorMinuto);
    expect(CARNAVAL.concursoCierre).toBeLessThan(festivalById("carnaval")!.cierre!);
    expect(festivalById("carnaval")!.cierre!).toBeLessThan(19);
    const fin = desfileEstado(dur);
    expect(fin.fin).toBe(true);
    expect(fin.cabeza - DESFILE_LARGO).toBeGreaterThan(ROAD.x1);
    // Y todas las carrozas pasan por delante del palco (se ven desde la estación).
    for (const id of CARROZA_IDS) {
      const k2 = DESFILE_UNIDADES.findIndex((x) => x.id === id);
      let vista = false;
      for (let ms = 0; ms < dur && !vista; ms += 500) vista = Math.abs(unidadX(k2, desfileEstado(ms).cabeza) - DESFILE_PALCO_X) < 2;
      expect(vista, id).toBe(true);
    }
  });
});
