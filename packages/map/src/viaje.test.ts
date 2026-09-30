import { describe, expect, it } from "vitest";
import { canStandAt, getWorld, isGameSeat, nearestFreeSpot, seatAtTile, travelDestinations, zoneAt } from "./index";

const areas = () => [...getWorld().areas.values()];

describe("destinos del viaje rápido", () => {
  it("cada nivel (menos el bus y el barrio) y sus salas, con ids únicos", () => {
    const list = travelDestinations(areas());
    const ids = list.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const map of areas()) {
      // Al barrio todavía se llega solo en bus (VIR-142).
      if (map.id === "megabus" || map.id === "barrio") expect(ids).not.toContain(`nivel:${map.id}`);
      else expect(ids).toContain(`nivel:${map.id}`);
    }
    expect(ids).toContain("zona:cafeteria");
    expect(ids).toContain("zona:meeting-main");
    // La tarima del escenario y las mesas de la cafetería no son destinos; las mesas de mesa del jardín sí.
    expect(ids).not.toContain("zona:escenario");
    expect(ids).not.toContain("zona:mesa-1");
    expect(ids).toContain("zona:fogata");
    // El estudio es el nivel entero: queda solo como nivel.
    expect(ids).not.toContain("zona:podcast");
  });

  it("junto a la entrada de cada destino hay dónde aparecer", () => {
    for (const d of travelDestinations(areas())) {
      const map = getWorld().areas.get(d.area)!;
      const ts = map.tileSize;
      const spot = nearestFreeSpot(map, (d.tile.x + 0.5) * ts, (d.tile.y + 0.5) * ts, (x, y) => canStandAt(map, x, y));
      expect(spot, d.id).not.toBeNull();
    }
  });

  it("las salas con puerta se entran por afuera de la puerta", () => {
    const d = travelDestinations(areas()).find((x) => x.id === "zona:office-1")!;
    const map = getWorld().areas.get("piso-2")!;
    expect(zoneAt(map, (d.tile.x + 0.5) * 32, (d.tile.y + 0.5) * 32)?.id).not.toBe("office-1");
  });

  it("no busca del otro lado de una pared", () => {
    const map = getWorld().areas.get("piso-2")!;
    const office = map.zones.find((z) => z.id === "office-1")!;
    // Desde el medio de la oficina, con todo lo de adentro prohibido: no sale por la pared en pocos pasos.
    const inside = (x: number, y: number) => zoneAt(map, x, y)?.id === "office-1";
    const spot = nearestFreeSpot(map, office.x + office.width / 2, office.y + office.height / 2, (x, y) => !inside(x, y) && canStandAt(map, x, y), 2);
    expect(spot).toBeNull();
  });
});

describe("asientos de los que no se viaja", () => {
  it("la tina y las sillas del ajedrez sí; una silla cualquiera no", () => {
    const jardin = getWorld().areas.get("jardin")!;
    const tub = [...jardin.seats.values()].find((s) => s.type === "hot-tub")!;
    expect(isGameSeat(jardin, tub.x, tub.y, tub.type)).toBe(true);
    const piso3 = getWorld().areas.get("piso-3")!;
    const chess = seatAtTile(piso3, 18, 16)!;
    expect(isGameSeat(piso3, chess.x, chess.y, chess.type)).toBe(true);
    const piso2 = getWorld().areas.get("piso-2")!;
    const chair = [...piso2.seats.values()].find((s) => zoneAt(piso2, s.x, s.y)?.type === "office")!;
    expect(isGameSeat(piso2, chair.x, chair.y, chair.type)).toBe(false);
  });
});
