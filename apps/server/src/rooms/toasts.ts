// Brindis (ver toast.ts en @hyvento/shared). Quien tiene una bebida y alguien cerca con otra invita; los
// de al lado que también brindan antes de que se venza se suman. Al cerrar, si quedan dos o más con
// bebida y juntos, chocan los vasos y cada uno toma un sorbo; si no, el que invitó brinda solo.
import { TOAST, type ToastError, type ToastEvent, type ToastSip, type ToastTimings } from "@hyvento/shared";
import type { HeldClock } from "./consumables";

/** Cómo está alguien ahora (lo arma la sala desde su estado). */
export interface Toaster {
  userId: string;
  sessionId: string;
  area: string;
  /** Pies en px de mundo. */
  x: number;
  y: number;
  /** Lleva una bebida con sorbos en la mano. */
  drink: boolean;
}

export interface ToastHooks {
  /** La persona (su sesión activa), o nada si ya no está. */
  person(userId: string): Toaster | undefined;
  /** Todos los de un nivel. */
  people(area: string): Toaster[];
  /** Aviso a los del nivel. */
  send(area: string, event: ToastEvent): void;
  /** Chocaron los vasos: se toma el sorbo de cada uno (null si ya no pudo). */
  sip(userId: string): ToastSip | null;
}

export type ToastRaise = { ok: true; kind: "invite" | "join"; id: string } | { ok: false; error: ToastError };

interface OpenToast {
  id: string;
  area: string;
  host: string;
  /** userIds de los que brindan (el que invitó incluido). */
  members: Set<string>;
  deadline: number;
  timer: { clear(): void };
}

export class Toasts {
  private open = new Map<string, OpenToast>();
  /** Cuándo puede volver a invitar cada persona. */
  private nextAt = new Map<string, number>();
  private seq = 0;

  constructor(
    private readonly clock: HeldClock,
    private readonly now: () => number,
    private readonly hooks: ToastHooks,
    /** Los tests acortan los tiempos. */
    private readonly timings: () => ToastTimings = () => TOAST,
    private readonly tileSize = 32,
  ) {}

  private near(a: { x: number; y: number }, b: { x: number; y: number }, slack = 0) {
    return Math.hypot(a.x - b.x, a.y - b.y) <= (TOAST.reachTiles + slack) * this.tileSize;
  }

  /** El brindis abierto en el que está alguien. */
  toastOf(userId: string): OpenToast | undefined {
    for (const t of this.open.values()) if (t.members.has(userId)) return t;
    return undefined;
  }

  /**
   * Brindar: si hay un brindis abierto al lado, se suma (sin pausa: responder no es insistir); si no,
   * invita, siempre que haya alguien cerca con bebida y respetando la pausa entre invitaciones.
   */
  raise(userId: string): ToastRaise {
    const who = this.hooks.person(userId);
    if (!who?.drink) return { ok: false, error: "no-drink" };
    if (this.toastOf(userId)) return { ok: false, error: "busy" };
    const now = this.now();
    const people = this.hooks.people(who.area);
    const t = this.timings();

    for (const toast of this.open.values()) {
      if (toast.area !== who.area) continue;
      if (!people.some((p) => toast.members.has(p.userId) && this.near(p, who))) continue;
      toast.members.add(userId);
      this.hooks.send(toast.area, { kind: "join", id: toast.id, sessionId: who.sessionId });
      // Se cierra un poco después (por si llega otro), sin pasarse de lo que quedaba.
      this.schedule(toast, Math.min(toast.deadline, now + t.joinGraceMs));
      return { ok: true, kind: "join", id: toast.id };
    }

    if (now < (this.nextAt.get(userId) ?? 0)) return { ok: false, error: "busy" };
    if (!people.some((p) => p.userId !== userId && p.drink && this.near(p, who))) return { ok: false, error: "alone" };
    this.nextAt.set(userId, now + t.cooldownMs);
    const toast: OpenToast = {
      id: `brindis-${++this.seq}`,
      area: who.area,
      host: userId,
      members: new Set([userId]),
      deadline: now + t.windowMs,
      timer: { clear() {} },
    };
    this.open.set(toast.id, toast);
    this.schedule(toast, toast.deadline);
    this.hooks.send(toast.area, { kind: "invite", id: toast.id, sessionId: who.sessionId, expiresInMs: t.windowMs });
    return { ok: true, kind: "invite", id: toast.id };
  }

  private schedule(toast: OpenToast, at: number) {
    toast.timer.clear();
    toast.timer = this.clock.setTimeout(() => this.close(toast.id), Math.max(0, at - this.now()));
  }

  /** Se cierra el brindis: chocan los que siguen con bebida y juntos, o el que invitó brinda solo. */
  private close(id: string) {
    const toast = this.open.get(id);
    if (!toast) return;
    this.open.delete(id);
    const people = this.hooks.people(toast.area);
    const withDrink = people.filter((p) => toast.members.has(p.userId) && p.drink);
    // Siguen en el grupo los que quedaron cerca de otro (con un tile de gracia: pudieron moverse un poco).
    const together = withDrink.filter((m) => withDrink.some((o) => o !== m && this.near(o, m, 1)));
    if (together.length >= 2) {
      const sips = together.map((m) => this.hooks.sip(m.userId)).filter((s): s is ToastSip => s !== null);
      const until = this.now() + this.timings().cooldownMs;
      for (const m of together) this.nextAt.set(m.userId, Math.max(this.nextAt.get(m.userId) ?? 0, until));
      this.hooks.send(toast.area, { kind: "clink", id, sips });
      return;
    }
    // Nadie respondió (o se fueron): el que invitó levanta el vaso solo. Si ya no está, el que quedó.
    const lonely = people.find((p) => p.userId === toast.host && toast.members.has(p.userId)) ?? withDrink[0];
    if (lonely) this.hooks.send(toast.area, { kind: "solo", id, sessionId: lonely.sessionId });
  }

  dispose() {
    for (const t of this.open.values()) t.timer.clear();
    this.open.clear();
  }
}
