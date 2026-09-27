// Animaciones de lo que se tiene en la mano: la pitada (brasa que brilla y humo que sube, se ondula y se
// deshace), el sorbo (el vaso se inclina hacia la boca) y el mordisco (migas que caen). Las usa Avatar.ts;
// el arte (cada estado dibujado por código) está en packages/map/src/art/items.ts.
import { crumb, drawHeldItem, emberGlow, wisp, type HeldEffect, type RGBA } from "@hyvento/map/art";
import type { ConsumeAction } from "@hyvento/shared";
import * as Phaser from "phaser";
import { ensureTexture } from "./iso/view";
import { sfx } from "./sfx";

/** Tiempos de cada uso (ms). Todo junto dura menos que la pausa del servidor entre usos. */
export const USE_MS = { raise: 260, puff: 560, sip: 520, chomp: 130, lower: 240 } as const;

/** Textura de algo en la mano según su estado (se dibuja una vez y se reutiliza). */
export function heldTexture(scene: Phaser.Scene, art: string, left: number, ember: 0 | 1 | 2, tilt: -1 | 0 | 1): string {
  return ensureTexture(scene, `mano-${art}-${left}-${ember}-${tilt}`, () => drawHeldItem(art, { left, ember, tilt }));
}

function wispKey(scene: Phaser.Scene, size: 0 | 1 | 2 | 3, fx: HeldEffect) {
  return ensureTexture(scene, `voluta-${fx}-${size}`, () => wisp(size, fx));
}

export interface WispOptions {
  fx: HeldEffect;
  /** Tamaño al salir y al final (crece mientras sube). */
  from: 0 | 1 | 2 | 3;
  to: 0 | 1 | 2 | 3;
  /** Cuánto sube (px), hacia dónde se corre y cuánto se ondula. */
  rise: number;
  drift: number;
  wobble: number;
  ms: number;
  delay?: number;
}

/** Capa de los nombres de los avatares: el humo se dibuja encima. */
const ABOVE_LABELS = 5e7 + 0.2;

/**
 * Una voluta de humo o vapor en (x, y) de pantalla: sube, se ondula de lado a lado, crece y se deshace.
 * Queda en el mundo (no sigue a la persona), como el humo de verdad.
 */
export function spawnWisp(scene: Phaser.Scene, x: number, y: number, depth: number, o: WispOptions) {
  const sizes: (0 | 1 | 2 | 3)[] = [];
  for (let s = o.from; s <= o.to; s++) sizes.push(s as 0 | 1 | 2 | 3);
  // Por encima de los nombres (que van en 5e7 + profundidad, ver Avatar.layout): el humo sube justo
  // donde está la etiqueta y, si no, la etiqueta lo tapaba entero.
  const img = scene.add.image(x, y, wispKey(scene, o.from, o.fx)).setOrigin(0.5, 0.5).setDepth(ABOVE_LABELS + depth).setAlpha(0);
  const phase = Math.random() * Math.PI * 2;
  let size = 0;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: o.ms,
    delay: o.delay ?? 0,
    onUpdate: (t) => {
      const v = t.getValue() ?? 0;
      const k = Math.min(sizes.length - 1, Math.floor(v * sizes.length));
      if (k !== size) {
        size = k;
        img.setTexture(wispKey(scene, sizes[k]!, o.fx));
      }
      // Sube frenando, se corre con el "viento" y se ondula cada vez más.
      const up = o.rise * (1 - (1 - v) * (1 - v));
      const side = o.drift * v + Math.sin(phase + v * 7) * o.wobble * v;
      img.setPosition(Math.round(x + side), Math.round(y - up));
      img.setAlpha(v < 0.12 ? v / 0.12 : 1 - (v - 0.12) / 0.88);
    },
    onComplete: () => img.destroy(),
  });
}

/** Bocanada al soltar el humo: varias volutas que salen de la boca y se abren. */
export function exhale(scene: Phaser.Scene, x: number, y: number, depth: number, side: number) {
  for (let k = 0; k < 9; k++) {
    spawnWisp(scene, x + side * (1 + k * 0.7), y - k * 0.5, depth, {
      fx: "smoke",
      from: k < 3 ? 1 : 0,
      to: 3,
      rise: 22 + Math.random() * 12,
      drift: side * (10 + Math.random() * 10),
      wobble: 2.5 + Math.random() * 2,
      ms: 2600 + Math.random() * 900,
      delay: k * 80,
    });
  }
}

/** Hilo de humo de la brasa (mientras se sostiene) o del vapor de una bebida caliente. */
export function idleWisp(scene: Phaser.Scene, x: number, y: number, depth: number, fx: HeldEffect) {
  const smoke = fx === "smoke";
  spawnWisp(scene, x, y, depth, {
    fx,
    from: 0,
    to: smoke ? 2 : 1,
    rise: smoke ? 16 + Math.random() * 6 : 8 + Math.random() * 3,
    drift: (Math.random() - 0.3) * 3,
    wobble: smoke ? 1.6 : 1,
    ms: smoke ? 1900 : 1300,
  });
}

/** Halo de la brasa al pitar (luz que se suma). */
export function emberHalo(scene: Phaser.Scene): Phaser.GameObjects.Image {
  const key = ensureTexture(scene, "halo-brasa", () => emberGlow());
  return scene.add.image(0, 0, key).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
}

/** Migas que caen al morder: saltan un poco y caen con gravedad hasta el piso. */
export function spawnCrumbs(scene: Phaser.Scene, x: number, y: number, floorY: number, depth: number, color: RGBA) {
  const key = ensureTexture(scene, `miga-${color.join("-")}`, () => crumb(color));
  const big = ensureTexture(scene, `miga-g-${color.join("-")}`, () => crumb(color, true));
  for (let k = 0; k < 4; k++) {
    const img = scene.add.image(x, y, k === 0 ? big : key).setDepth(depth);
    const vx = (Math.random() - 0.5) * 16;
    const vy = -10 - Math.random() * 12;
    const fall = floorY - y;
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 520 + Math.random() * 200,
      onUpdate: (t) => {
        const s = (t.getValue() ?? 0) * 0.7;
        const dy = Math.min(fall, vy * s + 90 * s * s);
        img.setPosition(Math.round(x + vx * s), Math.round(y + dy));
      },
      onComplete: () =>
        scene.tweens.add({ targets: img, alpha: 0, duration: 400, delay: 250, onComplete: () => img.destroy() }),
    });
  }
}

/** Lo que un uso necesita de la mano que se anima (lo implementa Avatar). */
export interface UseTarget {
  /** Cuánto está levantada hacia la boca (0 = en la mano, 1 = en la boca) y un saltito en px. */
  setPose(raise: number, bob: number): void;
  setTilt(tilt: -1 | 0 | 1): void;
  setEmber(ember: 0 | 1 | 2): void;
  /** Aplica los usos que quedan (el vaso baja, el mordisco se ve, el cigarro se acorta). */
  applyLeft(): void;
  /** Hacia dónde queda la cara respecto de la mano (-1 izquierda, 1 derecha). */
  faceSide(): -1 | 1;
  /** Puntos en pantalla: la boca, la brasa, y la profundidad para lo que sale de ahí. */
  mouth(): { x: number; y: number; depth: number; floorY: number };
  emberPoint(): { x: number; y: number; depth: number } | null;
  crumbColor(): RGBA | null;
  hidden(): boolean;
  /** Cuánto se oye desde donde estoy (0 si está en otro nivel). */
  volume(): number;
  done(): void;
}

/**
 * Tween de 0 a 1 en `ms`, como promesa (para encadenar los pasos de un uso). También se resuelve si el
 * tween se corta (la escena se reinicia): si no, la mano quedaría ocupada para siempre.
 */
function step(scene: Phaser.Scene, ms: number, fn: (v: number) => void): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      ease: "Sine.easeInOut",
      onUpdate: (t) => fn(t.getValue() ?? 0),
      onComplete: () => resolve(),
      onStop: () => resolve(),
    });
  });
}

/** Un uso completo, con su animación según qué es. */
export async function playUse(scene: Phaser.Scene, action: ConsumeAction, target: UseTarget) {
  try {
    await animateUse(scene, action, target);
  } finally {
    // Pase lo que pase con la animación, la mano se libera y se aplica lo que dijo el servidor.
    target.setPose(0, 0);
    target.done();
  }
}

async function animateUse(scene: Phaser.Scene, action: ConsumeAction, target: UseTarget) {
  await step(scene, USE_MS.raise, (v) => target.setPose(v, 0));
  if (action === "smoke") {
    // La brasa se enciende mientras se pita, con su halo.
    const halo = emberHalo(scene);
    target.setEmber(2);
    sfx.puff(target.volume());
    await step(scene, USE_MS.puff, (v) => {
      const p = target.emberPoint();
      if (p) halo.setPosition(p.x, p.y).setDepth(p.depth + 0.01).setAlpha(Math.sin(v * Math.PI) * 0.9);
      target.setPose(1, v > 0.3 && v < 0.7 ? -1 : 0);
    });
    halo.destroy();
    target.setEmber(1);
    target.applyLeft();
    await step(scene, USE_MS.lower, (v) => target.setPose(1 - v, 0));
    const m = target.mouth();
    if (!target.hidden()) exhale(scene, m.x, m.y, m.depth, target.faceSide());
    sfx.exhale(target.volume());
  } else if (action === "sip") {
    // Se inclina hacia la cara, un sorbo (saltito) y vuelve derecho con menos líquido.
    target.setTilt(target.faceSide() < 0 ? -1 : 1);
    sfx.sip(target.volume());
    await step(scene, USE_MS.sip, (v) => target.setPose(1, Math.round(Math.sin(v * Math.PI * 2)) === 1 ? -1 : 0));
    target.setTilt(0);
    target.applyLeft();
    await step(scene, USE_MS.lower, (v) => target.setPose(1 - v, 0));
  } else {
    // Dos mordiscos rápidos: en el primero se ve el pedazo que falta y caen migas.
    await step(scene, USE_MS.chomp, (v) => target.setPose(1, v > 0.5 ? 1 : 0));
    sfx.chomp(target.volume());
    target.applyLeft();
    const color = target.crumbColor();
    const m = target.mouth();
    if (color && !target.hidden()) spawnCrumbs(scene, m.x, m.y + 2, m.floorY, m.depth, color);
    await step(scene, USE_MS.chomp, (v) => target.setPose(1, v > 0.5 ? 1 : 0));
    sfx.chomp(target.volume() * 0.7);
    await step(scene, USE_MS.lower, (v) => target.setPose(1 - v, 0));
  }
}
