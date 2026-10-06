// La Feria de la cosecha en la escena: sobre la olla del sancocho, la barra pixel de lo que lleva y lo que
// falta (cada ingrediente con su dibujito y su rayita de avance, las ollas de la feria como puntos; dorada
// mientras hierve), y la música del baile del atardecer, que suena más fuerte cerca del patio (desde las
// 17:00 del juego, o desde que el director arrancó el baile). También avisa si estoy en la pista del patio
// (el chip de "Bailar"). Lo de la olla sale de `useCosechaStore` (cosecha.ts); la hora, del reloj del juego.
// Y lo que se mueve de la decoración (lo colgado de los puestos y del arco, la candela y el vapor de la olla,
// el tambor de la tómbola): cada mueble tiene sus cuadros (`COSECHA_FRAMES`) y aquí solo se le cambia la
// textura, con su desfase; con "menos movimiento", quietos.
import { type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { COSECHA_FRAMES, cosechaSprite, drawHeldItem, PixelCanvas } from "@hyvento/map/art";
import { COSECHA, COSECHA_SITIOS, OLLA_RECETA, cosechaActiva, enLaPista } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { CuerdasCosecha } from "./cosecha/musica";
import { setCosechaMap, useCosechaStore } from "./cosecha";
import { currentGameTime } from "./gameClock";
import { depthOf, ensureTexture, worldToScreen, type AreaView } from "./iso/view";
import { lessMotion } from "@/lib/prefs";
import { useOfficeStore } from "./store";

type RGBA = [number, number, number, number];
const CELL = 12;
const MADERA: RGBA = [122, 74, 40, 255];
const BORDE: RGBA = [58, 34, 20, 255];
const PAPEL: RGBA = [247, 235, 200, 255];
const VERDE: RGBA = [95, 168, 62, 255];
const ORO: RGBA = [243, 214, 114, 255];
const VACIO: RGBA = [90, 60, 40, 255];

/** Cuánto dura cada cuadro de lo que se mueve (ms). */
const CUADRO_MS = 200;
const texturaDe = (type: string, k: number) => `cosecha-decor-${type}-${k}`;

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
  private view?: AreaView;
  private piezas: { f: PlacedFurniture; n: number; desfase: number; img?: Phaser.GameObjects.Image; cuadro: number }[] = [];
  private reloj = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  setArea(map: OfficeMap, view: AreaView) {
    this.map = map;
    this.view = view;
    this.piezas = map.furniture
      .filter((f) => (COSECHA_FRAMES[f.type] ?? 0) > 1)
      .map((f) => ({ f, n: COSECHA_FRAMES[f.type]!, desfase: (f.x * 7 + f.y * 3) % 4, cuadro: 0 }));
    // Las texturas de los cuadros se arman una vez por tipo (el cuadro 0 es el del catálogo).
    for (const type of new Set(this.piezas.map((p) => p.f.type)))
      for (let k = 0; k < COSECHA_FRAMES[type]!; k++) ensureTexture(this.scene, texturaDe(type, k), () => cosechaSprite(type, k).canvas);
    setCosechaMap(map);
    const f = map.furniture.find((p) => p.type === "olla-sancocho");
    this.olla = f ? { x: f.x, y: f.y } : undefined;
    if (!this.olla) this.hide();
  }

  private hide() {
    this.img?.setVisible(false);
  }

  /** Pasa los cuadros de lo que se mueve. */
  private animar(delta: number) {
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

  update(me: { x: number; y: number } | undefined, delta: number) {
    this.animar(delta);
    const map = this.map;
    const fest = useOfficeStore.getState().festival;
    const abierta = cosechaActiva(fest.id, fest.fase);
    const ts = map?.tileSize ?? 32;
    // La música del baile: desde el atardecer, en el jardín, más fuerte cerca del patio.
    const t = currentGameTime();
    const st = useCosechaStore.getState();
    let vol = 0;
    const enJardin = abierta && map?.id === "jardin" && Boolean(me);
    const pista = enJardin && st.baile && enLaPista(me!.x / ts, me!.y / ts);
    if (pista !== st.enPista) useCosechaStore.setState({ enPista: pista });
    if (enJardin && me && ((t && t.minuteOfDay >= COSECHA.musicaDesde) || st.baile)) {
      const p = COSECHA_SITIOS.patio;
      const d = Math.hypot(me.x / ts - p.x, me.y / ts - p.y);
      vol = Math.max(0, 1 - d / MUSICA_TILES) * 0.55;
    }
    this.musica.update(vol);
    // La barra de la olla: solo cerca y con la olla todavía andando.
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
