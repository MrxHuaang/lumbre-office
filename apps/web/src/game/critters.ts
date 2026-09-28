// Fauna del jardín, solo decorativa y solo en el cliente: pájaros que picotean en el pasto y se van
// volando si alguien se acerca, ardillas que corretean entre los árboles y se trepan, y luciérnagas de
// noche junto al lago. No bloquean el paso ni se sincronizan: salen de una semilla del día (de Bogotá),
// así todos ven más o menos lo mismo. Con lluvia se esconden casi todos; de noche no hay pájaros.
import { isBlockedTile, type OfficeMap } from "@hyvento/map";
import { BIRD_FRAMES, BIRD_KINDS, SQUIRREL_FRAMES, drawBird, drawFirefly, drawSquirrel, type BirdFrame, type BirdKind, type SquirrelFrame } from "@hyvento/map/art";
import { dayStart, type Weather } from "@hyvento/shared";
import * as Phaser from "phaser";
import { DEPTH_OVERLAY, depthOf, ensureTexture, worldToScreen } from "./iso/view";
import { lessMotion } from "@/lib/prefs";

/** A cuántos tiles se asustan. */
const SCARE_TILES = 3;
const BIRDS = 9;
const SQUIRRELS = 4;
const FIREFLIES = 16;
/** Cada cuánto se mira si hay alguien cerca (ms). */
const SCARE_CHECK_MS = 200;
/** Cuántos se animan a salir según el clima (pájaros, ardillas). */
const ALLOWED: Record<Weather, { birds: number; squirrels: number; fireflies: number }> = {
  despejado: { birds: BIRDS, squirrels: SQUIRRELS, fireflies: FIREFLIES },
  nublado: { birds: 6, squirrels: 3, fireflies: 10 },
  lluvia: { birds: 2, squirrels: 1, fireflies: 0 },
  tormenta: { birds: 0, squirrels: 0, fireflies: 0 },
  niebla: { birds: 4, squirrels: 2, fireflies: 6 },
  nieve: { birds: 3, squirrels: 1, fireflies: 0 },
};
/** Profundidad de lo que vuela (sobre todo, debajo del clima). */
const DEPTH_FLYING = DEPTH_OVERLAY - 6;

/** Azar con semilla (mulberry32): mismo día, mismos lugares. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r: () => number, a: number, b: number) => a + r() * (b - a);

interface Point {
  x: number;
  y: number;
}

type BirdState = "ground" | "flee" | "away" | "return";
interface Bird {
  kind: BirdKind;
  img: Phaser.GameObjects.Image;
  /** Centro de su bandada (px de mundo) y dónde está ahora (z = altura en px de pantalla). */
  home: Point;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  state: BirdState;
  /** Hasta cuándo sigue lo que está haciendo (ms de la escena). */
  until: number;
  /** Picoteando o saltando: cuadro y hasta cuándo. */
  pose: BirdFrame;
  poseUntil: number;
  right: boolean;
  target?: Point;
}

type SquirrelState = "sit" | "run" | "climb" | "hidden";
interface Squirrel {
  img: Phaser.GameObjects.Image;
  tree: number;
  x: number;
  y: number;
  z: number;
  state: SquirrelState;
  until: number;
  target?: { tree: number; x: number; y: number };
  right: boolean;
  /** Al llegar al árbol se trepa (se asustó). */
  flee: boolean;
}

interface Firefly {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  phase: number;
  speed: number;
}

const birdKey = (k: BirdKind, f: BirdFrame) => `fauna-${k}-${f}`;
const squirrelKey = (f: SquirrelFrame) => `fauna-ardilla-${f}`;

export class Critters {
  private map?: OfficeMap;
  private birds: Bird[] = [];
  private squirrels: Squirrel[] = [];
  private fireflies: Firefly[] = [];
  /** Base de cada árbol (px de mundo) donde se sientan las ardillas, y su profundidad. */
  private trees: { x: number; y: number; depth: number }[] = [];
  private night = false;
  private weather: Weather = "despejado";
  private checkIn = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    /** Dónde están los personajes del nivel (px de mundo). */
    private readonly people: () => Point[],
  ) {
    for (const k of BIRD_KINDS) for (const f of BIRD_FRAMES) ensureTexture(scene, birdKey(k, f), () => drawBird(k, f));
    for (const f of SQUIRREL_FRAMES) ensureTexture(scene, squirrelKey(f), () => drawSquirrel(f));
    ensureTexture(scene, "fauna-luciernaga", () => drawFirefly());
  }

  setConditions(night: boolean, weather: Weather) {
    this.night = night;
    this.weather = weather;
  }

  /** Nivel nuevo: la fauna solo vive afuera. */
  setArea(map: OfficeMap) {
    this.clear();
    this.map = map;
    if (!map.outdoor) return;
    const ts = map.tileSize;
    const rand = seeded(dayStart(Date.now()) / 1000 + map.width * 31);
    const area = map.def.playable ?? { x: 0, y: 0, w: map.width, h: map.height };
    const floorAt = (tx: number, ty: number) => map.floors[ty * map.width + tx];
    const grassy = (tx: number, ty: number) => floorAt(tx, ty) === "grass" && !isBlockedTile(map, tx, ty);
    const randomTile = (ok: (tx: number, ty: number) => boolean) => {
      for (let k = 0; k < 400; k++) {
        const tx = area.x + Math.floor(rand() * area.w);
        const ty = area.y + Math.floor(rand() * area.h);
        if (ok(tx, ty)) return { tx, ty };
      }
      return null;
    };

    // Pájaros: tres bandaditas en claros de pasto (con pasto alrededor).
    const flocks: Point[] = [];
    for (let i = 0; i < 3; i++) {
      const t = randomTile((tx, ty) => grassy(tx, ty) && grassy(tx + 1, ty) && grassy(tx, ty + 1) && grassy(tx - 1, ty) && grassy(tx, ty - 1));
      if (t) flocks.push({ x: (t.tx + 0.5) * ts, y: (t.ty + 0.5) * ts });
    }
    if (flocks.length)
      for (let i = 0; i < BIRDS; i++) {
        const home = flocks[i % flocks.length]!;
        const kind = BIRD_KINDS[Math.floor(rand() * BIRD_KINDS.length)]!;
        const x = home.x + between(rand, -ts, ts);
        const y = home.y + between(rand, -ts, ts);
        const img = this.scene.add.image(0, 0, birdKey(kind, "stand")).setOrigin(0.5, 1);
        this.birds.push({ kind, img, home, x, y, z: 0, vx: 0, vy: 0, vz: 0, state: "ground", until: 0, pose: "stand", poseUntil: 0, right: rand() < 0.5 });
      }

    // Ardillas: cada una con su árbol; corren entre árboles cercanos.
    const isTree = (type: string) => /tree|oak|pine|birch/.test(type);
    for (const f of map.furniture) {
      if (!isTree(f.type)) continue;
      if (f.x < area.x || f.y < area.y || f.x >= area.x + area.w || f.y >= area.y + area.h) continue;
      const cx = (f.x + f.w / 2) * ts;
      const cy = (f.y + f.d / 2) * ts;
      this.trees.push({ x: cx, y: cy, depth: depthOf(cx, cy) });
    }
    for (let i = 0; i < SQUIRRELS && this.trees.length; i++) {
      const tree = Math.floor(rand() * this.trees.length);
      const base = this.treeBase(tree);
      const img = this.scene.add.image(0, 0, squirrelKey("sit")).setOrigin(0.5, 1);
      this.squirrels.push({ img, tree, x: base.x, y: base.y, z: 0, state: "sit", until: 0, right: rand() < 0.5, flee: false });
    }

    // Luciérnagas: sobre el pasto de la orilla del lago.
    const shore: Point[] = [];
    for (let ty = area.y; ty < area.y + area.h; ty++)
      for (let tx = area.x; tx < area.x + area.w; tx++) {
        const f = floorAt(tx, ty);
        if (f !== "grass" && f !== "sand") continue;
        if ([floorAt(tx + 1, ty), floorAt(tx - 1, ty), floorAt(tx, ty + 1), floorAt(tx, ty - 1)].includes("water"))
          shore.push({ x: (tx + 0.5) * ts, y: (ty + 0.5) * ts });
      }
    for (let i = 0; i < FIREFLIES && shore.length; i++) {
      const p = shore[Math.floor(rand() * shore.length)]!;
      const img = this.scene.add.image(0, 0, "fauna-luciernaga").setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_OVERLAY + 2).setVisible(false);
      this.fireflies.push({ img, x: p.x + between(rand, -ts, ts), y: p.y + between(rand, -ts, ts), phase: rand() * Math.PI * 2, speed: between(rand, 0.6, 1.4) });
    }
    // Los que no salen con este clima (o de noche) ya están escondidos: no se ven irse al entrar.
    const allowed = ALLOWED[this.weather];
    this.birds.forEach((b, i) => {
      if (this.night || i >= allowed.birds) this.hideBird(b, 0);
      this.placeBird(b);
    });
    this.squirrels.forEach((s, i) => {
      if (this.night || i >= allowed.squirrels) this.hideSquirrel(s, 0);
      this.placeSquirrel(s);
    });
  }

  private hideBird(b: Bird, time: number) {
    b.state = "away";
    b.until = time + 20_000 + Math.random() * 25_000;
    b.img.setVisible(false);
  }

  private hideSquirrel(s: Squirrel, time: number) {
    s.state = "hidden";
    s.until = time + 15_000 + Math.random() * 20_000;
    s.img.setVisible(false);
  }

  /** Donde se sienta una ardilla junto a su árbol: al frente del tronco (así se ve delante). */
  private treeBase(i: number): Point {
    const t = this.trees[i]!;
    const ts = this.map!.tileSize;
    return { x: t.x + ts * 0.25, y: t.y + ts * 0.55 };
  }

  update(time: number, delta: number) {
    if (!this.map?.outdoor) return;
    const allowed = ALLOWED[this.weather];
    // Con menos movimiento, un tercio de los bichos (se mueven solos por la pantalla).
    const calm = lessMotion() ? 3 : 1;
    const birdsOk = this.night ? 0 : Math.ceil(allowed.birds / calm);
    const squirrelsOk = this.night ? 0 : Math.ceil(allowed.squirrels / calm);
    let scared: Point[] | null = null;
    this.checkIn -= delta;
    if (this.checkIn <= 0) {
      this.checkIn = SCARE_CHECK_MS;
      scared = this.people();
    }
    const reach = SCARE_TILES * this.map.tileSize;
    const near = (x: number, y: number) => scared?.find((p) => Math.hypot(p.x - x, p.y - y) < reach) ?? null;

    this.birds.forEach((b, i) => this.updateBird(b, i < birdsOk, near, time, delta));
    this.squirrels.forEach((s, i) => this.updateSquirrel(s, i < squirrelsOk, near, time, delta));
    this.updateFireflies(this.night ? allowed.fireflies : 0, time);
  }

  // ---------- Pájaros ----------

  private updateBird(b: Bird, allowed: boolean, near: (x: number, y: number) => Point | null, time: number, delta: number) {
    const ts = this.map!.tileSize;
    switch (b.state) {
      case "ground": {
        const threat = near(b.x, b.y);
        if (threat || !allowed) {
          this.takeOff(b, threat ?? { x: b.x - 1, y: b.y - 1 }, time);
          break;
        }
        if (time >= b.poseUntil) {
          // Pausa, picotazo o saltito, al azar (sin alejarse de la bandada).
          const r = Math.random();
          if (r < 0.45) {
            b.pose = "peck";
            b.poseUntil = time + 220;
          } else if (r < 0.75) {
            b.pose = "hop";
            b.poseUntil = time + 180;
            const ang = Math.random() * Math.PI * 2;
            let nx = b.x + Math.cos(ang) * 5;
            let ny = b.y + Math.sin(ang) * 5;
            if (Math.hypot(nx - b.home.x, ny - b.home.y) > ts * 1.6) {
              nx = b.x + (b.home.x - b.x) * 0.2;
              ny = b.y + (b.home.y - b.y) * 0.2;
            }
            b.right = nx - ny > b.x - b.y;
            b.x = nx;
            b.y = ny;
          } else {
            b.pose = "stand";
            b.poseUntil = time + 300 + Math.random() * 1400;
            if (Math.random() < 0.3) b.right = !b.right;
          }
        }
        b.z = b.pose === "hop" ? 2 : 0;
        b.img.setTexture(birdKey(b.kind, b.pose));
        break;
      }
      case "flee": {
        b.x += b.vx * delta;
        b.y += b.vy * delta;
        b.z += b.vz * delta;
        this.flap(b, time);
        const left = b.until - time;
        b.img.setAlpha(Math.min(1, left / 600));
        if (left <= 0) this.hideBird(b, time);
        break;
      }
      case "away": {
        if (time < b.until || !allowed || near(b.home.x, b.home.y)) {
          if (time >= b.until) b.until = time + 5000;
          return;
        }
        // Vuelve volando desde lejos hasta un lugar de la bandada.
        const land = { x: b.home.x + (Math.random() - 0.5) * ts * 2, y: b.home.y + (Math.random() - 0.5) * ts * 2 };
        const ang = Math.random() * Math.PI * 2;
        b.x = land.x + Math.cos(ang) * ts * 6;
        b.y = land.y + Math.sin(ang) * ts * 6;
        b.z = 70;
        b.target = land;
        b.state = "return";
        b.img.setVisible(true).setAlpha(0);
        break;
      }
      case "return": {
        const t = b.target!;
        const dx = t.x - b.x;
        const dy = t.y - b.y;
        const d = Math.hypot(dx, dy);
        const step = 0.11 * delta;
        if (near(t.x, t.y)) {
          this.takeOff(b, near(t.x, t.y)!, time);
          break;
        }
        if (d <= step) {
          b.x = t.x;
          b.y = t.y;
          b.z = 0;
          b.state = "ground";
          b.pose = "stand";
          b.poseUntil = time + 600;
          b.img.setAlpha(1);
          break;
        }
        b.x += (dx / d) * step;
        b.y += (dy / d) * step;
        b.z = Math.max(0, 70 * Math.min(1, (d - step) / (ts * 6)));
        b.right = dx - dy > 0;
        b.img.setAlpha(Math.min(1, b.img.alpha + delta / 400));
        this.flap(b, time);
        break;
      }
    }
    this.placeBird(b);
  }

  /** Sale volando alejándose de `from` (y hacia arriba). */
  private takeOff(b: Bird, from: Point, time: number) {
    let dx = b.x - from.x;
    let dy = b.y - from.y;
    const d = Math.hypot(dx, dy) || 1;
    // Un poco de desorden: no salen todos para el mismo lado.
    const ang = Math.atan2(dy / d, dx / d) + (Math.random() - 0.5) * 1.2;
    dx = Math.cos(ang);
    dy = Math.sin(ang);
    const speed = 0.13 + Math.random() * 0.05;
    b.vx = dx * speed;
    b.vy = dy * speed;
    b.vz = 0.05 + Math.random() * 0.03;
    b.right = dx - dy > 0;
    b.state = "flee";
    b.until = time + 1800 + Math.random() * 700;
  }

  private flap(b: Bird, time: number) {
    b.img.setTexture(birdKey(b.kind, Math.floor(time / 90 + b.home.x) % 2 ? "fly0" : "fly1"));
  }

  private placeBird(b: Bird) {
    const p = worldToScreen(b.x, b.y, b.z);
    b.img
      .setPosition(Math.round(p.x), Math.round(p.y))
      .setFlipX(!b.right)
      .setDepth(b.z > 3 ? DEPTH_FLYING : depthOf(b.x, b.y));
  }

  // ---------- Ardillas ----------

  private updateSquirrel(s: Squirrel, allowed: boolean, near: (x: number, y: number) => Point | null, time: number, delta: number) {
    const ts = this.map!.tileSize;
    switch (s.state) {
      case "sit": {
        const threat = near(s.x, s.y);
        if (threat || !allowed) {
          // Al árbol más cercano (el suyo, casi siempre) y para arriba.
          s.flee = true;
          this.runTo(s, s.tree, this.treeBase(s.tree));
          break;
        }
        if (time < s.until) break;
        if (s.until && Math.random() < 0.5) {
          // Otro árbol cerca (no muy lejos: dos a siete tiles).
          const options = this.trees
            .map((t, i) => ({ i, d: Math.hypot(t.x - s.x, t.y - s.y) }))
            .filter((o) => o.i !== s.tree && o.d > ts * 2 && o.d < ts * 7);
          const pick = options[Math.floor(Math.random() * options.length)];
          if (pick) {
            s.flee = false;
            this.runTo(s, pick.i, this.treeBase(pick.i));
            break;
          }
        }
        if (Math.random() < 0.4) s.right = !s.right;
        s.until = time + 2000 + Math.random() * 4000;
        s.img.setTexture(squirrelKey("sit"));
        break;
      }
      case "run": {
        const t = s.target!;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const d = Math.hypot(dx, dy);
        const step = (s.flee ? 0.16 : 0.1) * delta;
        if (!s.flee && near(s.x, s.y)) {
          // Se asustó en el camino: al árbol al que iba, y arriba.
          s.flee = true;
        }
        if (d <= step) {
          s.x = t.x;
          s.y = t.y;
          s.tree = t.tree;
          s.z = 0;
          if (s.flee) {
            const tr = this.trees[s.tree]!;
            // Trepa por el tronco: se pone justo delante del árbol.
            s.x = tr.x + 2;
            s.y = tr.y + 2;
            s.state = "climb";
            s.until = time + 1400;
            s.img.setTexture(squirrelKey("climb"));
          } else {
            s.state = "sit";
            s.until = time + 1500 + Math.random() * 4000;
            s.img.setTexture(squirrelKey("sit"));
          }
          break;
        }
        s.x += (dx / d) * step;
        s.y += (dy / d) * step;
        s.right = dx - dy > 0;
        const f = Math.floor(time / 90) % 2;
        s.z = f ? 1 : 0;
        s.img.setTexture(squirrelKey(f ? "run0" : "run1"));
        break;
      }
      case "climb": {
        s.z += 0.028 * delta;
        const left = s.until - time;
        s.img.setAlpha(Math.max(0, Math.min(1, left / 500)));
        if (left <= 0) this.hideSquirrel(s, time);
        break;
      }
      case "hidden": {
        if (time < s.until) return;
        if (!allowed) {
          s.until = time + 5000;
          return;
        }
        // Baja en algún árbol sin gente cerca.
        const free = this.trees.map((_, i) => i).filter((i) => {
          const b = this.treeBase(i);
          return !near(b.x, b.y);
        });
        if (free.length === 0) {
          s.until = time + 5000;
          return;
        }
        s.tree = free[Math.floor(Math.random() * free.length)]!;
        const b = this.treeBase(s.tree);
        s.x = b.x;
        s.y = b.y;
        s.z = 0;
        s.state = "sit";
        s.until = time + 3000;
        s.img.setTexture(squirrelKey("sit")).setVisible(true).setAlpha(1);
        break;
      }
    }
    this.placeSquirrel(s);
  }

  private runTo(s: Squirrel, tree: number, p: Point) {
    s.target = { tree, x: p.x, y: p.y };
    s.state = "run";
  }

  private placeSquirrel(s: Squirrel) {
    const p = worldToScreen(s.x, s.y, s.z);
    // Trepando va pegada al tronco, justo delante del árbol.
    const depth = s.state === "climb" ? this.trees[s.tree]!.depth + 1 : depthOf(s.x, s.y);
    s.img
      .setPosition(Math.round(p.x), Math.round(p.y))
      .setFlipX(s.state !== "climb" && !s.right)
      .setDepth(depth);
  }

  // ---------- Luciérnagas ----------

  private updateFireflies(count: number, time: number) {
    const ts = this.map!.tileSize;
    this.fireflies.forEach((f, i) => {
      if (i >= count) {
        if (f.img.visible) f.img.setVisible(false);
        return;
      }
      const t = (time / 1000) * f.speed + f.phase;
      // Vagan en ochos lentos alrededor de su lugar y prenden y apagan.
      const wx = f.x + Math.sin(t * 0.7) * ts * 0.8;
      const wy = f.y + Math.sin(t * 0.45 + 1.3) * ts * 0.8;
      const z = 8 + Math.sin(t * 1.3) * 5;
      const glow = Math.max(0, Math.sin(t * 2.1));
      const p = worldToScreen(wx, wy, z);
      f.img.setPosition(Math.round(p.x), Math.round(p.y)).setAlpha(glow * glow).setVisible(glow > 0.05);
    });
  }

  private clear() {
    for (const b of this.birds) b.img.destroy();
    for (const s of this.squirrels) s.img.destroy();
    for (const f of this.fireflies) f.img.destroy();
    this.birds = [];
    this.squirrels = [];
    this.fireflies = [];
    this.trees = [];
  }

  destroy() {
    this.clear();
    this.map = undefined;
  }
}
