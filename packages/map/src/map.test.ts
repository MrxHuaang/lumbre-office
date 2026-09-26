import { describe, expect, it } from "vitest";
import {
  allZones,
  canStandAt,
  canWalkBetween,
  findPath,
  getWorld,
  isBlockedTile,
  nearestFreeTile,
  nearPortal,
  officeDoor,
  placeAt,
  placeLabel,
  pointsOfType,
  portalAtTile,
  seatAtPoint,
  seatStandSpot,
  spawnPoint,
  wallBetween,
  zoneAt,
  type OfficeMap,
} from "./index";

const world = getWorld();
const area = (id: string): OfficeMap => {
  const a = world.areas.get(id);
  if (!a) throw new Error(`Falta el nivel ${id}`);
  return a;
};
const center = (map: OfficeMap, t: number) => t * map.tileSize + map.tileSize / 2;
const jardin = area("jardin");
const plantaBaja = area("planta-baja");
const piso2 = area("piso-2");

describe("mundo", () => {
  it("tiene el jardín, la planta baja y el piso 2, y se aparece en el jardín", () => {
    expect([...world.areas.keys()]).toEqual(["jardin", "planta-baja", "piso-2"]);
    expect(world.spawnArea).toBe("jardin");
    const spawn = spawnPoint(jardin);
    expect(canStandAt(jardin, spawn.x, spawn.y)).toBe(true);
  });

  it("las zonas tienen ids únicos en toda la cabaña", () => {
    const ids = allZones(world).map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining(["office-1", "office-4", "meeting-main", "mesa-1", "mesa-4", "cafeteria", "recibidor", "jardin"]),
    );
    expect(ids).not.toContain("coworking");
  });

  it("los puntos de interés quedan en tiles transitables (salvo la pantalla, que cuelga de la pared)", () => {
    for (const map of world.areas.values())
      for (const p of map.points) {
        if (p.type === "screen") continue;
        expect(isBlockedTile(map, p.tileX, p.tileY), `${map.id}: ${p.name}`).toBe(false);
      }
    expect(pointsOfType(plantaBaja, "screen").map((s) => s.zone)).toEqual(["meeting-main"]);
  });
});

describe("oficinas", () => {
  const offices = piso2.zones.filter((z) => z.type === "office");

  it("hay 4 oficinas aisladas, cada una con puerta al pasillo y un PC", () => {
    expect(offices.map((o) => o.id)).toEqual(["office-1", "office-2", "office-3", "office-4"]);
    for (const office of offices) {
      expect(office.isolated).toBe(true);
      const door = officeDoor(office);
      expect(canStandAt(piso2, door.x, door.y), office.id).toBe(true);
      expect(placeAt(piso2, door.x, door.y)).toBe(`door:${office.id}`);
      const pcSeats = [...piso2.seats.values()].filter((s) => s.computer && zoneAt(piso2, s.x, s.y)?.id === office.id);
      expect(pcSeats, office.id).toHaveLength(1);
    }
  });

  it("se llega del pasillo al interior de cada oficina pasando por su puerta", () => {
    for (const office of offices) {
      const door = officeDoor(office);
      const doorTile = { x: Math.floor(door.x / piso2.tileSize), y: Math.floor(door.y / piso2.tileSize) };
      // El tile de adentro queda al otro lado del borde de la puerta.
      const edge = office.doorEdge!;
      const inside = { x: edge.x > door.x ? doorTile.x + 1 : edge.x < door.x ? doorTile.x - 1 : doorTile.x, y: doorTile.y };
      expect(zoneAt(piso2, center(piso2, inside.x), center(piso2, inside.y))?.id, office.id).toBe(office.id);
      const path = findPath(piso2, { x: 9, y: 16 }, inside);
      expect(path, office.id).not.toBeNull();
      expect(path!.some((t) => t.x === doorTile.x && t.y === doorTile.y)).toBe(true);
    }
  });
});

describe("paredes", () => {
  it("las paredes del fondo son altas y las interiores bajas", () => {
    expect(piso2.wallH[0 * piso2.width + 5]).toBe(2); // norte del edificio
    expect(piso2.wallV[3 * (piso2.width + 1) + 0]).toBe(2); // oeste del edificio
    expect(piso2.wallH[9 * piso2.width + 3]).toBe(1); // entre las oficinas 1 y 3
    expect(piso2.wallV[8 * (piso2.width + 1) + 8]).toBe(1); // oficina 1 ↔ pasillo (fuera de la puerta)
    expect(piso2.wallV[6 * (piso2.width + 1) + 8]).toBe(0); // la puerta de la oficina 1
  });

  it("no se puede pararse sobre una pared ni atravesarla, pero sí cruzar por la puerta", () => {
    const ts = piso2.tileSize;
    // Borde entre la oficina 1 (x = 7) y el pasillo (x = 8): pared en la fila 8, puerta en la fila 6.
    expect(wallBetween(piso2, 7, 8, 8, 8)).toBe(true);
    expect(canStandAt(piso2, 8 * ts, center(piso2, 8))).toBe(false);
    expect(canWalkBetween(piso2, center(piso2, 8), center(piso2, 8), center(piso2, 7), center(piso2, 8))).toBe(false);
    expect(canWalkBetween(piso2, center(piso2, 8), center(piso2, 6), center(piso2, 7), center(piso2, 6))).toBe(true);
  });

  it("fuera del edificio no se puede caminar", () => {
    expect(isBlockedTile(plantaBaja, 10, 17)).toBe(true);
    expect(isBlockedTile(plantaBaja, 4, 17)).toBe(false); // umbral de la puerta de entrada
    expect(isBlockedTile(plantaBaja, -1, 5)).toBe(true);
  });
});

describe("portales", () => {
  it("cada portal está en un tile libre y lleva a un tile libre que no es otro portal", () => {
    for (const map of world.areas.values())
      for (const portal of map.portals) {
        for (const t of portal.tiles) expect(isBlockedTile(map, t.x, t.y), portal.id).toBe(false);
        const target = area(portal.to.area);
        expect(isBlockedTile(target, portal.to.x, portal.to.y), portal.id).toBe(false);
        expect(portalAtTile(target, portal.to.x, portal.to.y), portal.id).toBeUndefined();
      }
  });

  it("se puede ir y volver entre todos los niveles", () => {
    const links = [...world.areas.values()].flatMap((m) => m.portals.map((p) => `${m.id}→${p.to.area}`));
    expect(links).toEqual(
      expect.arrayContaining(["jardin→planta-baja", "planta-baja→jardin", "planta-baja→piso-2", "piso-2→planta-baja"]),
    );
  });

  it("solo se usa un portal estando cerca", () => {
    const portal = jardin.portals[0]!;
    const t = portal.tiles[0]!;
    expect(nearPortal(jardin, portal, center(jardin, t.x), center(jardin, t.y + 1))).toBe(true);
    expect(nearPortal(jardin, portal, center(jardin, t.x), center(jardin, t.y + 4))).toBe(false);
  });

  it("desde cada aparición se llega a todos los portales del nivel", () => {
    const starts: Record<string, { x: number; y: number }> = {
      jardin: { x: spawnPoint(jardin).tileX, y: spawnPoint(jardin).tileY },
      "planta-baja": { x: 4, y: 15 },
      "piso-2": { x: 9, y: 5 },
    };
    for (const map of world.areas.values())
      for (const portal of map.portals) {
        const t = portal.tiles[0]!;
        expect(findPath(map, starts[map.id]!, t), portal.id).not.toBeNull();
      }
  });

  it("la ruta rodea los portales que no son el destino (pasar junto a la puerta no cambia de nivel)", () => {
    const path = findPath(jardin, { x: 14, y: 12 }, { x: 17, y: 12 })!;
    expect(path).not.toBeNull();
    expect(path.some((t) => portalAtTile(jardin, t.x, t.y))).toBe(false);
    const toDoor = findPath(jardin, { x: 14, y: 12 }, { x: 15, y: 12 })!;
    expect(toDoor.at(-1)).toEqual({ x: 15, y: 12 });
  });
});

describe("asientos", () => {
  it("cada asiento tiene un lugar libre para pararse y se llega caminando", () => {
    const starts: Record<string, { x: number; y: number }> = { jardin: { x: 15, y: 24 }, "planta-baja": { x: 4, y: 15 }, "piso-2": { x: 9, y: 5 } };
    for (const map of world.areas.values())
      for (const seat of map.seats.values()) {
        expect(seatAtPoint(map, seat.x, seat.y)).toBe(seat);
        const spot = seatStandSpot(map, seat);
        expect(canStandAt(map, spot.x, spot.y), `${map.id} (${seat.tileX}, ${seat.tileY})`).toBe(true);
        const tile = { x: Math.floor(spot.x / map.tileSize), y: Math.floor(spot.y / map.tileSize) };
        expect(findPath(map, starts[map.id]!, tile), `${map.id} (${seat.tileX}, ${seat.tileY})`).not.toBeNull();
      }
  });

  it("las sillas de las mesas miran hacia la mesa", () => {
    const facing = (x: number, y: number) => plantaBaja.seats.get(y * plantaBaja.width + x)?.facing;
    expect(facing(11, 6)).toBe("right");
    expect(facing(13, 6)).toBe("left");
    expect(facing(12, 5)).toBe("down");
    expect(facing(12, 7)).toBe("up");
  });
});

describe("lugares y zonas", () => {
  it("las mesas de la cafetería son burbujas de audio y se muestran como lugar", () => {
    const x = center(plantaBaja, 11);
    const y = center(plantaBaja, 6);
    expect(zoneAt(plantaBaja, x, y)?.id).toBe("mesa-1");
    expect(zoneAt(plantaBaja, x, y)?.isolated).toBe(true);
    expect(placeAt(plantaBaja, x, y)).toBe("mesa-1");
    expect(placeAt(plantaBaja, center(plantaBaja, 15), center(plantaBaja, 14))).toBe("cafeteria");
  });

  it("placeLabel", () => {
    const names = (id: string) => ({ "office-1": "Oficina 1" })[id];
    expect(placeLabel("", names)).toBe("Pasillo");
    expect(placeLabel("office-1", names)).toBe("Oficina 1");
    expect(placeLabel("door:office-1", names)).toBe("Entrada · Oficina 1");
  });

  it("nearestFreeTile encuentra un tile libre cerca de un obstáculo", () => {
    const free = nearestFreeTile(plantaBaja, { x: 4, y: 3 }); // mesa de reuniones
    expect(free).not.toBeNull();
    expect(isBlockedTile(plantaBaja, free!.x, free!.y)).toBe(false);
  });
});
