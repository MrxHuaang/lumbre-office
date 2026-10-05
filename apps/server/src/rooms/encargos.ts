// Los encargos de quienes están en la sala (ver encargos.ts de @hyvento/shared). El avance sale de los
// contadores de los logros: cada suma pasa por `onStat`, que mueve los encargos asignados que la siguen
// (con la noche y el clima de ahora) en memoria —para avisar al instante— y deja el avance pendiente, que
// el rastreador de logros guarda junto con los contadores en la misma transacción (`take`/`restore`). Lo
// que manda es la base: al entregar se guarda todo primero y la entrega la decide `claimQuest` (que estaba
// cumplido y no entregado). La sala le da el reloj, la base, dónde está cada quien, la mochila y cómo
// avisar; este módulo no conoce Colyseus. La historia también pasa por acá: sus pasos son encargos de
// período "historia" agrupados en capítulos (`CAPITULOS` de historia.ts): al entregar el último de uno se
// pone su bandera, llega su carta y se abre el primer paso del capítulo siguiente.
import { nearQuestGiver, type OfficeMap } from "@hyvento/map";
import {
  CAPITULOS,
  HISTORIA_MSG,
  MSG,
  QUEST,
  STORY_FIRST,
  capituloAbierto,
  type Capitulo,
  type HistoriaLetter,
  type HistoriaPrologue,
  type QuestDef,
  QUEST_MSG,
  STAT_KEYS,
  isNightMinute,
  QuestClaimMessage,
  STORY_PERIOD,
  claimWindow,
  dailyPeriod,
  objItemId,
  questById,
  questDeltas,
  questKey,
  questPeriods,
  questViews,
  weeklyPeriod,
  type ActiveQuest,
  type QuestClaimError,
  type QuestClaimResult,
  type QuestContext,
  type QuestDelta,
  type QuestDoneEvent,
  type QuestListEvent,
  type QuestRecord,
  type PointsAwarded,
  type Weather,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";
import type { Bag } from "./bag";

export interface EncargosDeps {
  repo(): Pick<GameRepository, "loadQuests" | "claimQuest" | "skipStory">;
  now(): number;
  /** Lo que le toca a alguien ahora (los 3 diarios y el semanal; los tests lo fijan). */
  pick(userId: string, now: number): ActiveQuest[];
  /** La noche del reloj del juego y el clima, para los encargos que solo cuentan entonces. */
  context(): QuestContext;
  /** Dónde está alguien (para validar que entregue junto a quien le dio el encargo). */
  place(userId: string): { area: string; x: number; y: number } | null;
  map(area: string): OfficeMap;
  send(userId: string, type: string, message: unknown): void;
  later(ms: number, fn: () => void): void;
  held: Pick<Bag, "fits" | "add" | "take" | "count">;
  /** Guarda ya los contadores pendientes (y con ellos el avance de los encargos). */
  flushStats(userId: string): Promise<void>;
  /** Se pagó una entrega: el saldo nuevo y lo sumado (para el "+N" y el contador). */
  paid(userId: string, awarded: number, balance: number): void;
  /** La experiencia de la entrega ya quedó guardada: el oficio la suma para el nivel (ver rooms/oficios.ts). */
  xp?(userId: string, skill: string, xp: number): void;
  /** Los contadores de alguien (la historia marca sola lo que ya hizo, y el prólogo sale una vez). */
  stats?: { load(userId: string): Promise<void>; stat(userId: string, key: string): number | undefined; max(userId: string, key: string, value: number): void };
  /** Terminó un capítulo de la historia (o saltó el 1): su bandera, el logro y la carta del buzón (ver historia.ts). */
  chapterDone?(userId: string, chapter: Capitulo): void;
  /** Los capítulos de la historia (los tests ponen los suyos; si no, `CAPITULOS`). */
  chapters?: readonly Capitulo[];
}

interface Entry {
  /** Lo guardado más lo que avanzó desde entonces (`questKey` → fila). */
  rows: Map<string, QuestRecord>;
  /** Avance que todavía no se guardó (`questKey` → delta). */
  pending: Map<string, QuestDelta>;
  loaded: boolean;
  loading?: Promise<void>;
  /** El día de lo cargado: si cambió, se vuelve a cargar (y a asignar lo de hoy). */
  day: string;
  /** Lo asignado, guardado por período (se pide en cada suma: tiles caminados incluidos). */
  assigned?: { key: string; list: ActiveQuest[] };
  /** Encargos que cambiaron y todavía no se avisaron (se mandan juntos, como mucho una vez por segundo). */
  changed: Set<string>;
  progressQueued: boolean;
  claiming: Set<string>;
  /** Si la carga falló: cuántas veces seguidas y desde cuándo se puede reintentar (la pausa crece). */
  failures: number;
  retryAt: number;
  /** Cambia en cada entrada (`load` con `join`): un `forget` de una sesión anterior no borra lo nuevo. */
  gen: number;
  /** La bienvenida de Doña Aurora, pendiente para esta entrada (solo si recién llegó). */
  prologue?: { byBus: boolean };
}

/** Cada cuánto, como mucho, se manda lo que avanzó (caminar suma de a baldosa). */
export const PROGRESS_EVERY_MS = 1000;
/** La pausa antes de reintentar una carga que falló: 2 s, 4 s, 8 s… hasta un minuto. */
export const retryDelayMs = (failures: number) => Math.min(60_000, 2000 * 2 ** Math.max(0, failures - 1));

/** Suma un avance a una fila (sin pasarse de la meta). "done" = se cumplió ahora. */
function applyDelta(rows: Map<string, QuestRecord>, d: QuestDelta): "done" | "progress" | null {
  const key = questKey(d.questId, d.period);
  const row = rows.get(key) ?? { questId: d.questId, period: d.period, progress: 0, goal: d.goal, status: "ACTIVE" as const };
  if (row.status !== "ACTIVE") return null;
  row.progress = Math.min(row.goal, row.progress + d.delta);
  if (row.progress >= row.goal) row.status = "DONE";
  rows.set(key, row);
  return row.status === "DONE" ? "done" : "progress";
}

function addPending(pending: Map<string, QuestDelta>, d: QuestDelta) {
  const key = questKey(d.questId, d.period);
  const p = pending.get(key);
  pending.set(key, p ? { ...p, delta: p.delta + d.delta } : { ...d });
}

export class Encargos {
  private users = new Map<string, Entry>();
  private lastClaimAt = new Map<string, number>();
  private readonly chapters: readonly Capitulo[];
  /** Los pasos de los capítulos, por id (los de los tests no están en el catálogo `QUESTS`). */
  private readonly steps: Map<string, QuestDef>;

  constructor(private readonly deps: EncargosDeps) {
    this.chapters = deps.chapters ?? CAPITULOS;
    this.steps = new Map(this.chapters.flatMap((c) => c.steps.map((q) => [q.id, q] as const)));
  }

  private quest(id: string): QuestDef | undefined {
    return this.steps.get(id) ?? questById(id);
  }

  private chapterOf(questId: string): Capitulo | undefined {
    return this.chapters.find((c) => c.steps.some((q) => q.id === questId));
  }

  /** El primer paso de cada capítulo que alguien tiene abierto (lo que lo abre se cumple, según sus contadores). */
  private openFirsts(userId: string): QuestDef[] {
    const stat = (key: string) => this.deps.stats?.stat(userId, key);
    return this.chapters.filter((c) => capituloAbierto(c, stat)).map((c) => c.steps[0]!);
  }

  private entry(userId: string): Entry {
    let e = this.users.get(userId);
    if (!e) {
      e = { rows: new Map(), pending: new Map(), loaded: false, day: "", changed: new Set(), progressQueued: false, claiming: new Set(), failures: 0, retryAt: 0, gen: 0 };
      this.users.set(userId, e);
    }
    return e;
  }

  /** Lo asignado ahora: lo del día y la semana, y los pasos de historia abiertos. */
  private assigned(userId: string, e: Entry, now: number): ActiveQuest[] {
    const key = `${dailyPeriod(now)}|${weeklyPeriod(now)}`;
    if (e.assigned?.key !== key) e.assigned = { key, list: this.deps.pick(userId, now) };
    const story: ActiveQuest[] = [];
    for (const row of e.rows.values()) {
      const def = row.period === STORY_PERIOD && row.status === "ACTIVE" ? this.quest(row.questId) : undefined;
      if (def) story.push({ def, period: STORY_PERIOD, shared: false });
    }
    return story.length ? [...e.assigned.list, ...story] : e.assigned.list;
  }

  /**
   * Lee de la base lo que tiene (y deja asignado lo de hoy). Lo sumado mientras tanto no se pierde. Con
   * `join` (al entrar) empieza una sesión nueva: un `forget` de la anterior ya no la borra. Si la carga
   * viene fallando, entre intento e intento hay una pausa creciente (salvo al entrar o al pedirla la web).
   */
  load(userId: string, opts: { join?: boolean; force?: boolean; newcomer?: boolean; byBus?: boolean } = {}): Promise<void> {
    const e = this.entry(userId);
    if (opts.join) e.gen += 1;
    if (opts.join && opts.newcomer) e.prologue = { byBus: Boolean(opts.byBus) };
    if (!opts.join && !opts.force && this.deps.now() < e.retryAt) return Promise.resolve();
    e.loading ??= this.fetch(userId, e).finally(() => (e.loading = undefined));
    return e.loading;
  }

  /** La sesión de ahora (para que `forget` sepa si sigue siendo la misma). */
  generation(userId: string): number {
    return this.users.get(userId)?.gen ?? 0;
  }

  private async fetch(userId: string, e: Entry) {
    // Lo que ya estaba por guardarse llega primero a la base (así lo leído lo trae).
    await this.deps.flushStats(userId).catch(() => {});
    const now = this.deps.now();
    const active = this.deps.pick(userId, now);
    // Los contadores dicen qué capítulos tiene abiertos (la bandera del anterior).
    await this.deps.stats?.load(userId).catch(() => {});
    let saved: QuestRecord[];
    try {
      // El primer paso de cada capítulo abierto queda asignado (el del 1, a todos; si ya existía, no se toca).
      saved = await this.deps.repo().loadQuests(userId, questPeriods(now), [
        ...active.map((a) => ({ questId: a.def.id, period: a.period, goal: a.def.goal })),
        ...this.openFirsts(userId).map((q) => ({ questId: q.id, period: STORY_PERIOD, goal: q.goal })),
      ]);
    } catch (err) {
      console.error("loadQuests", err);
      e.failures += 1;
      e.retryAt = this.deps.now() + retryDelayMs(e.failures);
      return;
    }
    e.failures = 0;
    e.retryAt = 0;
    const rows = new Map(saved.map((r) => [questKey(r.questId, r.period), { ...r }]));
    // Se avisa lo que se cumplió con lo sumado mientras se leía y, si ya se sabía lo de antes, lo que la
    // web cumplió por su lado (una misión, una foto).
    const done = new Map<string, QuestRecord>();
    for (const d of e.pending.values()) if (applyDelta(rows, d) === "done") done.set(questKey(d.questId, d.period), rows.get(questKey(d.questId, d.period))!);
    if (e.loaded) for (const [k, r] of rows) if (r.status === "DONE" && e.rows.get(k)?.status !== "DONE") done.set(k, r);
    e.rows = rows;
    e.loaded = true;
    e.day = dailyPeriod(now);
    e.assigned = undefined;
    await this.storyFromStats(userId, e);
    for (const r of done.values()) this.deps.send(userId, QUEST_MSG.done, { questId: r.questId, period: r.period } satisfies QuestDoneEvent);
    this.sendList(userId);
  }

  /**
   * La historia y lo que ya se hizo: un paso abierto de un capítulo que lo permite (el 1) cuyo contador ya
   * llega a la meta (quien ya jugaba) se marca hecho solo. Y a quien recién llegó, la bienvenida de Doña
   * Aurora, una sola vez.
   */
  private async storyFromStats(userId: string, e: Entry) {
    const stats = this.deps.stats;
    if (!stats) return;
    await stats.load(userId).catch(() => {});
    for (const row of [...e.rows.values()]) {
      const def = row.period === STORY_PERIOD && row.status === "ACTIVE" ? this.quest(row.questId) : undefined;
      if (!def || !this.chapterOf(def.id)?.fromStats) continue;
      const need = def.goal - row.progress;
      if (need > 0 && (stats.stat(userId, def.stat) ?? 0) >= def.goal) {
        const d = { questId: def.id, period: STORY_PERIOD, delta: need, goal: def.goal };
        addPending(e.pending, d);
        applyDelta(e.rows, d);
      }
    }
    const pending = e.prologue;
    e.prologue = undefined;
    const first = this.chapters[0]?.steps[0]?.id ?? STORY_FIRST;
    const started = [...e.rows.values()].some((r) => r.period === STORY_PERIOD && (r.status !== "ACTIVE" || r.progress > 0 || r.questId !== first));
    if (pending && !started && !stats.stat(userId, STAT_KEYS.storyPrologue)) {
      stats.max(userId, STAT_KEYS.storyPrologue, 1);
      this.deps.send(userId, HISTORIA_MSG.prologue, pending satisfies HistoriaPrologue);
    }
  }

  /**
   * Terminó un capítulo: su bandera, el logro y la carta (`chapterDone`), y se abre el primer paso de los
   * capítulos que eso abre. Si abrirlo falla, la próxima carga lo abre (la bandera ya quedó).
   */
  private async finishChapter(userId: string, e: Entry, chapter: Capitulo) {
    this.deps.chapterDone?.(userId, chapter);
    const missing = this.openFirsts(userId).filter((q) => !e.rows.has(questKey(q.id, STORY_PERIOD)));
    if (missing.length === 0) return;
    try {
      const saved = await this.deps.repo().loadQuests(userId, [], missing.map((q) => ({ questId: q.id, period: STORY_PERIOD, goal: q.goal })));
      for (const r of saved) if (r.period === STORY_PERIOD && !e.rows.has(questKey(r.questId, r.period))) e.rows.set(questKey(r.questId, r.period), { ...r });
    } catch (err) {
      console.error("abrir capítulo", err);
      return;
    }
    await this.storyFromStats(userId, e);
  }

  /** Saltar el capítulo 1 (los demás no se saltan): lo que falte queda entregado sin pagar, y llegan el logro y la carta igual. */
  async skipStory(userId: string): Promise<boolean> {
    const e = this.entry(userId);
    const chapter = this.chapters[0];
    if (!chapter) return false;
    const all = chapter.steps.map((q) => ({ questId: q.id, goal: q.goal }));
    if (all.every((q) => e.rows.get(questKey(q.questId, STORY_PERIOD))?.status === "CLAIMED")) return false;
    try {
      await this.deps.flushStats(userId);
      await this.deps.repo().skipStory(userId, all, this.deps.now());
    } catch (err) {
      console.error("skipStory", err);
      return false;
    }
    for (const q of all) e.rows.set(questKey(q.questId, STORY_PERIOD), { questId: q.questId, period: STORY_PERIOD, progress: q.goal, goal: q.goal, status: "CLAIMED" });
    const skipped = new Set(all.map((q) => questKey(q.questId, STORY_PERIOD)));
    for (const k of [...e.pending.keys()]) if (skipped.has(k)) e.pending.delete(k);
    await this.finishChapter(userId, e, chapter);
    this.sendList(userId);
    return true;
  }

  /** Subió un contador de alguien (lo llama el rastreador de logros en cada suma). */
  onStat(userId: string, key: string, by: number) {
    const now = this.deps.now();
    const e = this.entry(userId);
    const deltas = questDeltas(this.assigned(userId, e, now), key, by, this.deps.context());
    if (deltas.length === 0) return;
    for (const d of deltas) addPending(e.pending, d);
    // Sin saber lo que tenía no se avisa nada (la carga lo suma y avisa).
    if (!e.loaded) return void this.load(userId);
    // Cambió el día: lo de hoy se asigna en la base (mientras, lo nuevo cuenta desde cero).
    if (e.day !== dailyPeriod(now) && !e.loading) void this.load(userId);
    for (const d of deltas) {
      const r = applyDelta(e.rows, d);
      if (!r) continue;
      e.changed.add(questKey(d.questId, d.period));
      if (r === "done") this.deps.send(userId, QUEST_MSG.done, { questId: d.questId, period: d.period } satisfies QuestDoneEvent);
    }
    if (e.changed.size) this.queueProgress(userId, e);
  }

  /** El avance pendiente de alguien, para guardarlo con los contadores (queda vacío). */
  take(userId: string): QuestDelta[] {
    const e = this.users.get(userId);
    if (!e || e.pending.size === 0) return [];
    const out = [...e.pending.values()];
    e.pending.clear();
    return out;
  }

  /** No se pudo guardar: vuelve a la cola (con lo que llegó mientras tanto). */
  restore(userId: string, deltas: QuestDelta[]) {
    const e = this.entry(userId);
    for (const d of deltas) addPending(e.pending, d);
  }

  /** La libreta de alguien, como la ve el cliente. */
  view(userId: string): QuestListEvent {
    const now = this.deps.now();
    const e = this.entry(userId);
    return { quests: questViews(this.assigned(userId, e, now), [...e.rows.values()], now) };
  }

  sendList(userId: string) {
    this.deps.send(userId, QUEST_MSG.list, this.view(userId));
  }

  /** Lo que avanzó se manda solo (sin la libreta entera) y, con muchas sumas seguidas, una vez por segundo. */
  private queueProgress(userId: string, e: Entry) {
    if (e.progressQueued) return;
    e.progressQueued = true;
    this.deps.later(PROGRESS_EVERY_MS, () => {
      e.progressQueued = false;
      if (this.users.get(userId) !== e || e.changed.size === 0) return;
      const quests = this.view(userId).quests.filter((q) => e.changed.has(questKey(q.questId, q.period)));
      e.changed.clear();
      if (quests.length) this.deps.send(userId, QUEST_MSG.progress, { quests } satisfies QuestListEvent);
    });
  }

  /**
   * Entregar un encargo: junto a quien lo dio, cumplido, sin entregar, del período vigente (o del de ayer) y
   * con lugar en la mochila si trae algo. Devuelve la respuesta para quien entrega (null si el mensaje no sirve).
   */
  async claim(userId: string, raw: unknown): Promise<QuestClaimResult | null> {
    const parsed = QuestClaimMessage.safeParse(raw);
    if (!parsed.success) return null;
    const { questId, period } = parsed.data;
    const fail = (error: QuestClaimError): QuestClaimResult => ({ ok: false, questId, period, error });
    const def = this.quest(questId);
    if (!def || (def.kind === "story") !== (period === STORY_PERIOD)) return fail("unknown");
    const now = this.deps.now();
    if (now - (this.lastClaimAt.get(userId) ?? -Infinity) < QUEST.claimCooldownMs) return fail("busy");
    if (claimWindow(period, now) === "closed") return fail("expired");
    const at = this.deps.place(userId);
    if (!at || !nearQuestGiver(this.deps.map(at.area), def.giver, at.x, at.y)) return fail("far");
    const e = this.entry(userId);
    const key = questKey(questId, period);
    if (e.rows.get(key)?.status === "CLAIMED") return fail("claimed");
    if (e.claiming.has(key)) return fail("busy");
    const item = def.reward.item ? { itemId: objItemId(def.reward.item.id), qty: def.reward.item.qty } : null;
    if (item) {
      const fits = this.deps.held.fits(userId, [[item.itemId, item.qty]]);
      if (fits !== "ok") return fail(fits);
    }
    // Lo que el paso pide entregar (objetos de historia): todo tiene que estar en la mochila.
    const deliver = def.deliver ?? [];
    if (deliver.some((d) => this.deps.held.count(userId, d.itemId) < d.n)) return fail("missing");
    this.lastClaimAt.set(userId, now);
    e.claiming.add(key);
    const next = def.next ? this.quest(def.next) : undefined;
    let outcome: Awaited<ReturnType<GameRepository["claimQuest"]>>;
    /** El objeto ya está en la mochila (apartado antes de entregar): si la entrega no sale, se devuelve. */
    let reserved = false;
    /** Lo entregado ya salió de la mochila: si la entrega no sale, vuelve. */
    const handed: { itemId: string; n: number }[] = [];
    const unreserve = () => {
      if (reserved && item) void this.deps.held.take(userId, item.itemId, item.qty);
      for (const d of handed.splice(0)) void this.deps.held.add(userId, d.itemId, d.n);
    };
    try {
      // Lo recién sumado tiene que estar en la base: la entrega la decide lo guardado.
      await this.deps.flushStats(userId);
      // Lo que se entrega sale primero de la mochila, todo o nada: si algo ya no está, vuelve lo sacado.
      for (const d of deliver) {
        if (!(await this.deps.held.take(userId, d.itemId, d.n))) {
          unreserve();
          return fail("missing");
        }
        handed.push(d);
      }
      // El objeto va primero a la mochila (sin marcar ni cobrar nada): si ya no cabe, no se entrega.
      if (item) {
        const added = await this.deps.held.add(userId, item.itemId, item.qty);
        if (added !== "ok") {
          unreserve();
          return fail(added);
        }
        reserved = true;
      }
      outcome = await this.deps.repo().claimQuest({
        userId,
        questId,
        period,
        points: def.reward.points,
        skill: def.reward.skill,
        xp: def.reward.xp,
        next: next && { questId: next.id, goal: next.goal },
        now,
      });
    } catch (err) {
      console.error("claimQuest", err);
      unreserve();
      return fail("failed");
    } finally {
      e.claiming.delete(key);
    }
    if (!outcome.ok) {
      unreserve();
      return fail(outcome.error);
    }
    const row = e.rows.get(key) ?? { questId, period, progress: def.goal, goal: def.goal, status: "CLAIMED" as const };
    e.rows.set(key, { ...row, progress: row.goal, status: "CLAIMED" });
    if (next) {
      const nk = questKey(next.id, STORY_PERIOD);
      if (!e.rows.has(nk)) e.rows.set(nk, { questId: next.id, period: STORY_PERIOD, progress: 0, goal: next.goal, status: "ACTIVE" });
      // Si eso ya lo había hecho antes (quien ya jugaba), queda hecho solo.
      await this.storyFromStats(userId, e);
    } else if (def.kind === "story") {
      const chapter = this.chapterOf(def.id);
      if (chapter) await this.finishChapter(userId, e, chapter);
    }
    this.deps.paid(userId, outcome.awarded, outcome.balance);
    this.deps.xp?.(userId, def.reward.skill, def.reward.xp);
    this.sendList(userId);
    return {
      ok: true,
      questId,
      period,
      points: outcome.awarded,
      capped: outcome.awarded < def.reward.points,
      skill: def.reward.skill,
      xp: def.reward.xp,
      item: item?.itemId ?? null,
      balance: outcome.balance,
    };
  }

  /**
   * En qué va un paso de historia de alguien: "open" (abierto, todavía sin cumplir), "done" (cumplido o ya
   * entregado) o null (no lo tiene, o no se ha cargado). Lo usan las salas de cada capítulo.
   */
  storyStep(userId: string, questId: string): "open" | "done" | null {
    const row = this.users.get(userId)?.rows.get(questKey(questId, STORY_PERIOD));
    if (!row) return null;
    return row.status === "ACTIVE" && row.progress < row.goal ? "open" : "done";
  }

  /** Para los tests: lo que se sabe de alguien. */
  rowsOf(userId: string): QuestRecord[] {
    return [...(this.users.get(userId)?.rows.values() ?? [])].map((r) => ({ ...r }));
  }

  /**
   * Se fue: se olvida (si no le queda nada por guardar). Con `gen` (la sesión que se fue), solo si no
   * volvió a entrar mientras tanto: así un `forget` tardío no borra lo que acaba de cargar la sesión nueva.
   */
  forget(userId: string, gen?: number) {
    const e = this.users.get(userId);
    if (gen !== undefined && e && e.gen !== gen) return;
    this.lastClaimAt.delete(userId);
    if (e && e.pending.size === 0 && !e.loading) this.users.delete(userId);
  }
}

/** Lo que la sala le presta a los encargos (así en OfficeRoom va una sola línea). */
export interface EncargosRoomParts {
  room: {
    state: { players: { values(): IterableIterator<{ userId: string; area: string; x: number; y: number; points: number }> }; weather: string };
    clients: Iterable<{ sessionId: string; send(type: string, message: unknown): void }>;
    clock: { setTimeout(fn: () => void, ms: number): unknown };
  };
  repo: EncargosDeps["repo"];
  held: EncargosDeps["held"];
  stats: {
    flush(userId: string): Promise<void>;
    max(userId: string, key: string, value: number): void;
    load(userId: string): Promise<void>;
    stat(userId: string, key: string): number | undefined;
  };
  minuteOfDay(): number;
  mapOf(area: string): OfficeMap;
  now(): number;
  pick: EncargosDeps["pick"];
  xp?: EncargosDeps["xp"];
  chapters?: EncargosDeps["chapters"];
}

/** Los encargos de una sala: el reloj, el clima, dónde está cada quien, cómo avisar y el pago. */
export function encargosDeSala(parts: EncargosRoomParts): Encargos {
  const { room } = parts;
  const players = () => [...room.state.players.values()];
  const sessionsOf = (userId: string) => {
    const out: { sessionId: string; send(type: string, message: unknown): void }[] = [];
    const bySession = room.state.players as unknown as { get(id: string): { userId: string } | undefined };
    for (const c of room.clients) if (bySession.get(c.sessionId)?.userId === userId) out.push(c);
    return out;
  };
  const send = (userId: string, type: string, message: unknown) => {
    for (const c of sessionsOf(userId)) c.send(type, message);
  };
  return new Encargos({
    repo: parts.repo,
    now: parts.now,
    pick: parts.pick,
    context: () => ({ night: isNightMinute(parts.minuteOfDay()), weather: room.state.weather as Weather }),
    place: (userId) => {
      const bySession = room.state.players as unknown as { get(id: string): { area: string; x: number; y: number } | undefined };
      const c = sessionsOf(userId)[0];
      const p = c && bySession.get(c.sessionId);
      return p ? { area: p.area, x: p.x, y: p.y } : null;
    },
    map: parts.mapOf,
    send,
    later: (ms, fn) => void room.clock.setTimeout(fn, ms),
    held: parts.held,
    flushStats: (userId) => parts.stats.flush(userId),
    paid: (userId, amount, balance) => {
      for (const p of players()) if (p.userId === userId) p.points = balance;
      if (amount > 0) send(userId, MSG.pointsAwarded, { amount, reason: "QUEST", balance } satisfies PointsAwarded);
      parts.stats.max(userId, STAT_KEYS.pointsPeak, balance);
    },
    xp: parts.xp,
    stats: parts.stats,
    chapters: parts.chapters,
    // Un capítulo terminado (o el 1 saltado): su bandera (con ella el logro y la insignia) y, la primera vez,
    // su carta en el buzón.
    chapterDone: (userId, chapter) => {
      const first = !parts.stats.stat(userId, chapter.flag);
      parts.stats.max(userId, chapter.flag, 1);
      if (first && chapter.letter) send(userId, HISTORIA_MSG.letter, { id: chapter.letter.id, chapter: chapter.id } satisfies HistoriaLetter);
    },
  });
}
