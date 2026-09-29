// Saludar (toque en el hombro, ver packages/shared/src/comunicacion.ts): a la otra persona le llega un
// aviso suave "X te saluda" con "Ir" y "Llamar". El servidor valida que esté conectada, que no esté en
// "No molestar" y la pausa por par de personas (para que no sea un timbre disfrazado).
import { ComPersonMessage, COM_MSG, COMUNICACION, type WaveEvent, type WaveOutcome, type WaveResult } from "@hyvento/shared";

export interface SaludosPerson {
  userId: string;
  name: string;
  status: string;
}

export interface SaludosDeps {
  person: (sessionId: string) => SaludosPerson | undefined;
  /** Sesión conectada de un usuario (una sola presencia por persona). */
  sessionOfUser: (userId: string) => string | null;
  send: (sessionId: string, type: string, message: unknown) => void;
  now: () => number;
  newId: () => string;
  cooldownMs: () => number;
}

export class Saludos {
  /** `${de}:${para}` → cuándo fue el último saludo. */
  private lastAt = new Map<string, number>();

  constructor(private readonly deps: SaludosDeps) {}

  wave(sessionId: string, raw: unknown) {
    const parsed = ComPersonMessage.safeParse(raw);
    const me = this.deps.person(sessionId);
    if (!parsed.success || !me) return;
    const { userId } = parsed.data;
    const toSession = userId === me.userId ? null : this.deps.sessionOfUser(userId);
    const other = toSession ? this.deps.person(toSession) : undefined;
    const reply = (outcome: WaveOutcome) =>
      this.deps.send(sessionId, COM_MSG.waveResult, { toUserId: userId, toName: other?.name ?? "", outcome } satisfies WaveResult);
    if (userId === me.userId) return reply("self");
    if (!toSession || !other) return reply("offline");
    if (other.status === "dnd") return reply("dnd");
    const key = `${me.userId}:${userId}`;
    const now = this.deps.now();
    if (now - (this.lastAt.get(key) ?? -Infinity) < this.deps.cooldownMs()) return reply("too-soon");
    this.lastAt.set(key, now);
    this.deps.send(toSession, COM_MSG.waved, {
      waveId: this.deps.newId(),
      fromUserId: me.userId,
      fromSessionId: sessionId,
      fromName: me.name,
      at: now,
    } satisfies WaveEvent);
    reply("sent");
    // Las pausas vencidas no hacen falta (salir y volver a entrar no las borra: si no, sería la trampa).
    if (this.lastAt.size > 500) for (const [k, t] of this.lastAt) if (now - t >= this.deps.cooldownMs()) this.lastAt.delete(k);
  }
}

/** La pausa por defecto (los tests la acortan con `OfficeRoom.waveCooldownMs`). */
export const WAVE_COOLDOWN_MS = COMUNICACION.waveCooldownMs;
