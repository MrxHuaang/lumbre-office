// Lo que cada persona lleva en la mano (pedido en la cafetería o en el bar) y cuántos usos le quedan.
// Se guarda por userId: sobrevive a recargar la página. La sala refleja cada cambio en `Player`.
import { CONSUME, consumeActionOf, heldParts, isHuertoTool, usesOf, type ConsumeAction } from "@hyvento/shared";

interface Held {
  item: string;
  /** Usos que le quedan a cada mano (en el orden de `holds`). */
  left: number[];
  lastUseAt: number;
  /** Última mano usada: en los combos se alterna (un sorbo, una pitada). */
  lastPart: number;
  timer: { clear(): void };
}

export type UseResult =
  | { ok: true; part: number; art: string; action: ConsumeAction; left: number; done: boolean }
  | { ok: false; error: "empty" | "busy" };

export interface HeldClock {
  setTimeout(fn: () => void, ms: number): { clear(): void };
}

export class HeldItems {
  private byUser = new Map<string, Held>();

  constructor(
    private readonly clock: HeldClock,
    /** Cuánto dura en la mano (los tests lo acortan). */
    private readonly heldMs: () => number,
    /** Cambió lo que lleva alguien: la sala lo copia a sus `Player` ("" = nada). */
    private readonly onChange: (userId: string, item: string, left: readonly number[]) => void,
    /** Pausa mínima entre dos usos (los tests la acortan). */
    private readonly cooldownMs: () => number = () => CONSUME.cooldownMs,
  ) {}

  get(userId: string): { item: string; left: readonly number[] } | undefined {
    const held = this.byUser.get(userId);
    return held && { item: held.item, left: [...held.left] };
  }

  /** Pone algo en la mano (reemplaza lo anterior, con todos sus usos) y lo quita solo al rato. */
  give(userId: string, item: string) {
    this.byUser.get(userId)?.timer.clear();
    const timer = this.clock.setTimeout(() => this.drop(userId), this.heldMs());
    const left = heldParts(item).map(usesOf);
    this.byUser.set(userId, { item, left, lastUseAt: 0, lastPart: -1, timer });
    this.onChange(userId, item, left);
  }

  drop(userId: string) {
    const held = this.byUser.get(userId);
    if (!held) return;
    held.timer.clear();
    this.byUser.delete(userId);
    this.onChange(userId, "", []);
  }

  /** Se va una mano entera (se la dio a una mascota); si no queda nada, se va todo. */
  takePart(userId: string, part: number) {
    const held = this.byUser.get(userId);
    if (!held || !(held.left[part]! > 0)) return;
    held.left[part] = 0;
    if (held.left.every((v) => v <= 0)) this.drop(userId);
    else this.onChange(userId, held.item, held.left);
  }

  /**
   * Usar lo que se tiene: hace falta tener algo con usos y respetar la pausa entre usos. Sin `part` se
   * alterna entre las manos que tienen usos. Al gastar todo, se va de la mano.
   */
  use(userId: string, now: number, part?: number, opts: { skipCooldown?: boolean; tool?: boolean } = {}): UseResult {
    const held = this.byUser.get(userId);
    if (!held || held.left.every((n) => n <= 0)) return { ok: false, error: "empty" };
    // Las herramientas del huerto no se "comen" con F: sus usos los gasta el huerto (`tool`).
    if (isHuertoTool(held.item) !== Boolean(opts.tool)) return { ok: false, error: "empty" };
    // El sorbo del brindis no espera la pausa: el brindis ya tiene la suya.
    if (!opts.skipCooldown && now - held.lastUseAt < this.cooldownMs()) return { ok: false, error: "busy" };
    let i = part ?? -1;
    if (i < 0 || !(held.left[i]! > 0)) {
      // La siguiente mano con usos después de la última usada.
      const n = held.left.length;
      i = [1, 2].map((k) => (held.lastPart + k + n) % n).find((k) => held.left[k]! > 0) ?? held.left.findIndex((v) => v > 0);
    }
    held.left[i]! -= 1;
    held.lastUseAt = now;
    held.lastPart = i;
    const art = heldParts(held.item)[i]!;
    const done = held.left.every((v) => v <= 0);
    const result: UseResult = { ok: true, part: i, art, action: consumeActionOf(art), left: held.left[i]!, done };
    if (done) this.drop(userId);
    else this.onChange(userId, held.item, held.left);
    return result;
  }
}
