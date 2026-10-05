import { describe, expect, it } from "vitest";
import { buildCasaPropia, CASA_CONEXIONES, findPath, isBlockedTile, pointsOfType } from "./index";

// Afuera de la casa de cada persona (la plantilla): un claro en el bosque con la orilla orgánica, el
// bosque que entra a lo que se camina y naturaleza sembrada con ruido. Nada de eso puede cerrar un paso.
const casa = buildCasaPropia("casa:plantilla")!;
const llegada = CASA_CONEXIONES.afuera.parada.llegada;
const floorAt = (x: number, y: number) => casa.floors[y * casa.width + x];

describe("afuera de la casa", () => {
  it("de la parada se llega a la puerta, a la de atrás y a la parada del bus", () => {
    const from = { x: llegada.x, y: llegada.y };
    for (const t of [...CASA_CONEXIONES.afuera.puerta.tiles, ...CASA_CONEXIONES.afuera.atras.tiles]) expect(findPath(casa, from, t), `${t.x},${t.y}`).not.toBeNull();
    const stop = pointsOfType(casa, "home_bus_stop")[0]!;
    expect(findPath(casa, from, { x: stop.tileX, y: stop.tileY })).not.toBeNull();
  });

  it("no quedan tiles libres a los que no se llega (el bosque no encierra a nadie)", () => {
    const p = casa.def.playable!;
    const seen = new Set([llegada.y * casa.width + llegada.x]);
    const stack: [number, number][] = [[llegada.x, llegada.y]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const k = (y + dy) * casa.width + x + dx;
        if (seen.has(k) || isBlockedTile(casa, x + dx, y + dy)) continue;
        seen.add(k);
        stack.push([x + dx, y + dy]);
      }
    }
    const lost: string[] = [];
    for (let y = p.y; y < p.y + p.h; y++)
      for (let x = p.x; x < p.x + p.w; x++) if (!isBlockedTile(casa, x, y) && !seen.has(y * casa.width + x)) lost.push(`${x - p.x},${y - p.y}`);
    expect(lost).toEqual([]);
  });

  it("ningún árbol ni mata queda sobre el sendero, la vereda o el camino del bus", () => {
    const nature = /^(oak|pine|birch|bush|rock|boulder|fallen-log|stump|fern|tall-grass|wildflowers|mushrooms)/;
    const bad = casa.furniture.filter((f) => nature.test(f.type) && ["path", "gravel", "deck", "soil", "water"].includes(floorAt(f.x, f.y)!));
    expect(bad.map((f) => `${f.type} ${f.x},${f.y}`)).toEqual([]);
  });

  it("la orilla del claro no es recta: el bosque entra en partes y el pasto sale en otras", () => {
    const p = casa.def.playable!;
    // A lo largo del borde oeste y del este, el piso cambia entre pasto y bosque.
    for (const x of [p.x, p.x + p.w - 1]) {
      const kinds = new Set(Array.from({ length: 16 }, (_, i) => floorAt(x, p.y + 2 + i)));
      expect(kinds.has("grass") && kinds.has("forest"), `x ${x}`).toBe(true);
    }
    // El camino del bus no llega al borde del nivel: se pierde en el bosque.
    for (let y = 0; y < casa.height; y++) for (const x of [0, 1, casa.width - 2, casa.width - 1]) expect(floorAt(x, y), `${x},${y}`).toBe("forest");
  });
});

describe("armarios de la casa", () => {
  it("cada armario tiene su punto al lado, libre y al que se llega desde la escalera", () => {
    const arriba = buildCasaPropia("casa:plantilla:arriba")!;
    const points = pointsOfType(arriba, "wardrobe");
    const armarios = arriba.furniture.filter((f) => f.type === "armario");
    expect(points).toHaveLength(armarios.length);
    const from = CASA_CONEXIONES.arriba.escalera.llegada;
    for (const f of armarios) {
      const p = points.find((p) => p.tileX >= f.x - 1 && p.tileX <= f.x + f.w && p.tileY >= f.y - 1 && p.tileY <= f.y + f.d);
      expect(p, `${f.x},${f.y}`).toBeDefined();
      expect(isBlockedTile(arriba, p!.tileX, p!.tileY)).toBe(false);
      expect(findPath(arriba, from, { x: p!.tileX, y: p!.tileY })).not.toBeNull();
    }
  });
});
