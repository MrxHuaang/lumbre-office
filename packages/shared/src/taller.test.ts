import { describe, expect, it } from "vitest";
import { usableSpec } from "./consumables";
import { carTaken, isTallerAction, TALLER, TALLER_LINES, TALLER_USABLES, tallerLine } from "./taller";

describe("el taller del garaje", () => {
  it("los cuatro muebles del taller se usan, con su acción", () => {
    expect(usableSpec("compressor")?.action).toBe("inflate");
    expect(usableSpec("tarp-car")?.action).toBe("drive");
    expect(usableSpec("workbench")?.action).toBe("sand");
    expect(usableSpec("tool-chest")?.action).toBe("rattle");
    for (const spec of Object.values(TALLER_USABLES)) expect(isTallerAction(spec.action)).toBe(true);
  });

  it("no dan nada a la mano (sin economía)", () => {
    for (const spec of Object.values(TALLER_USABLES)) expect(spec.gives).toBeUndefined();
  });

  it("la pausa del carro es lo que dura al volante", () => {
    expect(TALLER_USABLES["tarp-car"]!.cooldownMs).toBe(TALLER.driveMs);
  });

  it("el mensaje sale de la semilla: todos ven el mismo", () => {
    expect(tallerLine("drive", 5)).toBe(tallerLine("drive", 5));
    const lines = new Set(Array.from({ length: 40 }, (_, i) => tallerLine("sand", i)));
    expect(lines).toEqual(new Set(TALLER_LINES.sand));
    expect(TALLER_LINES.inflate).toContain(tallerLine("inflate", -3));
  });

  it("el carro está tomado solo por otra persona y mientras no se cumple el tiempo", () => {
    const seat = { userId: "ana", until: 1000 };
    expect(carTaken(undefined, "bruno", 0)).toBe(false);
    expect(carTaken(seat, "bruno", 999)).toBe(true);
    expect(carTaken(seat, "ana", 999)).toBe(false);
    expect(carTaken(seat, "bruno", 1000)).toBe(false);
  });
});
