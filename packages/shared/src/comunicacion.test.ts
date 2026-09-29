import { describe, expect, it } from "vitest";
import { broadcastLeft, callHasRoom, cleanAnnouncement, COMUNICACION, followNeedsWalk, reduceBroadcast } from "./comunicacion";
import { namesList } from "./phone";
import { hearing, listeners, type Positioned } from "./proximity";

const at = (area: string, x: number, y: number, zoneId: string | null = null, zoneIsolated = false, extra: Partial<Positioned> = {}): Positioned => ({
  area,
  x,
  y,
  zoneId,
  zoneIsolated,
  ...extra,
});

describe("llamadas grupales", () => {
  it("los de la misma llamada se oyen entre todos, en cualquier nivel y a volumen completo", () => {
    const me = at("piso-2", 0, 0, "office-1", true, { call: "c1" });
    const others = new Map<string, Positioned>([
      ["ana", at("jardin", 900, 900, null, false, { call: "c1" })],
      ["bob", at("sotano", 50, 50, "casino", true, { call: "c1" })],
      ["otra-llamada", at("piso-2", 10, 0, "pasillo", false, { call: "c2" })],
      ["afuera", at("piso-2", 10, 0, "pasillo")],
    ]);
    expect(Object.fromEntries(hearing(me, others))).toEqual({ ana: 1, bob: 1 });
    // Y me oyen a mí (los permisos de LiveKit salen de `listeners`).
    expect(listeners(me, "yo", others).sort()).toEqual(["ana", "bob"]);
  });

  it("sin llamada no cuenta: dos personas sin `call` no se oyen por eso", () => {
    const me = at("piso-2", 0, 0, "office-1", true);
    expect(hearing(me, new Map([["lejos", at("jardin", 0, 0)]])).size).toBe(0);
  });

  it("el cupo cuenta a todos los de la llamada", () => {
    expect(callHasRoom(COMUNICACION.maxCallMembers - 1)).toBe(true);
    expect(callHasRoom(COMUNICACION.maxCallMembers)).toBe(false);
    expect(namesList(["Ana"])).toBe("Ana");
    expect(namesList(["Ana", "Bob"])).toBe("Ana y Bob");
    expect(namesList(["Ana", "Bob", "Carla"])).toBe("Ana, Bob y Carla");
  });
});

describe("anuncio por voz (broadcast)", () => {
  const admin = at("planta-baja", 0, 0, "recibidor", false, { broadcast: true });

  it("todos oyen al admin encima de reuniones, salas aisladas, el escenario y otros niveles", () => {
    const reunion = at("piso-3", 400, 400, "meeting", true);
    const tarima = at("jardin", 20, 60, "escenario", true, { stage: "audience" });
    const podcast = at("podcast", 5, 5, "estudio", true);
    for (const p of [reunion, tarima, podcast]) expect(hearing(p, new Map([["admin", admin]])).get("admin")).toBe(1);
  });

  it("es de una sola vía: el admin oye a los demás con las reglas de siempre", () => {
    const others = new Map<string, Positioned>([
      ["reunion", at("piso-3", 400, 400, "meeting", true)],
      ["al-lado", at("planta-baja", 20, 0, "recibidor")],
    ]);
    expect([...hearing(admin, others).keys()]).toEqual(["al-lado"]);
    // Pero todos pueden suscribirse a su micrófono.
    expect(listeners(admin, "admin", others).sort()).toEqual(["al-lado", "reunion"]);
  });

  it("en el estudio grabando no se oye el anuncio (ni el admin puede suscribirse): no entra a la grabación", () => {
    const grabando = at("podcast", 5, 5, "podcast", true, { onAir: true });
    const afuera = at("piso-3", 5, 5, "pasillo");
    expect(hearing(grabando, new Map([["admin", admin]])).size).toBe(0);
    expect(listeners(admin, "admin", new Map([["grabando", grabando], ["afuera", afuera]]))).toEqual(["afuera"]);
    // Sin grabar (el mismo estudio), el anuncio sí llega.
    expect(hearing({ ...grabando, onAir: false }, new Map([["admin", admin]])).get("admin")).toBe(1);
  });

  it("sin anuncio, la reunión sigue aislada", () => {
    const quiet = { ...admin, broadcast: false };
    expect(hearing(at("piso-3", 400, 400, "meeting", true), new Map([["admin", quiet]])).size).toBe(0);
  });
});

describe("el chip del anuncio", () => {
  const start = { kind: "start", userId: "u-ana", name: "Ana", endsAt: 5000 } as const;

  it("un solo chip: retomar (al recargar) o repetir el inicio no lo duplica ni vuelve a sonar", () => {
    const first = reduceBroadcast(null, start);
    expect(first).toMatchObject({ fresh: true, next: { userId: "u-ana", endsAt: 5000 } });
    const again = reduceBroadcast(first.next, start);
    expect(again.fresh).toBe(false);
    expect(again.next).toEqual(first.next);
    // Quien entra (o recarga) en pleno anuncio lo ve con `resumed`: chip sí, timbre no.
    const resumed = reduceBroadcast(null, { ...start, resumed: true });
    expect(resumed).toMatchObject({ fresh: false, next: { userId: "u-ana" } });
  });

  it("termina solo el que se estaba viendo, y la hora pasa a la local", () => {
    const cur = reduceBroadcast(null, start, (t) => t - 1000).next;
    expect(cur!.endsAt).toBe(4000);
    expect(reduceBroadcast(cur, { kind: "end", userId: "u-otra", name: "Otra", reason: "left" })).toMatchObject({ ended: false, next: cur });
    expect(reduceBroadcast(cur, { kind: "end", userId: "u-ana", name: "Ana", reason: "stop" })).toMatchObject({ ended: true, next: null });
  });
});

describe("avisos y seguir", () => {
  it("el aviso se limpia y se recorta", () => {
    expect(cleanAnnouncement("   ")).toBeNull();
    expect(cleanAnnouncement("  Hola\n\n equipo  ")).toBe("Hola equipo");
    const long = cleanAnnouncement("a".repeat(500))!;
    expect(long).toHaveLength(COMUNICACION.announceMaxChars);
    expect(long.endsWith("…")).toBe(true);
  });

  it("el reloj del anuncio", () => {
    expect(broadcastLeft(0)).toBe("0:00");
    expect(broadcastLeft(192_000)).toBe("3:12");
    expect(broadcastLeft(COMUNICACION.broadcastMaxMs)).toBe("10:00");
  });

  it("seguir: al lado me quedo quieto; lejos o en otro nivel, camino", () => {
    const me = { area: "jardin", x: 0, y: 0 };
    expect(followNeedsWalk(me, { area: "jardin", x: 60, y: 0 })).toBe(false);
    expect(followNeedsWalk(me, { area: "jardin", x: 200, y: 0 })).toBe(true);
    expect(followNeedsWalk(me, { area: "planta-baja", x: 0, y: 0 })).toBe(true);
  });
});
