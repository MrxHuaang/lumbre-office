// La tina caliente y la sauna del lago en el servidor. Meterse es sentarse (los asientos son del catálogo y
// los valida la sala como cualquier otro); esto lleva lo demás: cada rato de descanso adentro da puntos de
// ocio (solo con actividad reciente y sin estar "Ausente", como la presencia) y suma para el logro
// "Relajado", y al pararse se queda mojado un rato (lo de la piscina). Este módulo no conoce Colyseus.
import { seatAtPoint, type OfficeMap } from "@hyvento/map";
import { spaKindOf, TINA } from "@hyvento/shared";

/** Lo que el módulo necesita de cada persona (un `Player` de la sala). */
export interface Soaker {
  userId: string;
  area: string;
  x: number;
  y: number;
  seated: boolean;
  status: string;
}

export interface TinaDeps {
  now(): number;
  map(area: string): OfficeMap;
  /** La gente de la sala, por sessionId. */
  people(): Iterable<[string, Soaker]>;
  /** Premio de ocio (LEISURE, con el tope diario). */
  award(userId: string, amount: number): Promise<number>;
  /** ¿Tuvo actividad reciente? (sin ella no se ganan puntos). */
  active(sessionId: string): boolean;
  /** Un rato de descanso cumplido (para el logro). */
  rested(userId: string): void;
  /** Salió del agua o del vapor: queda mojado un rato. */
  soak(userId: string): void;
  /** Tiempos (los tests los acortan). */
  timings(): { tickMs: number };
}

export class Tina {
  /** Desde cuándo cuenta el descanso de cada persona (se reinicia al salir o si se va la actividad). */
  private since = new Map<string, number>();

  constructor(private readonly deps: TinaDeps) {}

  /** ¿Está sentada en la tina o en la sauna? */
  private spaSeat(p: Soaker) {
    if (!p.seated) return null;
    const seat = seatAtPoint(this.deps.map(p.area), p.x, p.y);
    return seat && spaKindOf(seat.type) ? seat : null;
  }

  /**
   * Los puntos del descanso: a quien está adentro con actividad reciente (y no "Ausente"), cada `tickMs`.
   * Salir o quedarse quieto sin actividad vuelven a empezar la cuenta.
   */
  async tick() {
    const now = this.deps.now();
    const seen = new Set<string>();
    for (const [sessionId, p] of [...this.deps.people()]) {
      if (!this.spaSeat(p) || p.status === "away" || !this.deps.active(sessionId)) continue;
      seen.add(p.userId);
      const since = this.since.get(p.userId);
      if (since === undefined) {
        this.since.set(p.userId, now);
        continue;
      }
      if (now - since < this.deps.timings().tickMs) continue;
      this.since.set(p.userId, now);
      this.deps.rested(p.userId);
      await this.deps.award(p.userId, TINA.points);
    }
    for (const userId of [...this.since.keys()]) if (!seen.has(userId)) this.since.delete(userId);
  }

  /** Se paró de un asiento (la sala lo llama con el tipo del asiento que dejó): de la tina o la sauna, mojado. */
  stoodUp(userId: string, seatType: string | undefined) {
    if (!seatType || !spaKindOf(seatType)) return;
    this.since.delete(userId);
    this.deps.soak(userId);
  }

  /** Se fue de la sala: se olvida la cuenta del descanso. */
  forget(userId: string) {
    this.since.delete(userId);
  }
}
