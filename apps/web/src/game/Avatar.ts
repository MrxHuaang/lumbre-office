import type { Direction, PresenceStatus } from "@hyvento/shared";
import type { Track } from "livekit-client";
import * as Phaser from "phaser";
import { hexToInt, RISO, risoFontFamily, STATUS_HEX } from "@/lib/riso";

const FRAMES_PER_ROW = 3;
const ROW: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };
/** Origen vertical del sprite: los pies están en el píxel ~29 de 32. */
const FEET_ORIGIN_Y = 30 / 32;
const BUBBLE_MS = 4500;
/** Diámetro (px de mundo) de la burbuja de cámara que reemplaza al personaje. */
const VIDEO_SIZE = 46;
const SPEAKING_COLOR = RISO.green;
const NAVY = hexToInt(RISO.navy);
const PAPER = hexToInt(RISO.paper);

export const STATUS_COLORS = Object.fromEntries(
  Object.entries(STATUS_HEX).map(([k, v]) => [k, hexToInt(v)]),
) as Record<PresenceStatus, number>;

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
  /** Ficha de papel detrás del nombre (y su sombra rosa si soy yo). */
  private readonly labelBox: Phaser.GameObjects.Rectangle;
  private readonly labelShadow: Phaser.GameObjects.Rectangle;
  private readonly statusDot: Phaser.GameObjects.Arc;
  private readonly speakingRing: Phaser.GameObjects.Ellipse;
  private bubble?: Phaser.GameObjects.Container;
  private bubbleTimer?: Phaser.Time.TimerEvent;
  private video?: { track: Track; el: HTMLVideoElement; wrap: HTMLDivElement; dom: Phaser.GameObjects.DOMElement };
  private speaking = false;
  private dir: Direction = "down";
  private moving = false;
  /** Sentado: hacia dónde mira (usa el spritesheet `<avatar>-sit`). */
  private seated: "up" | "down" | null = null;

  /** Posición destino (jugadores remotos, interpolada en `update`). */
  targetX: number;
  targetY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private textureKey: string,
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
      .text(x, y, isLocal ? `${name} (tú)` : name, {
        fontFamily: risoFontFamily(),
        fontStyle: "600",
        fontSize: "10px",
        color: isLocal ? RISO.paper : RISO.navy,
        padding: { x: 5, y: 2 },
        resolution: 3,
      })
      .setOrigin(0.5, 1);
    this.labelShadow = scene.add
      .rectangle(x, y, this.label.width, this.label.height, hexToInt(RISO.pink))
      .setOrigin(0.5, 1)
      .setVisible(isLocal);
    this.labelBox = scene.add
      .rectangle(x, y, this.label.width, this.label.height, isLocal ? NAVY : PAPER)
      .setStrokeStyle(1, NAVY)
      .setOrigin(0.5, 1);
    this.statusDot = scene.add.circle(x, y, 3, STATUS_COLORS.available).setStrokeStyle(1, NAVY);
    this.speakingRing = scene.add.ellipse(x, y, 26, 10).setStrokeStyle(2, hexToInt(SPEAKING_COLOR), 0.95).setVisible(false);
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

  setSpeaking(speaking: boolean) {
    this.speaking = speaking;
    this.speakingRing.setVisible(speaking && !this.video);
    if (this.video) this.video.wrap.style.borderColor = speaking ? SPEAKING_COLOR : RISO.navy;
  }

  /**
   * Reemplaza el personaje por la cámara de la persona (o vuelve al personaje con `null`).
   * Se dibuja como elemento DOM de Phaser: sigue la cámara del juego y escala con el zoom.
   */
  setVideo(track: Track | null, opts: { mirror?: boolean; onClick?: () => void } = {}) {
    if (this.video?.track === track) return;
    this.clearVideo();
    if (!track) return;

    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      width: `${VIDEO_SIZE}px`,
      height: `${VIDEO_SIZE}px`,
      borderRadius: "50%",
      overflow: "hidden",
      border: `2px solid ${this.speaking ? SPEAKING_COLOR : RISO.navy}`,
      background: RISO.navy,
      boxShadow: `2px 2px 0 ${RISO.navy}`,
      cursor: opts.onClick ? "zoom-in" : "default",
    } satisfies Partial<CSSStyleDeclaration>);
    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    el.autoplay = true;
    Object.assign(el.style, {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: opts.mirror ? "scaleX(-1)" : "",
    } satisfies Partial<CSSStyleDeclaration>);
    wrap.appendChild(el);
    if (opts.onClick) wrap.addEventListener("click", opts.onClick);
    track.attach(el);

    const dom = this.scene.add.dom(this.sprite.x, this.sprite.y, wrap).setOrigin(0.5, 1);
    this.video = { track, el, wrap, dom };
    this.sprite.setVisible(false);
    this.speakingRing.setVisible(false);
    this.layout();
  }

  private clearVideo() {
    if (!this.video) return;
    this.video.track.detach(this.video.el);
    this.video.dom.destroy();
    this.video = undefined;
    this.sprite.setVisible(true);
    this.speakingRing.setVisible(this.speaking);
    this.layout();
  }

  /** Cambia el personaje (fijo o personalizado) sin perder la pose actual. */
  setAppearance(textureKey: string) {
    if (textureKey === this.textureKey) return;
    ensureAnimations(this.scene, textureKey);
    this.textureKey = textureKey;
    if (this.seated) {
      this.sprite.setTexture(`${textureKey}-sit`, this.seated === "down" ? 0 : 1);
    } else if (this.moving) {
      this.sprite.play(`${textureKey}-walk-${this.dir}`, true);
    } else {
      this.sprite.setTexture(textureKey, ROW[this.dir] * FRAMES_PER_ROW);
    }
  }

  /** Sienta al personaje mirando hacia `facing`, o lo vuelve a poner de pie con `null`. */
  setSeated(facing: "up" | "down" | null) {
    if (facing === this.seated) return;
    this.seated = facing;
    if (facing) {
      this.sprite.stop();
      this.sprite.setTexture(`${this.textureKey}-sit`, facing === "down" ? 0 : 1);
    } else {
      this.moving = false;
      this.sprite.setTexture(this.textureKey, ROW[this.dir] * FRAMES_PER_ROW);
    }
  }

  get isSeated() {
    return this.seated !== null;
  }

  setMotion(dir: Direction, moving: boolean) {
    if (this.seated) {
      this.dir = dir;
      return;
    }
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
      fontFamily: risoFontFamily(),
      fontSize: "10px",
      color: RISO.navy,
      wordWrap: { width: 150 },
      resolution: 3,
    });
    content.setOrigin(0.5, 1);
    const w = content.width + 12;
    const h = content.height + 8;
    // Globo de papel con borde de tinta y sombra sólida, como las fichas de la UI.
    const bg = this.scene.add.graphics();
    bg.fillStyle(NAVY, 1);
    bg.fillRect(-w / 2 + 2, -h - 2, w, h);
    bg.fillStyle(PAPER, 1);
    bg.lineStyle(1, NAVY, 1);
    bg.fillRect(-w / 2, -h - 4, w, h);
    bg.strokeRect(-w / 2, -h - 4, w, h);
    bg.fillTriangle(-4, -4.5, 4, -4.5, 0, 1);
    bg.lineBetween(-4, -4, 0, 1);
    bg.lineBetween(4, -4, 0, 1);
    content.setPosition(0, -8);
    this.bubble = this.scene.add.container(0, 0, [bg, content]);
    this.layout();
    this.bubbleTimer = this.scene.time.delayedCall(BUBBLE_MS, () => {
      this.bubble?.destroy();
      this.bubble = undefined;
    });
  }

  destroy() {
    this.clearVideo();
    this.bubbleTimer?.remove();
    this.bubble?.destroy();
    this.sprite.destroy();
    this.label.destroy();
    this.labelBox.destroy();
    this.labelShadow.destroy();
    this.statusDot.destroy();
    this.speakingRing.destroy();
  }

  private layout() {
    const { x, y } = this.sprite;
    this.sprite.setDepth(y);
    this.speakingRing.setPosition(x, y - 1).setDepth(y - 1);
    // Con cámara, el nombre va sobre la burbuja de video.
    const top = this.video ? VIDEO_SIZE + 6 : 30;
    this.video?.dom.setPosition(x, y + 2);
    this.label.setPosition(x + 4, y - top).setDepth(100_000 + y);
    this.labelBox.setPosition(x + 4, y - top).setDepth(100_000 + y - 0.1);
    this.labelShadow.setPosition(x + 6, y - top + 2).setDepth(100_000 + y - 0.2);
    this.statusDot.setPosition(x + 4 - this.label.width / 2 - 5, y - top - this.label.height / 2).setDepth(100_001 + y);
    this.bubble?.setPosition(x, y - top - this.label.height).setDepth(200_000 + y);
  }
}
