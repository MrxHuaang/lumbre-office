import { bubble, characterShadow, crumbColor, drawEmote, FEET_Y, FRAME, FRAMES, heldEffect, SHEET_DIRECTIONS } from "@hyvento/map/art";
import { EMOTE, heldParts, parseHeldLeft, usesOf, type ConsumeAction, type Direction, type EmoteId, type PresenceStatus } from "@hyvento/shared";
import type { Track } from "livekit-client";
import * as Phaser from "phaser";
import { COZY, cozyFontFamily, hexToInt, STATUS_HEX } from "@/lib/cozy";
import { heldTexture, idleWisp, playUse } from "./consumables";
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

/**
 * Boca respecto de los pies: cuántos px arriba (de pie o sentado) y cuánto al costado según hacia dónde
 * mira (de espaldas queda del lado hacia el que gira la cabeza). Ahí se lleva lo que se consume.
 */
/** Tope de una animación de uso (la más larga, la pitada, dura ~1,1 s): después se libera la mano igual. */
const USE_SAFETY_MS = 2500;
const MOUTH_STANDING = 13;
const MOUTH_SEATED = 10;
const MOUTH: Record<Direction, { dx: number }> = { down: { dx: -1 }, right: { dx: 1 }, left: { dx: -4 }, up: { dx: 4 } };

/** Algo en una mano: su sprite, los usos que le quedan y cómo está en la animación de uso. */
interface HeldPart {
  art: string;
  /** Cigarro o habano (apunta hacia afuera y echa humo). */
  smoke: boolean;
  image: Phaser.GameObjects.Image;
  hand: 0 | 1;
  /** Usos que se ven y los últimos que mandó el servidor (se aplican al terminar la animación). */
  left: number;
  pendingLeft: number;
  ember: 0 | 1 | 2;
  tilt: -1 | 0 | 1;
  /** 0 = en la mano, 1 = en la boca; y un saltito en px (el sorbo, el mordisco). */
  raise: number;
  bob: number;
  busy: boolean;
  /** Brasa que titila y humo o vapor mientras se sostiene. */
  idle?: Phaser.Time.TimerEvent;
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
  /** Lo que lleva en las manos (pedido en la cafetería o el bar); `clearing` = se quita al terminar de usarlo. */
  private held?: { id: string; parts: HeldPart[]; clearing: boolean };
  /** Tocando un instrumento: lleva el ritmo con saltitos. */
  private playing?: { timer: Phaser.Time.TimerEvent; step: number };
  private destroyed = false;
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
    for (const part of this.held?.parts ?? []) part.image.setVisible(!hidden && part.left > 0);
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

  /**
   * Pone en las manos lo pedido en la cafetería o el bar (id de la carta) o lo quita con "". `left` son
   * los usos que le quedan a cada mano ("4,5", ver `Player.heldLeft`). Si se está usando, lo nuevo se
   * aplica al terminar la animación (así el último sorbo se ve antes de que el vaso desaparezca).
   */
  setHeld(id: string, left = "") {
    const counts = parseHeldLeft(left);
    const current = this.held;
    if (current && current.id === id) {
      current.clearing = false;
      current.parts.forEach((p, i) => {
        p.pendingLeft = counts[i] ?? p.pendingLeft;
        if (!p.busy) this.applyLeft(p);
      });
      return;
    }
    if (!id && current?.parts.some((p) => p.busy)) {
      current.clearing = true;
      return;
    }
    this.clearHeld();
    const parts = heldParts(id);
    if (parts.length === 0) return;
    this.held = { id, clearing: false, parts: parts.map((art, i) => this.makeHeldPart(art, i === 0 ? 0 : 1, counts[i] ?? usesOf(art))) };
    for (const p of this.held.parts) this.applyLeft(p);
    this.layout();
  }

  /** ¿Tiene algo en la mano con usos? (para el botón "usar" del HUD). */
  get holding() {
    return Boolean(this.held?.parts.some((p) => p.pendingLeft > 0));
  }

  private makeHeldPart(art: string, hand: 0 | 1, left: number): HeldPart {
    const effect = heldEffect(art);
    const part: HeldPart = {
      art,
      smoke: effect?.fx === "smoke",
      hand,
      left,
      pendingLeft: left,
      ember: 1,
      tilt: 0,
      raise: 0,
      bob: 0,
      busy: false,
      image: this.scene.add.image(0, 0, heldTexture(this.scene, art, left, 1, 0)).setOrigin(0.5, 1).setVisible(!this.hidden),
    };
    if (effect) {
      const smoke = effect.fx === "smoke";
      // Mientras se sostiene: la brasa titila y sale un hilo de humo; las bebidas calientes echan vapor.
      part.idle = this.scene.time.addEvent({
        delay: smoke ? 420 : 650,
        startAt: hand * 300,
        loop: true,
        callback: () => {
          if (part.left <= 0 || part.busy) return;
          if (smoke) {
            const ember = Math.random() < 0.3 ? 0 : 1;
            if (ember !== part.ember) {
              part.ember = ember;
              this.refreshPart(part);
            }
          }
          const p = this.emberPoint(part);
          if (p && !this.hidden && Math.random() < (smoke ? 0.75 : 0.85)) idleWisp(this.scene, p.x, p.y, p.depth, effect.fx);
        },
      });
    }
    return part;
  }

  private refreshPart(part: HeldPart) {
    part.image.setTexture(heldTexture(this.scene, part.art, Math.max(1, part.left), part.ember, part.tilt));
  }

  /** Aplica los usos que quedan: se redibuja con menos (o se va de la mano si no queda nada). */
  private applyLeft(part: HeldPart) {
    part.left = part.pendingLeft;
    part.image.setVisible(!this.hidden && part.left > 0);
    if (part.left > 0) this.refreshPart(part);
    this.layout();
  }

  /**
   * Usar lo que tiene en una mano (lo avisa el servidor, a todos los del nivel): se lleva a la boca y
   * se ve la pitada, el sorbo o el mordisco. `left` = usos que le quedan después de este.
   */
  useHeld(index: number, action: ConsumeAction, left: number) {
    const part = this.held?.parts[index];
    if (!part) return;
    part.pendingLeft = Math.min(part.pendingLeft, left);
    if (part.busy) return;
    part.busy = true;
    const alive = () => !this.destroyed && Boolean(this.held?.parts.includes(part));
    const avatar = this;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(safety);
      if (!alive()) return;
      part.busy = false;
      part.raise = 0;
      part.bob = 0;
      part.tilt = 0;
      avatar.applyLeft(part);
      if (this.held?.clearing && !this.held.parts.some((p) => p.busy)) this.clearHeld();
    };
    // Por si la animación no termina nunca (tweens cortados): el estado del servidor igual se aplica.
    const safety = setTimeout(done, USE_SAFETY_MS);
    void playUse(this.scene, action, {
      setPose(raise, bob) {
        if (!alive()) return;
        part.raise = raise;
        part.bob = bob;
        avatar.layout();
      },
      setTilt(tilt) {
        if (!alive()) return;
        part.tilt = tilt;
        avatar.refreshPart(part);
        avatar.layout();
      },
      setEmber(ember) {
        if (!alive()) return;
        part.ember = ember;
        avatar.refreshPart(part);
      },
      applyLeft() {
        if (!alive()) return;
        // El último uso: se ve el mordisco o el sorbo, pero el objeto se va recién al bajar la mano.
        if (part.pendingLeft > 0) avatar.applyLeft(part);
      },
      faceSide: () => this.faceSide(part),
      mouth: () => this.mouthPoint(),
      emberPoint: () => (alive() ? this.emberPoint(part) : null),
      crumbColor: () => crumbColor(part.art),
      hidden: () => this.hidden || this.destroyed,
      done,
    });
  }

  /** Hacia dónde queda la cara respecto de esa mano (-1 izquierda, 1 derecha). */
  private faceSide(part: HeldPart): -1 | 1 {
    const face = this.seated ?? this.dir;
    return MOUTH[face].dx - HANDS[face][part.hand].dx < 0 ? -1 : 1;
  }

  /** La boca en pantalla (de donde sale el humo y caen las migas). */
  private mouthPoint() {
    const s = worldToScreen(this.wx, this.wy);
    const face = this.seated ?? this.dir;
    const y = Math.round(s.y) + 1 - (this.seated ? MOUTH_SEATED : MOUTH_STANDING);
    return { x: Math.round(s.x) + MOUTH[face].dx, y, depth: depthOf(this.wx, this.wy) + 0.6, floorY: Math.round(s.y) };
  }

  /** De dónde sale el humo o el vapor de esa mano (la brasa, o el borde de la taza). */
  private emberPoint(part: HeldPart) {
    const effect = heldEffect(part.art, part.left);
    if (!effect || part.tilt) return null;
    const img = part.image;
    const left = img.x - img.width / 2;
    const top = img.y - img.height;
    const fx = img.flipX ? img.width - 1 - effect.from[0] : effect.from[0];
    return { x: Math.round(left + fx) + 0.5, y: Math.round(top + effect.from[1]) + 0.5, depth: img.depth + 0.02 };
  }

  private clearHeld() {
    for (const part of this.held?.parts ?? []) {
      part.idle?.remove();
      part.image.destroy();
    }
    this.held = undefined;
  }

  /**
   * Tocar un instrumento: mira hacia él y lleva el ritmo con saltitos de 1 px durante `ms`. Si camina,
   * deja de tocar.
   */
  perform(face: Direction, ms: number) {
    this.stopPerform();
    this.stopDance();
    if (!this.seated) this.setMotion(face, false);
    const steps = Math.floor(ms / 240);
    const play = {
      step: 0,
      timer: this.scene.time.addEvent({
        delay: 240,
        repeat: steps - 1,
        callback: () => {
          play.step++;
          this.layout();
          if (play.step >= steps) this.stopPerform();
        },
      }),
    };
    this.playing = play;
  }

  private stopPerform() {
    if (!this.playing) return;
    this.playing.timer.remove();
    this.playing = undefined;
    this.layout();
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
    if (moving) {
      this.stopDance();
      this.stopPerform();
    }
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
    this.destroyed = true;
    this.clearVideo();
    this.clearHeld();
    this.stopDance();
    this.stopPerform();
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
    // Bailando da saltitos de 2 px; tocando un instrumento, de 1 px.
    const hop = this.dance && this.dance.step % 2 ? 2 : this.playing && this.playing.step % 2 ? 1 : 0;
    this.sprite.setPosition(x, y + 1 - hop).setDepth(depth + 0.5);
    this.shadow.setPosition(x, y).setDepth(depth + 0.4);
    this.speakingRing.setPosition(x, y).setDepth(depth + 0.45);
    if (this.held) {
      const face = this.seated ?? this.dir;
      const hands = HANDS[face];
      const front = face === "down" || face === "right";
      // Sentado, las manos quedan 3 px más abajo (sobre las piernas) y la boca también.
      const bottom = y + 1 - hop - (this.seated ? 2 : 5);
      const mouthX = x + MOUTH[face].dx;
      const mouthY = y + 1 - hop - (this.seated ? MOUTH_SEATED : MOUTH_STANDING);
      for (const part of this.held.parts) {
        const hand = hands[part.hand];
        const img = part.image;
        // El cigarro apunta hacia afuera: en la mano izquierda se voltea (el filtro queda hacia la cara).
        const smoke = part.smoke;
        const flip = smoke && hand.dx < 0;
        img.setFlipX(flip);
        const hx = x + hand.dx;
        // En la boca: el filtro entre los labios, o el borde del vaso a la altura de la boca.
        const toHand = hand.dx - MOUTH[face].dx < 0 ? -1 : 1;
        const mx = smoke ? mouthX + (flip ? -1 : 1) * Math.floor(img.width / 2) : mouthX + toHand * Math.max(1, Math.floor(img.width / 2) - 2);
        const my = smoke ? mouthY + Math.ceil(img.height / 2) : mouthY + img.height - 1;
        const r = part.raise;
        const hd = depth + (r > 0 ? (front ? 0.56 : 0.46) : hand.front ? 0.55 : 0.47);
        img.setPosition(Math.round(hx + (mx - hx) * r), Math.round(bottom + (my - bottom) * r) + part.bob).setDepth(hd);
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
