// Casa viva (cliente): las mascotas. El servidor las mueve (posición, dirección y pose viajan en el
// estado); aquí se dibujan, se interpolan y se animan. Clic en una mascota lejos: se la llama ("ven");
// de cerca: un menú chico para acariciarla, darle croquetas o lo que se tiene en la mano, adoptarla o
// dejarla volver a la casa (E la acaricia). Los clics en la mascota y en el menú no llegan a la escena
// (no se camina hacia allá).
import { bubble, drawHeldItem, drawPet, heartSmall, PET_FRAME, PET_POSE_FRAMES, petBowl, sleepZ, type PetArtKind, type PetArtPose } from "@hyvento/map/art";
import { FREE_NAMES, menuItem, parseHeldLeft, PET, PET_BOND, petFoodIn, type Direction, type PetAction, type PetEvent } from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import * as Phaser from "phaser";
import { COZY, cozyFontFamily, hexToInt } from "@/lib/cozy";
import type { Avatar } from "./Avatar";
import { playMeow, playMunch, playWoof } from "./casaSonidos";
import { DEPTH_OVERLAY, depthOf, ensureTexture, worldToScreen } from "./iso/view";
import { onPetEvent, sendPetAction, sendPetCall, type OfficeRoom, type RemotePet } from "./network";
import { playPurr, volumeAt } from "./sound";
import { selectMyUserId, useOfficeStore } from "./store";

/** Hasta dónde se oyen (px de mundo). */
const HEAR_PX = 10 * 32;
/** Se muestra el nombre de cerca (tiles). */
const NAME_TILES = 3.5;
const POSES = new Set<PetArtPose>(["stand", "walk", "sit", "sleep", "eat"]);

interface PetSprite {
  id: string;
  kind: PetArtKind;
  coat: string;
  img: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  x: number;
  y: number;
  tx: number;
  ty: number;
  dir: Direction;
  pose: PetArtPose;
  frame: number;
  frameAt: number;
  zAt: number;
  hover: boolean;
  /** Dueño (User.id y nombre; "" = de la casa) y cariño. */
  ownerId: string;
  ownerName: string;
  love: number;
  /** El globito "!" (la llamaron): sigue a la mascota mientras viene. */
  bang?: Phaser.GameObjects.Container;
}

export class Mascotas {
  private area = "";
  private room?: OfficeRoom;
  private sprites = new Map<string, PetSprite>();
  private detach: (() => void)[] = [];
  private offEvent: () => void;
  private menu?: { pet: string; container: Phaser.GameObjects.Container; until: number };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly local: () => Avatar | undefined,
  ) {
    this.offEvent = onPetEvent((e) => this.handleEvent(e));
  }

  /** Modo privado de una sala (px de mundo): las mascotas de afuera no se ven (asomarían por el muro alto). */
  private veil: { x: number; y: number; w: number; h: number } | null = null;
  setVeil(rect: { x: number; y: number; w: number; h: number } | null) {
    this.veil = rect;
  }
  private veiled(s: { x: number; y: number }) {
    const v = this.veil;
    return Boolean(v && (s.x < v.x || s.x >= v.x + v.w || s.y < v.y || s.y >= v.y + v.h));
  }

  setArea(areaId: string) {
    this.area = areaId;
    this.closeMenu();
    this.sync();
  }

  bind(room: OfficeRoom) {
    this.unbind();
    this.room = room;
    const $ = getStateCallbacks(room);
    this.detach.push(
      $(room.state).listen("pets", (pets) => {
        if (!pets) return;
        const p$ = $(pets as never) as unknown as {
          onAdd(cb: (pet: RemotePet) => void): () => void;
          onRemove(cb: () => void): () => void;
        };
        this.detach.push(
          p$.onAdd((pet) => {
            // Cada cambio de la mascota (se movió, se durmió) actualiza su sprite.
            this.detach.push(($(pet as never) as unknown as { onChange(cb: () => void): () => void }).onChange(() => this.sync()));
            this.sync();
          }),
          p$.onRemove(() => this.sync()),
        );
        this.sync();
      }),
    );
  }

  unbind() {
    this.detach.forEach((d) => d());
    this.detach = [];
    this.room = undefined;
    this.clear();
  }

  destroy() {
    this.offEvent();
    this.unbind();
  }

  private clear() {
    this.closeMenu();
    for (const s of this.sprites.values()) {
      s.img.destroy();
      s.name.destroy();
      s.bang?.destroy();
    }
    this.sprites.clear();
  }

  /** Crea, mueve o quita los sprites según el estado (solo las mascotas de mi nivel). */
  private sync() {
    const pets = this.room?.state.pets;
    const seen = new Set<string>();
    pets?.forEach((p, id) => {
      if (p.area !== this.area) return;
      seen.add(id);
      let s = this.sprites.get(id);
      if (!s) s = this.create(p);
      s.tx = p.x;
      s.ty = p.y;
      if (s.ownerId !== (p.ownerId ?? "") || s.ownerName !== (p.ownerName ?? "")) {
        s.ownerId = p.ownerId ?? "";
        s.ownerName = p.ownerName ?? "";
        s.name.setText(this.tagOf(p.name, s.ownerName));
      }
      s.love = p.love ?? 0;
      s.dir = (["down", "left", "right", "up"].includes(p.dir) ? p.dir : "down") as Direction;
      const pose = POSES.has(p.pose as PetArtPose) ? (p.pose as PetArtPose) : "stand";
      if (pose !== s.pose) {
        s.pose = pose;
        s.frame = 0;
      }
    });
    for (const [id, s] of this.sprites)
      if (!seen.has(id)) {
        s.img.destroy();
        s.name.destroy();
        s.bang?.destroy();
        this.sprites.delete(id);
        if (this.menu?.pet === id) this.closeMenu();
      }
  }

  private texture(s: PetSprite) {
    const view = s.pose === "sleep" ? "front" : s.dir === "left" || s.dir === "up" ? "back" : "front";
    const frame = s.frame % PET_POSE_FRAMES[s.pose];
    return ensureTexture(this.scene, `mascota-${s.kind}-${s.coat}-${s.pose}-${view}-${frame}`, () => drawPet(s.kind, s.coat, s.pose, view, frame));
  }

  private create(p: RemotePet): PetSprite {
    const kind: PetArtKind = p.kind === "perro" ? "perro" : "gato";
    const img = this.scene.add.image(0, 0, "__DEFAULT").setOrigin(PET_FRAME.feetX / PET_FRAME.w, PET_FRAME.feetY / PET_FRAME.h);
    const name = this.scene.add
      .text(0, 0, this.tagOf(p.name, p.ownerName ?? ""), { fontFamily: cozyFontFamily(), fontSize: "7px", color: COZY.ink, backgroundColor: COZY.paperLight, padding: { x: 2, y: 0 }, resolution: 6 })
      .setOrigin(0.5, 1)
      .setVisible(false);
    const s: PetSprite = { id: p.id, kind, coat: p.coat, img, name, x: p.x, y: p.y, tx: p.x, ty: p.y, dir: "down", pose: "sleep", frame: 0, frameAt: 0, zAt: 0, hover: false, ownerId: p.ownerId ?? "", ownerName: p.ownerName ?? "", love: p.love ?? 0 };
    img.setTexture(this.texture(s));
    img.setInteractive({ useHandCursor: true });
    img.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.clicked(s);
    });
    img.on("pointerover", () => (s.hover = true));
    img.on("pointerout", () => (s.hover = false));
    this.sprites.set(p.id, s);
    this.place(s);
    return s;
  }

  /** El cartelito: el nombre y, si tiene dueño, de quién es. */
  private tagOf(name: string, owner: string) {
    return owner ? `${name} · de ${owner}` : name;
  }

  /** La más cercana al alcance (la que acaricia la E), si se ve. */
  nearest(x: number, y: number): { id: string; name: string; dist: number } | null {
    let best: { id: string; name: string; dist: number } | null = null;
    for (const s of this.sprites.values()) {
      if (this.veiled(s)) continue;
      const dist = Math.hypot(x - s.x, y - s.y);
      if (dist <= PET.reachTiles * 32 && (!best || dist < best.dist)) best = { id: s.id, name: this.petName(s), dist };
    }
    return best;
  }

  private petName(s: PetSprite) {
    return this.room?.state.pets.get(s.id)?.name ?? "";
  }

  private near(s: PetSprite, tiles: number) {
    const me = this.local();
    return Boolean(me && Math.hypot(me.x - s.x, me.y - s.y) <= tiles * 32);
  }

  /** Clic: de lejos se la llama; de cerca se abre (o cierra) el menú. */
  private clicked(s: PetSprite) {
    if (this.near(s, PET.reachTiles)) {
      if (this.menu?.pet === s.id) this.closeMenu();
      else this.openMenu(s);
      return;
    }
    if (this.near(s, PET.callTiles)) sendPetCall(s.id);
  }

  /** Lo que tengo en la mano para darle (el nombre de la comida), o null. */
  private myFood(): string | null {
    const st = useOfficeStore.getState();
    const me = st.sessionId ? st.players[st.sessionId] : undefined;
    if (!me?.held) return null;
    const food = petFoodIn(me.held, parseHeldLeft(me.heldLeft));
    if (!food) return null;
    return menuItem(food.art)?.name ?? FREE_NAMES[food.art] ?? menuItem(me.held)?.name ?? "lo que tienes";
  }

  private openMenu(s: PetSprite) {
    this.closeMenu();
    const st = useOfficeStore.getState();
    const myId = selectMyUserId(st);
    const iHaveOne = [...(this.room?.state.pets.values() ?? [])].some((p) => p.ownerId && p.ownerId === myId);
    const food = this.myFood();
    const options: { label: string; action: PetAction }[] = [
      { label: "Acariciar", action: "pet" },
      { label: "Darle croquetas", action: "treat" },
      ...(food ? [{ label: `Darle ${food.toLowerCase()}`, action: "feed" as const }] : []),
      ...(!s.ownerId && !iHaveOne ? [{ label: "Adoptar", action: "adopt" as const }] : []),
      ...(s.ownerId && s.ownerId === myId ? [{ label: "Dejar que vuelva a casa", action: "release" as const }] : []),
    ];
    const button = (label: string, action: PetAction, y: number) => {
      const t = this.scene.add
        .text(0, y, label, {
          fontFamily: cozyFontFamily(),
          fontSize: "8px",
          color: COZY.ink,
          backgroundColor: COZY.paperLight,
          padding: { x: 4, y: 1 },
          resolution: 6,
        })
        .setOrigin(0.5, 1);
      const frame = this.scene.add.rectangle(0, y, t.width + 2, t.height + 2).setOrigin(0.5, 1).setStrokeStyle(1, hexToInt(COZY.frame));
      frame.setY(y + 1);
      t.setInteractive({ useHandCursor: true });
      t.on("pointerover", () => t.setBackgroundColor(COZY.paperDark));
      t.on("pointerout", () => t.setBackgroundColor(COZY.paperLight));
      t.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        sendPetAction(s.id, action);
        this.closeMenu();
      });
      return [frame, t];
    };
    // El cariño arriba (no es un botón), y los botones de abajo hacia arriba.
    const love = this.scene.add
      .text(0, -12 * options.length, `Cariño ${Math.round(s.love)}/${PET_BOND.max}`, {
        fontFamily: cozyFontFamily(),
        fontSize: "7px",
        color: COZY.red,
        backgroundColor: COZY.paperLight,
        padding: { x: 3, y: 0 },
        resolution: 6,
      })
      .setOrigin(0.5, 1);
    const container = this.scene.add
      .container(0, 0, [love, ...options.flatMap((o, i) => button(o.label, o.action, -12 * (options.length - 1 - i)))])
      .setDepth(DEPTH_OVERLAY + 20);
    this.menu = { pet: s.id, container, until: this.scene.time.now + 6000 };
    this.placeMenu();
  }

  private closeMenu() {
    this.menu?.container.destroy();
    this.menu = undefined;
  }

  private placeMenu() {
    const m = this.menu;
    const s = m && this.sprites.get(m.pet);
    if (!m || !s) return;
    const p = worldToScreen(s.x, s.y);
    m.container.setPosition(Math.round(p.x), Math.round(p.y - 22));
  }

  private place(s: PetSprite) {
    const p = worldToScreen(s.x, s.y);
    s.img
      .setPosition(Math.round(p.x), Math.round(p.y))
      .setFlipX(s.dir === "right" || s.dir === "up")
      .setDepth(depthOf(s.x, s.y) + 0.5);
    s.name.setPosition(Math.round(p.x), Math.round(p.y - (s.pose === "sleep" ? 10 : 17))).setDepth(5e7 + depthOf(s.x, s.y));
    s.bang?.setPosition(Math.round(p.x + 9), Math.round(p.y - 14));
  }

  update(delta: number) {
    const now = this.scene.time.now;
    for (const s of this.sprites.values()) {
      // Se acerca a la posición del servidor (se mueve a paso lento: la interpolación la suaviza).
      const dx = s.tx - s.x;
      const dy = s.ty - s.y;
      if (dx * dx + dy * dy > 96 * 96) {
        s.x = s.tx;
        s.y = s.ty;
      } else {
        const t = Math.min(1, (delta / 1000) * 8);
        s.x += dx * t;
        s.y += dy * t;
      }
      const every = s.pose === "walk" ? 220 : s.pose === "sleep" ? 900 : s.pose === "eat" ? 260 : 0;
      if (every && now - s.frameAt >= every) {
        s.frameAt = now;
        s.frame++;
      }
      s.img.setTexture(this.texture(s));
      this.place(s);
      const hidden = this.veiled(s);
      s.img.setAlpha(hidden ? 0 : 1);
      s.name.setVisible(!hidden && (s.hover || this.near(s, NAME_TILES)));
      // Durmiendo: sale una "z" cada tanto.
      if (!hidden && s.pose === "sleep" && now - s.zAt > 1600) {
        s.zAt = now;
        this.floatZ(s);
      }
    }
    if (this.menu) {
      const s = this.sprites.get(this.menu.pet);
      if (!s || now > this.menu.until || !this.near(s, PET.reachTiles + 1)) this.closeMenu();
      else this.placeMenu();
    }
  }

  private floatZ(s: PetSprite) {
    const key = ensureTexture(this.scene, "mascota-z", () => sleepZ());
    const p = worldToScreen(s.x, s.y);
    const x0 = p.x - 4;
    const y0 = p.y - 9;
    const img = this.scene.add.image(x0, y0, key).setDepth(DEPTH_OVERLAY + 2).setAlpha(0).setScale(0.6);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1800,
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        img.setPosition(Math.round(x0 - v * 6 + Math.sin(v * 7) * 1.5), Math.round(y0 - v * 14));
        img.setScale(0.6 + v * 0.5);
        img.setAlpha(v < 0.15 ? v / 0.15 : 1 - (v - 0.15) / 0.85);
      },
      onComplete: () => img.destroy(),
    });
  }

  // ---------- Eventos ----------

  private volumeFor(s: PetSprite) {
    const me = this.local();
    return me ? volumeAt(Math.hypot(me.x - s.x, me.y - s.y), HEAR_PX) : 0;
  }

  private handleEvent(e: PetEvent) {
    const s = this.sprites.get(e.pet);
    if (!s) return;
    const vol = this.volumeFor(s);
    const cat = s.kind === "gato";
    if (e.action === "call") {
      this.exclaim(s);
      if (cat) playMeow(vol);
      else playWoof(vol);
    } else if (e.action === "pet") {
      this.heart(s, 0);
      this.heart(s, 350);
      if (cat) playPurr(vol);
      else playWoof(vol * 0.7, true);
    } else if (e.action === "adopt" || e.action === "release") {
      // Contenta (adoptada) o de vuelta a la casa: corazones y su sonido.
      this.heart(s, 0);
      this.heart(s, 250);
      if (e.action === "adopt") this.heart(s, 500);
      if (cat) playMeow(vol, true);
      else playWoof(vol * 0.8, true);
    } else {
      this.treat(s, e.action === "feed" ? e.food : undefined);
      playMunch(vol);
      this.scene.time.delayedCall(PET.eatMs, () => {
        this.heart(s, 0);
        if (cat) playMeow(vol, true);
        else playWoof(vol * 0.8, true);
      });
    }
  }

  /** Corazón que sale de la mascota, da un saltito y sube. */
  private heart(s: PetSprite, delay: number) {
    const key = ensureTexture(this.scene, "corazon-gato", () => heartSmall());
    this.scene.time.delayedCall(delay, () => {
      if (!this.sprites.has(s.id)) return;
      const p = worldToScreen(s.x, s.y);
      const x = p.x + (delay ? 4 : -2);
      const y = p.y - 16;
      const img = this.scene.add.image(x, y, key).setDepth(DEPTH_OVERLAY + 2).setScale(0.4);
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 1400,
        onUpdate: (t) => {
          const v = t.getValue() ?? 0;
          img.setScale(v < 0.1 ? 0.4 + v * 7 : v < 0.18 ? 1.1 - (v - 0.1) * 1.25 : 1);
          img.setPosition(x, Math.round(y - v * 16));
          img.setAlpha(v > 0.7 ? 1 - (v - 0.7) / 0.3 : 1);
        },
        onComplete: () => img.destroy(),
      });
    });
  }

  /** Lo que come frente a la boca (las croquetas en su plato o la comida que le dieron), achicándose. */
  private treat(s: PetSprite, food?: string) {
    const key = food
      ? ensureTexture(this.scene, `mascota-comida-${food}`, () => drawHeldItem(food))
      : ensureTexture(this.scene, "mascota-croquetas", () => petBowl());
    const p = worldToScreen(s.x, s.y);
    const side = s.dir === "right" || s.dir === "up" ? 1 : -1;
    const img = this.scene.add
      .image(Math.round(p.x + side * 8), Math.round(p.y - 1), key)
      .setOrigin(0.5, 1)
      .setFlipX(side > 0)
      .setDepth(depthOf(s.x, s.y) + 0.6);
    this.scene.tweens.add({ targets: img, scaleX: 0.2, scaleY: 0.2, alpha: 0.4, delay: 300, duration: PET.eatMs - 300, ease: "Stepped", easeParams: [5], onComplete: () => img.destroy() });
  }

  /** Globito con "!" sobre la mascota (la llamaron: viene). */
  private exclaim(s: PetSprite) {
    const bg = ensureTexture(this.scene, "globo-mascota", () => bubble(9, 10));
    const p = worldToScreen(s.x, s.y);
    const back = this.scene.add.image(0, 0, bg).setOrigin(0.5, 1);
    const mark = this.scene.add
      .text(0, -back.height + 7, "!", { fontFamily: cozyFontFamily(), fontSize: "9px", color: COZY.red, resolution: 6 })
      .setOrigin(0.5, 0.5);
    s.bang?.destroy();
    const c = this.scene.add.container(Math.round(p.x + 9), Math.round(p.y - 14), [back, mark]).setDepth(6e7 + 3).setScale(0.3);
    s.bang = c;
    this.scene.tweens.add({ targets: c, scale: 1, duration: 140, ease: "Back.out" });
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      delay: 1600,
      duration: 400,
      onComplete: () => {
        c.destroy();
        if (s.bang === c) s.bang = undefined;
      },
    });
  }
}
