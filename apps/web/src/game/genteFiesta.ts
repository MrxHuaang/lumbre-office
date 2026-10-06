// La gente de la fiesta en la escena (VIR-167): los NPC del festival que corre, en el nivel que se ve. Dónde
// está cada uno sale de la simulación de @hyvento/map (`genteDelNivel`, una función pura del minuto del juego:
// todos ven lo mismo y el servidor valida con la misma cuenta). Se dibujan con los chibis de siempre (el
// perro de Mariana, como las mascotas) y además:
// - reaccionan: miran a quien se arrima, saludan la primera vez que alguien pasa cerca, contestan los emotes
//   de al lado y aplauden cuando alguien baila;
// - murmuran solos sin cajas: el ícono de habla sobre la cabeza y, a 3 tiles o menos, el texto cortito que
//   sube y se desvanece (como mucho dos a la vez, primero los más cercanos; lib/murmullos.ts);
// - llevan marquitas: el paquetico de un pedido que se les puede entregar y la chispa de algo nuevo que contar;
// - con E se habla con ellos en la tira de conversación (game/dialogo.ts): lo que dicen, su pedido con
//   "Entregar" y, los vendedores, "Ver el puesto".
// Solo el nivel que se ve; las imágenes sueltas las saca de la lista de dibujo `iso/culling.ts`.
import { genteDelNivel, type GenteNivel, type OfficeMap, type PoseFiesta } from "@hyvento/map";
import { BODY_UP, drawPet, fiestaMark, FIESTA_MARK_FRAMES, PET_FRAME, type FiestaMarkKind } from "@hyvento/map/art";
import {
  bagItemInfo,
  charlaDe,
  corrilloDe,
  diaDelFestival,
  ENTREGAR_ERROR_TEXT,
  estaDeFiesta,
  fechaDelJuego,
  festivalById,
  gameMinutes,
  GENTE_MSG,
  GENTE_REGLAS,
  isNightMinute,
  lineSeed,
  murmulloDe,
  objItemId,
  pickLine,
  type Direction,
  type EmoteId,
  type EntregarResult,
  type FiestaNpc,
  type GenteHechos,
  type Weather,
} from "@hyvento/shared";
import type * as Phaser from "phaser";
import { COZY } from "@/lib/cozy";
import { conTexto, MURMULLO, respuestaA, slotMurmullo, tocaMurmullo, turnoDeCorrillo } from "@/lib/murmullos";
import { lessMotion } from "@/lib/prefs";
import { Avatar } from "./Avatar";
import { useBagStore } from "./bag";
import { portraitFromSheet } from "./cinematicas/player";
import { playCinematic } from "./cinematicas/puerta";
import { serverNow } from "./club/store";
import { abrirDialogo, decirEnDialogo, useDialogo } from "./dialogo";
import { murmullosCallados, murmullosVisibles, murmurar } from "./murmullo";
import { depthOf, ensureTexture, toHtmlCanvas, worldToScreen } from "./iso/view";
import { genteAlAlcance, useGenteFiesta } from "./genteFiestaStore";
import { ensureCharacterTextures } from "./looks";
import { getRoom, onEmote, onInteract, onRoom } from "./network";
import { useOfficeStore, type Interactable } from "./store";

/** Quien está en el nivel que se ve (para mirar, saludar y contestar). */
export interface GentePerson {
  sessionId: string;
  x: number;
  y: number;
}

export interface GenteDeps {
  local: () => { x: number; y: number } | null;
  people: () => GentePerson[];
}

/** El panel del puesto de cada festival (la `accion` del vendedor lo abre). */
const PUESTO_DE: Partial<Record<string, Interactable>> = { brujas: "brujasShop", carnaval: "carnavalShop", "feria-flores": "feriaShop", "amor-amistad": "amorShop", cometas: "cometasShop" };

/** Cada cuánto se mira quién está cerca (y quién murmura). */
const SCAN_MS = 250;
/** Cuántos personajes se arman por cuadro (cada uno dibuja su hoja: unos 3 ms). */
const CREATE_PER_FRAME = 3;
/** Sobre la cabeza: el nombre va en la coronilla + 7; la marca, encima del nombre. */
const OVER_HEAD = BODY_UP.crown + 7 + 14;
const OVER_ANIMAL = 20;
/** A qué distancia (tiles) miran a quien se arrima, saludan, y cuándo olvidan que ya saludaron. */
const LOOK_TILES = 2.2;
const GREET_TILES = 2.6;
const GREET_RESET_TILES = 6;
/** Hasta dónde contestan los emotes (tiles) y cuántos contestan. */
const EMOTE_TILES = 4;
/** Las marcas y los nombres solo de cerca (tiles): de lejos, el jardín no se llena de cosas. */
const MARK_TILES = 10;
const NAME_TILES = 9;

interface Actor {
  npc: FiestaNpc;
  hash: number;
  avatar?: Avatar;
  key?: string;
  animal?: { img: Phaser.GameObjects.Image; frame: number; frameAt: number };
  mark?: Phaser.GameObjects.Image;
  markKind: FiestaMarkKind | null;
  icon?: { img: Phaser.GameObjects.Image; until: number; frame: number; frameAt: number };
  pose: PoseFiesta;
  visible: boolean;
  seated: boolean;
  held: string;
  /** Hacia dónde mira por alguien que se arrimó (o null). */
  lookAt: Direction | null;
  greeted: Set<string>;
  greetAt: number;
  danceAt: number;
  photoAt: number;
  cheerAt: number;
  slot: number;
  turn: number;
}

/** La vista que está activa (la E y los mensajes la buscan aquí). */
let current: GenteFiestaView | null = null;

export class GenteFiestaView {
  private map?: OfficeMap;
  private nivel: GenteNivel | null = null;
  private actors = new Map<string, Actor>();
  /** Los que faltan por armar: de a pocos por cuadro, así una fiesta llena no traba el cuadro en que empieza. */
  private pending: FiestaNpc[] = [];
  private scanAt = 0;
  private hideNames = false;
  private unsubs: (() => void)[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: GenteDeps,
  ) {
    current = this;
    this.unsubs.push(
      onEmote((e) => this.onPlayerEmote(e.sessionId, e.emote)),
      // Al abrir una conversación, los murmullos de alrededor se apagan.
      useDialogo.subscribe((s, prev) => {
        if (s.actual && !prev.actual) for (const a of this.actors.values()) this.dropIcon(a);
      }),
    );
  }

  setArea(map: OfficeMap) {
    this.map = map;
    this.clear();
  }

  setNameHidden(hidden: boolean) {
    this.hideNames = hidden;
  }

  /** El modo privado enfocó una sala (tiles; null = ninguna): los de adentro se ven sobre el oscurecido. */
  setOverShade(rect: { x: number; y: number; w: number; h: number } | null, ts: number) {
    for (const a of this.actors.values()) {
      const inside = Boolean(rect) && a.pose.x >= rect!.x * ts && a.pose.x < (rect!.x + rect!.w) * ts && a.pose.y >= rect!.y * ts && a.pose.y < (rect!.y + rect!.h) * ts;
      a.avatar?.setOverShade(inside);
    }
  }

  /** Los cuerpos (para atenuar al que tape la mesa en el modo mesa). */
  collectSprites(out: { push(s: Phaser.GameObjects.Sprite): unknown }) {
    for (const a of this.actors.values()) if (a.avatar && a.visible) out.push(a.avatar.sprite);
  }

  /** Los que se ven ahora (para la capa de las cometas). */
  actorsVisibles(): Actor[] {
    return [...this.actors.values()].filter((a) => a.visible);
  }

  /** Id del NPC de la fiesta dibujado bajo el puntero (clic para ir a hablarle), o null. */
  under(sx: number, sy: number): { id: string; x: number; y: number } | null {
    for (const [id, a] of this.actors) {
      if (!a.visible) continue;
      const img = a.avatar?.sprite ?? a.animal?.img;
      if (img?.visible && img.getBounds().contains(sx, sy)) return { id, x: a.pose.x, y: a.pose.y };
    }
    return null;
  }

  destroy() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.clear();
    if (current === this) current = null;
  }

  private clear() {
    for (const a of this.actors.values()) this.destroyActor(a);
    this.actors.clear();
    this.pending = [];
    this.nivel = null;
    useGenteFiesta.setState({ cerca: null });
  }

  private destroyActor(a: Actor) {
    a.avatar?.destroy();
    a.animal?.img.destroy();
    a.mark?.destroy();
    a.icon?.img.destroy();
  }

  /** El minuto del día del juego con decimales y el día (o null sin reloj). */
  private clock(): { minuto: number; day: number } | null {
    const c = useOfficeStore.getState().gameClock;
    if (!c) return null;
    const total = gameMinutes(c, serverNow());
    const day = Math.floor(total / 1440);
    return { minuto: total - day * 1440, day };
  }

  update(time: number) {
    const map = this.map;
    const s = useOfficeStore.getState();
    const clock = this.clock();
    const nivel = map && clock && s.festival.fase === "fiesta" ? genteDelNivel(map, s.festival.id, clock.day, s.weather as Weather) : null;
    if (nivel !== this.nivel) this.rebuild(nivel);
    if (!nivel || !clock) return;
    for (let i = 0; i < CREATE_PER_FRAME && this.pending.length; i++) {
      const npc = this.pending.shift()!;
      this.actors.set(npc.id, this.create(npc));
    }
    const me = this.deps.local();
    const ts = nivel.map.tileSize;
    const night = isNightMinute(clock.minuto);
    for (const a of this.actors.values()) {
      a.pose = nivel.pose(a.npc.id, clock.minuto);
      this.place(a, time, night, me, ts, clock.minuto);
    }
    if (time >= this.scanAt) {
      this.scanAt = time + SCAN_MS;
      this.scan(time, me, ts);
    }
  }

  /** Arma los personajes de la gente de ahora (los que siguen, se quedan). */
  private rebuild(nivel: GenteNivel | null) {
    this.nivel = nivel;
    const ids = new Set(nivel?.npcs.map((n) => n.id) ?? []);
    for (const [id, a] of this.actors)
      if (!ids.has(id)) {
        this.destroyActor(a);
        this.actors.delete(id);
      }
    this.pending = [];
    for (const npc of nivel?.npcs ?? []) {
      const old = this.actors.get(npc.id);
      if (old) old.npc = npc;
      else this.pending.push(npc);
    }
    if (!nivel) useGenteFiesta.setState({ cerca: null });
  }

  private create(npc: FiestaNpc): Actor {
    const a: Actor = {
      npc,
      hash: lineSeed(npc.id),
      markKind: null,
      pose: { x: 0, y: 0, mira: "down", camina: false, corre: false, asiento: null, visible: false },
      visible: false,
      seated: false,
      held: "",
      lookAt: null,
      greeted: new Set(),
      greetAt: 0,
      danceAt: 0,
      photoAt: 0,
      cheerAt: 0,
      slot: -1,
      turn: -1,
    };
    if (npc.animal) {
      const img = this.scene.add.image(0, 0, "__DEFAULT").setOrigin(PET_FRAME.feetX / PET_FRAME.w, PET_FRAME.feetY / PET_FRAME.h).setVisible(false);
      a.animal = { img, frame: 0, frameAt: 0 };
    } else {
      const key = ensureCharacterTextures(this.scene, "ada", npc.look);
      const avatar = new Avatar(this.scene, key, npc.nombre, 0, 0, false);
      avatar.asNpc(COZY.wood);
      avatar.setHidden(true);
      a.avatar = avatar;
      a.key = key;
    }
    return a;
  }

  /** El chibi de alguien de la fiesta que se ve ahora (las cinemáticas lo esconden mientras actúa su doble). */
  avatarOf(id: string): Avatar | null {
    const a = this.actors.get(id);
    return a?.visible ? (a.avatar ?? null) : null;
  }

  /** Pone a cada uno donde le toca en este cuadro. */
  private place(a: Actor, time: number, night: boolean, me: { x: number; y: number } | null, ts: number, minuto: number) {
    const p = a.pose;
    if (!p.visible) {
      if (a.visible) {
        a.visible = false;
        a.avatar?.setHidden(true);
        a.avatar?.setPowdered(false);
        a.animal?.img.setVisible(false);
        a.mark?.setVisible(false);
        a.markKind = null;
        this.dropIcon(a);
      }
      return;
    }
    const first = !a.visible;
    a.visible = true;
    const dist = me ? Math.hypot(p.x - me.x, p.y - me.y) / ts : Infinity;
    if (a.animal) return this.placeAnimal(a, time, first);
    const av = a.avatar!;
    if (first) {
      av.setHidden(false);
      // La cara empolvada del Carnaval (un polvito encima: la piel no cambia).
      av.setPowdered(Boolean(a.npc.talco));
    }
    // Sentado en su asiento (el de la novena, los troncos de la fogata) o de pie.
    if (p.asiento) {
      if (!a.seated || first) {
        av.setPosition(p.asiento.x, p.asiento.y);
        av.setSeated(p.asiento.facing, p.asiento);
        a.seated = true;
      }
    } else {
      if (a.seated) {
        av.setSeated(null);
        a.seated = false;
      }
      if (av.x !== p.x || av.y !== p.y) av.setPosition(p.x, p.y);
      const dancing = !p.camina && (a.npc.comportamiento.tipo === "baila" || estaDeFiesta(a.npc, minuto));
      if (dancing) {
        if (time >= a.danceAt && !lessMotion()) {
          a.danceAt = time + 4200;
          av.bailar();
        }
      } else av.setMotion(p.camina ? p.mira : (a.lookAt ?? p.mira), p.camina);
      // Los turistas toman fotos cuando se detienen.
      if (a.npc.fotos && !p.camina && time >= a.photoAt) {
        a.photoAt = time + 5000 + (a.hash % 4000);
        if (dist < 14) av.photoFlash();
      }
    }
    // Lo de la mano: lo que lleva siempre, o el farol de noche.
    const held = a.npc.lleva ?? (night && a.npc.farol ? a.npc.farol : "");
    if (held !== a.held) {
      a.held = held;
      av.setHeld(held);
    }
    av.setNameHidden(this.hideNames || dist > NAME_TILES);
    av.sway(time);
    this.placeOverHead(a);
  }

  /** El perro: la hoja de las mascotas (camina o se queda parado), mirando a donde va. */
  private placeAnimal(a: Actor, time: number, first: boolean) {
    const p = a.pose;
    const an = a.animal!;
    const kind = a.npc.animal!.especie;
    const coat = a.npc.animal!.pelaje;
    const pose = p.camina ? "walk" : "stand";
    if (p.camina && time >= an.frameAt) {
      an.frameAt = time + (p.corre ? 120 : 180);
      an.frame = (an.frame + 1) % 2;
    }
    const view = p.mira === "left" || p.mira === "up" ? "back" : "front";
    const frame = pose === "walk" ? an.frame : 0;
    const key = ensureTexture(this.scene, `mascota-${kind}-${coat}-${pose}-${view}-${frame}`, () => drawPet(kind, coat, pose, view, frame));
    const s = worldToScreen(p.x, p.y);
    an.img
      .setTexture(key)
      .setPosition(Math.round(s.x), Math.round(s.y))
      .setFlipX(p.mira === "right" || p.mira === "up")
      .setDepth(depthOf(p.x, p.y) + 0.5);
    if (first) an.img.setVisible(true);
    this.placeOverHead(a);
  }

  /** La marca y el ícono de habla, sobre la cabeza. */
  private placeOverHead(a: Actor) {
    const p = a.pose;
    const s = worldToScreen(p.x, p.y);
    const lift = a.animal ? OVER_ANIMAL : OVER_HEAD - (p.asiento ? 8 : 0);
    const depth = 5e7 + depthOf(p.x, p.y) + 0.4;
    a.mark?.setPosition(Math.round(s.x), Math.round(s.y - lift)).setDepth(depth);
    a.icon?.img.setPosition(Math.round(s.x + 2), Math.round(s.y - lift)).setDepth(depth + 0.01);
  }

  // ---------- Lo que se mira cada tanto ----------

  private scan(time: number, me: { x: number; y: number } | null, ts: number) {
    const people = this.deps.people();
    const talking = useDialogo.getState().actual?.quien ?? null;
    const { hechos, hablados } = useGenteFiesta.getState();
    let cerca: { id: string; nombre: string; d: number } | null = null;
    for (const a of this.actors.values()) {
      if (!a.visible) continue;
      const p = a.pose;
      // A quién mirar: al más cercano que se arrimó (si está quieto y de pie).
      let nearest: { p: GentePerson; d: number } | null = null;
      for (const q of people) {
        const d = Math.hypot(q.x - p.x, q.y - p.y) / ts;
        if (d > GREET_RESET_TILES) a.greeted.delete(q.sessionId);
        if (!nearest || d < nearest.d) nearest = { p: q, d };
        // Saluda la primera vez que alguien pasa cerca.
        if (d <= GREET_TILES && !a.greeted.has(q.sessionId)) {
          a.greeted.add(q.sessionId);
          if (time >= a.greetAt && !p.camina && a.avatar && talking !== a.npc.id) {
            a.greetAt = time + 6000;
            a.avatar.emote("wave");
          }
        }
      }
      a.lookAt = nearest && nearest.d <= LOOK_TILES && !p.camina && !p.asiento ? miraA(nearest.p.x - p.x, nearest.p.y - p.y) : null;
      if (talking === a.npc.id && me) a.lookAt = miraA(me.x - p.x, me.y - p.y);
      // ¿Al alcance para hablarle?
      const dMe = me ? Math.hypot(me.x - p.x, me.y - p.y) / ts : Infinity;
      if (dMe <= GENTE_REGLAS.alcanceTiles && (!cerca || dMe < cerca.d)) cerca = { id: a.npc.id, nombre: a.npc.nombre, d: dMe };
      // La marquita: el pedido que se le puede entregar o algo nuevo que contar (de cerca, si no está hablando ni murmurando).
      const kind: FiestaMarkKind | null =
        dMe > MARK_TILES || talking === a.npc.id || a.icon
          ? null
          : a.npc.pedido && !hechos.has(a.npc.pedido.id)
            ? "pedido"
            : !hablados.has(a.npc.id) && !a.npc.animal
              ? "nuevo"
              : null;
      this.setMark(a, kind);
    }
    const prev = useGenteFiesta.getState().cerca;
    if (prev?.id !== cerca?.id) useGenteFiesta.setState({ cerca: cerca && { id: cerca.id, nombre: cerca.nombre } });
    this.murmurs(time, me, ts);
  }

  private setMark(a: Actor, kind: FiestaMarkKind | null) {
    if (kind === a.markKind) return;
    a.markKind = kind;
    if (!kind) return void a.mark?.setVisible(false);
    const key = ensureTexture(this.scene, `fiesta-marca-${kind}`, () => fiestaMark(kind));
    if (!a.mark) a.mark = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
    a.mark.setTexture(key).setVisible(true);
    this.placeOverHead(a);
  }

  /** Los murmullos de este rato: el ícono de habla para todos y el texto para los dos más cercanos. */
  private murmurs(time: number, me: { x: number; y: number } | null, ts: number) {
    // Los íconos que se están mostrando: animan sus puntitos y se van solos.
    for (const a of this.actors.values()) {
      const icon = a.icon;
      if (!icon) continue;
      if (time >= icon.until || !a.visible) this.dropIcon(a);
      else if (time >= icon.frameAt) {
        icon.frameAt = time + 300;
        icon.frame = (icon.frame + 1) % FIESTA_MARK_FRAMES.habla;
        icon.img.setTexture(ensureTexture(this.scene, `fiesta-marca-habla-${icon.frame}`, () => fiestaMark("habla", icon.frame)));
      }
    }
    if (!me || murmullosCallados() || !this.nivel) return;
    const now = serverNow();
    const slot = slotMurmullo(now);
    const candidatos: { id: string; dist: number; line: string }[] = [];
    for (const a of this.actors.values()) {
      if (!a.visible || a.icon) continue;
      const dist = Math.hypot(a.pose.x - me.x, a.pose.y - me.y) / ts;
      if (dist > 14) continue;
      // En un corrillo hablan por turnos; los demás, cada uno a su ritmo.
      const corrillo = this.nivel.corrillo(a.npc.id);
      let habla = false;
      if (corrillo.length > 1) {
        const turn = Math.floor(now / MURMULLO.turnoMs);
        if (turn !== a.turn) {
          a.turn = turn;
          habla = corrillo[turnoDeCorrillo(now, corrillo.length)] === a.npc.id;
        }
      } else if (slot !== a.slot) {
        a.slot = slot;
        habla = tocaMurmullo(a.hash, slot);
      }
      const line = habla ? murmulloDe(a.npc, slot) : null;
      if (line) candidatos.push({ id: a.npc.id, dist, line });
    }
    if (!candidatos.length) return;
    const conLetra = conTexto(candidatos, murmullosVisibles());
    for (const c of candidatos) {
      const a = this.actors.get(c.id)!;
      this.showIcon(a, time);
      if (conLetra.has(c.id)) this.showText(a, c.line, c.dist);
    }
  }

  private showIcon(a: Actor, time: number) {
    const key = ensureTexture(this.scene, "fiesta-marca-habla-0", () => fiestaMark("habla", 0));
    const img = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
    a.icon = { img, until: time + MURMULLO.duraMs, frame: 0, frameAt: time + 300 };
    a.mark?.setVisible(false);
    a.markKind = null;
    this.placeOverHead(a);
  }

  private dropIcon(a: Actor) {
    a.icon?.img.destroy();
    a.icon = undefined;
  }

  /** El texto del murmullo (game/murmullo.ts, con el cupo de toda la pantalla): sigue a quien lo dice. */
  private showText(a: Actor, line: string, dist: number) {
    murmurar({
      scene: this.scene,
      quien: a.npc.id,
      donde: () => (a.visible ? { x: a.pose.x, y: a.pose.y } : null),
      alto: a.animal ? OVER_ANIMAL : OVER_HEAD,
      texto: line,
      dist,
      // El ícono de habla lo pone esta vista (esconde la marquita mientras tanto).
      icono: false,
    });
  }

  // ---------- Reacciones ----------

  /** Alguien del nivel hizo un emote: los de al lado contestan (al baile, con aplausos). */
  private onPlayerEmote(sessionId: string, emote: EmoteId) {
    const answer = respuestaA(emote);
    const who = this.deps.people().find((q) => q.sessionId === sessionId);
    if (!answer || !who || !this.map) return;
    const ts = this.map.tileSize;
    const near = [...this.actors.values()]
      .filter((a) => a.visible && a.avatar && !a.pose.camina && Math.hypot(a.pose.x - who.x, a.pose.y - who.y) <= EMOTE_TILES * ts)
      .sort((x, y) => Math.hypot(x.pose.x - who.x, x.pose.y - who.y) - Math.hypot(y.pose.x - who.x, y.pose.y - who.y))
      .slice(0, 2);
    near.forEach((a, i) => {
      if (this.scene.time.now < a.cheerAt) return;
      a.cheerAt = this.scene.time.now + 2500;
      this.scene.time.delayedCall(500 + i * 350, () => a.visible && a.avatar?.emote(answer));
    });
  }

  // ---------- Hablar ----------

  /** E junto a alguien de la fiesta: la tira con lo que dice, su pedido y su puesto. */
  hablar(id?: string) {
    const nivel = this.nivel;
    const s = useOfficeStore.getState();
    const target = id ?? useGenteFiesta.getState().cerca?.id;
    const a = target ? this.actors.get(target) : undefined;
    const clock = this.clock();
    const fest = festivalById(s.festival.id);
    if (!nivel || !a || !clock || !fest) return;
    const npc = a.npc;
    const dia = diaDelFestival(fest, fechaDelJuego(clock.day).diaDeEstacion);
    const ctx = { minuto: clock.minuto, clima: s.weather as Weather, dia };
    const lines = npc.animal ? [pickLine(npc.frases.hola, lineSeed(`${npc.id}:${Math.floor(clock.minuto / 30)}`))] : charlaDe(npc, ctx, lineSeed(`${npc.id}:${clock.day}:${Math.floor(clock.minuto / 60)}`));
    const opciones: { id: string; label: string }[] = [];
    const pedido = npc.pedido && !useGenteFiesta.getState().hechos.has(npc.pedido.id) ? npc.pedido : null;
    if (pedido) {
      const { texto, completo } = pideTexto(pedido.pide);
      lines.push(pedido.texto, texto);
      // Sin lo que pide no se ofrece "Entregar": solo la promesa de volver.
      if (completo) opciones.push({ id: "entregar", label: "Entregar" }, { id: "no", label: "Ahora no" });
      else opciones.push({ id: "no", label: "Ya se lo traigo" });
    }
    const puesto = npc.accion?.tipo === "puesto" ? PUESTO_DE[fest.id] : undefined;
    if (puesto) {
      opciones.unshift({ id: "puesto", label: "Ver el puesto" });
      if (!pedido) opciones.push({ id: "no", label: "Nada, gracias" });
    }
    a.avatar?.playGesture("nod");
    useGenteFiesta.setState((st) => ({ hablados: new Set([...st.hablados, npc.id]) }));
    this.setMark(a, null);
    this.dropIcon(a);
    const ts = nivel.map.tileSize;
    abrirDialogo({
      quien: npc.id,
      nombre: npc.nombre,
      rol: npc.rol,
      retrato: this.portrait(a),
      lineas: lines,
      opciones: opciones.length ? opciones : undefined,
      voz: npc.voz,
      alcance: () => {
        const me = this.deps.local();
        const cur = this.actors.get(npc.id);
        return Boolean(me && cur?.visible && Math.hypot(me.x - cur.pose.x, me.y - cur.pose.y) <= (GENTE_REGLAS.alcanceTiles + 1.8) * ts);
      },
      alElegir: (opcion) => {
        if (opcion === "puesto" && puesto) {
          useOfficeStore.getState().openPanel(puesto, true);
          return false;
        }
        if (opcion === "entregar" && pedido) {
          if (useGenteFiesta.getState().entregando) return true;
          useGenteFiesta.setState({ entregando: npc.id });
          getRoom()?.send(GENTE_MSG.entregar, { npc: npc.id, pedido: pedido.id });
          decirEnDialogo(npc.id, ["…"]);
          return true;
        }
        return false;
      },
    });
  }

  /** El retrato de quien habla (la cabeza de su hoja, o el perro de frente). */
  private portrait(a: Actor): string | null {
    if (a.key) return portraitFromSheet(this.scene, a.key);
    const an = a.npc.animal;
    if (!an) return null;
    return toHtmlCanvas(drawPet(an.especie, an.pelaje, "sit", "front", 0)).toDataURL();
  }

  /** Llegó la respuesta de una entrega: las gracias en la tira (o por qué no). */
  onResult(r: EntregarResult) {
    useGenteFiesta.setState({ entregando: null });
    const a = this.actors.get(r.npc);
    const pedido = a?.npc.pedido;
    if (!r.ok) {
      decirEnDialogo(r.npc, [ENTREGAR_ERROR_TEXT[r.error]]);
      if (r.error === "hecho" && pedido) useGenteFiesta.setState((s) => ({ hechos: new Set([...s.hechos, pedido.id]) }));
      return;
    }
    useGenteFiesta.setState((s) => ({ hechos: new Set([...s.hechos, r.pedido]) }));
    const premio = [r.item ? `${bagItemInfo(r.item).name} x${r.n ?? 1}` : null, r.puntos > 0 ? `${r.puntos} puntos` : null].filter(Boolean).join(" y ");
    decirEnDialogo(r.npc, [pedido?.gracias ?? "¡Gracias!", ...(premio ? [`Te dio: ${premio}.`] : [])]);
    a?.avatar?.emote("heart");
    // Algunos pedidos tienen su cinemática (el niño cuando le bajan la cometa del árbol).
    if (pedido?.cine) void playCinematic(pedido.cine, a?.npc.cometa ? { codigo: a.npc.cometa } : {});
  }
}

/** Hacia dónde mirar para ver algo a (dx, dy). */
function miraA(dx: number, dy: number): Direction {
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

/** "Pide: Mazorca x2 (tienes 1)." y si ya se tiene todo. */
function pideTexto(pide: readonly { item: string; n: number }[]): { texto: string; completo: boolean } {
  const slots = useBagStore.getState().slots;
  const tengo = (item: string) => slots.reduce((n, s) => n + (s?.itemId === objItemId(item) ? s.quantity : 0), 0);
  const partes = pide.map((p) => `${bagItemInfo(objItemId(p.item)).name} x${p.n} (tienes ${tengo(p.item)})`);
  return { texto: `Pide: ${partes.join("; ")}.`, completo: pide.every((p) => tengo(p.item) >= p.n) };
}

export { genteAlAlcance, useGenteFiesta };

/** Los de la fiesta que tienen cometa (los niños de la loma): dónde están, cuál y su pedido. */
export function genteCometas(): { id: string; x: number; y: number; code: string; pedido?: string }[] {
  const out: { id: string; x: number; y: number; code: string; pedido?: string }[] = [];
  for (const a of current?.actorsVisibles() ?? []) if (a.npc.cometa) out.push({ id: a.npc.id, x: a.pose.x, y: a.pose.y, code: a.npc.cometa, pedido: a.npc.pedido?.id });
  return out;
}

/** Clic sobre alguien de la fiesta: dónde está para caminar hasta él. */
export const genteBajo = (sx: number, sy: number) => current?.under(sx, sy) ?? null;

if (typeof window !== "undefined") {
  onInteract("fiestaNpc", () => current?.hablar());
  onRoom((room) => {
    useGenteFiesta.setState({ hechos: new Set(), entregando: null });
    room.onMessage(GENTE_MSG.resultado, (r: EntregarResult) => current?.onResult(r));
    room.onMessage(GENTE_MSG.hechos, (h: GenteHechos) => {
      if (h.festival === useOfficeStore.getState().festival.id) useGenteFiesta.setState({ hechos: new Set(h.pedidos) });
    });
    if (useOfficeStore.getState().festival.id) room.send(GENTE_MSG.hechos, {});
  });
  // Al cambiar de festival: se olvidan los pedidos y las charlas, y se pregunta qué ya se entregó.
  useOfficeStore.subscribe((s, prev) => {
    if (s.festival.id === prev.festival.id) return;
    useGenteFiesta.setState({ hechos: new Set(), hablados: new Set(), entregando: null });
    if (s.festival.id) getRoom()?.send(GENTE_MSG.hechos, {});
  });
}
