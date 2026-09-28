import { describe, expect, it } from "vitest";
import { cooldownOk, detectApproaches, mentionsName, NEARBY_COOLDOWN_MS, shouldNotify, type NotifyContext } from "./notify";

const ctx = (patch: Partial<NotifyContext> = {}): NotifyContext => ({
  enabled: true,
  permission: "granted",
  visible: false,
  focused: false,
  status: "available",
  ...patch,
});

describe("shouldNotify", () => {
  it("avisa con la pestaña oculta, o visible pero sin foco", () => {
    expect(shouldNotify(ctx())).toBe(true);
    expect(shouldNotify(ctx({ visible: true, focused: false }))).toBe(true);
  });

  it("no avisa con Lumbre a la vista y con foco", () => {
    expect(shouldNotify(ctx({ visible: true, focused: true }))).toBe(false);
  });

  it("no avisa si no se activó o el navegador no dio permiso", () => {
    expect(shouldNotify(ctx({ enabled: false }))).toBe(false);
    expect(shouldNotify(ctx({ permission: "default" }))).toBe(false);
    expect(shouldNotify(ctx({ permission: "denied" }))).toBe(false);
    expect(shouldNotify(ctx({ permission: "unsupported" }))).toBe(false);
  });

  it("no avisa con No molestar (y sí con los demás estados)", () => {
    expect(shouldNotify(ctx({ status: "dnd" }))).toBe(false);
    for (const status of ["available", "busy", "away", undefined]) expect(shouldNotify(ctx({ status }))).toBe(true);
  });
});

describe("cooldownOk", () => {
  it("deja avisar la primera vez y después de que pasa el enfriamiento", () => {
    const last = new Map([["ana", 1000]]);
    expect(cooldownOk(last, "beto", 1000, 500)).toBe(true);
    expect(cooldownOk(last, "ana", 1499, 500)).toBe(false);
    expect(cooldownOk(last, "ana", 1500, 500)).toBe(true);
  });
});

describe("detectApproaches", () => {
  const base = { still: true, now: 10_000_000, lastNotified: new Map<string, number>() };

  it("la primera vista no cuenta: los que ya estaban no se acercaron", () => {
    expect(detectApproaches({ ...base, prev: null, next: new Set(["ana"]) })).toEqual([]);
  });

  it("avisa solo de quien entró al rango", () => {
    expect(detectApproaches({ ...base, prev: new Set(["ana"]), next: new Set(["ana", "beto"]) })).toEqual(["beto"]);
    expect(detectApproaches({ ...base, prev: new Set(["ana", "beto"]), next: new Set(["ana"]) })).toEqual([]);
  });

  it("si soy yo el que camina, no es que se me acercaron", () => {
    expect(detectApproaches({ ...base, still: false, prev: new Set(), next: new Set(["ana"]) })).toEqual([]);
  });

  it("respeta el enfriamiento de 2 minutos por persona", () => {
    const lastNotified = new Map([["ana", base.now - NEARBY_COOLDOWN_MS + 1]]);
    const args = { ...base, lastNotified, prev: new Set<string>(), next: new Set(["ana", "beto"]) };
    expect(detectApproaches(args)).toEqual(["beto"]);
    expect(detectApproaches({ ...args, now: base.now + 1 })).toEqual(["ana", "beto"]);
  });
});

describe("mentionsName", () => {
  it("encuentra el nombre completo o el primero, sin importar tildes ni mayúsculas", () => {
    expect(mentionsName("¿Juan José, vienes?", "Juan José Ordoñez")).toBe(true);
    expect(mentionsName("hola juan", "Juan José")).toBe(true);
    expect(mentionsName("JOSE ya llegó", "José")).toBe(true);
    expect(mentionsName("oye @maria", "María Pérez")).toBe(true);
  });

  it("no confunde un nombre dentro de otra palabra", () => {
    expect(mentionsName("juanita trajo café", "Juan")).toBe(false);
    expect(mentionsName("la anaconda", "Ana")).toBe(false);
    expect(mentionsName("nadie", "")).toBe(false);
  });

  it("con un primer nombre muy corto, solo vale el completo", () => {
    expect(mentionsName("yo no voy", "Yo Tanaka")).toBe(false);
    expect(mentionsName("¿viene yo tanaka?", "Yo Tanaka")).toBe(true);
  });
});
