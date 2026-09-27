import { describe, expect, it } from "vitest";
import { getWorld } from "../index";
import { drawRoomWalls } from "./room";

describe("paredes altas del modo privado", () => {
  const piso2 = getWorld().areas.get("piso-2")!;
  const rect = (id: string) => {
    const z = piso2.zones.find((z) => z.id === id)!;
    const ts = piso2.tileSize;
    return { x: z.x / ts, y: z.y / ts, w: z.width / ts, h: z.height / ts };
  };

  it("cada oficina y la sala de reuniones tienen alguna pared baja del fondo para levantar", () => {
    for (const id of ["office-1", "office-2", "office-3", "office-4", "meeting-main"]) expect(drawRoomWalls(piso2, rect(id)), id).not.toBeNull();
  });

  it("donde ya hay pared alta o una puerta no se dibuja otra", () => {
    // Una sala de un tile pegada a la pared alta del norte y a la del oeste: no hay nada que levantar.
    expect(drawRoomWalls(piso2, { x: 0, y: 0, w: 1, h: 1 })).toBeNull();
  });
});
