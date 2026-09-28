// Jardín vivo (cliente): lo que crece en cada parcela del huerto (según `OfficeState.garden` y el reloj
// del servidor), la tierra mojada, la ayuda de E según lo que llevas en la mano, las abejas del apiario
// (de día y sin lluvia; alborotadas al sacar miel), la campanita de la glorieta y su techo, que se
// transparenta cuando hay alguien adentro. Lo usa usables.ts: aquí no hay reglas, solo dibujo y sonido
// (las reglas las valida el servidor, ver apps/server/src/rooms/huerto.ts).
import { catalogItem, pointsOfType, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { BEE_FRAMES, bedCropSprite, cropSprite, drawBee, drawHeldItem, musicNote, NOTE_COLORS, sparkleSprite, waterDrop, wetSoil, type CropStage } from "@hyvento/map/art";
import {
  EMPTY_CAN,
  FREE_NAMES,
  GREENHOUSE_PLOT_BASE,
  isGreenhousePlot,
  WATERING_CAN,
  canHarvest,
  canWater,
  cropById,
  cropOfSeeds,
  durationText,
  plotReadyAt,
  plotStage,
  plotWet,
  type Direction,
  type FurnitureEvent,
  type PlotState,
} from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import * as Phaser from "phaser";
import { COZY, cozyFontFamily } from "@/lib/cozy";
import type { Avatar } from "./Avatar";
import { serverNow } from "./club/store";
import { playGot, playWater } from "./casaSonidos";
import { playBell, playBuzz, playDig, playFill, playPluck } from "./huertoSonidos";
import { DEPTH_FLAT, DEPTH_OVERLAY, depthOf, ensureTexture, worldToScreen } from "./iso/view";
import type { OfficeRoom, RemoteGardenPlot } from "./network";
import { useOfficeStore } from "./store";

export interface JardinHost {
  room(): OfficeRoom | undefined;
  avatarOf(sessionId: string): Avatar | undefined;
  local(): Avatar | undefined;
}

interface Plot {
  id: number;
  f: PlacedFurniture;
  crop?: Phaser.GameObjects.Image;
  wet?: Phaser.GameObjects.Image;
  /** Lo que está dibujado ahora (para no rearmar en cada vuelta). */
  shown: string;
}

interface Bee {
  img: Phaser.GameObjects.Image;
  hive: PlacedFurniture;
  phase: number;
  speed: number;
  radius: number;
  /** Visitando una flor: dónde y hasta cuándo (ms de la escena). */
  flower?: { x: number; y: number; until: number; leaveAt: number };
  nextTrip: number;
  x: number;
  y: number;
  z: number;
}

/** Abejas por colmena (y cuántas más salen al alborotarse). */
const BEES_PER_HIVE = 4;
const SWARM_BEES = 10;
const SWARM_MS = 3200;
/** Cada cuánto se recalcula lo que crece (ms). */
const GROW_CHECK_MS = 1000;
/** Transparencia del techo de la glorieta con alguien adentro. */
const ROOF_SEE_THROUGH = 0.35;
const FLOWER_TYPES = new Set(["wildflowers", "flower-patch", "bush-rose", "bush-hydrangea"]);

function faceToward(f: PlacedFurniture, ts: number, x: number, y: number): Direction {
  const dx = (f.x + f.w / 2) * ts - x;
  const dy = (f.y + f.d / 2) * ts - y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

const toPlot = (p: RemoteGardenPlot): PlotState => ({
  crop: p.crop,
  plantedBy: p.plantedBy,
  plantedByName: p.plantedByName,
  plantedAt: p.plantedAt,
  growthMs: p.growthMs,
  growthAt: p.growthAt,
  wateredUntil: p.wateredUntil,
});

export class JardinVivo {
  private map?: OfficeMap;
  private plots: Plot[] = [];
  private plotAt = new Map<string, Plot>();
  private bees: Bee[] = [];
  private flowers: { x: number; y: number }[] = [];
  private swarmUntil = new Map<PlacedFurniture, number>();
  /** Lo que se transparenta con alguien adentro (el techo de la glorieta, el vidrio del invernadero). */
  private roofs: { f: PlacedFurniture; img?: Phaser.GameObjects.Image }[] = [];
  private growIn = 0;
  private detach: (() => void)[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: JardinHost,
  ) {
    for (const f of BEE_FRAMES) ensureTexture(scene, `abeja-${f}`, () => drawBee(f));
  }

  // ---------- Nivel y sala ----------

  setArea(map: OfficeMap) {
    this.clear();
    this.map = map;
    const ts = map.tileSize;
    // Las parcelas del huerto (ids 0..) y los bancales del invernadero (desde GREENHOUSE_PLOT_BASE).
    for (const [point, type, base] of [
      ["garden_plot", "garden-plot", 0],
      ["greenhouse_plot", "greenhouse-bed", GREENHOUSE_PLOT_BASE],
    ] as const)
      pointsOfType(map, point).forEach((p, i) => {
        const f = map.furniture.find((g) => g.type === type && g.x === p.tileX && g.y === p.tileY);
        if (!f) return;
        const plot: Plot = { id: base + i, f, shown: "" };
        this.plots.push(plot);
        this.plotAt.set(`${f.x},${f.y}`, plot);
      });
    this.roofs = map.furniture.filter((f) => catalogItem(f.type).seeThrough).map((f) => ({ f }));
    const hives = map.furniture.filter((f) => f.type === "beehive");
    if (hives.length) {
      for (const f of map.furniture) {
        if (!FLOWER_TYPES.has(f.type)) continue;
        if (!hives.some((h) => Math.hypot(h.x - f.x, h.y - f.y) < 7)) continue;
        this.flowers.push({ x: (f.x + 0.5) * ts, y: (f.y + 0.5) * ts });
      }
      for (const hive of hives) for (let k = 0; k < BEES_PER_HIVE; k++) this.addBee(hive, false);
    }
    this.refreshPlots();
  }

  bind(room: OfficeRoom) {
    this.unbind();
    const $ = getStateCallbacks(room);
    const again = () => this.refreshPlots();
    this.detach.push(
      $(room.state).listen("garden", (m) => {
        if (!m) return;
        const m$ = $(m as never) as unknown as { onAdd(cb: (p: RemoteGardenPlot) => void): () => void; onRemove(cb: () => void): () => void };
        this.detach.push(
          m$.onAdd((p) => {
            // Regar cambia los campos de la misma parcela.
            this.detach.push(($(p as never) as unknown as { onChange(cb: () => void): () => void }).onChange(again));
            again();
          }),
          m$.onRemove(again),
        );
        again();
      }),
    );
  }

  unbind() {
    this.detach.forEach((d) => d());
    this.detach = [];
  }

  destroy() {
    this.unbind();
    this.clear();
  }

  private clear() {
    for (const p of this.plots) {
      p.crop?.destroy();
      p.wet?.destroy();
    }
    for (const b of this.bees) b.img.destroy();
    this.plots = [];
    this.plotAt.clear();
    this.bees = [];
    this.flowers = [];
    this.swarmUntil.clear();
    this.roofs = [];
  }

  private stateOf(id: number): PlotState | undefined {
    const p = this.host.room()?.state.garden?.get(String(id));
    return p?.crop ? toPlot(p) : undefined;
  }

  // ---------- Parcelas ----------

  /** Imagen encima de una parcela, en su lugar (como el dibujo del mueble). */
  private layer(f: PlacedFurniture, key: string, make: () => ReturnType<typeof cropSprite>, depth: number) {
    const ts = this.map!.tileSize;
    const s = make();
    ensureTexture(this.scene, key, () => s.canvas);
    const a = worldToScreen(f.x * ts, f.y * ts);
    return this.scene.add.image(a.x - s.ox, a.y - s.oy, key).setOrigin(0, 0).setDepth(depth);
  }

  private refreshPlots() {
    if (!this.map) return;
    const now = serverNow();
    const ts = this.map.tileSize;
    for (const p of this.plots) {
      const st = this.stateOf(p.id);
      const stage = st ? plotStage(st, now) : -1;
      const wet = st ? plotWet(st, now) : false;
      const shown = st ? `${st.crop}:${stage}:${wet ? 1 : 0}` : "";
      if (shown === p.shown) continue;
      p.shown = shown;
      p.crop?.destroy();
      p.wet?.destroy();
      p.crop = p.wet = undefined;
      if (!st) continue;
      // La tierra mojada va sobre la parcela (plana) y las matas se ordenan con su centro.
      if (wet) p.wet = this.layer(p.f, "huerto-mojada", wetSoil, DEPTH_FLAT + 1);
      const bed = isGreenhousePlot(p.id);
      const draw = () => (bed ? bedCropSprite : cropSprite)(st.crop, stage as CropStage);
      p.crop = this.layer(p.f, `${bed ? "bancal" : "huerto"}-${st.crop}-${stage}`, draw, depthOf((p.f.x + 0.5) * ts, (p.f.y + 0.5) * ts) + 0.01);
    }
  }

  /** Lo que tengo en la mano y mi userId. */
  private mine() {
    const room = this.host.room();
    const p = room?.state.players.get(room.sessionId);
    return { held: p?.held ?? "", userId: p?.userId ?? "" };
  }

  /** La ayuda de E para lo del huerto (undefined = la de siempre). */
  label(f: PlacedFurniture): string | undefined {
    const { held, userId } = this.mine();
    const can = held === WATERING_CAN;
    if (f.type === "water-barrel" || f.type === "well") {
      if (can || held === EMPTY_CAN) return "Llenar la regadera";
      return f.type === "well" ? "Pozo (elige la regadera en la barra)" : "Barril de agua (elige la regadera en la barra)";
    }
    if (f.type === "beehive") return "Sacar miel";
    if (f.type !== "garden-plot" && f.type !== "greenhouse-bed") return undefined;
    const plot = this.plotAt.get(`${f.x},${f.y}`);
    if (!plot) return undefined;
    // A los bancales se llega desde adentro (el servidor tampoco deja a través del vidrio).
    const me = this.host.local();
    if (isGreenhousePlot(plot.id) && me && !this.insideGreenhouse(me.x, me.y)) return "Entra al invernadero por la puerta";
    const st = this.stateOf(plot.id);
    if (!st) {
      const seeds = cropOfSeeds(held);
      const bed = isGreenhousePlot(plot.id);
      if (seeds && Boolean(seeds.indoor) !== bed) return bed ? `${seeds.name} va afuera, en el huerto` : `${seeds.name} va en el invernadero`;
      if (seeds) return `Sembrar ${seeds.name.toLowerCase()}`;
      return bed ? "Bancal vacío (elige semillas de tierra caliente en la barra)" : "Parcela vacía (elige unas semillas en la barra)";
    }
    const crop = cropById(st.crop)!;
    const now = serverNow();
    const left = plotReadyAt(st) - now;
    if (left <= 0) {
      if (canHarvest(st, userId, now)) return `Cosechar: ${FREE_NAMES[crop.product] ?? crop.name}`;
      return `${crop.name} lista · la sembró ${st.plantedByName || "alguien más"}`;
    }
    if (crop.indoor) return `${crop.name} · lista en ${durationText(left)} (aquí no hace falta regar)`;
    if (can) return canWater(st, now) ? `Regar ${crop.name.toLowerCase()} (lista en ${durationText(left)})` : `${crop.name} · tierra húmeda, lista en ${durationText(left)}`;
    if (held === EMPTY_CAN) return "La regadera está vacía: llénala en el barril";
    return `${crop.name} · lista en ${durationText(left)}${plotWet(st, now) ? "" : " (riégala para que crezca más rápido)"}`;
  }

  // ---------- Lo que pasa al usarlos ----------

  handleEvent(e: FurnitureEvent, f: PlacedFurniture, vol: number): boolean {
    const map = this.map;
    if (!map) return false;
    const ts = map.tileSize;
    const who = this.host.avatarOf(e.sessionId);
    const face = who ? faceToward(f, ts, who.x, who.y) : "down";
    const top = (z: number) => worldToScreen((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts, z);
    switch (e.action) {
      case "plot": {
        this.refreshPlots();
        if (e.garden === "plant") {
          who?.perform(face, 700);
          playDig(vol);
          const p = top(2);
          for (let k = 0; k < 6; k++) this.speck(p.x + Phaser.Math.Between(-6, 6), p.y - 2, 0x6a4a2e, 8, 500);
        } else if (e.garden === "water") {
          who?.perform(face, 1600);
          playWater(vol);
          const p = top(14);
          for (let k = 0; k < 9; k++)
            this.scene.time.delayedCall(150 + k * 140, () => {
              const key = ensureTexture(this.scene, "huerto-gota", () => waterDrop());
              const img = this.scene.add.image(p.x + Phaser.Math.Between(-6, 6), p.y - 4, key).setDepth(DEPTH_OVERLAY + 2);
              this.scene.tweens.add({ targets: img, y: img.y + 12, alpha: 0.2, duration: 380, ease: "Quad.in", onComplete: () => img.destroy() });
            });
        } else if (e.garden === "harvest") {
          who?.perform(face, 700);
          playPluck(vol);
          this.scene.time.delayedCall(250, () => playGot(vol));
          if (e.item) this.pop(top(10), e.item);
          this.sparkle(top(12));
        }
        return true;
      }
      case "fill": {
        who?.perform(face, 900);
        playFill(vol);
        const p = top(12);
        for (let k = 0; k < 6; k++) this.speck(p.x + Phaser.Math.Between(-4, 4), p.y, 0x7fd0ff, -6, 420);
        return true;
      }
      case "honey": {
        who?.perform(face, 1200);
        playBuzz(vol, true);
        this.swarm(f);
        if (who) this.scene.time.delayedCall(700, () => this.floatText(who, "¡Miel!"));
        return true;
      }
      case "ring": {
        who?.perform(face, 1200);
        playBell(vol);
        for (let k = 0; k < 4; k++) this.scene.time.delayedCall(k * 330, () => this.note(top(46), k));
        return true;
      }
      default:
        return false;
    }
  }

  /** Lo cosechado salta de la parcela y sube. */
  private pop(p: { x: number; y: number }, item: string) {
    const key = ensureTexture(this.scene, `huerto-cosecha-${item}`, () => drawHeldItem(item));
    const img = this.scene.add.image(p.x, p.y, key).setDepth(DEPTH_OVERLAY + 3).setScale(0.6);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1300,
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        img.setScale(v < 0.15 ? 0.6 + v * 4 : 1.2);
        img.setPosition(p.x, Math.round(p.y - Math.sin(Math.min(1, v * 1.6) * Math.PI * 0.5) * 18));
        img.setAlpha(v > 0.75 ? 1 - (v - 0.75) / 0.25 : 1);
      },
      onComplete: () => img.destroy(),
    });
  }

  private sparkle(p: { x: number; y: number }) {
    const key = ensureTexture(this.scene, "huerto-destello", () => sparkleSprite());
    for (let k = 0; k < 4; k++) {
      const img = this.scene.add.image(p.x + Phaser.Math.Between(-8, 8), p.y + Phaser.Math.Between(-6, 4), key).setDepth(DEPTH_OVERLAY + 2).setAlpha(0);
      this.scene.tweens.add({ targets: img, alpha: 1, y: img.y - 6, duration: 300, delay: k * 90, yoyo: true, onComplete: () => img.destroy() });
    }
  }

  /** Terroncito o gota que salta y cae (`rise` negativo = salpica hacia arriba). */
  private speck(x: number, y: number, color: number, rise: number, ms: number) {
    const r = this.scene.add.rectangle(x, y, 1, 1, color).setDepth(DEPTH_OVERLAY + 2);
    const up = Phaser.Math.Between(3, 7);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        r.setPosition(x + (v * (x % 2 ? 3 : -3)), y - up * Math.sin(v * Math.PI) + (rise > 0 ? v * rise : 0));
        r.setAlpha(1 - v * 0.7);
      },
      onComplete: () => r.destroy(),
    });
  }

  private note(p: { x: number; y: number }, k: number) {
    const kind = (k % 2) as 0 | 1;
    const color = NOTE_COLORS[k % NOTE_COLORS.length]!;
    const key = ensureTexture(this.scene, `nota-${kind}-${k % NOTE_COLORS.length}`, () => musicNote(kind, color));
    const x0 = p.x + (Math.random() - 0.5) * 12;
    const img = this.scene.add.image(x0, p.y, key).setDepth(DEPTH_OVERLAY + 2).setAlpha(0);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1500,
      onUpdate: (t) => {
        const v = t.getValue() ?? 0;
        img.setPosition(Math.round(x0 + Math.sin(k + v * 6) * 3), Math.round(p.y - v * 20));
        img.setAlpha(v < 0.15 ? v / 0.15 : 1 - (v - 0.15) / 0.85);
      },
      onComplete: () => img.destroy(),
    });
  }

  private floatText(who: Avatar, text: string) {
    const p = worldToScreen(who.x, who.y);
    const t = this.scene.add
      .text(p.x, p.y - 40, text, { fontFamily: cozyFontFamily(), fontSize: "8px", color: COZY.paperLight, stroke: COZY.frame, strokeThickness: 2, resolution: 6 })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY + 10);
    this.scene.tweens.add({ targets: t, y: p.y - 52, alpha: 0, delay: 600, duration: 1200, ease: "Sine.out", onComplete: () => t.destroy() });
  }

  // ---------- Abejas ----------

  private addBee(hive: PlacedFurniture, extra: boolean) {
    const img = this.scene.add.image(0, 0, "abeja-0").setOrigin(0.5, 0.5);
    const ts = this.map!.tileSize;
    this.bees.push({
      img,
      hive,
      phase: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 0.8,
      radius: 6 + Math.random() * 10,
      nextTrip: this.scene.time.now + (extra ? Infinity : 2000 + Math.random() * 8000),
      x: (hive.x + 0.5) * ts,
      y: (hive.y + 0.5) * ts,
      z: 16,
    });
  }

  /** Sacaron miel: salen más abejas y dan vueltas rápido alrededor de la colmena un rato. */
  private swarm(hive: PlacedFurniture) {
    this.swarmUntil.set(hive, this.scene.time.now + SWARM_MS);
    for (let k = 0; k < SWARM_BEES; k++) this.addBee(hive, true);
  }

  private updateBees(time: number, delta: number) {
    const ts = this.map!.tileSize;
    const { night, weather } = useOfficeStore.getState();
    // De noche y con lluvia se quedan adentro (salvo que las alboroten).
    const out = !night && weather !== "lluvia" && weather !== "tormenta";
    const keep: Bee[] = [];
    for (const b of this.bees) {
      const angry = time < (this.swarmUntil.get(b.hive) ?? 0);
      const extra = b.nextTrip === Infinity;
      if (extra && !angry) {
        b.img.destroy();
        continue;
      }
      keep.push(b);
      const visible = out || angry;
      b.img.setVisible(visible);
      if (!visible) continue;
      const hx = (b.hive.x + 0.5) * ts;
      const hy = (b.hive.y + 0.5) * ts;
      let tx: number;
      let ty: number;
      let tz: number;
      b.phase += (delta / 1000) * b.speed * (angry ? 5 : 1.6);
      if (!angry && !b.flower && time >= b.nextTrip && this.flowers.length) {
        const fl = this.flowers[Math.floor(Math.random() * this.flowers.length)]!;
        b.flower = { x: fl.x, y: fl.y, until: 0, leaveAt: 0 };
      }
      if (b.flower && !angry) {
        const fl = b.flower;
        const d = Math.hypot(fl.x - b.x, fl.y - b.y);
        if (!fl.until && d < 4) {
          fl.until = time + 1500 + Math.random() * 2000;
        }
        if (fl.until && time > fl.until) {
          b.flower = undefined;
          b.nextTrip = time + 4000 + Math.random() * 9000;
        }
        tx = fl.x + Math.cos(b.phase * 3) * 3;
        ty = fl.y + Math.sin(b.phase * 2) * 3;
        tz = 7 + Math.sin(b.phase * 4) * 2;
      } else {
        const r = angry ? b.radius * 1.3 : b.radius;
        tx = hx + Math.cos(b.phase) * r;
        ty = hy + Math.sin(b.phase * 1.3) * r;
        tz = (angry ? 22 : 16) + Math.sin(b.phase * 2.3) * 5;
      }
      // Vuelan hacia el blanco con un poco de retraso: zigzaguean solas.
      const k = Math.min(1, (delta / 1000) * (angry ? 9 : 3));
      b.x += (tx - b.x) * k;
      b.y += (ty - b.y) * k;
      b.z += (tz - b.z) * k;
      const p = worldToScreen(b.x, b.y, b.z);
      b.img
        .setTexture(`abeja-${Math.floor(time / 60 + b.phase) % 2}`)
        .setFlipX(tx - ty < b.x - b.y)
        .setPosition(Math.round(p.x), Math.round(p.y))
        .setDepth(depthOf(b.x, b.y) + 40);
    }
    this.bees = keep;
  }

  // ---------- La glorieta y el invernadero ----------

  private insideGreenhouse(px: number, py: number): boolean {
    const map = this.map;
    if (!map) return false;
    const ts = map.tileSize;
    return map.furniture.some((f) => f.type === "greenhouse" && px >= f.x * ts && px < (f.x + f.w) * ts && py >= f.y * ts && py < (f.y + f.d) * ts);
  }

  /**
   * El techo (o el vidrio) lo dibuja el nivel: se busca su imagen, por su nombre y su lugar, para transparentarla.
   * Con el arte del build el nombre es el del cuadro del atlas (la textura es `pre-muebles-N`); sin él, el de la textura.
   */
  private roofImage(r: { f: PlacedFurniture; img?: Phaser.GameObjects.Image }): Phaser.GameObjects.Image | undefined {
    if (r.img?.active) return r.img;
    const prefix = `mueble-${r.f.type}-`;
    const ts = this.map!.tileSize;
    const d = depthOf((r.f.x + r.f.w / 2) * ts, (r.f.y + r.f.d / 2) * ts);
    r.img = this.scene.children.list.find(
      (o): o is Phaser.GameObjects.Image =>
        o instanceof Phaser.GameObjects.Image &&
        (o.texture.key.startsWith(prefix) || String(o.frame.name).startsWith(prefix)) &&
        Math.abs(o.depth - d) < 0.5,
    );
    return r.img;
  }

  private updateRoofs(delta: number) {
    const map = this.map;
    const room = this.host.room();
    if (!map || !room) return;
    const ts = map.tileSize;
    for (const r of this.roofs) {
      const img = this.roofImage(r);
      if (!img) continue;
      const g = r.f;
      let inside = false;
      for (const p of room.state.players.values()) {
        if (p.area !== map.id) continue;
        if (p.x >= g.x * ts && p.x < (g.x + g.w) * ts && p.y >= g.y * ts && p.y < (g.y + g.d) * ts) inside = true;
      }
      const target = inside ? ROOF_SEE_THROUGH : 1;
      img.setAlpha(img.alpha + (target - img.alpha) * Math.min(1, delta / 180));
    }
  }

  // ---------- Cada cuadro ----------

  update(time: number, delta: number) {
    if (!this.map?.outdoor) return;
    this.growIn -= delta;
    if (this.growIn <= 0) {
      this.growIn = GROW_CHECK_MS;
      this.refreshPlots();
    }
    if (this.bees.length) this.updateBees(time, delta);
    this.updateRoofs(delta);
  }
}
