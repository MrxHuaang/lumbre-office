// Invitaciones: desde la lista de Conectados se invita a alguien a donde uno está ("Juan te invita a su
// oficina"). El servidor valida que los dos estén conectados, que no sea a uno mismo y el ritmo (una por
// persona invitada cada 30 s); el invitado responde "Ir" o "Ahora no". Si la invitación es a la propia
// oficina y está cerrada, aceptar lo deja pasar (como abrirle tras un toque): quien invita ya dijo que sí.
// Si es a la propia casa, aceptar lo deja pasar y lo lleva hasta la vereda de esa casa (no se llega
// caminando: es como tomar el Megabús).
import { randomUUID } from "node:crypto";
import {
  INVITE_COOLDOWN_MS,
  INVITE_TIMEOUT_MS,
  InviteMessage,
  InviteRespondMessage,
  MSG,
  type Invitation,
  type InviteOutcome,
  type InvitePlace,
  type InviteResult,
  type PresenceStatus,
} from "@hyvento/shared";

export interface InvitePerson {
  userId: string;
  name: string;
  status: PresenceStatus;
}

/**
 * Dónde está quien invita; `officeZoneId` = está en su propia oficina y `casaOwnerId` = en su propia casa
 * (para dejar pasar al invitado).
 */
export interface InviterPlace {
  place: InvitePlace;
  placeName: string;
  officeZoneId?: string;
  casaOwnerId?: string;
}

export interface InvitesDeps {
  person: (sessionId: string) => InvitePerson | null;
  /** Sesión conectada de un usuario (una sola presencia por persona). */
  sessionOfUser: (userId: string) => string | null;
  placeOf: (sessionId: string) => InviterPlace;
  send: (sessionId: string, type: string, payload: unknown) => void;
  /** Deja pasar a `userId` a la oficina cerrada `zoneId` de quien invitó. */
  letIn: (zoneId: string, ownerUserId: string, userId: string) => void;
  /** Deja pasar a `userId` a la casa de `ownerUserId` y lo lleva hasta allá. */
  letInCasa: (ownerUserId: string, userId: string) => void;
  setTimeout: (fn: () => void, ms: number) => { clear(): void };
  now: () => number;
}

interface PendingInvite {
  inviteId: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  officeZoneId?: string;
  casaOwnerId?: string;
  timer: { clear(): void };
}

export class Invites {
  private pending = new Map<string, PendingInvite>();
  /** `${de}:${para}` → cuándo fue la última invitación. */
  private lastAt = new Map<string, number>();

  constructor(private readonly deps: InvitesDeps) {}

  invite(sessionId: string, raw: unknown) {
    const parsed = InviteMessage.safeParse(raw);
    const me = this.deps.person(sessionId);
    if (!parsed.success || !me) return;
    const { toUserId } = parsed.data;
    if (toUserId === me.userId) return;
    const toSession = this.deps.sessionOfUser(toUserId);
    const other = toSession ? this.deps.person(toSession) : null;
    const reply = (outcome: InviteOutcome, toName = other?.name ?? "") =>
      this.deps.send(sessionId, MSG.inviteResult, { toUserId, toName, outcome } satisfies InviteResult);
    if (!toSession || !other) return reply("offline");
    // "No molestar" no recibe invitaciones (el teléfono tampoco le suena).
    if (other.status === "dnd") return reply("dnd");

    const key = `${me.userId}:${toUserId}`;
    const now = this.deps.now();
    if (now - (this.lastAt.get(key) ?? -Infinity) < INVITE_COOLDOWN_MS) return reply("too-soon");
    this.lastAt.set(key, now);

    // Una invitación nueva de la misma persona reemplaza la anterior que seguía sin respuesta.
    for (const inv of this.pending.values()) if (inv.fromUserId === me.userId && inv.toUserId === toUserId) this.drop(inv.inviteId);

    const where = this.deps.placeOf(sessionId);
    const inviteId = randomUUID();
    const timer = this.deps.setTimeout(() => {
      if (!this.pending.delete(inviteId)) return;
      const from = this.deps.sessionOfUser(me.userId);
      if (from) this.deps.send(from, MSG.inviteResult, { toUserId, toName: other.name, outcome: "timeout" } satisfies InviteResult);
    }, INVITE_TIMEOUT_MS);
    this.pending.set(inviteId, {
      inviteId,
      fromUserId: me.userId,
      fromName: me.name,
      toUserId,
      toName: other.name,
      officeZoneId: where.officeZoneId,
      casaOwnerId: where.casaOwnerId,
      timer,
    });
    this.deps.send(toSession, MSG.inviteRequest, {
      inviteId,
      fromUserId: me.userId,
      fromSessionId: sessionId,
      fromName: me.name,
      place: where.place,
      placeName: where.placeName,
    } satisfies Invitation);
    reply("sent");
  }

  respond(sessionId: string, raw: unknown) {
    const parsed = InviteRespondMessage.safeParse(raw);
    const me = this.deps.person(sessionId);
    if (!parsed.success || !me) return;
    const inv = this.pending.get(parsed.data.inviteId);
    // Solo responde el invitado.
    if (!inv || inv.toUserId !== me.userId) return;
    this.drop(inv.inviteId);
    const accept = parsed.data.accept;
    if (accept && inv.officeZoneId) this.deps.letIn(inv.officeZoneId, inv.fromUserId, me.userId);
    if (accept && inv.casaOwnerId) this.deps.letInCasa(inv.casaOwnerId, me.userId);
    const from = this.deps.sessionOfUser(inv.fromUserId);
    if (from) this.deps.send(from, MSG.inviteResult, { toUserId: me.userId, toName: inv.toName, outcome: accept ? "accepted" : "declined" } satisfies InviteResult);
  }

  /** Alguien se fue del todo: sus invitaciones (hechas o recibidas) se olvidan. */
  forget(userId: string) {
    for (const inv of [...this.pending.values()]) if (inv.fromUserId === userId || inv.toUserId === userId) this.drop(inv.inviteId);
  }

  private drop(inviteId: string) {
    this.pending.get(inviteId)?.timer.clear();
    this.pending.delete(inviteId);
  }
}
