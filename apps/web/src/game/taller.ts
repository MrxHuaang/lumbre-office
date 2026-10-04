// El taller del garaje en el navegador (reglas en taller.ts de @hyvento/shared): lo que se ve y se oye
// cuando alguien usa el compresor, el carro tapado, el banco o la caja de herramientas. Todo llega como
// evento de mueble (`MSG.furnitureEvent`) a los del nivel, con la misma semilla para el mensaje. El carro
// se destapa y quien lo usó queda al volante `TALLER.driveMs`; si camina, se baja (el carro sigue
// destapado hasta que se cumpla el tiempo, igual que en el servidor, y ahí vuelve la lona).
import { catalogItem, footprint, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { tallerBit, tallerCar, tallerTire, type Sprite } from "@hyvento/map/art";
import {
  CASA_FIESTA,
  furnitureKey,
  isJuegoAction,
  isTallerAction,
  juegoLine,
  TALLER,
  tallerLine,
  usableSpec,
  type Direction,
  type FurnitureEvent,
  type TallerAction,
} from "@hyvento/shared";
import * as Phaser from "phaser";
import { COZY, cozyFontFamily } from "@/lib/cozy";
import type { Avatar } from "./Avatar";
import { DEPTH_OVERLAY, depthOf, ensureTexture, worldToScreen } from "./iso/view";
import type { OfficeRoom } from "./network";
import { playCarDrive, playCompressor, playFrogRings, playPoolShot, playSanding, playToolRattle } from "./tallerSonidos";

export interface TallerHost {
  room(): OfficeRoom | undefined;
  avatarOf(sessionId: string): Avatar | undefined;
  local(): Avatar | undefined;
}

/** Cuadros de la llanta inflándose. */
const TIRE_FRAMES = 6;
/** Cuánto hay que moverse (px de mundo) para bajarse del carro. */
const LEAVE_CAR_PX = 6;

/** El dibujo del carro destapado se arma una vez (con y sin alguien al volante). */
const cars = new Map<boolean, Sprite>();
function car(driver: boolean): Sprite {
  let s = cars.get(driver);
  if (!s) cars.set(driver, (s = tallerCar(driver)));
  return s;
}

/**
 * Un carro destapado: quién va al volante, hasta cuándo (hora real, no el reloj de la escena: ese se
 * detiene con la pestaña oculta y al volver saltaría el tiempo entero) y dónde estaba parado al subirse.
 */
interface Drive {
  f: PlacedFurniture;
  sessionId: string;
  until: number;
  img: Phaser.GameObjects.Image;
  from: { x: number; y: number };
  /** Sigue al volante (al caminar se baja y el carro queda vacío). */
  seated: boolean;
}

function faceToward(f: PlacedFurniture, ts: number, x: number, y: number): Direction {
  const dx = (f.x + f.w / 2) * ts - x;
  const dy = (f.y + f.d / 2) * ts - y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

export class TallerVivo {
  private map?: OfficeMap;
  private drives = new Map<string, Drive>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: TallerHost,
  ) {}

  setArea(map: OfficeMap) {
    this.clearDrives();
    this.map = map;
  }

  unbind() {
    this.clearDrives();
  }

  destroy() {
    this.clearDrives();
  }

  /** Ayuda del carro mientras alguien va al volante. */
  label(f: PlacedFurniture): string | undefined {
    if (usableSpec(f.type)?.action !== "drive" || !this.map) return undefined;
    const d = this.drives.get(furnitureKey(this.map.id, f.type, f.x, f.y));
    if (!d || d.until <= Date.now()) return undefined;
    if (d.seated && d.sessionId === this.host.room()?.sessionId) return "Estás manejando (camina para bajarte)";
    return "Alguien acaba de manejarlo: espera un momento";
  }

  /** Alguien de tu nivel usó algo del taller (o un juego de la casa: la rana, el billar). Devuelve si lo manejó. */
  handleEvent(e: FurnitureEvent, f: PlacedFurniture, vol: number): boolean {
    const map = this.map;
    if (map && isJuegoAction(e.action)) {
      const who = this.host.avatarOf(e.sessionId);
      const face = who ? faceToward(f, map.tileSize, who.x, who.y) : "down";
      const ms = e.action === "frog" ? CASA_FIESTA.frogMs : CASA_FIESTA.poolMs;
      who?.perform(face, ms);
      if (e.action === "frog") playFrogRings(vol);
      else playPoolShot(vol);
      this.scene.time.delayedCall(ms - 300, () => who && this.floatText(who, juegoLine(e.action as "frog" | "pool", e.seed)));
      return true;
    }
    if (!map || !isTallerAction(e.action)) return false;
    const who = this.host.avatarOf(e.sessionId);
    const face = who ? faceToward(f, map.tileSize, who.x, who.y) : "down";
    const say = () => who && this.floatText(who, tallerLine(e.action as TallerAction, e.seed));
    switch (e.action) {
      case "inflate": {
        who?.perform(face, TALLER.inflateMs);
        playCompressor(vol, TALLER.inflateMs / 1000);
        this.inflate(f);
        this.scene.time.delayedCall(TALLER.inflateMs - 400, say);
        return true;
      }
      case "drive":
        playCarDrive(vol, TALLER.driveMs / 1000);
        this.drive(f, e.sessionId, who);
        this.scene.time.delayedCall(900, say);
        return true;
      case "sand": {
        who?.perform(face, TALLER.sandMs);
        playSanding(vol, TALLER.sandMs / 1000);
        const top = this.top(f, 13);
        for (let k = 0; k < 12; k++) this.scene.time.delayedCall(k * 180, () => this.dust(top.x + Phaser.Math.Between(-8, 8), top.y));
        this.scene.time.delayedCall(700, say);
        return true;
      }
      case "rattle": {
        who?.perform(face, TALLER.rattleMs);
        playToolRattle(vol);
        const top = this.top(f, 14);
        for (let k = 0; k < 3; k++) this.scene.time.delayedCall(120 + k * 160, () => this.bit(top, (e.seed + k) % 4, k));
        this.scene.time.delayedCall(400, say);
        return true;
      }
    }
    return false;
  }

  /** Cada cuadro: quien maneja y se mueve se baja; al cumplirse el tiempo vuelve la lona. */
  update() {
    const now = Date.now();
    for (const [key, d] of this.drives) {
      // Se mide con la posición del servidor: el dibujo de los demás se desliza hacia ella y llegaría tarde.
      const p = this.host.room()?.state.players.get(d.sessionId);
      const moved = !p || p.area !== this.map?.id || Math.hypot(p.x - d.from.x, p.y - d.from.y) > LEAVE_CAR_PX;
      if (d.seated && (!this.host.avatarOf(d.sessionId) || now >= d.until || moved)) this.getOut(d);
      if (now >= d.until) {
        d.img.destroy();
        this.drives.delete(key);
      }
    }
  }

  // ---------- El carro ----------

  private drive(f: PlacedFurniture, sessionId: string, who: Avatar | undefined) {
    const key = furnitureKey(this.map!.id, f.type, f.x, f.y);
    const old = this.drives.get(key);
    if (old) {
      if (old.seated) this.getOut(old);
      old.img.destroy();
    }
    const img = this.layer(f, "taller-carro-lleno", car(true));
    const d: Drive = { f, sessionId, until: Date.now() + TALLER.driveMs, img, from: this.statePos(sessionId), seated: Boolean(who) };
    this.drives.set(key, d);
    if (!who) return this.getOut(d);
    // Quien maneja se ve adentro del carro, no parado al lado (yo me veo transparente, como en el baño).
    if (who === this.host.local()) who.sprite.setAlpha(0.35);
    else who.setHidden(true);
    // Un sacudón al arrancar.
    this.scene.tweens.add({ targets: img, y: img.y - 1, duration: 70, yoyo: true, repeat: 5 });
    this.exhaust(f, d);
  }

  private statePos(sessionId: string) {
    const p = this.host.room()?.state.players.get(sessionId);
    return { x: p?.x ?? 0, y: p?.y ?? 0 };
  }

  /** Se baja: vuelve a verse parado y el carro queda vacío (destapado) hasta que se cumpla el tiempo. */
  private getOut(d: Drive) {
    d.seated = false;
    d.img.setTexture(ensureTexture(this.scene, "taller-carro-vacio", () => car(false).canvas));
    const who = this.host.avatarOf(d.sessionId);
    if (!who) return;
    if (who === this.host.local()) who.sprite.setAlpha(1);
    else {
      const p = this.host.room()?.state.players.get(d.sessionId);
      who.setHidden(p?.area !== this.map?.id);
    }
  }

  /** Humito del exhosto (atrás del carro) mientras alguien va al volante. */
  private exhaust(f: PlacedFurniture, d: Drive) {
    const ts = this.map!.tileSize;
    const [, depth] = footprint(catalogItem(f.type), f.facing);
    // El frente del carro tapado queda hacia +y en su dibujo; la cola, en la esquina de y chico.
    const tail = worldToScreen((f.x + 0.5) * ts, (f.y + (f.facing === "down" ? 0.1 : depth - 0.1)) * ts, 5);
    const puff = () => {
      if (!d.seated || !this.drives.has(furnitureKey(this.map!.id, f.type, f.x, f.y))) return;
      const r = this.scene.add.rectangle(tail.x + Phaser.Math.Between(-2, 2), tail.y, 3, 3, 0xc8c8cc, 0.7).setDepth(DEPTH_OVERLAY + 1);
      this.scene.tweens.add({ targets: r, y: tail.y - 14, x: r.x - 6, scale: 2, alpha: 0, duration: 1100, onComplete: () => r.destroy() });
      this.scene.time.delayedCall(260, puff);
    };
    this.scene.time.delayedCall(600, puff);
  }

  private clearDrives() {
    for (const d of this.drives.values()) {
      if (d.seated) this.getOut(d);
      d.img.destroy();
    }
    this.drives.clear();
  }

  // ---------- El compresor, el banco y la caja ----------

  /** La llanta se infla sobre el compresor, rebota y se desvanece. */
  private inflate(f: PlacedFurniture) {
    const p = this.top(f, 16);
    const frame = (k: number) => ensureTexture(this.scene, `taller-llanta-${k}`, () => tallerTire(k / (TIRE_FRAMES - 1)).canvas);
    const img = this.scene.add.image(p.x, p.y, frame(0)).setOrigin(0.5, 1).setDepth(DEPTH_OVERLAY + 1);
    const step = TALLER.inflateMs / (TIRE_FRAMES + 1);
    for (let k = 1; k < TIRE_FRAMES; k++) this.scene.time.delayedCall(k * step, () => img.active && img.setTexture(frame(k)));
    for (let k = 0; k < 5; k++) this.scene.time.delayedCall(k * 380, () => this.puffAt(p.x + 6, p.y - 4));
    this.scene.tweens.add({ targets: img, y: p.y - 5, delay: TALLER.inflateMs - step, duration: 180, yoyo: true, ease: "Quad.out" });
    this.scene.tweens.add({ targets: img, alpha: 0, delay: TALLER.inflateMs + 500, duration: 500, onComplete: () => img.destroy() });
  }

  /** Aserrín que salta del banco. */
  private dust(x: number, y: number) {
    const r = this.scene.add.rectangle(x, y, 1, 1, Phaser.Math.RND.pick([0xdcbb86, 0xc49c66, 0xefdc8c]), 1).setDepth(DEPTH_OVERLAY + 1);
    this.scene.tweens.add({ targets: r, y: y - Phaser.Math.Between(4, 9), x: x + Phaser.Math.Between(-4, 4), alpha: 0, duration: 700, ease: "Quad.out", onComplete: () => r.destroy() });
  }

  /** Una herramienta que salta de la caja en arco y vuelve a caer adentro. */
  private bit(p: { x: number; y: number }, kind: number, k: number) {
    const key = ensureTexture(this.scene, `taller-cosa-${kind}`, () => tallerBit(kind).canvas);
    const img = this.scene.add.image(p.x, p.y, key).setOrigin(0.5, 1).setDepth(DEPTH_OVERLAY + 1);
    const dx = (k - 1) * 6;
    this.scene.tweens.add({ targets: img, x: p.x + dx, duration: 520 });
    this.scene.tweens.add({ targets: img, y: p.y - 14 - k * 2, duration: 260, yoyo: true, ease: "Quad.out", onComplete: () => img.destroy() });
    this.scene.tweens.add({ targets: img, angle: (k - 1) * 90, duration: 520 });
  }

  private puffAt(x: number, y: number) {
    const r = this.scene.add.rectangle(x, y, 2, 2, 0xf0f0f2, 0.8).setDepth(DEPTH_OVERLAY + 2);
    this.scene.tweens.add({ targets: r, y: y - Phaser.Math.Between(6, 10), x: x + Phaser.Math.Between(2, 6), alpha: 0, duration: 700, onComplete: () => r.destroy() });
  }

  /** Punto de pantalla sobre el centro del mueble, a `z` de altura. */
  private top(f: PlacedFurniture, z: number) {
    const ts = this.map!.tileSize;
    const [w, d] = footprint(catalogItem(f.type), f.facing);
    return worldToScreen((f.x + w / 2) * ts, (f.y + d / 2) * ts, z);
  }

  /** Capa sobre el mueble: mismo lugar, volteo y profundidad que su dibujo (como las de la casa viva). */
  private layer(f: PlacedFurniture, key: string, s: Sprite) {
    const ts = this.map!.tileSize;
    const item = catalogItem(f.type);
    const flip = !item.fixed && (f.facing === "down" || f.facing === "up");
    const [w, d] = footprint(item, f.facing);
    const a = worldToScreen(f.x * ts, f.y * ts);
    ensureTexture(this.scene, key, () => s.canvas);
    return this.scene.add
      .image(a.x - (flip ? s.canvas.width - s.ox : s.ox), a.y - s.oy, key)
      .setOrigin(0, 0)
      .setFlipX(flip)
      .setDepth(depthOf((f.x + w / 2) * ts, (f.y + d / 2) * ts) + 0.01);
  }

  /** Texto chico que sube sobre la cabeza (el mismo estilo que la casa viva). */
  private floatText(who: Avatar, text: string) {
    const s = worldToScreen(who.x, who.y);
    const y = s.y - 36;
    const t = this.scene.add
      .text(s.x, y, text, { fontFamily: cozyFontFamily(), fontSize: "8px", color: COZY.paperLight, stroke: COZY.frame, strokeThickness: 2, resolution: 6 })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY + 10);
    this.scene.tweens.add({ targets: t, y: y - 12, alpha: 0, delay: 1400, duration: 1200, ease: "Sine.out", onComplete: () => t.destroy() });
  }
}
