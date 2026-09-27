// Una base de mentira con lo justo de Prisma para probar regalos e intercambios de `@hyvento/db` sin
// Postgres: usuarios, movimientos de puntos, mochilas y regalos. Las transacciones van de a una (como las
// filas bloqueadas en Postgres) y, si la función lanza, se deshace todo lo que hizo.
import type { Prisma } from "@hyvento/db";

interface UserRow {
  id: string;
  points: number;
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

interface Tables {
  users: UserRow[];
  moves: MoveRow[];
  items: ItemRow[];
  gifts: GiftRow[];
}

type Where = Record<string, unknown>;

/** ¿La fila cumple el `where`? (igualdad, `gte`, `gt`, `lt`, `in` y `null`, lo que usan los helpers). */
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
      if ("not" in c && c.not === null && (value === null || value === undefined)) return false;
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

const clone = (t: Tables): Tables => ({
  users: t.users.map((u) => ({ ...u })),
  moves: t.moves.map((m) => ({ ...m })),
  items: t.items.map((i) => ({ ...i })),
  gifts: t.gifts.map((g) => ({ ...g })),
});

export class FakeDb {
  t: Tables = { users: [], moves: [], items: [], gifts: [] };
  private nextId = 1;
  private queue: Promise<unknown> = Promise.resolve();

  addUser(id: string, points = 0) {
    this.t.users.push({ id, points });
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

  /** Como `prisma.$transaction(fn)`: de a una, y si lanza no queda nada. */
  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const before = clone(this.t);
      try {
        return await fn(this.client());
      } catch (err) {
        this.t = before;
        throw err;
      }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private client(): Prisma.TransactionClient {
    const db = this;
    const pick = <T extends object>(row: T | undefined) => (row ? { ...row } : null);
    const client = {
      user: {
        async updateMany({ where, data }: { where: Where; data: Record<string, unknown> }) {
          const rows = db.t.users.filter((u) => matches(u, where));
          rows.forEach((u) => applyData(u, data));
          return { count: rows.length };
        },
        async findUnique({ where }: { where: Where }) {
          return pick(db.t.users.find((u) => matches(u, where)));
        },
        async findUniqueOrThrow({ where }: { where: Where }) {
          const u = db.t.users.find((x) => matches(x, where));
          if (!u) throw new Error("no existe");
          return { ...u };
        },
        async update({ where, data }: { where: Where; data: Record<string, unknown> }) {
          const u = db.t.users.find((x) => matches(x, where));
          if (!u) throw new Error("no existe");
          applyData(u, data);
          return { ...u };
        },
        async findMany({ where }: { where: Where }) {
          return db.t.users.filter((u) => matches(u, where)).map((u) => ({ ...u }));
        },
      },
      pointTransaction: {
        async create({ data }: { data: MoveRow }) {
          db.t.moves.push({ ...data, createdAt: data.createdAt ?? new Date() });
          return { ...data };
        },
        async aggregate({ where }: { where: Where }) {
          const rows = db.t.moves.filter((m) => matches(m, where));
          return { _sum: { amount: rows.length ? rows.reduce((s, m) => s + m.amount, 0) : null } };
        },
      },
      inventoryItem: {
        async upsert({ where, create, update }: { where: { userId_itemId: { userId: string; itemId: string } }; create: ItemRow; update: Record<string, unknown> }) {
          const row = db.t.items.find((i) => matches(i, where.userId_itemId));
          if (row) applyData(row, update);
          else db.t.items.push({ ...create });
          return { ...(row ?? create) };
        },
        async updateMany({ where, data }: { where: Where; data: Record<string, unknown> }) {
          const rows = db.t.items.filter((i) => matches(i, where));
          rows.forEach((i) => applyData(i, data));
          return { count: rows.length };
        },
        async findMany({ where }: { where: Where }) {
          return db.t.items.filter((i) => matches(i, where)).map((i) => ({ itemId: i.itemId, quantity: i.quantity }));
        },
      },
      gift: {
        async create({ data }: { data: Omit<GiftRow, "id" | "openedAt" | "createdAt"> & { createdAt?: Date } }) {
          const row: GiftRow = { ...data, id: `g${db.nextId++}`, createdAt: data.createdAt ?? new Date(), openedAt: null };
          db.t.gifts.push(row);
          return { ...row };
        },
        async count({ where }: { where: Where }) {
          return db.t.gifts.filter((g) => matches(g, where)).length;
        },
        async updateMany({ where, data }: { where: Where; data: Record<string, unknown> }) {
          const rows = db.t.gifts.filter((g) => matches(g, where));
          rows.forEach((g) => applyData(g, data));
          return { count: rows.length };
        },
        async findFirst({ where }: { where: Where }) {
          return pick(db.t.gifts.find((g) => matches(g, where)));
        },
        async findUniqueOrThrow({ where }: { where: Where }) {
          const g = db.t.gifts.find((x) => matches(x, where));
          if (!g) throw new Error("no existe");
          return { ...g };
        },
      },
    };
    return client as unknown as Prisma.TransactionClient;
  }
}
