import { describe, expect, it } from "vitest";
import { canStandAt, findPath, isBlockedTile, nearestFreeTile, placeAt, placeLabel, pointsOfType, spawnPoint, zoneAt } from "./index";
import { loadOfficeMap } from "./node";

const map = loadOfficeMap();
const center = (t: number) => t * map.tileSize + map.tileSize / 2;

describe("parseOfficeMap", () => {
  it("lee dimensiones, zonas y puntos del mapa generado", () => {
    expect(map.width).toBe(40);
    expect(map.height).toBe(28);
    expect(map.zones.map((z) => z.id)).toEqual(
      expect.arrayContaining(["office-1", "office-2", "office-3", "office-4", "meeting-main", "lab", "lounge"]),
    );
    expect(pointsOfType(map, "seat")).toHaveLength(6);
    expect(pointsOfType(map, "agent_desk")).toHaveLength(6);
    expect(pointsOfType(map, "visitor_spot")).toHaveLength(6);
    expect(pointsOfType(map, "screen").map((s) => s.zone)).toEqual(["meeting-main"]);
  });

  it("marca muros y muebles como bloqueados y los suelos/sillas como libres", () => {
    expect(isBlockedTile(map, 0, 0)).toBe(true); // muro perimetral
    expect(isBlockedTile(map, 32, 5)).toBe(true); // mesa de reuniones
    expect(isBlockedTile(map, 32, 4)).toBe(false); // silla
    expect(isBlockedTile(map, 24, 13)).toBe(false); // spawn
    expect(isBlockedTile(map, -1, 5)).toBe(true); // fuera del mapa
  });

  it("todos los puntos de interés son transitables (salvo las pantallas, que van en la pared)", () => {
    for (const p of map.points.filter((p) => p.type !== "screen")) expect(isBlockedTile(map, p.tileX, p.tileY), p.name).toBe(false);
  });
});

describe("zoneAt", () => {
  it("prioriza la zona más pequeña cuando hay solapamiento", () => {
    expect(zoneAt(map, center(5), center(20))?.id).toBe("lab"); // lab está dentro de lounge
    expect(zoneAt(map, center(24), center(13))?.id).toBe("lounge");
    expect(zoneAt(map, center(3), center(5))?.id).toBe("office-1");
    expect(zoneAt(map, center(33), center(8))?.id).toBe("meeting-main");
  });

  it("las oficinas y la sala están aisladas; la zona común no", () => {
    expect(zoneAt(map, center(3), center(5))?.isolated).toBe(true);
    expect(zoneAt(map, center(33), center(8))?.isolated).toBe(true);
    expect(zoneAt(map, center(24), center(13))?.isolated).toBe(false);
  });
});

describe("placeAt", () => {
  const name = (id: string) => map.zones.find((z) => z.id === id)?.name;

  it("devuelve la zona, o la entrada cuando se está en el umbral de una puerta", () => {
    expect(placeAt(map, center(24), center(6))).toBe("office-4");
    expect(placeAt(map, center(24), center(8))).toBe("door:office-4"); // puerta de la oficina 4
    expect(placeAt(map, center(33), center(11))).toBe("door:meeting-main"); // puerta de la sala
    expect(placeAt(map, center(8), center(15))).toBe("door:lab"); // puerta norte del lab
    expect(placeAt(map, center(24), center(13))).toBe("lounge");
  });

  it("genera textos legibles", () => {
    expect(placeLabel("door:office-4", name)).toBe("Entrada · Oficina 4");
    expect(placeLabel("office-2", name)).toBe("Oficina 2");
    expect(placeLabel("", name)).toBe("Pasillo");
  });
});

describe("findPath", () => {
  it("encuentra camino desde el spawn a cada oficina, silla y escritorio de agente", () => {
    const s = spawnPoint(map);
    const targets = [...pointsOfType(map, "seat"), ...pointsOfType(map, "agent_desk"), ...pointsOfType(map, "task_board")];
    targets.push({ ...s, tileX: 3, tileY: 5 }); // dentro de la oficina 1
    for (const t of targets) {
      const path = findPath(map, { x: s.tileX, y: s.tileY }, { x: t.tileX, y: t.tileY });
      expect(path, t.name).not.toBeNull();
      for (const step of path!) expect(isBlockedTile(map, step.x, step.y)).toBe(false);
    }
  });

  it("no corta esquinas en diagonal", () => {
    const s = spawnPoint(map);
    const path = findPath(map, { x: s.tileX, y: s.tileY }, { x: 3, y: 5 })!;
    let prev = { x: s.tileX, y: s.tileY };
    for (const step of path) {
      const dx = step.x - prev.x;
      const dy = step.y - prev.y;
      if (dx !== 0 && dy !== 0) {
        expect(isBlockedTile(map, prev.x + dx, prev.y)).toBe(false);
        expect(isBlockedTile(map, prev.x, prev.y + dy)).toBe(false);
      }
      prev = step;
    }
  });

  it("devuelve null si el destino está bloqueado", () => {
    expect(findPath(map, { x: 24, y: 13 }, { x: 32, y: 5 })).toBeNull();
  });

  it("nearestFreeTile encuentra un tile libre junto a un obstáculo", () => {
    const free = nearestFreeTile(map, { x: 33, y: 5 })!;
    expect(isBlockedTile(map, free.x, free.y)).toBe(false);
  });
});

describe("canStandAt", () => {
  it("rechaza posiciones que invaden un muro", () => {
    expect(canStandAt(map, center(24), center(13))).toBe(true);
    expect(canStandAt(map, map.tileSize + 2, center(13))).toBe(false); // pies tocando el muro oeste
  });
});
