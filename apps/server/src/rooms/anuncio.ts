// El anuncio de un admin a toda la cabaña (ver packages/shared/src/comunicacion.ts): un aviso de texto
// grande para todos los conectados, en todos los niveles, y la voz: mientras dura, quien anuncia tiene el
// papel "broadcast" (`Player.broadcastUntil`) y todos lo oyen encima de reuniones y salas aisladas
// (`hearing`/`listeners` de proximity.ts; de ahí salen los permisos de LiveKit). Uno a la vez y con tope
// de duración. Solo admins: lo decide la sala con el rol del token.
import {
  AnnounceMessage,
  cleanAnnouncement,
  COM_MSG,
  COMUNICACION,
  type Announcement,
  type AnnounceError,
  type AnnounceResult,
  type BroadcastEndReason,
  type BroadcastEvent,
} from "@hyvento/shared";

export interface AnuncioPerson {
  userId: string;
  name: string;
  admin: boolean;
}

export interface AnuncioDeps {
  person: (sessionId: string) => AnuncioPerson | undefined;
  toAll: (type: string, message: unknown) => void;
  toSession: (sessionId: string, type: string, message: unknown) => void;
  /** Refleja el anuncio por voz en el estado (`Player.broadcastUntil` de todas las sesiones de esa persona). */
  setBroadcast: (userId: string, until: number) => void;
  later: (ms: number, fn: () => void) => { clear(): void };
  now: () => number;
  newId: () => string;
  maxMs: () => number;
}

interface Live {
  userId: string;
  name: string;
  endsAt: number;
  timer: { clear(): void };
}

export class Anuncio {
  private lastTextAt = new Map<string, number>();
  private live: Live | null = null;

  constructor(private readonly deps: AnuncioDeps) {}

  /** Quién anuncia por voz ahora (userId), o null. */
  get broadcaster(): string | null {
    return this.live?.userId ?? null;
  }

  /** Aviso de texto a todos. */
  announce(sessionId: string, raw: unknown) {
    const me = this.deps.person(sessionId);
    const parsed = AnnounceMessage.safeParse(raw);
    if (!me || !parsed.success) return;
    if (!me.admin) return this.fail(sessionId, "admin");
    const text = cleanAnnouncement(parsed.data.text);
    if (!text) return this.fail(sessionId, "empty");
    const now = this.deps.now();
    if (now - (this.lastTextAt.get(me.userId) ?? -Infinity) < COMUNICACION.announceCooldownMs) return this.fail(sessionId, "too-soon");
    this.lastTextAt.set(me.userId, now);
    this.deps.toAll(COM_MSG.announcement, { id: this.deps.newId(), fromUserId: me.userId, fromName: me.name, text, at: now } satisfies Announcement);
  }

  /** Empezar a hablarle a toda la cabaña por voz. */
  start(sessionId: string) {
    const me = this.deps.person(sessionId);
    if (!me) return;
    if (!me.admin) return this.fail(sessionId, "admin");
    if (this.live && this.live.userId !== me.userId) return this.fail(sessionId, "busy", this.live.name);
    if (this.live) return; // ya estaba anunciando
    const now = this.deps.now();
    const endsAt = now + this.deps.maxMs();
    const timer = this.deps.later(this.deps.maxMs(), () => {
      if (this.live?.userId === me.userId) this.end("timeout");
    });
    this.live = { userId: me.userId, name: me.name, endsAt, timer };
    this.deps.setBroadcast(me.userId, endsAt);
    this.deps.toAll(COM_MSG.broadcastEvent, { kind: "start", userId: me.userId, name: me.name, endsAt } satisfies BroadcastEvent);
  }

  /** Terminar (solo quien anuncia). */
  stop(sessionId: string) {
    const me = this.deps.person(sessionId);
    if (me && this.live?.userId === me.userId) this.end("stop");
  }

  /** Una sesión nueva: si hay un anuncio por voz, que lo sepa (y si es de quien anuncia, que lo retome). */
  greet(sessionId: string) {
    const live = this.live;
    if (!live) return;
    const me = this.deps.person(sessionId);
    if (me?.userId === live.userId) this.deps.setBroadcast(live.userId, live.endsAt);
    this.deps.toSession(sessionId, COM_MSG.broadcastEvent, { kind: "start", userId: live.userId, name: live.name, endsAt: live.endsAt } satisfies BroadcastEvent);
  }

  /** Quien anunciaba se fue del todo: se corta. */
  forget(userId: string) {
    if (this.live?.userId === userId) this.end("left");
  }

  dispose() {
    this.live?.timer.clear();
    this.live = null;
  }

  private end(reason: BroadcastEndReason) {
    const live = this.live;
    if (!live) return;
    live.timer.clear();
    this.live = null;
    this.deps.setBroadcast(live.userId, 0);
    this.deps.toAll(COM_MSG.broadcastEvent, { kind: "end", userId: live.userId, name: live.name, reason } satisfies BroadcastEvent);
  }

  private fail(sessionId: string, error: AnnounceError, name?: string) {
    this.deps.toSession(sessionId, COM_MSG.announceResult, { error, ...(name ? { name } : {}) } satisfies AnnounceResult);
  }
}
