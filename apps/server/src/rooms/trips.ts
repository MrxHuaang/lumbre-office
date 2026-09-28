// Lo que le hace a cada persona la mercancía del Man del Sombrero (trabado, acelerado, viendo colores, en
// la pinta del yagé). Se guarda por userId (recargar no te lo quita) y se refleja en `Player.trip` y
// `Player.tripUntil`; un temporizador lo quita al pasar. Las reglas están en @hyvento/shared/sombrero.
import { addTrip, TRIP, TRIP_PER_USE, type TripKind } from "@hyvento/shared";
import type { HeldClock } from "./consumables";

interface Trip {
  kind: TripKind;
  until: number;
  timer: { clear(): void };
}

export interface TripTimings {
  /** Cuánto suma cada uso (multiplica lo de TRIP_PER_USE; los tests lo achican). */
  scale: number;
  maxMs: number;
}

export class Trips {
  private byUser = new Map<string, Trip>();

  constructor(
    private readonly clock: HeldClock,
    private readonly now: () => number,
    /** Cambió lo que lleva alguien: la sala lo copia a sus `Player` ("" = nada). */
    private readonly onChange: (userId: string, kind: TripKind | "", until: number) => void,
    private readonly timings: () => TripTimings = () => ({ scale: 1, maxMs: TRIP.maxMs }),
  ) {}

  get(userId: string): { kind: TripKind; until: number } | null {
    const t = this.byUser.get(userId);
    return t && t.until > this.now() ? { kind: t.kind, until: t.until } : null;
  }

  /** Un uso de `art` (una pitada, un mordisco, una esnifada, un sorbo): si hace efecto, lo suma. */
  consumed(userId: string, art: string) {
    const use = TRIP_PER_USE[art];
    if (!use) return;
    const { scale, maxMs } = this.timings();
    const now = this.now();
    const prev = this.byUser.get(userId);
    const next = addTrip(this.get(userId), { kind: use.kind, ms: use.ms * scale }, now, maxMs);
    prev?.timer.clear();
    const timer = this.clock.setTimeout(() => this.end(userId), Math.max(1, next.until - now));
    this.byUser.set(userId, { ...next, timer });
    this.onChange(userId, next.kind, next.until);
  }

  /** Se le pasó (o se desmayó y despertó limpio). */
  end(userId: string) {
    const t = this.byUser.get(userId);
    if (!t) return;
    t.timer.clear();
    this.byUser.delete(userId);
    this.onChange(userId, "", 0);
  }

  dispose() {
    for (const t of this.byUser.values()) t.timer.clear();
    this.byUser.clear();
  }
}
