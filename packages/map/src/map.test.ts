import { describe, expect, it } from "vitest";
import { CONEXIONES } from "./world/areas/conexiones";
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
  wallAbove,
  wallBetween,
  zoneAt,
  type OfficeMap,
} from "./index";

/** Desde dónde se prueba cada nivel: la llegada de sus conexiones (el jardín, desde su aparición). */
const STARTS: Record<string, { x: number; y: number }> = {
  "planta-baja": CONEXIONES.plantaBaja.entrada.llegada,
  "piso-2": CONEXIONES.piso2.escaleraAbajo.llegada,
  "piso-3": CONEXIONES.piso3.escaleraAbajo.llegada,
  sotano: CONEXIONES.sotano.escalera.llegada,
};

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
const piso3 = area("piso-3");

describe("mundo", () => {
  it("tiene el jardín, la planta baja, el piso 2 y el sótano, y se aparece en el jardín", () => {
    expect([...world.areas.keys()]).toEqual(["jardin", "planta-baja", "piso-2", "piso-3", "sotano"]);
    expect(world.spawnArea).toBe("jardin");
    const spawn = spawnPoint(jardin);
    expect(canStandAt(jardin, spawn.x, spawn.y)).toBe(true);
  });

  it("las zonas tienen ids únicos en toda la cabaña", () => {
    const ids = allZones(world).map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining(["office-1", "office-4", "meeting-main", "mesa-1", "mesa-6", "cafeteria", "tienda", "recibidor", "jardin", "biblioteca", "cabina-1"]),
    );
    expect(ids).not.toContain("coworking");
  });

  it("los puntos de interés quedan en tiles transitables (salvo la pantalla, que cuelga de la pared)", () => {
    for (const map of world.areas.values())
      for (const p of map.points) {
        if (p.type === "screen") continue;
        expect(isBlockedTile(map, p.tileX, p.tileY), `${map.id}: ${p.name}`).toBe(false);
      }
    // La sala de reuniones se mudó al piso 2 (el del trabajo).
    expect(pointsOfType(piso2, "screen").map((s) => s.zone)).toEqual(["meeting-main"]);
    expect(pointsOfType(plantaBaja, "screen")).toEqual([]);
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
      // El tile de adentro queda al otro lado del borde de la puerta (a un lado o arriba/abajo).
      const edge = office.doorEdge!;
      const side = (e: number, d: number, t: number) => (e > d ? t + 1 : e < d ? t - 1 : t);
      const inside = { x: side(edge.x, door.x, doorTile.x), y: side(edge.y, door.y, doorTile.y) };
      expect(zoneAt(piso2, center(piso2, inside.x), center(piso2, inside.y))?.id, office.id).toBe(office.id);
      const path = findPath(piso2, STARTS["piso-2"]!, inside);
      expect(path, office.id).not.toBeNull();
      expect(path!.some((t) => t.x === doorTile.x && t.y === doorTile.y)).toBe(true);
    }
  });
});

describe("paredes", () => {
  it("las paredes del fondo son altas y las interiores bajas", () => {
    expect(piso2.wallH[0 * piso2.width + 10]).toBe(2); // norte del edificio
    expect(piso2.wallV[3 * (piso2.width + 1) + 0]).toBe(2); // oeste del edificio
    expect(piso2.wallV[5 * (piso2.width + 1) + 18]).toBe(1); // entre la oficina 1 y la sala de reuniones
    expect(piso2.wallH[11 * piso2.width + 10]).toBe(1); // oficina 1 ↔ pasillo (fuera de la puerta)
    expect(piso2.wallH[11 * piso2.width + 12]).toBe(0); // la puerta de la oficina 1
  });

  it("no se puede pararse sobre una pared ni atravesarla, pero sí cruzar por la puerta", () => {
    const ts = piso2.tileSize;
    // Borde entre la oficina 1 (y = 10) y el pasillo (y = 11): pared en la columna 10, puerta en la 12.
    expect(wallBetween(piso2, 10, 10, 10, 11)).toBe(true);
    expect(canStandAt(piso2, center(piso2, 10), 11 * ts)).toBe(false);
    expect(canWalkBetween(piso2, center(piso2, 10), center(piso2, 11), center(piso2, 10), center(piso2, 10))).toBe(false);
    expect(canWalkBetween(piso2, center(piso2, 12), center(piso2, 11), center(piso2, 12), center(piso2, 10))).toBe(true);
  });

  it("fuera del edificio no se puede caminar", () => {
    expect(isBlockedTile(plantaBaja, 10, 26)).toBe(true);
    const umbral = CONEXIONES.plantaBaja.entrada.tiles[0]!;
    expect(isBlockedTile(plantaBaja, umbral.x, umbral.y)).toBe(false); // umbral de la puerta de entrada
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
      expect.arrayContaining(["jardin→planta-baja", "planta-baja→jardin", "planta-baja→piso-2", "piso-2→planta-baja", "jardin→piso-2", "piso-2→jardin"]),
    );
  });

  it("la escalera exterior del jardín sube al balcón del piso 2 y se vuelve por el mismo lado", () => {
    const up = jardin.portals.find((p) => p.id === "jardin-escalera-terraza")!;
    const down = piso2.portals.find((p) => p.id === "piso-2-balcon")!;
    expect(up.to.area).toBe("piso-2");
    expect(down.to.area).toBe("jardin");
    // El pie de la escalera queda justo al sur del costado este de la casa (donde se dibuja la escalera).
    const house = jardin.furniture.find((f) => f.type === "house")!;
    const foot = up.tiles[0]!;
    expect(foot).toEqual({ x: house.x + house.w - 1, y: house.y + house.d });
    // Arriba se llega al balcón (se pisa) y de ahí se sale por la puerta de la zona de descanso.
    const ts = piso2.tileSize;
    expect(zoneAt(piso2, center(piso2, up.to.x), center(piso2, up.to.y))?.id).toBe("balcon");
    expect(zoneAt(piso2, center(piso2, down.tiles[0]!.x), center(piso2, down.tiles[0]!.y))?.id).toBe("balcon");
    const path = findPath(piso2, { x: up.to.x, y: up.to.y }, STARTS["piso-2"]!)!;
    expect(path).not.toBeNull();
    const zones = new Set(path.map((t) => zoneAt(piso2, t.x * ts + ts / 2, t.y * ts + ts / 2)?.id));
    expect(zones.has("descanso")).toBe(true);
    // Y abajo se llega caminando desde el portón al pie de la escalera.
    expect(findPath(jardin, { x: spawnPoint(jardin).tileX, y: spawnPoint(jardin).tileY }, foot)).not.toBeNull();
  });

  it("solo se usa un portal estando cerca", () => {
    const portal = jardin.portals[0]!;
    const t = portal.tiles[0]!;
    expect(nearPortal(jardin, portal, center(jardin, t.x), center(jardin, t.y + 1))).toBe(true);
    expect(nearPortal(jardin, portal, center(jardin, t.x), center(jardin, t.y + 4))).toBe(false);
  });

  it("desde cada aparición se llega a todos los portales del nivel", () => {
    const starts: Record<string, { x: number; y: number }> = { jardin: { x: spawnPoint(jardin).tileX, y: spawnPoint(jardin).tileY }, ...STARTS };
    for (const map of world.areas.values())
      for (const portal of map.portals) {
        const t = portal.tiles[0]!;
        expect(findPath(map, starts[map.id]!, t), portal.id).not.toBeNull();
      }
  });

  it("la ruta rodea los portales que no son el destino (pasar junto a la puerta no cambia de nivel)", () => {
    // De un lado al otro de la puerta de la casa (los dos tiles del portal quedan al medio).
    const [door] = CONEXIONES.jardin.casa.tiles;
    const left = { x: door!.x - 1, y: door!.y };
    const path = findPath(jardin, left, { x: door!.x + 2, y: door!.y })!;
    expect(path).not.toBeNull();
    expect(path.some((t) => portalAtTile(jardin, t.x, t.y))).toBe(false);
    const toDoor = findPath(jardin, left, door!)!;
    expect(toDoor.at(-1)).toEqual(door);
  });
});

describe("asientos", () => {
  it("cada asiento tiene un lugar libre para pararse y se llega caminando", () => {
    const starts: Record<string, { x: number; y: number }> = { jardin: { x: spawnPoint(jardin).tileX, y: spawnPoint(jardin).tileY }, ...STARTS };
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
    expect(facing(13, 5)).toBe("right");
    expect(facing(15, 5)).toBe("left");
    expect(facing(18, 6)).toBe("up");
    expect(facing(25, 5)).toBe("down");
  });
});

describe("lugares y zonas", () => {
  it("las mesas de la cafetería son burbujas de audio y se muestran como lugar", () => {
    const x = center(plantaBaja, 13);
    const y = center(plantaBaja, 5);
    expect(zoneAt(plantaBaja, x, y)?.id).toBe("mesa-1");
    expect(zoneAt(plantaBaja, x, y)?.isolated).toBe(true);
    expect(placeAt(plantaBaja, x, y)).toBe("mesa-1");
    expect(placeAt(plantaBaja, center(plantaBaja, 20), center(plantaBaja, 7))).toBe("cafeteria");
    expect(placeAt(plantaBaja, center(plantaBaja, 28), center(plantaBaja, 17))).toBe("tienda");
  });

  it("las mesas son aisladas, están dentro de la cafetería y se llega a cada una desde la entrada", () => {
    const cafe = plantaBaja.zones.find((z) => z.id === "cafeteria")!;
    const mesas = plantaBaja.zones.filter((z) => z.type === "table");
    expect(mesas.map((z) => z.id)).toEqual(Array.from({ length: 6 }, (_, i) => `mesa-${i + 1}`));
    for (const mesa of mesas) {
      expect(mesa.isolated, mesa.id).toBe(true);
      expect(mesa.x >= cafe.x && mesa.y >= cafe.y, mesa.id).toBe(true);
      expect(mesa.x + mesa.width <= cafe.x + cafe.width && mesa.y + mesa.height <= cafe.y + cafe.height, mesa.id).toBe(true);
      const seats = [...plantaBaja.seats.values()].filter((s) => zoneAt(plantaBaja, s.x, s.y)?.id === mesa.id);
      // Dos o tres sillas por mesa: la cafetería respira (docs: menos sillas, más rincones).
      expect(seats.length, mesa.id).toBeGreaterThanOrEqual(2);
      expect(seats.length, mesa.id).toBeLessThanOrEqual(3);
      // Se entra a la burbuja caminando: algún tile libre de la zona (las esquinas) se alcanza con A*.
      const ts = plantaBaja.tileSize;
      const libres: { x: number; y: number }[] = [];
      for (let ty = mesa.y / ts; ty < (mesa.y + mesa.height) / ts; ty++)
        for (let tx = mesa.x / ts; tx < (mesa.x + mesa.width) / ts; tx++)
          if (!isBlockedTile(plantaBaja, tx, ty)) libres.push({ x: tx, y: ty });
      expect(libres.length, mesa.id).toBeGreaterThan(0);
      expect(libres.some((t) => findPath(plantaBaja, STARTS["planta-baja"]!, t) !== null), mesa.id).toBe(true);
    }
  });

  it("placeLabel", () => {
    const names = (id: string) => ({ "office-1": "Oficina 1" })[id];
    expect(placeLabel("", names)).toBe("Pasillo");
    expect(placeLabel("office-1", names)).toBe("Oficina 1");
    expect(placeLabel("door:office-1", names)).toBe("Entrada · Oficina 1");
  });

  it("nearestFreeTile encuentra un tile libre cerca de un obstáculo", () => {
    const free = nearestFreeTile(plantaBaja, { x: 36, y: 4 }); // isla de la cocina
    expect(free).not.toBeNull();
    expect(isBlockedTile(plantaBaja, free!.x, free!.y)).toBe(false);
  });
});

describe("tienda", () => {
  const entrada = STARTS["planta-baja"]!; // donde se llega desde el jardín
  const tile = (p: { tileX: number; tileY: number }) => ({ x: p.tileX, y: p.tileY });

  it("el mostrador y el probador están dentro de la tienda y se llega caminando desde la entrada", () => {
    for (const type of ["shop_counter", "fitting_room"]) {
      const points = pointsOfType(plantaBaja, type);
      expect(points, type).toHaveLength(1);
      const p = points[0]!;
      expect(zoneAt(plantaBaja, p.x, p.y)?.id, type).toBe("tienda");
      expect(isBlockedTile(plantaBaja, p.tileX, p.tileY), type).toBe(false);
      expect(findPath(plantaBaja, entrada, tile(p)), type).not.toBeNull();
    }
  });

  it("cada punto queda junto a su mueble (mostrador y probador)", () => {
    const near = (type: string, furniture: string) => {
      const p = pointsOfType(plantaBaja, type)[0]!;
      return plantaBaja.furniture.some(
        (f) => f.type === furniture && p.tileX >= f.x - 1 && p.tileX <= f.x + f.w && p.tileY >= f.y - 1 && p.tileY <= f.y + f.d,
      );
    };
    expect(near("shop_counter", "shop-counter")).toBe(true);
    expect(near("fitting_room", "fitting-booth")).toBe(true);
  });

  it("se entra a la tienda desde el recibidor y desde el pasillo (con paredes bajas)", () => {
    const ts = plantaBaja.tileSize;
    const shop = plantaBaja.zones.find((z) => z.id === "tienda")!;
    const y = shop.y / ts; // primera fila de la tienda, contra el pasillo
    const walls = Array.from({ length: shop.width / ts }, (_, i) => wallAbove(plantaBaja, shop.x / ts + i, y));
    expect(walls.filter((w) => w === 0).length).toBe(2);
    expect(walls.every((w) => w === 0 || w === 1)).toBe(true);
    // Del recibidor se entra a la tienda por su puerta (x = 24, y = 19).
    expect(wallBetween(plantaBaja, 23, 19, 24, 19)).toBe(false);
    expect(zoneAt(plantaBaja, center(plantaBaja, 23), center(plantaBaja, 19))?.id).toBe("recibidor");
    expect(zoneAt(plantaBaja, center(plantaBaja, 24), center(plantaBaja, 19))?.id).toBe("tienda");
    // La barra de la cafetería queda a un paseo por el pasillo.
    const barra = pointsOfType(plantaBaja, "cafe_counter")[0]!;
    expect(findPath(plantaBaja, entrada, tile(barra))).not.toBeNull();
  });

  it("cada mueble a la venta existe en el catálogo", async () => {
    const { SHOP_FURNITURE } = await import("@hyvento/shared");
    const { CATALOG } = await import("./world/catalog");
    for (const item of SHOP_FURNITURE) expect(item.id in CATALOG, item.id).toBe(true);
  });
});

describe("circulación (docs/plan-rediseno.md)", () => {
  /** Salas de paso de cada nivel: pasillos, recibidor y rellanos. */
  const CIRCULATION: Record<string, string[]> = {
    "planta-baja": ["pasillo", "recibidor"],
    "piso-2": ["pasillo", "rellano"],
    "piso-3": ["pasillo-3", "rellano-3"],
  };
  /** Lo que es parte de otra sala y solo se abre a ella. */
  const PART_OF: Record<string, string> = {
    cocina: "cafeteria",
    probadores: "tienda",
    guardarropa: "recibidor",
    "cabina-1": "sala-cabinas",
    "cabina-2": "sala-cabinas",
    balcon: "descanso",
  };
  /** Habitación de un tile (la última que lo cubre, como en build.ts). */
  const roomAt = (map: OfficeMap, x: number, y: number) =>
    [...map.def.rooms].reverse().find((r) => x >= r.rect.x && y >= r.rect.y && x < r.rect.x + r.rect.w && y < r.rect.y + r.rect.h)?.id;
  /** Pares de habitaciones unidas por una puerta. */
  const links = (map: OfficeMap) => {
    const out = new Set<string>();
    for (const d of map.def.doors)
      for (let k = 0; k < (d.width ?? 1); k++) {
        const [a, b] = d.edge === "h" ? [roomAt(map, d.x + k, d.y - 1), roomAt(map, d.x + k, d.y)] : [roomAt(map, d.x - 1, d.y + k), roomAt(map, d.x, d.y + k)];
        if (a && b && a !== b) out.add(`${a}|${b}`).add(`${b}|${a}`);
      }
    return out;
  };
  const levels = [plantaBaja, piso2, piso3];

  it("cada sala se abre a un pasillo o vestíbulo (o a la sala de la que es parte)", () => {
    for (const map of levels) {
      const l = links(map);
      const hubs = CIRCULATION[map.id]!;
      for (const room of map.def.rooms) {
        if (hubs.includes(room.id)) continue;
        const allowed = PART_OF[room.id] ? [PART_OF[room.id]!] : hubs;
        expect(allowed.some((h) => l.has(`${room.id}|${h}`)), `${map.id}: ${room.id}`).toBe(true);
        // Y nunca se pasa por ella para llegar a otra sala que no sea parte suya.
        const through = map.def.rooms.filter(
          (r) => r.id !== room.id && !hubs.includes(r.id) && l.has(`${room.id}|${r.id}`) && PART_OF[r.id] !== room.id && PART_OF[room.id] !== r.id,
        );
        expect(through.map((r) => r.id), `${map.id}: ${room.id}`).toEqual([]);
      }
    }
  });

  /** Tiles libres a los que se llega caminando desde la llegada del nivel (sin pasar por portales). */
  const reachable = (map: OfficeMap) => {
    const start = STARTS[map.id]!;
    const seen = new Set([start.y * map.width + start.x]);
    const queue = [start];
    while (queue.length) {
      const t = queue.pop()!;
      if (portalAtTile(map, t.x, t.y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = { x: t.x + dx, y: t.y + dy };
        const i = n.y * map.width + n.x;
        if (seen.has(i) || isBlockedTile(map, n.x, n.y) || wallBetween(map, t.x, t.y, n.x, n.y)) continue;
        seen.add(i);
        queue.push(n);
      }
    }
    return seen;
  };

  it("se llega caminando a todo el piso libre de cada nivel, sin rincones encerrados", () => {
    for (const map of levels) {
      const ok = reachable(map);
      const closed: string[] = [];
      for (let y = 0; y < map.height; y++)
        for (let x = 0; x < map.width; x++) if (!isBlockedTile(map, x, y) && !ok.has(y * map.width + x)) closed.push(`${x},${y}`);
      expect(closed, map.id).toEqual([]);
      // Y a cada asiento se llega por un tile vecino (sin cruzar paredes).
      for (const seat of map.seats.values()) {
        const near = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => {
          const n = { x: seat.tileX + dx, y: seat.tileY + dy };
          return ok.has(n.y * map.width + n.x) && !wallBetween(map, seat.tileX, seat.tileY, n.x, n.y);
        });
        expect(near, `${map.id}: asiento (${seat.tileX}, ${seat.tileY})`).toBe(true);
      }
    }
  });

  it("las escaleras están una sobre otra en todos los pisos", () => {
    expect(CONEXIONES.piso2.escaleraAbajo.tiles).toEqual(CONEXIONES.plantaBaja.escaleraArriba.tiles);
    expect(CONEXIONES.piso3.escaleraAbajo.tiles).toEqual(CONEXIONES.piso2.escaleraArriba.tiles);
    // La que baja al sótano está en la misma columna que la que sube del piso 2 al 3.
    expect(CONEXIONES.plantaBaja.escaleraSotano.tiles).toEqual(CONEXIONES.piso2.escaleraArriba.tiles);
    const stairs = (map: OfficeMap) => map.furniture.filter((f) => f.type === "stairs-up" || f.type === "stairwell").map((f) => `${f.x},${f.y}`);
    expect(stairs(piso2)).toEqual(expect.arrayContaining(stairs(plantaBaja)));
    expect(stairs(piso2)).toEqual(expect.arrayContaining(stairs(piso3)));
  });

});

describe("sótano", () => {
  const sotano = area("sotano");
  const llegada = CONEXIONES.sotano.escalera.llegada;
  /** Habitación de un tile (la última que lo contiene, como en build.ts). */
  const roomAt = (x: number, y: number) =>
    sotano.def.rooms.filter((r) => x >= r.rect.x && x < r.rect.x + r.rect.w && y >= r.rect.y && y < r.rect.y + r.rect.h).at(-1)?.id;

  it("ninguna sala se cruza para llegar a otra: todo se reparte desde el vestíbulo y el pasillo", () => {
    for (const room of sotano.def.rooms) {
      if (room.id === "vestibulo" || room.id === "pasillo") continue;
      const { x, y, w, h } = room.rect;
      const target = Array.from({ length: w * h }, (_, i) => ({ x: x + (i % w), y: y + Math.floor(i / w) })).find(
        (t) => roomAt(t.x, t.y) === room.id && !isBlockedTile(sotano, t.x, t.y),
      )!;
      const path = findPath(sotano, llegada, target);
      expect(path, room.id).not.toBeNull();
      const crossed = new Set(path!.map((t) => roomAt(t.x, t.y)));
      for (const id of crossed) expect(["vestibulo", "pasillo", room.id], `${room.id} cruza ${id}`).toContain(id);
    }
  });

  it("cada puerta une una sala con el vestíbulo o el pasillo (no hay puertas entre salas)", () => {
    for (const d of sotano.def.doors) {
      // Los dos tiles a cada lado del borde: el borde "h" en y separa (x, y-1) de (x, y); el "v" en x, (x-1, y) de (x, y).
      const sides = d.edge === "h" ? [roomAt(d.x, d.y - 1), roomAt(d.x, d.y)] : [roomAt(d.x - 1, d.y), roomAt(d.x, d.y)];
      const hub = sides.filter((id) => id === "vestibulo" || id === "pasillo");
      expect(hub.length, `puerta ${d.edge} (${d.x}, ${d.y}): ${sides.join(" / ")}`).toBeGreaterThan(0);
    }
  });

  it("el vestíbulo tiene un neón por sala", () => {
    const vest = sotano.def.rooms.find((r) => r.id === "vestibulo")!.rect;
    const neons = sotano.def.features.filter(
      (f) => f.kind === "neon" && f.x >= vest.x && f.x < vest.x + vest.w && f.y >= vest.y && f.y < vest.y + vest.h,
    );
    expect(neons.map((n) => n.text).sort()).toEqual(["ARCADE", "CASINO", "CINE", "CLUB"]);
  });

  it("hay un punto de arcade delante de cada máquina, en el mismo orden", () => {
    const cabinets = sotano.furniture.filter((f) => f.type === "arcade-cabinet");
    const spots = pointsOfType(sotano, "arcade");
    expect(spots).toHaveLength(cabinets.length);
    cabinets.forEach((c, i) => {
      const s = spots[i]!;
      // Del lado al que mira la pantalla.
      const front = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] }[c.facing];
      expect([s.tileX - c.x, s.tileY - c.y], s.name).toEqual(front);
    });
  });

  it("la ruleta, la barra del club, la tarima, la caja y el proyector tienen sus puntos junto al mueble", () => {
    const near = (type: string, furniture: string[]) =>
      pointsOfType(sotano, type).every((p) =>
        sotano.furniture.some(
          (f) => furniture.includes(f.type) && p.tileX >= f.x - 1 && p.tileX <= f.x + f.w && p.tileY >= f.y - 1 && p.tileY <= f.y + f.d,
        ),
      );
    expect(pointsOfType(sotano, "roulette").length).toBeGreaterThanOrEqual(8);
    expect(near("roulette", ["roulette-table"])).toBe(true);
    expect(pointsOfType(sotano, "club_bar").length).toBeGreaterThanOrEqual(2);
    expect(near("club_bar", ["bar-counter", "bar-taps", "cigar-case"])).toBe(true);
    expect(near("pole_stage", ["dance-pole"])).toBe(true);
    expect(near("casino_cashier", ["casino-cashier"])).toBe(true);
    expect(near("cinema", ["projector"])).toBe(true);
  });

  it("todos los puntos del sótano se alcanzan caminando desde la escalera", () => {
    for (const p of sotano.points) {
      expect(isBlockedTile(sotano, p.tileX, p.tileY), `${p.type} ${p.name} sobre un mueble`).toBe(false);
      expect(findPath(sotano, llegada, { x: p.tileX, y: p.tileY }), `${p.type} ${p.name}`).not.toBeNull();
    }
  });
});
