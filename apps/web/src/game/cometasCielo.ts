// El cielo del Festival de cometas en la escena: todas las cometas que vuelan, para todos (las de la gente,
// de `useCometasStore`, y las de los niños de la fiesta), cada una en su hilo hasta la mano de quien la
// sostiene, meciéndose y con la cola que ondea; más alto cuanto más subió, corridas hacia donde sopla el
// viento y zarandeadas cuando el hilo cruje. Quien vuela lleva el carrete en la mano (la cometa está allá
// arriba). Además, la decoración que se mueve: la manga de viento muestra hacia dónde y qué tan fuerte
// sopla, los banderines y las cometas amarradas ondean, y el árbol de Mateo y la escalera del garaje se
// quedan sin su cometa cuando ya se la bajaron a uno. Con "menos movimiento", todo quieto.
import { type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { arbolCometa, cometaCielo, COMETA_FRAMES, COMETAS_DECOR_FRAMES, cometasDecorSprite, escaleraGaraje, mangaViento } from "@hyvento/map/art";
import { gameMinutes, lineSeed, vientoDelClima, vientoRumbo, type Weather } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { lessMotion } from "@/lib/prefs";
import { serverNow } from "./club/store";
import { useCometasStore } from "./cometas";
import { genteCometas, useGenteFiesta } from "./genteFiesta";
import { DEPTH_OVERLAY, depthOf, ensureTexture, worldToScreen, type AreaView } from "./iso/view";
import { useOfficeStore } from "./store";

/** Lo que se lleva en la mano mientras la cometa vuela: el carrete de cabuya. */
const CARRETE = "carrete-cabuya";

/** El dibujo de cada cometa (no cambia: se arma una vez por código y cuadro). */
const skySprites = new Map<string, ReturnType<typeof cometaCielo>>();
function skySprite(code: string, frame: number) {
  const key = `${code}:${frame}`;
  let s = skySprites.get(key);
  if (!s) skySprites.set(key, (s = cometaCielo(code, frame)));
  return s;
}

/** Por encima de árboles y techos (como lo que vuela) y debajo del clima y de la noche. */
const DEPTH_SKY = DEPTH_OVERLAY - 4;
/** Cuánto sube en pantalla (px) a cierta altura (m): bien arriba, para que se vea que vuela. */
const liftOf = (altura: number) => 54 + Math.min(220, altura) * 1.3;
/** De dónde sale el hilo: la mano de quien la sostiene. */
const HAND_UP = 14;
/** Cuánto dura cada cuadro de la decoración que se mueve (ms): el viento no tiene afán. */
const CUADRO_MS = 240;

interface Kite {
  img: Phaser.GameObjects.Image;
  seen: boolean;
}

/** Quien sostiene una cometa (un avatar de la escena). */
export interface KiteHolder {
  x: number;
  y: number;
  setHeld(id: string, left?: string): void;
}

/** Un mueble del festival que cambia de dibujo (por el viento, por lo que pasó o porque se mueve). */
interface Pieza {
  f: PlacedFurniture;
  key: string;
  desfase: number;
}

const SWAPS = new Set(["manga-viento", "arbol-cometa", "escalera-garaje"]);

export class CometasCielo {
  private map?: OfficeMap;
  private view?: AreaView;
  private kites = new Map<string, Kite>();
  private hilos?: Phaser.GameObjects.Graphics;
  private piezas: Pieza[] = [];
  /** A quiénes les puse el carrete en la mano (sessionId). */
  private reels = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly avatarOf: (sessionId: string) => KiteHolder | undefined,
  ) {}

  setArea(map: OfficeMap, view: AreaView) {
    this.map = map;
    this.view = view;
    this.clear();
    this.piezas = map.furniture.filter((f) => SWAPS.has(f.type) || (COMETAS_DECOR_FRAMES[f.type] ?? 0) > 1).map((f) => ({ f, key: "", desfase: (f.x * 7 + f.y * 3) % 4 }));
  }

  destroy() {
    this.clear();
  }

  private clear() {
    for (const k of this.kites.values()) k.img.destroy();
    this.kites.clear();
    this.hilos?.destroy();
    this.hilos = undefined;
    this.restoreReels(new Set());
    this.piezas = [];
  }

  update(time: number) {
    const map = this.map;
    if (!map) return;
    const s = useOfficeStore.getState();
    const clock = s.gameClock;
    const total = clock ? gameMinutes(clock, serverNow()) : 0;
    const day = Math.floor(total / 1440);
    const rumbo = vientoRumbo(day, total - day * 1440);
    const viento = vientoDelClima(s.weather as Weather);
    const calm = lessMotion();
    this.updatePiezas(time, rumbo, viento, calm);
    const { vuelos } = useCometasStore.getState();
    const flying = new Set(map.id === "jardin" ? Object.keys(vuelos) : []);
    this.restoreReels(flying);
    if (map.id !== "jardin" && !this.kites.size) return;
    // Hacia dónde se corre en pantalla con el viento (la x de la vista isométrica es x - y del mundo).
    const drift = (Math.cos(rumbo) - Math.sin(rumbo)) / Math.SQRT2;
    for (const k of this.kites.values()) k.seen = false;
    const hilos = (this.hilos ??= this.scene.add.graphics().setDepth(DEPTH_SKY - 1));
    hilos.clear();
    if (map.id === "jardin") {
      for (const [sessionId, v] of Object.entries(vuelos)) {
        const who = this.avatarOf(sessionId);
        if (!who) continue;
        if (!this.reels.has(sessionId)) {
          who.setHeld(CARRETE);
          this.reels.add(sessionId);
        }
        this.draw(`p:${sessionId}`, v.code, who, v.altura, v.tenso, time, drift, calm, hilos);
      }
      // Los niños de la fiesta con su cometa (la de Mateo, solo cuando ya se la bajaron a uno).
      const hechos = useGenteFiesta.getState().hechos;
      for (const n of genteCometas()) {
        if (n.pedido && !hechos.has(n.pedido)) continue;
        const h = lineSeed(n.id);
        const altura = 30 + (h % 35) + (calm ? 0 : Math.sin(time / 1700 + h) * 4);
        this.draw(`n:${n.id}`, n.code, n, altura, false, time, drift, calm, hilos);
      }
    }
    for (const [key, k] of this.kites)
      if (!k.seen) {
        k.img.destroy();
        this.kites.delete(key);
      }
  }

  /** Les devuelve lo suyo a la mano a los que ya no vuelan (`flying`: los que siguen). */
  private restoreReels(flying: Set<string>) {
    if (!this.reels.size) return;
    const players = useOfficeStore.getState().players;
    for (const sessionId of [...this.reels]) {
      if (flying.has(sessionId)) continue;
      this.reels.delete(sessionId);
      const p = players[sessionId];
      this.avatarOf(sessionId)?.setHeld(p?.held ?? "", p?.heldLeft ?? "");
    }
  }

  /** Una cometa en el aire sobre quien la sostiene, con su hilo. */
  private draw(key: string, code: string, who: { x: number; y: number }, altura: number, tenso: boolean, time: number, drift: number, calm: boolean, hilos: Phaser.GameObjects.Graphics) {
    const h = lineSeed(key);
    const frame = calm ? 0 : Math.floor(time / 170 + h) % COMETA_FRAMES;
    const tex = `cometa-cielo-${code}-${frame}`;
    const sprite = skySprite(code, frame);
    ensureTexture(this.scene, tex, () => sprite.canvas);
    const base = worldToScreen(who.x, who.y);
    const lift = liftOf(altura);
    const sway = calm ? 0 : Math.sin(time / 650 + h) * 3 + (tenso ? Math.sin(time / 45) * 1.6 : 0);
    const kx = Math.round(base.x + drift * lift * 0.45 + sway);
    const ky = Math.round(base.y - HAND_UP - lift + (calm ? 0 : Math.cos(time / 900 + h) * 2));
    let k = this.kites.get(key);
    if (!k) {
      k = { img: this.scene.add.image(kx, ky, tex), seen: true };
      this.kites.set(key, k);
    }
    k.seen = true;
    k.img
      .setTexture(tex)
      .setOrigin(sprite.ox / sprite.canvas.width, sprite.oy / sprite.canvas.height)
      .setPosition(kx, ky)
      .setDepth(DEPTH_SKY + depthOf(who.x, who.y) * 1e-6);
    // El hilo: de la mano a la cometa, con su comba.
    const hx = base.x + 3;
    const hy = base.y - HAND_UP;
    hilos.lineStyle(1, tenso ? 0xfff0c8 : 0xe8d6a8, 0.9);
    hilos.beginPath();
    hilos.moveTo(hx, hy);
    const comba = tenso ? 2 : 8 + lift * 0.06;
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      hilos.lineTo(hx + (kx - hx) * t, hy + (ky - hy) * t + Math.sin(t * Math.PI) * comba);
    }
    hilos.strokePath();
  }

  /**
   * Los muebles que cambian: la manga sigue al viento, el árbol y la escalera a lo mío y lo que ondea pasa
   * sus cuadros. Todos los dibujos de un mueble tienen el mismo lienzo y origen: solo se cambia la textura.
   */
  private updatePiezas(time: number, rumbo: number, viento: number, calm: boolean) {
    if (!this.piezas.length || !this.view) return;
    const dir = ((Math.round(rumbo / (Math.PI / 2)) % 4) + 4) % 4;
    const nivel = viento <= 0 ? 0 : viento < 0.6 ? 1 : 2;
    const paso = Math.floor(time / CUADRO_MS);
    const ondea = calm || nivel === 0 ? 0 : Math.floor(time / (nivel === 2 ? 220 : 420)) % 2;
    const hechos = useGenteFiesta.getState().hechos;
    const techo = useCometasStore.getState().mine.techo;
    for (const p of this.piezas) {
      const t = p.f.type;
      let key: string;
      let make: () => ReturnType<typeof mangaViento>;
      if (t === "manga-viento") {
        key = `manga-viento-${dir}-${nivel}-${ondea}`;
        make = () => mangaViento(dir, nivel, ondea);
      } else if (t === "arbol-cometa") {
        const con = !hechos.has("gancho-mateo");
        key = `arbol-cometa-${con ? 1 : 0}`;
        make = () => arbolCometa(con);
      } else if (t === "escalera-garaje") {
        key = `escalera-garaje-${techo ? 0 : 1}`;
        make = () => escaleraGaraje(!techo);
      } else {
        const n = COMETAS_DECOR_FRAMES[t] ?? 1;
        const k = calm ? 0 : (paso + p.desfase) % n;
        key = `cometas-decor-${t}-${k}`;
        make = () => cometasDecorSprite(t, k);
      }
      if (key === p.key) continue;
      const img = this.view.imageOf(p.f);
      if (!img) continue;
      ensureTexture(this.scene, key, () => make().canvas);
      img.setTexture(key);
      p.key = key;
    }
  }
}
