import { buildCasaPropia } from "@hyvento/map";
import { describe, expect, it } from "vitest";
import { sitioDeCama } from "./camas";

describe("dónde va acostado quien duerme", () => {
  const map = buildCasaPropia("casa:u-prueba:arriba")!;
  const cama = map.furniture.find((f) => f.type === "cama-doble")!;
  const ts = map.tileSize;

  it("en el medio de la cama de este nivel", () => {
    const s = sitioDeCama(map, `${map.id}|cama-doble@${cama.x},${cama.y}`)!;
    expect(s.x).toBeGreaterThan(cama.x * ts);
    expect(s.x).toBeLessThan((cama.x + cama.w) * ts);
    expect(s.y).toBeGreaterThan(cama.y * ts);
    expect(s.y).toBeLessThan((cama.y + cama.d) * ts);
    expect([1, -1]).toContain(s.side);
  });

  it("despierto, en otro nivel o con una cama que no está, nada", () => {
    expect(sitioDeCama(map, "")).toBeNull();
    expect(sitioDeCama(map, `jardin|cama-doble@${cama.x},${cama.y}`)).toBeNull();
    expect(sitioDeCama(map, `${map.id}|cama-doble@999,999`)).toBeNull();
    expect(sitioDeCama(map, "cualquier cosa")).toBeNull();
  });
});
