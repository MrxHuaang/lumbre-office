// Indicadores de "aquí se puede hacer algo": un rombito dorado que flota y rebota sobre cada objeto con
// el que se interactúa (barra, tienda, probadores, mesas del casino, buzón…). Sobre los muebles que se
// usan (lámparas, tele, piano…) aparece solo cuando uno está cerca, para no llenar la pantalla.
import { pointsOfType, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { at, C, OUT, PixelCanvas } from "@hyvento/map/art";
import { usableSpec } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { AreaView, DEPTH_OVERLAY, ensureTexture } from "./iso/view";

/** Distancia (tiles) a la que aparece el indicador de un mueble que se usa. */
const USABLE_NEAR_TILES = 4;
/** Distancia (tiles) de un punto al mueble que lo marca. */
const POINT_TO_FURNITURE_TILES = 1.6;
/** Muebles con indicador aunque no tengan punto (se usan sentándose). */
const ALWAYS: readonly string[] = ["blackjack-table"];

function markerArt(): PixelCanvas {
  // Rombo de 9x11: dorado con brillo blanco arriba a la izquierda y contorno oscuro.
  const c = new PixelCanvas(11, 13);
  const rows = [1, 2, 3, 4, 5, 4, 3, 2, 1];
  for (let y = 0; y < rows.length; y++) {
    const half = rows[y]!;
    for (let x = 5 - half + 1; x <= 5 + half - 1; x++) c.set(x, y + 2, at(C.gold, x < 5 && y < 4 ? 5 : x > 5 || y > 4 ? 3 : 4));
  }
  c.set(4, 5, at(C.white, 4));
  c.set(5, 4, at(C.white, 4));
  c.set(4, 4, at(C.white, 4));
  c.outline(OUT);
  return c;
}

interface Marker {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  /** Mueble que se usa: solo se ve de cerca. */
  near?: { x: number; y: number };
  phase: number;
}

export class InteractMarkers {
  private markers: Marker[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Arma los indicadores del nivel: uno por mueble de cada objeto interactivo (junto a su punto) y los de los muebles que se usan. */
  setArea(map: OfficeMap, view: AreaView, specs: readonly { point: string; furniture: readonly string[] }[]) {
    this.clear();
    const key = ensureTexture(this.scene, "indicador-interaccion", markerArt);
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
      const img = this.scene.add.image(top.x, top.y - 6, key).setOrigin(0.5, 1).setDepth(DEPTH_OVERLAY + 3);
      this.markers.push({ img, x: top.x, y: top.y - 6, phase: (f.x * 7 + f.y * 13) % 10, near: near ? center(f) : undefined });
    };
    for (const f of chosen) add(f, false);
    for (const f of map.furniture) if (!chosen.has(f) && usableSpec(f.type)) add(f, true);
  }

  /** Rebote suave y, para los muebles que se usan, solo si uno está cerca. `me` en px de mundo. */
  update(time: number, me: { x: number; y: number } | null, tileSize: number) {
    for (const m of this.markers) {
      const bob = Math.round(Math.sin(time / 380 + m.phase) * 2);
      m.img.setY(m.y + bob);
      if (m.near) {
        const close = !!me && Math.hypot(me.x - m.near.x, me.y - m.near.y) <= USABLE_NEAR_TILES * tileSize;
        m.img.setVisible(close);
      }
    }
  }

  clear() {
    for (const m of this.markers) m.img.destroy();
    this.markers = [];
  }
}
