// Los encargos de quienes están en la sala (ver encargos.ts de @hyvento/shared). El avance sale de los
// contadores de los logros: cada suma pasa por `onStat`, que mueve los encargos asignados que la siguen
// (con la noche y el clima de ahora) en memoria —para avisar al instante— y deja el avance pendiente, que
// el rastreador de logros guarda junto con los contadores en la misma transacción (`take`/`restore`). Lo
// que manda es la base: al entregar se guarda todo primero y la entrega la decide `claimQuest` (que estaba
// cumplido y no entregado). La sala le da el reloj, la base, dónde está cada quien, la mochila y cómo
// avisar; este módulo no conoce Colyseus.
import { nearQuestGiver, type OfficeMap } from "@hyvento/map";
import {
  QUEST,
  QUEST_MSG,
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
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";
import type { Bag } from "./bag";

export interface EncargosDeps {
  repo(): Pick<GameRepository, "loadQuests" | "claimQuest">;
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
  held: Pick<Bag, "fits" | "add">;
  /** Guarda ya los contadores pendientes (y con ellos el avance de los encargos). */
  flushStats(userId: string): Promise<void>;
  /** Se pagó una entrega: el saldo nuevo y lo sumado (para el "+N" y el contador). */
  paid(userId: string, awarded: number, balance: number): void;
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
  listQueued: boolean;
  claiming: Set<string>;
}

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

  constructor(private readonly deps: EncargosDeps) {}

  private entry(userId: string): Entry {
    let e = this.users.get(userId);
    if (!e) {
      e = { rows: new Map(), pending: new Map(), loaded: false, day: "", listQueued: false, claiming: new Set() };
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
      const def = row.period === STORY_PERIOD && row.status === "ACTIVE" ? questById(row.questId) : undefined;
      if (def) story.push({ def, period: STORY_PERIOD, shared: false });
    }
    return story.length ? [...e.assigned.list, ...story] : e.assigned.list;
  }

  /** Lee de la base lo que tiene (y deja asignado lo de hoy). Lo sumado mientras tanto no se pierde. */
  load(userId: string): Promise<void> {
    const e = this.entry(userId);
    e.loading ??= this.fetch(userId, e).finally(() => (e.loading = undefined));
    return e.loading;
  }

  private async fetch(userId: string, e: Entry) {
    // Lo que ya estaba por guardarse llega primero a la base (así lo leído lo trae).
    await this.deps.flushStats(userId).catch(() => {});
    const now = this.deps.now();
    const active = this.deps.pick(userId, now);
    let saved: QuestRecord[];
    try {
      saved = await this.deps.repo().loadQuests(
        userId,
        questPeriods(now),
        active.map((a) => ({ questId: a.def.id, period: a.period, goal: a.def.goal })),
      );
    } catch (err) {
      console.error("loadQuests", err);
      return;
    }
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
    for (const r of done.values()) this.deps.send(userId, QUEST_MSG.done, { questId: r.questId, period: r.period } satisfies QuestDoneEvent);
    this.sendList(userId);
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
    let changed = false;
    for (const d of deltas) {
      const r = applyDelta(e.rows, d);
      if (!r) continue;
      changed = true;
      if (r === "done") this.deps.send(userId, QUEST_MSG.done, { questId: d.questId, period: d.period } satisfies QuestDoneEvent);
    }
    if (changed) this.queueList(userId, e);
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

  /** Muchas sumas seguidas (caminar) mandan una sola libreta. */
  private queueList(userId: string, e: Entry) {
    if (e.listQueued) return;
    e.listQueued = true;
    this.deps.later(250, () => {
      e.listQueued = false;
      if (this.users.get(userId) === e) this.sendList(userId);
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
    const def = questById(questId);
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
    this.lastClaimAt.set(userId, now);
    e.claiming.add(key);
    const next = def.next ? questById(def.next) : undefined;
    let outcome: Awaited<ReturnType<GameRepository["claimQuest"]>>;
    try {
      // Lo recién sumado tiene que estar en la base: la entrega la decide lo guardado.
      await this.deps.flushStats(userId);
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
      return fail("failed");
    } finally {
      e.claiming.delete(key);
    }
    if (!outcome.ok) return fail(outcome.error);
    const row = e.rows.get(key) ?? { questId, period, progress: def.goal, goal: def.goal, status: "CLAIMED" as const };
    e.rows.set(key, { ...row, progress: row.goal, status: "CLAIMED" });
    if (next) {
      const nk = questKey(next.id, STORY_PERIOD);
      if (!e.rows.has(nk)) e.rows.set(nk, { questId: next.id, period: STORY_PERIOD, progress: 0, goal: next.goal, status: "ACTIVE" });
    }
    if (item) await this.deps.held.add(userId, item.itemId, item.qty);
    this.deps.paid(userId, outcome.awarded, outcome.balance);
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

  /** Para los tests: lo que se sabe de alguien. */
  rowsOf(userId: string): QuestRecord[] {
    return [...(this.users.get(userId)?.rows.values() ?? [])].map((r) => ({ ...r }));
  }

  /** Se fue: se olvida (si no le queda nada por guardar). */
  forget(userId: string) {
    this.lastClaimAt.delete(userId);
    const e = this.users.get(userId);
    if (e && e.pending.size === 0 && !e.loading) this.users.delete(userId);
  }
}
