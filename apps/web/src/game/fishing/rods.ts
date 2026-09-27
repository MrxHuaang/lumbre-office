// La caña de quien pesca, para todos los del nivel: el lance, el sedal, la boya que flota y se hunde
// cuando pica, el tirón del minijuego y el pez levantado al sacarlo. Sale de `Player.fishing` (el servidor
// lo cambia); la escena solo avisa los cambios y llama `update` en cada frame.
import type { OfficeMap } from "@hyvento/map";
import { biteMark, bobber, drawFish, ROD_COLORS } from "@hyvento/map/art";
import { fishById, type Direction } from "@hyvento/shared";
import * as Phaser from "phaser";
import type { Avatar } from "../Avatar";
import { DEPTH_OVERLAY, depthOf, ensureTexture, worldToScreen } from "../iso/view";
import { castTarget, SCREEN_DIR } from "./water";

/** Cuánto dura el lance (la boya volando hasta el agua). */
const CAST_MS = 420;
/** Mano que sostiene la caña respecto de los pies, según hacia dónde mira. */
const HAND: Record<Direction, { x: number; y: number }> = {
  right: { x: 3, y: -8 },
  down: { x: -3, y: -8 },
  left: { x: -4, y: -9 },
  up: { x: 4, y: -9 },
};

interface Rod {
  phase: string;
  since: number;
  dir: Direction;
  target: { x: number; y: number };
  g: Phaser.GameObjects.Graphics;
  bob: Phaser.GameObjects.Image;
  mark?: Phaser.GameObjects.Image;
  fish?: Phaser.GameObjects.Image;
}

const hexInt = (c: readonly number[]) => (c[0]! << 16) | (c[1]! << 8) | c[2]!;
const ROD = hexInt(ROD_COLORS.rod);
const ROD_LIGHT = hexInt(ROD_COLORS.rodLight);
const GRIP = hexInt(ROD_COLORS.grip);
const LINE = hexInt(ROD_COLORS.line);
const RIPPLE = hexInt(ROD_COLORS.ripple);

export class FishingRods {
  private rods = new Map<string, Rod>();
  private map?: OfficeMap;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly avatarOf: (sessionId: string) => Avatar | undefined,
    private readonly visible: (sessionId: string) => boolean,
  ) {
    ensureTexture(scene, "pesca-boya", () => bobber());
    ensureTexture(scene, "pesca-boya-hundida", () => bobber(true));
    ensureTexture(scene, "pesca-pica", () => biteMark());
  }

  setArea(map: OfficeMap) {
    this.map = map;
    // Al cambiar de nivel se recalcula dónde cae cada boya (el agua es la de este nivel).
    for (const [id, rod] of this.rods) this.retarget(id, rod);
  }

  /** Cambió `Player.fishing` de alguien. */
  set(sessionId: string, phase: string) {
    const rod = this.rods.get(sessionId);
    if (!phase) return this.remove(sessionId);
    if (rod) {
      if (rod.phase !== phase) {
        rod.phase = phase;
        rod.since = this.scene.time.now;
        // Un lance nuevo: la boya cae frente a donde está ahora.
        if (phase === "wait") this.retarget(sessionId, rod);
      }
      return;
    }
    const g = this.scene.add.graphics();
    const bob = this.scene.add.image(0, 0, "pesca-boya").setOrigin(0.5, 1).setVisible(false);
    const next: Rod = { phase, since: this.scene.time.now, dir: "right", target: { x: 0, y: 0 }, g, bob };
    this.retarget(sessionId, next);
    this.rods.set(sessionId, next);
  }

  remove(sessionId: string) {
    const rod = this.rods.get(sessionId);
    if (!rod) return;
    rod.g.destroy();
    rod.bob.destroy();
    rod.mark?.destroy();
    rod.fish?.destroy();
    this.rods.delete(sessionId);
  }

  destroy() {
    for (const id of [...this.rods.keys()]) this.remove(id);
  }

  private retarget(sessionId: string, rod: Rod) {
    const avatar = this.avatarOf(sessionId);
    const t = avatar && this.map ? castTarget(this.map, avatar.x, avatar.y) : null;
    if (t) {
      rod.dir = t.dir;
      rod.target = { x: t.x, y: t.y };
    } else if (avatar) {
      rod.dir = avatar.direction;
      rod.target = { x: avatar.x + 48, y: avatar.y };
    }
  }

  update() {
    const now = this.scene.time.now;
    for (const [id, rod] of this.rods) {
      const avatar = this.avatarOf(id);
      const show = Boolean(avatar) && this.visible(id);
      rod.g.clear();
      rod.g.setVisible(show);
      if (!avatar || !show) {
        rod.bob.setVisible(false);
        rod.mark?.setVisible(false);
        rod.fish?.setVisible(false);
        continue;
      }
      if (rod.phase.startsWith("show:")) this.drawShow(rod, avatar, now);
      else this.drawCast(rod, avatar, now);
    }
  }

  /** La caña en el agua: lance, espera, picada o minijuego. */
  private drawCast(rod: Rod, avatar: Avatar, now: number) {
    rod.fish?.setVisible(false);
    const s = worldToScreen(avatar.x, avatar.y);
    const sv = SCREEN_DIR[rod.dir];
    const hand = { x: Math.round(s.x) + HAND[rod.dir].x, y: Math.round(s.y) + HAND[rod.dir].y };
    const age = now - rod.since;
    const casting = rod.phase === "wait" && age < CAST_MS;
    const f = casting ? age / CAST_MS : 1;
    const reel = rod.phase === "reel";
    const bite = rod.phase === "bite";
    // La punta: hacia atrás al empezar el lance, adelante después; tirando (y temblando) en el minijuego.
    const swing = casting ? Math.min(1, f * 1.6) : 1;
    const jitter = reel ? Math.round(Math.sin(now / 45) * 1.2) : bite ? Math.round(Math.sin(now / 30)) : 0;
    const tip = {
      x: hand.x + Math.round(sv.x * (-5 + swing * 15)),
      y: hand.y - Math.round(14 - swing * 5) + (reel ? 3 : 0) + jitter,
    };
    const depth = depthOf(avatar.x, avatar.y) + (rod.dir === "right" || rod.dir === "down" ? 0.56 : 0.44);
    rod.g.setDepth(depth);
    // La caña: mango rojo, vara oscura y la punta clara.
    this.pixelLine(rod.g, hand.x, hand.y, tip.x, tip.y, (k, n) => (k < 3 ? GRIP : k > n - 3 ? ROD_LIGHT : ROD));
    // La boya: vuela en arco hasta el agua y después flota (se hunde cuando pica).
    const t = worldToScreen(rod.target.x, rod.target.y);
    const bob = casting
      ? { x: tip.x + (t.x - tip.x) * f, y: tip.y + (t.y - tip.y) * f - Math.sin(f * Math.PI) * 14 }
      : { x: t.x, y: t.y + (bite ? 1 : Math.round(Math.sin(now / 380) * 0.8)) + (reel ? Math.round(Math.sin(now / 70)) : 0) };
    const bx = Math.round(bob.x + (reel ? Math.sin(now / 90) * 2 : 0));
    const by = Math.round(bob.y);
    rod.bob
      .setTexture(bite || reel ? "pesca-boya-hundida" : "pesca-boya")
      .setPosition(bx, by + 2)
      .setDepth(depthOf(rod.target.x, rod.target.y) + 0.5)
      .setVisible(true);
    // El sedal: con comba mientras espera, tirante al picar o en el minijuego.
    const sag = reel || bite ? 0 : casting ? 2 : 6;
    this.curve(rod.g, tip.x, tip.y, bx, by - 3, sag);
    // Ondas en el agua.
    if (!casting) {
      const period = bite || reel ? 500 : 1600;
      const r = ((now % period) / period) * (bite || reel ? 7 : 5) + 2;
      this.ripple(rod.g, bx, by + 1, r);
    }
    // "!" sobre la cabeza cuando pica.
    if (bite) {
      rod.mark ??= this.scene.add.image(0, 0, "pesca-pica").setOrigin(0.5, 1);
      rod.mark
        .setPosition(Math.round(s.x), Math.round(s.y) - 44 - (Math.floor(now / 120) % 2))
        .setDepth(DEPTH_OVERLAY + 5)
        .setVisible(true);
    } else rod.mark?.setVisible(false);
  }

  /** Lo sacó: levanta el pez sobre la cabeza un rato, como en Stardew. */
  private drawShow(rod: Rod, avatar: Avatar, now: number) {
    rod.bob.setVisible(false);
    rod.mark?.setVisible(false);
    const id = rod.phase.slice(5);
    const key = `pez-${id}`;
    ensureTexture(this.scene, key, () => drawFish(id, fishById(id)?.rarity ?? "comun"));
    rod.fish ??= this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
    if (rod.fish.texture.key !== key) rod.fish.setTexture(key);
    const s = worldToScreen(avatar.x, avatar.y);
    const age = now - rod.since;
    const rise = Math.min(1, age / 250);
    rod.fish
      .setPosition(Math.round(s.x), Math.round(s.y) - 34 - Math.round(rise * 6) - (Math.floor(now / 300) % 2))
      .setDepth(DEPTH_OVERLAY + 4)
      .setVisible(true);
  }

  /** Línea píxel a píxel (sin suavizado); `color(k, n)` elige el color de cada punto. */
  private pixelLine(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, color: (k: number, n: number) => number) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / Math.max(1, n));
      const y = Math.round(y0 + ((y1 - y0) * k) / Math.max(1, n));
      g.fillStyle(color(k, n), 1);
      g.fillRect(x, y, 1, 1);
    }
  }

  /** Sedal: curva con comba `sag` (px) en el medio. */
  private curve(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, sag: number) {
    const n = Math.max(8, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    g.fillStyle(LINE, 0.9);
    let px = NaN;
    let py = NaN;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t));
      if (x === px && y === py) continue;
      g.fillRect(x, y, 1, 1);
      px = x;
      py = y;
    }
  }

  private ripple(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number) {
    g.fillStyle(RIPPLE, Math.max(0, 0.9 - r / 10));
    const steps = Math.ceil(r * 5);
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.5), 1, 1);
    }
  }
}
