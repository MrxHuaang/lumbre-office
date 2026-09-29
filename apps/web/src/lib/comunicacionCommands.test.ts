import { COMUNICACION } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { comunicacionCommands, type ComCommandsActions, type ComCommandsState, type ComPerson } from "./comunicacionCommands";

const person = (name: string, extra: Partial<ComPerson> = {}): ComPerson => ({
  sessionId: `s-${name}`,
  userId: `u-${name}`,
  name,
  status: "available",
  call: "",
  ...extra,
});

const calls: string[] = [];
const actions: ComCommandsActions = {
  callPerson: (id) => calls.push(`llamar ${id}`),
  addToCall: (id) => calls.push(`sumar ${id}`),
  wavePerson: (id) => calls.push(`saludar ${id}`),
  followPerson: (id) => calls.push(`seguir ${id}`),
  stopFollowing: () => calls.push("soltar"),
  openAnnounce: () => calls.push("anunciar"),
};

const base = (extra: Partial<ComCommandsState> = {}): ComCommandsState => ({
  mySessionId: "s-yo",
  people: [person("yo"), person("ana"), person("bob")],
  call: null,
  following: null,
  canAnnounce: false,
  ...extra,
});

const ids = (s: ComCommandsState) => comunicacionCommands(s, actions).map((c) => c.id);
const byId = (s: ComCommandsState, id: string) => comunicacionCommands(s, actions).find((c) => c.id === id);

describe("comandos de comunicación en la paleta", () => {
  it("por cada persona (sin mí): llamar, saludar y seguir, en Personas; sin anuncio ni dejar de seguir", () => {
    expect(ids(base())).toEqual(["com:llamar:u-ana", "com:saludar:u-ana", "com:seguir:u-ana", "com:llamar:u-bob", "com:saludar:u-bob", "com:seguir:u-bob"]);
    const cmds = comunicacionCommands(base(), actions);
    expect(cmds.every((c) => c.group === "Personas" && !c.disabled)).toBe(true);
    calls.length = 0;
    cmds.forEach((c) => c.run());
    expect(calls).toEqual(["llamar u-ana", "saludar u-ana", "seguir u-ana", "llamar u-bob", "saludar u-bob", "seguir u-bob"]);
  });

  it("No molestar: llamar y saludar se ven apagados con el motivo; seguir sí se puede", () => {
    const s = base({ people: [person("yo"), person("ana", { status: "dnd" })] });
    expect(byId(s, "com:llamar:u-ana")?.disabled).toBe("Está en No molestar");
    expect(byId(s, "com:saludar:u-ana")?.disabled).toBe("Está en No molestar");
    expect(byId(s, "com:seguir:u-ana")?.disabled).toBeFalsy();
  });

  it("ocupados: quien está en otra llamada, o yo mientras suena la mía", () => {
    expect(byId(base({ people: [person("yo"), person("ana", { call: "talking" })] }), "com:llamar:u-ana")?.disabled).toBe("Está en otra llamada");
    const ringing = base({ call: { phase: "calling", members: [{ userId: "u-bob" }] } });
    expect(byId(ringing, "com:llamar:u-ana")?.disabled).toBe("Ya estás en una llamada");
    // A quien ya está en mi llamada no se le ofrece llamar.
    expect(byId(ringing, "com:llamar:u-bob")).toBeUndefined();
  });

  it("hablando en una llamada: 'Sumar a X a la llamada' en vez de llamar, con el cupo", () => {
    const s = base({ call: { phase: "talking", members: [{ userId: "u-bob" }] } });
    expect(ids(s)).toContain("com:sumar:u-ana");
    expect(ids(s)).not.toContain("com:llamar:u-ana");
    expect(ids(s)).not.toContain("com:sumar:u-bob");
    expect(byId(s, "com:sumar:u-ana")?.disabled).toBeFalsy();
    // Llena: 6 contándome a mí.
    const full = base({ call: { phase: "talking", members: Array.from({ length: COMUNICACION.maxCallMembers - 1 }, (_, i) => ({ userId: `u-x${i}` })) } });
    expect(byId(full, "com:sumar:u-ana")?.disabled).toBe("La llamada está llena");
    const dnd = base({ people: [person("yo"), person("ana", { status: "dnd" })], call: { phase: "talking", members: [{ userId: "u-bob" }] } });
    expect(byId(dnd, "com:sumar:u-ana")?.disabled).toBe("Está en No molestar");
  });

  it("siguiendo a alguien: 'Dejar de seguir' y no se ofrece seguirla otra vez", () => {
    const s = base({ following: { userId: "u-ana", name: "ana" } });
    expect(ids(s)[0]).toBe("com:dejar-de-seguir");
    expect(ids(s)).not.toContain("com:seguir:u-ana");
    expect(ids(s)).toContain("com:seguir:u-bob");
  });

  it("'Anunciar a toda la cabaña' solo con el permiso", () => {
    expect(ids(base())).not.toContain("com:anunciar");
    expect(byId(base({ canAnnounce: true }), "com:anunciar")).toMatchObject({ title: "Anunciar a toda la cabaña", icon: "megaphone" });
  });
});
