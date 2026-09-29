import { CLOSE_CODE, RECONNECT_WINDOW_SECONDS, RESTART_CLOSE_CODE } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import {
  healthUrl,
  isDeadReconnection,
  isServerUnavailable,
  leaveAction,
  pollUntil,
  RECONNECT_BUDGET_MS,
  reconnectDelays,
  RESTART_BUDGET_MS,
  unreachableText,
  withJitter,
} from "./reconnect";

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe("qué hacer cuando se cierra la sala", () => {
  it("se reintenta todo menos entrar desde otra pestaña", () => {
    expect(leaveAction(CLOSE_CODE.replaced)).toBe("replaced");
    // 1000 y 4000 llegan cuando el servidor se apaga en un deploy: no es una salida voluntaria.
    expect(leaveAction(1000)).toBe("retry");
    expect(leaveAction(4000)).toBe("retry");
    expect(leaveAction(1006)).toBe("retry");
    expect(leaveAction(RESTART_CLOSE_CODE)).toBe("restart");
  });
});

describe("esperas entre intentos", () => {
  it("empiezan cortas, crecen hasta 5 s y cubren más que la ventana del servidor", () => {
    const delays = reconnectDelays();
    expect(delays.slice(0, 4)).toEqual([500, 1000, 2000, 4000]);
    expect(Math.max(...delays)).toBe(5000);
    expect(sum(delays)).toBeLessThanOrEqual(RECONNECT_BUDGET_MS);
    // Varios intentos caen dentro de la ventana en que el servidor guarda el lugar…
    const inWindow = delays.filter((_, i) => sum(delays.slice(0, i + 1)) < RECONNECT_WINDOW_SECONDS * 1000);
    expect(inWindow.length).toBeGreaterThanOrEqual(6);
    // …y se sigue intentando entre 30 y 45 s en total.
    expect(sum(delays)).toBeGreaterThanOrEqual(30_000);
    expect(sum(delays)).toBeLessThanOrEqual(45_000);
  });

  it("tras un reinicio se espera más (el servidor nuevo puede estar arrancando)", () => {
    expect(sum(reconnectDelays(RESTART_BUDGET_MS))).toBeGreaterThan(sum(reconnectDelays()));
    expect(sum(reconnectDelays(RESTART_BUDGET_MS))).toBeLessThanOrEqual(RESTART_BUDGET_MS);
  });

  it("el azar mueve la espera ±25 %", () => {
    expect(withJitter(1000, 0)).toBe(750);
    expect(withJitter(1000, 0.5)).toBe(1000);
    expect(withJitter(1000, 1)).toBe(1250);
    expect(withJitter(1000, 7)).toBe(1250);
  });
});

describe("reconexión que ya no existe", () => {
  it("un MatchMakeError (sala cerrada o lugar vencido) obliga a entrar de nuevo", () => {
    expect(isDeadReconnection(Object.assign(new Error("room disposed"), { name: "MatchMakeError", code: 4212 }))).toBe(true);
    expect(isDeadReconnection({ code: 4214, message: "expired" })).toBe(true);
  });

  it("la red caída o un 5xx del hosting se reintentan", () => {
    expect(isDeadReconnection(new TypeError("Failed to fetch"))).toBe(false);
    expect(isDeadReconnection({ name: "ServerError", code: 503 })).toBe(false);
    expect(isDeadReconnection({ type: "error" })).toBe(false);
    expect(isDeadReconnection(null)).toBe(false);
  });
});

describe("servidor que no está", () => {
  it("la red caída o un 5xx del hosting muestran el aviso de 'no contesta'", () => {
    expect(isServerUnavailable({ type: "error" })).toBe(true);
    expect(isServerUnavailable({ name: "ServerError", code: 502, message: "Bad Gateway" })).toBe(true);
    expect(isServerUnavailable(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("un error con explicación del servidor se muestra tal cual", () => {
    expect(isServerUnavailable({ name: "MatchMakeError", code: 401, message: "Sesión inválida" })).toBe(false);
    expect(isServerUnavailable(new Error("Sesión expirada"))).toBe(false);
    expect(isServerUnavailable(undefined)).toBe(false);
  });
});

describe("despertar al servidor", () => {
  it("arma la URL de salud desde la del WebSocket", () => {
    expect(healthUrl("ws://localhost:2567")).toBe("http://localhost:2567/health");
    expect(healthUrl("wss://lumbre-game.onrender.com")).toBe("https://lumbre-game.onrender.com/health");
    expect(healthUrl("wss://juego.example.com/")).toBe("https://juego.example.com/health");
  });

  function fakeClock() {
    let t = 0;
    return {
      now: () => t,
      sleep: async (ms: number) => {
        t += ms;
      },
      advance: (ms: number) => {
        t += ms;
      },
    };
  }

  it("reintenta hasta que contesta", async () => {
    const clock = fakeClock();
    let calls = 0;
    const ok = await pollUntil(async () => ++calls >= 3, { deadlineMs: 60_000, pauseMs: 2_000, now: clock.now, sleep: clock.sleep });
    expect(ok).toBe(true);
    expect(calls).toBe(3);
    expect(clock.now()).toBe(4_000);
  });

  it("un error cuenta como todavía no, y se rinde al vencer el plazo", async () => {
    const clock = fakeClock();
    let calls = 0;
    const ok = await pollUntil(
      async (timeout) => {
        calls++;
        expect(timeout).toBeGreaterThan(0);
        clock.advance(timeout); // el proxy retuvo la consulta hasta el tope
        throw new Error("sin respuesta");
      },
      { deadlineMs: 60_000, pauseMs: 2_000, now: clock.now, sleep: clock.sleep },
    );
    expect(ok).toBe(false);
    expect(clock.now()).toBeLessThanOrEqual(60_000);
    expect(calls).toBeGreaterThan(1);
  });

  it("para si se cancela", async () => {
    const clock = fakeClock();
    let calls = 0;
    const check = async () => {
      calls++;
      return false;
    };
    const ok = await pollUntil(check, { deadlineMs: 60_000, now: clock.now, sleep: clock.sleep, cancelled: () => calls >= 2 });
    expect(ok).toBe(false);
    expect(calls).toBe(2);
  });

  it("el aviso de pnpm dev solo sale en desarrollo", () => {
    expect(unreachableText(true)).toContain("pnpm dev");
    expect(unreachableText(false)).not.toContain("pnpm");
  });
});
