import { effectiveStatus, type ManualStatus } from "@hyvento/shared";

/** Lo mínimo de un jugador que hace falta aquí (Player del estado). */
interface PresencePlayer {
  status: string;
  zoneId: string;
}

interface Flags {
  /** Lo que eligió la persona (o el modo foco); es lo único que se guarda en la base. */
  manual: ManualStatus;
  /** El navegador avisó que lleva rato sin uso. */
  idle: boolean;
  /** Está en la sala de reuniones con alguien más. */
  meeting: boolean;
  /** Eligió un estado a mano durante la reunión: se respeta hasta que salga. */
  dismissed: boolean;
}

/**
 * Estados automáticos de cada sesión ("Ausente" por inactividad, "En reunión"). `Player.status` es el
 * estado que se ve y se calcula con `effectiveStatus`; lo automático vive solo en memoria, así que al
 * recargar se vuelve al manual guardado.
 */
export class PresenceTracker {
  private flags = new Map<string, Flags>();

  constructor(
    private readonly players: { get(sessionId: string): PresencePlayer | undefined; entries(): IterableIterator<[string, PresencePlayer]> },
    private readonly isMeetingZone: (zoneId: string) => boolean,
  ) {}

  join(sessionId: string, manual: ManualStatus) {
    this.flags.set(sessionId, { manual, idle: false, meeting: false, dismissed: false });
    this.refreshMeetings();
  }

  manualOf(sessionId: string): ManualStatus | undefined {
    return this.flags.get(sessionId)?.manual;
  }

  /** Estado elegido. `byHand`: lo eligió la persona (en una reunión, deja de mostrar "En reunión"). */
  setManual(sessionId: string, manual: ManualStatus, byHand = false) {
    const f = this.flags.get(sessionId);
    if (!f) return;
    f.manual = manual;
    if (byHand && f.meeting) f.dismissed = true;
    this.apply(sessionId, f);
  }

  setIdle(sessionId: string, idle: boolean) {
    const f = this.flags.get(sessionId);
    if (!f || f.idle === idle) return;
    f.idle = idle;
    this.apply(sessionId, f);
  }

  /** Recalcula quién está en reunión (se llama al moverse y en el tic de la sala). */
  refreshMeetings() {
    const count = new Map<string, number>();
    for (const [, p] of this.players.entries()) if (p.zoneId && this.isMeetingZone(p.zoneId)) count.set(p.zoneId, (count.get(p.zoneId) ?? 0) + 1);
    for (const [sessionId, f] of this.flags) {
      const p = this.players.get(sessionId);
      if (!p) {
        this.flags.delete(sessionId); // la sesión ya no está (reemplazada o se fue)
        continue;
      }
      const meeting = (count.get(p.zoneId) ?? 0) >= 2;
      if (meeting === f.meeting) continue;
      f.meeting = meeting;
      if (!meeting) f.dismissed = false;
      this.apply(sessionId, f);
    }
  }

  private apply(sessionId: string, f: Flags) {
    const p = this.players.get(sessionId);
    if (!p) return;
    const status = effectiveStatus({ manual: f.manual, idle: f.idle, meeting: f.meeting && !f.dismissed });
    if (p.status !== status) p.status = status;
  }
}
