// El estado completo cabe en el búfer de Colyseus: con un festival prendido pasaba de los 8 KB de fábrica y la
// librería lo codificaba dos veces en cada entrada (avisando "buffer overflow"). Ver STATE_BUFFER_BYTES.
import { Encoder } from "@colyseus/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfficeState, Player, STATE_BUFFER_BYTES } from "../src/state";

afterEach(() => vi.restoreAllMocks());

describe("el búfer del estado", () => {
  it("queda con margen antes de crear cualquier sala", () => {
    expect(Encoder.BUFFER_SIZE).toBeGreaterThanOrEqual(STATE_BUFFER_BYTES);
  });

  it("un estado lleno (40 personas con su pinta) se codifica de una, sin avisar", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = new OfficeState();
    for (let i = 0; i < 40; i++) {
      const p = new Player();
      p.userId = `persona-${i}`;
      p.name = `Persona número ${i}`;
      p.area = "jardin";
      // La pinta va como JSON: es lo que más pesa de cada persona.
      p.look = JSON.stringify({ skin: "#c58c5c", hair: "long", hairColor: "#3b2a20", top: "longsleeve", shirt: "#c8402a", bottom: "pants", pants: "#2a3b5c", shoes: "boots", gear: { head: "flower-hat", neck: "neckerchief" }, i });
      state.players.set(`sesion-${i}`, p);
    }
    const bytes = new Encoder(state).encodeAll();
    expect(bytes.byteLength).toBeGreaterThan(8 * 1024);
    expect(bytes.byteLength).toBeLessThan(STATE_BUFFER_BYTES);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("buffer overflow"))).toBe(false);
  });
});
