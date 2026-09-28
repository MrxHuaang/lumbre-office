import { describe, expect, it } from "vitest";
import { VIAJE, ViajeGoMessage, viajeAreaBlock, viajeNoticeText, viajeSelfBlock, type ViajeBlock, type ViajeSelf } from "./viaje";

const free: ViajeSelf = { gameSeat: false, swimming: false, fainted: false, playing: false, onBusInRoute: false, cooldownLeftMs: 0 };

describe("viaje rápido", () => {
  it("lo de quien viaja, de lo más grave a lo más pasajero", () => {
    expect(viajeSelfBlock(free)).toBeNull();
    expect(viajeSelfBlock({ ...free, cooldownLeftMs: 10, fainted: true })).toBe("fainted");
    expect(viajeSelfBlock({ ...free, swimming: true, gameSeat: true })).toBe("swimming");
    expect(viajeSelfBlock({ ...free, gameSeat: true })).toBe("seated");
    expect(viajeSelfBlock({ ...free, playing: true })).toBe("busy");
    expect(viajeSelfBlock({ ...free, onBusInRoute: true, cooldownLeftMs: 5 })).toBe("route");
    expect(viajeSelfBlock({ ...free, cooldownLeftMs: 1 })).toBe("cooldown");
  });

  it("los niveles con cupo o cierre", () => {
    const none = { treeHouse: null, studio: null };
    expect(viajeAreaBlock("jardin", none)).toBeNull();
    expect(viajeAreaBlock("megabus", none)).toBe("bus");
    expect(viajeAreaBlock("casa-arbol", { treeHouse: "full", studio: null })).toBe("treeFull");
    expect(viajeAreaBlock("casa-arbol", { treeHouse: "locked", studio: null })).toBe("treeLocked");
    // El bloqueo del estudio no cuenta para la casa del árbol, ni al revés.
    expect(viajeAreaBlock("casa-arbol", { treeHouse: null, studio: "onAir" })).toBeNull();
    expect(viajeAreaBlock("podcast", { treeHouse: null, studio: "onAir" })).toBe("onAir");
    expect(viajeAreaBlock("podcast", { treeHouse: null, studio: "full" })).toBe("studioFull");
  });

  it("cada aviso tiene texto y la pausa dice cuánto falta", () => {
    const codes: ViajeBlock[] = ["cooldown", "seated", "swimming", "fainted", "busy", "route", "bus", "office", "treeFull", "treeLocked", "studioFull", "onAir", "unknown", "offline", "here"];
    for (const code of codes) expect(viajeNoticeText({ code }).length).toBeGreaterThan(5);
    expect(viajeNoticeText({ code: "cooldown", waitMs: 2100 })).toContain("3 s");
    expect(viajeNoticeText({ code: "cooldown" })).toContain(`${VIAJE.cooldownMs / 1000} s`);
  });

  it("el mensaje: un lugar o una persona", () => {
    expect(ViajeGoMessage.safeParse({ kind: "place", id: "zona:cafeteria" }).success).toBe(true);
    expect(ViajeGoMessage.safeParse({ kind: "person", userId: "u-1" }).success).toBe(true);
    expect(ViajeGoMessage.safeParse({ kind: "place" }).success).toBe(false);
    expect(ViajeGoMessage.safeParse({ kind: "teleport", x: 1 }).success).toBe(false);
  });
});
