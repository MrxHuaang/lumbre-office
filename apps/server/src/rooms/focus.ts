// Modo foco (ver focus.ts de @hyvento/shared): el reloj del pomodoro lo lleva la sala. Al empezar un
// bloque se "reclama" a la persona (no molestar, puerta cerrada y placa, lo hace la sala con `claim`) y al
// terminar o cancelarse se devuelve todo como estaba (`release`). Por userId: sobrevive a tener dos pestañas.
import { FocusStartMessage, type FocusCancelReason, type FocusEvent, type FocusPhase, type FocusPresetId } from "@hyvento/shared";

interface Timer {
  clear(): void;
}

export interface FocusDeps {
  later(ms: number, fn: () => void): Timer;
  now(): number;
  /** Duración de cada fase (los tests la acortan). */
  phaseMs(preset: FocusPresetId, phase: "work" | "break"): number;
  /** Refleja la fase en los Player de esa persona (el tomatito y el contador los ve todo el mundo). */
  show(userId: string, phase: FocusPhase, endsAt: number, preset: FocusPresetId | ""): void;
  /**
   * Empieza un bloque: no molestar, cerrar la puerta y la placa si está en su oficina. Devuelve la zona de la
   * oficina donde empezó ("" si no estaba en la suya): salir de ahí cancela.
   */
  claim(userId: string): string;
  /** Termina el bloque: devuelve el estado, la puerta y la placa como estaban (si nadie los cambió). */
  release(userId: string): void;
  /** Da los puntos de un bloque completo (con su tope diario). */
  award(userId: string): Promise<{ points: number; capped: boolean }>;
  send(userId: string, event: FocusEvent): void;
}

interface Session {
  preset: FocusPresetId;
  phase: "work" | "break";
  endsAt: number;
  timer: Timer;
  /** Oficina donde empezó ("" = en otro lado: solo irse de la cabaña lo cancela). */
  zoneId: string;
}

export class FocusTimers {
  private sessions = new Map<string, Session>();

  constructor(private readonly deps: FocusDeps) {}

  phase(userId: string): FocusPhase {
    return this.sessions.get(userId)?.phase ?? "";
  }

  /** Empezar un bloque de enfoque (si ya hay uno corriendo, no hace nada; en el descanso, empieza otro). */
  start(userId: string, raw: unknown): boolean {
    const parsed = FocusStartMessage.safeParse(raw);
    if (!parsed.success) return false;
    const current = this.sessions.get(userId);
    if (current?.phase === "work") return false;
    current?.timer.clear();
    const preset = parsed.data.preset;
    const zoneId = this.deps.claim(userId);
    this.begin(userId, { preset, phase: "work", zoneId });
    return true;
  }

  private begin(userId: string, s: Pick<Session, "preset" | "phase" | "zoneId">) {
    const ms = this.deps.phaseMs(s.preset, s.phase);
    const endsAt = this.deps.now() + ms;
    const timer = this.deps.later(ms, () => void this.finish(userId, endsAt));
    this.sessions.set(userId, { ...s, endsAt, timer });
    this.deps.show(userId, s.phase, endsAt, s.preset);
  }

  /** Se acabó la fase: el bloque de enfoque da puntos y sigue el descanso; el descanso termina todo. */
  private async finish(userId: string, endsAt: number) {
    const s = this.sessions.get(userId);
    if (!s || s.endsAt !== endsAt) return; // se canceló o empezó otro mientras tanto
    if (s.phase === "break") {
      this.sessions.delete(userId);
      this.deps.show(userId, "", 0, "");
      this.deps.send(userId, { kind: "break-over" });
      return;
    }
    this.deps.release(userId);
    this.begin(userId, { preset: s.preset, phase: "break", zoneId: "" });
    const { points, capped } = await this.deps.award(userId).catch((err) => {
      console.error("focus award", err);
      return { points: 0, capped: false };
    });
    this.deps.send(userId, { kind: "done", points, capped });
  }

  /** Dejar el bloque (sin puntos) o saltarse el descanso. */
  stop(userId: string) {
    const s = this.sessions.get(userId);
    if (!s) return;
    this.end(userId, s);
    if (s.phase === "work") this.deps.send(userId, { kind: "cancelled", reason: "stopped" });
  }

  /** Se movió: si empezó en su oficina y ya no está en ella, el bloque se cancela sin puntos. */
  moved(userId: string, zoneId: string) {
    const s = this.sessions.get(userId);
    if (!s || s.phase !== "work" || !s.zoneId || s.zoneId === zoneId) return;
    this.cancel(userId, "left");
  }

  cancel(userId: string, reason: FocusCancelReason) {
    const s = this.sessions.get(userId);
    if (!s) return;
    this.end(userId, s);
    if (s.phase === "work") this.deps.send(userId, { kind: "cancelled", reason });
  }

  /** Se fue de la cabaña (sin ninguna sesión): se corta sin avisar a nadie. */
  forget(userId: string) {
    const s = this.sessions.get(userId);
    if (s) this.end(userId, s);
  }

  /** Entró con una sesión nueva: se le muestra el foco que tenga (o nada). */
  joined(userId: string) {
    const s = this.sessions.get(userId);
    if (s) this.deps.show(userId, s.phase, s.endsAt, s.preset);
  }

  private end(userId: string, s: Session) {
    s.timer.clear();
    this.sessions.delete(userId);
    if (s.phase === "work") this.deps.release(userId);
    this.deps.show(userId, "", 0, "");
  }
}
