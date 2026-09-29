// Llamar sin teléfono y sumar gente a una llamada (ver packages/shared/src/comunicacion.ts). Es el mismo
// flujo del teléfono de escritorio (phones.ts: timbre, contestar, colgar), pero a cualquier persona
// conectada, tenga oficina o no, y desde cualquier lugar. Aquí va lo que el teléfono no revisa: a quién
// (por userId), que no sea uno mismo y la pausa entre llamadas.
import { CELL_ORIGIN, ComPersonMessage, MSG, type PhoneError, type PhoneEvent } from "@hyvento/shared";
import type { Phones, PhoneWho } from "./phones";

export interface LlamadasDeps {
  phones: Phones;
  /** Quien manda el mensaje (por sesión). */
  who: (sessionId: string) => PhoneWho | undefined;
  /** Una persona conectada (por userId), o undefined si no está. */
  whoByUser: (userId: string) => PhoneWho | undefined;
  send: (sessionId: string, type: string, message: unknown) => void;
  now: () => number;
  /** Se llamó (para el logro de las llamadas). */
  called: (userId: string) => void;
  /** Pausa entre llamadas de la misma persona (`COMUNICACION.callCooldownMs`; los tests la acortan). */
  cooldownMs: () => number;
}

export class Llamadas {
  /** userId → cuándo empezó a sonar su última llamada (o la última suma). */
  private lastAt = new Map<string, number>();

  constructor(private readonly deps: LlamadasDeps) {}

  /** Llamar a alguien desde cualquier parte. */
  call(sessionId: string, raw: unknown) {
    this.dial(sessionId, raw, (me, target) => this.deps.phones.call(me, target, CELL_ORIGIN));
  }

  /** Sumar a alguien a la llamada en la que estoy hablando. */
  add(sessionId: string, raw: unknown) {
    this.dial(sessionId, raw, (me, target) => this.deps.phones.add(me, target, CELL_ORIGIN));
  }

  forget(userId: string) {
    this.lastAt.delete(userId);
  }

  private dial(sessionId: string, raw: unknown, ring: (me: PhoneWho, target: PhoneWho | undefined) => PhoneError | null) {
    const parsed = ComPersonMessage.safeParse(raw);
    const me = this.deps.who(sessionId);
    if (!parsed.success || !me) return;
    const target = this.deps.whoByUser(parsed.data.userId);
    const fail = (error: PhoneError) =>
      this.deps.send(sessionId, MSG.phoneEvent, { kind: "failed", error, withName: target?.name ?? "" } satisfies PhoneEvent);
    if (parsed.data.userId === me.userId) return fail("self");
    const now = this.deps.now();
    if (now - (this.lastAt.get(me.userId) ?? -Infinity) < this.deps.cooldownMs()) return fail("too-soon");
    const error = ring(me, target);
    if (error) return fail(error);
    this.lastAt.set(me.userId, now);
    this.deps.called(me.userId);
  }
}
