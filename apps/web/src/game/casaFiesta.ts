// Las luces de la fiesta (casa-fiesta.ts de @hyvento/shared): con el modo fiesta prendido, la bola de
// discoteca de la sala de fiestas reparte manchas de colores que giran sobre el piso de la sala (y sobre
// quienes bailan). Es solo dibujo: una capa que suma luz (blend ADD), con "menos movimiento" quieta.
import { CASA_SALA_FIESTAS, type OfficeMap } from "@hyvento/map";
import { casaOwnerOf, parseCasaArea } from "@hyvento/shared";
import * as Phaser from "phaser";
import { lessMotion } from "@/lib/prefs";
import { useCasasStore } from "./casaVisitas";
import { DEPTH_OVERLAY, worldToScreen } from "./iso/view";

/** Los colores de los espejitos: rosado, cian, amarillo, verde lima y violeta. */
const COLORS = [0xff5fd2, 0x55e6ff, 0xffe066, 0x9dff5c, 0xb07cff];
const SPOTS = 9;

export class FiestaLuces {
  private gfx?: Phaser.GameObjects.Graphics;
  private map?: OfficeMap;

  constructor(private readonly scene: Phaser.Scene) {}

  setArea(map: OfficeMap) {
    this.map = map;
    if (!this.isSalaDeFiestas()) this.clear();
  }

  /** Cada cuadro: si hay fiesta en esta casa, las manchas giran alrededor de la bola. */
  update(time: number) {
    const map = this.map;
    const owner = map ? casaOwnerOf(map.id) : null;
    const on = Boolean(owner && this.isSalaDeFiestas() && useCasasStore.getState().casas[owner]?.fiesta);
    if (!on || !map) return this.clear();
    this.gfx ??= this.scene.add.graphics().setDepth(DEPTH_OVERLAY - 5).setBlendMode(Phaser.BlendModes.ADD);
    const g = this.gfx.clear();
    const ts = map.tileSize;
    const r = CASA_SALA_FIESTAS;
    const cx = (r.x + r.w / 2) * ts;
    const cy = (r.y + r.h / 2) * ts;
    const t = lessMotion() ? 0 : time / 1000;
    for (let i = 0; i < SPOTS; i++) {
      // Cada mancha da vueltas a su propio radio y velocidad, y titila un poco.
      const a = t * (0.5 + (i % 3) * 0.18) + (i * Math.PI * 2) / SPOTS;
      const rad = (0.28 + 0.12 * (i % 4)) * Math.min(r.w, r.h) * ts;
      const x = Phaser.Math.Clamp(cx + Math.cos(a) * rad, r.x * ts + 8, (r.x + r.w) * ts - 8);
      const y = Phaser.Math.Clamp(cy + Math.sin(a) * rad * 1.3, r.y * ts + 8, (r.y + r.h) * ts - 8);
      const p = worldToScreen(x, y);
      const alpha = 0.16 + 0.08 * Math.sin(t * 3 + i);
      g.fillStyle(COLORS[i % COLORS.length]!, alpha);
      g.fillEllipse(p.x, p.y, 22, 11);
    }
  }

  destroy() {
    this.clear();
  }

  private isSalaDeFiestas(): boolean {
    return Boolean(this.map && parseCasaArea(this.map.id)?.piso === "abajo");
  }

  private clear() {
    this.gfx?.destroy();
    this.gfx = undefined;
  }
}
