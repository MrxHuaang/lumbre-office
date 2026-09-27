// Fotos: el servidor lleva la cuenta regresiva (la ven los del mismo nivel), decide quiénes salen en el
// encuadre y firma el ticket con eso. La imagen la recorta el navegador de quien la saca y la sube a la
// web con el ticket (la web no confía en la lista que mande el cliente: la saca del ticket).
import {
  PHOTO,
  peopleInFrame,
  signPhotoTicket,
  type PhotoCountdownEvent,
  type PhotoFlashEvent,
  type PhotoShot,
} from "@hyvento/shared";

/** Alguien del nivel, como lo ve la cámara. */
export interface PhotoSubject {
  sessionId: string;
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
}

export interface PhotoBoothDeps {
  later: (ms: number, fn: () => void) => void;
  now: () => number;
  newId: () => string;
  secret: () => string;
  timings: () => { countdownMs: number; cooldownMs: number };
  /** Quien está en la sala con esa sesión (null = se fue). */
  subject: (sessionId: string) => PhotoSubject | null;
  /** Todos los de un nivel. */
  inArea: (area: string) => PhotoSubject[];
  /** Mensaje a los clientes de un nivel. */
  toArea: (area: string, type: string, message: unknown) => void;
  /** Mensaje a una sesión. */
  toSession: (sessionId: string, type: string, message: unknown) => void;
  messages: { countdown: string; shot: string; flash: string };
}

export class PhotoBooth {
  /** Última foto pedida por persona (por userId: recargar la página no salta la pausa). */
  private lastAt = new Map<string, number>();
  /** Sesiones con la cuenta regresiva en curso. */
  private counting = new Set<string>();

  constructor(private readonly deps: PhotoBoothDeps) {}

  /** Pedir una foto: si no está en pausa, empieza el 3-2-1 y al terminar se dispara. */
  take(sessionId: string) {
    const me = this.deps.subject(sessionId);
    if (!me || this.counting.has(sessionId)) return;
    const now = this.deps.now();
    const { countdownMs, cooldownMs } = this.deps.timings();
    if (now - (this.lastAt.get(me.userId) ?? -Infinity) < cooldownMs) return;
    this.lastAt.set(me.userId, now);
    this.counting.add(sessionId);
    this.deps.toArea(me.area, this.deps.messages.countdown, { sessionId, ms: countdownMs } satisfies PhotoCountdownEvent);
    this.deps.later(countdownMs, () => void this.shoot(sessionId, me.area));
  }

  /** Fin de la cuenta: quiénes salen (si sigue en el mismo nivel) y el ticket para subirla. */
  private async shoot(sessionId: string, area: string) {
    this.counting.delete(sessionId);
    const me = this.deps.subject(sessionId);
    if (!me || me.area !== area) return; // se fue o cambió de nivel: no hay foto
    const subject = (s: PhotoSubject) => ({ id: s.userId, name: s.name, x: s.x, y: s.y });
    const people = peopleInFrame(subject(me), this.deps.inArea(area).map(subject));
    const takenAt = this.deps.now();
    let ticket: string;
    try {
      ticket = await signPhotoTicket({ sub: me.userId, jti: this.deps.newId(), area, people, takenAt }, this.deps.secret());
    } catch (err) {
      console.error("signPhotoTicket", err);
      return;
    }
    this.deps.toArea(area, this.deps.messages.flash, { sessionId } satisfies PhotoFlashEvent);
    this.deps.toSession(sessionId, this.deps.messages.shot, { ticket, area, people, takenAt } satisfies PhotoShot);
  }
}

export const PHOTO_TIMINGS = { countdownMs: PHOTO.countdownMs, cooldownMs: PHOTO.cooldownMs };
