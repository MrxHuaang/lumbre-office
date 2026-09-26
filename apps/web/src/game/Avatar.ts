import type { Direction, PresenceStatus } from "@hyvento/shared";
import Phaser from "phaser";

const FRAMES_PER_ROW = 3;
const ROW: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };
/** Origen vertical del sprite: los pies están en el píxel ~29 de 32. */
const FEET_ORIGIN_Y = 30 / 32;
const BUBBLE_MS = 4500;

export const STATUS_COLORS: Record<PresenceStatus, number> = {
  available: 0x3ddc84,
  busy: 0xffb020,
  dnd: 0xff4d5e,
  away: 0x8a8fa3,
};

/** Registra las animaciones de caminata de un spritesheet de personaje (idempotente). */
export function ensureAnimations(scene: Phaser.Scene, key: string) {
  for (const dir of Object.keys(ROW) as Direction[]) {
    const animKey = `${key}-walk-${dir}`;
    if (scene.anims.exists(animKey)) continue;
    const base = ROW[dir] * FRAMES_PER_ROW;
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(key, { frames: [base + 1, base, base + 2, base] }),
      frameRate: 8,
      repeat: -1,
    });
  }
}

/** Avatar dibujado en el mapa: sprite + nombre + estado + globo de chat. */
export class Avatar {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  private readonly statusDot: Phaser.GameObjects.Arc;
  private bubble?: Phaser.GameObjects.Container;
  private bubbleTimer?: Phaser.Time.TimerEvent;
  private dir: Direction = "down";
  private moving = false;

  /** Posición destino (jugadores remotos, interpolada en `update`). */
  targetX: number;
  targetY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textureKey: string,
    name: string,
    x: number,
    y: number,
    isLocal: boolean,
  ) {
    ensureAnimations(scene, textureKey);
    this.targetX = x;
    this.targetY = y;
    this.sprite = scene.add.sprite(x, y, textureKey, 0).setOrigin(0.5, FEET_ORIGIN_Y);
    this.label = scene.add
      .text(x, y, name, {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "11px",
        color: isLocal ? "#ffe08a" : "#ffffff",
        backgroundColor: "rgba(15,17,26,0.72)",
        padding: { x: 4, y: 1 },
        resolution: 3,
      })
      .setOrigin(0.5, 1);
    this.statusDot = scene.add.circle(x, y, 3, STATUS_COLORS.available).setStrokeStyle(1, 0x0f111a);
    this.layout();
  }

  get x() {
    return this.sprite.x;
  }
  get y() {
    return this.sprite.y;
  }
  get direction() {
    return this.dir;
  }

  setPosition(x: number, y: number) {
    this.sprite.setPosition(x, y);
    this.layout();
  }

  setStatus(status: PresenceStatus) {
    this.statusDot.setFillStyle(STATUS_COLORS[status] ?? STATUS_COLORS.available);
  }

  setMotion(dir: Direction, moving: boolean) {
    if (dir === this.dir && moving === this.moving) return;
    this.dir = dir;
    this.moving = moving;
    if (moving) {
      this.sprite.play(`${this.textureKey}-walk-${dir}`, true);
    } else {
      this.sprite.stop();
      this.sprite.setFrame(ROW[dir] * FRAMES_PER_ROW);
    }
  }

  /** Interpola hacia (targetX, targetY). Usado por los avatares remotos. */
  interpolate(dtMs: number) {
    const dx = this.targetX - this.sprite.x;
    const dy = this.targetY - this.sprite.y;
    if (dx * dx + dy * dy > 96 * 96) {
      this.setPosition(this.targetX, this.targetY); // salto grande (corrección/reconexión)
      return;
    }
    const t = Math.min(1, dtMs / 1000 * 14);
    this.setPosition(this.sprite.x + dx * t, this.sprite.y + dy * t);
  }

  say(text: string) {
    this.bubble?.destroy();
    this.bubbleTimer?.remove();
    const shown = text.length > 80 ? `${text.slice(0, 77)}…` : text;
    const content = this.scene.add.text(0, 0, shown, {
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      fontSize: "11px",
      color: "#1b1b24",
      wordWrap: { width: 150 },
      resolution: 3,
    });
    content.setOrigin(0.5, 1);
    const w = content.width + 12;
    const h = content.height + 8;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0xffffff, 0.96);
    bg.lineStyle(1, 0x1b1b24, 1);
    bg.fillRoundedRect(-w / 2, -h - 4, w, h, 5);
    bg.strokeRoundedRect(-w / 2, -h - 4, w, h, 5);
    bg.fillTriangle(-4, -4.5, 4, -4.5, 0, 1);
    content.setPosition(0, -8);
    this.bubble = this.scene.add.container(0, 0, [bg, content]);
    this.layout();
    this.bubbleTimer = this.scene.time.delayedCall(BUBBLE_MS, () => {
      this.bubble?.destroy();
      this.bubble = undefined;
    });
  }

  destroy() {
    this.bubbleTimer?.remove();
    this.bubble?.destroy();
    this.sprite.destroy();
    this.label.destroy();
    this.statusDot.destroy();
  }

  private layout() {
    const { x, y } = this.sprite;
    this.sprite.setDepth(y);
    this.label.setPosition(x + 4, y - 30).setDepth(100_000 + y);
    this.statusDot.setPosition(x + 4 - this.label.width / 2 - 5, y - 30 - this.label.height / 2).setDepth(100_001 + y);
    this.bubble?.setPosition(x, y - 30 - this.label.height).setDepth(200_000 + y);
  }
}
