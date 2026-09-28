// La rueda de la fortuna del casino (ver fortuna.ts de @hyvento/shared): una vuelta gratis al día por
// persona (día de Bogotá). El día de la última vuelta se guarda en UserStat con `max` (sin migración), así
// que hasta no leer las estadísticas de la persona no se sabe si ya giró: mientras tanto, "un segundito".
// El sector lo elige el servidor con su azar. Este módulo no conoce Colyseus.
import {
  bogotaDay,
  FORTUNE,
  FORTUNE_SECTORS,
  fortuneSectorAt,
  fortuneTotalWeight,
  spunToday,
  STAT_KEYS,
  type FortuneResult,
} from "@hyvento/shared";

export interface FortuneDeps {
  now: () => number;
  random: (n: number) => number;
  stats: {
    isLoaded(userId: string): boolean;
    stat(userId: string, key: string): number | undefined;
    max(userId: string, key: string, value: number): void;
    bump(userId: string, key: string): void;
  };
  /** Puntos de ocio (LEISURE, con su tope diario): lo que de verdad se sumó. */
  award: (userId: string, amount: number) => Promise<number>;
  /** Algo de la cafetería a la mochila (como `held.give`). */
  give: (userId: string, id: string) => Promise<"ok" | "full" | "stack">;
}

export class FortuneWheel {
  constructor(private readonly d: FortuneDeps) {}

  private today() {
    return bogotaDay(this.d.now());
  }

  /** ¿Ya giró hoy? (al abrir el panel). */
  status(userId: string): FortuneResult {
    if (!this.d.stats.isLoaded(userId)) return { kind: "error", error: "loading" };
    return { kind: "status", spun: spunToday(this.d.stats.stat(userId, FORTUNE.statKey), this.today()) };
  }

  /** Girar junto a la rueda: una vez al día. El día queda marcado antes de pagar (dos clics no giran dos veces). */
  async spin(userId: string, near: boolean): Promise<FortuneResult> {
    if (!near) return { kind: "error", error: "far" };
    if (!this.d.stats.isLoaded(userId)) return { kind: "error", error: "loading" };
    const today = this.today();
    if (spunToday(this.d.stats.stat(userId, FORTUNE.statKey), today)) return { kind: "error", error: "spun" };
    this.d.stats.max(userId, FORTUNE.statKey, today);
    this.d.stats.bump(userId, STAT_KEYS.fortuneSpins);
    const sector = fortuneSectorAt(this.d.random(fortuneTotalWeight()));
    const s = FORTUNE_SECTORS[sector]!;
    let points = 0;
    let kept = false;
    if (s.item) {
      kept = (await this.d.give(userId, s.item).catch(() => "full" as const)) === "ok";
      // No cabía en la mochila: se cambia por un par de puntos (no se pierde el premio).
      if (!kept) points = await this.d.award(userId, 2);
    } else if (s.points > 0) points = await this.d.award(userId, s.points);
    return { kind: "spin", sector, points, ...(s.item ? { item: s.item } : {}), kept };
  }
}
