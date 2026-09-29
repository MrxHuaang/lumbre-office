// La pesca del lago, autoritativa: el servidor decide cuándo pica, qué pez es, la semilla del minijuego,
// si aparece el cofre y el tamaño; el cliente solo juega. Al terminar se repite la partida con los mismos
// botones (`replayFishing`) y se revisa que el tiempo cuadre con el reloj del servidor. La sala le da el
// reloj, el azar y cómo avisar; este módulo no conoce Colyseus. El equipo (la caña y la carnada del
// puesto de pesca) lo elige la sala con lo que uno tiene en la mochila y llega en `cast`. Además (ver
// pesca-maestria.ts): la caña mejora con los peces que saca, pescar cerca de otro da suerte y antes de la
// picada puede haber mordisqueos que hay que dejar pasar.
import {
  BAIT_TUNING,
  FISHING,
  castLuck,
  fishingTogether,
  nibbleTimes,
  NIBBLES,
  rodMastery,
  FishFinishMessage,
  FishHookMessage,
  SIM_FRAME_MS,
  fishPoints,
  isTrash,
  biteWindowWith,
  minReelMs,
  pickFish,
  replayFishing,
  rollSize,
  type FishCatchResult,
  type FishingChallenge,
  type FishingEvent,
  type FishingGear,
  type FishingMastery,
  type FishingRod,
  type FishingPhase,
  type FishingTimings,
  type FishOutcome,
  type FishSpecies,
  type Weather,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";

interface Cast {
  castId: string;
  userId: string;
  /** Nivel donde pesca (la compañía solo cuenta en el mismo). */
  area: string;
  /** Dónde estaba al lanzar (si se mueve, se recoge el sedal). */
  x: number;
  y: number;
  phase: "wait" | "bite" | "reel";
  /** La caña y la carnada de este lance (la carnada ya se descontó al lanzar). */
  gear: FishingGear;
  /** Nivel de maestría de la caña al lanzar. */
  mastery: number;
  /** Los mordisqueos programados y cuándo fue el último (responder justo ahí asusta al pez). */
  nibbleTimers: { clear(): void }[];
  nibbledAt: number;
  /** Había alguien más pescando cerca al responder la picada. */
  group?: boolean;
  timer?: { clear(): void };
  fish?: FishSpecies;
  challenge?: FishingChallenge;
  /** Cuándo empezó el minijuego (reloj del servidor). */
  reelAt?: number;
}

export interface FishingDeps {
  later(ms: number, fn: () => void): { clear(): void };
  now(): number;
  /** Entero al azar en [0, n) (`crypto.randomInt`; los tests lo fijan). */
  random(n: number): number;
  timings(): FishingTimings;
  /** Hora del reloj del juego (0 a 23): decide qué peces pican (los de noche, del atardecer…). */
  hour(): number;
  /** El clima de afuera (algunos peces solo pican con lluvia, tormenta o niebla). */
  weather?(): Weather;
  repo(): Pick<GameRepository, "saveFishCatch">;
  newId(): string;
  /** Copia el estado de pesca a los `Player` de esa persona (lo ven todos). */
  setPhase(userId: string, phase: FishingPhase): void;
  /** Cuántos peces sacó con esa caña (la maestría; sin esto, ninguno). */
  rodCatches?(userId: string, rod: FishingRod): number;
  /** Avisa a quien pesca. */
  send(userId: string, event: FishingEvent): void;
  /** Cambió el saldo por un pez (`awarded` = lo que se sumó, para el "+N"). */
  points(userId: string, awarded: number, balance: number): void;
  /** Sacó algo del lago (para las estadísticas y los logros). `first` = primera vez de esa especie. */
  caught?(userId: string, fish: FishSpecies, size: number, first: boolean, treasure: boolean, rod: FishingRod): void;
}

export class Fishery {
  private casts = new Map<string, Cast>();
  /** Pez levantado sobre la cabeza después de atraparlo (se baja solo). */
  private shows = new Map<string, { clear(): void }>();

  constructor(private readonly deps: FishingDeps) {}

  /** ¿Está pescando? (para los tests y para no dejar sentarse a medio lance). */
  phaseOf(userId: string): Cast["phase"] | null {
    return this.casts.get(userId)?.phase ?? null;
  }

  /**
   * Lanzar: junto a un punto de pesca, de pie y sin otro lance en curso. Con carnada pica antes. Devuelve
   * si se lanzó (la sala descuenta la carnada solo entonces).
   */
  cast(
    who: { userId: string; x: number; y: number; seated: boolean; area?: string },
    near: boolean,
    gear: FishingGear = { rod: "bambu", bait: null },
  ): boolean {
    const { userId } = who;
    const refuse = (error: "far" | "seated" | "busy") => (this.deps.send(userId, { type: "refused", error }), false);
    if (!near) return refuse("far");
    if (who.seated) return refuse("seated");
    if (this.casts.has(userId)) return refuse("busy");
    this.clearShow(userId);
    const t = this.deps.timings();
    const catches = this.deps.rodCatches?.(userId, gear.rod) ?? 0;
    const { level, next } = rodMastery(catches);
    const cast: Cast = {
      castId: this.deps.newId(),
      userId,
      area: who.area ?? "",
      x: who.x,
      y: who.y,
      phase: "wait",
      gear,
      mastery: level,
      nibbleTimers: [],
      nibbledAt: -Infinity,
    };
    const bite = biteWindowWith(gear.bait, t.biteMinMs, t.biteMaxMs);
    const wait = bite.min + this.deps.random(Math.max(1, bite.max - bite.min + 1));
    cast.timer = this.deps.later(wait, () => this.bite(cast));
    for (const at of nibbleTimes(wait, (n) => this.deps.random(n))) cast.nibbleTimers.push(this.deps.later(at, () => this.nibble(cast)));
    this.casts.set(userId, cast);
    this.deps.setPhase(userId, "wait");
    const mastery: FishingMastery = { rod: gear.rod, level, next };
    this.deps.send(userId, { type: "cast", castId: cast.castId, mastery });
    return true;
  }

  /** Un mordisqueo: la boya tiembla un momento (lo ven todos) pero todavía no es la picada. */
  private nibble(cast: Cast) {
    if (this.casts.get(cast.userId) !== cast || cast.phase !== "wait") return;
    cast.nibbledAt = this.deps.now();
    this.deps.setPhase(cast.userId, "nibble");
    this.deps.send(cast.userId, { type: "nibble", castId: cast.castId });
    cast.nibbleTimers.push(
      this.deps.later(NIBBLES.showMs, () => {
        if (this.casts.get(cast.userId) === cast && cast.phase === "wait") this.deps.setPhase(cast.userId, "wait");
      }),
    );
  }

  /** ¿Alguien más tiene la caña en el agua cerca, en el mismo nivel? */
  private inGroup(cast: Cast): boolean {
    for (const other of this.casts.values()) if (other !== cast && fishingTogether(other, cast)) return true;
    return false;
  }

  /** ¡Pica! Hay que responder dentro de la ventana o el pez se va. */
  private bite(cast: Cast) {
    if (this.casts.get(cast.userId) !== cast || cast.phase !== "wait") return;
    const windowMs = this.deps.timings().biteWindowMs;
    cast.phase = "bite";
    cast.timer = this.deps.later(windowMs, () => this.end(cast, "missed"));
    this.deps.setPhase(cast.userId, "bite");
    this.deps.send(cast.userId, { type: "bite", castId: cast.castId, windowMs });
  }

  /**
   * Responder a la picada: se elige el pez (según la rareza, la hora del juego y el clima) y empieza el
   * minijuego.
   * Antes de que pique, el pez se asusta; la basura sale sin minijuego.
   */
  hook(userId: string, raw: unknown) {
    const parsed = FishHookMessage.safeParse(raw);
    const cast = this.casts.get(userId);
    if (!parsed.success || !cast || cast.castId !== parsed.data.castId) return;
    if (cast.phase === "wait") {
      // Respondió a un mordisqueo: con carnada, el pez se la llevó (ya se había gastado al lanzar).
      const trapped = this.deps.now() - cast.nibbledAt <= NIBBLES.trapMs;
      return this.end(cast, trapped && cast.gear.bait ? "stolen" : "early");
    }
    if (cast.phase !== "bite") return;
    cast.timer?.clear();
    cast.group = this.inGroup(cast);
    const luck = castLuck({ bait: cast.gear.bait ? BAIT_TUNING[cast.gear.bait].luck : 1, group: cast.group, mastery: cast.mastery });
    const fish = pickFish(this.deps.hour(), (n) => this.deps.random(n), this.deps.weather?.(), luck);
    cast.fish = fish;
    if (isTrash(fish)) return void this.land(cast, fish, false);
    const t = this.deps.timings();
    cast.challenge = {
      seed: this.deps.random(2 ** 31),
      difficulty: fish.difficulty,
      behavior: fish.behavior,
      rarity: fish.rarity,
      treasure: this.deps.random(1000) < FISHING.treasurePerMil,
      // La caña que de verdad tiene: el minijuego se repite con ella al validar.
      ...(cast.gear.rod !== "bambu" ? { rod: cast.gear.rod } : {}),
      ...(cast.mastery > 0 ? { mastery: cast.mastery } : {}),
    };
    cast.phase = "reel";
    cast.reelAt = this.deps.now();
    cast.timer = this.deps.later(t.reelMaxMs + t.slackMs, () => this.end(cast, "timeout"));
    this.deps.setPhase(userId, "reel");
    this.deps.send(userId, { type: "start", castId: cast.castId, challenge: cast.challenge, ...(cast.group ? { group: true } : {}) });
  }

  /**
   * Terminó el minijuego. Tiene que haber un minijuego en curso de esa persona con ese id, el tiempo tiene
   * que ser posible (ni menos que el mínimo de la dificultad ni más frames que el tiempo que pasó) y la
   * partida repetida con esos botones tiene que terminar igual. Después de responder, el lance se cierra
   * (un segundo aviso ya no encuentra nada).
   */
  async finish(userId: string, raw: unknown) {
    const parsed = FishFinishMessage.safeParse(raw);
    if (!parsed.success) return;
    const msg = parsed.data;
    const cast = this.casts.get(userId);
    if (!cast || cast.castId !== msg.castId || cast.phase !== "reel" || !cast.challenge || !cast.fish) {
      return this.deps.send(userId, { type: "end", castId: msg.castId, outcome: "invalid" });
    }
    const t = this.deps.timings();
    const elapsed = this.deps.now() - cast.reelAt!;
    const ch = cast.challenge;
    if (elapsed > t.reelMaxMs + t.slackMs) return this.end(cast, "timeout");
    const tooFast = elapsed + t.slackMs < minReelMs(ch.difficulty) || msg.frames * SIM_FRAME_MS > elapsed + t.slackMs;
    if (tooFast) return this.end(cast, "invalid");
    const run = replayFishing(ch, msg.inputs, msg.frames);
    if (!run || !run.done || run.frame !== msg.frames) return this.end(cast, "invalid");
    if (!run.caught) return this.end(cast, "escaped");
    await this.land(cast, cast.fish, ch.treasure && run.treasure);
  }

  /** Recoger el sedal (Esc, moverse, irse): el lance se pierde. */
  cancel(userId: string) {
    const cast = this.casts.get(userId);
    if (cast) this.end(cast, "cancelled");
  }

  /** La persona se movió o se sentó: si estaba pescando, se recoge el sedal. */
  moved(userId: string, x: number, y: number, seated: boolean) {
    const cast = this.casts.get(userId);
    if (cast && (seated || Math.hypot(x - cast.x, y - cast.y) > FISHING.moveTolerancePx)) this.end(cast, "cancelled");
  }

  /** Se fue de la sala: se olvida todo lo suyo. */
  forget(userId: string) {
    const cast = this.casts.get(userId);
    if (cast) this.remove(cast);
    this.clearShow(userId);
  }

  private remove(cast: Cast) {
    cast.timer?.clear();
    for (const t of cast.nibbleTimers) t.clear();
    if (this.casts.get(cast.userId) === cast) this.casts.delete(cast.userId);
  }

  private end(cast: Cast, outcome: FishOutcome) {
    if (this.casts.get(cast.userId) !== cast) return;
    this.remove(cast);
    this.deps.setPhase(cast.userId, "");
    this.deps.send(cast.userId, { type: "end", castId: cast.castId, outcome });
  }

  /** Lo sacó: tamaño al azar, se guarda, se suman los puntos y se levanta el pez para que lo vean todos. */
  private async land(cast: Cast, fish: FishSpecies, treasure: boolean) {
    this.remove(cast); // antes de esperar a la base: un aviso repetido ya no encuentra el lance
    const { userId } = cast;
    const size = rollSize(fish, (n) => this.deps.random(n));
    const points = fishPoints(fish) + (treasure ? FISHING.treasureBonus : 0);
    // La maestría sube con cada pez (no con la basura) sacado con esa caña.
    const before = this.deps.rodCatches?.(userId, cast.gear.rod) ?? 0;
    const up = rodMastery(before + 1).level;
    const masteryUp = !isTrash(fish) && up > rodMastery(before).level ? up : undefined;
    let saved: { previousBest: number | null; awarded: number; balance: number };
    try {
      saved = await this.deps.repo().saveFishCatch({ userId, species: fish.id, size, points });
    } catch (err) {
      console.error("saveFishCatch", err);
      this.deps.setPhase(userId, "");
      return this.deps.send(userId, { type: "end", castId: cast.castId, outcome: "invalid" });
    }
    this.deps.points(userId, saved.awarded, saved.balance);
    this.deps.caught?.(userId, fish, size, saved.previousBest === null, treasure, cast.gear.rod);
    const result: FishCatchResult = {
      species: fish.id,
      size,
      record: saved.previousBest === null || size > saved.previousBest,
      first: saved.previousBest === null,
      points: saved.awarded,
      treasure,
      ...(cast.group ? { group: true } : {}),
      ...(masteryUp ? { masteryUp } : {}),
    };
    if (!this.casts.has(userId)) {
      this.deps.setPhase(userId, `show:${fish.id}`);
      this.clearShow(userId);
      this.shows.set(
        userId,
        this.deps.later(this.deps.timings().showMs, () => {
          this.shows.delete(userId);
          if (!this.casts.has(userId)) this.deps.setPhase(userId, "");
        }),
      );
    }
    this.deps.send(userId, { type: "end", castId: cast.castId, outcome: "caught", catch: result });
  }

  private clearShow(userId: string) {
    this.shows.get(userId)?.clear();
    this.shows.delete(userId);
  }
}
