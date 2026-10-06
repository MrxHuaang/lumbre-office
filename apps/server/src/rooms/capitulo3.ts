// Capítulo 3 de la historia en la sala: "La llavecita del lago" (ver capitulo3.ts de @hyvento/shared). Cada
// paso solo cuenta con ese paso abierto: preguntarle a la Profe Celeste por el agua que brilla, sacarle a
// Don Evelio la receta de la carnada de E. (la primera vez se hace el loco; si se le insiste, la suelta),
// cocinarla en la estufa, pescar la llavecita en el lago con el agua brillando y la carnada en la mochila, y
// mostrársela a Doña Aurora. Este módulo suma el contador del paso, da y quita los objetos y manda la
// cinemática; la entrega de cada paso es la de siempre, con quien lo da (encargos.ts).
import {
  CAPITULO_3,
  HISTORIA_LAGO,
  HISTORIA_MSG,
  LAGO_AREA,
  LAGO_CINE,
  LAGO_PASOS,
  OBJETOS_LAGO,
  celesteAhora,
  objItemId,
  questById,
  type HistoriaCine,
} from "@hyvento/shared";

/** Pausa entre dos preguntas de la misma persona (la cinemática dura más que esto). */
const ASK_COOLDOWN_MS = 1000;

export interface Capitulo3Deps {
  /** En qué va un paso de historia (ver `Encargos.storyStep`). */
  step(userId: string, questId: string): "open" | "done" | null;
  bump(userId: string, key: string): void;
  bag: {
    count(userId: string, itemId: string): number;
    add(userId: string, itemId: string, quantity?: number): Promise<"ok" | "full" | "stack">;
    take(userId: string, itemId: string, quantity?: number): Promise<boolean>;
  };
  /** ¿Está esa sesión junto a quien da los encargos `giver` (su tile o su punto)? */
  near(sessionId: string, giver: string): boolean;
  /** ¿Brilla el agua del lago ahora? (`aguaBrilla` con el reloj del juego y el clima de afuera). */
  glowing(): boolean;
  now(): number;
  send(sessionId: string, type: string, msg: unknown): void;
}

const bait = objItemId(OBJETOS_LAGO.carnada);
const key = objItemId(OBJETOS_LAGO.llave);

export class Capitulo3 {
  /** A quién ya se le hizo el loco Don Evelio (la próxima pregunta, con la carta en la mano, suelta la receta). */
  private evelioPlayedDumb = new Set<string>();
  private lastAskAt = new Map<string, number>();

  constructor(private readonly deps: Capitulo3Deps) {}

  private cine(sessionId: string, id: string, vars?: Record<string, string | number>) {
    this.deps.send(sessionId, HISTORIA_MSG.cine, { id, ...(vars ? { vars } : {}) } satisfies HistoriaCine);
  }

  private aviso(sessionId: string, text: string) {
    this.deps.send(sessionId, HISTORIA_MSG.aviso, { text });
  }

  /** ¿Es una pregunta de este capítulo? (la sala le pasa solo las suyas). */
  static asks(questId: string): boolean {
    return Boolean(CAPITULO_3.asks?.[questId]);
  }

  /**
   * Preguntarle (o mostrarle algo) a quien da el paso, con ese paso abierto y junto a él: Celeste cuenta lo
   * del agua, Evelio se hace el loco y después suelta la receta, y Aurora reconoce la llave.
   */
  ask(sessionId: string, userId: string, questId: string) {
    const d = this.deps;
    const def = questById(questId);
    if (!def || !Capitulo3.asks(questId)) return;
    const now = d.now();
    if (now - (this.lastAskAt.get(userId) ?? -Infinity) < ASK_COOLDOWN_MS) return;
    if (d.step(userId, questId) !== "open") return;
    if (!d.near(sessionId, def.giver)) return this.aviso(sessionId, "Arrímese un poquito más pa' preguntarle.");
    this.lastAskAt.set(userId, now);
    switch (questId) {
      case LAGO_PASOS.celeste:
        d.bump(userId, HISTORIA_LAGO.celeste);
        return this.cine(sessionId, LAGO_CINE.celeste, { ahora: celesteAhora(d.glowing()) });
      case LAGO_PASOS.evelio:
        // La primera vez se hace el loco; a la siguiente (mostrándole la carta) suelta la receta.
        if (!this.evelioPlayedDumb.has(userId)) {
          this.evelioPlayedDumb.add(userId);
          return this.cine(sessionId, LAGO_CINE.evelioLoco);
        }
        this.evelioPlayedDumb.delete(userId);
        d.bump(userId, HISTORIA_LAGO.receta);
        return this.cine(sessionId, LAGO_CINE.evelioReceta);
      case LAGO_PASOS.aurora:
        if (d.bag.count(userId, key) === 0) return this.aviso(sessionId, "No tiene la llavecita en la mochila.");
        d.bump(userId, HISTORIA_LAGO.mostrada);
        return this.cine(sessionId, LAGO_CINE.aurora);
    }
  }

  /** Se cocinó algo en la estufa: la carnada de E. cumple el paso de cocinarla (si está abierto). */
  cooked(sessionId: string, userId: string, item: string) {
    if (item !== OBJETOS_LAGO.carnada || this.deps.step(userId, LAGO_PASOS.carnada) !== "open") return;
    this.deps.bump(userId, HISTORIA_LAGO.carnada);
    this.cine(sessionId, LAGO_CINE.carnada);
  }

  /**
   * Picó algo en el lago: con el paso de pescar abierto, el agua brillando y la carnada de E. en la mochila,
   * es la llavecita. Devuelve si lo es (la pesca termina el lance sin pez); darla va aparte.
   */
  hookKey(sessionId: string, userId: string, area: string): boolean {
    const d = this.deps;
    if (area !== LAGO_AREA || d.step(userId, LAGO_PASOS.pescar) !== "open") return false;
    if (!d.glowing() || d.bag.count(userId, bait) === 0) return false;
    void this.giveKey(sessionId, userId);
    return true;
  }

  /** Se gasta la carnada y sale la llave (si no cabe, la carnada vuelve). */
  private async giveKey(sessionId: string, userId: string) {
    const d = this.deps;
    if (!(await d.bag.take(userId, bait, 1))) return;
    if (d.bag.count(userId, key) === 0 && (await d.bag.add(userId, key, 1)) !== "ok") {
      await d.bag.add(userId, bait, 1);
      return this.aviso(sessionId, "Algo pesado se soltó del anzuelo: no le cabía en la mochila. Haga espacio y vuelva a intentar.");
    }
    d.bump(userId, HISTORIA_LAGO.llave);
    this.cine(sessionId, LAGO_CINE.pesca);
  }

  /** Se fue de la sala: se olvida lo suyo. */
  forget(userId: string) {
    this.evelioPlayedDumb.delete(userId);
    this.lastAskAt.delete(userId);
  }
}
