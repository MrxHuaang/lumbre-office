// La granja (cliente): las gallinas y la cabra que mueve el servidor (se interpolan y se animan), los
// huevos en el nido, la rueda del molino que gira (más rápido con lluvia) y el sonido del arroyo, la barra
// de lo que está en el fuego sobre el horno y la parrilla con su humo, y la "E" de pedir una porción a
// quien lleva un plato. Aquí no hay reglas: las valida el servidor (apps/server/src/rooms/granja.ts y
// parrilla.ts). Lo usa usables.ts, como el jardín vivo.
import { type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import {
  coopEggs,
  cornGrain,
  drawGoat,
  drawHeldItem,
  drawHen,
  FARM_POSE_FRAMES,
  GOAT_FRAME,
  HEN_FRAME,
  MILL_WHEEL_FRAMES,
  millWheel,
  puffBall,
  type FarmArtPose,
} from "@hyvento/map/art";
import {
  grillProgress,
  grillRecipe,
  isGrillDish,
  isWet,
  MOLINO,
  PARRILLA,
  parseHeldLeft,
  portionOf,
  type FurnitureEvent,
  type PortionShared,
  type Weather,
} from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import * as Phaser from "phaser";
import { COZY, cozyFontFamily, hexToInt } from "@/lib/cozy";
import type { Avatar } from "./Avatar";
import { serverNow } from "./club/store";
import { onPortionShared } from "./granjaNet";
import { playBleat, playCluck, playGrind, playScatter, setStreamSound, stopStreamSound } from "./granjaSonidos";
import { AreaView, DEPTH_OVERLAY, depthOf, ensureTexture, worldToScreen } from "./iso/view";
import type { OfficeRoom, RemoteFarmAnimal, RemoteGrillJob } from "./network";
import { volumeAt } from "./sound";

export interface GranjaHost {
  room(): OfficeRoom | undefined;
  avatarOf(sessionId: string): Avatar | undefined;
  local(): Avatar | undefined;
}

const POSES = new Set<FarmArtPose>(["stand", "walk", "peck", "sleep"]);
/** Hasta dónde se oyen los animales y el arroyo (px de mundo). */
const HEAR_PX = 10 * 32;
const STREAM_PX = 9 * 32;
/** Cada cuánto cambia el cuadro de caminar y de picotear (ms). */
const FRAME_MS: Record<FarmArtPose, number> = { stand: 1e9, walk: 170, peck: 320, sleep: 1e9 };

interface AnimalSprite {
  id: string;
  kind: string;
  coat: string;
  img: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  x: number;
  y: number;
  tx: number;
  ty: number;
  dir: string;
  pose: FarmArtPose;
  frame: number;
  frameAt: number;
}

export class GranjaVivo {
  private map?: OfficeMap;
  private view?: AreaView;
  private animals = new Map<string, AnimalSprite>();
  private detach: (() => void)[] = [];
  private offPortion: () => void;
  // Lo del jardín que se anima.
  private wheel?: PlacedFurniture;
  private wheelPhase = 0;
  private wheelFrame = -1;
  private coop?: PlacedFurniture;
  private eggsImg?: Phaser.GameObjects.Image;
  private eggsShown = -1;
  private oven?: PlacedFurniture;
  private grill?: PlacedFurniture;
  private bridge?: PlacedFurniture;
  private bars?: Phaser.GameObjects.Graphics;
  private barLabels: Phaser.GameObjects.Text[] = [];
  private smokeIn = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: GranjaHost,
  ) {
    for (let k = 0; k < MILL_WHEEL_FRAMES; k++) ensureTexture(scene, `molino-rueda-${k}`, () => millWheel(k).canvas);
    ensureTexture(scene, "granja-maiz", () => cornGrain());
    ensureTexture(scene, "granja-harina", () => puffBall(3, "flour"));
    ensureTexture(scene, "granja-humo", () => puffBall(3, "smoke"));
    this.offPortion = onPortionShared((e) => this.portionShared(e));
  }

  // ---------- Nivel y sala ----------

  setArea(map: OfficeMap, view: AreaView) {
    this.clear();
    this.map = map;
    this.view = view;
    const find = (type: string) => map.furniture.find((f) => f.type === type);
    this.wheel = find("mill-wheel");
    this.coop = find("chicken-coop");
    this.oven = find("clay-oven");
    this.grill = find("brick-grill");
    this.bridge = find("footbridge");
    this.wheelFrame = -1;
    this.eggsShown = -1;
    if (this.oven || this.grill) this.bars = this.scene.add.graphics().setDepth(DEPTH_OVERLAY + 3);
    this.sync();
  }

  bind(room: OfficeRoom) {
    this.unbind();
    const $ = getStateCallbacks(room);
    this.detach.push(
      $(room.state).listen("granja", (g) => {
        if (!g) return;
        const g$ = $(g as never) as unknown as {
          animals: { onAdd(cb: (a: RemoteFarmAnimal) => void): () => void; onRemove(cb: () => void): () => void };
        };
        this.detach.push(
          g$.animals.onAdd((a) => {
            this.detach.push(($(a as never) as unknown as { onChange(cb: () => void): () => void }).onChange(() => this.sync()));
            this.sync();
          }),
          g$.animals.onRemove(() => this.sync()),
        );
        this.sync();
      }),
    );
  }

  unbind() {
    this.detach.forEach((d) => d());
    this.detach = [];
    this.clearAnimals();
  }

  destroy() {
    this.offPortion();
    this.unbind();
    this.clear();
    stopStreamSound();
  }

  private clearAnimals() {
    for (const s of this.animals.values()) {
      s.img.destroy();
      s.name.destroy();
    }
    this.animals.clear();
  }

  private clear() {
    this.clearAnimals();
    this.eggsImg?.destroy();
    this.eggsImg = undefined;
    this.bars?.destroy();
    this.bars = undefined;
    this.barLabels.forEach((t) => t.destroy());
    this.barLabels = [];
    this.wheel = this.coop = this.oven = this.grill = this.bridge = undefined;
  }

  // ---------- Animales ----------

  private sync() {
    const g = this.host.room()?.state.granja;
    if (!this.map || this.map.id !== "jardin" || !g) {
      this.clearAnimals();
      return;
    }
    const seen = new Set<string>();
    g.animals?.forEach((a, id) => {
      seen.add(id);
      const s = this.animals.get(id) ?? this.create(a);
      s.tx = a.x;
      s.ty = a.y;
      s.dir = a.dir;
      const pose = POSES.has(a.pose as FarmArtPose) ? (a.pose as FarmArtPose) : "stand";
      if (pose !== s.pose) {
        s.pose = pose;
        s.frame = 0;
      }
      if (s.name.text !== a.name) s.name.setText(a.name);
    });
    for (const [id, s] of this.animals)
      if (!seen.has(id)) {
        s.img.destroy();
        s.name.destroy();
        this.animals.delete(id);
      }
  }

  private texture(s: AnimalSprite) {
    const frame = s.frame % FARM_POSE_FRAMES[s.pose];
    return s.kind === "cabra"
      ? ensureTexture(this.scene, `cabra-${s.pose}-${frame}`, () => drawGoat(s.pose, frame))
      : ensureTexture(this.scene, `gallina-${s.coat}-${s.pose}-${frame}`, () => drawHen(s.coat, s.pose, frame));
  }

  private create(a: RemoteFarmAnimal): AnimalSprite {
    const F = a.kind === "cabra" ? GOAT_FRAME : HEN_FRAME;
    const img = this.scene.add.image(0, 0, "__DEFAULT").setOrigin(F.feetX / F.w, F.feetY / F.h);
    const name = this.scene.add
      .text(0, 0, a.name, { fontFamily: cozyFontFamily(), fontSize: "7px", color: COZY.ink, backgroundColor: COZY.paperLight, padding: { x: 2, y: 0 }, resolution: 6 })
      .setOrigin(0.5, 1)
      .setVisible(false);
    const s: AnimalSprite = { id: a.id, kind: a.kind, coat: a.coat, img, name, x: a.x, y: a.y, tx: a.x, ty: a.y, dir: a.dir, pose: "stand", frame: 0, frameAt: 0 };
    img.setTexture(this.texture(s));
    // Un clic: cacarea (o bala la cabra). Solo aquí: no cambia nada para los demás.
    img.setInteractive({ useHandCursor: true });
    img.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (s.kind === "cabra") playBleat(0.8);
      else playCluck(0.8);
    });
    this.animals.set(a.id, s);
    return s;
  }

  private updateAnimals(time: number, delta: number) {
    const me = this.host.local();
    const k = Math.min(1, delta / 120);
    for (const s of this.animals.values()) {
      s.x += (s.tx - s.x) * k;
      s.y += (s.ty - s.y) * k;
      if (Math.hypot(s.tx - s.x, s.ty - s.y) > 64) {
        s.x = s.tx;
        s.y = s.ty;
      }
      if (time - s.frameAt > FRAME_MS[s.pose]) {
        s.frameAt = time;
        s.frame++;
      }
      const p = worldToScreen(s.x, s.y);
      s.img.setTexture(this.texture(s)).setPosition(Math.round(p.x), Math.round(p.y)).setDepth(depthOf(s.x, s.y));
      // Los dibujos miran a la izquierda de la pantalla; "right" y "up" van al espejo.
      s.img.setFlipX(s.dir === "right" || s.dir === "up");
      const near = me && Math.hypot(me.x - s.x, me.y - s.y) < 3 * 32;
      s.name.setVisible(Boolean(near)).setPosition(Math.round(p.x), Math.round(p.y - (s.kind === "cabra" ? 18 : 13))).setDepth(DEPTH_OVERLAY + 2);
    }
  }

  // ---------- Cada cuadro ----------

  update(time: number, delta: number) {
    if (!this.map || this.map.id !== "jardin") {
      setStreamSound(0);
      return;
    }
    this.updateAnimals(time, delta);
    this.updateWheel(delta);
    this.updateEggs();
    this.updateGrill(delta);
  }

  private weather(): Weather {
    return (this.host.room()?.state.weather ?? "despejado") as Weather;
  }

  /** La rueda: gira siempre, más rápido con lluvia; el arroyo se oye al acercarse. */
  private updateWheel(delta: number) {
    const f = this.wheel;
    if (!f || !this.map) return;
    const wet = isWet(this.weather());
    const turns = wet ? MOLINO.wheelWetTurnsPerSec : MOLINO.wheelTurnsPerSec;
    // Los cuadros se repiten cada 1/8 de vuelta (8 rayos).
    this.wheelPhase = (this.wheelPhase + (delta / 1000) * turns * 8 * MILL_WHEEL_FRAMES) % MILL_WHEEL_FRAMES;
    const frame = Math.floor(this.wheelPhase);
    if (frame !== this.wheelFrame) {
      this.wheelFrame = frame;
      this.view?.imageOf(f)?.setTexture(`molino-rueda-${frame}`);
    }
    const me = this.host.local();
    if (!me) return;
    const ts = this.map.tileSize;
    const dist = (g: PlacedFurniture) => Math.hypot(Math.max(g.x * ts - me.x, 0, me.x - (g.x + g.w) * ts), Math.max(g.y * ts - me.y, 0, me.y - (g.y + g.d) * ts));
    const vol = Math.max(volumeAt(dist(f), STREAM_PX), this.bridge ? volumeAt(dist(this.bridge), STREAM_PX * 0.7) * 0.8 : 0);
    setStreamSound(vol * (wet ? 1.4 : 1));
  }

  /** Los huevos se ven en el nido mientras queden (el servidor dice cuántos). */
  private updateEggs() {
    const n = this.host.room()?.state.granja?.eggs ?? 0;
    if (n === this.eggsShown || !this.coop || !this.map) return;
    this.eggsShown = n;
    this.eggsImg?.destroy();
    this.eggsImg = undefined;
    if (n <= 0) return;
    const ts = this.map.tileSize;
    const s = coopEggs(n);
    const key = ensureTexture(this.scene, `granja-huevos-${n}`, () => s.canvas);
    const a = worldToScreen(this.coop.x * ts, this.coop.y * ts);
    this.eggsImg = this.scene.add
      .image(a.x - s.ox, a.y - s.oy, key)
      .setOrigin(0, 0)
      .setDepth(depthOf((this.coop.x + this.coop.w / 2) * ts, (this.coop.y + this.coop.d / 2) * ts) + 0.02);
  }

  /** Lo que está en el fuego: una barra por plato sobre su horno o su parrilla, con humo. */
  private updateGrill(delta: number) {
    const g = this.bars;
    const jobs = this.host.room()?.state.granja?.grill;
    if (!g || !this.map) return;
    g.clear();
    const ts = this.map.tileSize;
    const now = serverNow();
    const stack = new Map<string, number>();
    let label = 0;
    const cooking = new Set<string>();
    jobs?.forEach((job: RemoteGrillJob) => {
      const f = job.station === "horno" ? this.oven : this.grill;
      if (!f) return;
      cooking.add(job.station);
      const i = stack.get(job.station) ?? 0;
      stack.set(job.station, i + 1);
      const p = worldToScreen((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts, 56 + i * 10);
      const k = grillProgress(job, now);
      const w = 30;
      const x = Math.round(p.x - w / 2);
      const y = Math.round(p.y);
      g.fillStyle(hexToInt(COZY.frame), 1).fillRect(x - 1, y - 1, w + 2, 6);
      g.fillStyle(hexToInt(COZY.paperLight), 1).fillRect(x, y, w, 4);
      g.fillStyle(job.rate > 1 ? 0xf3a53a : 0xe8c050, 1).fillRect(x, y, Math.round(w * k), 4);
      const text = this.barLabels[label] ?? this.scene.add.text(0, 0, "", { fontFamily: cozyFontFamily(), fontSize: "6px", color: COZY.paperLight, stroke: COZY.frame, strokeThickness: 2, resolution: 6 }).setOrigin(0.5, 1).setDepth(DEPTH_OVERLAY + 3);
      this.barLabels[label++] = text;
      const dish = grillRecipe(job.recipe)?.name ?? job.recipe;
      text.setText(`${job.name}: ${dish}${job.rate > 1 ? " ×" + job.rate.toFixed(1).replace(".0", "") : ""}`).setPosition(p.x, y - 1).setVisible(true);
    });
    for (let i = label; i < this.barLabels.length; i++) this.barLabels[i]!.setVisible(false);
    // Humo por la chimenea de lo que está prendido.
    this.smokeIn -= delta;
    if (this.smokeIn > 0 || !cooking.size) return;
    this.smokeIn = 420;
    for (const station of cooking) {
      const f = station === "horno" ? this.oven : this.grill;
      if (!f) continue;
      // La chimenea del horno está atrás y la de la parrilla, en su punta.
      const at = station === "horno" ? worldToScreen((f.x + 0.8) * ts, (f.y + 0.6) * ts, 46) : worldToScreen((f.x + 0.2) * ts, (f.y + 0.3) * ts, 84);
      this.puff("granja-humo", at.x, at.y, 1800, -26, (Math.random() - 0.5) * 10);
    }
  }

  /** Una nubecita que sube y se desvanece. */
  private puff(key: string, x: number, y: number, ms: number, rise: number, drift: number) {
    const img = this.scene.add.image(x, y, key).setDepth(DEPTH_OVERLAY + 1).setAlpha(0.85);
    this.scene.tweens.add({ targets: img, y: y + rise, x: x + drift, alpha: 0, scale: 1.8, duration: ms, ease: "Sine.out", onComplete: () => img.destroy() });
  }

  // ---------- Lo que hace la gente ----------

  /** La ayuda de E para el nido y el molino (undefined = la de siempre). */
  label(f: PlacedFurniture): string | undefined {
    if (f.type === "chicken-coop") {
      const n = this.host.room()?.state.granja?.eggs ?? 0;
      return n > 0 ? `Buscar huevos (${n} en el nido)` : "El nido está vacío (ponen al amanecer)";
    }
    if (f.type === "water-mill") return isWet(this.weather()) ? "Moler maíz (con lluvia, más rápido)" : "Moler maíz";
    return undefined;
  }

  /** Alguien dio de comer, sacó huevos o puso a moler: la animación y el sonido. */
  handleEvent(e: FurnitureEvent, f: PlacedFurniture, vol: number): boolean {
    if (e.action !== "feed" && e.action !== "eggs" && e.action !== "grind") return false;
    const ts = this.map?.tileSize ?? 32;
    const who = this.host.avatarOf(e.sessionId);
    if (who) who.perform(faceToward(f, ts, who.x, who.y), 900);
    const heard = Math.max(vol, 0.3);
    if (e.action === "feed") {
      playScatter(heard);
      this.scene.time.delayedCall(300, () => playCluck(heard));
      this.scene.time.delayedCall(900, () => playBleat(heard * 0.8));
      // El maíz que vuela del puño al comedero.
      const c = worldToScreen((f.x + 0.5) * ts, (f.y + 0.5) * ts, 6);
      for (let i = 0; i < 14; i++) {
        const img = this.scene.add.image(c.x, c.y - 10, "granja-maiz").setDepth(DEPTH_OVERLAY + 1);
        const dx = (Math.random() - 0.5) * 28;
        const dy = Math.random() * 10;
        this.scene.tweens.add({ targets: img, x: c.x + dx, y: c.y + dy, duration: 380 + Math.random() * 200, ease: "Quad.in", delay: i * 20 });
        this.scene.tweens.add({ targets: img, alpha: 0, delay: 1600 + Math.random() * 600, duration: 500, onComplete: () => img.destroy() });
      }
    } else if (e.action === "eggs") {
      playCluck(heard);
    } else {
      const ms = Math.min(8000, Math.max(500, e.seed || MOLINO.grindMs));
      playGrind(heard, ms);
      const ev = this.scene.time.addEvent({
        delay: 260,
        repeat: Math.floor(ms / 260),
        callback: () => {
          const p = worldToScreen((f.x + f.w + 0.2) * ts, (f.y + f.d / 2 + (Math.random() - 0.5)) * ts, 10 + Math.random() * 8);
          this.puff("granja-harina", p.x, p.y, 900, -10, (Math.random() - 0.5) * 12);
        },
      });
      this.scene.time.delayedCall(ms + 300, () => ev.remove());
    }
    return true;
  }

  /**
   * La "E" de pedir una porción: alguien de mi nivel, de cerca, con un plato de la parrilla en la mano al
   * que le queda más de una porción (y yo no soy esa persona).
   */
  portionNear(): { sessionId: string; label: string; dist: number } | null {
    const room = this.host.room();
    const me = this.host.local();
    if (!room || !me || !this.map) return null;
    const mine = room.state.players.get(room.sessionId);
    let best: { sessionId: string; label: string; dist: number } | null = null;
    room.state.players.forEach((p, sessionId) => {
      if (sessionId === room.sessionId || p.area !== mine?.area || !isGrillDish(p.held)) return;
      if ((parseHeldLeft(p.heldLeft)[0] ?? 0) < 2) return;
      const dist = Math.hypot(p.x - me.x, p.y - me.y);
      if (dist > PARRILLA.shareReachTiles * this.map!.tileSize || (best && best.dist <= dist)) return;
      const dish = grillRecipe(p.held)?.name ?? "su plato";
      best = { sessionId, dist, label: `Pedir una porción de ${dish.charAt(0).toLowerCase()}${dish.slice(1)} a ${p.name}` };
    });
    return best;
  }

  /** Alguien le dio una porción a otro: el pedacito vuela de una mano a la otra. */
  private portionShared(e: PortionShared) {
    const from = this.host.avatarOf(e.from);
    const to = this.host.avatarOf(e.to);
    if (!from || !to) return;
    const art = drawHeldItem(portionOf(e.dish));
    const key = ensureTexture(this.scene, `porcion-${e.dish}`, () => art);
    const a = worldToScreen(from.x, from.y, 18);
    const b = worldToScreen(to.x, to.y, 18);
    const img = this.scene.add.image(a.x, a.y, key).setDepth(DEPTH_OVERLAY + 4);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 520,
      ease: "Sine.inOut",
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        img.setPosition(a.x + (b.x - a.x) * v, a.y + (b.y - a.y) * v - Math.sin(v * Math.PI) * 14);
      },
      onComplete: () => img.destroy(),
    });
  }
}

function faceToward(f: PlacedFurniture, ts: number, x: number, y: number) {
  const dx = (f.x + f.w / 2) * ts - x;
  const dy = (f.y + f.d / 2) * ts - y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}
