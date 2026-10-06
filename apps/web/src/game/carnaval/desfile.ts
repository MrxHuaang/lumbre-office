// El desfile del Carnaval en pantalla: las carrozas por la calle del Megabús (con sus piezas que se mueven
// cuadro a cuadro y, de noche, los faroles), Don Evelio de abanderado con la bandera blanca y negra, los
// bailarines de cada comparsa con su coreografía en las paradas y la música andina que suena más fuerte
// cerca de cada carroza. Todo sale de `state.carnaval` (cuándo empezó y su paso) y de la hora del servidor:
// todos ven lo mismo, aunque lleguen a la mitad. A la gente de la cabaña que baila la mueve la sala.
import { bailarinPuesto, DESFILE_UNIDADES, DESFILE_Y, desfileEstado, ROAD, unidadX, type OfficeMap } from "@hyvento/map";
import { banderaSprite, CARROZA_FRAMES, CARROZA_LARGO, carrozaSprite, type Sprite } from "@hyvento/map/art";
import {
  COMPARSAS,
  EVELIO_CARROZAS,
  EVELIO_PARADAS,
  PESCA_NPC,
  fraseAcciones,
  frasePose,
  programarFrase,
  type CarrozaId,
  type CineAction,
  type FraseProgramada,
  type LanzadoEvent,
  type PiezaId,
} from "@hyvento/shared";
import type * as Phaser from "phaser";
import { lessMotion } from "@/lib/prefs";
import { Avatar } from "../Avatar";
import { serverNow } from "../club/store";
import { depthOf, ensureTexture, worldToScreen } from "../iso/view";
import { ensureCharacterTextures } from "../looks";
import { getRoom } from "../network";
import { volAt } from "../sfx";
import { useOfficeStore } from "../store";
import { BandaAndina } from "./musica";
import { desfileMs, onLanzado, syncCarnaval, useCarnavalStore } from "./index";

/** Hasta dónde se oye la banda de una carroza (px de mundo: unos 16 tiles). */
const HEAR_PX = 32 * 16;
/** Un cuadro de las piezas que se mueven (alas, péndulo, humo) cada tanto. */
const FRAME_MS = 260;
const ORIGINS = new Map<string, { ox: number; oy: number }>();
const CONFETI_BN = [
  [246, 244, 239],
  [36, 33, 46],
  [246, 244, 239],
  [220, 174, 63],
] as const;

const smooth = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
/** Las carrozas aparecen y se pierden en el bosque de las puntas de la calle. */
const fadeAt = (x: number) => smooth(ROAD.x0 - 2, ROAD.x0 + 4, x) * (1 - smooth(ROAD.x1 - 4, ROAD.x1 + 2, x));
const visibleAt = (x: number) => x > ROAD.x0 - 1 && x < ROAD.x1 + 1;

const PIEZA: Record<CarrozaId, PiezaId> = Object.fromEntries(COMPARSAS.map((c) => [c.id, c.pieza])) as Record<CarrozaId, PiezaId>;

interface Bailarin {
  avatar: Avatar;
  i: number;
}
interface Unidad {
  k: number;
  id: CarrozaId;
  img: Phaser.GameObjects.Image;
  prog: FraseProgramada;
  bailarines: Bailarin[];
}

export class CarnavalView {
  private map?: OfficeMap;
  private unidades: Unidad[] = [];
  private evelio?: Avatar;
  private bandera?: Phaser.GameObjects.Image;
  private banda = new BandaAndina();
  private corrida = -1;
  /** Lo último que se vio de la frase en la parada (para disparar cada acción una sola vez). */
  private fraseT = -1;
  private paradaVista: number | null = null;
  private evelioDijo = "";
  private detach: (() => void)[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    /** El personaje de una sesión (para el polvo y el confeti cuando le echan algo). */
    private readonly avatarOf: (sessionId: string) => Avatar | undefined,
  ) {
    this.detach.push(onLanzado((e) => this.lanzado(e)));
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
    for (const u of this.unidades) {
      u.img.destroy();
      for (const b of u.bailarines) b.avatar.destroy();
    }
    this.unidades = [];
    this.evelio?.destroy();
    this.bandera?.destroy();
    this.evelio = undefined;
    this.bandera = undefined;
    this.corrida = -1;
  }

  /** Arma la fila: una imagen por carroza, sus bailarines (chibis con su pinta) y el abanderado. */
  private armar() {
    this.clear();
    const scene = this.scene;
    DESFILE_UNIDADES.forEach((u, k) => {
      const c = COMPARSAS.find((x) => x.id === u.id);
      if (!c) return;
      const img = scene.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setVisible(false);
      const bailarines = c.bailarines.map((look, i) => {
        const a = new Avatar(scene, ensureCharacterTextures(scene, "ada", look), c.grupo, 0, 0, false);
        a.asNpc();
        a.setNameHidden(true);
        a.setHidden(true);
        return { avatar: a, i };
      });
      this.unidades.push({ k, id: c.id, img, prog: programarFrase(c.frase, c.bailarines.length), bailarines });
    });
    this.evelio = new Avatar(scene, ensureCharacterTextures(scene, "ada", PESCA_NPC.look), PESCA_NPC.name, 0, 0, false);
    this.evelio.asNpc();
    this.evelio.setHidden(true);
    this.bandera = scene.add.image(0, 0, "__DEFAULT").setOrigin(0, 0).setVisible(false);
    this.corrida = useCarnavalStore.getState().corrida;
    this.fraseT = -1;
    this.paradaVista = null;
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

  update(me: { x: number; y: number } | undefined) {
    const room = getRoom();
    const s = useOfficeStore.getState();
    const mine = s.sessionId ? room?.state.players.get(s.sessionId) : undefined;
    syncCarnaval(room ?? undefined, me && mine ? { x: me.x, y: me.y, area: mine.area, comparsa: Boolean((mine as { comparsa?: boolean }).comparsa) } : null);
    const map = this.map;
    const ms = desfileMs();
    if (!map || map.id !== "jardin" || ms === null) {
      if (this.unidades.length) this.clear();
      this.banda.update(null, 0);
      return;
    }
    const st = useCarnavalStore.getState();
    if (!this.unidades.length || this.corrida !== st.corrida) this.armar();
    const e = desfileEstado(ms, st.timing);
    const ts = map.tileSize;
    const night = s.night;
    const frame = lessMotion() ? 0 : Math.floor(serverNow() / FRAME_MS) % CARROZA_FRAMES;
    // La frase de la parada: el tiempo dentro de la vuelta (todos la ven igual).
    const enParada = e.parada !== null;
    const fraseMs = enParada ? e.paradaMs : -1;
    if (e.parada !== this.paradaVista) {
      this.paradaVista = e.parada;
      this.fraseT = -1;
      if (e.parada !== null) this.evelioSay(EVELIO_PARADAS[e.parada] ?? "", `parada:${st.corrida}:${e.parada}`);
    }
    let musica: { pieza: PiezaId; vol: number } = { pieza: "sanjuanito", vol: 0 };
    for (const u of this.unidades) {
      const front = unidadX(u.k, e.cabeza);
      const largo = CARROZA_LARGO[u.id];
      const back = front - largo;
      const shown = visibleAt(front) || visibleAt(back);
      if (!shown) {
        u.img.setVisible(false);
        for (const b of u.bailarines) b.avatar.setHidden(true);
        continue;
      }
      const key = `carroza-${u.id}-${frame}-${night ? "noche" : "dia"}`;
      this.place(u.img, key, () => carrozaSprite(u.id, frame, night), back, DESFILE_Y.carroza, depthOf(front * ts, (DESFILE_Y.carroza + 2.5) * ts));
      u.img.setAlpha(fadeAt(back + largo / 2));
      // Los bailarines: en su puesto caminando, o con la coreografía en la parada.
      const vuelta = enParada ? fraseMs % u.prog.ms : -1;
      for (const b of u.bailarines) {
        const base = bailarinPuesto(u.k, b.i, e.cabeza);
        const pose = enParada ? frasePose(u.prog, b.i, vuelta) : null;
        const x = (base.x + (pose?.dx ?? 0)) * ts;
        const y = (base.y + (pose?.dy ?? 0)) * ts;
        b.avatar.setHidden(!visibleAt(base.x));
        b.avatar.setPosition(x, y);
        if (!enParada) b.avatar.setMotion("right", true);
        else if (pose?.walking && pose.toward) b.avatar.setMotion(towardDir(pose.toward.dx - pose.dx, pose.toward.dy - pose.dy), true);
        else b.avatar.setMotion("down", false);
      }
      if (enParada) {
        const prev = this.fraseT < 0 ? -1 : this.fraseT % u.prog.ms;
        // Al dar la vuelta, lo que queda del final y lo del comienzo.
        const acts = vuelta >= prev ? fraseAcciones(u.prog, prev, vuelta) : [...fraseAcciones(u.prog, prev, u.prog.ms), ...fraseAcciones(u.prog, -1, vuelta)];
        for (const a of acts) {
          const b = u.bailarines[a.who];
          if (b && visibleAt(bailarinPuesto(u.k, b.i, e.cabeza).x)) act(b.avatar, a.action);
        }
      }
      // La música de la carroza más cercana (la de la comparsa de la cabaña, el pasacalle).
      const vol = volAt((front - largo / 2) * ts, (DESFILE_Y.carroza + 1.3) * ts, HEAR_PX) * fadeAt(front - largo / 2);
      if (vol > musica.vol) musica = { pieza: PIEZA[u.id], vol };
    }
    if (enParada) this.fraseT = fraseMs;
    this.banda.update(musica.vol > 0 ? musica.pieza : null, Math.min(1, musica.vol * 1.1));
    this.updateEvelio(e.cabeza, enParada, frame, ts, st.corrida);
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
    // La bandera va a su lado, del lado de la vereda (la calle va más abajo: el escalón).
    const key = `bandera-carnaval-${frame}`;
    this.place(this.bandera, key, () => banderaSprite(frame), x + 0.3, y - 0.45, depthOf((x + 0.3) * ts, (y - 0.45) * ts) + 0.2);
    this.bandera.setY(this.bandera.y + 12);
    // Camino: cada tanto dice algo de una de las carrozas (la misma frase para todos en ese rato).
    if (!parado) {
      const ids = COMPARSAS.map((c) => c.id);
      const slot = Math.floor(serverNow() / 7000);
      this.evelioSay(EVELIO_CARROZAS[ids[slot % ids.length]!], `camino:${corrida}:${slot}`);
    }
  }

  private evelioSay(text: string, key: string) {
    if (!text || key === this.evelioDijo || !this.evelio) return;
    this.evelioDijo = key;
    this.evelio.say(text);
  }

  /** A alguien le echaron maicena (la nubecita blanca) o serpentinas (confeti blanco y negro). */
  private lanzado(e: LanzadoEvent) {
    const a = this.avatarOf(e.to);
    if (!a || lessMotion()) return;
    if (e.kind === "maicena") a.powderPuff();
    else a.confetti(CONFETI_BN);
  }
}

function towardDir(dx: number, dy: number) {
  const sx = dx - dy;
  const sy = dx + dy;
  return sy >= 0 ? (sx >= 0 ? "right" : "down") : sx >= 0 ? "up" : "left";
}

/** Lo que hace un bailarín en la frase (las mismas acciones de las cinemáticas). */
function act(a: Avatar, action: CineAction) {
  if (action === "celebrar") return lessMotion() ? undefined : a.celebrate();
  if (action === "girar") return a.spin(1);
  const gesture = { saltar: "jump", bailar: "dance", asentir: "nod", temblar: "shake", saludar: "wave" } as const;
  a.playGesture(gesture[action]);
}
