// El murmullo (VIR-171): lo que dicen solos los NPC de todo el juego, sin cajas. Sobre la cabeza sale el ícono
// de habla con sus puntitos y, si hay cupo, el texto blanco con contorno oscuro que sube y se desvanece en
// 2,5 s, siguiendo a quien habla. El cupo es uno solo para toda la pantalla (`MURMULLO.maxTextos`, dos): lo
// comparten la gente de la fiesta (genteFiesta.ts), el personal fijo (npcs/cast.ts), el desfile y las
// burbujas de las cinemáticas. Con la tira abierta o una cinemática de historia no murmura nadie (salvo lo
// que pide la misma cinemática) y lo que se estaba viendo se apaga. Las reglas puras están en lib/murmullos.ts.
import { BODY_UP, fiestaMark, FIESTA_MARK_FRAMES } from "@hyvento/map/art";
import type * as Phaser from "phaser";
import { COZY, cozyFontFamily } from "@/lib/cozy";
import { cupoMurmullo, MURMULLO } from "@/lib/murmullos";
import { lessMotion } from "@/lib/prefs";
import { cineBlocking, useCineStore } from "./cinematicas/store";
import { dialogoAbierto, useDialogo } from "./dialogo";
import { depthOf, ensureTexture, worldToScreen } from "./iso/view";

/** Sobre la cabeza de un chibi (px de pantalla desde los pies): encima del nombre. */
export const SOBRE_CABEZA = BODY_UP.crown + 7 + 14;

export interface Murmullo {
  scene: Phaser.Scene;
  /** Quién habla (un id): uno solo a la vez por cada quien. */
  quien: string;
  /** Dónde está quien habla (px de mundo), cada cuadro: el texto lo sigue. null = se fue (se apaga). */
  donde: () => { x: number; y: number } | null;
  /** Cuánto sobre los pies (px de pantalla). */
  alto?: number;
  texto: string;
  /** Distancia al jugador (tiles). */
  dist: number;
  /** Contesta a algo mío: si no hay cupo, se va el más viejo. */
  prioridad?: boolean;
  /** De una cinemática: sin mirar la distancia ni la tira. */
  forzar?: boolean;
  /** El ícono de habla (sí, salvo que quien llama ya ponga el suyo). */
  icono?: boolean;
}

interface Vivo {
  quien: string;
  scene: Phaser.Scene;
  obj: Phaser.GameObjects.GameObject;
  /** Lo que anima (se para al quitarlo). */
  tweened: object[];
  forzado: boolean;
  muerto?: boolean;
  off: () => void;
}

/** Los textos que se ven (el más viejo primero) y los íconos de habla. */
const textos: Vivo[] = [];
const iconos = new Map<string, Vivo>();

/** Cuántos textos de murmullo se ven ahora en toda la pantalla. */
export const murmullosVisibles = () => textos.length;

/** ¿Está callado todo? (una tira abierta o una cinemática de historia en pantalla). */
export const murmullosCallados = () => dialogoAbierto() || cineBlocking();

/**
 * Que alguien murmure: el ícono de habla y, si hay cupo, el texto. Devuelve si se ve el texto. Con la tira
 * abierta no sale nada (salvo `forzar`).
 */
export function murmurar(m: Murmullo): boolean {
  const tira = murmullosCallados();
  if (tira && !m.forzar) return false;
  if (m.icono !== false) icono(m);
  // El suyo de antes se va (no cuenta dos veces).
  const propio = textos.find((t) => t.quien === m.quien);
  if (propio) quitar(propio);
  const cupo = cupoMurmullo({ dist: m.dist, visibles: textos.length, tira, prioridad: m.prioridad, forzar: m.forzar });
  if (cupo === "no") return false;
  if (cupo === "reemplaza" && textos[0]) quitar(textos[0]);
  texto(m);
  return true;
}

/** Apaga lo que se está viendo (con `todo`, también lo de las cinemáticas). */
export function callarMurmullos(todo = false) {
  for (const t of [...textos]) if (todo || !t.forzado) quitar(t);
  for (const i of [...iconos.values()]) if (todo || !i.forzado) quitar(i);
}

function quitar(v: Vivo) {
  if (v.muerto) return;
  v.muerto = true;
  const i = textos.indexOf(v);
  if (i >= 0) textos.splice(i, 1);
  if (iconos.get(v.quien) === v) iconos.delete(v.quien);
  v.off();
  v.scene.tweens?.killTweensOf(v.tweened);
  v.obj.destroy();
}

/** Sigue a quien habla en cada cuadro; si se fue o la escena se cerró, se apaga. */
function seguir(scene: Phaser.Scene, v: Vivo, mover: () => boolean) {
  const tick = () => {
    if (!v.obj.active || !mover()) quitar(v);
  };
  const cerrar = () => quitar(v);
  scene.events.on("update", tick);
  scene.events.once("shutdown", cerrar);
  scene.events.once("destroy", cerrar);
  v.off = () => {
    scene.events.off("update", tick);
    scene.events.off("shutdown", cerrar);
    scene.events.off("destroy", cerrar);
  };
}

function texto(m: Murmullo) {
  const { scene } = m;
  const at = m.donde();
  if (!at) return;
  const alto = (m.alto ?? SOBRE_CABEZA) + 12;
  const obj = scene.add
    .text(0, 0, m.texto, {
      fontFamily: cozyFontFamily(),
      fontSize: "8px",
      color: "#fffaf0",
      stroke: COZY.frame,
      strokeThickness: 3,
      resolution: 6,
      align: "center",
      // Las frases largas del personal (el crupier, Don Evelio) en dos o tres renglones, no en una tira ancha.
      wordWrap: { width: 140 },
    })
    .setOrigin(0.5, 1);
  const sube = { y: 0 };
  const v: Vivo = { quien: m.quien, scene, obj, tweened: [obj, sube], forzado: Boolean(m.forzar), off: () => {} };
  textos.push(v);
  const place = () => {
    const p = m.donde();
    if (!p) return false;
    const s = worldToScreen(p.x, p.y);
    obj.setPosition(Math.round(s.x), Math.round(s.y - alto - sube.y)).setDepth(6e7 + depthOf(p.x, p.y));
    return true;
  };
  place();
  seguir(scene, v, place);
  // Sube parejo todo el rato (con menos movimiento, quieto) y se desvanece al final.
  if (!lessMotion()) scene.tweens.add({ targets: sube, y: 10, duration: MURMULLO.duraMs });
  scene.tweens.add({
    targets: obj,
    alpha: 0,
    delay: MURMULLO.duraMs * 0.6,
    duration: MURMULLO.duraMs * 0.4,
    onComplete: () => quitar(v),
  });
}

/** El ícono de habla sobre la cabeza, con sus puntitos, mientras dura el murmullo. */
function icono(m: Murmullo) {
  const { scene } = m;
  const old = iconos.get(m.quien);
  if (old) quitar(old);
  const key = (f: number) => ensureTexture(scene, `fiesta-marca-habla-${f}`, () => fiestaMark("habla", f));
  const img = scene.add.image(0, 0, key(0)).setOrigin(0.5, 1);
  const v: Vivo = { quien: m.quien, scene, obj: img, tweened: [], forzado: Boolean(m.forzar), off: () => {} };
  iconos.set(m.quien, v);
  const alto = m.alto ?? SOBRE_CABEZA;
  const hasta = scene.time.now + MURMULLO.duraMs;
  let frame = 0;
  let frameAt = scene.time.now + 300;
  seguir(scene, v, () => {
    const p = m.donde();
    if (!p || scene.time.now >= hasta) return false;
    if (scene.time.now >= frameAt) {
      frameAt = scene.time.now + 300;
      frame = (frame + 1) % FIESTA_MARK_FRAMES.habla;
      img.setTexture(key(frame));
    }
    const s = worldToScreen(p.x, p.y);
    img.setPosition(Math.round(s.x + 2), Math.round(s.y - alto)).setDepth(5e7 + depthOf(p.x, p.y) + 0.41);
    return true;
  });
}

if (typeof window !== "undefined") {
  // Al abrir una conversación o empezar una cinemática de historia, los murmullos de alrededor se apagan.
  useDialogo.subscribe((s, prev) => {
    if (s.actual && !prev.actual) callarMurmullos();
  });
  useCineStore.subscribe((s, prev) => {
    if (s.playing?.kind === "historia" && prev.playing?.kind !== "historia") callarMurmullos();
    // Al terminar la cinemática, lo que ella puso tampoco se queda.
    if (!s.playing && prev.playing) callarMurmullos(true);
  });
}
