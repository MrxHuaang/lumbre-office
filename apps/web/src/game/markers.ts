// Indicadores de "aquí se puede hacer algo", al estilo Stardew: un destellito crema que titila de vez
// en cuando sobre cada objeto con el que se interactúa (barra, tienda, probadores, casino, buzón…) y
// sobre los muebles que se usan. Es discreto a propósito (no una alerta) y solo aparece de cerca.
import { pointsOfType, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { alpha, at, C, PixelCanvas } from "@hyvento/map/art";
import { usableSpec } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { AreaView, DEPTH_OVERLAY, ensureTexture } from "./iso/view";

/** Distancia (tiles) a la que aparecen los destellos: los de los objetos principales y los de muebles que se usan. */
const MAIN_NEAR_TILES = 7;
const USABLE_NEAR_TILES = 4;
/** Cada cuánto titila un destello (ms) y cuánto dura el brillo. */
const TWINKLE_EVERY_MS = 2200;
const TWINKLE_MS = 1200;
/** Distancia (tiles) de un punto al mueble que lo marca. */
const POINT_TO_FURNITURE_TILES = 1.6;
/** Muebles con indicador aunque no tengan punto (se usan sentándose). */
const ALWAYS: readonly string[] = ["blackjack-table"];

function markerArt(): PixelCanvas {
  // Destello de cuatro puntas: centro blanco, brazos crema, puntas doradas y un halo dorado suave (sin
  // contorno: no es un cartel, es un brillo del objeto).
  const c = new PixelCanvas(13, 13);
  const m = 6;
  const halo = alpha(at(C.gold, 4), 0.28);
  for (let y = 0; y < 13; y++)
    for (let x = 0; x < 13; x++) {
      const d = Math.hypot(x - m, y - m);
      if (d <= 3.2 && d > 1.2) c.set(x, y, halo);
    }
  for (let k = 1; k <= 5; k++) {
    const col = k === 1 ? at(C.white, 4) : k <= 3 ? at(C.cream, 5) : k === 4 ? alpha(at(C.gold, 5), 0.85) : alpha(at(C.gold, 4), 0.5);
    c.set(m - k, m, col);
    c.set(m + k, m, col);
    c.set(m, m - k, col);
    c.set(m, m + k, col);
  }
  for (const [x, y] of [[m - 1, m - 1], [m + 1, m - 1], [m - 1, m + 1], [m + 1, m + 1]] as const) c.set(x, y, alpha(at(C.cream, 5), 0.7));
  c.set(m, m, at(C.white, 4));
  return c;
}

interface Marker {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  /** Centro del mueble (los destellos solo se ven de cerca). */
  near: { x: number; y: number };
  /** Mueble que se usa (se ve más de cerca que los objetos principales). */
  usable: boolean;
  /** Desfase del titilar (0..1), para que no brillen todos a la vez. */
  phase: number;
}

export class InteractMarkers {
  private markers: Marker[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Arma los indicadores del nivel: uno por mueble de cada objeto interactivo (junto a su punto) y los de los muebles que se usan. */
  setArea(map: OfficeMap, view: AreaView, specs: readonly { point: string; furniture: readonly string[] }[]) {
    this.clear();
    const key = ensureTexture(this.scene, "indicador-destello-2", markerArt);
    const ts = map.tileSize;
    const chosen = new Set<PlacedFurniture>();
    const center = (f: PlacedFurniture) => ({ x: (f.x + f.w / 2) * ts, y: (f.y + f.d / 2) * ts });
    for (const spec of specs) {
      const candidates = map.furniture.filter((f) => spec.furniture.includes(f.type));
      for (const p of pointsOfType(map, spec.point)) {
        // El mueble del tipo más cercano al punto (un punto, un indicador; varios puntos pueden compartir mueble).
        let best: PlacedFurniture | null = null;
        let bestD = POINT_TO_FURNITURE_TILES * ts;
        for (const f of candidates) {
          const c = center(f);
          const d = Math.max(0, Math.abs(c.x - p.x) - (f.w * ts) / 2) + Math.max(0, Math.abs(c.y - p.y) - (f.d * ts) / 2);
          if (d <= bestD) {
            bestD = d;
            best = f;
          }
        }
        if (best) chosen.add(best);
      }
    }
    for (const f of map.furniture) if (ALWAYS.includes(f.type)) chosen.add(f);
    const add = (f: PlacedFurniture, near: boolean) => {
      const top = view.furnitureTop(f);
      if (!top) return;
      // Sobre la parte de arriba del mueble (no flotando lejos): se lee como un brillo del objeto.
      const img = this.scene.add.image(top.x + 3, top.y + 4, key).setOrigin(0.5, 0.5).setDepth(DEPTH_OVERLAY + 3).setAlpha(0);
      this.markers.push({ img, x: top.x + 3, y: top.y + 4, phase: ((f.x * 7 + f.y * 13) % 10) / 10, near: center(f), usable: near });
    };
    for (const f of chosen) add(f, false);
    for (const f of map.furniture) if (!chosen.has(f) && usableSpec(f.type)) add(f, true);
  }

  /** Titilar: cada tanto el destello aparece, crece un poco y se apaga. Solo si uno está cerca. `me` en px de mundo. */
  update(time: number, me: { x: number; y: number } | null, tileSize: number) {
    for (const m of this.markers) {
      const reach = (m.usable ? USABLE_NEAR_TILES : MAIN_NEAR_TILES) * tileSize;
      const close = !!me && Math.hypot(me.x - m.near.x, me.y - m.near.y) <= reach;
      if (!close) {
        m.img.setVisible(false);
        continue;
      }
      const t = ((time + m.phase * TWINKLE_EVERY_MS) % TWINKLE_EVERY_MS) / TWINKLE_MS;
      if (t >= 1) {
        m.img.setVisible(false);
        continue;
      }
      // Aparece y se apaga en pasos (como pixel-art) y sube un píxel en el pico.
      const a = Math.sin(t * Math.PI);
      m.img.setVisible(true).setAlpha(Math.round(a * 4) / 4).setY(m.y - (a > 0.7 ? 1 : 0));
    }
  }

  clear() {
    for (const m of this.markers) m.img.destroy();
    this.markers = [];
  }
}
