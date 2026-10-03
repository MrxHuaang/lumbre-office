import { describe, expect, it } from "vitest";
import {
  CORRECTION_IGNORE_WINDOW_MS,
  CORRECTION_LERP_MS,
  CorrectionGate,
  correctionIsStale,
  correctionStyle,
  lerpCorrection,
} from "./correcciones";
import { MoveMessage } from "./protocol";

describe("correcciones de posición", () => {
  it("MoveMessage acepta seq opcional, entero y no negativo", () => {
    const base = { x: 1, y: 2, dir: "down", moving: false } as const;
    expect(MoveMessage.safeParse(base).success).toBe(true);
    expect(MoveMessage.safeParse({ ...base, seq: 0 }).success).toBe(true);
    expect(MoveMessage.safeParse({ ...base, seq: 42 }).success).toBe(true);
    expect(MoveMessage.safeParse({ ...base, seq: -1 }).success).toBe(false);
    expect(MoveMessage.safeParse({ ...base, seq: 1.5 }).success).toBe(false);
  });

  it("solo es vieja la de un paso anterior al último enviado", () => {
    expect(correctionIsStale({ seq: 3 }, 5)).toBe(true);
    expect(correctionIsStale({ seq: 5 }, 5)).toBe(false);
    // Sin seq: acción del servidor (portal, viaje, sentarse…) o servidor viejo: nunca se ignora.
    expect(correctionIsStale({}, 5)).toBe(false);
    expect(correctionIsStale({ seq: null as unknown as number }, 5)).toBe(false);
  });

  it("no ignora dos correcciones viejas seguidas dentro de la ventana", () => {
    const gate = new CorrectionGate();
    expect(gate.shouldIgnore({ seq: 1 }, 3, 1000)).toBe(true);
    // El servidor sigue rechazando: la siguiente se aplica para volver a coincidir.
    expect(gate.shouldIgnore({ seq: 2 }, 4, 1060)).toBe(false);
    // Y después se puede volver a ignorar una.
    expect(gate.shouldIgnore({ seq: 3 }, 5, 1120)).toBe(true);
    // Pasada la ventana, otra vieja también se ignora.
    expect(gate.shouldIgnore({ seq: 9 }, 12, 1120 + CORRECTION_IGNORE_WINDOW_MS + 1)).toBe(true);
  });

  it("las correcciones vigentes o sin seq no gastan la ventana", () => {
    const gate = new CorrectionGate();
    expect(gate.shouldIgnore({ seq: 4 }, 4, 0)).toBe(false);
    expect(gate.shouldIgnore({}, 4, 10)).toBe(false);
    expect(gate.shouldIgnore({ seq: 3 }, 4, 20)).toBe(true);
    gate.reset();
    expect(gate.shouldIgnore({ seq: 3 }, 4, 30)).toBe(true);
  });

  it("desliza saltos de menos de un tile en el mismo nivel y aplica de una el resto", () => {
    const from = { x: 100, y: 100, area: "jardin" };
    expect(correctionStyle({ x: 110, y: 100 }, from, 32)).toBe("lerp");
    expect(correctionStyle({ x: 100, y: 100 }, from, 32)).toBe("snap");
    expect(correctionStyle({ x: 140, y: 100 }, from, 32)).toBe("snap");
    expect(correctionStyle({ x: 110, y: 100, area: "planta-baja" }, from, 32)).toBe("snap");
    expect(correctionStyle({ x: 110, y: 100, area: "jardin" }, from, 32)).toBe("lerp");
    expect(correctionStyle({ x: 110, y: 100, seated: true }, from, 32)).toBe("snap");
  });

  it("el deslizamiento es lineal y termina justo en el destino", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 16, y: 8 };
    expect(lerpCorrection(a, b, 0)).toEqual({ x: 0, y: 0, done: false });
    expect(lerpCorrection(a, b, CORRECTION_LERP_MS / 2)).toEqual({ x: 8, y: 4, done: false });
    expect(lerpCorrection(a, b, CORRECTION_LERP_MS)).toEqual({ x: 16, y: 8, done: true });
    expect(lerpCorrection(a, b, CORRECTION_LERP_MS * 3)).toEqual({ x: 16, y: 8, done: true });
    expect(lerpCorrection(a, b, 10, 0)).toEqual({ x: 16, y: 8, done: true });
  });
});
