// Brindis en el cliente: lo decide el servidor (MSG.toastEvent); acá se anima (vasos arriba, el choque
// con un destello, "¡Salud!") y se calcula la ayuda "B" del HUD: invitar, sumarse o esperar.
import { TOAST, type Direction, type ToastEvent } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { playAnticSound } from "./antics-sound";
import type { Avatar } from "./Avatar";
import type { ToastPrompt } from "./store";

interface OpenToast {
  host: string;
  members: Set<string>;
  /** Hora (del reloj de la escena) en que se vence si no llega nada más. */
  until: number;
}

export interface ToastScene {
  avatar(sessionId: string): Avatar | undefined;
  /** ¿Está en mi nivel? */
  here(sessionId: string): boolean;
  localId(): string | null;
  name(sessionId: string): string;
  /** Sesiones de los que están en mi nivel. */
  present(): Iterable<string>;
}

/** Hacia dónde mirar para ver algo que está a (dx, dy) en el mundo (como `facingFor` de la escena). */
function facingToward(dx: number, dy: number, fallback: Direction): Direction {
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return fallback;
  const sx = dx - dy;
  const sy = dx + dy;
  return sy >= 0 ? (sx >= 0 ? "right" : "down") : sx >= 0 ? "up" : "left";
}

export class ToastController {
  private open = new Map<string, OpenToast>();
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly people: ToastScene,
  ) {}

  private distToLocal(sessionId: string) {
    const me = this.people.localId();
    const a = this.people.avatar(sessionId);
    const b = me ? this.people.avatar(me) : undefined;
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  handle(e: ToastEvent) {
    const now = this.scene.time.now;
    switch (e.kind) {
      case "invite": {
        this.open.set(e.id, { host: e.sessionId, members: new Set([e.sessionId]), until: now + e.expiresInMs });
        this.people.avatar(e.sessionId)?.raiseToast();
        playAnticSound("toast-invite", { dist: this.distToLocal(e.sessionId) });
        return;
      }
      case "join": {
        const toast = this.open.get(e.id);
        toast?.members.add(e.sessionId);
        this.people.avatar(e.sessionId)?.raiseToast();
        playAnticSound("toast-join", { dist: this.distToLocal(e.sessionId) });
        return;
      }
      case "solo": {
        const toast = this.open.get(e.id);
        this.open.delete(e.id);
        for (const id of toast?.members ?? []) if (id !== e.sessionId) this.people.avatar(id)?.cancelToast();
        this.people.avatar(e.sessionId)?.soloToast();
        playAnticSound("toast-solo", { dist: this.distToLocal(e.sessionId) });
        return;
      }
      case "clink":
        return this.clink(e.id, e.sips);
    }
  }

  /** Chocan: todos miran al centro del grupo, estiran el vaso y en el medio sale un destello. */
  private clink(id: string, sips: { sessionId: string; part: number; left: number }[]) {
    const toast = this.open.get(id);
    this.open.delete(id);
    const inToast = new Set(sips.map((s) => s.sessionId));
    for (const other of toast?.members ?? []) if (!inToast.has(other)) this.people.avatar(other)?.cancelToast();
    const group = sips.map((s) => ({ ...s, avatar: this.people.avatar(s.sessionId) })).filter((s) => s.avatar);
    if (group.length === 0) return;
    const cx = group.reduce((a, s) => a + s.avatar!.x, 0) / group.length;
    const cy = group.reduce((a, s) => a + s.avatar!.y, 0) / group.length;
    for (const s of group) {
      const a = s.avatar!;
      const face = facingToward(cx - a.x, cy - a.y, a.direction);
      // Hacia dónde queda el centro en pantalla (la x de pantalla crece con x - y del mundo).
      const towardX: -1 | 1 = cx - cy - (a.x - a.y) < 0 ? -1 : 1;
      a.clink(face, s.part, s.left, towardX);
    }
    // El destello, justo cuando los vasos se tocan (a la mitad de la animación).
    this.scene.time.delayedCall(TOAST.clinkMs / 2, () => {
      if (this.destroyed) return;
      const points = group.map((s) => s.avatar!.toastPoint()).filter((p) => p !== null);
      if (points.length) {
        const x = points.reduce((a, p) => a + p.x, 0) / points.length;
        const y = Math.min(...points.map((p) => p.y));
        const depth = Math.max(...points.map((p) => p.depth));
        this.sparkle(Math.round(x), Math.round(y) - 2, depth + 0.1);
      }
      const me = this.people.localId();
      const dist = me && inToast.has(me) ? 0 : Math.min(...group.map((s) => this.distToLocal(s.sessionId)));
      playAnticSound("toast-clink", { dist, people: group.length });
    });
  }

  /** Destello pixel: una estrellita de cuatro puntas que crece y se apaga. */
  private sparkle(x: number, y: number, depth: number) {
    const color = 0xfff4b0;
    const bits = [
      [0, 0],
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [0, -2],
      [0, 2],
      [-2, 0],
      [2, 0],
    ] as const;
    const star = this.scene.add.container(x, y).setDepth(depth);
    for (const [dx, dy] of bits) star.add(this.scene.add.rectangle(dx, dy, 1, 1, dx === 0 && dy === 0 ? 0xffffff : color));
    star.setScale(0.5);
    this.scene.tweens.add({
      targets: star,
      scale: 1.6,
      alpha: 0,
      angle: 45,
      duration: 420,
      ease: "Quad.out",
      onComplete: () => star.destroy(),
    });
  }

  /**
   * Qué ayuda mostrar: sin bebida, nada; ya brindando, "esperando"; con un brindis abierto al lado,
   * sumarse; con alguien cerca con bebida, invitar. El servidor igual valida todo.
   */
  prompt(): ToastPrompt | null {
    const me = this.people.localId();
    const mine = me ? this.people.avatar(me) : undefined;
    if (!me || !mine?.hasDrink) return null;
    const now = this.scene.time.now;
    const reach = TOAST.reachTiles * 32;
    const near = (id: string) => {
      const a = this.people.avatar(id);
      return Boolean(a) && id !== me && this.people.here(id) && Math.hypot(a!.x - mine.x, a!.y - mine.y) <= reach;
    };
    for (const [id, toast] of this.open) {
      // Por si se perdió el aviso del cierre: se olvida un rato después de vencerse.
      if (now > toast.until + 1500) {
        this.open.delete(id);
        continue;
      }
      if (toast.members.has(me)) return { mode: "waiting" };
    }
    for (const toast of this.open.values()) {
      if ([...toast.members].some(near)) return { mode: "join", name: this.people.name(toast.host) };
    }
    for (const id of this.people.present()) if (near(id) && this.people.avatar(id)?.hasDrink) return { mode: "invite" };
    return null;
  }

  destroy() {
    this.destroyed = true;
    this.open.clear();
  }
}
