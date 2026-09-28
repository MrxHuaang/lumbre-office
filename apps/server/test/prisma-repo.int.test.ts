// Tests de integración de PrismaRepository contra un Postgres de verdad (con las migraciones aplicadas).
// Solo corren con PRISMA_INT=1 y una DATABASE_URL local (el job "db" del CI, o una base aparte en Docker).
// Sin eso se saltan, así `pnpm test` no necesita base. Cada corrida usa ids propios, así que se puede
// repetir sobre la misma base sin limpiar; aun así, que sea una base de prueba.
import type { PrismaClient } from "@hyvento/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaRepository } from "../src/repo/prisma";

const dbUrl = process.env.DATABASE_URL ?? "";
// Nunca contra Neon ni otra base remota: solo localhost (el servicio de Postgres del CI también lo es).
const enabled = process.env.PRISMA_INT === "1" && /@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);

const run = `int${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!enabled)("PrismaRepository (Postgres real)", () => {
  let repo: PrismaRepository;
  let prisma: PrismaClient;
  let ana: string;
  let beto: string;
  const since = Date.now() - 1000;

  beforeAll(async () => {
    // Import dinámico: sin PRISMA_INT no se toca el cliente de Prisma.
    ({ prisma } = await import("@hyvento/db"));
    const { PrismaRepository } = await import("../src/repo/prisma");
    repo = new PrismaRepository();
    const mk = (name: string) =>
      prisma.user.create({ data: { email: `${name.toLowerCase()}.${run}@hyvento.test`, name, avatar: "carla" }, select: { id: true } });
    ana = (await mk("Ana")).id;
    beto = (await mk("Beto")).id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("oficinas: crea las que faltan, sin duplicar, y guarda candado y estilo", async () => {
    const zoneId = `${run}-oficina`;
    await repo.ensureOffices([{ zoneId, name: "Oficina de prueba" }]);
    await repo.ensureOffices([{ zoneId, name: "Otro nombre" }]); // no pisa lo que ya existe
    await repo.setOfficeLocked(zoneId, true);
    await repo.setOfficeStyle(zoneId, { floor: "madera" });
    const office = (await repo.listOffices()).find((o) => o.zoneId === zoneId);
    expect(office).toMatchObject({ name: "Oficina de prueba", locked: true, floor: "madera", wallpaper: null, customized: false, items: [] });
  });

  it("muebles de la oficina: copia los del mapa, cobra de la mochila y devuelve al quitar", async () => {
    const zoneId = `${run}-deco`;
    await repo.ensureOffices([{ zoneId, name: "Deco" }]);
    const defaults = [{ id: "map-0", type: "plant", x: 1, y: 1, facing: "right" as const }];
    // Sin la unidad en la mochila no se pone nada (y la transacción se deshace entera).
    const denied = await repo.editOfficeItems({ zoneId, userId: ana, defaults, edit: { action: "place", type: "lamp", x: 2, y: 2, facing: "right" } });
    expect(denied).toEqual({ ok: false, error: "not-owned" });
    expect((await repo.listOffices()).find((o) => o.zoneId === zoneId)?.customized).toBe(false);

    expect(await repo.addInventory(ana, "lamp", 1)).toBe(1);
    const placed = await repo.editOfficeItems({ zoneId, userId: ana, defaults, edit: { action: "place", type: "lamp", x: 2, y: 2, facing: "right" } });
    if (!placed.ok) throw new Error("no se puso la lámpara");
    expect(placed.items.map((i) => i.type)).toEqual(["plant", "lamp"]);
    expect(await repo.takeInventory(ana, "lamp", 1)).toBe(false); // se gastó al ponerla

    // Ya decorada, "map-0" no existe (la copia tiene id propio): no se mueve nada.
    const moved = await repo.editOfficeItems({ zoneId, userId: ana, defaults, edit: { action: "move", itemId: "map-0", x: 3, y: 1, facing: "left" } });
    expect(moved).toEqual({ ok: false, error: "unknown" });

    const plant = placed.items.find((i) => i.type === "plant")!;
    const moved2 = await repo.editOfficeItems({ zoneId, userId: ana, defaults, edit: { action: "move", itemId: plant.id, x: 3, y: 1, facing: "left" } });
    expect(moved2.ok && moved2.items.find((i) => i.id === plant.id)).toMatchObject({ x: 3, y: 1, facing: "left" });

    const lamp = placed.items.find((i) => i.type === "lamp")!;
    const removed = await repo.editOfficeItems({ zoneId, userId: ana, defaults, edit: { action: "remove", itemId: lamp.id } });
    expect(removed.ok && removed.items.map((i) => i.type)).toEqual(["plant"]);
    expect(await repo.takeInventory(ana, "lamp", 1)).toBe(true); // volvió a la mochila
  });

  it("perfil y estado", async () => {
    expect(await repo.getUserProfile(ana)).toEqual({ name: "Ana", avatar: "carla", look: null });
    expect(await repo.getUserProfile(`${run}-nadie`)).toBeNull();
    expect(await repo.getUserStatus(ana)).toBe("available");
    await repo.setUserStatus(ana, "busy");
    expect(await repo.getUserStatus(ana)).toBe("busy");
  });

  it("chat global: guarda solo el global, lo devuelve en orden y poda lo viejo", async () => {
    const now = Date.now();
    const ev = (id: string, ts: number, scope: "global" | "proximity" = "global") => ({
      id: `${run}-${id}`,
      fromId: "s1",
      fromName: "Ana",
      text: id,
      scope,
      zoneId: null,
      ts,
    });
    await repo.saveChat(ev("viejo", now - 40 * DAY), ana);
    await repo.saveChat(ev("hola", now - 2000), ana);
    await repo.saveChat(ev("chao", now - 1000), ana);
    await repo.saveChat(ev("cerca", now - 500, "proximity"), ana); // efímero: no se guarda
    const mine = (await repo.loadGlobalChat(500)).filter((m) => m.id.startsWith(run));
    expect(mine.map((m) => m.text)).toEqual(["viejo", "hola", "chao"]);
    expect(mine[1]).toMatchObject({ fromId: `user:${ana}`, fromName: "Ana", scope: "global" });

    expect(await repo.pruneChatBefore(new Date(now - 30 * DAY))).toBeGreaterThanOrEqual(1);
    expect(await repo.pruneChatBefore(new Date(now - 30 * DAY))).toBe(0); // idempotente
    const left = (await repo.loadGlobalChat(500)).filter((m) => m.id.startsWith(run));
    expect(left.map((m) => m.text)).toEqual(["hola", "chao"]);
  });

  it("puntos: premio, bono de bienvenida una sola vez y gasto solo si alcanza", async () => {
    expect(await repo.getPoints(beto)).toBe(0);
    const w1 = await repo.grantWelcome(beto);
    const w2 = await repo.grantWelcome(beto);
    expect(w1.granted).toBe(true);
    expect(w2).toMatchObject({ granted: false, balance: w1.balance });
    const award = await repo.awardPoints({ userId: beto, amount: 25, reason: "ADMIN" });
    expect(award).toEqual({ awarded: 25, balance: w1.balance + 25 });
    const tooMuch = await repo.spendPoints({ userId: beto, amount: award.balance + 1, reason: "PURCHASE" });
    expect(tooMuch).toEqual({ ok: false, balance: award.balance });
    const spent = await repo.spendPoints({ userId: beto, amount: 5, reason: "PURCHASE" });
    expect(spent).toEqual({ ok: true, balance: award.balance - 5 });
    expect(await repo.getPoints(beto)).toBe(award.balance - 5);
  });

  it("premio único por refId y con tope por día", async () => {
    const input = { userId: ana, amount: 3, reason: "ADMIN" as const, refId: `${run}-cumple`, refPrefix: `${run}-`, maxPerDay: 1 };
    expect((await repo.awardPointsOnce(input)).status).toBe("ok");
    expect((await repo.awardPointsOnce(input)).status).toBe("duplicate");
    expect((await repo.awardPointsOnce({ ...input, refId: `${run}-otro` })).status).toBe("limit");
  });

  it("casino: apuesta solo con saldo y paga el premio", async () => {
    const balance = await repo.getPoints(beto);
    expect(await repo.casinoBet({ userId: beto, amount: balance + 1, refId: `${run}-b0` })).toEqual({ ok: false, error: "funds", balance });
    expect(await repo.casinoBet({ userId: beto, amount: 10, refId: `${run}-b1` })).toEqual({ ok: true, balance: balance - 10 });
    expect(await repo.casinoPayout({ userId: beto, amount: 20, refId: `${run}-b1` })).toEqual({ balance: balance + 10 });
    const settings = await repo.getCasinoSettings();
    expect(settings).toBeTruthy();
  });

  it("editor de la casa y reloj del juego (la fila del reloj no es un nivel)", async () => {
    const area = `${run}-nivel`;
    await repo.saveWorldEdits(area, { removed: [], added: [] }, ana);
    await repo.saveGameClock({ anchorReal: 1, anchorMinute: 2 }, ana);
    const edits = await repo.loadWorldEdits();
    expect(edits[area]).toEqual({ removed: [], added: [] });
    expect(Object.keys(edits)).not.toContain("__reloj__");
    expect(await repo.loadGameClock()).toEqual({ anchorReal: 1, anchorMinute: 2 });
  });

  it("pizarra", async () => {
    const zoneId = `${run}-sala`;
    expect(await repo.loadBoard(zoneId)).toBeNull();
    await repo.saveBoard(zoneId, [{ c: 1, p: [0, 0, 1, 1] }]);
    await repo.saveBoard(zoneId, [{ c: 2, p: [1, 1] }]);
    expect(await repo.loadBoard(zoneId)).toEqual([{ c: 2, p: [1, 1] }]);
  });

  it("mochila: casillas guardadas y olvidadas", async () => {
    await repo.saveBagSlots(ana, { lamp: 3, plant: 5 });
    await repo.saveBagSlots(ana, { plant: null, lamp: 4 });
    expect(await repo.loadBagSlots(ana)).toEqual({ lamp: 4 });
    expect(await repo.addInventory(ana, "lamp", 2)).toBe(2);
    expect((await repo.getInventory(ana)).find((i) => i.itemId === "lamp")?.quantity).toBe(2);
  });

  it("arcade, carrera y juegos de mesa: récords desde el inicio de la corrida", async () => {
    const first = await repo.saveArcadeScore({ userId: ana, game: "snake", score: 7, dayStart: since, weekStart: since });
    expect(first).toEqual({ firstToday: true, weekBest: 0, weekBestUserId: null });
    const second = await repo.saveArcadeScore({ userId: beto, game: "snake", score: 3, dayStart: since, weekStart: since });
    expect(second).toEqual({ firstToday: true, weekBest: 7, weekBestUserId: ana });
    expect(await repo.arcadeBoard({ game: "snake", since, limit: 10 })).toEqual([
      { name: "Ana", score: 7 },
      { name: "Beto", score: 3 },
    ]);

    await repo.saveRaceTime({ userId: ana, name: "Ana", ms: 9000 });
    await repo.saveRaceTime({ userId: ana, name: "Ana", ms: 8000 });
    const race = await repo.raceBoard({ since, limit: 10, userId: ana });
    expect(race.myBest).toBe(8000);
    expect(race.entries[0]).toEqual({ name: "Ana", ms: 8000 });

    await repo.saveBoardWin({ userId: beto, name: "Beto", game: "damas" });
    await repo.saveBoardWin({ userId: beto, name: "Beto", game: "damas" });
    expect(await repo.boardRanking({ game: "damas", since, limit: 10 })).toEqual([{ name: "Beto", wins: 2 }]);
  });

  it("logros y contadores", async () => {
    await repo.saveStats(ana, [
      { op: "inc", key: `${run}pasos`, value: 2 },
      { op: "inc", key: `${run}pasos`, value: 3 },
      { op: "max", key: `${run}record`, value: 5 },
      { op: "max", key: `${run}record`, value: 4 },
    ]);
    expect(await repo.unlockAchievement(ana, "primer-paso")).toBe(true);
    expect(await repo.unlockAchievement(ana, "primer-paso")).toBe(false);
    const a = await repo.loadAchievements(ana);
    expect(a.stats).toMatchObject({ [`${run}pasos`]: 5, [`${run}record`]: 5 });
    expect(a.unlocked).toContain("primer-paso");
    expect(await repo.loadStatsByPrefix(`${run}pa`)).toEqual([{ userId: ana, key: `${run}pasos`, value: 5 }]);
  });

  it("notas en la puerta: se guardan y se cuentan sin leer", async () => {
    const saved = await repo.saveDoorNote({ fromId: beto, toId: ana, zoneId: `${run}-oficina`, text: "Pasé a saludar" });
    expect(saved.ok).toBe(true);
    expect(await repo.unreadDoorNotes([ana, beto])).toEqual({ [ana]: 1 });
  });

  it("regalos: lo dado hoy empieza en cero", async () => {
    const given = await repo.givenToday(ana);
    // La suma de Postgres puede volver como -0: con + 0 queda en 0.
    expect({ points: given.points + 0, items: given.items + 0 }).toEqual({ points: 0, items: 0 });
  });

  it("huerto, mascotas e insignia", async () => {
    const id = 900_000 + Math.floor(Math.random() * 90_000);
    const t = Date.now();
    await repo.saveGardenPlot(id, { crop: "tomate", plantedBy: ana, plantedByName: "Ana", plantedAt: t, growthMs: 1000, growthAt: t, wateredUntil: 0 });
    expect((await repo.loadGarden()).find((p) => p.id === id)).toMatchObject({ crop: "tomate", plantedBy: ana, plantedByName: "Ana", wateredUntil: 0 });
    await repo.saveGardenPlot(id, null);
    expect((await repo.loadGarden()).find((p) => p.id === id)).toBeUndefined();

    const petId = `${run}-gato`;
    await repo.savePetBond({ petId, ownerId: ana, ownerName: "Ana", love: 10.4, loveAt: t });
    expect((await repo.loadPetBonds()).find((p) => p.petId === petId)).toMatchObject({ ownerId: ana, ownerName: "Ana", love: 10 });
    expect(await repo.getFeaturedBadge(ana)).toBeNull();
  });
});
