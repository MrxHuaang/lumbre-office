import { describe, expect, it } from "vitest";
import { forgetOldSession } from "./sesionNueva";
import { useOfficeStore, type PlayerInfo } from "./store";

const player = (sessionId: string, name: string) => ({ sessionId, userId: "u-juan", name }) as unknown as PlayerInfo;

describe("entrar de nuevo con sesión nueva", () => {
  it("olvida los jugadores de la sala vieja (incluido uno mismo) y conserva lo del navegador", () => {
    const store = useOfficeStore.getState();
    store.setSessionId("vieja");
    store.upsertPlayer(player("vieja", "Juan"));
    store.upsertPlayer(player("otra", "Ana"));
    store.addMessages([{ id: "m1" } as never]);
    store.openPanel("mailbox", true);

    forgetOldSession();

    // La sala nueva manda a todos otra vez; con la sesión nueva, la vieja sería un "Juan" fantasma.
    store.setSessionId("nueva");
    store.upsertPlayer(player("nueva", "Juan"));
    const s = useOfficeStore.getState();
    expect(Object.keys(s.players)).toEqual(["nueva"]);
    expect(s.panel).toBeNull();
    expect(s.messages.map((m) => m.id)).toEqual(["m1"]);
  });
});
