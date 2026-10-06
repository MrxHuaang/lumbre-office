// Los aguinaldos de las novenas: retar, aceptar y los dos juegos (pajita en boca y sí y no), validados por
// el servidor, y el pago del aguinaldo con su tope (ver rooms/aguinaldos.ts). Al final, contra la sala de
// verdad: el chat y los emotes cuentan en la pajita en boca y quien pierde paga.
import type { ColyseusTestServer } from "@colyseus/testing";
import {
  AGUINALDO,
  AGUINALDO_MSG,
  MSG,
  ROOM_NAME,
  SI_NO_PREGUNTAS,
  STAT_KEYS,
  type AguinaldoFin,
  type AguinaldoInvitacion,
  type AguinaldoProblema,
  type AguinaldoView,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Aguinaldos, type AguinaldoPlayer } from "../src/rooms/aguinaldos";
import type { Festivales } from "../src/rooms/festivales";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, token, until, type ServerRoom } from "./helpers";

function setup(opts: { novena?: boolean; balance?: number } = {}) {
  const players = new Map<string, AguinaldoPlayer>([
    ["s-ana", { userId: "u-ana", name: "Ana", area: "jardin", x: 100, y: 100, status: "available" }],
    ["s-beto", { userId: "u-beto", name: "Beto", area: "jardin", x: 140, y: 100, status: "available" }],
    ["s-caro", { userId: "u-caro", name: "Caro", area: "jardin", x: 2000, y: 100, status: "available" }],
  ]);
  const inbox: { to: string; type: string; msg: unknown }[] = [];
  const timers: { fn: () => void; dead: boolean }[] = [];
  let now = 1_000_000;
  let novena = opts.novena ?? true;
  const balance = new Map<string, number>([
    ["u-ana", opts.balance ?? 100],
    ["u-beto", opts.balance ?? 100],
  ]);
  const bumps: { userId: string; key: string }[] = [];
  const pagos: { from: string; to: string; amount: number; refId: string }[] = [];
  let ids = 0;
  const a = new Aguinaldos({
    player: (id) => players.get(id),
    send: (to, type, msg) => inbox.push({ to, type, msg }),
    later: (_ms, fn) => {
      const t = { fn, dead: false };
      timers.push(t);
      return { clear: () => void (t.dead = true) };
    },
    now: () => now,
    enNovena: () => novena,
    pay: async (from, to, amount, refId) => {
      if ((balance.get(from) ?? 0) < amount) return 0;
      balance.set(from, balance.get(from)! - amount);
      balance.set(to, (balance.get(to) ?? 0) + amount);
      pagos.push({ from, to, amount, refId });
      return amount;
    },
    bump: (userId, key) => bumps.push({ userId, key }),
    random: () => 0,
    newId: () => `id-${++ids}`,
  });
  /** Dispara los temporizadores vivos (lo que vence: la invitación, el turno o la pajita). */
  const fire = () => timers.filter((t) => !t.dead).forEach((t) => ((t.dead = true), t.fn()));
  const of = <T>(to: string, type: string) => inbox.filter((m) => m.to === to && m.type === type).map((m) => m.msg as T);
  const last = <T>(to: string, type: string) => of<T>(to, type).at(-1);
  /** Ana reta a Beto y Beto acepta. */
  const start = (juego: "pajita" | "si-no") => {
    a.reto("s-ana", { sessionId: "s-beto", juego });
    const inv = last<AguinaldoInvitacion>("s-beto", AGUINALDO_MSG.invitacion)!;
    a.responder("s-beto", { id: inv.id, accept: true });
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { a, players, inbox, fire, of, last, start, flush, balance, bumps, pagos, setNovena: (v: boolean) => void (novena = v), advance: (ms: number) => void (now += ms) };
}

describe("retar a un aguinaldo", () => {
  it("solo en la novena, de cerca, a otra persona y con una pausa entre retos", () => {
    const s = setup({ novena: false });
    s.a.reto("s-ana", { sessionId: "s-beto", juego: "pajita" });
    expect(s.last<AguinaldoProblema>("s-ana", AGUINALDO_MSG.problema)).toEqual({ code: "noNovena" });
    s.setNovena(true);
    s.a.reto("s-ana", { sessionId: "s-ana", juego: "pajita" });
    expect(s.last<AguinaldoProblema>("s-ana", AGUINALDO_MSG.problema)?.code).toBe("unoMismo");
    s.a.reto("s-ana", { sessionId: "s-caro", juego: "pajita" });
    expect(s.last<AguinaldoProblema>("s-ana", AGUINALDO_MSG.problema)?.code).toBe("lejos");
    s.a.reto("s-ana", { sessionId: "s-beto", juego: "si-no" });
    expect(s.of<AguinaldoInvitacion>("s-beto", AGUINALDO_MSG.invitacion)).toHaveLength(1);
    expect(s.last<AguinaldoInvitacion>("s-beto", AGUINALDO_MSG.invitacion)).toMatchObject({ juego: "si-no", fromName: "Ana" });
    s.a.reto("s-ana", { sessionId: "s-beto", juego: "si-no" });
    expect(s.last<AguinaldoProblema>("s-ana", AGUINALDO_MSG.problema)?.code).toBe("pronto");
  });

  it("decir que no o dejarla vencer le avisa a quien retó", () => {
    const s = setup();
    s.a.reto("s-ana", { sessionId: "s-beto", juego: "pajita" });
    const inv = s.last<AguinaldoInvitacion>("s-beto", AGUINALDO_MSG.invitacion)!;
    s.a.responder("s-beto", { id: inv.id, accept: false });
    expect(s.last<AguinaldoProblema>("s-ana", AGUINALDO_MSG.problema)).toEqual({ code: "noQuiso", with: "Beto" });
    expect(s.a.jugando("s-ana")).toBe(false);
    s.advance(AGUINALDO.cooldownMs);
    s.a.reto("s-ana", { sessionId: "s-beto", juego: "pajita" });
    s.fire();
    s.a.responder("s-beto", { id: s.last<AguinaldoInvitacion>("s-beto", AGUINALDO_MSG.invitacion)!.id, accept: true });
    expect(s.last<AguinaldoProblema>("s-beto", AGUINALDO_MSG.problema)?.code).toBe("vencida");
  });
});

describe("pajita en boca", () => {
  it("pierde el primero que escribe en el chat: le paga el aguinaldo al otro", async () => {
    const s = setup();
    s.start("pajita");
    expect(s.last<AguinaldoView>("s-ana", AGUINALDO_MSG.juego)).toMatchObject({ juego: "pajita", leftMs: AGUINALDO.pajitaMs });
    expect(s.a.jugando("s-beto")).toBe(true);
    s.a.chat("s-beto");
    await s.flush();
    const fin = s.last<AguinaldoFin>("s-ana", AGUINALDO_MSG.fin)!;
    expect(fin).toMatchObject({ motivo: "chat", ganador: { name: "Ana" }, perdedor: { name: "Beto" }, pagado: AGUINALDO.puntos });
    expect(s.last<AguinaldoFin>("s-beto", AGUINALDO_MSG.fin)).toEqual(fin);
    expect(s.pagos).toEqual([{ from: "u-beto", to: "u-ana", amount: AGUINALDO.puntos, refId: `aguinaldo:${fin.id}` }]);
    expect(s.bumps).toEqual([{ userId: "u-ana", key: STAT_KEYS.aguinaldosGanados }]);
    // Ya terminó: hablar después no cuenta.
    s.a.chat("s-ana");
    expect(s.of("s-ana", AGUINALDO_MSG.fin)).toHaveLength(1);
  });

  it("un emote también pierde; si nadie habla, empatan y nadie paga", async () => {
    const s = setup();
    s.start("pajita");
    s.a.emote("s-ana");
    await s.flush();
    expect(s.last<AguinaldoFin>("s-ana", AGUINALDO_MSG.fin)).toMatchObject({ motivo: "emote", perdedor: { name: "Ana" } });
    s.advance(AGUINALDO.cooldownMs);
    s.start("pajita");
    s.fire();
    await s.flush();
    expect(s.last<AguinaldoFin>("s-ana", AGUINALDO_MSG.fin)).toMatchObject({ motivo: "empate", ganador: null, pagado: 0 });
    expect(s.pagos).toHaveLength(1);
  });

  it("irse o rendirse pierde; sin saldo, gana igual pero no se paga", async () => {
    const s = setup({ balance: 0 });
    s.start("pajita");
    s.a.leave("s-beto");
    await s.flush();
    expect(s.last<AguinaldoFin>("s-ana", AGUINALDO_MSG.fin)).toMatchObject({ motivo: "seFue", ganador: { name: "Ana" }, pagado: 0 });
    s.advance(AGUINALDO.cooldownMs);
    s.start("pajita");
    s.a.rendirse("s-ana");
    await s.flush();
    expect(s.last<AguinaldoFin>("s-beto", AGUINALDO_MSG.fin)).toMatchObject({ motivo: "rindio", ganador: { name: "Beto" } });
  });
});

describe("sí y no", () => {
  it("el servidor pregunta por turnos (primero al retado) y una respuesta sin sí ni no pasa el turno", () => {
    const s = setup();
    s.start("si-no");
    const v1 = s.last<AguinaldoView>("s-ana", AGUINALDO_MSG.juego)!;
    expect(v1).toMatchObject({ juego: "si-no", turno: "s-beto", numero: 1 });
    expect(SI_NO_PREGUNTAS).toContain(v1.pregunta);
    // Fuera de turno no cuenta.
    s.a.respuesta("s-ana", { text: "sí" });
    expect(s.of("s-ana", AGUINALDO_MSG.fin)).toHaveLength(0);
    s.a.respuesta("s-beto", { text: "Puede ser, quién sabe" });
    const v2 = s.last<AguinaldoView>("s-ana", AGUINALDO_MSG.juego)!;
    expect(v2).toMatchObject({ turno: "s-ana", numero: 2, ultima: { name: "Beto", text: "Puede ser, quién sabe" } });
    expect(v2.pregunta).not.toBe(v1.pregunta);
  });

  it("decir sí o no pierde, con la palabra que se le escapó", async () => {
    const s = setup();
    s.start("si-no");
    s.a.respuesta("s-beto", { text: "Nooo, para nada" });
    await s.flush();
    expect(s.last<AguinaldoFin>("s-ana", AGUINALDO_MSG.fin)).toMatchObject({ motivo: "dijo", palabra: "nooo", perdedor: { name: "Beto" }, pagado: AGUINALDO.puntos });
  });

  it("quedarse callado pierde; si nadie cae en todas las preguntas, empatan", async () => {
    const s = setup();
    s.start("si-no");
    s.fire();
    await s.flush();
    expect(s.last<AguinaldoFin>("s-ana", AGUINALDO_MSG.fin)).toMatchObject({ motivo: "callado", perdedor: { name: "Beto" } });
    s.advance(AGUINALDO.cooldownMs);
    s.start("si-no");
    for (let i = 0; i < AGUINALDO.rondas * 2; i++) {
      const v = s.last<AguinaldoView>("s-ana", AGUINALDO_MSG.juego)!;
      s.a.respuesta(v.turno!, { text: "Tal vez" });
    }
    await s.flush();
    expect(s.last<AguinaldoFin>("s-ana", AGUINALDO_MSG.fin)).toMatchObject({ motivo: "empate", ganador: null });
  });
});

describe("aguinaldos en la sala", () => {
  let colyseus: ColyseusTestServer;
  let repo: MemoryRepository;
  beforeAll(async () => {
    colyseus = await bootServer(new MemoryRepository());
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
    repo = new MemoryRepository();
    OfficeRoom.repo = repo;
  });
  afterEach(() => {
    OfficeRoom.aguinaldoTimings = {};
  });

  async function setupRoom() {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const ana = await colyseus.connectTo(room, { token: await token("u-ana", "Ana") });
    const beto = await colyseus.connectTo(room, { token: await token("u-beto", "Beto", "bruno") });
    await room.waitForNextPatch();
    const box = (c: ClientRoom) => {
      const b = { inv: [] as AguinaldoInvitacion[], fin: [] as AguinaldoFin[], views: [] as AguinaldoView[], prob: [] as AguinaldoProblema[] };
      c.onMessage(AGUINALDO_MSG.invitacion, (m: AguinaldoInvitacion) => b.inv.push(m));
      c.onMessage(AGUINALDO_MSG.fin, (m: AguinaldoFin) => b.fin.push(m));
      c.onMessage(AGUINALDO_MSG.juego, (m: AguinaldoView) => b.views.push(m));
      c.onMessage(AGUINALDO_MSG.problema, (m: AguinaldoProblema) => b.prob.push(m));
      return b;
    };
    return { room, ana, beto, a: box(ana), b: box(beto) };
  }

  it("fuera de las novenas no se puede retar", async () => {
    const { ana, beto, a } = await setupRoom();
    ana.send(AGUINALDO_MSG.reto, { sessionId: beto.sessionId, juego: "pajita" });
    await until(() => a.prob.length, "el problema");
    expect(a.prob[0]!.code).toBe("noNovena");
  });

  it("pajita en boca: Beto escribe en el chat, pierde y le paga a Ana", async () => {
    await repo.awardPoints({ userId: "u-beto", amount: 50, reason: "ADMIN" });
    const { room, ana, beto, a, b } = await setupRoom();
    (room as unknown as { festivales: Festivales }).festivales.force("novenas");
    ana.send(AGUINALDO_MSG.reto, { sessionId: beto.sessionId, juego: "pajita" });
    await until(() => b.inv.length, "la invitación");
    beto.send(AGUINALDO_MSG.responder, { id: b.inv[0]!.id, accept: true });
    await until(() => a.views.length && b.views.length, "el juego");
    beto.send(MSG.chatSend, { text: "jajaja", scope: "proximity" });
    await until(() => a.fin.length && b.fin.length, "el final");
    expect(a.fin[0]).toMatchObject({ motivo: "chat", ganador: { name: "Ana" }, pagado: AGUINALDO.puntos });
    expect(await repo.getPoints("u-beto")).toBe(50 - AGUINALDO.puntos);
    expect(await repo.getPoints("u-ana")).toBe(AGUINALDO.puntos);
  });

  it("sí y no: Beto dice que sí y pierde (sin saldo no paga)", async () => {
    const { room, ana, beto, a, b } = await setupRoom();
    (room as unknown as { festivales: Festivales }).festivales.force("novenas");
    ana.send(AGUINALDO_MSG.reto, { sessionId: beto.sessionId, juego: "si-no" });
    await until(() => b.inv.length, "la invitación");
    beto.send(AGUINALDO_MSG.responder, { id: b.inv[0]!.id, accept: true });
    await until(() => b.views.length, "la primera pregunta");
    expect(b.views[0]!.turno).toBe(beto.sessionId);
    beto.send(AGUINALDO_MSG.respuesta, { text: "Sí, claro" });
    await until(() => a.fin.length, "el final");
    expect(a.fin[0]).toMatchObject({ motivo: "dijo", palabra: "si", ganador: { name: "Ana" }, pagado: 0 });
  });
});
