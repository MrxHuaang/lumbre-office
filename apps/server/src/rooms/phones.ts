// Llamadas entre oficinas (ver packages/shared/src/phone.ts). Todo va por userId: la llamada es a la
// persona, así sobrevive a una reconexión o a recargar la pestaña (la sesión nueva la retoma). Lo que
// depende del mapa (estar junto a un teléfono, que la oficina tenga dueño) lo revisa la sala antes.
import type { CallEndReason, CallPhase, PhoneError, PhoneEvent } from "@hyvento/shared";

/** Lo que importa de una persona conectada para llamarla. */
export interface PhoneWho {
  userId: string;
  name: string;
  status: string;
}

export interface PhonesDeps {
  later: (ms: number, fn: () => void) => { clear(): void };
  now: () => number;
  newId: () => string;
  ringMs: () => number;
  /** Aviso a todas las sesiones de esa persona. */
  send: (userId: string, event: PhoneEvent) => void;
  /** Refleja la llamada en el estado (`Player.call`, `callWith`, `callSince`): lo ven todos. */
  setPhase: (userId: string, phase: CallPhase, withUserId: string, since: number) => void;
}

interface Call {
  id: string;
  caller: PhoneWho;
  callee: PhoneWho;
  /** Desde dónde llama, para "te llama desde …". */
  from: string;
  phase: "ringing" | "talking";
  endsAt: number;
  since: number;
  timer?: { clear(): void };
}

export class Phones {
  private calls = new Map<string, Call>();
  private ofUser = new Map<string, Call>();

  constructor(private readonly deps: PhonesDeps) {}

  /** Fase de la llamada de alguien ("" si no está en ninguna). */
  phaseOf(userId: string): CallPhase {
    const call = this.ofUser.get(userId);
    if (!call) return "";
    if (call.phase === "talking") return "talking";
    return call.caller.userId === userId ? "calling" : "ringing";
  }

  /**
   * Llamar: `callee` undefined = no está conectado. Devuelve el error, o null si empezó a sonar. La sala
   * ya revisó que `caller` esté junto a un teléfono y que la oficina tenga dueño.
   */
  call(caller: PhoneWho, callee: PhoneWho | undefined, from: string): PhoneError | null {
    if (this.ofUser.has(caller.userId)) return "in-call";
    if (!callee) return "offline";
    if (callee.userId === caller.userId) return "self";
    if (this.ofUser.has(callee.userId)) return "busy";
    if (callee.status === "dnd") return "dnd";
    const now = this.deps.now();
    const call: Call = { id: this.deps.newId(), caller, callee, from, phase: "ringing", endsAt: now + this.deps.ringMs(), since: 0 };
    call.timer = this.deps.later(this.deps.ringMs(), () => {
      if (this.calls.get(call.id) === call && call.phase === "ringing") this.end(call, "timeout", call.callee.userId);
    });
    this.calls.set(call.id, call);
    this.ofUser.set(caller.userId, call);
    this.ofUser.set(callee.userId, call);
    this.announce(call);
    return null;
  }

  /** Contestar (o rechazar) la llamada que me suena. */
  answer(userId: string, callId: string, accept: boolean) {
    const call = this.calls.get(callId);
    if (!call || call.callee.userId !== userId || call.phase !== "ringing") return;
    if (!accept) return this.end(call, "declined", userId);
    call.timer?.clear();
    call.timer = undefined;
    call.phase = "talking";
    call.since = this.deps.now();
    this.announce(call);
  }

  /** Colgar desde cualquiera de los dos lados (a quien le suena, colgar es rechazar). */
  hangup(userId: string) {
    const call = this.ofUser.get(userId);
    if (!call) return;
    const rejecting = call.phase === "ringing" && call.callee.userId === userId;
    this.end(call, rejecting ? "declined" : "hangup", userId);
  }

  /** Se fue de la cabaña (sin sesiones): la llamada se corta. */
  left(userId: string) {
    const call = this.ofUser.get(userId);
    if (call) this.end(call, "left", userId);
  }

  /** Una sesión nueva de alguien en llamada (recargó la página): vuelve a recibir el estado y el aviso. */
  restore(userId: string) {
    const call = this.ofUser.get(userId);
    if (call) this.announce(call, userId);
  }

  /** Cambió el nombre de alguien: el del otro lado lo ve en su chip la próxima vez que se avise. */
  rename(userId: string, name: string) {
    const call = this.ofUser.get(userId);
    if (!call) return;
    if (call.caller.userId === userId) call.caller.name = name;
    else call.callee.name = name;
  }

  dispose() {
    for (const call of this.calls.values()) call.timer?.clear();
    this.calls.clear();
    this.ofUser.clear();
  }

  /** Publica la llamada en el estado y avisa a los dos (o solo a `only`). */
  private announce(call: Call, only?: string) {
    const { caller, callee } = call;
    for (const [me, other] of [
      [caller, callee],
      [callee, caller],
    ] as const) {
      if (only && me.userId !== only) continue;
      this.deps.setPhase(me.userId, this.phaseOf(me.userId), other.userId, call.since);
      const base = { callId: call.id, withUserId: other.userId, withName: other.name };
      if (call.phase === "talking") this.deps.send(me.userId, { kind: "connected", ...base, since: call.since });
      else if (me === caller) this.deps.send(me.userId, { kind: "calling", ...base, endsAt: call.endsAt });
      else this.deps.send(me.userId, { kind: "ringing", ...base, from: call.from, endsAt: call.endsAt });
    }
  }

  private end(call: Call, reason: CallEndReason, byUserId: string) {
    call.timer?.clear();
    this.calls.delete(call.id);
    for (const [me, other] of [
      [call.caller, call.callee],
      [call.callee, call.caller],
    ] as const) {
      if (this.ofUser.get(me.userId) === call) this.ofUser.delete(me.userId);
      this.deps.setPhase(me.userId, "", "", 0);
      this.deps.send(me.userId, {
        kind: "ended",
        callId: call.id,
        withName: other.name,
        reason,
        byMe: me.userId === byUserId,
        caller: me === call.caller,
      });
    }
  }
}
