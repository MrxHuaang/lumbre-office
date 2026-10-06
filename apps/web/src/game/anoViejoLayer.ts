// El Año viejo en Phaser (el estado está en anoViejo.ts): el muñeco sentado en su silla, que crece por
// etapas con lo que le dan entre todos; la quema en el brasero (el fuego por cuadros, primero con el muñeco
// adentro); las luces de colores que suben al cielo en la quema y en el año nuevo (sin pólvora: lucecitas
// que suben, se abren en corona y se apagan despacio); y, con la maleta en la mano, la marquita que señala
// la parada que sigue de la vuelta al jardín.
import { type OfficeMap } from "@hyvento/map";
import { FUEGO_CUADROS, fuegoBrasero, LUCES_COLORES, luzDeColor, marcaMaleta, munecoEnSilla } from "@hyvento/map/art";
import { ANO_VIEJO, ANO_VIEJO_PLAZA, MALETA_OBJ, MALETA_RUTA } from "@hyvento/shared";
import * as Phaser from "phaser";
import { paradaSenalada } from "@/lib/anoViejo";
import { lessMotion } from "@/lib/prefs";
import { anoViejoAbierto, useAnoViejoStore } from "./anoViejo";
import { serverNow } from "./club/store";
import { DEPTH_OVERLAY, depthOf, ensureTexture, worldToScreen } from "./iso/view";
import { useOfficeStore } from "./store";

/** Cada cuánto cambia el cuadro del fuego (ms). */
const FUEGO_MS = 130;
/** Lo que el fuego tiene al muñeco adentro (parte de `ANO_VIEJO.fuegoMs`). */
const CON_MUNECO = 0.55;
/** Lo que duran las luces del cielo después de la quema y del año nuevo (ms). */
const LUCES_QUEMA_MS = 14_000;
const LUCES_ANO_MS = 12_000;

interface Luz {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  start: number;
  ms: number;
  /** Las que suben y al llegar se abren en corona. */
  sube?: { color: string; alto: number };
}

export class AnoViejoLayer {
  private map?: OfficeMap;
  private muneco?: Phaser.GameObjects.Image;
  private fuego?: Phaser.GameObjects.Image;
  private marca?: Phaser.GameObjects.Image;
  private marcaY = 0;
  private luces: Luz[] = [];
  /** Hasta cuándo (ms de la escena) se siguen soltando luces y cuándo sale la siguiente. */
  private lucesHasta = 0;
  private proxima = 0;
  private fuegoCuadro = -1;
  private fuegoConMuneco = false;
  private cleanups: (() => void)[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.cleanups.push(
      useAnoViejoStore.subscribe((s, prev) => {
        if (s.etapa !== prev.etapa || s.quemadoAt !== prev.quemadoAt) this.syncMuneco();
        // La quema y el año nuevo sueltan luces de colores al cielo.
        if (s.quemadoAt && !prev.quemadoAt && serverNow() - s.quemadoAt < ANO_VIEJO.fuegoMs) this.soltarLuces(LUCES_QUEMA_MS);
        if (s.anoNuevoAt !== prev.anoNuevoAt && s.anoNuevoAt) this.soltarLuces(LUCES_ANO_MS);
      }),
    );
  }

  setArea(map: OfficeMap) {
    this.map = map;
    this.clearLuces();
    this.fuego?.destroy();
    this.fuego = undefined;
    this.fuegoCuadro = -1;
    this.marca?.destroy();
    this.marca = undefined;
    this.syncMuneco();
  }

  private silla() {
    return this.map?.furniture.find((f) => f.type === "silla-muneco");
  }

  private brasero() {
    return this.map?.furniture.find((f) => f.type === "brasero-piedra");
  }

  /** El muñeco en su silla (hasta que se quema), con el dibujo de su etapa. */
  private syncMuneco() {
    this.muneco?.destroy();
    this.muneco = undefined;
    const map = this.map;
    const f = this.silla();
    const { etapa, quemadoAt } = useAnoViejoStore.getState();
    if (!map || !f || quemadoAt || !this.scene.sys.isActive()) return;
    const ts = map.tileSize;
    const s = munecoEnSilla(etapa);
    const key = ensureTexture(this.scene, `ano-viejo-muneco-${etapa}`, () => s.canvas);
    const a = worldToScreen(f.x * ts, f.y * ts);
    this.muneco = this.scene.add
      .image(a.x - s.ox, a.y - s.oy, key)
      .setOrigin(0, 0)
      .setDepth(depthOf((f.x + 0.5) * ts, (f.y + 0.5) * ts) + 0.01);
  }

  /** El fuego del brasero mientras dura la quema (el cuadro que toca; con "menos movimiento", uno solo). */
  private updateFuego(time: number) {
    const map = this.map;
    const f = this.brasero();
    const { quemadoAt } = useAnoViejoStore.getState();
    const t = quemadoAt ? serverNow() - quemadoAt : Infinity;
    if (!map || !f || t < 0 || t > ANO_VIEJO.fuegoMs) {
      this.fuego?.destroy();
      this.fuego = undefined;
      this.fuegoCuadro = -1;
      return;
    }
    const cuadro = lessMotion() ? 0 : Math.floor(time / FUEGO_MS) % FUEGO_CUADROS;
    const conMuneco = t < ANO_VIEJO.fuegoMs * CON_MUNECO;
    if (cuadro === this.fuegoCuadro && conMuneco === this.fuegoConMuneco && this.fuego) return;
    this.fuegoCuadro = cuadro;
    this.fuegoConMuneco = conMuneco;
    const s = fuegoBrasero(cuadro, conMuneco);
    const key = ensureTexture(this.scene, `ano-viejo-fuego-${conMuneco ? "m" : "s"}-${cuadro}`, () => s.canvas);
    const ts = map.tileSize;
    const a = worldToScreen(f.x * ts, f.y * ts);
    if (!this.fuego) this.fuego = this.scene.add.image(0, 0, key).setOrigin(0, 0);
    this.fuego
      .setTexture(key)
      .setPosition(a.x - s.ox, a.y - s.oy)
      .setDepth(depthOf((f.x + 1) * ts, (f.y + 1) * ts) + 0.02);
  }

  /** La marquita de la parada que sigue de la vuelta de la maleta (o de la salida, con la maleta en la mano). */
  private updateMarca(time: number) {
    const map = this.map;
    const s = useOfficeStore.getState();
    const held = s.sessionId ? s.players[s.sessionId]?.held : "";
    const { maleta } = useAnoViejoStore.getState().mine;
    const parada = paradaSenalada(maleta, held === MALETA_OBJ);
    if (!map || map.id !== ANO_VIEJO.area || parada === null || !anoViejoAbierto()) {
      this.marca?.destroy();
      this.marca = undefined;
      return;
    }
    const p = MALETA_RUTA[parada]!;
    const ts = map.tileSize;
    const at = worldToScreen((p.x + 0.5) * ts, (p.y + 0.5) * ts);
    this.marcaY = Math.round(at.y - 18);
    if (!this.marca) {
      const key = ensureTexture(this.scene, "ano-viejo-marca-maleta", () => marcaMaleta());
      this.marca = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
    }
    const salto = lessMotion() ? 0 : Math.round(Math.abs(Math.sin(time / 300)) * 4);
    this.marca.setPosition(Math.round(at.x), this.marcaY - salto).setDepth(5e7 + depthOf((p.x + 0.5) * ts, (p.y + 0.5) * ts));
  }

  // ---------- Las luces de colores del cielo ----------

  private soltarLuces(ms: number) {
    if (this.map?.id !== ANO_VIEJO.area) return;
    this.lucesHasta = this.scene.time.now + ms;
    this.proxima = this.scene.time.now;
  }

  private textura(color: string) {
    return ensureTexture(this.scene, `ano-viejo-luz-${color}`, () => luzDeColor(color));
  }

  /** Una luz que sube desde los alrededores de la plaza (o, con "menos movimiento", una corona quieta que se prende). */
  private lanzar(time: number) {
    const map = this.map;
    if (!map) return;
    const ts = map.tileSize;
    const B = ANO_VIEJO_PLAZA.brasero;
    const color = LUCES_COLORES[Math.floor(Math.random() * LUCES_COLORES.length)]!;
    const wx = (B.x + 1 + (Math.random() - 0.5) * 16) * ts;
    const wy = (B.y + 1 + (Math.random() - 0.5) * 10) * ts;
    const p = worldToScreen(wx, wy);
    const alto = 150 + Math.random() * 110;
    if (lessMotion()) return this.corona(p.x, p.y - alto, color, time);
    const img = this.scene.add.image(p.x, p.y, this.textura(color)).setDepth(DEPTH_OVERLAY + 2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.8);
    this.luces.push({ img, x: p.x, y: p.y, vx: (Math.random() - 0.5) * 20, vy: 0, start: time, ms: 1100 + Math.random() * 400, sube: { color, alto } });
  }

  /** La corona: lucecitas que se abren en redondo, caen un poquito y se apagan. */
  private corona(x: number, y: number, color: string, time: number) {
    const n = 12;
    const quieto = lessMotion();
    const otro = LUCES_COLORES[(LUCES_COLORES.indexOf(color as (typeof LUCES_COLORES)[number]) + 2) % LUCES_COLORES.length]!;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const v = 55 + (i % 2) * 18;
      const c = i % 3 === 0 ? otro : color;
      const img = this.scene.add.image(x, y, this.textura(c)).setDepth(DEPTH_OVERLAY + 2).setBlendMode(Phaser.BlendModes.ADD);
      this.luces.push({ img, x, y, vx: quieto ? 0 : Math.cos(a) * v, vy: quieto ? 0 : Math.sin(a) * v * 0.8, start: time, ms: 1700 + (i % 4) * 150 });
      if (quieto) img.setPosition(x + Math.cos(a) * 22, y + Math.sin(a) * 18);
    }
  }

  private updateLuces(time: number) {
    if (time < this.lucesHasta && time >= this.proxima) {
      this.lanzar(time);
      this.proxima = time + 380 + Math.random() * 520;
    }
    if (!this.luces.length) return;
    const nuevas: Luz[] = [];
    this.luces = this.luces.filter((l) => {
      const k = (time - l.start) / l.ms;
      if (k >= 1) {
        l.img.destroy();
        if (l.sube) nuevas.push(...this.coronaEn(l, time));
        return false;
      }
      if (l.sube) {
        // Sube frenando, con un vaivén chiquito.
        const e = 1 - (1 - k) * (1 - k);
        l.img.setPosition(l.x + l.vx * k, l.y - l.sube.alto * e).setAlpha(0.7 + 0.3 * Math.sin(time / 40));
        return true;
      }
      // Se abren frenando (con el aire) y caen un poquito al final.
      if (l.vx || l.vy) {
        const s = (time - l.start) / 1000;
        const d = (1 - Math.exp(-1.8 * s)) / 1.8;
        l.img.setPosition(l.x + l.vx * d, l.y + l.vy * d + 14 * s * s);
      }
      l.img.setAlpha(Math.max(0, 1 - k * k)).setScale(1 - k * 0.5);
      return true;
    });
    this.luces.push(...nuevas);
  }

  /** Lo que deja una luz que llegó arriba: su corona (se suma después de filtrar). */
  private coronaEn(l: Luz, time: number): Luz[] {
    const antes = this.luces;
    this.luces = [];
    this.corona(l.img.x, l.img.y, l.sube!.color, time);
    const hechas = this.luces;
    this.luces = antes;
    return hechas;
  }

  private clearLuces() {
    for (const l of this.luces) l.img.destroy();
    this.luces = [];
    this.lucesHasta = 0;
  }

  update(time: number) {
    if (this.map?.id !== ANO_VIEJO.area) return;
    this.updateFuego(time);
    this.updateMarca(time);
    this.updateLuces(time);
  }

  destroy() {
    for (const c of this.cleanups) c();
    this.muneco?.destroy();
    this.fuego?.destroy();
    this.marca?.destroy();
    this.clearLuces();
  }
}
