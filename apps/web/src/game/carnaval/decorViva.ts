// La decoración del Carnaval que se mueve (VIR-176): los banderines y las guirnaldas ondean, los faroles de
// papel y los globos se mecen, las cintas de los postes y de los mascarones vuelan y las ollas de los puestos
// echan humo. Cada mueble tiene sus cuadros (`CARNAVAL_DECOR_FRAMES`, todos con el lienzo y el origen del
// dibujo del catálogo): aquí solo se le cambia la textura a su imagen, cada uno con su propio desfase para
// que no se muevan todos a la vez. Con "menos movimiento" se quedan quietos.
import { type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { CARNAVAL_DECOR_FRAMES, carnavalDecorSprite } from "@hyvento/map/art";
import type * as Phaser from "phaser";
import { lessMotion } from "@/lib/prefs";
import { ensureTexture } from "../iso/canvas";
import type { AreaView } from "../iso/view";

/** Cuánto dura cada cuadro (ms): el viento no tiene afán. */
const CUADRO_MS = 240;

interface Pieza {
  f: PlacedFurniture;
  n: number;
  desfase: number;
  img?: Phaser.GameObjects.Image;
  cuadro: number;
}

const texturaDe = (type: string, k: number) => `carnaval-decor-${type}-${k}`;

export class DecorCarnavalViva {
  private piezas: Pieza[] = [];
  private view?: AreaView;
  private reloj = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  setArea(map: OfficeMap, view: AreaView) {
    this.view = view;
    this.piezas = map.furniture
      .filter((f) => (CARNAVAL_DECOR_FRAMES[f.type] ?? 0) > 1)
      .map((f) => ({ f, n: CARNAVAL_DECOR_FRAMES[f.type]!, desfase: (f.x * 7 + f.y * 3) % 4, cuadro: 0 }));
    // Las texturas de los cuadros se arman una vez por tipo (el cuadro 0 es el del catálogo).
    for (const type of new Set(this.piezas.map((p) => p.f.type)))
      for (let k = 0; k < CARNAVAL_DECOR_FRAMES[type]!; k++) ensureTexture(this.scene, texturaDe(type, k), () => carnavalDecorSprite(type, k).canvas);
  }

  update(delta: number) {
    if (!this.piezas.length || !this.view || lessMotion()) return;
    this.reloj += delta;
    const paso = Math.floor(this.reloj / CUADRO_MS);
    for (const p of this.piezas) {
      const cuadro = (paso + p.desfase) % p.n;
      if (cuadro === p.cuadro) continue;
      p.img ??= this.view.imageOf(p.f);
      if (!p.img) continue;
      p.cuadro = cuadro;
      p.img.setTexture(texturaDe(p.f.type, cuadro));
    }
  }
}
