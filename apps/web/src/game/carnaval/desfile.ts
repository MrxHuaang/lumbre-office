// El Desfile Magno del Carnaval en pantalla: las carrozas por la calle del Megabús (cada una por partes que
// se mueven con su vaivén: cabezas, quijadas, manos, alas, engranajes, humo), las comparsas grandes con su
// coreografía en las paradas, las murgas con sus instrumentos, los disfraces individuales, Don Evelio de
// abanderado con la bandera y la música andina que suena más fuerte cerca de cada carroza. Todo sale de
// `state.carnaval` (cuándo empezó y su paso) y de la hora del servidor: todos ven lo mismo, aunque lleguen
// a la mitad. A la gente de la cabaña que baila la mueve la sala.
//
// Rendimiento: las partes de las carrozas vienen pre-dibujadas en el atlas del build (o se pintan aquí
// una vez, de a una por cuadro); los bailarines son una imagen suelta con la hoja de su traje (compartida
// entre iguales), así entran en el recorte de cámara; nada se arma hasta que su unidad se acerca a la calle.
import { bailarinPuesto, DESFILE_UNIDADES, DESFILE_Y, desfileEstado, ROAD, unidadX, CARROZA_TILES, CURB_DROP, type OfficeMap, type DesfileUnidad } from "@hyvento/map";
import { banderaSprite, BODY_UP, carrozaArte, FEET_Y, FRAME, instrumentoSprite, posesCarroza, type ParteMovil, type Sprite } from "@hyvento/map/art";
import {
  COMPARSAS,
  disfracesById,
  EVELIO_CARROZAS,
  EVELIO_PARADAS,
  musicosDe,
  MURGAS,
  repertorioDe,
  PESCA_NPC,
  fraseAcciones,
  frasePose,
  programarFrase,
  type CarrozaId,
  type CineAction,
  type FraseProgramada,
  type Instrumento,
  type LanzadoEvent,
  type Look,
  type PiezaId,
} from "@hyvento/shared";
import type * as Phaser from "phaser";
import { lessMotion } from "@/lib/prefs";
import { Avatar } from "../Avatar";
import { serverNow } from "../club/store";
import { ensureTexture } from "../iso/canvas";
import { prerenderedCarroza, prerenderedFurniture } from "../iso/prerender";
import { carrozaKey } from "../iso/prerender-keys";
import { depthOf, worldToScreen } from "../iso/view";
import { ensureCharacterTextures } from "../looks";
import { murmurar } from "../murmullo";
import { cameraZoom } from "../pixelRatio";
import { getRoom } from "../network";
import { sfx, volAt } from "../sfx";
import { useOfficeStore } from "../store";
import { CamaraComparsa } from "./camara";
import { BandasDelDesfile, type FuenteMusica } from "./musica";
import { desfileMs, onLanzado, syncCarnaval, useCarnavalStore } from "./index";

/** Hasta dónde se oye la banda de una carroza (px de mundo: unos 16 tiles). */
const HEAR_PX = 32 * 16;
/** Cuánto se transparenta una carroza que tapa a quien mira desde la vereda. */
const VELO_CARROZA = 0.4;

/** ¿Un píxel de verdad (no el aire del recuadro) de la imagen cae sobre la cabeza o el pecho de `yo`? */
function tapaPunto(scene: Phaser.Scene, img: Phaser.GameObjects.Image, yo: { x: number; y: number }): boolean {
  if (!img.getBounds().contains(yo.x, yo.y)) return false;
  for (const dy of [-8, 0, 8]) {
    const lp = img.getLocalPoint(yo.x, yo.y + dy);
    // `getLocalPoint` ya cuenta desde la esquina de arriba a la izquierda del cuadro.
    const a = scene.textures.getPixelAlpha(Math.floor(lp.x), Math.floor(lp.y), img.texture.key, img.frame.name);
    if ((a ?? 0) > 128) return true;
  }
  return false;
}
/** La bandera cambia de cuadro cada tanto. */
const FRAME_MS = 260;
/** El zoom más cercano de la cámara (el mismo tope de la rueda, MAX_ZOOM de la escena). */
const CAMARA_MAX_ZOOM = 5;
const ORIGINS = new Map<string, { ox: number; oy: number }>();
const CONFETI = [
  [224, 40, 60],
  [247, 197, 24],
  [47, 111, 214],
  [61, 184, 66],
] as const;

const smooth = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
/** Lo de la fila aparece y se pierde en el bosque de las puntas de la calle. */
const fadeAt = (x: number) => smooth(ROAD.x0 - 2, ROAD.x0 + 4, x) * (1 - smooth(ROAD.x1 - 4, ROAD.x1 + 2, x));
const visibleAt = (x: number) => x > ROAD.x0 - 1 && x < ROAD.x1 + 1;
/** Se arma (texturas e imágenes) cuando la unidad está a unos tiles de entrar a la calle. */
const cercaDe = (x0: number, x1: number) => x1 > ROAD.x0 - 12 && x0 < ROAD.x1 + 4;

const PIEZA: Record<CarrozaId, PiezaId> = Object.fromEntries(COMPARSAS.map((c) => [c.id, c.pieza])) as Record<CarrozaId, PiezaId>;
/** Filas de la hoja del chibi: abajo, izquierda, derecha, arriba. */
const FILA = { down: 0, left: 1, right: 2, up: 3 } as const;
type Dir = keyof typeof FILA;

/** Un bailarín barato: una imagen con la hoja de su traje, que camina, baila y salta. */
class Bailarin {
  readonly img: Phaser.GameObjects.Image;
  private extra?: Phaser.GameObjects.Image;
  private accion: { tipo: CineAction; desde: number } | null = null;
  constructor(
    scene: Phaser.Scene,
    look: Look,
    private readonly escala = 1,
    instrumento?: Instrumento,
  ) {
    const key = ensureCharacterTextures(scene, "ada", look);
    this.img = scene.add.image(0, 0, key, 0).setOrigin(0.5, FEET_Y / FRAME).setScale(escala).setVisible(false);
    if (instrumento) {
      const s = instrumentoSprite(instrumento);
      const k = `instrumento-${instrumento}`;
      ensureTexture(scene, k, () => s.canvas);
      this.extra = scene.add.image(0, 0, k).setOrigin(s.ox / s.canvas.width, s.oy / s.canvas.height).setVisible(false);
    }
  }
  hacer(tipo: CineAction, ahora: number) {
    if (!lessMotion()) this.accion = { tipo, desde: ahora };
  }
  /** Pone al bailarín en (x, y) tiles mirando a `dir`, caminando o quieto, con su acción del momento. */
  poner(x: number, y: number, dir: Dir, caminando: boolean, ahora: number, alpha: number, visible: boolean) {
    const ts = 32;
    if (!visible) {
      this.img.setVisible(false);
      this.extra?.setVisible(false);
      return;
    }
    const s = worldToScreen(x * ts, y * ts);
    let fila = FILA[dir];
    let col = caminando ? [0, 1, 0, 2][Math.floor(ahora / 160) % 4]! : 0;
    let dy = caminando && !lessMotion() ? -Math.abs(Math.sin(ahora / 160)) : 0;
    let flip = false;
    const a = this.accion;
    if (a) {
      const t = ahora - a.desde;
      if (t > 1000) this.accion = null;
      else if (a.tipo === "saltar" || a.tipo === "celebrar") dy -= Math.sin(Math.min(1, t / 500) * Math.PI) * 9;
      else if (a.tipo === "girar") fila = (["down", "left", "up", "right"] as const).map((d) => FILA[d])[Math.floor(t / 120) % 4]!;
      else if (a.tipo === "bailar") {
        col = [1, 0, 2, 0][Math.floor(t / 125) % 4]!;
        flip = Math.floor(t / 250) % 2 === 1;
        dy -= Math.abs(Math.sin(t / 125)) * 2;
      } else dy -= Math.abs(Math.sin(t / 90)) * 1.5;
    }
    const px = Math.round(s.x);
    const py = Math.round(s.y + CURB_DROP + dy);
    const depth = depthOf(x * ts, y * ts);
    this.img.setFrame(fila * 3 + col).setFlipX(flip).setPosition(px, py).setDepth(depth).setAlpha(alpha).setVisible(true);
    if (this.extra) this.extra.setPosition(px + 5 * this.escala, py - BODY_UP.hand * this.escala).setDepth(depth + 0.3).setAlpha(alpha).setVisible(true);
  }
  destroy() {
    this.img.destroy();
    this.extra?.destroy();
  }
}

/** Una parte de carroza en pantalla. */
interface ParteVista {
  img: Phaser.GameObjects.Image;
}

interface Unidad {
  k: number;
  u: DesfileUnidad;
  /** Ya se armó (texturas e imágenes). */
  armada: boolean;
  /** Carroza: sus partes y cómo se mueven. */
  partes: ParteVista[];
  movil: ParteMovil[];
  bailarines: Bailarin[];
  prog?: FraseProgramada;
  /** Cuánto se transparenta la carroza (0 = nada) cuando tapa a quien mira desde la vereda. */
  velo?: number;
}

export class CarnavalView {
  private map?: OfficeMap;
  private unidades: Unidad[] = [];
  private evelio?: Avatar;
  private bandera?: Phaser.GameObjects.Image;
  private banda = new BandasDelDesfile();
  /** Con 3 o más de la cabaña bailando, la cámara de quien baila se acerca un paso. */
  private camara: CamaraComparsa;
  private corrida = -1;
  /** Lo último que se vio de la frase en la parada (para disparar cada acción una sola vez). */
  private fraseT = -1;
  private paradaVista: number | null = null;
  private evelioDijo = "";
  /** Las carrozas que ya aplaudió el público de la vereda en esta corrida (una vez cada una). */
  private aplaudidas = new Set<number>();
  private detach: (() => void)[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    /** El personaje de una sesión (para el polvo y el confeti cuando le echan algo). */
    private readonly avatarOf: (sessionId: string) => Avatar | undefined,
  ) {
    this.detach.push(onLanzado((e) => this.lanzado(e)));
    this.camara = new CamaraComparsa(scene, cameraZoom(CAMARA_MAX_ZOOM));
  }

  setArea(map: OfficeMap) {
    this.map = map;
    this.clear();
  }

  destroy() {
    this.clear();
    this.banda.stop();
    this.detach.forEach((d) => d());
    this.detach = [];
  }

  private clear() {
    for (const u of this.unidades) this.desarmar(u);
    this.unidades = [];
    this.evelio?.destroy();
    this.bandera?.destroy();
    this.evelio = undefined;
    this.bandera = undefined;
    this.corrida = -1;
  }

  private desarmar(u: Unidad) {
    for (const p of u.partes) p.img.destroy();
    for (const b of u.bailarines) b.destroy();
    u.partes = [];
    u.movil = [];
    u.bailarines = [];
    u.armada = false;
  }

  /** La fila (sin armar todavía) y el abanderado. */
  private preparar() {
    this.clear();
    this.unidades = DESFILE_UNIDADES.map((u, k) => ({ k, u, armada: false, partes: [], movil: [], bailarines: [] }));
    this.evelio = new Avatar(this.scene, ensureCharacterTextures(this.scene, "ada", PESCA_NPC.look), PESCA_NPC.name, 0, 0, false);
    this.evelio.asNpc();
    this.evelio.setHidden(true);
    this.bandera = this.scene.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setVisible(false);
    this.corrida = useCarnavalStore.getState().corrida;
    this.fraseT = -1;
    this.paradaVista = null;
    this.aplaudidas.clear();
  }

  /** Arma una unidad: las partes de la carroza (del atlas, o pintadas aquí) y sus bailarines. */
  private armar(un: Unidad) {
    const scene = this.scene;
    const u = un.u;
    un.armada = true;
    if (u.tipo === "carroza") {
      const meta = prerenderedCarroza(u.id);
      const frames = meta?.partes.map((p) => prerenderedFurniture(scene, carrozaKey(u.id, p.id)));
      if (meta && frames?.every(Boolean)) {
        un.movil = meta.partes;
        un.partes = meta.partes.map((p, i) => {
          const f = frames[i]!;
          return { img: scene.add.image(0, 0, f.texture, f.frame).setOrigin(p.px / p.w, p.py / p.h).setVisible(false) };
        });
      } else {
        // Sin el build (desarrollo): se pintan aquí una vez.
        const arte = carrozaArte(u.id);
        un.movil = arte.partes;
        un.partes = arte.partes.map((p) => {
          const key = carrozaKey(u.id, p.id);
          ensureTexture(scene, key, () => p.canvas);
          return { img: scene.add.image(0, 0, key).setOrigin(p.px / p.canvas.width, p.py / p.canvas.height).setVisible(false) };
        });
      }
      const c = COMPARSAS.find((x) => x.id === u.id);
      if (c) {
        un.bailarines = c.bailarines.map((look) => new Bailarin(scene, look));
        un.prog = programarFrase(c.frase, c.bailarines.length);
      }
    } else if (u.tipo === "murga") {
      un.bailarines = musicosDe(u.id).map((m) => new Bailarin(scene, m.look, 1, m.instrumento));
    } else if (u.tipo === "disfraces") {
      un.bailarines = (disfracesById(u.id)?.personajes ?? []).map((p) => new Bailarin(scene, p.look, 1.6));
    }
  }

  update(me: { x: number; y: number } | undefined) {
    const room = getRoom();
    const s = useOfficeStore.getState();
    const mine = s.sessionId ? room?.state.players.get(s.sessionId) : undefined;
    const enComparsa = Boolean((mine as { comparsa?: boolean } | undefined)?.comparsa);
    syncCarnaval(room ?? undefined, me && mine ? { x: me.x, y: me.y, area: mine.area, comparsa: enComparsa } : null);
    let bailando = 0;
    if (enComparsa) for (const p of room?.state.players.values() ?? []) if ((p as { comparsa?: boolean }).comparsa) bailando++;
    this.camara.update(enComparsa, bailando);
    const map = this.map;
    const ms = desfileMs();
    if (!map || map.id !== "jardin" || ms === null) {
      if (this.unidades.length) this.clear();
      this.banda.update([], 0);
      return;
    }
    const st = useCarnavalStore.getState();
    if (!this.unidades.length || this.corrida !== st.corrida) this.preparar();
    const e = desfileEstado(ms, st.timing);
    const ts = map.tileSize;
    const ahora = serverNow();
    const calma = lessMotion() ? 0.12 : 1;
    const enParada = e.parada !== null;
    const fraseMs = enParada ? e.paradaMs : -1;
    if (e.parada !== this.paradaVista) {
      this.paradaVista = e.parada;
      this.fraseT = -1;
      if (e.parada !== null) {
        this.evelioSay(EVELIO_PARADAS[e.parada] ?? "", `parada:${st.corrida}:${e.parada}`);
        // Frente al palco, la vereda celebra la parada.
        sfx.applause(0.7, 8);
      }
    }
    const musica: FuenteMusica[] = [];
    // Dónde se me ve el cuerpo (en la pantalla), si estoy detrás de las carrozas (en la vereda).
    const yoS = me && me.y < (DESFILE_Y.carroza + 0.5) * ts ? worldToScreen(me.x, me.y) : null;
    const yo = yoS ? { x: yoS.x, y: yoS.y - 14 } : null;
    let armadas = 0;
    for (const un of this.unidades) {
      const front = unidadX(un.k, e.cabeza);
      const back = front - un.u.largo;
      if (!cercaDe(back, front)) {
        if (un.armada && back > ROAD.x1 + 4) this.desarmar(un);
        continue;
      }
      // De a una unidad nueva por cuadro (pintar una carroza sin el build toma su rato).
      if (!un.armada) {
        if (armadas++ > 0) continue;
        this.armar(un);
      }
      if (un.u.tipo === "carroza") {
        const id = un.u.id;
        const largo = CARROZA_TILES[id];
        const atras = front - largo;
        const o = worldToScreen(atras * ts, DESFILE_Y.carroza * ts);
        const poses = posesCarroza({ partes: un.movil }, ahora, calma);
        const alpha = fadeAt(atras + largo / 2);
        const base = depthOf(front * ts, (DESFILE_Y.carroza + 2.5) * ts);
        const shown = visibleAt(front) || visibleAt(atras);
        un.partes.forEach((p, i) => {
          const q = poses[i]!;
          p.img
            .setPosition(Math.round(o.x + q.x), Math.round(o.y + q.y))
            .setRotation(q.rot)
            .setScale(q.sx, q.sy)
            .setDepth(base + i * 0.001)
            .setVisible(shown && q.visible);
        });
        // Si la carroza me tapa (estoy en la vereda, detrás), se vuelve medio transparente para no perderme.
        const tapa = Boolean(yo) && shown && un.partes.some((p) => p.img.visible && tapaPunto(this.scene, p.img, yo!));
        un.velo = (un.velo ?? 0) + ((tapa ? VELO_CARROZA : 0) - (un.velo ?? 0)) * 0.15;
        un.partes.forEach((p, i) => p.img.setAlpha(alpha * poses[i]!.alpha * (1 - un.velo!)));
        // La música de la comparsa de cada carroza: rota su repertorio (cada una empieza en otro punto).
        const vol = volAt((front - largo / 2) * ts, (DESFILE_Y.carroza + 1.3) * ts, HEAR_PX) * fadeAt(front - largo / 2);
        musica.push({ clave: id, repertorio: repertorioDe(PIEZA[id], un.k), vol });
        // La gente de la vereda aplaude cuando la carroza pasa frente a uno.
        if (vol > 0.72 && !this.aplaudidas.has(un.k)) {
          this.aplaudidas.add(un.k);
          sfx.applause(0.55, 6);
        }
      }
      // Cada murga toca su repertorio donde va caminando.
      if (un.u.tipo === "murga") {
        const m = MURGAS.find((x) => x.id === un.u.id);
        const x = front - un.u.largo / 2;
        if (m) musica.push({ clave: m.id, repertorio: m.repertorio, vol: volAt(x * ts, DESFILE_Y.murga[0] * ts, HEAR_PX) * fadeAt(x) });
      }
      // Los bailarines: en su puesto caminando, o con la coreografía en la parada.
      const vuelta = enParada && un.prog ? fraseMs % un.prog.ms : -1;
      un.bailarines.forEach((b, i) => {
        const base = bailarinPuesto(un.k, i, e.cabeza);
        const pose = enParada && un.prog ? frasePose(un.prog, i, vuelta) : null;
        const x = base.x + (pose?.dx ?? 0);
        const y = base.y + (pose?.dy ?? 0);
        const dir: Dir = !enParada ? "right" : pose?.walking && pose.toward ? towardDir(pose.toward.dx - pose.dx, pose.toward.dy - pose.dy) : "down";
        // Las murgas y los disfraces bailan en las paradas aunque no tengan frase.
        if (enParada && !un.prog && Math.floor(fraseMs / 1500) !== Math.floor((this.fraseT < 0 ? -1500 : this.fraseT) / 1500)) b.hacer(i % 2 ? "bailar" : "saltar", ahora);
        b.poner(x, y, dir, !enParada || Boolean(pose?.walking), ahora, fadeAt(x), visibleAt(x));
      });
      if (enParada && un.prog) {
        const prev = this.fraseT < 0 ? -1 : this.fraseT % un.prog.ms;
        // Al dar la vuelta, lo que queda del final y lo del comienzo.
        const acts = vuelta >= prev ? fraseAcciones(un.prog, prev, vuelta) : [...fraseAcciones(un.prog, prev, un.prog.ms), ...fraseAcciones(un.prog, -1, vuelta)];
        for (const a of acts) un.bailarines[a.who]?.hacer(a.action, ahora);
      }
    }
    if (enParada) this.fraseT = fraseMs;
    this.banda.update(musica, ms);
    this.updateEvelio(e.cabeza, enParada, Math.floor(ahora / FRAME_MS) % 4, ts, st.corrida);
  }

  /** Pone un dibujo con su origen en el tile (x, y) del nivel. */
  private place(img: Phaser.GameObjects.Image, key: string, make: () => Sprite, tx: number, ty: number, depth: number) {
    let o = ORIGINS.get(key);
    if (!o || !this.scene.textures.exists(key)) {
      const s = make();
      ensureTexture(this.scene, key, () => s.canvas);
      ORIGINS.set(key, (o = { ox: s.ox, oy: s.oy }));
    }
    const ts = this.map!.tileSize;
    const a = worldToScreen(tx * ts, ty * ts);
    if (img.texture.key !== key) img.setTexture(key);
    img.setPosition(Math.round(a.x - o.ox), Math.round(a.y - o.oy)).setDepth(depth).setVisible(true);
  }

  /** El abanderado al frente: camina con la bandera; en el camino comenta cada carroza. */
  private updateEvelio(cabeza: number, parado: boolean, frame: number, ts: number, corrida: number) {
    const ev = this.evelio;
    if (!ev || !this.bandera) return;
    const x = unidadX(0, cabeza) - 0.6;
    const y = DESFILE_Y.abanderado;
    const shown = visibleAt(x);
    ev.setHidden(!shown);
    ev.setPosition(x * ts, y * ts);
    ev.setMotion(parado ? "down" : "right", !parado);
    if (!shown) return this.bandera.setVisible(false);
    const f = lessMotion() ? 0 : frame;
    const key = `bandera-carnaval-${f}`;
    this.place(this.bandera, key, () => banderaSprite(f), x + 0.3, y - 0.45, depthOf((x + 0.3) * ts, (y - 0.45) * ts) + 0.2);
    this.bandera.setY(this.bandera.y + 12);
    // Camino: cada tanto dice algo de una de las carrozas (la misma frase para todos en ese rato).
    if (!parado) {
      const ids = COMPARSAS.map((c) => c.id);
      const slot = Math.floor(serverNow() / 9000);
      this.evelioSay(EVELIO_CARROZAS[ids[slot % ids.length]!], `camino:${corrida}:${slot}`);
    }
  }

  private evelioSay(text: string, key: string) {
    if (!text || key === this.evelioDijo || !this.evelio) return;
    this.evelioDijo = key;
    // Sin cajas: el murmullo, con el cupo de toda la pantalla.
    const ev = this.evelio;
    const sid = useOfficeStore.getState().sessionId;
    const me = sid ? this.avatarOf(sid) : undefined;
    const ts = this.map?.tileSize ?? 32;
    murmurar({
      scene: this.scene,
      quien: "desfile:evelio",
      donde: () => (ev.sprite.active && ev.sprite.visible ? { x: ev.x, y: ev.y } : null),
      texto: text,
      dist: me ? Math.hypot(ev.x - me.x, ev.y - me.y) / ts : Infinity,
    });
  }

  /** A alguien le echaron maicena (la nubecita blanca), espuma (el chorro y el rastro) o serpentinas (confeti). */
  private lanzado(e: LanzadoEvent) {
    const a = this.avatarOf(e.to);
    if (!a || lessMotion()) return;
    if (e.kind === "maicena") a.powderPuff();
    else if (e.kind === "espuma") {
      const from = this.avatarOf(e.from);
      a.foamHit(from ? { x: from.x, y: from.y } : null, this.scene.time.now);
    } else a.confetti(CONFETI);
  }
}

function towardDir(dx: number, dy: number): Dir {
  const sx = dx - dy;
  const sy = dx + dy;
  return sy >= 0 ? (sx >= 0 ? "right" : "down") : sx >= 0 ? "up" : "left";
}
