import {
  CLUB_TIP,
  DAILY_CAPS,
  DOOR_NOTES,
  dayStart,
  doorNotesDayStart,
  doorNotesLeft,
  giftAllowedToday,
  stackUnits,
  tipAllowedToday,
  tradeGap,
  type ArcadeGame,
  type BoardGameKind,
  type CasinoSettingsDTO,
  type ChatEvent,
  type ItemStack,
  type OfficeItemDTO,
  type PetBondRecord,
  type PointReason,
  type ManualStatus,
  type StatChange,
} from "@hyvento/shared";
import type { AwardOnceInput, GameRepository, GardenPlotRecord, OfficeItemsInput, OfficeItemsResult, OfficeRecord, TipInput, TipResult, TradeResult, TradeSideInput, UserProfile } from "./types";

/** Repositorio en memoria para tests. */
export class MemoryRepository implements GameRepository {
  offices = new Map<string, OfficeRecord>();
  statuses = new Map<string, ManualStatus>();
  profiles = new Map<string, UserProfile>();
  chat: ChatEvent[] = [];
  /** Libro de puntos en memoria. */
  ledger: { userId: string; amount: number; reason: PointReason; at: number; refId?: string }[] = [];
  /** Mochilas: `${userId}:${itemId}` → unidades guardadas. */
  inventory = new Map<string, number>();
  private nextItemId = 1;

  async ensureOffices(offices: { zoneId: string; name: string }[]) {
    for (const o of offices) {
      if (!this.offices.has(o.zoneId)) {
        this.offices.set(o.zoneId, { ...o, ownerId: null, ownerName: null, locked: false, floor: null, wallpaper: null, customized: false, items: [] });
      }
    }
  }
  async listOffices() {
    return [...this.offices.values()].map((o) => ({ ...o, items: o.items.map((i) => ({ ...i })) }));
  }
  async setOfficeLocked(zoneId: string, locked: boolean) {
    const o = this.offices.get(zoneId);
    if (o) o.locked = locked;
  }

  async editOfficeItems({ zoneId, userId, defaults, edit }: OfficeItemsInput): Promise<OfficeItemsResult> {
    const office = this.offices.get(zoneId);
    if (!office) return { ok: false, error: "unknown" };
    // Se trabaja sobre copias y se guarda al final: si algo falla no queda nada a medias (como la transacción).
    let items = office.items.map((i) => ({ ...i }));
    const ids = new Map<string, string>();
    if (!office.customized) {
      for (const d of defaults) {
        const id = `item-${this.nextItemId++}`;
        ids.set(d.id, id);
        items.push({ ...d, id });
      }
    }
    const inventory = new Map(this.inventory);
    const key = (itemId: string) => `${userId}:${itemId}`;
    switch (edit.action) {
      case "place": {
        const have = inventory.get(key(edit.type)) ?? 0;
        if (have < 1) return { ok: false, error: "not-owned" };
        inventory.set(key(edit.type), have - 1);
        items.push({ id: `item-${this.nextItemId++}`, type: edit.type, x: edit.x, y: edit.y, facing: edit.facing });
        break;
      }
      case "move": {
        const id = ids.get(edit.itemId) ?? edit.itemId;
        const item = items.find((i) => i.id === id);
        if (!item) return { ok: false, error: "unknown" };
        Object.assign(item, { x: edit.x, y: edit.y, facing: edit.facing });
        break;
      }
      case "remove": {
        const id = ids.get(edit.itemId) ?? edit.itemId;
        const item = items.find((i) => i.id === id);
        if (!item) return { ok: false, error: "unknown" };
        items = items.filter((i) => i !== item);
        inventory.set(key(item.type), (inventory.get(key(item.type)) ?? 0) + 1);
        break;
      }
    }
    office.items = items;
    office.customized = true;
    this.inventory = inventory;
    return { ok: true, items: items.map((i) => ({ ...i })) };
  }

  async setOfficeStyle(zoneId: string, style: { floor?: string; wallpaper?: string }) {
    const o = this.offices.get(zoneId);
    if (!o) return;
    if (style.floor) o.floor = style.floor;
    if (style.wallpaper) o.wallpaper = style.wallpaper;
  }

  async getUserStatus(userId: string) {
    return this.statuses.get(userId) ?? null;
  }
  async getUserProfile(userId: string) {
    return this.profiles.get(userId) ?? null;
  }
  async setUserStatus(userId: string, status: ManualStatus) {
    this.statuses.set(userId, status);
  }
  async loadGlobalChat(limit: number) {
    return this.chat.slice(-limit);
  }
  async saveChat(event: ChatEvent) {
    if (event.scope === "global") this.chat.push(event);
  }

  async getPoints(userId: string) {
    return this.ledger.filter((m) => m.userId === userId).reduce((a, m) => a + m.amount, 0);
  }
  async awardPoints({ userId, amount, reason }: { userId: string; amount: number; reason: PointReason }) {
    const now = Date.now();
    const cap = DAILY_CAPS[reason];
    if (cap !== null) {
      const today = this.ledger
        .filter((m) => m.userId === userId && m.reason === reason && m.at >= dayStart(now))
        .reduce((a, m) => a + m.amount, 0);
      amount = Math.min(amount, cap - today);
    }
    if (amount > 0) this.ledger.push({ userId, amount, reason, at: now });
    return { awarded: Math.max(0, amount), balance: await this.getPoints(userId) };
  }
  async awardPointsOnce({ userId, amount, reason, refId, refPrefix, maxPerDay }: AwardOnceInput) {
    const now = Date.now();
    const mine = this.ledger.filter((m) => m.userId === userId);
    if (mine.some((m) => m.refId === refId)) return { status: "duplicate" as const, awarded: 0, balance: await this.getPoints(userId) };
    if (mine.filter((m) => m.refId?.startsWith(refPrefix) && m.at >= dayStart(now)).length >= maxPerDay)
      return { status: "limit" as const, awarded: 0, balance: await this.getPoints(userId) };
    const r = await this.awardPoints({ userId, amount, reason });
    // Como en la base: el movimiento queda con su refId (awardPoints lo acaba de agregar al final).
    if (r.awarded > 0) this.ledger[this.ledger.length - 1]!.refId = refId;
    return { status: "ok" as const, ...r };
  }
  /** Cumpleaños de los tests: userId → { nombre, "MM-DD" }. */
  birthdays = new Map<string, { name: string; birthday: string }>();
  async listBirthdays() {
    return [...this.birthdays].map(([userId, b]) => ({ userId, ...b }));
  }
  /** Bono de bienvenida de los tests: 0 (apagado) salvo que un test lo prenda. */
  welcomeBonus = 0;
  private welcomed = new Set<string>();
  async grantWelcome(userId: string) {
    if (this.welcomeBonus <= 0 || this.welcomed.has(userId)) return { granted: false, balance: await this.getPoints(userId) };
    this.welcomed.add(userId);
    this.ledger.push({ userId, amount: this.welcomeBonus, reason: "ADMIN", at: Date.now(), refId: "bienvenida" });
    return { granted: true, balance: await this.getPoints(userId) };
  }
  async spendPoints({ userId, amount, reason, refId }: { userId: string; amount: number; reason: PointReason; refId?: string }) {
    const balance = await this.getPoints(userId);
    if (balance < amount) return { ok: false, balance };
    this.ledger.push({ userId, amount: -amount, reason, at: Date.now(), refId });
    return { ok: true, balance: balance - amount };
  }

  /** Ajustes del casino en memoria (los tests los cambian directo). */
  casinoSettings: CasinoSettingsDTO = { enabled: true };
  /** Cambios del editor de la casa en memoria. */
  worldEdits: Record<string, unknown> = {};
  async loadWorldEdits() {
    return { ...this.worldEdits };
  }
  async saveWorldEdits(area: string, edits: unknown) {
    this.worldEdits[area] = JSON.parse(JSON.stringify(edits));
  }
  /** Reloj del juego guardado en memoria (null = el de siempre). */
  gameClock: unknown = null;
  async loadGameClock() {
    return this.gameClock;
  }
  async saveGameClock(clock: { anchorReal: number; anchorMinute: number }) {
    this.gameClock = { ...clock };
  }
  boards = new Map<string, unknown>();
  async loadBoard(zoneId: string) {
    return this.boards.get(zoneId) ?? null;
  }
  async saveBoard(zoneId: string, strokes: unknown) {
    this.boards.set(zoneId, JSON.parse(JSON.stringify(strokes)));
  }
  async getCasinoSettings() {
    return { ...this.casinoSettings };
  }
  async casinoBet({ userId, amount, refId }: { userId: string; amount: number; refId: string }) {
    const spent = await this.spendPoints({ userId, amount, reason: "CASINO", refId });
    return spent.ok ? { ok: true as const, balance: spent.balance } : { ok: false as const, error: "funds" as const, balance: spent.balance };
  }
  async casinoPayout({ userId, amount, refId }: { userId: string; amount: number; refId: string }) {
    if (amount > 0) this.ledger.push({ userId, amount, reason: "CASINO", at: Date.now(), refId });
    return { balance: await this.getPoints(userId) };
  }

  /** Peces atrapados (pesca). */
  catches: { userId: string; species: string; size: number; at: number }[] = [];
  async saveFishCatch({ userId, species, size, points }: { userId: string; species: string; size: number; points: number }) {
    const sizes = this.catches.filter((c) => c.userId === userId && c.species === species).map((c) => c.size);
    this.catches.push({ userId, species, size, at: Date.now() });
    const award = points > 0 ? await this.awardPoints({ userId, amount: points, reason: "LEISURE" }) : { awarded: 0, balance: await this.getPoints(userId) };
    return { previousBest: sizes.length ? Math.max(...sizes) : null, ...award };
  }

  /** Partidas del arcade guardadas. */
  arcade: { userId: string; name: string; game: ArcadeGame; score: number; at: number }[] = [];
  async saveArcadeScore({ userId, name, game, score, dayStart: day, weekStart: week }: { userId: string; name: string; game: ArcadeGame; score: number; dayStart: number; weekStart: number }) {
    const firstToday = !this.arcade.some((a) => a.userId === userId && a.at >= day);
    // El récord es del primero que llegó a ese puntaje.
    let best: { userId: string; score: number } | null = null;
    for (const a of this.arcade) if (a.game === game && a.at >= week && (!best || a.score > best.score)) best = a;
    this.arcade.push({ userId, name, game, score, at: Date.now() });
    return { firstToday, weekBest: best?.score ?? 0, weekBestUserId: best?.userId ?? null };
  }
  /** Tiempos de la carrera de sillas. */
  races: { userId: string; name: string; ms: number; at: number }[] = [];
  async saveRaceTime({ userId, name, ms }: { userId: string; name: string; ms: number }) {
    this.races.push({ userId, name, ms, at: Date.now() });
  }
  async raceBoard({ since, limit, userId }: { since: number; limit: number; userId: string }) {
    const best = new Map<string, { name: string; ms: number }>();
    for (const r of this.races) {
      if (r.at < since) continue;
      const b = best.get(r.userId);
      if (!b || r.ms < b.ms) best.set(r.userId, { name: r.name, ms: r.ms });
    }
    return { entries: [...best.values()].sort((a, b) => a.ms - b.ms).slice(0, limit), myBest: best.get(userId)?.ms ?? null };
  }
  /** Victorias de ajedrez y damas. */
  boardWins: { userId: string; name: string; game: BoardGameKind; at: number }[] = [];
  async saveBoardWin({ userId, name, game }: { userId: string; name: string; game: BoardGameKind }) {
    this.boardWins.push({ userId, name, game, at: Date.now() });
  }
  async boardRanking({ game, since, limit }: { game: BoardGameKind; since: number; limit: number }) {
    const wins = new Map<string, { name: string; wins: number }>();
    for (const w of this.boardWins) {
      if (w.game !== game || w.at < since) continue;
      const e = wins.get(w.userId) ?? { name: w.name, wins: 0 };
      e.wins += 1;
      wins.set(w.userId, e);
    }
    return [...wins.values()].sort((a, b) => b.wins - a.wins).slice(0, limit);
  }
  async arcadeBoard({ game, since, limit }: { game: ArcadeGame; since: number; limit: number }) {
    const best = new Map<string, { name: string; score: number }>();
    for (const a of this.arcade) {
      if (a.game !== game || a.at < since) continue;
      const b = best.get(a.userId);
      if (!b || a.score > b.score) best.set(a.userId, { name: a.name, score: a.score });
    }
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /** Logros en memoria: contadores por persona y logros desbloqueados. */
  userStats = new Map<string, Map<string, number>>();
  achievements = new Map<string, Set<string>>();
  /** Cuántas veces se guardaron contadores (para ver que se agrupan). */
  statSaves = 0;
  async loadAchievements(userId: string) {
    return { stats: Object.fromEntries(this.userStats.get(userId) ?? []), unlocked: [...(this.achievements.get(userId) ?? [])] };
  }
  async saveStats(userId: string, changes: StatChange[]) {
    this.statSaves++;
    const stats = this.userStats.get(userId) ?? new Map<string, number>();
    for (const c of changes) stats.set(c.key, c.op === "inc" ? (stats.get(c.key) ?? 0) + c.value : Math.max(stats.get(c.key) ?? c.value, c.value));
    this.userStats.set(userId, stats);
  }
  /** Parcelas sembradas del huerto, por índice. */
  garden = new Map<number, GardenPlotRecord>();
  async loadGarden() {
    return [...this.garden.values()].map((p) => ({ ...p }));
  }
  async saveGardenPlot(id: number, plot: Omit<GardenPlotRecord, "id"> | null) {
    if (plot) this.garden.set(id, { id, ...plot });
    else this.garden.delete(id);
  }

  async unlockAchievement(userId: string, achievementId: string) {
    const set = this.achievements.get(userId) ?? new Set<string>();
    this.achievements.set(userId, set);
    if (set.has(achievementId)) return false;
    set.add(achievementId);
    return true;
  }
  /** Insignias destacadas y mascotas adoptadas (en memoria). */
  featuredBadges = new Map<string, string>();
  petBonds = new Map<string, PetBondRecord>();
  async getFeaturedBadge(userId: string) {
    return this.featuredBadges.get(userId) ?? null;
  }
  async loadPetBonds() {
    return [...this.petBonds.values()].map((b) => ({ ...b }));
  }
  async savePetBond(bond: PetBondRecord) {
    // Como en la base: una mascota por dueño.
    for (const b of this.petBonds.values()) if (bond.ownerId && b.ownerId === bond.ownerId && b.petId !== bond.petId) throw new Error("ya tiene mascota");
    this.petBonds.set(bond.petId, { ...bond });
  }

  /** Helper de tests: un contador guardado. */
  savedStat(userId: string, key: string) {
    return this.userStats.get(userId)?.get(key) ?? 0;
  }

  /** Notas en la puerta (como DoorNote). */
  doorNotes: { id: string; fromId: string; toId: string; zoneId: string; text: string; at: number; read: boolean }[] = [];
  async saveDoorNote({ fromId, toId, zoneId, text }: { fromId: string; toId: string; zoneId: string; text: string }) {
    const now = Date.now();
    const sent = this.doorNotes.filter((n) => n.fromId === fromId && n.at >= doorNotesDayStart(now)).length;
    if (sent >= DOOR_NOTES.perDay) return { ok: false as const, error: "limit" as const };
    this.doorNotes.push({ id: `nota-${this.doorNotes.length + 1}`, fromId, toId, zoneId, text, at: now, read: false });
    const unread = this.doorNotes.filter((n) => n.toId === toId && !n.read).length;
    return { ok: true as const, left: doorNotesLeft(sent + 1), unread };
  }
  async unreadDoorNotes(userIds: string[]) {
    const out: Record<string, number> = {};
    for (const n of this.doorNotes) if (!n.read && userIds.includes(n.toId)) out[n.toId] = (out[n.toId] ?? 0) + 1;
    return out;
  }

  /** Helper de tests: asigna una oficina. */
  assign(zoneId: string, ownerId: string | null, ownerName: string | null) {
    const o = this.offices.get(zoneId);
    if (!o) throw new Error(`No existe ${zoneId}`);
    o.ownerId = ownerId;
    o.ownerName = ownerName;
  }

  /** Helper de tests: mete unidades en la mochila de alguien. */
  give(userId: string, itemId: string, quantity = 1) {
    const key = `${userId}:${itemId}`;
    this.inventory.set(key, (this.inventory.get(key) ?? 0) + quantity);
  }

  /** Helper de tests: unidades guardadas. */
  held(userId: string, itemId: string) {
    return this.inventory.get(`${userId}:${itemId}`) ?? 0;
  }

  /** Helper de tests: decora una oficina a mano. */
  decorate(zoneId: string, items: OfficeItemDTO[]) {
    const o = this.offices.get(zoneId);
    if (!o) throw new Error(`No existe ${zoneId}`);
    o.items = items.map((i) => ({ ...i }));
    o.customized = true;
  }

  // ---------- Mochila ----------

  /** Casillas de la mochila: `userId` → itemId → casilla. */
  bagSlots = new Map<string, Map<string, number>>();

  async addInventory(userId: string, itemId: string, quantity: number) {
    this.give(userId, itemId, quantity);
    return this.held(userId, itemId);
  }

  async takeInventory(userId: string, itemId: string, quantity: number) {
    const have = this.held(userId, itemId);
    if (have < quantity) return false;
    this.inventory.set(`${userId}:${itemId}`, have - quantity);
    return true;
  }

  async loadStatsByPrefix(prefix: string) {
    const out: { userId: string; key: string; value: number }[] = [];
    for (const [userId, stats] of this.userStats) for (const [key, value] of stats) if (key.startsWith(prefix)) out.push({ userId, key, value });
    return out;
  }

  async loadBagSlots(userId: string) {
    return Object.fromEntries(this.bagSlots.get(userId) ?? []);
  }

  async saveBagSlots(userId: string, changes: Record<string, number | null>) {
    const slots = this.bagSlots.get(userId) ?? new Map<string, number>();
    for (const [itemId, slot] of Object.entries(changes)) {
      if (slot === null) slots.delete(itemId);
      else slots.set(itemId, slot);
    }
    this.bagSlots.set(userId, slots);
  }

  // ---------- Regalos e intercambios ----------

  async getInventory(userId: string): Promise<ItemStack[]> {
    const prefix = `${userId}:`;
    return [...this.inventory]
      .filter(([key, quantity]) => key.startsWith(prefix) && quantity > 0)
      .map(([key, quantity]) => ({ itemId: key.slice(prefix.length), quantity }))
      .sort((a, b) => a.itemId.localeCompare(b.itemId));
  }

  /** Muebles que salieron en intercambios (como ItemTransfer): cuentan para el tope diario de dar. */
  itemTransfers: { fromId: string; toId: string; itemId: string; quantity: number; at: number }[] = [];

  async givenToday(userId: string, now = Date.now()) {
    const since = dayStart(now);
    const points = -this.ledger.filter((m) => m.userId === userId && m.reason === "GIFT" && m.amount < 0 && m.at >= since).reduce((sum, m) => sum + m.amount, 0);
    const items = this.itemTransfers.filter((t) => t.fromId === userId && t.at >= since).reduce((sum, t) => sum + t.quantity, 0);
    return { points, items };
  }

  /** Si se fija, `executeTrade` espera esta promesa antes de escribir (para probar lo que pasa mientras). */
  tradeGate: Promise<void> | null = null;

  async executeTrade({ refId, a, b }: { refId: string; a: TradeSideInput; b: TradeSideInput }): Promise<TradeResult> {
    if (this.tradeGate) await this.tradeGate;
    if (tradeGap(a, b) !== "ok") return { ok: false, error: "one-sided", userId: (a.points > 0 || a.items.length > 0 ? b : a).userId };
    // Todo se revalida y se aplica sobre copias: si algo no alcanza no queda nada a medias (como la transacción).
    const inventory = new Map(this.inventory);
    const moves: typeof this.ledger = [];
    const now = Date.now();
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      const units = stackUnits(from.items);
      const allowed = giftAllowedToday({ gifts: 0, ...(await this.givenToday(from.userId, now)) }, from.points, units);
      if (allowed === "points") return { ok: false, error: "limit", userId: from.userId };
      if (allowed === "items") return { ok: false, error: "limit-items", userId: from.userId };
      if (from.points > 0) {
        if ((await this.getPoints(from.userId)) < from.points) return { ok: false, error: "funds", userId: from.userId };
        moves.push({ userId: from.userId, amount: -from.points, reason: "GIFT", at: now, refId });
        moves.push({ userId: to.userId, amount: from.points, reason: "GIFT", at: now, refId });
      }
      for (const it of from.items) {
        const have = inventory.get(`${from.userId}:${it.itemId}`) ?? 0;
        if (have < it.quantity) return { ok: false, error: "items", userId: from.userId };
        inventory.set(`${from.userId}:${it.itemId}`, have - it.quantity);
      }
    }
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const)
      for (const it of from.items) {
        inventory.set(`${to.userId}:${it.itemId}`, (inventory.get(`${to.userId}:${it.itemId}`) ?? 0) + it.quantity);
        this.itemTransfers.push({ fromId: from.userId, toId: to.userId, itemId: it.itemId, quantity: it.quantity, at: now });
      }
    this.inventory = inventory;
    this.ledger.push(...moves);
    return { ok: true, balances: { [a.userId]: await this.getPoints(a.userId), [b.userId]: await this.getPoints(b.userId) } };
  }

  // ---------- Propinas del tubo ----------

  /** Lo que alguien tiró hoy en propinas (GIFT con refId "tip:…"), como `tippedToday` de @hyvento/db. */
  tippedToday(userId: string, now = Date.now()) {
    const since = dayStart(now);
    return -this.ledger
      .filter((m) => m.userId === userId && m.reason === "GIFT" && m.amount < 0 && m.at >= since && m.refId?.startsWith(CLUB_TIP.refPrefix))
      .reduce((sum, m) => sum + m.amount, 0);
  }

  async tip({ refId, fromId, toId, amount }: TipInput): Promise<TipResult> {
    const now = Date.now();
    const allowed = tipAllowedToday(this.tippedToday(fromId, now), (await this.givenToday(fromId, now)).points, amount);
    if (allowed === "tips") return { ok: false, error: "limit-tips" };
    if (allowed === "points") return { ok: false, error: "limit" };
    if ((await this.getPoints(fromId)) < amount) return { ok: false, error: "funds" };
    this.ledger.push({ userId: fromId, amount: -amount, reason: "GIFT", at: now, refId }, { userId: toId, amount, reason: "GIFT", at: now, refId });
    return { ok: true, balances: { [fromId]: await this.getPoints(fromId), [toId]: await this.getPoints(toId) } };
  }

  /** Notas de cada persona (la más reciente al final), para la impresora. */
  notes = new Map<string, string[]>();
  async latestNoteTitle(userId: string) {
    const list = this.notes.get(userId);
    return list?.length ? list.at(-1)!.trim() || "Sin título" : null;
  }
}
