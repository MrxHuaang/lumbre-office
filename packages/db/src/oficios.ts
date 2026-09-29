// Oficios: la experiencia de cada persona en la tabla SkillXp (ver oficios.ts de @hyvento/shared). Además
// de una fila por oficio hay dos tipos de fila de servicio, en la misma tabla (sin migración nueva):
// - `_veterano`: marca que ya se calculó la experiencia inicial desde sus contadores (una sola vez);
// - `hoy:<oficio>`: lo que las acciones le dieron hoy (se reinicia si su `updatedAt` es de otro día), para
//   el tope diario.
import { BAG_SLOT_PREFIX, OFICIO, OFICIOS, dayStart, levelOf, veteranXp, type Oficio } from "@hyvento/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

type Client = PrismaClient | Prisma.TransactionClient;

export const VETERAN_ROW = "_veterano";
export const todayRow = (o: Oficio) => `hoy:${o}`;

export interface SkillRecord {
  xp: Record<Oficio, number>;
  /** Lo que las acciones dieron hoy (para el tope diario). */
  today: Record<Oficio, number>;
}

const zero = () => Object.fromEntries(OFICIOS.map((o) => [o, 0])) as Record<Oficio, number>;

/** Suma experiencia a un oficio y deja el nivel al día. */
async function bumpSkill(tx: Prisma.TransactionClient, userId: string, skill: Oficio, xp: number): Promise<number> {
  const row = await tx.skillXp.upsert({
    where: { userId_skill: { userId, skill } },
    create: { userId, skill, xp, level: levelOf(xp) },
    update: { xp: { increment: xp } },
    select: { xp: true, level: true },
  });
  const level = levelOf(row.xp);
  if (level !== row.level) await tx.skillXp.update({ where: { userId_skill: { userId, skill } }, data: { level } });
  return row.xp;
}

/**
 * La primera vez que se leen los oficios de alguien: su experiencia inicial sale de sus contadores (hasta
 * el nivel 7). Idempotente: la fila `_veterano` se crea una sola vez (dos a la vez chocan con la llave y
 * la segunda no hace nada).
 */
export async function seedVeteranTx(tx: Prisma.TransactionClient, userId: string): Promise<boolean> {
  const marked = await tx.skillXp.createMany({ data: [{ userId, skill: VETERAN_ROW, xp: 0, level: 0 }], skipDuplicates: true });
  if (marked.count === 0) return false;
  const stats = await tx.userStat.findMany({ where: { userId, NOT: { key: { startsWith: BAG_SLOT_PREFIX } } }, select: { key: true, value: true } });
  const start = veteranXp(Object.fromEntries(stats.map((s) => [s.key, s.value])));
  let total = 0;
  for (const o of OFICIOS) {
    if (start[o] <= 0) continue;
    await bumpSkill(tx, userId, o, start[o]);
    total += start[o];
  }
  if (total > 0) await tx.skillXp.update({ where: { userId_skill: { userId, skill: VETERAN_ROW } }, data: { xp: total } });
  return true;
}

/** Los oficios de alguien (con la experiencia inicial si es la primera vez que se miran). */
export async function loadSkillsTx(tx: Prisma.TransactionClient, userId: string, now = Date.now()): Promise<SkillRecord> {
  await seedVeteranTx(tx, userId);
  const rows = await tx.skillXp.findMany({ where: { userId }, select: { skill: true, xp: true, updatedAt: true } });
  const out: SkillRecord = { xp: zero(), today: zero() };
  const since = dayStart(now);
  for (const r of rows) {
    if ((OFICIOS as readonly string[]).includes(r.skill)) out.xp[r.skill as Oficio] = r.xp;
    else if (r.skill.startsWith("hoy:")) {
      const o = r.skill.slice(4) as Oficio;
      if ((OFICIOS as readonly string[]).includes(o) && r.updatedAt.getTime() >= since) out.today[o] = r.xp;
    }
  }
  return out;
}

export function loadSkills(client: PrismaClient, userId: string, now = Date.now()): Promise<SkillRecord> {
  return client.$transaction((tx) => loadSkillsTx(tx, userId, now));
}

/**
 * Suma lo que dieron las acciones (con el tope diario por oficio: lo de más no entra). Bloquea la fila del
 * usuario para que dos guardados a la vez no se salten el tope. Devuelve lo que de verdad entró.
 */
export async function addSkillXpTx(tx: Prisma.TransactionClient, userId: string, gains: Partial<Record<Oficio, number>>, now = Date.now()): Promise<Partial<Record<Oficio, number>>> {
  const added: Partial<Record<Oficio, number>> = {};
  const wanted = OFICIOS.filter((o) => (gains[o] ?? 0) >= 1);
  if (!wanted.length) return added;
  await tx.$executeRaw`SELECT 1 FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const since = dayStart(now);
  for (const o of wanted) {
    const row = await tx.skillXp.findUnique({ where: { userId_skill: { userId, skill: todayRow(o) } }, select: { xp: true, updatedAt: true } });
    const today = row && row.updatedAt.getTime() >= since ? row.xp : 0;
    const amount = Math.min(Math.floor(gains[o]!), OFICIO.dailyActionCap - today);
    if (amount <= 0) continue;
    await tx.skillXp.upsert({
      where: { userId_skill: { userId, skill: todayRow(o) } },
      create: { userId, skill: todayRow(o), xp: amount, level: 0, updatedAt: new Date(now) },
      update: { xp: today + amount, updatedAt: new Date(now) },
    });
    await bumpSkill(tx, userId, o, amount);
    added[o] = amount;
  }
  return added;
}

export function addSkillXp(client: PrismaClient, userId: string, gains: Partial<Record<Oficio, number>>, now = Date.now()) {
  return client.$transaction((tx) => addSkillXpTx(tx, userId, gains, now));
}

/** Los niveles de alguien (para validar la ropa y la tienda en la web). */
export async function loadSkillLevels(client: PrismaClient, userId: string, now = Date.now()): Promise<Record<Oficio, number>> {
  const { xp } = await loadSkills(client, userId, now);
  return Object.fromEntries(OFICIOS.map((o) => [o, levelOf(xp[o])])) as Record<Oficio, number>;
}

/** Para los encargos (encargos.ts): la experiencia de una entrega, sin tope y con el nivel al día. */
export async function creditSkillXpTx(tx: Prisma.TransactionClient, userId: string, skill: string, xp: number): Promise<void> {
  if (!(xp > 0) || !(OFICIOS as readonly string[]).includes(skill)) return;
  await bumpSkill(tx, userId, skill as Oficio, Math.round(xp));
}
