// Los acuarios en la escena: encima del dibujo del mueble nadan, como capas, los peces que sacó el equipo
// (los más raros y recientes del álbum de todos, ver aquariumStore.ts). Cada pez va y viene a lo largo del
// tanque a su profundidad, sube y baja un poco y mueve la cola; unas burbujas suben del aireador.
import { catalogItem, footprint, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { ACUARIO_SWIM, aquariumBubble, MINI_FISH_H, MINI_FISH_W, miniFish, toScreen } from "@hyvento/map/art";
import { fishById } from "@hyvento/shared";
import * as Phaser from "phaser";
import { casaOwnerOf } from "@/lib/casaGaleria";
import { useAquariumStore } from "./aquariumStore";
import { depthOf, ensureTexture, worldToScreen, type AreaView } from "./iso/view";

const TYPE = "acuario";
/** De dónde salen las burbujas (coordenadas locales de arte del mueble) y cuánto tardan en subir. */
const BUBBLE_FROM = { x: 7, y: 55, z: 15 };
const BUBBLE_RISE = 13;
const BUBBLE_MS = 2600;
const BUBBLES = 3;
/** Cada cuánto aletea la cola. */
const WIGGLE_MS = 220;

interface Swimmer {
  img: Phaser.GameObjects.Image;
  frames: [string, string];
  /** Profundidad en el tanque, extremos del recorrido y altura (unidades de arte locales). */
  x: number;
  y0: number;
  y1: number;
  z: number;
  /** Velocidad angular del vaivén (rad/ms) y desfase. */
  omega: number;
  phase: number;
}

interface Tank {
  f: PlacedFurniture;
  /** Esquina del mueble en pantalla y si está espejado (mirando hacia abajo o arriba). */
  origin: { x: number; y: number };
  flip: boolean;
  depth: number;
  fish: Swimmer[];
  bubbles: Phaser.GameObjects.Image[];
}

/** Número pseudoazar estable (0..1) por pez: así cada uno nada siempre igual. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export class Aquariums {
  private map?: OfficeMap;
  private view?: AreaView;
  private tanks: Tank[] = [];
  private unsubscribe: () => void;
  private readonly onUpdate = (time: number) => this.tick(time);

  constructor(private readonly scene: Phaser.Scene) {
    this.unsubscribe = useAquariumStore.subscribe((s, prev) => {
      if (s.swimming !== prev.swimming) this.build();
    });
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
  }

  /** ¿El nivel tiene acuario? (para saber si hace falta pedir el álbum del equipo). */
  static hasTank(map: OfficeMap) {
    return map.furniture.some((f) => f.type === TYPE);
  }

  setArea(map: OfficeMap, view: AreaView) {
    this.map = map;
    this.view = view;
    const store = useAquariumStore.getState();
    // Al entrar se vuelve a pedir: pudo sacar un pez alguien más. En una casa, el de su dueño.
    if (Aquariums.hasTank(map)) {
      store.setOwner(casaOwnerOf(map.id));
      void store.refresh();
    }
    this.build();
  }

  destroy() {
    this.unsubscribe();
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    this.clear();
  }

  private clear() {
    for (const t of this.tanks) {
      t.fish.forEach((s) => s.img.destroy());
      t.bubbles.forEach((b) => b.destroy());
    }
    this.tanks = [];
  }

  private build() {
    this.clear();
    const map = this.map;
    if (!map || !this.scene.sys.isActive()) return;
    const species = useAquariumStore.getState().swimming;
    const ts = map.tileSize;
    const bubbleKey = ensureTexture(this.scene, "acuario-burbuja", () => aquariumBubble());
    for (const f of map.furniture) {
      if (f.type !== TYPE) continue;
      const item = catalogItem(f.type);
      const [w, d] = footprint(item, f.facing);
      const tank: Tank = {
        f,
        origin: worldToScreen(f.x * ts, f.y * ts),
        flip: !item.fixed && (f.facing === "down" || f.facing === "up"),
        depth: depthOf((f.x + w / 2) * ts, (f.y + d / 2) * ts) + 0.01,
        fish: [],
        bubbles: [],
      };
      species.forEach((id, i) => {
        const info = fishById(id);
        if (!info) return;
        const frames = [0, 1].map((k) => ensureTexture(this.scene, `acuario-pez-${id}-${k}`, () => miniFish(id, info.rarity, k))) as [string, string];
        const r = (k: number) => hash(i * 7 + k + id.length);
        const S = ACUARIO_SWIM;
        // Recorridos de largo distinto, cada uno a su profundidad y altura.
        const span = (S.y1 - S.y0) * (0.55 + r(1) * 0.45);
        const y0 = S.y0 + r(2) * (S.y1 - S.y0 - span);
        const swimmer: Swimmer = {
          img: this.scene.add.image(0, 0, frames[0]).setOrigin(0, 0),
          frames,
          x: S.x0 + ((i * 0.37 + r(3) * 0.5) % 1) * (S.x1 - S.x0),
          y0,
          y1: y0 + span,
          z: S.z0 + ((i * 0.61 + r(4) * 0.4) % 1) * (S.z1 - S.z0),
          omega: (Math.PI * 2) / (9000 + r(5) * 9000),
          phase: r(6) * Math.PI * 2,
        };
        // Los de más al frente del tanque van encima de los de atrás.
        swimmer.img.setDepth(tank.depth + swimmer.x / 1e4);
        this.view?.attach(f, swimmer.img);
        tank.fish.push(swimmer);
      });
      for (let k = 0; k < BUBBLES; k++) {
        const b = this.scene.add.image(0, 0, bubbleKey).setOrigin(0.5, 0.5).setDepth(tank.depth + 0.002);
        this.view?.attach(f, b);
        tank.bubbles.push(b);
      }
      this.tanks.push(tank);
    }
    this.tick(this.scene.time.now);
  }

  /** Punto local del mueble (arte) → pantalla, con el espejo de los que miran hacia abajo o arriba. */
  private screenOf(t: Tank, x: number, y: number, z: number) {
    const p = toScreen(x, y, z);
    return { x: t.origin.x + (t.flip ? -p.x : p.x), y: t.origin.y + p.y };
  }

  private tick(time: number) {
    for (const t of this.tanks) {
      for (const s of t.fish) {
        const a = s.phase + time * s.omega;
        const u = (1 - Math.cos(a)) / 2;
        const y = s.y0 + u * (s.y1 - s.y0);
        const z = s.z + Math.sin(time / 900 + s.phase) * 0.7;
        const p = this.screenOf(t, s.x, y, z);
        // Hacia +y el pez va a la izquierda de la pantalla (o a la derecha si el mueble está espejado).
        const towardPlusY = Math.sin(a) > 0;
        s.img.setFlipX(towardPlusY !== t.flip);
        s.img.setPosition(Math.round(p.x - MINI_FISH_W / 2), Math.round(p.y - MINI_FISH_H / 2));
        const frame = s.frames[Math.floor((time + s.phase * 1000) / WIGGLE_MS) % 2]!;
        if (s.img.texture.key !== frame) s.img.setTexture(frame);
      }
      t.bubbles.forEach((b, k) => {
        const u = ((time + (k * BUBBLE_MS) / BUBBLES) % BUBBLE_MS) / BUBBLE_MS;
        const p = this.screenOf(t, BUBBLE_FROM.x + Math.sin(u * 9 + k) * 0.6, BUBBLE_FROM.y, BUBBLE_FROM.z + u * BUBBLE_RISE);
        b.setPosition(Math.round(p.x), Math.round(p.y)).setAlpha(u > 0.85 ? (1 - u) / 0.15 : 1);
      });
    }
  }
}
