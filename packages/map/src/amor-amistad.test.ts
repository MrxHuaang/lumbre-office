// La decoración de Amor y amistad (world/festivales/amor-amistad.ts): entra entera (nada se salta por caer
// encima de otra cosa), con sus puntos, y no tapa el paso: desde el portón se llega al cofre, al puesto, al
// trío, a la banca y al patio por el arco.
import { describe, expect, it } from "vitest";
import { TRIO_TILES } from "@hyvento/shared";
import { AMOR_DECOR, AMIGO_COFRE, ARCO_PATIO, BANCA_ENAMORADOS, PUESTO_AMOR } from "./world/festivales/amor-amistad";
import { furnitureTiles } from "./decor";
import { findPath } from "./pathfinding";
import { getWorld, pointsOfType, setFestivalDecor } from "./index";

describe("la decoración de Amor y amistad", () => {
  it("todo lo que pone entra (no se salta nada) y sus puntos quedan libres", () => {
    setFestivalDecor("amor-amistad", 0);
    try {
      const jardin = getWorld().areas.get("jardin")!;
      const def = getWorld().areas.get("jardin")!.def;
      const decor = AMOR_DECOR.build({ ...def, furniture: def.furniture.filter((f) => !f.type.match(/amor|cofre|corazon|rosado|enamorados/)) }, 0)!;
      for (const p of decor.furniture) expect(jardin.furniture.some((f) => f.type === p.type && f.x === p.x && f.y === p.y), `${p.type} ${p.x},${p.y}`).toBe(true);
      for (const t of ["amigo_secreto", "festival_shop", "amor_serenata"] as const) expect(pointsOfType(jardin, t)).toHaveLength(1);
      const cofre = pointsOfType(jardin, "amigo_secreto")[0]!;
      expect([cofre.tileX, cofre.tileY]).toEqual([AMIGO_COFRE.x, AMIGO_COFRE.y + 1]);
      // Los puntos no caen sobre un mueble.
      const taken = new Set(jardin.furniture.flatMap((f) => furnitureTiles(f).map((t) => `${t.x},${t.y}`)));
      for (const p of jardin.points.filter((q) => ["amigo_secreto", "amor_serenata", "festival_shop"].includes(q.type))) expect(taken.has(`${p.tileX},${p.tileY}`)).toBe(false);
    } finally {
      setFestivalDecor(null, 0);
    }
  });

  it("desde el portón se llega a todo lo de la fiesta (y se cruza el arco del patio)", () => {
    setFestivalDecor("amor-amistad", 0);
    try {
      const jardin = getWorld().areas.get("jardin")!;
      const start = { x: 62, y: 62 };
      const goals = [
        { x: AMIGO_COFRE.x, y: AMIGO_COFRE.y + 1 },
        { x: PUESTO_AMOR.x, y: PUESTO_AMOR.y + 1 },
        { x: BANCA_ENAMORADOS.x, y: BANCA_ENAMORADOS.y + 1 },
        { x: TRIO_TILES[1].x, y: TRIO_TILES[1].y + 1 },
        { x: ARCO_PATIO.x + 2, y: ARCO_PATIO.y - 2 },
      ];
      for (const g of goals) expect(findPath(jardin, start, g), `${g.x},${g.y}`).not.toBeNull();
      // El arco: el tile del medio se camina, las puntas no.
      expect(findPath(jardin, { x: ARCO_PATIO.x + 2, y: ARCO_PATIO.y + 2 }, { x: ARCO_PATIO.x + 2, y: ARCO_PATIO.y - 2 })).not.toBeNull();
      expect(jardin.blocked[ARCO_PATIO.y * jardin.width + ARCO_PATIO.x]).toBeTruthy();
      expect(jardin.blocked[ARCO_PATIO.y * jardin.width + ARCO_PATIO.x + 2]).toBeFalsy();
    } finally {
      setFestivalDecor(null, 0);
    }
  });
});
