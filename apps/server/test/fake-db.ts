// Una base de mentira con lo justo de Prisma para probar regalos e intercambios de `@hyvento/db` sin
// Postgres: usuarios, movimientos de puntos, mochilas y regalos.
//
// Las transacciones corren intercaladas (como en Postgres) y solo se esperan donde Postgres las haría
// esperar: en `SELECT … FOR UPDATE` y en los UPDATE, que bloquean la fila hasta el final. Lo que una
// transacción inserta no lo ven las demás hasta que termina (READ COMMITTED) y, si la función lanza, se
// deshace todo lo que hizo. Así un test de "dos a la vez" falla si se saca el bloqueo.
import type { Prisma } from "@hyvento/db";

interface UserRow {
  id: string;
  name: string;
  points: number;
  onboardedAt: Date | null;
}
interface MoveRow {
  userId: string;
  amount: number;
  reason: string;
  refId?: string | null;
  createdAt: Date;
}
interface ItemRow {
  userId: string;
  itemId: string;
  quantity: number;
}
interface GiftRow {
  id: string;
  fromId: string;
  toId: string;
  points: number;
  itemId: string | null;
  quantity: number;
  note: string;
  createdAt: Date;
  openedAt: Date | null;
}

interface TransferRow {
  fromId: string;
  toId: string;
  itemId: string;
  quantity: number;
  refId: string;
  createdAt: Date;
}

interface QuestRow {
  userId: string;
  questId: string;
  period: string;
  progress: number;
  goal: number;
  status: string;
  createdAt: Date;
  doneAt: Date | null;
  claimedAt: Date | null;
}

interface Tables {
  users: UserRow[];
  moves: MoveRow[];
  items: ItemRow[];
  gifts: GiftRow[];
  transfers: TransferRow[];
  quests: QuestRow[];
  skills: { userId: string; skill: string; xp: number; level: number }[];
  stats: { userId: string; key: string; value: number }[];
}

type Where = Record<string, unknown>;

/** ¿La fila cumple el `where`? (igualdad, `gte`, `gt`, `lt`, `in`, `startsWith`, `not` y `null`, lo que usan los helpers). */
function matches(row: object, where: Where = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = (row as Record<string, unknown>)[key];
    if (cond === null) return value === null || value === undefined;
    if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
    if (typeof cond === "object") {
      const c = cond as Record<string, unknown>;
      const v = value instanceof Date ? value.getTime() : (value as number);
      const n = (x: unknown) => (x instanceof Date ? x.getTime() : (x as number));
      if ("gte" in c && !(v >= n(c.gte))) return false;
      if ("gt" in c && !(v > n(c.gt))) return false;
      if ("lt" in c && !(v < n(c.lt))) return false;
      if ("in" in c && !(c.in as unknown[]).includes(value)) return false;
      if ("startsWith" in c && !(typeof value === "string" && value.startsWith(c.startsWith as string))) return false;
      if ("not" in c) {
        if (c.not === null) return value !== null && value !== undefined;
        if (value === c.not) return false;
      }
      return true;
    }
    return value === cond;
  });
}

/** Aplica `{ increment }`/`{ decrement }` o un valor directo. */
function applyData<T extends object>(row: T, data: Record<string, unknown>) {
  const r = row as Record<string, unknown>;
  for (const [key, change] of Object.entries(data)) {
    if (change && typeof change === "object" && !(change instanceof Date)) {
      const c = change as { increment?: number; decrement?: number };
      r[key] = (r[key] as number) + (c.increment ?? 0) - (c.decrement ?? 0);
    } else r[key] = change;
  }
}

/** Una transacción abierta: lo que insertó (invisible para las demás), cómo deshacerlo y sus bloqueos. */
interface Tx {
  id: number;
  inserted: Set<object>;
  undo: (() => void)[];
  locks: Set<string>;
}

export class FakeDb {
  t: Tables = { users: [], moves: [], items: [], gifts: [], transfers: [], quests: [], skills: [], stats: [] };
  private nextId = 1;
  private nextTx = 1;
  /** Fila bloqueada → transacción que la tiene y promesa que se cumple al soltarla. */
  private locks = new Map<string, { tx: number; released: Promise<void>; release: () => void }>();
  /** Filas insertadas por una transacción que no terminó (las demás no las ven). */
  private pending = new Map<object, number>();
  /** Cuántas veces una transacción tuvo que esperar un bloqueo (para ver que los tests se cruzan). */
  waits = 0;

  addUser(id: string, points = 0, opts: { name?: string; onboarded?: boolean } = {}) {
    this.t.users.push({ id, name: opts.name ?? id, points, onboardedAt: opts.onboarded === false ? null : new Date(0) });
    if (points) this.t.moves.push({ userId: id, amount: points, reason: "ADMIN", createdAt: new Date() });
  }
  give(userId: string, itemId: string, quantity: number) {
    this.t.items.push({ userId, itemId, quantity });
  }
  points(userId: string) {
    return this.t.users.find((u) => u.id === userId)?.points ?? 0;
  }
  held(userId: string, itemId: string) {
    return this.t.items.find((i) => i.userId === userId && i.itemId === itemId)?.quantity ?? 0;
  }

  /** Como `prisma.$transaction(fn)`: si lanza no queda nada; al terminar suelta sus bloqueos. */
  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const tx: Tx = { id: this.nextTx++, inserted: new Set(), undo: [], locks: new Set() };
    try {
      const result = await fn(this.client(tx));
      return result;
    } catch (err) {
      for (const undo of tx.undo.reverse()) undo();
      throw err;
    } finally {
      for (const row of tx.inserted) this.pending.delete(row);
      for (const key of tx.locks) {
        const lock = this.locks.get(key);
        this.locks.delete(key);
        lock?.release();
      }
    }
  }

  /** `prisma.$transaction` (para las funciones que reciben el cliente entero). */
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.transaction(fn);
  }

  /** El cliente fuera de una transacción (cada consulta, sola): lo que usan las rutas antes de abrir una. */
  get outside(): Prisma.TransactionClient {
    const tx: Tx = { id: 0, inserted: new Set(), undo: [], locks: new Set() };
    return this.client(tx);
  }

  /** Espera a que ninguna otra transacción tenga la fila y la toma hasta el final de `tx`. */
  private async lock(tx: Tx, key: string) {
    if (tx.id === 0) return;
    for (;;) {
      const current = this.locks.get(key);
      if (!current) break;
      if (current.tx === tx.id) return;
      this.waits++;
      await current.released;
    }
    let release!: () => void;
    const released = new Promise<void>((r) => (release = r));
    this.locks.set(key, { tx: tx.id, released, release });
    tx.locks.add(key);
  }

  private client(tx: Tx): Prisma.TransactionClient {
    const db = this;
    const visible = (row: object) => {
      const owner = db.pending.get(row);
      return owner === undefined || owner === tx.id;
    };
    const rows = <T extends object>(list: T[], where?: Where) => list.filter((r) => visible(r) && matches(r, where));
    const insert = <T extends object>(list: T[], row: T) => {
      list.push(row);
      if (tx.id !== 0) {
        db.pending.set(row, tx.id);
        tx.inserted.add(row);
      }
      tx.undo.push(() => {
        const i = list.indexOf(row);
        if (i >= 0) list.splice(i, 1);
      });
    };
    const change = <T extends object>(row: T, data: Record<string, unknown>) => {
      const before = { ...row };
      applyData(row, data);
      tx.undo.push(() => Object.assign(row, before));
    };
    /**
     * UPDATE como en Postgres: bloquea las filas candidatas (por su clave) y recién entonces vuelve a
     * mirar la condición, con lo que dejó la transacción que la tenía.
     */
    async function update<T extends object>(list: T[], key: (r: T) => string, where: Where, data: Record<string, unknown>) {
      const idOnly = Object.fromEntries(Object.entries(where).filter(([k]) => k === "id" || k === "userId" || k === "itemId"));
      for (const r of rows(list, idOnly)) await db.lock(tx, key(r));
      const hit = rows(list, where);
      hit.forEach((r) => change(r, data));
      return hit;
    }
    const pick = <T extends object>(row: T | undefined) => (row ? { ...row } : null);
    const withPeople = (g: GiftRow, include?: Record<string, unknown>) => {
      if (!include) return { ...g };
      const person = (id: string) => {
        const u = db.t.users.find((x) => x.id === id);
        return { id, name: u?.name ?? "" };
      };
      return { ...g, from: person(g.fromId), to: person(g.toId) };
    };

    const client = {
      async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
        const sql = strings.join("?");
        if (!/FROM "User" WHERE id = \? FOR UPDATE/.test(sql)) throw new Error(`SQL no soportado en la base de mentira: ${sql}`);
        const id = values[0] as string;
        const found = rows(db.t.users, { id });
        if (found.length) await db.lock(tx, `user:${id}`);
        return found.map((u) => ({ id: u.id }));
      },
      /** Solo el `SELECT 1 … FOR UPDATE` de los topes diarios (awardPointsTx). */
      async $executeRaw(strings: TemplateStringsArray, ...values: unknown[]) {
        return (await client.$queryRaw(strings, ...values)).length;
      },
      questProgress: {
        async updateMany({ where, data }: { where: Where; data: Record<string, unknown> }) {
          return { count: (await update(db.t.quests, (q) => `quest:${q.userId}:${q.questId}:${q.period}`, where, data)).length };
        },
        async findUnique({ where }: { where: { userId_questId_period: Where } }) {
          return pick(rows(db.t.quests, where.userId_questId_period)[0]);
        },
        async findMany({ where }: { where: Where }) {
          return rows(db.t.quests, where).map((q) => ({ ...q }));
        },
        async create({ data }: { data: Partial<QuestRow> & { userId: string; questId: string; period: string; goal: number } }) {
          const key = { userId: data.userId, questId: data.questId, period: data.period };
          if (rows(db.t.quests, key).length) throw new Error("P2002: ya existe");
          const row: QuestRow = { progress: 0, status: "ACTIVE", createdAt: new Date(), doneAt: null, claimedAt: null, ...data };
          insert(db.t.quests, row);
          return { ...row };
        },
        async createMany({ data, skipDuplicates }: { data: (Partial<QuestRow> & { userId: string; questId: string; period: string; goal: number })[]; skipDuplicates?: boolean }) {
          let count = 0;
          for (const d of data) {
            if (rows(db.t.quests, { userId: d.userId, questId: d.questId, period: d.period }).length) {
              if (skipDuplicates) continue;
              throw new Error("P2002: ya existe");
            }
            await client.questProgress.create({ data: d });
            count++;
          }
          return { count };
        },
      },
      skillXp: {
        async upsert({ where, create, update: data }: { where: { userId_skill: { userId: string; skill: string } }; create: { userId: string; skill: string; xp: number }; update: Record<string, unknown> }) {
          await db.lock(tx, `skill:${where.userId_skill.userId}:${where.userId_skill.skill}`);
          const row = rows(db.t.skills, where.userId_skill)[0];
          if (row) change(row, data);
          else insert(db.t.skills, { level: 1, ...create });
          return { ...(row ?? create) };
        },
      },
      userStat: {
        async upsert({ where, create, update: data }: { where: { userId_key: { userId: string; key: string } }; create: { userId: string; key: string; value: number }; update: Record<string, unknown> }) {
          await db.lock(tx, `stat:${where.userId_key.userId}:${where.userId_key.key}`);
          const row = rows(db.t.stats, where.userId_key)[0];
          if (row) change(row, data);
          else insert(db.t.stats, { ...create });
          return { ...(row ?? create) };
        },
      },
      user: {
        async updateMany({ where, data }: { where: Where; data: Record<string, unknown> }) {
          return { count: (await update(db.t.users, (u) => `user:${u.id}`, where, data)).length };
        },
        async update({ where, data }: { where: Where; data: Record<string, unknown> }) {
          const [u] = await update(db.t.users, (x) => `user:${x.id}`, where, data);
          if (!u) throw new Error("no existe");
          return { ...u };
        },
        async findUnique({ where }: { where: Where }) {
          return pick(rows(db.t.users, where)[0]);
        },
        async findFirst({ where }: { where: Where }) {
          return pick(rows(db.t.users, where)[0]);
        },
        async findUniqueOrThrow({ where }: { where: Where }) {
          const u = rows(db.t.users, where)[0];
          if (!u) throw new Error("no existe");
          return { ...u };
        },
        async findMany({ where }: { where: Where }) {
          return rows(db.t.users, where).map((u) => ({ ...u }));
        },
      },
      pointTransaction: {
        async create({ data }: { data: MoveRow }) {
          const row = { ...data, createdAt: data.createdAt ?? new Date() };
          insert(db.t.moves, row);
          return { ...row };
        },
        async aggregate({ where }: { where: Where }) {
          const found = rows(db.t.moves, where);
          return { _sum: { amount: found.length ? found.reduce((s, m) => s + m.amount, 0) : null } };
        },
      },
      inventoryItem: {
        async upsert({ where, create, update: data }: { where: { userId_itemId: { userId: string; itemId: string } }; create: ItemRow; update: Record<string, unknown> }) {
          const { userId, itemId } = where.userId_itemId;
          await db.lock(tx, `item:${userId}:${itemId}`);
          const row = rows(db.t.items, where.userId_itemId)[0];
          if (row) change(row, data);
          else insert(db.t.items, { ...create });
          return { ...(row ?? create) };
        },
        async updateMany({ where, data }: { where: Where; data: Record<string, unknown> }) {
          return { count: (await update(db.t.items, (i) => `item:${i.userId}:${i.itemId}`, where, data)).length };
        },
        async findMany({ where }: { where: Where }) {
          return rows(db.t.items, where).map((i) => ({ itemId: i.itemId, quantity: i.quantity }));
        },
      },
      itemTransfer: {
        async createMany({ data }: { data: TransferRow[] }) {
          for (const row of data) insert(db.t.transfers, { ...row, createdAt: row.createdAt ?? new Date() });
          return { count: data.length };
        },
        async aggregate({ where }: { where: Where }) {
          const found = rows(db.t.transfers, where);
          return { _sum: { quantity: found.length ? found.reduce((s, t) => s + t.quantity, 0) : null } };
        },
      },
      gift: {
        async create({ data }: { data: Omit<GiftRow, "id" | "openedAt" | "createdAt"> & { createdAt?: Date } }) {
          const row: GiftRow = { ...data, id: `g${db.nextId++}`, createdAt: data.createdAt ?? new Date(), openedAt: null };
          insert(db.t.gifts, row);
          return { ...row };
        },
        async count({ where }: { where: Where }) {
          return rows(db.t.gifts, where).length;
        },
        async aggregate({ where }: { where: Where }) {
          const found = rows(db.t.gifts, where);
          return { _sum: { quantity: found.length ? found.reduce((s, g) => s + g.quantity, 0) : null } };
        },
        async updateMany({ where, data }: { where: Where; data: Record<string, unknown> }) {
          return { count: (await update(db.t.gifts, (g) => `gift:${g.id}`, where, data)).length };
        },
        async findFirst({ where }: { where: Where }) {
          return pick(rows(db.t.gifts, where)[0]);
        },
        async findUniqueOrThrow({ where, include }: { where: Where; include?: Record<string, unknown> }) {
          const g = rows(db.t.gifts, where)[0];
          if (!g) throw new Error("no existe");
          return withPeople(g, include);
        },
      },
    };
    return client as unknown as Prisma.TransactionClient;
  }
}
