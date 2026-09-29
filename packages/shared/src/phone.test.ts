import { describe, expect, it } from "vitest";
import { callClock, callEndText, canCallStatus, directoryStatus, PhoneCallMessage, phoneDirectory } from "./phone";

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

  it("el directorio lista las oficinas con dueño y a toda la gente conectada sin oficina", () => {
    const offices = [
      { zoneId: "office-1", name: "Oficina 1", ownerId: "u-bob", ownerName: "Bob" },
      { zoneId: "office-2", name: "Oficina 2", ownerId: "u-dora", ownerName: "Dora" },
      { zoneId: "office-3", name: "Oficina 3", ownerId: "", ownerName: "" },
      { zoneId: "office-4", name: "Oficina 4", ownerId: "u-yo", ownerName: "Yo" },
    ];
    const players = [
      { userId: "u-yo", name: "Yo", status: "available", zoneId: "", call: "" },
      { userId: "u-bob", name: "Bob", status: "available", zoneId: "office-1", call: "" },
      { userId: "u-carla", name: "Carla", status: "available", zoneId: "", call: "" },
      { userId: "u-eva", name: "Eva", status: "dnd", zoneId: "cafeteria", call: "" },
      { userId: "u-ana", name: "Ana", status: "available", zoneId: "", call: "talking" },
    ];
    const dir = phoneDirectory(offices, players, "u-yo");
    expect(dir.map((e) => [e.kind, e.name, e.status])).toEqual([
      ["person", "Ana", "busy"],
      ["office", "Bob", "office"],
      ["person", "Carla", "elsewhere"],
      ["office", "Dora", "offline"],
      ["person", "Eva", "dnd"],
    ]);
    // Bob tiene oficina: sale una sola vez (la de su oficina), y a mí no me listo.
    expect(dir.filter((e) => e.userId === "u-bob")).toHaveLength(1);
    expect(dir.some((e) => e.userId === "u-yo")).toBe(false);
  });

  it("el teléfono llama a una oficina o a una persona", () => {
    expect(PhoneCallMessage.safeParse({ zoneId: "office-1" }).success).toBe(true);
    expect(PhoneCallMessage.safeParse({ userId: "u-carla" }).success).toBe(true);
    expect(PhoneCallMessage.safeParse({}).success).toBe(false);
  });
});
