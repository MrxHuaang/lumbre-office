import { seatBehind, seatLift, SIT_BACK_ROWS, type Seat } from "@hyvento/map";
import { bubble, characterShadow, crumbColor, FEET_Y, focusTomato, FRAME, FRAMES, heldEffect, partyHat, SHEET_DIRECTIONS, singerMic, sparkleSprite } from "@hyvento/map/art";
import {
  consumeActionOf,
  DRUNK,
  EMOTE,
  emoteInfo,
  heldParts,
  parseHeldLeft,
  spinMs,
  spinProgress,
  TOAST,
  usesOf,
  type ConsumeAction,
  type Direction,
  type DrunkStage,
  type EmoteGesture,
  type EmoteId,
  type PresenceStatus,
} from "@hyvento/shared";
import type { Track } from "livekit-client";
import * as Phaser from "phaser";
import { COZY, cozyFontFamily, hexToInt, STATUS_HEX } from "@/lib/cozy";
import { heldTexture, idleWisp, playUse } from "./consumables";
import { armTexture, ensureEmoteTextures, gestureOffset, SHOULDER_UP, WAVE_SIDE } from "./gestures";
import { SWAY_DEG } from "./drunk";
import { sfx, volAt } from "./sfx";
import type { NameTagMode } from "./store";
import { depthOf, ensureTexture, furnitureImage, worldToScreen } from "./iso/view";

/** La silla de la carrera de sillas. */
const RIDE_CHAIR = "office-chair";
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

/** Lo que se lleva sobre el nombre: el gorrito de cumpleaños, el tomatito del foco o el micrófono del karaoke. */
export type AvatarBadge = "hat" | "tomato" | "mic";
const BADGE_ART = { hat: partyHat, tomato: focusTomato, mic: singerMic } as const;
/** Alto de la fila de insignias (lo que se corren hacia arriba los globos). */
const BADGE_ROW_H = 12;

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
  /** Corrimiento de lado en px (el vaso que va a chocar con el de al lado). */
  nudge: number;
  busy: boolean;
  /** Levantado para brindar (hasta que chocan o se vence). */
  toasting: boolean;
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

/**
 * Nombre corto para la placa: el primer nombre y la inicial del segundo ("Juan José Ospina" → "Juan J."),
 * así dos Juanes se distinguen sin ocupar media pantalla.
 */
export function shortName(name: string): string {
  const words = name.trim().split(/s+/).filter(Boolean);
  if (words.length <= 1) return words[0] ?? name;
  return `${words[0]} ${words[1]![0]!.toUpperCase()}.`;
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
  /** Gesto de un emote en curso (`t` = ms desde que empezó) y el brazo que saluda, si va. */
  private gesture?: { kind: EmoteGesture; t: number; timer: Phaser.Time.TimerEvent; arm?: Phaser.GameObjects.Image };
  /** Insignias sobre el nombre (ver setBadges) y cuáles son, para no rearmarlas si no cambian. */
  private badgeRow?: { key: string; container: Phaser.GameObjects.Container };
  /** Cuenta regresiva de una foto (3-2-1) sobre la cabeza. */
  private countdownBubble?: { container: Phaser.GameObjects.Container; timer: Phaser.Time.TimerEvent };
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
  /** Cómo va sentado: cuánto bajar el dibujo, con qué profundidad y si el respaldo lo tapa. */
  private seatPose: { lift: number; depth: number; behind: boolean } | null = null;
  private wx: number;
  private wy: number;
  private hidden = false;
  /** Borrachera: se tambalea (cada uno a su ritmo) y a veces se le sale un hipo. */
  private drunk: DrunkStage = 0;
  private readonly swayPhase = Math.random() * Math.PI * 2;
  private nextHicAt = 0;
  /** Cuándo empezó el desmayo (0 = no lo vimos empezar: aparece ya tendido). */
  private faintAt = 0;
  /** Al aparecer (conectarse, cambiar de nivel) se aplica el estado sin sonidos. */
  private readonly bornAt = performance.now();
  /** Tipo del asiento en el que está (para saber si el respaldo lo tapa mientras gira). */
  private seatType = "";
  /** Girando en la silla: hacia dónde mira en este momento del giro. */
  private spinning?: { tween: Phaser.Tweens.Tween; face: Direction };

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
    this.fullName = name;
    this.label = scene.add
      .text(0, 0, name, {
        fontFamily: cozyFontFamily(),
        fontSize: "8px",
        color: isLocal ? COZY.paperLight : COZY.ink,
        backgroundColor: isLocal ? COZY.wood : COZY.paperLight,
        padding: { x: 3, y: 1 },
        resolution: 6,
      })
      .setOrigin(0.5, 1);
    this.statusDot = scene.add.circle(0, 0, 2, STATUS_COLORS.available).setStrokeStyle(1, hexToInt(COZY.frame));
    this.refreshLabel();
    this.speakingRing = scene.add.ellipse(0, 0, 18, 8).setStrokeStyle(1.5, hexToInt(SPEAKING_COLOR), 0.95).setVisible(false);
    // Los pasos, al ritmo de la caminata: la hoja va 1-0-2-0 y el pie apoya en los cuadros 1 y 2.
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_anim: unknown, frame: Phaser.Animations.AnimationFrame) => {
      if (frame.index % 2 === 1 && this.moving && !this.seated) sfx.stepAt(this.wx, this.wy, this.soundVol() * (this.isLocal ? 1 : 0.8), this.isLocal);
    });
    this.layout();
  }

  /** Cuánto se oye lo que hace este personaje desde donde estoy (0 si está en otro nivel). */
  private soundVol(): number {
    if (this.hidden || this.destroyed) return 0;
    return this.isLocal ? 1 : volAt(this.wx, this.wy);
  }

  /** Ya pasó el momento de aparecer: los cambios de estado de ahora en más suenan. */
  private get settled() {
    return performance.now() - this.bornAt > 800;
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
    this.ride?.img.setVisible(!hidden);
    if (this.ride) this.shadow.setVisible(false);
    for (const part of this.held?.parts ?? []) part.image.setVisible(!hidden && part.left > 0);
    this.speakingRing.setVisible(!hidden && this.speaking && !this.video);
    this.bubble?.setVisible(!hidden);
    this.emoteBubble?.container.setVisible(!hidden);
    this.gesture?.arm?.setVisible(!hidden);
    this.countdownBubble?.container.setVisible(!hidden);
    this.badgeRow?.container.setVisible(!hidden);
    this.video?.dom.setVisible(!hidden);
  }

  /**
   * Velado por el modo privado de otra sala: no se ve (sin tocar `hidden`, que es el del nivel). Con
   * transparencia y no con visibilidad, así no pelea con lo que prende o apaga cada cosa.
   */
  setVeiled(veiled: boolean) {
    if (veiled === this.veiled) return;
    this.veiled = veiled;
    const a = veiled ? 0 : 1;
    for (const o of [this.sprite, this.shadow, this.speakingRing]) o.setAlpha(a);
    this.refreshLabel();
    this.ride?.img.setAlpha(a);
    for (const part of this.held?.parts ?? []) part.image.setAlpha(a);
    this.bubble?.setAlpha(a);
    this.emoteBubble?.container.setAlpha(a);
    this.gesture?.arm?.setAlpha(a);
  }
  private veiled = false;

  /**
   * Insignias sobre el nombre: el gorrito de quien cumple años, el tomatito de quien está en foco y el
   * micrófono de quien canta en el karaoke. Se mecen un poquito, en fila.
   */
  setBadges(badges: AvatarBadge[]) {
    const key = badges.join(",");
    if (key === (this.badgeRow?.key ?? "")) return;
    this.badgeRow?.container.destroy();
    this.badgeRow = undefined;
    if (badges.length > 0) {
      const images = badges.map((b, i) => {
        const tex = ensureTexture(this.scene, `insignia-${b}`, () => BADGE_ART[b]());
        return this.scene.add.image((i - (badges.length - 1) / 2) * 10, 0, tex).setOrigin(0.5, 1);
      });
      const container = this.scene.add.container(0, 0, images).setVisible(!this.hidden);
      this.scene.tweens.add({ targets: images, y: -1, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: (_t: unknown, _k: unknown, _v: unknown, i: number) => i * 180 });
      this.badgeRow = { key, container };
      this.refreshLabel();
    }
    this.layout();
  }

  /** Confeti que salta sobre la cabeza (lo felicitaron por su cumpleaños). */
  confetti(colors: readonly (readonly number[])[]) {
    if (this.hidden) return;
    const s = worldToScreen(this.wx, this.wy);
    const depth = 6e7 + depthOf(this.wx, this.wy) + 0.3;
    for (let i = 0; i < 24; i++) {
      const c = colors[i % colors.length]!;
      const bit = this.scene.add
        .rectangle(Math.round(s.x), Math.round(s.y) - HEAD, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 1 : 2, (c[0]! << 16) | (c[1]! << 8) | c[2]!)
        .setDepth(depth)
        .setAlpha(this.veiled ? 0 : 1);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const speed = 18 + Math.random() * 22;
      this.scene.tweens.add({
        targets: bit,
        x: bit.x + Math.cos(angle) * speed,
        y: bit.y + Math.sin(angle) * speed + 26,
        angle: Math.random() * 360,
        alpha: 0,
        duration: 1200 + Math.random() * 700,
        ease: "Quad.out",
        onComplete: () => bit.destroy(),
      });
    }
  }

  /**
   * Sin nombre ni punto de estado: en el modo mesa la cámara se acerca tanto que el nombre (que crece con
   * ella) taparía la mesa. Con transparencia, así no pelea con el ocultado por nivel.
   */
  setNameHidden(hidden: boolean) {
    if (hidden === this.nameHidden) return;
    this.nameHidden = hidden;
    this.refreshLabel();
  }
  private nameHidden = false;

  /**
   * Cómo se ve el nombre (preferencia de cada quien, ver `nameTags` en el store) y si el mouse está
   * encima: al pasar el mouse siempre se ve el nombre completo.
   */
  setNameMode(mode: NameTagMode, hovered: boolean) {
    if (mode === this.nameMode && hovered === this.hovered) return;
    this.nameMode = mode;
    this.hovered = hovered;
    this.refreshLabel();
    this.layout();
  }
  private nameMode: NameTagMode = "corto";
  private hovered = false;
  private fullName: string;

  /** Texto, tamaño y transparencia del nombre según el modo, el mouse, el modo mesa y el velo. */
  private refreshLabel() {
    const full = this.nameMode === "completo" || this.hovered;
    // En corto, el propio nombre no se muestra (ya sabes quién eres; el color café lo marca al pasar el mouse).
    const shown = !this.nameHidden && !this.veiled && (full || (this.nameMode === "corto" && !this.isLocal));
    const text = full ? (this.isLocal ? `${this.fullName} (tú)` : this.fullName) : shortName(this.fullName);
    if (this.label.text !== text) this.label.setText(text);
    this.label.setPadding(full ? 3 : 2, full ? 1 : 0);
    // Los cortos van un poco transparentes para no tapar muebles ni a otros; el del mouse, encima de todo.
    this.label.setAlpha(shown ? (full ? 1 : 0.82) : 0);
    this.statusDot.setAlpha(shown ? 1 : 0);
    // Las insignias (gorrito, tomatito, micrófono) siguen al nombre: sin él (modo mesa, velo, nombres
    // ocultos) tampoco se ven; al pasar el mouse, sí.
    this.badgeRow?.container.setAlpha(!this.nameHidden && !this.veiled && (this.nameMode !== "oculto" || this.hovered) ? 1 : 0);
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
    // Recién pedido un cigarro o un habano: se prende con el encendedor.
    if (this.settled && this.held.parts.some((p) => p.smoke)) sfx.lighter(this.soundVol());
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
      nudge: 0,
      busy: false,
      toasting: false,
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
      volume: () => this.soundVol(),
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
    this.fullName = name;
    this.refreshLabel();
    this.layout();
  }

  /** ¿El punto (px de pantalla del mundo, como `pointer.worldX`) cae sobre el personaje o su nombre? */
  hitTest(x: number, y: number): boolean {
    if (this.hidden || this.veiled) return false;
    return this.sprite.getBounds().contains(x, y) || (this.label.alpha > 0 && this.label.getBounds().contains(x, y));
  }

  /** Cambia el personaje sin perder la pose actual. */
  setAppearance(textureKey: string) {
    if (textureKey === this.textureKey) return;
    ensureAnimations(this.scene, textureKey);
    this.textureKey = textureKey;
    if (this.seated) {
      this.sprite.setTexture(`${textureKey}-sit`, ROW[this.seated]);
      this.applySeatCrop();
    } else if (this.moving) {
      this.sprite.play(`${textureKey}-walk-${this.dir}`, true);
    } else {
      this.sprite.setTexture(textureKey, ROW[this.dir] * FRAMES);
    }
  }

  /**
   * Sienta al personaje mirando hacia `facing`, o lo vuelve a poner de pie con `null`. Con el asiento
   * se dibuja a la altura de ese mueble, ordenado con él y, de espaldas, asomando sobre el respaldo.
   */
  setSeated(facing: Direction | null, seat?: Seat | null) {
    if (this.spinning && (facing !== this.seated || !seat)) this.stopSpin();
    this.seatType = facing && seat ? seat.type : "";
    const pose = facing && seat ? { lift: seatLift(seat.type), depth: depthOf(seat.cx, seat.cy), behind: seatBehind(seat.type, facing) } : null;
    const same = facing === this.seated && pose?.lift === this.seatPose?.lift && pose?.depth === this.seatPose?.depth && pose?.behind === this.seatPose?.behind;
    if (same) return;
    this.seatPose = pose;
    if (facing !== this.seated) {
      if (this.settled && (facing === null) !== (this.seated === null)) {
        if (facing) sfx.sit(this.soundVol());
        else sfx.stand(this.soundVol());
      }
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
    this.applySeatCrop();
    this.layout();
  }

  /** De espaldas en un asiento con respaldo solo se ven la cabeza y los hombros (el resto lo tapa el respaldo). */
  private applySeatCrop() {
    // Girando, el respaldo tapa según hacia dónde mira en ese momento.
    const behind = this.spinning ? Boolean(this.seatType) && seatBehind(this.seatType, this.spinning.face) : this.seatPose?.behind;
    if (this.seated && behind) this.sprite.setCrop(0, 0, FRAME, SIT_BACK_ROWS);
    else this.sprite.setCrop();
  }

  get isSeated() {
    return this.seated !== null;
  }

  /** Está en otro nivel (no se ve). */
  get isHidden() {
    return this.hidden;
  }

  /**
   * Baile del club (club/index.ts): el club dibuja el baile con su propia imagen y mientras tanto el
   * cuerpo, la sombra y lo que lleva en la mano no se ven. Se llama en cada frame que dura el baile.
   */
  setBodyVisible(visible: boolean) {
    const show = visible && !this.hidden;
    this.sprite.setVisible(show);
    this.shadow.setVisible(show && !this.seated);
    for (const part of this.held?.parts ?? []) part.image.setVisible(show && part.left > 0);
  }

  /** Dónde se ve la persona si no es donde tiene los pies (bailando en el tubo: en el centro del tubo). */
  private overlayAnchor: { x: number; y: number } | null = null;

  /**
   * Mientras baila en el tubo (club/index.ts) el nombre, las burbujas, el anillo de quien habla y la
   * cámara van sobre el tubo y no donde quedaron los pies. `null` los devuelve a su lugar.
   */
  setOverlayAnchor(p: { x: number; y: number } | null) {
    const cur = this.overlayAnchor;
    if (cur === p || (cur && p && cur.x === p.x && cur.y === p.y)) return;
    this.overlayAnchor = p;
    this.layout();
  }

  private shiftOverlays() {
    const a = this.overlayAnchor;
    if (!a) return;
    const from = worldToScreen(this.wx, this.wy);
    const to = worldToScreen(a.x, a.y);
    const dx = Math.round(to.x) - Math.round(from.x);
    const dy = Math.round(to.y) - Math.round(from.y);
    const objects = [this.label, this.statusDot, this.speakingRing, this.bubble, this.emoteBubble?.container, this.badgeRow?.container, this.video?.dom];
    for (const o of objects) if (o) o.setPosition(o.x + dx, o.y + dy);
  }

  // ---------- Carrera de sillas ----------

  /** La silla de oficina en la que va montado (carrera de sillas), o nada. */
  private ride?: { img: Phaser.GameObjects.Image; facing: Direction; dx: number; dy: number };

  /** Montado en una silla de oficina (la carrera de sillas): sentado, y la silla lo sigue. */
  setRiding(on: boolean) {
    if (on === Boolean(this.ride)) return;
    if (!on) {
      this.ride?.img.destroy();
      this.ride = undefined;
      this.sprite.setCrop();
      this.shadow.setVisible(!this.hidden);
      if (!this.seated) this.sprite.setTexture(this.textureKey, ROW[this.dir] * FRAMES);
      this.layout();
      return;
    }
    this.stopDance();
    this.stopPerform();
    this.sprite.stop();
    this.shadow.setVisible(false);
    this.mountChair(this.dir);
  }

  get isRiding() {
    return Boolean(this.ride);
  }

  /** La silla mirando hacia `facing`, y el personaje sentado en ella. */
  private mountChair(facing: Direction) {
    this.ride?.img.destroy();
    const ts = 32;
    const f = { type: RIDE_CHAIR, x: this.wx / ts - 0.5, y: this.wy / ts - 0.5, facing, w: 1, d: 1 };
    const { img, anchor } = furnitureImage(this.scene, f, false, ts);
    img.setVisible(!this.hidden);
    this.ride = { img, facing, dx: img.x - anchor.x, dy: img.y - anchor.y };
    this.sprite.setTexture(`${this.textureKey}-sit`, ROW[facing]);
    // De espaldas, el respaldo tapa el cuerpo: se ve de los hombros para arriba (como sentado).
    if (seatBehind(RIDE_CHAIR, facing)) this.sprite.setCrop(0, 0, FRAME, SIT_BACK_ROWS);
    else this.sprite.setCrop();
    this.layout();
  }

  setMotion(dir: Direction, moving: boolean) {
    if (moving) {
      this.stopDance();
      this.stopPerform();
      this.stopGesture();
    }
    if (this.ride) {
      if (dir !== this.ride.facing) this.mountChair(dir);
      this.dir = dir;
      this.moving = moving;
      return;
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

  setDrunk(stage: DrunkStage) {
    this.drunk = stage;
    if (stage !== 4) this.faintAt = 0;
    if (!stage) this.sprite.setAngle(0);
  }

  /**
   * Se pasó de tragos: se agacha y vomita (gotas verdes y un charco que se seca) y después se cae de lado.
   * Lo ven todos los del nivel; lo que sigue (despertar descansando) lo decide el servidor.
   */
  faint(time: number) {
    if (this.destroyed) return;
    this.faintAt = time;
    this.stopDance();
    this.stopPerform();
    const s = worldToScreen(this.wx, this.wy);
    const face = this.dir === "left" || this.dir === "up" ? -1 : 1;
    const mouthX = Math.round(s.x) + face * 4;
    const mouthY = Math.round(s.y) - MOUTH_STANDING + 2;
    const depth = depthOf(this.wx, this.wy) + 0.6;
    const puddle = this.scene.add
      .ellipse(mouthX + face * 3, Math.round(s.y) + 1, 4, 2, 0x9bb33a, 0.9)
      .setDepth(depthOf(this.wx, this.wy) + 0.3)
      .setVisible(!this.hidden);
    this.scene.tweens.add({ targets: puddle, displayWidth: 18, displayHeight: 7, duration: DRUNK.vomitMs, ease: "Sine.out" });
    this.scene.tweens.add({ targets: puddle, alpha: 0, delay: 12_000, duration: 3000, onComplete: () => puddle.destroy() });
    // El golpe al caer (la caída dura ~300 ms, ver faintPose).
    this.scene.time.delayedCall(DRUNK.vomitMs + 260, () => sfx.thud(this.soundVol()));
    // Tres arcadas, cada una un chorrito de gotas que caen al charco.
    for (let k = 0; k < 3; k++) {
      this.scene.time.delayedCall(250 + k * (DRUNK.vomitMs / 3.2), () => {
        if (this.destroyed || this.hidden) return;
        sfx.retch(this.soundVol());
        for (let i = 0; i < 7; i++) {
          const drop = this.scene.add
            .rectangle(mouthX, mouthY, 2, 2, i % 3 ? 0xa8c040 : 0xd6d25a)
            .setDepth(depth);
          this.scene.tweens.add({
            targets: drop,
            x: mouthX + face * (3 + Math.random() * 6),
            y: Math.round(s.y) + Math.random() * 2,
            duration: 260 + Math.random() * 200,
            delay: i * 30,
            ease: "Quad.in",
            onComplete: () => drop.destroy(),
          });
        }
      });
    }
  }

  /** Cada frame: el tambaleo (desde los pies) y, mareado o más, algún "¡hic!". */
  sway(time: number) {
    if (this.destroyed) return;
    if (this.drunk === 4) return this.faintPose(time);
    if (!this.drunk) return;
    // Sentado se mueve menos (y no se sale del asiento).
    const deg = SWAY_DEG[this.drunk] * (this.seated ? 0.35 : 1);
    this.sprite.setAngle(Math.sin(time / 430 + this.swayPhase) * deg + Math.sin(time / 1150 + this.swayPhase) * deg * 0.4);
    if (this.drunk < 2 || this.hidden) return;
    if (!this.nextHicAt) this.nextHicAt = time + 3000 + Math.random() * 6000;
    if (time < this.nextHicAt) return;
    this.nextHicAt = time + (this.drunk === 3 ? 4000 : 8000) + Math.random() * 6000;
    this.hic();
  }

  /** Desmayado: agachado mientras vomita, después cae de lado y le salen "z". */
  private faintPose(time: number) {
    const t = this.faintAt ? time - this.faintAt : DRUNK.vomitMs + 1000;
    const side = this.dir === "left" || this.dir === "up" ? -1 : 1;
    if (t < DRUNK.vomitMs) {
      // Agachado hacia adelante, con arcadas.
      this.sprite.setAngle(side * (16 + Math.sin(t / 90) * 4));
      return;
    }
    // Cae en ~300 ms y queda tendido en el piso.
    const fall = Math.min(1, (t - DRUNK.vomitMs) / 300);
    this.sprite.setAngle(side * (16 + (84 - 16) * fall * fall));
    if (fall < 1 || this.hidden) return;
    if (!this.nextHicAt || this.nextHicAt < time - 10_000) this.nextHicAt = time + 600;
    if (time < this.nextHicAt) return;
    this.nextHicAt = time + 1400;
    this.floatText("z", side * 10, 6);
  }

  private hic() {
    this.floatText("¡hic!", 8, 7);
    sfx.hic(this.soundVol());
  }

  /** Logro desbloqueado: unas estrellitas doradas saltan alrededor de la cabeza y se desvanecen. */
  celebrate() {
    if (this.destroyed || this.hidden) return;
    ensureTexture(this.scene, "destello-logro", () => sparkleSprite());
    const s = worldToScreen(this.wx, this.wy);
    const depth = 5e7 + depthOf(this.wx, this.wy) + 0.3;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const count = reduced ? 2 : 6;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const x = Math.round(s.x + Math.cos(angle) * 6);
      const y = Math.round(s.y - HEAD + 6 + Math.sin(angle) * 4);
      const star = this.scene.add.image(x, y, "destello-logro").setDepth(depth).setScale(0.4);
      this.scene.tweens.add({
        targets: star,
        x: Math.round(s.x + Math.cos(angle) * 14),
        y: Math.round(s.y - HEAD + 2 + Math.sin(angle) * 9) - 6,
        scale: 1,
        alpha: { from: 1, to: 0 },
        delay: i * 60,
        duration: reduced ? 900 : 1100,
        ease: "Quad.out",
        onComplete: () => star.destroy(),
      });
    }
  }

  /** Un textito que sube y se desvanece junto a la cabeza (el hipo, las "z" del desmayo). */
  private floatText(label: string, dx: number, size: number) {
    const s = worldToScreen(this.wx, this.wy);
    const text = this.scene.add
      .text(Math.round(s.x) + dx, Math.round(s.y) - HEAD + (this.drunk === 4 ? 20 : 4), label, {
        fontFamily: cozyFontFamily(),
        fontSize: `${size}px`,
        color: COZY.paperLight,
        stroke: COZY.frame,
        strokeThickness: 2,
        resolution: 6,
      })
      .setOrigin(0.5, 1)
      .setDepth(5e7 + depthOf(this.wx, this.wy) + 0.2);
    this.scene.tweens.add({ targets: text, y: text.y - 10, x: text.x + 4, alpha: 0, duration: 1300, ease: "Sine.out", onComplete: () => text.destroy() });
  }

  // ---------- Brindis ----------

  /** La mano con una bebida que todavía tiene sorbos (en los combos, la del tinto). */
  private drinkPart(): HeldPart | undefined {
    return this.held?.parts.find((p) => consumeActionOf(p.art) === "sip" && p.pendingLeft > 0);
  }

  /** ¿Tiene una bebida en la mano? (para ofrecer el brindis). */
  get hasDrink() {
    return Boolean(this.drinkPart());
  }

  /** Dónde está el vaso para brindar, en pantalla (ahí sale el destello). */
  toastPoint(): { x: number; y: number; depth: number } | null {
    const part = this.drinkPart() ?? this.held?.parts.find((p) => p.toasting || p.busy);
    if (!part || this.hidden) return null;
    const img = part.image;
    return { x: img.x, y: img.y - img.height, depth: img.depth };
  }

  /** Mueve el vaso (arriba con `bob` negativo, de lado con `nudge`) y redibuja en cada paso. */
  private moveGlass(part: HeldPart, to: { bob?: number; nudge?: number }, ms: number, onComplete?: () => void) {
    this.scene.tweens.add({
      targets: part,
      ...to,
      duration: ms,
      ease: "Sine.out",
      onUpdate: () => {
        if (!this.destroyed) this.layout();
      },
      onComplete: () => {
        part.bob = Math.round(part.bob);
        part.nudge = Math.round(part.nudge);
        onComplete?.();
      },
    });
  }

  /** Invitó a brindar o se sumó: levanta el vaso y lo deja arriba esperando. */
  raiseToast() {
    const part = this.drinkPart();
    if (!part || part.busy || part.toasting) return;
    part.toasting = true;
    this.stopDance();
    this.moveGlass(part, { bob: -7 }, 220);
  }

  /** El brindis terminó sin mí (me alejé, se me acabó): baja el vaso si seguía arriba esperando. */
  cancelToast() {
    for (const part of this.held?.parts ?? []) if (part.toasting && !part.busy) this.lowerToast(part);
  }

  /** Baja el vaso (se venció o terminó). */
  private lowerToast(part: HeldPart, then?: () => void) {
    part.toasting = false;
    this.moveGlass(part, { bob: 0, nudge: 0 }, 220, then);
  }

  /**
   * Chocan los vasos: mira hacia el grupo, estira el vaso hacia `towardX` (-1 izquierda, 1 derecha en
   * pantalla), "¡Salud!" y después el sorbo que avisó el servidor (`index` y `left`, como en `useHeld`).
   */
  clink(face: Direction, index: number, left: number, towardX: -1 | 1) {
    if (this.destroyed) return;
    this.stopDance();
    if (!this.seated) this.setMotion(face, false);
    const part = this.held?.parts[index];
    if (!part || part.busy) return this.floatText("¡Salud!", 0, 7);
    // Ocupado mientras brinda: si era el último sorbo, el vaso no desaparece antes de tomárselo.
    part.busy = true;
    part.toasting = true;
    part.pendingLeft = Math.min(part.pendingLeft, left);
    const third = TOAST.clinkMs / 3;
    this.moveGlass(part, { bob: -8 }, third, () => {
      this.moveGlass(part, { nudge: towardX * 3 }, third / 2, () => {
        if (!this.hidden) this.floatText("¡Salud!", towardX * -4, 7);
        this.moveGlass(part, { nudge: 0 }, third / 2, () => {
          this.lowerToast(part, () => {
            if (this.destroyed) return;
            part.busy = false;
            this.useHeld(index, "sip", left);
          });
        });
      });
    });
  }

  /** Nadie respondió: levanta el vaso hacia la cámara, un chiste, y lo baja (sin tomar). */
  soloToast() {
    const part = this.drinkPart();
    if (!part || part.busy) return;
    if (!this.seated && !this.moving) this.setMotion("down", false);
    const lines = ["¡Salud… conmigo mismo!", "¿Nadie? …¡salud!", "*brinda con el aire*", "Por mí, que me lo merezco"];
    const line = lines[Math.floor(Math.random() * lines.length)]!;
    part.toasting = true;
    this.moveGlass(part, { bob: -9 }, 260, () => {
      if (!this.hidden) this.floatText(line, 0, 6);
      this.scene.time.delayedCall(900, () => {
        if (!this.destroyed && this.held?.parts.includes(part)) this.lowerToast(part);
      });
    });
  }

  // ---------- Silla giratoria ----------

  /**
   * Da `turns` vueltas en la silla (lo avisa el servidor): recorre las cuatro caras del sprite de sentado,
   * arranca despacio, va rápido y frena. Si quedó mareado, al final le salen los ojitos en espiral.
   */
  spin(turns: number, dizzy = false) {
    if (!this.seated || this.destroyed) return;
    this.stopSpin();
    this.stopDance();
    // Las caras en el sentido del reloj en pantalla: sureste, suroeste, noroeste, noreste.
    const order: Direction[] = ["right", "down", "left", "up"];
    const start = order.indexOf(this.seated);
    const state = { face: this.seated, tween: undefined as unknown as Phaser.Tweens.Tween };
    this.spinning = state;
    state.tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: spinMs(turns),
      onUpdate: (t) => {
        const q = spinProgress(turns, t.getValue() ?? 0);
        const face = order[(start + Math.floor(q * 4)) % 4]!;
        if (face === state.face || this.spinning !== state) return;
        state.face = face;
        this.sprite.setFrame(ROW[face]);
        this.applySeatCrop();
        this.layout();
      },
      onComplete: () => {
        if (this.spinning !== state) return;
        this.stopSpin();
        if (dizzy && !this.hidden) this.floatText("@_@", 0, 7);
      },
    });
  }

  private stopSpin() {
    const spinning = this.spinning;
    if (!spinning) return;
    this.spinning = undefined;
    spinning.tween.remove();
    if (this.seated) this.sprite.setFrame(ROW[this.seated]);
    this.applySeatCrop();
    this.layout();
  }

  get isSpinning() {
    return Boolean(this.spinning);
  }

  /**
   * Emote: globo con un dibujo animado que aparece de un salto, flota y se va. Algunos suman un gesto
   * del personaje (saltito, balanceo, saludar con el brazo) y "dance" lo hace bailar.
   */
  emote(id: EmoteId) {
    this.emoteBubble?.tween.remove();
    this.emoteBubble?.container.destroy();
    ensureTexture(this.scene, "globo-emote-2", () => bubble(15, 13));
    const frames = ensureEmoteTextures(this.scene, id);
    const bg = this.scene.add.image(0, 0, "globo-emote-2").setOrigin(0.5, 1);
    const icon = this.scene.add.image(0, -bg.height + 1, `emote-${id}-0`).setOrigin(0.5, 0);
    let shown = 0;
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
        const frame = frames.ms ? Math.floor((v * EMOTE.showMs) / frames.ms) % frames.count : 0;
        if (frame !== shown) icon.setTexture(`emote-${id}-${(shown = frame)}`);
        this.layout();
      },
      onComplete: () => {
        container.destroy();
        if (this.emoteBubble === state) this.emoteBubble = undefined;
      },
    });
    this.emoteBubble = state;
    const gesture = emoteInfo(id)?.gesture ?? "none";
    if (gesture === "dance") this.startDance();
    else if (gesture !== "none") this.startGesture(gesture);
    sfx.pop(this.soundVol());
    this.layout();
  }

  /** Gesto corto (ver gestures.ts): corre el sprite unos píxeles y, al saludar, levanta un brazo. */
  private startGesture(kind: EmoteGesture) {
    this.stopGesture();
    if (this.moving) return;
    const start = this.scene.time.now;
    const g: NonNullable<typeof this.gesture> = {
      kind,
      t: 0,
      timer: this.scene.time.addEvent({
        delay: 40,
        loop: true,
        callback: () => {
          g.t = this.scene.time.now - start;
          if (g.t >= EMOTE.gestureMs) return this.stopGesture();
          this.layout();
        },
      }),
    };
    if (kind === "wave") g.arm = this.scene.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setVisible(false);
    this.gesture = g;
  }

  private stopGesture() {
    if (!this.gesture) return;
    this.gesture.timer.remove();
    this.gesture.arm?.destroy();
    this.gesture = undefined;
    this.layout();
  }

  /** Brazo que saluda: se ubica en el hombro del lado que se ve y alterna dos poses. */
  private layoutArm(x: number, y: number, depth: number) {
    const g = this.gesture;
    if (!g?.arm) return;
    const face = this.seated ?? this.dir;
    const { side, dx } = WAVE_SIDE[face];
    const { key, shoulder } = armTexture(this.scene, this.textureKey, side, Math.floor(g.t / 200));
    const up = SHOULDER_UP - (this.seated ? 3 : 0);
    g.arm
      .setTexture(key)
      .setPosition(x + dx - shoulder.x, y + 1 - up - shoulder.y)
      .setDepth(depth + 0.52)
      .setVisible(!this.hidden);
  }

  /**
   * Foto: 3-2-1 en un globo sobre la cabeza (lo ven los del nivel). Se quita justo al disparar, así no
   * sale en la foto.
   */
  countdown(ms: number) {
    this.clearCountdown();
    const steps = Math.max(1, Math.round(ms / 1000));
    ensureTexture(this.scene, "globo-cuenta", () => bubble(13, 12));
    const bg = this.scene.add.image(0, 0, "globo-cuenta").setOrigin(0.5, 1);
    const text = this.scene.add
      .text(0, -bg.height / 2 - 0.5, String(steps), { fontFamily: cozyFontFamily(), fontSize: "9px", color: COZY.red, resolution: 6 })
      .setOrigin(0.5, 0.5);
    const container = this.scene.add.container(0, 0, [bg, text]).setVisible(!this.hidden);
    let left = steps;
    const pop = () => {
      this.scene.tweens.add({ targets: container, scale: { from: 1.3, to: 1 }, duration: 160, ease: "Back.out" });
      sfx.countdown(left === 1, this.soundVol());
    };
    pop();
    const timer = this.scene.time.addEvent({
      delay: ms / steps,
      repeat: steps - 1,
      callback: () => {
        left--;
        if (left <= 0) return this.clearCountdown();
        text.setText(String(left));
        pop();
      },
    });
    this.countdownBubble = { container, timer };
    this.layout();
  }

  /** Quita el globo de la cuenta (también justo antes de capturar la foto, para que no salga en ella). */
  clearCountdown() {
    this.countdownBubble?.timer.remove();
    this.countdownBubble?.container.destroy();
    this.countdownBubble = undefined;
  }

  /** El flash de la cámara (lo ven los demás; quien la saca ve la pantalla en blanco). */
  photoFlash() {
    const s = worldToScreen(this.wx, this.wy);
    const glow = this.scene.add
      .ellipse(Math.round(s.x), Math.round(s.y) - HEAD + 6, 26, 20, 0xffffff, 0.95)
      .setDepth(6e7 + depthOf(this.wx, this.wy) + 0.2)
      .setVisible(!this.hidden);
    this.scene.tweens.add({ targets: glow, alpha: 0, scale: 1.8, duration: 260, ease: "Quad.out", onComplete: () => glow.destroy() });
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
    this.spinning?.tween.remove();
    this.clearVideo();
    this.clearHeld();
    this.stopDance();
    this.stopPerform();
    this.stopGesture();
    this.emoteBubble?.tween.remove();
    this.emoteBubble?.container.destroy();
    this.clearCountdown();
    this.badgeRow?.container.destroy();
    this.bubbleTimer?.remove();
    this.bubble?.destroy();
    this.ride?.img.destroy();
    this.sprite.destroy();
    this.shadow.destroy();
    this.label.destroy();
    this.statusDot.destroy();
    this.speakingRing.destroy();
  }

  private layout() {
    const s = worldToScreen(this.wx, this.wy);
    const x = Math.round(s.x);
    const pose = this.seated ? this.seatPose : null;
    const y = Math.round(s.y) + (pose?.lift ?? 0) + (this.ride ? seatLift(RIDE_CHAIR) : 0);
    if (this.ride) {
      // La silla va debajo (o delante, de espaldas: el respaldo tapa) y rueda con el personaje.
      const a = worldToScreen(this.wx - 16, this.wy - 16);
      const d = depthOf(this.wx, this.wy);
      this.ride.img.setPosition(Math.round(a.x + this.ride.dx), Math.round(a.y + this.ride.dy)).setDepth(seatBehind(RIDE_CHAIR, this.ride.facing) ? d + 0.6 : d + 0.4);
    }
    // Sentado se ordena con el mueble (+0.5: encima de él); así un tronco largo no lo tapa.
    const depth = pose ? pose.depth : depthOf(this.wx, this.wy);
    // Bailando da saltitos de 2 px; tocando un instrumento, de 1 px.
    // Un gesto de emote corre al personaje unos píxeles (lo de las manos lo sigue).
    const g = this.gesture ? gestureOffset(this.gesture.kind, this.gesture.t) : { x: 0, lift: 0 };
    const hop = (this.dance && this.dance.step % 2 ? 2 : this.playing && this.playing.step % 2 ? 1 : 0) + g.lift;
    this.sprite.setPosition(x + g.x, y + 1 - hop).setDepth(depth + 0.5);
    this.layoutArm(x + g.x, y - hop, depth);
    this.shadow.setPosition(x, y).setDepth(depth + 0.4);
    this.speakingRing.setPosition(x, y).setDepth(depth + 0.45);
    if (this.held) {
      const face = this.spinning?.face ?? this.seated ?? this.dir;
      const hands = HANDS[face];
      const front = face === "down" || face === "right";
      // Sentado, las manos quedan 3 px más abajo (sobre las piernas) y la boca también.
      const bottom = y + 1 - hop - (this.seated ? 2 : 5);
      const mouthX = x + g.x + MOUTH[face].dx;
      const mouthY = y + 1 - hop - (this.seated ? MOUTH_SEATED : MOUTH_STANDING);
      for (const part of this.held.parts) {
        const hand = hands[part.hand];
        const img = part.image;
        // El cigarro apunta hacia afuera: en la mano izquierda se voltea (el filtro queda hacia la cara).
        const smoke = part.smoke;
        const flip = smoke && hand.dx < 0;
        img.setFlipX(flip);
        const hx = x + g.x + hand.dx;
        // En la boca: el filtro entre los labios, o el borde del vaso a la altura de la boca.
        const toHand = hand.dx - MOUTH[face].dx < 0 ? -1 : 1;
        const mx = smoke ? mouthX + (flip ? -1 : 1) * Math.floor(img.width / 2) : mouthX + toHand * Math.max(1, Math.floor(img.width / 2) - 2);
        const my = smoke ? mouthY + Math.ceil(img.height / 2) : mouthY + img.height - 1;
        const r = part.raise;
        const hd = depth + (r > 0 ? (front ? 0.56 : 0.46) : hand.front ? 0.55 : 0.47);
        img.setPosition(Math.round(hx + (mx - hx) * r) + Math.round(part.nudge), Math.round(bottom + (my - bottom) * r) + Math.round(part.bob)).setDepth(hd);
      }
    }
    // Con cámara, el nombre va sobre la burbuja de video. Los textos van por encima de todo.
    const head = HEAD - (this.seated ? 3 : 0);
    const top = this.video ? head + VIDEO_SIZE + 2 : head;
    this.video?.dom.setPosition(x, y - head + 2).setDepth(depth + 0.6);
    this.label.setPosition(x + 3, y - top).setDepth((this.hovered ? 5.5e7 : 5e7) + depth);
    this.statusDot.setPosition(x + 3 - this.label.width / 2 - 4, y - top - this.label.height / 2).setDepth(5e7 + depth + 0.1);
    // Las insignias van justo sobre el nombre; los globos, encima de ellas.
    const badgeH = this.badgeRow ? BADGE_ROW_H : 0;
    this.badgeRow?.container.setPosition(x + 3, y - top - this.label.height - 1).setDepth(5e7 + depth + 0.2);
    this.bubble?.setPosition(x, y - top - this.label.height - 1 - badgeH).setDepth(6e7 + depth);
    if (this.emoteBubble) {
      // Sobre el nombre; si hay globo de chat, encima de él.
      const chat = this.bubble ? (this.bubble.list[0] as Phaser.GameObjects.Image).height : 0;
      this.emoteBubble.container
        .setPosition(x, y - top - this.label.height - 1 - badgeH - chat - this.emoteBubble.lift)
        .setDepth(6e7 + depth + 0.1);
    }
    this.shiftOverlays();
    if (this.countdownBubble) {
      // Encima del emote y del globo de chat, si hay.
      const chat = this.bubble ? (this.bubble.list[0] as Phaser.GameObjects.Image).height : 0;
      const emote = this.emoteBubble ? 14 : 0;
      this.countdownBubble.container.setPosition(x, y - top - this.label.height - 1 - badgeH - chat - emote).setDepth(6e7 + depth + 0.15);
    }
  }
}
