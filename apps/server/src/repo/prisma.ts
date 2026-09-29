import {
  addInventoryTx,
  applyStatChanges,
  claimQuest,
  loadQuests,
  loadAchievementRecord,
  unlockAchievement,
  awardPoints,
  awardPointsOnce,
  grantWelcomeBonus,
  casinoBet,
  ChatScope,
  getCasinoSettings,
  givenToday,
  leaveDoorNote,
  listInventory,
  loadBagSlots,
  saveBagSlots,
  unreadDoorNotes,
  type PresenceStatus as DbStatus,
  prisma,
  type Prisma,
  recordFishCatch,
  spendPoints,
  takeInventoryTx,
} from "@hyvento/db";
import {
  ARCADE_GAMES,
  CHAIR_RACE,
  DIRECTIONS,
  HUMAN_AVATARS,
  Look,
  type ArcadeGame,
  type BoardGameKind,
  type ChatEvent,
  type Direction,
  type HumanAvatar,
  type OfficeItemDTO,
  type PetBondRecord,
  type PointReason,
  type ManualStatus,
  type StatChange,
  type QuestDelta,
} from "@hyvento/shared";
import { executeTip, executeTrade } from "./social";
import type { AwardOnceInput, QuestClaimInput, GameRepository, GardenPlotRecord, OfficeItemsInput, OfficeItemsResult, TipInput, TipResult, TradeResult, TradeSideInput } from "./types";

/** Fila de WorldLayout donde se guarda el reloj del juego (no es un nivel). */
const GAME_CLOCK_ROW = "__reloj__";
/** Filas de WorldLayout con las rondas abiertas del casino de cada corrida (tampoco son niveles). */
const CASINO_OPEN_PREFIX = "__casino__:";

const toDbStatus = (s: ManualStatus) => s.toUpperCase() as DbStatus;
const fromDbStatus = (s: DbStatus) => s.toLowerCase() as ManualStatus;

const toItemDTO = (i: { id: string; type: string; x: number; y: number; facing: string }): OfficeItemDTO => ({
  id: i.id,
  type: i.type,
  x: i.x,
  y: i.y,
  facing: (DIRECTIONS as readonly string[]).includes(i.facing) ? (i.facing as Direction) : "right",
});

/** Corta la transacción del editor (se deshace todo) con el motivo para responder. */
class EditAborted extends Error {
  constructor(readonly code: "not-owned" | "unknown") {
    super(code);
  }
}

export class PrismaRepository implements GameRepository {
  async ensureOffices(offices: { zoneId: string; name: string }[]) {
    await prisma.$transaction(
      offices.map((o) =>
        prisma.office.upsert({ where: { zoneId: o.zoneId }, create: o, update: {} }),
      ),
    );
  }

  async listOffices() {
    const rows = await prisma.office.findMany({
      include: { owner: { select: { name: true } }, items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    return rows.map((o) => ({
      zoneId: o.zoneId,
      name: o.name,
      ownerId: o.ownerId,
      ownerName: o.owner?.name ?? null,
      locked: o.isLocked,
      floor: o.floor,
      wallpaper: o.wallpaper,
      customized: o.customized,
      items: o.items.map(toItemDTO),
    }));
  }

  async editOfficeItems({ zoneId, userId, defaults, edit }: OfficeItemsInput): Promise<OfficeItemsResult> {
    try {
      return await prisma.$transaction(async (tx) => {
        const office = await tx.office.findUnique({ where: { zoneId }, select: { id: true } });
        if (!office) throw new EditAborted("unknown");
        const officeId = office.id;
        // Primera edición: los muebles del mapa pasan a ser filas propias. El update condicional hace que
        // se copien una sola vez aunque lleguen dos cambios a la vez.
        const ids = new Map<string, string>();
        const first = await tx.office.updateMany({ where: { id: officeId, customized: false }, data: { customized: true } });
        if (first.count === 1) {
          for (const d of defaults) {
            const row = await tx.officeItem.create({ data: { officeId, type: d.type, x: d.x, y: d.y, facing: d.facing }, select: { id: true } });
            ids.set(d.id, row.id);
          }
        }
        const itemId = (id: string) => ids.get(id) ?? id;

        switch (edit.action) {
          case "place": {
            // Descuento condicional: sin unidades en la mochila no se pone nada.
            if (!(await takeInventoryTx(tx, userId, edit.type))) throw new EditAborted("not-owned");
            await tx.officeItem.create({ data: { officeId, type: edit.type, x: edit.x, y: edit.y, facing: edit.facing } });
            break;
          }
          case "move": {
            const moved = await tx.officeItem.updateMany({
              where: { id: itemId(edit.itemId), officeId },
              data: { x: edit.x, y: edit.y, facing: edit.facing },
            });
            if (moved.count === 0) throw new EditAborted("unknown");
            break;
          }
          case "remove": {
            const row = await tx.officeItem.findFirst({ where: { id: itemId(edit.itemId), officeId }, select: { id: true, type: true } });
            if (!row) throw new EditAborted("unknown");
            await tx.officeItem.delete({ where: { id: row.id } });
            await addInventoryTx(tx, userId, row.type, 1);
            break;
          }
        }
        const items = await tx.officeItem.findMany({ where: { officeId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
        return { ok: true as const, items: items.map(toItemDTO) };
      });
    } catch (err) {
      if (err instanceof EditAborted) return { ok: false, error: err.code };
      throw err;
    }
  }

  async setOfficeStyle(zoneId: string, style: { floor?: string; wallpaper?: string }) {
    await prisma.office.update({ where: { zoneId }, data: { floor: style.floor, wallpaper: style.wallpaper } });
  }

  async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, avatar: true, look: true } });
    if (!user) return null;
    const avatar = (HUMAN_AVATARS as readonly string[]).includes(user.avatar) ? (user.avatar as HumanAvatar) : "ada";
    const look = Look.safeParse(user.look);
    // Mismo nombre que va en el token de juego (ver /api/game-token).
    return { name: user.name || user.email, avatar, look: look.success ? look.data : null };
  }

  async setOfficeLocked(zoneId: string, locked: boolean) {
    await prisma.office.update({ where: { zoneId }, data: { isLocked: locked } });
  }

  async getUserStatus(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    return user ? fromDbStatus(user.status) : null;
  }

  async setUserStatus(userId: string, status: ManualStatus) {
    await prisma.user.update({ where: { id: userId }, data: { status: toDbStatus(status) } });
  }

  async loadGlobalChat(limit: number) {
    const rows = await prisma.chatMessage.findMany({
      where: { scope: "GLOBAL" },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { author: { select: { name: true } } },
    });
    return rows.reverse().map(
      (m): ChatEvent => ({
        id: m.id,
        // No es una sesión viva: los globos solo se muestran para mensajes recientes.
        fromId: `user:${m.authorId}`,
        fromName: m.author.name,
        text: m.text,
        scope: "global",
        zoneId: m.zoneId,
        ts: m.createdAt.getTime(),
      }),
    );
  }

  async saveChat(event: ChatEvent, authorUserId: string) {
    // Solo se persiste el canal global; el chat de proximidad/oficina es efímero.
    if (event.scope !== "global") return;
    await prisma.chatMessage.create({
      data: {
        id: event.id,
        authorId: authorUserId,
        scope: "GLOBAL",
        zoneId: event.zoneId,
        text: event.text,
        createdAt: new Date(event.ts),
      },
    });
  }

  async pruneChatBefore(cutoff: Date) {
    // Con el scope en la condición, Postgres usa el índice (scope, createdAt) en vez de recorrer la tabla.
    const { count } = await prisma.chatMessage.deleteMany({ where: { scope: { in: Object.values(ChatScope) }, createdAt: { lt: cutoff } } });
    return count;
  }

  async getPoints(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { points: true } });
    return user?.points ?? 0;
  }

  awardPoints(input: { userId: string; amount: number; reason: PointReason }) {
    return awardPoints(prisma, input);
  }
  grantWelcome(userId: string) {
    return grantWelcomeBonus(prisma, userId);
  }
  awardPointsOnce(input: AwardOnceInput) {
    return awardPointsOnce(prisma, input);
  }
  async listBirthdays() {
    const users = await prisma.user.findMany({ where: { birthday: { not: null } }, select: { id: true, name: true, email: true, birthday: true } });
    // Mismo nombre que en la cabaña: sin nombre visible, el correo.
    return users.map((u) => ({ userId: u.id, name: u.name || u.email.split("@")[0]!, birthday: u.birthday! }));
  }

  spendPoints(input: { userId: string; amount: number; reason: PointReason; refId?: string }) {
    return spendPoints(prisma, input);
  }

  getCasinoSettings() {
    return getCasinoSettings(prisma);
  }

  async loadWorldEdits() {
    const rows = await prisma.worldLayout.findMany({ where: { area: { not: GAME_CLOCK_ROW }, NOT: { area: { startsWith: CASINO_OPEN_PREFIX } } } });
    return Object.fromEntries(rows.map((r) => [r.area, r.edits as unknown]));
  }

  async saveWorldEdits(area: string, edits: unknown, userId: string) {
    const json = edits as Prisma.InputJsonValue;
    await prisma.worldLayout.upsert({ where: { area }, create: { area, edits: json, updatedBy: userId }, update: { edits: json, updatedBy: userId } });
  }

  // El reloj del juego va en una fila aparte de WorldLayout (sin migración); loadWorldEdits la salta
  // porque no es un nivel.
  async loadGameClock() {
    return (await prisma.worldLayout.findUnique({ where: { area: GAME_CLOCK_ROW } }))?.edits ?? null;
  }

  async saveGameClock(clock: { anchorReal: number; anchorMinute: number }, userId: string) {
    const json = { ...clock } as Prisma.InputJsonValue;
    await prisma.worldLayout.upsert({
      where: { area: GAME_CLOCK_ROW },
      create: { area: GAME_CLOCK_ROW, edits: json, updatedBy: userId },
      update: { edits: json, updatedBy: userId },
    });
  }

  async loadBoard(zoneId: string) {
    return (await prisma.whiteboard.findUnique({ where: { zoneId } }))?.strokes ?? null;
  }

  async saveBoard(zoneId: string, strokes: unknown) {
    const json = strokes as Prisma.InputJsonValue;
    await prisma.whiteboard.upsert({ where: { zoneId }, create: { zoneId, strokes: json }, update: { strokes: json } });
  }

  casinoBet(input: { userId: string; amount: number; refId: string }) {
    return casinoBet(prisma, input);
  }

  async casinoPayout({ userId, amount, refId }: { userId: string; amount: number; refId: string }) {
    const { balance } = await awardPoints(prisma, { userId, amount, reason: "CASINO", refId });
    return { balance };
  }

  saveFishCatch(input: { userId: string; species: string; size: number; points: number }) {
    return recordFishCatch(prisma, input);
  }

  // ---------- Mochila ----------

  addInventory(userId: string, itemId: string, quantity: number) {
    return addInventoryTx(prisma, userId, itemId, quantity);
  }

  takeInventory(userId: string, itemId: string, quantity: number) {
    return takeInventoryTx(prisma, userId, itemId, quantity);
  }

  loadStatsByPrefix(prefix: string) {
    return prisma.userStat.findMany({ where: { key: { startsWith: prefix } }, select: { userId: true, key: true, value: true } });
  }

  loadBagSlots(userId: string) {
    return loadBagSlots(prisma, userId);
  }

  saveBagSlots(userId: string, changes: Record<string, number | null>) {
    return saveBagSlots(prisma, userId, changes);
  }

  // ---------- Regalos e intercambios ----------

  getInventory(userId: string) {
    return listInventory(prisma, userId);
  }

  async givenToday(userId: string) {
    const { points, items } = await givenToday(prisma, userId);
    return { points, items };
  }

  executeTrade(input: { refId: string; a: TradeSideInput; b: TradeSideInput }): Promise<TradeResult> {
    return executeTrade(prisma, input);
  }

  tip(input: TipInput): Promise<TipResult> {
    return executeTip(prisma, input);
  }

  saveArcadeScore({ userId, game, score, dayStart, weekStart }: { userId: string; game: ArcadeGame; score: number; dayStart: number; weekStart: number }) {
    return prisma.$transaction(async (tx) => {
      // Un candado de la transacción para todo el arcade: dos partidas que terminan a la vez (aunque haya
      // más de un servidor) no leen el mismo récord ni cuentan las dos como la primera del día.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('hyvento:arcade'))`;
      const today = await tx.arcadeScore.count({ where: { userId, game: { in: [...ARCADE_GAMES] }, createdAt: { gte: new Date(dayStart) } } });
      const best = await tx.arcadeScore.findFirst({
        where: { game, createdAt: { gte: new Date(weekStart) } },
        orderBy: [{ score: "desc" }, { createdAt: "asc" }],
        select: { score: true, userId: true },
      });
      await tx.arcadeScore.create({ data: { userId, game, score } });
      return { firstToday: today === 0, weekBest: best?.score ?? 0, weekBestUserId: best?.userId ?? null };
    });
  }

  async arcadeBoard({ game, since, limit }: { game: ArcadeGame; since: number; limit: number }) {
    const rows = await prisma.arcadeScore.groupBy({
      by: ["userId"],
      where: { game, createdAt: { gte: new Date(since) } },
      _max: { score: true },
      orderBy: { _max: { score: "desc" } },
      take: limit,
    });
    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } });
    const names = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({ name: names.get(r.userId) || "Alguien", score: r._max.score ?? 0 }));
  }

  async saveRaceTime({ userId, ms }: { userId: string; name: string; ms: number }) {
    // Los tiempos van en la tabla de récords del arcade con su propio "juego" (el puntaje son ms).
    await prisma.arcadeScore.create({ data: { userId, game: CHAIR_RACE.game, score: ms } });
  }

  async raceBoard({ since, limit, userId }: { since: number; limit: number; userId: string }) {
    const where = { game: CHAIR_RACE.game, createdAt: { gte: new Date(since) } };
    const rows = await prisma.arcadeScore.groupBy({ by: ["userId"], where, _min: { score: true }, orderBy: { _min: { score: "asc" } }, take: limit });
    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } });
    const names = new Map(users.map((u) => [u.id, u.name]));
    const mine = await prisma.arcadeScore.aggregate({ where: { ...where, userId }, _min: { score: true } });
    return { entries: rows.map((r) => ({ name: names.get(r.userId) || "Alguien", ms: r._min.score ?? 0 })), myBest: mine._min.score ?? null };
  }

  async saveBoardWin({ userId, game }: { userId: string; name: string; game: BoardGameKind }) {
    // Las victorias van en la tabla de récords del arcade con su propio "juego": un punto cada una.
    await prisma.arcadeScore.create({ data: { userId, game, score: 1 } });
  }

  async boardRanking({ game, since, limit }: { game: BoardGameKind; since: number; limit: number }) {
    const rows = await prisma.arcadeScore.groupBy({
      by: ["userId"],
      where: { game, createdAt: { gte: new Date(since) } },
      _sum: { score: true },
      orderBy: { _sum: { score: "desc" } },
      take: limit,
    });
    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } });
    const names = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({ name: names.get(r.userId) || "Alguien", wins: r._sum.score ?? 0 }));
  }

  async loadAchievements(userId: string) {
    const r = await loadAchievementRecord(prisma, userId);
    return { stats: r.stats, unlocked: Object.keys(r.unlocked) };
  }

  saveStats(userId: string, changes: StatChange[], quests: QuestDelta[] = []) {
    return applyStatChanges(prisma, userId, changes, quests);
  }

  unlockAchievement(userId: string, achievementId: string) {
    return unlockAchievement(prisma, userId, achievementId);
  }

  loadQuests(userId: string, periods: string[], assign: { questId: string; period: string; goal: number }[]) {
    return loadQuests(prisma, userId, periods, assign);
  }

  claimQuest(input: QuestClaimInput) {
    return claimQuest(prisma, input);
  }

  saveDoorNote(input: { fromId: string; toId: string; zoneId: string; text: string }) {
    return leaveDoorNote(prisma, input);
  }

  unreadDoorNotes(userIds: string[]) {
    return unreadDoorNotes(prisma, userIds);
  }

  async getFeaturedBadge(userId: string) {
    const row = await prisma.featuredBadge.findUnique({ where: { userId }, select: { achievementId: true } });
    return row?.achievementId ?? null;
  }

  async loadPetBonds(): Promise<PetBondRecord[]> {
    const rows = await prisma.petBond.findMany({ include: { owner: { select: { name: true } } } });
    return rows.map((r) => ({ petId: r.petId, ownerId: r.ownerId, ownerName: r.owner?.name ?? "", love: r.love, loveAt: r.loveAt.getTime() }));
  }

  async savePetBond(bond: PetBondRecord) {
    const data = { ownerId: bond.ownerId, love: Math.round(bond.love), loveAt: new Date(bond.loveAt) };
    // Al adoptar se anota cuándo (la primera vez que aparece este dueño).
    const prev = await prisma.petBond.findUnique({ where: { petId: bond.petId }, select: { ownerId: true } });
    const adoptedAt = bond.ownerId && prev?.ownerId !== bond.ownerId ? { adoptedAt: new Date() } : bond.ownerId ? {} : { adoptedAt: null };
    await prisma.petBond.upsert({ where: { petId: bond.petId }, create: { petId: bond.petId, ...data, ...adoptedAt }, update: { ...data, ...adoptedAt } });
  }

  // ---------- Jardín vivo: el huerto ----------

  async loadGarden(): Promise<GardenPlotRecord[]> {
    const rows = await prisma.gardenPlot.findMany({ where: { crop: { not: null } }, include: { plantedBy: { select: { name: true } } } });
    return rows.map((r) => ({
      id: r.id,
      crop: r.crop!,
      plantedBy: r.plantedById ?? "",
      plantedByName: r.plantedBy?.name ?? "",
      plantedAt: r.plantedAt?.getTime() ?? 0,
      growthMs: r.growthMs,
      growthAt: r.growthAt?.getTime() ?? 0,
      wateredUntil: r.wateredUntil?.getTime() ?? 0,
    }));
  }

  async saveGardenPlot(id: number, plot: Omit<GardenPlotRecord, "id"> | null) {
    // Vacía: la fila queda sin cultivo (así se ve que la parcela existió).
    const date = (ms: number) => (ms > 0 ? new Date(ms) : null);
    const data = plot
      ? {
          crop: plot.crop,
          plantedById: plot.plantedBy || null,
          plantedAt: date(plot.plantedAt),
          growthMs: Math.round(plot.growthMs),
          growthAt: date(plot.growthAt),
          wateredUntil: date(plot.wateredUntil),
        }
      : { crop: null, plantedById: null, plantedAt: null, growthMs: 0, growthAt: null, wateredUntil: null };
    await prisma.gardenPlot.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  // ---------- Rondas abiertas del casino ----------
  // Van en filas de WorldLayout (sin migración), como el reloj del juego.

  async loadCasinoOpenRounds() {
    const rows = await prisma.worldLayout.findMany({ where: { area: { startsWith: CASINO_OPEN_PREFIX } } });
    return rows.map((r) => ({
      run: r.area.slice(CASINO_OPEN_PREFIX.length),
      refIds: Array.isArray(r.edits) ? r.edits.filter((x): x is string => typeof x === "string") : [],
      updatedAt: r.updatedAt.getTime(),
    }));
  }

  async saveCasinoOpenRounds(run: string, refIds: string[]) {
    const area = CASINO_OPEN_PREFIX + run;
    if (!refIds.length) {
      await prisma.worldLayout.deleteMany({ where: { area } });
      return;
    }
    await prisma.worldLayout.upsert({ where: { area }, create: { area, edits: refIds }, update: { edits: refIds } });
  }

  async claimCasinoOpenRounds(run: string, updatedAt: number) {
    const { count } = await prisma.worldLayout.deleteMany({ where: { area: CASINO_OPEN_PREFIX + run, updatedAt: new Date(updatedAt) } });
    return count === 1;
  }

  async casinoMovements(refIds: string[]) {
    if (!refIds.length) return [];
    const rows = await prisma.pointTransaction.findMany({ where: { reason: "CASINO", refId: { in: refIds } }, select: { userId: true, refId: true, amount: true } });
    return rows.map((r) => ({ userId: r.userId, refId: r.refId ?? "", amount: r.amount }));
  }
}
