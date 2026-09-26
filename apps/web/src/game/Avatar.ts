import { bubble, characterShadow, drawCafeItem, drawEmote, FEET_Y, FRAME, FRAMES, heldEffect, puff, SHEET_DIRECTIONS } from "@hyvento/map/art";
import { EMOTE, heldParts, type Direction, type EmoteId, type PresenceStatus } from "@hyvento/shared";
import type { Track } from "livekit-client";
import * as Phaser from "phaser";
import { COZY, cozyFontFamily, hexToInt, STATUS_HEX } from "@/lib/cozy";
import { depthOf, ensureTexture, worldToScreen } from "./iso/view";

const ROW = Object.fromEntries(SHEET_DIRECTIONS.map((d, i) => [d, i])) as Record<Direction, number>;
const BUBBLE_MS = 4500;
/** Diámetro (px de pantalla del juego) de la burbuja de cámara sobre la cabeza. */
const VIDEO_SIZE = 30;
/** Altura del nombre sobre los pies. */
const HEAD = 30;
const SPEAKING_COLOR = "#5ea247";
/**
 * Dónde va lo que lleva en cada mano, según hacia dónde mira: desplazamiento horizontal desde el centro
 * y si queda delante del cuerpo (de frente) o detrás (de espaldas, asomado al costado). La segunda mano
 * solo se usa con los combos (un tinto y un cigarro).
 */
const HANDS: Record<Direction, [{ dx: number; front: boolean }, { dx: number; front: boolean }]> = {
  down: [
    { dx: 4, front: true },
    { dx: -5, front: true },
  ],
  right: [
    { dx: -5, front: true },
    { dx: 4, front: true },
  ],
  left: [
    { dx: 7, front: false },
    { dx: -7, front: false },
  ],
  up: [
    { dx: -7, front: false },
    { dx: 7, front: false },
  ],
};

/** Algo en una mano: su sprite y, si echa vapor o humo, la bocanada animada. */
interface HeldPart {
  image: Phaser.GameObjects.Image;
  hand: 0 | 1;
  puff?: { image: Phaser.GameObjects.Image; from: [number, number]; rise: number; tween: Phaser.Tweens.Tween };
}

export const STATUS_COLORS = Object.fromEntries(
  Object.entries(STATUS_HEX).map(([k, v]) => [k, hexToInt(v)]),
) as Record<PresenceStatus, number>;

/** Registra las animaciones de caminata de una hoja de personaje (idempotente). */
export function ensureAnimations(scene: Phaser.Scene, key: string) {
  for (const dir of SHEET_DIRECTIONS) {
    const animKey = `${key}-walk-${dir}`;
    if (scene.anims.exists(animKey)) continue;
    const base = ROW[dir] * FRAMES;
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(key, { frames: [base + 1, base, base + 2, base] }),
      frameRate: 8,
      repeat: -1,
    });
  }
}

/** Avatar en la cabaña: sprite chibi + sombra + nombre + estado + globo de chat. Posición en px de mundo. */
export class Avatar {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly statusDot: Phaser.GameObjects.Arc;
  private readonly speakingRing: Phaser.GameObjects.Ellipse;
  private bubble?: Phaser.GameObjects.Container;
  /** Emote sobre la cabeza (un globo con dibujo) y el baile, si está bailando. */
  private emoteBubble?: { container: Phaser.GameObjects.Container; lift: number; tween: Phaser.Tweens.Tween };
  private dance?: { timer: Phaser.Time.TimerEvent; step: number };
  /** Lo que lleva en las manos (pedido en la cafetería). */
  private held?: { id: string; parts: HeldPart[] };
  private bubbleTimer?: Phaser.Time.TimerEvent;
  private video?: { track: Track; el: HTMLVideoElement; wrap: HTMLDivElement; dom: Phaser.GameObjects.DOMElement };
  private speaking = false;
  private dir: Direction = "down";
  private moving = false;
  private seated: Direction | null = null;
  private wx: number;
  private wy: number;
  private hidden = false;

  /** Posición destino (jugadores remotos, interpolada en `update`). */
  targetX: number;
  targetY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private textureKey: string,
    name: string,
    x: number,
    y: number,
    private readonly isLocal: boolean,
  ) {
    ensureAnimations(scene, textureKey);
    ensureTexture(scene, "sombra-personaje", () => characterShadow());
    this.wx = x;
    this.wy = y;
    this.targetX = x;
    this.targetY = y;
    this.shadow = scene.add.image(0, 0, "sombra-personaje");
    this.sprite = scene.add.sprite(0, 0, textureKey, 0).setOrigin(0.5, FEET_Y / FRAME);
    this.label = scene.add
      .text(0, 0, isLocal ? `${name} (tú)` : name, {
        fontFamily: cozyFontFamily(),
        fontSize: "8px",
        color: isLocal ? COZY.paperLight : COZY.ink,
        backgroundColor: isLocal ? COZY.wood : COZY.paperLight,
        padding: { x: 3, y: 1 },
        resolution: 6,
      })
      .setOrigin(0.5, 1);
    this.statusDot = scene.add.circle(0, 0, 2, STATUS_COLORS.available).setStrokeStyle(1, hexToInt(COZY.frame));
    this.speakingRing = scene.add.ellipse(0, 0, 18, 8).setStrokeStyle(1.5, hexToInt(SPEAKING_COLOR), 0.95).setVisible(false);
    this.layout();
  }

  /** Posición de los pies en px de mundo. */
  get x() {
    return this.wx;
  }
  get y() {
    return this.wy;
  }
  get direction() {
    return this.dir;
  }

  setPosition(x: number, y: number) {
    this.wx = x;
    this.wy = y;
    this.layout();
  }

  /** Oculta a quien está en otro nivel de la cabaña. */
  setHidden(hidden: boolean) {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    for (const o of [this.sprite, this.shadow, this.label, this.statusDot]) o.setVisible(!hidden);
    for (const part of this.held?.parts ?? []) {
      part.image.setVisible(!hidden);
      part.puff?.image.setVisible(!hidden);
    }
    this.speakingRing.setVisible(!hidden && this.speaking && !this.video);
    this.bubble?.setVisible(!hidden);
    this.emoteBubble?.container.setVisible(!hidden);
    this.video?.dom.setVisible(!hidden);
  }

  setStatus(status: PresenceStatus) {
    this.statusDot.setFillStyle(STATUS_COLORS[status] ?? STATUS_COLORS.available);
  }

  setSpeaking(speaking: boolean) {
    this.speaking = speaking;
    this.speakingRing.setVisible(speaking && !this.video && !this.hidden);
    if (this.video) this.video.wrap.style.borderColor = speaking ? SPEAKING_COLOR : COZY.frame;
  }

  /**
   * Muestra la cámara de la persona en una burbuja sobre su cabeza (o la quita con `null`).
   * Es un elemento DOM de Phaser: sigue la cámara del juego y escala con el zoom.
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
      border: `2px solid ${this.speaking ? SPEAKING_COLOR : COZY.frame}`,
      background: COZY.frame,
      boxShadow: `1px 1px 0 ${COZY.frame}`,
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

    const dom = this.scene.add.dom(0, 0, wrap).setOrigin(0.5, 1);
    this.video = { track, el, wrap, dom };
    this.speakingRing.setVisible(false);
    dom.setVisible(!this.hidden);
    this.layout();
  }

  private clearVideo() {
    if (!this.video) return;
    this.video.track.detach(this.video.el);
    this.video.dom.destroy();
    this.video = undefined;
    this.speakingRing.setVisible(this.speaking && !this.hidden);
    this.layout();
  }

  /** Pone en las manos lo pedido en la cafetería (id del menú) o lo quita con "". */
  setHeld(id: string) {
    if ((this.held?.id ?? "") === id) return;
    this.clearHeld();
    const parts = heldParts(id);
    if (parts.length === 0) return;
    this.held = { id, parts: parts.map((art, i) => this.makeHeldPart(art, i === 0 ? 0 : 1)) };
    this.layout();
  }

  private makeHeldPart(art: string, hand: 0 | 1): HeldPart {
    const key = `mano-${art}`;
    ensureTexture(this.scene, key, () => drawCafeItem(art));
    const part: HeldPart = { image: this.scene.add.image(0, 0, key).setOrigin(0.5, 1).setVisible(!this.hidden), hand };
    const effect = heldEffect(art);
    if (effect) {
      const smoke = effect.fx === "smoke";
      const puffKey = smoke ? "humo" : "vapor";
      ensureTexture(this.scene, puffKey, () => puff(effect.fx));
      const image = this.scene.add.image(0, 0, puffKey).setOrigin(0.5, 1).setVisible(!this.hidden);
      // Sube y se desvanece; el humo es más lento y sube más que el vapor.
      const tween = this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: smoke ? 2000 : 1400,
        repeat: -1,
        repeatDelay: smoke ? 900 : 500,
        delay: hand * 700,
        onUpdate: (t) => {
          const v = t.getValue() ?? 0;
          if (part.puff) part.puff.rise = v * (smoke ? 7 : 5);
          image.setAlpha(1 - v);
          this.layout();
        },
      });
      part.puff = { image, from: effect.from, rise: 0, tween };
    }
    return part;
  }

  private clearHeld() {
    for (const part of this.held?.parts ?? []) {
      part.puff?.tween.remove();
      part.puff?.image.destroy();
      part.image.destroy();
    }
    this.held = undefined;
  }

  /** Nombre visible (cambia en vivo si la persona edita su perfil). */
  setName(name: string) {
    this.label.setText(this.isLocal ? `${name} (tú)` : name);
    this.layout();
  }

  /** Cambia el personaje sin perder la pose actual. */
  setAppearance(textureKey: string) {
    if (textureKey === this.textureKey) return;
    ensureAnimations(this.scene, textureKey);
    this.textureKey = textureKey;
    if (this.seated) {
      this.sprite.setTexture(`${textureKey}-sit`, ROW[this.seated]);
    } else if (this.moving) {
      this.sprite.play(`${textureKey}-walk-${this.dir}`, true);
    } else {
      this.sprite.setTexture(textureKey, ROW[this.dir] * FRAMES);
    }
  }

  /** Sienta al personaje mirando hacia `facing`, o lo vuelve a poner de pie con `null`. */
  setSeated(facing: Direction | null) {
    if (facing === this.seated) return;
    this.seated = facing;
    this.shadow.setVisible(!facing && !this.hidden);
    if (facing) {
      this.sprite.stop();
      this.sprite.setTexture(`${this.textureKey}-sit`, ROW[facing]);
    } else {
      this.moving = false;
      this.sprite.setTexture(this.textureKey, ROW[this.dir] * FRAMES);
    }
  }

  get isSeated() {
    return this.seated !== null;
  }

  setMotion(dir: Direction, moving: boolean) {
    if (moving) this.stopDance();
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
      this.sprite.setFrame(ROW[dir] * FRAMES);
    }
  }

  /** Interpola hacia (targetX, targetY). Usado por los avatares remotos. */
  interpolate(dtMs: number) {
    const dx = this.targetX - this.wx;
    const dy = this.targetY - this.wy;
    if (dx * dx + dy * dy > 96 * 96) {
      this.setPosition(this.targetX, this.targetY); // salto grande (corrección, cambio de nivel)
      return;
    }
    const t = Math.min(1, (dtMs / 1000) * 14);
    this.setPosition(this.wx + dx * t, this.wy + dy * t);
  }

  /** Emote: globo con un dibujo que aparece de un salto, flota y se va. "dance" además hace bailar. */
  emote(id: EmoteId) {
    this.emoteBubble?.tween.remove();
    this.emoteBubble?.container.destroy();
    ensureTexture(this.scene, "globo-emote", () => bubble(13, 12));
    ensureTexture(this.scene, `emote-${id}`, () => drawEmote(id));
    const bg = this.scene.add.image(0, 0, "globo-emote").setOrigin(0.5, 1);
    const icon = this.scene.add.image(0, -bg.height + 2, `emote-${id}`).setOrigin(0.5, 0);
    const container = this.scene.add.container(0, 0, [bg, icon]).setVisible(!this.hidden).setScale(0.2);
    const state = { container, lift: 0, tween: undefined as unknown as Phaser.Tweens.Tween };
    // Salta a su tamaño, sube un poco mientras se ve y al final se desvanece.
    state.tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: EMOTE.showMs,
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        container.setScale(v < 0.08 ? 0.2 + (v / 0.08) * 0.9 : v < 0.14 ? 1.1 - ((v - 0.08) / 0.06) * 0.1 : 1);
        state.lift = Math.round(v * 4);
        container.setAlpha(v > 0.85 ? 1 - (v - 0.85) / 0.15 : 1);
        this.layout();
      },
      onComplete: () => {
        container.destroy();
        if (this.emoteBubble === state) this.emoteBubble = undefined;
      },
    });
    this.emoteBubble = state;
    if (id === "dance") this.startDance();
    this.layout();
  }

  /** Baile: gira mirando a cada lado y da saltitos (solo de pie y quieto). */
  private startDance() {
    if (this.seated || this.moving) return;
    this.stopDance();
    const order: Direction[] = ["down", "right", "up", "left"];
    const steps = Math.floor(EMOTE.danceMs / 250);
    const dance = {
      step: 0,
      timer: this.scene.time.addEvent({
        delay: 250,
        repeat: steps - 1,
        callback: () => {
          dance.step++;
          const dir = order[Math.floor(dance.step / 2) % order.length]!;
          this.sprite.setFrame(ROW[dir] * FRAMES + (dance.step % 2 ? 1 : 2));
          this.layout();
          if (dance.step >= steps) this.stopDance();
        },
      }),
    };
    this.dance = dance;
  }

  private stopDance() {
    if (!this.dance) return;
    this.dance.timer.remove();
    this.dance = undefined;
    if (!this.seated && !this.moving) this.sprite.setFrame(ROW[this.dir] * FRAMES);
    this.layout();
  }

  /** Globo de diálogo pixel sobre la cabeza, estilo Stardew. */
  say(text: string) {
    this.bubble?.destroy();
    this.bubbleTimer?.remove();
    const shown = text.length > 80 ? `${text.slice(0, 77)}…` : text;
    const content = this.scene.add
      .text(0, 0, shown, {
        fontFamily: cozyFontFamily(),
        fontSize: "8px",
        color: COZY.ink,
        wordWrap: { width: 110 },
        resolution: 6,
        align: "center",
      })
      .setOrigin(0.5, 0.5);
    const w = Math.ceil(content.width) + 10;
    const h = Math.ceil(content.height) + 6;
    const key = `globo-${w}x${h}`;
    ensureTexture(this.scene, key, () => bubble(w, h));
    const bg = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
    content.setPosition(0, -bg.height + h / 2 + 1);
    this.bubble = this.scene.add.container(0, 0, [bg, content]).setVisible(!this.hidden);
    this.layout();
    this.bubbleTimer = this.scene.time.delayedCall(BUBBLE_MS, () => {
      this.bubble?.destroy();
      this.bubble = undefined;
    });
  }

  destroy() {
    this.clearVideo();
    this.clearHeld();
    this.stopDance();
    this.emoteBubble?.tween.remove();
    this.emoteBubble?.container.destroy();
    this.bubbleTimer?.remove();
    this.bubble?.destroy();
    this.sprite.destroy();
    this.shadow.destroy();
    this.label.destroy();
    this.statusDot.destroy();
    this.speakingRing.destroy();
  }

  private layout() {
    const s = worldToScreen(this.wx, this.wy);
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    const depth = depthOf(this.wx, this.wy);
    // Bailando da saltitos de 2 px.
    const hop = this.dance && this.dance.step % 2 ? 2 : 0;
    this.sprite.setPosition(x, y + 1 - hop).setDepth(depth + 0.5);
    this.shadow.setPosition(x, y).setDepth(depth + 0.4);
    this.speakingRing.setPosition(x, y).setDepth(depth + 0.45);
    if (this.held) {
      const hands = HANDS[this.seated ?? this.dir];
      // Sentado, las manos quedan 3 px más abajo (sobre las piernas).
      const bottom = y + 1 - (this.seated ? 2 : 5);
      for (const part of this.held.parts) {
        const hand = hands[part.hand];
        const hx = x + hand.dx;
        const hd = depth + (hand.front ? 0.55 : 0.47);
        part.image.setPosition(hx, bottom).setDepth(hd);
        if (part.puff) {
          const left = hx - part.image.width / 2;
          const top = bottom - part.image.height;
          part.puff.image.setPosition(left + part.puff.from[0] + 0.5, top + part.puff.from[1] - part.puff.rise).setDepth(hd);
        }
      }
    }
    // Con cámara, el nombre va sobre la burbuja de video. Los textos van por encima de todo.
    const head = HEAD - (this.seated ? 3 : 0);
    const top = this.video ? head + VIDEO_SIZE + 2 : head;
    this.video?.dom.setPosition(x, y - head + 2).setDepth(depth + 0.6);
    this.label.setPosition(x + 3, y - top).setDepth(5e7 + depth);
    this.statusDot.setPosition(x + 3 - this.label.width / 2 - 4, y - top - this.label.height / 2).setDepth(5e7 + depth + 0.1);
    this.bubble?.setPosition(x, y - top - this.label.height - 1).setDepth(6e7 + depth);
    if (this.emoteBubble) {
      // Sobre el nombre; si hay globo de chat, encima de él.
      const chat = this.bubble ? (this.bubble.list[0] as Phaser.GameObjects.Image).height : 0;
      this.emoteBubble.container
        .setPosition(x, y - top - this.label.height - 1 - chat - this.emoteBubble.lift)
        .setDepth(6e7 + depth + 0.1);
    }
  }
}
