// Llamadas (ver packages/shared/src/phone.ts): las del teléfono de escritorio, las de sin teléfono y las
// grupales (se suma gente a una llamada en curso, hasta `COMUNICACION.maxCallMembers`). Todo va por userId:
// la llamada es a la persona, así sobrevive a una reconexión o a recargar la pestaña (la sesión nueva la
// retoma). Lo que depende del mapa (estar junto a un teléfono, que la oficina tenga dueño) o del ritmo
// (la pausa entre llamadas) lo revisa la sala antes.
import { COMUNICACION, type CallEndReason, type CallMember, type CallMemberChange, type CallPhase, type PhoneError, type PhoneEvent } from "@hyvento/shared";

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
  /**
   * Refleja la llamada en el estado (`Player.call`, `callWith`, `callSince` y `callId`): lo ven todos. Los
   * que hablan con el mismo `callId` se oyen entre sí.
   */
  setPhase: (userId: string, phase: CallPhase, withUserId: string, since: number, callId: string) => void;
}

interface Member {
  who: PhoneWho;
  phase: "calling" | "ringing" | "talking";
  /** Para quien le suena: desde dónde lo llaman y quién ("te llama desde …"), por userId y su nombre. */
  from: string;
  by: string;
  byName: string;
  endsAt: number;
  timer?: { clear(): void };
}

interface Call {
  id: string;
  /** Quien llamó primero (el "caller" de los avisos). */
  caller: string;
  /** En orden de llegada. */
  members: Map<string, Member>;
  /** Cuándo contestaron (0 mientras suena la primera vez). */
  since: number;
}

export class Phones {
  private calls = new Map<string, Call>();
  private ofUser = new Map<string, Call>();

  constructor(private readonly deps: PhonesDeps) {}

  /** Fase de la llamada de alguien ("" si no está en ninguna). */
  phaseOf(userId: string): CallPhase {
    return this.ofUser.get(userId)?.members.get(userId)?.phase ?? "";
  }

  /** Los userIds de la llamada de alguien (con quienes les suena), o [] si no está en ninguna. */
  membersOf(userId: string): string[] {
    const call = this.ofUser.get(userId);
    return call ? [...call.members.keys()] : [];
  }

  /**
   * Llamar: `callee` undefined = no está conectado. Devuelve el error, o null si empezó a sonar. La sala
   * ya revisó que `caller` esté junto a un teléfono (o que llame sin teléfono) y que la oficina tenga dueño.
   */
  call(caller: PhoneWho, callee: PhoneWho | undefined, from: string): PhoneError | null {
    if (this.ofUser.has(caller.userId)) return "in-call";
    if (!callee) return "offline";
    if (callee.userId === caller.userId) return "self";
    if (this.ofUser.has(callee.userId)) return "busy";
    if (callee.status === "dnd") return "dnd";
    const call: Call = { id: this.deps.newId(), caller: caller.userId, members: new Map(), since: 0 };
    call.members.set(caller.userId, { who: caller, phase: "calling", from: "", by: "", byName: "", endsAt: 0 });
    this.calls.set(call.id, call);
    this.ofUser.set(caller.userId, call);
    this.ring(call, callee, from, caller);
    this.announce(call);
    return null;
  }

  /**
   * Sumar a `target` a la llamada en la que `adder` está hablando: le suena como una llamada normal y, si
   * contesta, entra a la conversación de todos.
   */
  add(adder: PhoneWho, target: PhoneWho | undefined, from: string): PhoneError | null {
    const call = this.ofUser.get(adder.userId);
    if (!call || call.members.get(adder.userId)?.phase !== "talking") return "not-in-call";
    if (!target) return "offline";
    if (target.userId === adder.userId) return "self";
    if (this.ofUser.has(target.userId)) return "busy";
    if (target.status === "dnd") return "dnd";
    if (call.members.size >= COMUNICACION.maxCallMembers) return "full";
    this.ring(call, target, from, adder);
    this.tellOthers(call, target.userId, target.name, "invited");
    this.announce(call);
    return null;
  }

  /** Contestar (o rechazar) la llamada que me suena. */
  answer(userId: string, callId: string, accept: boolean) {
    const call = this.calls.get(callId);
    const me = call?.members.get(userId);
    if (!call || !me || me.phase !== "ringing") return;
    if (!accept) return this.drop(call, me, "declined", userId);
    me.timer?.clear();
    me.timer = undefined;
    me.phase = "talking";
    if (!call.since) {
      // La primera vez que contestan empieza la conversación: quien llamaba ya está hablando.
      call.since = this.deps.now();
      for (const m of call.members.values()) if (m.phase === "calling") m.phase = "talking";
    } else this.tellOthers(call, userId, me.who.name, "joined");
    this.announce(call);
  }

  /** Colgar desde cualquier lado (a quien le suena, colgar es rechazar). Sale solo quien cuelga. */
  hangup(userId: string) {
    const call = this.ofUser.get(userId);
    const me = call?.members.get(userId);
    if (!call || !me) return;
    this.drop(call, me, me.phase === "ringing" ? "declined" : "hangup", userId);
  }

  /** Se fue de la cabaña (sin sesiones): sale de la llamada. */
  left(userId: string) {
    const call = this.ofUser.get(userId);
    const me = call?.members.get(userId);
    if (call && me) this.drop(call, me, "left", userId);
  }

  /** Una sesión nueva de alguien en llamada (recargó la página): vuelve a recibir el estado y el aviso. */
  restore(userId: string) {
    const call = this.ofUser.get(userId);
    if (call) this.announce(call, userId);
  }

  /** Cambió el nombre de alguien: los demás lo ven en su chip la próxima vez que se avise. */
  rename(userId: string, name: string) {
    const call = this.ofUser.get(userId);
    if (!call) return;
    const me = call.members.get(userId);
    if (me) me.who.name = name;
    for (const m of call.members.values()) if (m.by === userId) m.byName = name;
  }

  dispose() {
    for (const call of this.calls.values()) for (const m of call.members.values()) m.timer?.clear();
    this.calls.clear();
    this.ofUser.clear();
  }

  /** Le empieza a sonar a `who` (se vence solo a los `ringMs`). */
  private ring(call: Call, who: PhoneWho, from: string, by: PhoneWho) {
    const member: Member = { who, phase: "ringing", from, by: by.userId, byName: by.name, endsAt: this.deps.now() + this.deps.ringMs() };
    member.timer = this.deps.later(this.deps.ringMs(), () => {
      if (call.members.get(who.userId) === member && member.phase === "ringing") this.drop(call, member, "timeout", who.userId);
    });
    call.members.set(who.userId, member);
    this.ofUser.set(who.userId, call);
  }

  /** Los demás de la llamada, vistos por `userId`. */
  private others(call: Call, userId: string): CallMember[] {
    const out: CallMember[] = [];
    for (const [id, m] of call.members) if (id !== userId) out.push({ userId: id, name: m.who.name, phase: m.phase });
    return out;
  }

  /** Publica la llamada en el estado y avisa a todos (o solo a `only`). */
  private announce(call: Call, only?: string) {
    for (const [userId, me] of call.members) {
      if (only && userId !== only) continue;
      const members = this.others(call, userId);
      // "Con quién": para quien le suena, quien lo llama; si no, el primero que está hablando (o sonando).
      const other = me.phase === "ringing" ? members.find((m) => m.userId === me.by && m.phase !== "ringing") ?? members[0] : members.find((m) => m.phase === "talking") ?? members[0];
      const withUserId = other?.userId ?? "";
      this.deps.setPhase(userId, me.phase, withUserId, call.since, call.id);
      const base = { callId: call.id, withUserId, withName: me.phase === "ringing" ? this.byNameOf(call, me) : other?.name ?? "", members };
      if (me.phase === "talking") this.deps.send(userId, { kind: "connected", ...base, since: call.since });
      else if (me.phase === "calling") this.deps.send(userId, { kind: "calling", ...base, endsAt: this.firstRingEnds(call) });
      else this.deps.send(userId, { kind: "ringing", ...base, from: me.from, endsAt: me.endsAt });
    }
  }

  private firstRingEnds(call: Call): number {
    for (const m of call.members.values()) if (m.phase === "ringing") return m.endsAt;
    return 0;
  }

  /** Avisa a los demás de la llamada (menos a `about`) que alguien entró, salió o no contestó. */
  private tellOthers(call: Call, about: string, name: string, change: CallMemberChange) {
    for (const [userId, m] of call.members) if (userId !== about && m.phase !== "ringing") this.deps.send(userId, { kind: "member", callId: call.id, name, change });
  }

  /**
   * Alguien sale de la llamada (colgó, no contestó o se fue). Antes de que contesten la primera vez, o si
   * queda una sola persona hablando, la llamada termina para todos; si no, sigue sin quien salió.
   */
  private drop(call: Call, member: Member, reason: CallEndReason, byUserId: string) {
    const talkingAfter = [...call.members.values()].filter((m) => m !== member && m.phase === "talking").length;
    if (!call.since || talkingAfter < 2) return this.end(call, reason, byUserId);
    this.remove(call, member);
    this.sendEnded(call, member, reason, byUserId, member.by ? this.byNameOf(call, member) : this.nameOf(call, call.caller));
    this.tellOthers(call, member.who.userId, member.who.name, reason === "hangup" || reason === "left" ? "left" : reason);
    this.announce(call);
  }

  private remove(call: Call, member: Member) {
    member.timer?.clear();
    call.members.delete(member.who.userId);
    if (this.ofUser.get(member.who.userId) === call) this.ofUser.delete(member.who.userId);
    this.deps.setPhase(member.who.userId, "", "", 0, "");
  }

  /** Nombre de quien hizo sonar a `m` (el de ahora si sigue en la llamada; si no, el que tenía). */
  private byNameOf(call: Call, m: Member): string {
    return call.members.get(m.by)?.who.name ?? m.byName;
  }

  private nameOf(call: Call, userId: string): string {
    return call.members.get(userId)?.who.name ?? "";
  }

  private sendEnded(call: Call, member: Member, reason: CallEndReason, byUserId: string, withName: string) {
    const userId = member.who.userId;
    // A quien le sonaba y la llamada se cortó antes de contestar: "colgó antes de que contestaras".
    const r: CallEndReason = member.phase === "ringing" && userId !== byUserId && reason !== "timeout" ? "declined" : reason;
    this.deps.send(userId, { kind: "ended", callId: call.id, withName, reason: r, byMe: userId === byUserId, caller: userId === call.caller });
  }

  private end(call: Call, reason: CallEndReason, byUserId: string) {
    this.calls.delete(call.id);
    const byName = this.nameOf(call, byUserId);
    const members = [...call.members.values()];
    for (const m of members) {
      const userId = m.who.userId;
      // "Con quién" terminó: quien colgó (o se fue); para quien colgó, alguien del otro lado.
      const withName =
        userId !== byUserId ? byName : m.phase === "ringing" ? this.byNameOf(call, m) : members.find((o) => o !== m && o.phase !== "ringing")?.who.name ?? members.find((o) => o !== m)?.who.name ?? "";
      this.remove(call, m);
      this.sendEnded(call, m, reason, byUserId, withName);
    }
  }
}
