// Los aguinaldos en la sala (ver aguinaldos.ts de @hyvento/shared): retar a alguien de al lado durante
// las novenas, aceptar, y el juego: en "pajita en boca" la sala se entera de cada mensaje del chat y cada
// emote de los dos (pierde el primero que habla); en "sí y no" la sala hace las preguntas por turnos y
// revisa cada respuesta (pierde quien dice sí o no, o se queda callado). Quien pierde le paga el aguinaldo
// a quien gana. Irse o rendirse también pierde. Este módulo no conoce Colyseus.
import {
  AGUINALDO,
  AGUINALDO_MSG,
  aguinaldoRefId,
  AguinaldoResponderMessage,
  AguinaldoRespuestaMessage,
  AguinaldoRetoMessage,
  dijoSiONo,
  SI_NO_PREGUNTAS,
  STAT_KEYS,
  tradeReach,
  type AguinaldoFin,
  type AguinaldoFinMotivo,
  type AguinaldoInvitacion,
  type AguinaldoJuego,
  type AguinaldoProblema,
  type AguinaldoView,
} from "@hyvento/shared";

export interface AguinaldoPlayer {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
  status: string;
}

export interface AguinaldosDeps {
  player(sessionId: string): AguinaldoPlayer | undefined;
  send(sessionId: string, type: string, msg: unknown): void;
  later(ms: number, fn: () => void): { clear(): void };
  now(): number;
  /** ¿Corre la novena? (los aguinaldos son de ese festival). */
  enNovena(): boolean;
  /** Paga el aguinaldo (GIFT): devuelve lo pagado (0 si no alcanzó el saldo o el tope). */
  pay(fromUserId: string, toUserId: string, amount: number, refId: string): Promise<number>;
  bump(userId: string, key: string): void;
  /** Azar (0..n-1) para el orden de las preguntas; los tests lo fijan. */
  random(n: number): number;
  newId(): string;
  /** Tiempos (los tests los acortan). */
  timings?(): Partial<Record<"inviteMs" | "pajitaMs" | "turnoMs", number>>;
}

interface Lado {
  sessionId: string;
  userId: string;
  name: string;
}

interface Juego {
  id: string;
  juego: AguinaldoJuego;
  a: Lado;
  b: Lado;
  /** Hasta cuándo dura el juego (pajita) o el turno (sí y no). */
  until: number;
  timer: { clear(): void };
  // Sí y no: a quién le toca, las preguntas que quedan y en cuál va.
  turno?: string;
  preguntas: string[];
  numero: number;
  ultima?: { name: string; text: string };
  over: boolean;
}

interface Invitacion {
  id: string;
  juego: AguinaldoJuego;
  from: Lado;
  to: Lado;
  timer: { clear(): void };
}

export class Aguinaldos {
  private juegos = new Map<string, Juego>();
  private bySession = new Map<string, Juego>();
  private invitaciones = new Map<string, Invitacion>();
  private lastReto = new Map<string, number>();

  constructor(private readonly deps: AguinaldosDeps) {}

  private ms(key: "inviteMs" | "pajitaMs" | "turnoMs"): number {
    return this.deps.timings?.()[key] ?? AGUINALDO[key];
  }

  /** ¿Está jugando? (para los tests). */
  jugando(sessionId: string): boolean {
    return this.bySession.has(sessionId);
  }

  private problema(sessionId: string, p: AguinaldoProblema) {
    this.deps.send(sessionId, AGUINALDO_MSG.problema, p);
  }

  private lado(sessionId: string): Lado | null {
    const p = this.deps.player(sessionId);
    return p ? { sessionId, userId: p.userId, name: p.name } : null;
  }

  // ---------- Retar y aceptar ----------

  reto(from: string, raw: unknown) {
    const parsed = AguinaldoRetoMessage.safeParse(raw);
    const me = this.deps.player(from);
    if (!parsed.success || !me) return;
    const to = parsed.data.sessionId;
    const other = this.deps.player(to);
    if (!this.deps.enNovena()) return this.problema(from, { code: "noNovena" });
    if (!other || to === from || other.userId === me.userId) return this.problema(from, { code: "unoMismo" });
    if (this.bySession.has(from) || this.bySession.has(to)) return this.problema(from, { code: "ocupado", with: other.name });
    if (!tradeReach(me, other)) return this.problema(from, { code: "lejos", with: other.name });
    if (other.status === "dnd") return this.problema(from, { code: "dnd", with: other.name });
    const key = `${from}:${to}`;
    const now = this.deps.now();
    if (now - (this.lastReto.get(key) ?? -Infinity) < AGUINALDO.cooldownMs) return this.problema(from, { code: "pronto" });
    for (const [k, at] of this.lastReto) if (now - at >= AGUINALDO.cooldownMs) this.lastReto.delete(k);
    this.lastReto.set(key, now);
    // Una invitación saliente a la vez: la anterior se retira.
    for (const inv of [...this.invitaciones.values()]) if (inv.from.sessionId === from) this.dropInvitacion(inv);
    const id = this.deps.newId();
    const ttl = this.ms("inviteMs");
    const timer = this.deps.later(ttl, () => {
      if (this.invitaciones.delete(id)) this.problema(from, { code: "noQuiso", with: other.name });
    });
    this.invitaciones.set(id, { id, juego: parsed.data.juego, from: { sessionId: from, userId: me.userId, name: me.name }, to: { sessionId: to, userId: other.userId, name: other.name }, timer });
    this.deps.send(to, AGUINALDO_MSG.invitacion, { id, juego: parsed.data.juego, fromSessionId: from, fromName: me.name, ttlMs: ttl } satisfies AguinaldoInvitacion);
  }

  private dropInvitacion(inv: Invitacion) {
    inv.timer.clear();
    this.invitaciones.delete(inv.id);
  }

  responder(sessionId: string, raw: unknown) {
    const parsed = AguinaldoResponderMessage.safeParse(raw);
    if (!parsed.success) return;
    const inv = this.invitaciones.get(parsed.data.id);
    if (!inv || inv.to.sessionId !== sessionId) return parsed.data.accept ? this.problema(sessionId, { code: "vencida" }) : undefined;
    this.dropInvitacion(inv);
    if (!parsed.data.accept) return this.problema(inv.from.sessionId, { code: "noQuiso", with: inv.to.name });
    // Al aceptar se revisa de nuevo: puede que alguno se haya ido, alejado o metido en otro juego.
    const a = this.lado(inv.from.sessionId);
    const b = this.lado(sessionId);
    const pa = this.deps.player(inv.from.sessionId);
    const pb = this.deps.player(sessionId);
    if (!a || !b || !pa || !pb) return this.problema(sessionId, { code: "vencida" });
    if (!this.deps.enNovena()) return this.problema(sessionId, { code: "noNovena" });
    if (this.bySession.has(a.sessionId) || this.bySession.has(b.sessionId)) return this.problema(sessionId, { code: "ocupado", with: a.name });
    if (!tradeReach(pa, pb)) return this.problema(sessionId, { code: "lejos", with: a.name });
    this.empezar(inv.juego, a, b);
  }

  // ---------- El juego ----------

  private empezar(juego: AguinaldoJuego, a: Lado, b: Lado) {
    const now = this.deps.now();
    const g: Juego = { id: this.deps.newId(), juego, a, b, until: 0, timer: { clear: () => undefined }, preguntas: [], numero: 0, over: false };
    this.juegos.set(g.id, g);
    this.bySession.set(a.sessionId, g);
    this.bySession.set(b.sessionId, g);
    if (juego === "pajita") {
      g.until = now + this.ms("pajitaMs");
      g.timer = this.deps.later(this.ms("pajitaMs"), () => void this.terminar(g, null, "empate"));
      this.mostrar(g);
      return;
    }
    // Sí y no: preguntas barajadas sin repetir; contesta primero quien fue retado.
    const pool = [...SI_NO_PREGUNTAS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = this.deps.random(i + 1);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    g.preguntas = pool.slice(0, AGUINALDO.rondas * 2);
    this.turno(g, b.sessionId);
  }

  /** Le toca a alguien contestar la siguiente pregunta (o se acabaron: empate). */
  private turno(g: Juego, sessionId: string) {
    g.timer.clear();
    if (g.numero >= g.preguntas.length) return void this.terminar(g, null, "empate");
    g.numero++;
    g.turno = sessionId;
    g.until = this.deps.now() + this.ms("turnoMs");
    g.timer = this.deps.later(this.ms("turnoMs"), () => void this.terminar(g, sessionId, "callado"));
    this.mostrar(g);
  }

  private view(g: Juego): AguinaldoView {
    const v: AguinaldoView = {
      id: g.id,
      juego: g.juego,
      a: { sessionId: g.a.sessionId, name: g.a.name },
      b: { sessionId: g.b.sessionId, name: g.b.name },
      leftMs: Math.max(0, g.until - this.deps.now()),
    };
    if (g.juego === "si-no") {
      v.turno = g.turno;
      v.pregunta = g.preguntas[g.numero - 1];
      v.numero = g.numero;
      if (g.ultima) v.ultima = g.ultima;
    }
    return v;
  }

  private mostrar(g: Juego) {
    const v = this.view(g);
    this.deps.send(g.a.sessionId, AGUINALDO_MSG.juego, v);
    this.deps.send(g.b.sessionId, AGUINALDO_MSG.juego, v);
  }

  /** Contestó la pregunta del sí y no: si dijo sí o no, pierde; si no, le toca al otro. */
  respuesta(sessionId: string, raw: unknown) {
    const g = this.bySession.get(sessionId);
    const parsed = AguinaldoRespuestaMessage.safeParse(raw);
    if (!g || g.over || g.juego !== "si-no" || g.turno !== sessionId || !parsed.success) return;
    const text = parsed.data.text.trim();
    if (!text) return;
    const palabra = dijoSiONo(text);
    if (palabra) return void this.terminar(g, sessionId, "dijo", palabra);
    const yo = sessionId === g.a.sessionId ? g.a : g.b;
    g.ultima = { name: yo.name, text };
    this.turno(g, sessionId === g.a.sessionId ? g.b.sessionId : g.a.sessionId);
  }

  /** Escribió en el chat: en la pajita en boca, pierde. */
  chat(sessionId: string) {
    const g = this.bySession.get(sessionId);
    if (g && !g.over && g.juego === "pajita") void this.terminar(g, sessionId, "chat");
  }

  /** Hizo un emote: en la pajita en boca, pierde. */
  emote(sessionId: string) {
    const g = this.bySession.get(sessionId);
    if (g && !g.over && g.juego === "pajita") void this.terminar(g, sessionId, "emote");
  }

  rendirse(sessionId: string) {
    const g = this.bySession.get(sessionId);
    if (g && !g.over) void this.terminar(g, sessionId, "rindio");
  }

  /** Se fue de la sala: si estaba jugando, pierde; sus invitaciones se retiran. */
  leave(sessionId: string) {
    for (const inv of [...this.invitaciones.values()]) if (inv.from.sessionId === sessionId || inv.to.sessionId === sessionId) this.dropInvitacion(inv);
    const g = this.bySession.get(sessionId);
    if (g && !g.over) void this.terminar(g, sessionId, "seFue");
  }

  /** Termina el juego: quien perdió (null = empate) paga el aguinaldo y los dos se enteran. */
  private async terminar(g: Juego, perdio: string | null, motivo: AguinaldoFinMotivo, palabra?: string) {
    if (g.over) return;
    g.over = true;
    g.timer.clear();
    this.juegos.delete(g.id);
    this.bySession.delete(g.a.sessionId);
    this.bySession.delete(g.b.sessionId);
    const perdedor = perdio === null ? null : perdio === g.a.sessionId ? g.a : g.b;
    const ganador = perdedor === null ? null : perdedor === g.a ? g.b : g.a;
    let pagado = 0;
    if (perdedor && ganador) {
      this.deps.bump(ganador.userId, STAT_KEYS.aguinaldosGanados);
      pagado = await this.deps.pay(perdedor.userId, ganador.userId, AGUINALDO.puntos, aguinaldoRefId(g.id)).catch((err) => {
        console.error("aguinaldo", err);
        return 0;
      });
    }
    const pub = (l: Lado | null) => (l ? { sessionId: l.sessionId, name: l.name } : null);
    const fin: AguinaldoFin = { id: g.id, juego: g.juego, motivo, ganador: pub(ganador), perdedor: pub(perdedor), pagado, ...(palabra ? { palabra } : {}) };
    this.deps.send(g.a.sessionId, AGUINALDO_MSG.fin, fin);
    this.deps.send(g.b.sessionId, AGUINALDO_MSG.fin, fin);
  }

  dispose() {
    for (const g of this.juegos.values()) g.timer.clear();
    for (const inv of this.invitaciones.values()) inv.timer.clear();
    this.juegos.clear();
    this.bySession.clear();
    this.invitaciones.clear();
  }
}
