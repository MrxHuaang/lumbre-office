import { describe, expect, it } from "vitest";
import { callClock, callEndText, canCallStatus, directoryStatus } from "./phone";

describe("teléfono", () => {
  it("el directorio dice cómo está el dueño de cada oficina", () => {
    const owner = (status: string, zoneId = "office-1", call = "") => ({ status, zoneId, call });
    expect(directoryStatus(undefined, "office-1")).toBe("offline");
    expect(directoryStatus(owner("available"), "office-1")).toBe("office");
    expect(directoryStatus(owner("busy", "cafeteria"), "office-1")).toBe("elsewhere");
    expect(directoryStatus(owner("away"), "office-1")).toBe("away");
    expect(directoryStatus(owner("dnd"), "office-1")).toBe("dnd");
    expect(directoryStatus(owner("available", "office-1", "talking"), "office-1")).toBe("busy");
    // Ausente sí suena (como el servidor); ocupado en otra llamada, "No molestar" y desconectado no.
    expect(canCallStatus("away")).toBe(true);
    expect(["busy", "dnd", "offline"].map((s) => canCallStatus(s as never))).toEqual([false, false, false]);
  });

  it("el reloj de la llamada", () => {
    expect(callClock(0)).toBe("00:00");
    expect(callClock(133_400)).toBe("02:13");
    expect(callClock(3_723_000)).toBe("1:02:03");
  });

  it("al terminar: no contestó, llamada perdida y quién colgó", () => {
    const e = { withName: "Juan", byMe: false, caller: true };
    expect(callEndText({ ...e, reason: "timeout" })).toBe("Juan no contestó.");
    expect(callEndText({ ...e, reason: "timeout", caller: false })).toBe("Llamada perdida de Juan.");
    expect(callEndText({ ...e, reason: "declined" })).toBe("Juan no contestó.");
    expect(callEndText({ ...e, reason: "hangup" })).toBe("Juan colgó.");
    expect(callEndText({ ...e, reason: "hangup", byMe: true })).toBeNull();
  });
});
