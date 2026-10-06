// Las ventanas prendidas de noche (VIR-178): la cabaña, el garaje, la casa del árbol, la estación, la casona
// de cada persona, su parada y el observatorio. Las posiciones y las capas salen de @hyvento/map/art
// (luces-ventanas.ts); aquí solo se ponen: por cada ventana, el resplandor (ADD, encima de la penumbra) y su
// forma en la penumbra (hueco si está prendida, más oscura si no) para AreaView. Cuál está prendida lo dice
// la hora del juego del servidor (todos ven lo mismo); se revisa una vez por minuto del juego y la noche se
// vuelve a dibujar solo si algo cambió. Las que titilan cambian su brillo en cada cuadro (es un alfa).
import { catalogItem, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { capasDeLuz, lucesDeEdificio, luzPrendida, semillaDeLuz, titila, titileo, type DibujosDelEdificio, type VentanaLuz } from "@hyvento/map/art";
import * as Phaser from "phaser";
import { lessMotion } from "@/lib/prefs";
import { currentGameTime } from "./gameClock";
import { DEPTH_OVERLAY, ensureTexture, furniturePixels, toHtmlCanvas, worldToScreen, type AreaView, type NightShape } from "./iso/view";
import { useOfficeStore } from "./store";

interface Luz {
  v: VentanaLuz;
  semilla: number;
  titila: boolean;
  brillo: Phaser.GameObjects.Image;
  hueco: NightShape;
  oscuro: NightShape;
  prendida: boolean;
}

/** Los dibujos de cada edificio (de noche y de día) ya leídos: se leen una vez por sesión. */
const dibujos = new Map<string, DibujosDelEdificio>();
/** Las formas de la penumbra de cada ventana, como canvas (una vez por ventana). */
const formas = new Map<string, { hueco: HTMLCanvasElement; oscuro: HTMLCanvasElement }>();

/** Cada cuánto se revisa qué ventanas están prendidas (un minuto del juego son 2,5 s reales). */
const CADA_MS = 2_500;

export class LucesVentanas {
  private view?: AreaView;
  private map?: OfficeMap;
  private luces: Luz[] = [];
  private armado = false;
  private revisado = -Infinity;
  private unsub: () => void;

  constructor(private readonly scene: Phaser.Scene) {
    this.unsub = useOfficeStore.subscribe((s, prev) => {
      if (s.night !== prev.night) this.revisar(true);
    });
  }

  setArea(map: OfficeMap, view: AreaView | undefined) {
    this.limpiar();
    this.map = map;
    this.view = view;
    this.revisar(true);
  }

  /** Arma las luces del nivel (la primera noche que se ve): solo los edificios con ventanas en los datos. */
  private armar() {
    this.armado = true;
    const map = this.map;
    if (!map || !map.outdoor) return;
    const ts = map.tileSize;
    for (const f of map.furniture) {
      const lista = lucesDeEdificio(f.type);
      if (!lista || !catalogItem(f.type).fixed) continue;
      const d = this.dibujosDe(f.type);
      lista.forEach((v, i) => this.agregar(f, v, i, d, ts));
    }
  }

  private dibujosDe(type: string): DibujosDelEdificio {
    let d = dibujos.get(type);
    if (!d) dibujos.set(type, (d = { noche: furniturePixels(this.scene, type, true), dia: furniturePixels(this.scene, type, false) }));
    return d;
  }

  private agregar(f: PlacedFurniture, v: VentanaLuz, i: number, d: DibujosDelEdificio, ts: number) {
    const capas = capasDeLuz(f.type, i, d);
    if (!capas) return;
    const key = `luz-ventana-${f.type}-${i}`;
    let forma = formas.get(key);
    if (!forma) formas.set(key, (forma = { hueco: toHtmlCanvas(capas.hueco.canvas), oscuro: toHtmlCanvas(capas.oscuro.canvas) }));
    ensureTexture(this.scene, key, () => capas.brillo.canvas);
    const a = worldToScreen(f.x * ts, f.y * ts);
    const x = Math.round(a.x - capas.brillo.ox);
    const y = Math.round(a.y - capas.brillo.oy);
    const brillo = this.scene.add.image(x, y, key).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_OVERLAY + 1).setVisible(false);
    const semilla = semillaDeLuz(f.type, f.x, f.y, i);
    this.luces.push({
      v,
      semilla,
      titila: titila(v, semilla),
      brillo,
      hueco: { canvas: forma.hueco, x, y, mode: "hueco" },
      oscuro: { canvas: forma.oscuro, x, y, mode: "oscuro" },
      prendida: false,
    });
  }

  /** Qué ventanas van prendidas ahora; si algo cambió, la penumbra se vuelve a dibujar una vez. */
  private revisar(forzar = false) {
    const night = useOfficeStore.getState().night;
    if (!night && !this.luces.length) return;
    if (night && !this.armado) this.armar();
    const t = currentGameTime();
    // Sin reloj todavía (no debería pasar de noche), como a las 21:30.
    const dia = t?.day ?? 0;
    const minuto = t?.minuteOfDay ?? 21 * 60 + 30;
    let cambio = forzar;
    for (const l of this.luces) {
      const on = night && luzPrendida(l.v, l.semilla, dia, minuto);
      if (on === l.prendida) continue;
      l.prendida = on;
      l.brillo.setVisible(on).setAlpha(1);
      cambio = true;
    }
    if (cambio) this.view?.setNightShapes(night ? this.luces.map((l) => (l.prendida ? l.hueco : l.oscuro)) : []);
  }

  update(time: number) {
    if (!this.luces.length) return;
    if (time - this.revisado > CADA_MS) {
      this.revisado = time;
      this.revisar();
    }
    // El titileo de las velas y los fogones (con "menos movimiento", quietas).
    if (lessMotion()) return;
    for (const l of this.luces) if (l.prendida && l.titila) l.brillo.setAlpha(titileo(l.semilla, time));
  }

  private limpiar() {
    for (const l of this.luces) l.brillo.destroy();
    this.luces = [];
    this.armado = false;
    this.revisado = -Infinity;
  }

  destroy() {
    this.unsub();
    this.limpiar();
  }
}
