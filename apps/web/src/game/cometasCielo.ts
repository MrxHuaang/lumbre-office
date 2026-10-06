// El cielo del Festival de cometas en la escena: todas las cometas que vuelan, para todos (las de la gente,
// de `useCometasStore`, y las de los niños de la fiesta), cada una en su hilo hasta la mano de quien la
// sostiene, meciéndose y con la cola que ondea; más alto cuanto más subió, corridas hacia donde sopla el
// viento y zarandeadas cuando el hilo cruje. Además: la manga de viento que muestra hacia dónde y qué tan
// fuerte sopla, y el árbol de Mateo y la escalera del garaje sin su cometa cuando ya se la bajaron a uno.
import { type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { arbolCometa, cometaCielo, COMETA_FRAMES, escaleraGaraje, mangaViento } from "@hyvento/map/art";
import { gameMinutes, lineSeed, vientoDelClima, vientoRumbo, type Weather } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { lessMotion } from "@/lib/prefs";
import { serverNow } from "./club/store";
import { useCometasStore } from "./cometas";
import { genteCometas, useGenteFiesta } from "./genteFiesta";
import { depthOf, ensureTexture, worldToScreen, type AreaView } from "./iso/view";
import { useOfficeStore } from "./store";

/** El dibujo de cada cometa (no cambia: se arma una vez por código y cuadro). */
const skySprites = new Map<string, ReturnType<typeof cometaCielo>>();
function skySprite(code: string, frame: number) {
  const key = `${code}:${frame}`;
  let s = skySprites.get(key);
  if (!s) skySprites.set(key, (s = cometaCielo(code, frame)));
  return s;
}

/** Por encima de árboles, techos y nombres: las cometas van en el cielo. */
const DEPTH_SKY = 4.9e7;
/** Cuánto sube en pantalla (px) a cierta altura (m), y desde dónde sale el hilo (la mano). */
const liftOf = (altura: number) => 26 + Math.min(220, altura) * 0.8;
const HAND_UP = 14;

interface Kite {
  img: Phaser.GameObjects.Image;
  seen: boolean;
}

/** Un mueble con su dibujo de reemplazo (la manga según el viento, el árbol y la escalera sin cometa). */
interface Swap {
  f: PlacedFurniture;
  img?: Phaser.GameObjects.Image;
  key: string;
}

export class CometasCielo {
  private map?: OfficeMap;
  private view?: AreaView;
  private kites = new Map<string, Kite>();
  private hilos?: Phaser.GameObjects.Graphics;
  private swaps = new Map<string, Swap>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly avatarOf: (sessionId: string) => { x: number; y: number } | undefined,
  ) {}

  setArea(map: OfficeMap, view: AreaView) {
    this.map = map;
    this.view = view;
    this.clear();
    for (const f of map.furniture) if (f.type === "manga-viento" || f.type === "arbol-cometa" || f.type === "escalera-garaje") this.swaps.set(`${f.type}:${f.x},${f.y}`, { f, key: "" });
  }

  destroy() {
    this.clear();
  }

  private clear() {
    for (const k of this.kites.values()) k.img.destroy();
    this.kites.clear();
    this.hilos?.destroy();
    this.hilos = undefined;
    for (const s of this.swaps.values()) s.img?.destroy();
    this.swaps.clear();
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
    this.updateSwaps(time, rumbo, viento);
    if (map.id !== "jardin" && !this.kites.size) return;
    // Hacia dónde se corre en pantalla con el viento (la x de la vista isométrica es x - y del mundo).
    const drift = (Math.cos(rumbo) - Math.sin(rumbo)) / Math.SQRT2;
    const calm = lessMotion();
    for (const k of this.kites.values()) k.seen = false;
    const hilos = (this.hilos ??= this.scene.add.graphics().setDepth(DEPTH_SKY - 1));
    hilos.clear();
    if (map.id === "jardin") {
      const { vuelos } = useCometasStore.getState();
      for (const [sessionId, v] of Object.entries(vuelos)) {
        const who = this.avatarOf(sessionId);
        if (who) this.draw(`p:${sessionId}`, v.code, who, v.altura, v.tenso, time, drift, calm, hilos);
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
    const comba = tenso ? 2 : 8 + lift * 0.08;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      hilos.lineTo(hx + (kx - hx) * t, hy + (ky - hy) * t + Math.sin(t * Math.PI) * comba);
    }
    hilos.strokePath();
  }

  /** La manga sigue al viento; el árbol y la escalera, a lo mío. */
  private updateSwaps(time: number, rumbo: number, viento: number) {
    if (!this.swaps.size || !this.view) return;
    const ts = this.map!.tileSize;
    const dir = ((Math.round(rumbo / (Math.PI / 2)) % 4) + 4) % 4;
    const nivel = viento <= 0 ? 0 : viento < 0.6 ? 1 : 2;
    const ondea = lessMotion() || nivel === 0 ? 0 : Math.floor(time / (nivel === 2 ? 220 : 420)) % 2;
    const hechos = useGenteFiesta.getState().hechos;
    const techo = useCometasStore.getState().mine.techo;
    for (const s of this.swaps.values()) {
      const t = s.f.type;
      let key = "";
      let draw: (() => ReturnType<typeof mangaViento>) | null = null;
      if (t === "manga-viento") {
        key = `manga-viento-${dir}-${nivel}-${ondea}`;
        draw = () => mangaViento(dir, nivel, ondea);
      } else if (t === "arbol-cometa" && hechos.has("gancho-mateo")) {
        key = "arbol-cometa-libre";
        draw = () => arbolCometa(false);
      } else if (t === "escalera-garaje" && techo) {
        key = "escalera-garaje-libre";
        draw = () => escaleraGaraje(false);
      }
      if (key === s.key) continue;
      s.key = key;
      const original = this.view.imageOf(s.f);
      if (!draw) {
        s.img?.destroy();
        s.img = undefined;
        original?.setAlpha(1);
        continue;
      }
      const sprite = draw();
      ensureTexture(this.scene, key, () => sprite.canvas);
      const a = worldToScreen(s.f.x * ts, s.f.y * ts);
      s.img ??= this.scene.add.image(0, 0, key).setOrigin(0, 0);
      s.img
        .setTexture(key)
        .setPosition(a.x - sprite.ox, a.y - sprite.oy)
        .setDepth(depthOf((s.f.x + s.f.w / 2) * ts, (s.f.y + s.f.d / 2) * ts) + 0.01);
      original?.setAlpha(0);
    }
  }
}
