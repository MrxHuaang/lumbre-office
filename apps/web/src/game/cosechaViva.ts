// La Feria de la cosecha en la escena: sobre la olla del sancocho, la barra pixel de lo que lleva y lo que
// falta (cada ingrediente con su dibujito y su rayita de avance, las ollas de la feria como puntos; dorada
// mientras hierve), y la música del baile del atardecer, que suena más fuerte cerca del patio. Lo de la olla
// sale de `useCosechaStore` (cosecha.ts); la hora, del reloj del juego.
import { type OfficeMap } from "@hyvento/map";
import { drawHeldItem, PixelCanvas } from "@hyvento/map/art";
import { COSECHA, COSECHA_SITIOS, OLLA_RECETA, cosechaActiva } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { CuerdasCosecha } from "./cosecha/musica";
import { setCosechaMap, useCosechaStore } from "./cosecha";
import { currentGameTime } from "./gameClock";
import { depthOf, ensureTexture, worldToScreen } from "./iso/view";
import { useOfficeStore } from "./store";

type RGBA = [number, number, number, number];
const CELL = 12;
const MADERA: RGBA = [122, 74, 40, 255];
const BORDE: RGBA = [58, 34, 20, 255];
const PAPEL: RGBA = [247, 235, 200, 255];
const VERDE: RGBA = [95, 168, 62, 255];
const ORO: RGBA = [243, 214, 114, 255];
const VACIO: RGBA = [90, 60, 40, 255];

/** Cuánto se ve la barra (tiles) y hasta dónde llega la música del patio. */
const BARRA_TILES = 13;
const MUSICA_TILES = 26;

function set(c: PixelCanvas, x: number, y: number, col: RGBA) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  c.set(x, y, col);
}

/** La barra: una tablita con un casillero por ingrediente (dibujo y avance) y abajo las ollas de la feria. */
function barra(aportado: Record<string, number>, hirviendo: boolean, olla: number): PixelCanvas {
  const items = Object.keys(OLLA_RECETA);
  const w = items.length * CELL + 4;
  const h = CELL + 12;
  const c = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(c, x, y, x === 0 || y === 0 || x === w - 1 || y === h - 1 ? BORDE : y < CELL + 3 ? PAPEL : MADERA);
  items.forEach((item, i) => {
    const art = drawHeldItem(item);
    const need = OLLA_RECETA[item]!;
    const have = Math.min(need, aportado[item] ?? 0);
    const ox = 2 + i * CELL + Math.floor((CELL - art.width) / 2);
    const oy = 2 + (CELL - art.height);
    const lleno = have >= need;
    for (let y = 0; y < art.height; y++)
      for (let x = 0; x < art.width; x++) {
        const k = (y * art.width + x) * 4;
        if (!art.data[k + 3]) continue;
        // Lo que todavía falta se ve apagado.
        const f = lleno || hirviendo ? 1 : 0.55;
        set(c, ox + x, oy + y, [Math.round(art.data[k]! * f), Math.round(art.data[k + 1]! * f), Math.round(art.data[k + 2]! * f), 255]);
      }
    // La rayita de avance de ese ingrediente.
    const bx = 2 + i * CELL + 1;
    const fill = Math.round(((CELL - 2) * have) / need);
    for (let x = 0; x < CELL - 2; x++) for (let y = 0; y < 2; y++) set(c, bx + x, CELL + 4 + y, hirviendo ? ORO : x < fill ? VERDE : VACIO);
  });
  // Las ollas de la feria: las servidas en oro, la de ahora en verde.
  for (let k = 0; k < COSECHA.ollasMax; k++) {
    const col = k + 1 < olla ? ORO : k + 1 === olla ? VERDE : VACIO;
    for (let x = 0; x < 3; x++) for (let y = 0; y < 2; y++) set(c, w - 4 - (COSECHA.ollasMax - 1 - k) * 4 - 2 + x, CELL + 8 + y, col);
  }
  return c;
}

export class CosechaViva {
  private map?: OfficeMap;
  private olla?: { x: number; y: number };
  private img?: Phaser.GameObjects.Image;
  private key = "";
  private musica = new CuerdasCosecha();

  constructor(private readonly scene: Phaser.Scene) {}

  setArea(map: OfficeMap) {
    this.map = map;
    setCosechaMap(map);
    const f = map.furniture.find((p) => p.type === "olla-sancocho");
    this.olla = f ? { x: f.x, y: f.y } : undefined;
    if (!this.olla) this.hide();
  }

  private hide() {
    this.img?.setVisible(false);
  }

  update(me: { x: number; y: number } | undefined) {
    const map = this.map;
    const fest = useOfficeStore.getState().festival;
    const abierta = cosechaActiva(fest.id, fest.fase);
    const ts = map?.tileSize ?? 32;
    // La música del baile: desde el atardecer, en el jardín, más fuerte cerca del patio.
    const t = currentGameTime();
    let vol = 0;
    if (abierta && map?.id === "jardin" && me && t && t.minuteOfDay >= COSECHA.musicaDesde) {
      const p = COSECHA_SITIOS.patio;
      const d = Math.hypot(me.x / ts - p.x, me.y / ts - p.y);
      vol = Math.max(0, 1 - d / MUSICA_TILES) * 0.55;
    }
    this.musica.update(vol);
    // La barra de la olla: solo cerca y con la olla todavía andando.
    const st = useCosechaStore.getState();
    const o = this.olla;
    if (!abierta || !o || !me || st.ollaFase === "acabada" || Math.hypot(me.x / ts - (o.x + 1), me.y / ts - (o.y + 1)) > BARRA_TILES) return this.hide();
    const hirviendo = st.ollaFase === "hirviendo";
    const key = `cosecha-olla-${st.olla}-${hirviendo ? "h" : ""}-${Object.keys(OLLA_RECETA)
      .map((k) => st.aportado[k] ?? 0)
      .join(".")}`;
    if (key !== this.key) {
      this.key = key;
      ensureTexture(this.scene, key, () => barra(st.aportado, hirviendo, st.olla));
      const s = worldToScreen((o.x + 1) * ts, (o.y + 1) * ts);
      if (!this.img) this.img = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
      this.img.setTexture(key).setPosition(Math.round(s.x), Math.round(s.y - 46)).setDepth(depthOf((o.x + 2) * ts, (o.y + 2) * ts) + 1);
    }
    this.img?.setVisible(true);
  }

  destroy() {
    this.musica.stop();
    this.img?.destroy();
    this.img = undefined;
  }
}
