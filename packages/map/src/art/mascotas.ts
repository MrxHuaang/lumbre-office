// Casa viva: las mascotas (gato y perro), chibis de animal dibujados por código. Dos vistas: de frente
// (mirando a la izquierda de la pantalla y hacia la cámara, la dirección "down") y de espaldas (mirando a
// la izquierda y alejándose, "left"); "right" y "up" son su espejo, como el truco de los muebles. Poses:
// de pie, caminando (dos cuadros), sentada, durmiendo (respira, dos cuadros) y comiendo (dos cuadros).
import { OUT, SHADOW } from "./palette";
import { PixelCanvas, alpha, hex, type RGBA } from "./pixel";

export type PetArtKind = "gato" | "perro";
export type PetArtPose = "stand" | "walk" | "sit" | "sleep" | "eat";
export type PetView = "front" | "back";

/** Lienzo de cada cuadro y dónde quedan los pies (el origen del sprite en el juego). */
export const PET_FRAME = { w: 26, h: 22, feetX: 13, feetY: 19 } as const;

interface Coat {
  base: RGBA;
  dark: RGBA;
  light: RGBA;
  belly: RGBA;
  /** Rayas (el gato naranja) o manchas (el perro). */
  mark?: RGBA;
}

const COATS: Record<string, Coat> = {
  naranja: { base: hex("#e08a3c"), dark: hex("#a85a26"), light: hex("#f6bb73"), belly: hex("#fbe4c2"), mark: hex("#c06a2a") },
  gris: { base: hex("#8f95a0"), dark: hex("#5f6470"), light: hex("#bcc1ca"), belly: hex("#e3e5ea"), mark: hex("#767b86") },
  cafe: { base: hex("#9a6a40"), dark: hex("#65422a"), light: hex("#c8955e"), belly: hex("#efd6ab"), mark: hex("#5a3a22") },
};

const EYE = hex("#2a1a14");
const NOSE_CAT = hex("#e58a9a");
const NOSE_DOG = hex("#2a1a14");
const EAR_IN = hex("#f0a8b0");
const COLLAR = hex("#d9433f");
const TAG = hex("#f3d672");

/** Cuántos cuadros tiene cada pose (la caminata alterna patas, dormir respira, comer mastica). */
export const PET_POSE_FRAMES: Record<PetArtPose, number> = { stand: 1, walk: 2, sit: 1, sleep: 2, eat: 2 };

/** Partes del cuerpo en el lienzo; cada forma se pinta con un color y después se sombrea el borde. */
class Body {
  readonly c = new PixelCanvas(PET_FRAME.w, PET_FRAME.h);
  /** Qué píxeles son del pelaje base (para sombrearlos al final sin tocar ojos ni nariz). */
  private fur = new Set<number>();

  constructor(private readonly coat: Coat) {}

  private mark(x: number, y: number) {
    this.fur.add(Math.floor(y) * PET_FRAME.w + Math.floor(x));
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, col: RGBA = this.coat.base) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        this.c.set(x, y, col);
        if (col === this.coat.base) this.mark(x, y);
        else this.fur.delete(y * PET_FRAME.w + x);
      }
  }

  rect(x: number, y: number, w: number, h: number, col: RGBA = this.coat.base) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        this.c.set(i, j, col);
        if (col === this.coat.base) this.mark(i, j);
        else this.fur.delete(j * PET_FRAME.w + i);
      }
  }

  px(x: number, y: number, col: RGBA) {
    this.c.set(x, y, col);
    if (col === this.coat.base) this.mark(x, y);
    else this.fur.delete(Math.floor(y) * PET_FRAME.w + Math.floor(x));
  }

  /** Luz desde arriba: el borde de arriba del pelaje más claro y el de abajo más oscuro. */
  shade() {
    const { w } = PET_FRAME;
    const top: number[] = [];
    const bottom: number[] = [];
    for (const i of this.fur) {
      const x = i % w;
      const y = Math.floor(i / w);
      if (!this.c.alphaAt(x, y - 1)) top.push(x, y);
      else if (!this.c.alphaAt(x, y + 1) || this.isDarkBelow(x, y)) bottom.push(x, y);
    }
    for (let k = 0; k < top.length; k += 2) this.c.set(top[k]!, top[k + 1]!, this.coat.light);
    for (let k = 0; k < bottom.length; k += 2) this.c.set(bottom[k]!, bottom[k + 1]!, this.coat.dark);
  }

  private isDarkBelow(x: number, y: number) {
    const i = ((y + 1) * PET_FRAME.w + x) * 4;
    const d = this.c.data;
    return d[i] === OUT[0] && d[i + 1] === OUT[1] && d[i + 2] === OUT[2];
  }

  /** Contorno café y sombra en el piso (solo donde no hay nada dibujado). */
  finish(shadowRx: number) {
    this.shade();
    this.c.outline(OUT);
    const { feetX, feetY } = PET_FRAME;
    for (let y = feetY - 2; y <= feetY + 2; y++)
      for (let x = feetX - shadowRx - 1; x <= feetX + shadowRx + 1; x++) {
        const dx = (x + 0.5 - feetX) / shadowRx;
        const dy = (y + 0.5 - feetY) / 1.8;
        if (dx * dx + dy * dy <= 1 && !this.c.alphaAt(x, y)) this.c.set(x, y, alpha(SHADOW, 0.3));
      }
    return this.c;
  }
}

/** Orejas de gato (triángulos con el interior rosado) sobre una cabeza con centro (hx, hy). */
function catEars(b: Body, hx: number, hy: number, r: number, coat: Coat, inner: boolean) {
  for (const side of [-1, 1]) {
    const ex = Math.round(hx + side * (r - 1.4));
    const top = Math.round(hy - r - 1.2);
    b.px(ex, top, coat.base);
    b.rect(side < 0 ? ex - 1 : ex, top + 1, 2, 1);
    b.rect(ex - 1, top + 2, 3, 1);
    b.px(ex, top + 2, inner ? EAR_IN : coat.dark);
  }
}

/** Orejas caídas de perro, a los lados de la cabeza. */
function dogEars(b: Body, hx: number, hy: number, r: number, coat: Coat, lift = 0) {
  for (const side of [-1, 1]) b.ellipse(hx + side * (r - 0.3), hy - 0.4 - lift, 1.3, 2.6, coat.dark);
}

/** Cabeza de frente (mirando a la izquierda): ojos, nariz y hocico. `sleepy` = ojos cerrados. */
function faceFront(b: Body, kind: PetArtKind, hx: number, hy: number, r: number, coat: Coat, sleepy = false) {
  b.ellipse(hx, hy, r, r * 0.92);
  if (kind === "gato") catEars(b, hx, hy, r, coat, true);
  else dogEars(b, hx, hy, r, coat);
  // Mejillas claras y el hocico (el del perro más largo, hacia la izquierda).
  if (kind === "perro") {
    b.ellipse(hx - 1.6, hy + 1.3, 2.3, 1.5, coat.belly);
    b.px(Math.round(hx - 3), Math.round(hy + 0.6), NOSE_DOG);
    b.px(Math.round(hx - 2), Math.round(hy + 0.6), NOSE_DOG);
  } else {
    b.ellipse(hx - 0.6, hy + 1.4, 1.9, 1.1, coat.belly);
    b.px(Math.round(hx - 0.8), Math.round(hy + 0.6), NOSE_CAT);
  }
  const ey = Math.round(hy - 0.8);
  const ex = [Math.round(hx - 2.2), Math.round(hx + 0.8)];
  for (const x of ex) {
    if (sleepy) b.px(x, ey + 1, EYE);
    else {
      b.px(x, ey, EYE);
      b.px(x, ey + 1, EYE);
    }
  }
}

/** Cabeza de espaldas: la nuca y las orejas (sin cara). */
function headBack(b: Body, kind: PetArtKind, hx: number, hy: number, r: number, coat: Coat) {
  b.ellipse(hx, hy, r, r * 0.92);
  if (kind === "gato") catEars(b, hx, hy, r, coat, false);
  else dogEars(b, hx, hy, r, coat, 0.4);
}

/** Cola: el gato la lleva alta y curva; el perro, corta y moviéndola. */
function tail(b: Body, kind: PetArtKind, x: number, y: number, coat: Coat, sway: number) {
  if (kind === "gato") {
    const pts: [number, number][] = [
      [0, 0],
      [1, -1],
      [1, -2],
      [2, -3],
      [2 + sway, -4],
      [2 + sway, -5],
      [1 + sway, -6],
    ];
    pts.forEach(([dx, dy], i) => {
      b.px(x + dx, y + dy, i >= pts.length - 2 ? coat.dark : coat.base);
      b.px(x + dx + 1, y + dy, i >= pts.length - 2 ? coat.dark : coat.base);
    });
  } else {
    const pts: [number, number][] = [
      [0, 0],
      [1, -1],
      [1 + sway, -2],
      [2 + sway, -3],
    ];
    for (const [dx, dy] of pts) {
      b.px(x + dx, y + dy, coat.base);
      b.px(x + dx + 1, y + dy, coat.base);
    }
  }
}

/** Cuatro patas: `step` las alterna al caminar (0 quieta, 1 y 2 pasos opuestos). */
function legs(b: Body, kind: PetArtKind, coat: Coat, step: 0 | 1 | 2, x0: number, x1: number, top: number) {
  const bottom = PET_FRAME.feetY;
  const h = bottom - top;
  const leg = (x: number, forward: number, far: boolean) => {
    const lift = forward !== 0 ? 1 : 0;
    const col = far ? coat.dark : coat.base;
    b.rect(x + forward, top, 2, h - lift, col);
    // Patitas claras (el perro, con "medias").
    b.rect(x + forward, bottom - lift - 1, 2, 1, kind === "perro" ? coat.belly : far ? coat.dark : coat.light);
  };
  // Las de cerca dan el paso más largo (2 px) que las de lejos: así los dos cuadros se distinguen.
  const a = step === 1 ? -1 : step === 2 ? 1 : 0;
  // Las de atrás (más lejos) primero, más oscuras.
  leg(x0 + 2, -a, true);
  leg(x1 + 2, a, true);
  leg(x0, a * 2, false);
  leg(x1, -a * 2, false);
}

function drawStand(kind: PetArtKind, coat: Coat, view: PetView, frame: number, pose: "stand" | "walk" | "eat") {
  const b = new Body(coat);
  const dog = kind === "perro";
  const body = dog ? { x: 14, y: 12.6, rx: 6.6, ry: 3.5 } : { x: 14, y: 13, rx: 6, ry: 3.1 };
  const step = pose === "walk" ? ((frame % 2) + 1) as 1 | 2 : 0;
  const bob = pose === "walk" && frame % 2 ? -1 : 0;
  const head = pose === "eat" ? { x: 6.2, y: 13.2 + (frame % 2 ? 0.6 : 0) } : dog ? { x: 7, y: 8.6 + bob } : { x: 7.4, y: 9 + bob };
  const r = dog ? 4 : 3.6;
  tail(b, kind, Math.round(body.x + body.rx - 1.5), Math.round(body.y - 1.5 + bob), coat, pose === "walk" ? frame % 2 : 0);
  legs(b, kind, coat, step, Math.round(body.x - body.rx + 1.5), Math.round(body.x + body.rx - 4.5), Math.round(body.y + 1.5));
  if (view === "back") headBack(b, kind, head.x, head.y, r, coat);
  b.ellipse(body.x, body.y + bob, body.rx, body.ry);
  // Panza clara y, en el gato naranja, rayas en el lomo; el perro con collar.
  b.ellipse(body.x - 0.5, body.y + 1.6 + bob, body.rx - 1.6, 1.2, coat.belly);
  if (coat.mark && !dog) for (const k of [-2, 0, 2]) b.rect(Math.round(body.x + k), Math.round(body.y - body.ry + 1 + bob), 1, 2, coat.mark);
  if (dog && coat.mark) b.ellipse(body.x + 2.5, body.y - 1 + bob, 2, 1.3, coat.mark);
  if (view === "front") faceFront(b, kind, head.x, head.y, r, coat);
  if (dog && view === "front" && pose !== "eat") {
    b.rect(Math.round(head.x - 1), Math.round(head.y + r - 0.5), 4, 1, COLLAR);
    b.px(Math.round(head.x), Math.round(head.y + r + 0.5), TAG);
  }
  return b.finish(dog ? 7.5 : 7);
}

function drawSit(kind: PetArtKind, coat: Coat, view: PetView) {
  const b = new Body(coat);
  const dog = kind === "perro";
  const r = dog ? 4 : 3.6;
  const head = { x: 10.5, y: dog ? 6.2 : 6.8 };
  // La cola en el piso, enroscada hacia adelante.
  for (let k = 0; k < 6; k++) b.px(15 + k, PET_FRAME.feetY - (k > 3 ? k - 3 : 0), k > 3 ? coat.dark : coat.base);
  for (let k = 0; k < 5; k++) b.px(15 + k, PET_FRAME.feetY - 1 - (k > 3 ? k - 3 : 0), coat.base);
  // Anca y lomo erguido.
  b.ellipse(14.5, 15.6, 4, 3);
  b.ellipse(12, 12.2, dog ? 4.4 : 4, dog ? 5 : 4.6);
  if (view === "front") b.ellipse(11.2, 13.4, 2.3, 3.2, coat.belly);
  else {
    // De espaldas, sentada: la cabeza (nuca y orejas) encima del lomo, con la raya del lomo más oscura.
    for (let y = 10; y < 16; y++) b.px(12, y, coat.mark ?? coat.dark);
    if (dog) {
      // El perro: la mancha del lomo, la cola parada moviéndose y las orejas caídas a los lados.
      if (coat.mark) b.ellipse(13.6, 13.2, 1.8, 1.5, coat.mark);
      for (let k = 0; k < 4; k++) {
        b.px(16 + (k > 1 ? 1 : 0), 13 - k, coat.base);
        b.px(17 + (k > 1 ? 1 : 0), 13 - k, k === 3 ? coat.light : coat.base);
      }
    }
    headBack(b, kind, head.x, head.y, r, coat);
    if (dog) {
      for (const side of [-1, 1]) b.rect(Math.round(head.x + side * (r - 0.5)) - (side < 0 ? 1 : 0), Math.round(head.y), 1, 3, coat.dark);
      b.rect(Math.round(head.x - 2), Math.round(head.y + r - 0.5), 5, 1, COLLAR);
      // La hebilla del collar, atrás.
      b.px(Math.round(head.x), Math.round(head.y + r - 0.5), TAG);
    }
  }
  // Patas delanteras rectas.
  b.rect(9, 14, 2, PET_FRAME.feetY - 14, coat.base);
  b.rect(11, 14, 2, PET_FRAME.feetY - 14, coat.base);
  b.rect(9, PET_FRAME.feetY - 1, 4, 1, dog ? coat.belly : coat.light);
  if (view === "front") {
    faceFront(b, kind, head.x, head.y, r, coat);
    if (dog) b.rect(Math.round(head.x - 1), Math.round(head.y + r - 0.5), 4, 1, COLLAR);
  }
  return b.finish(6.5);
}

function drawSleep(kind: PetArtKind, coat: Coat, frame: number) {
  const b = new Body(coat);
  const dog = kind === "perro";
  const breathe = frame % 2 ? 0.4 : 0;
  // Enroscada: un pan redondo, la cabeza apoyada a la izquierda y la cola rodeando por delante.
  b.ellipse(13.5, 15.8 - breathe / 2, dog ? 7 : 6.4, (dog ? 3.4 : 3.1) + breathe);
  if (coat.mark && !dog) for (const k of [0, 2, 4]) b.rect(12 + k, Math.round(13 - breathe), 1, 2, coat.mark);
  const hx = 7.4;
  const hy = 15.4;
  b.ellipse(hx, hy, dog ? 3.4 : 3, 2.7);
  if (kind === "gato") {
    b.rect(5, 12, 2, 1);
    b.rect(8, 12, 2, 1);
    b.px(5, 11, coat.base);
    b.px(9, 11, coat.base);
  } else {
    b.ellipse(9.4, 14.2, 1.4, 2.2, coat.dark);
    b.ellipse(5.4, 17, 2, 1.1, coat.belly);
    b.px(4, 16, NOSE_DOG);
  }
  // Ojos cerrados: una rayita.
  b.px(6, 15, EYE);
  b.px(7, 15, EYE);
  for (let k = 0; k < 9; k++) b.px(8 + k, PET_FRAME.feetY - (k < 2 ? 1 : 0), k < 2 ? coat.dark : coat.base);
  return b.finish(dog ? 8 : 7.5);
}

/** Un cuadro de una mascota: `pelaje` "naranja", "gris" o "cafe". Mira a la izquierda (el cliente voltea). */
export function drawPet(kind: PetArtKind, coatId: string, pose: PetArtPose, view: PetView, frame = 0): PixelCanvas {
  const coat = COATS[coatId] ?? COATS.naranja!;
  if (pose === "sleep") return drawSleep(kind, coat, frame);
  if (pose === "sit") return drawSit(kind, coat, view);
  return drawStand(kind, coat, view, frame, pose);
}

/** Premio: un pescadito para el gato, un hueso para el perro. */
export function petTreat(kind: PetArtKind): PixelCanvas {
  const rows =
    kind === "gato"
      ? [
          "..oooo.o", //
          ".obbbboo",
          "obwbbbbo",
          ".obbbboo",
          "..oooo.o",
        ]
      : [
          "oo....oo", //
          "owoooowo",
          ".owwwwo.",
          "owoooowo",
          "oo....oo",
        ];
  const col: Record<string, RGBA> = { b: hex("#8fb7d6"), w: kind === "gato" ? hex("#e8f4fb") : hex("#f7ebc8"), o: OUT };
  const c = new PixelCanvas(8, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== "." && c.set(x, y, col[ch]!)));
  return c;
}

/** Una "z" chiquita de 4x4 (salen al dormir). */
export function sleepZ(): PixelCanvas {
  const c = new PixelCanvas(6, 6);
  const z = hex("#f7ebc8");
  c.rect(1, 1, 4, 1, z);
  c.set(3, 2, z);
  c.set(2, 3, z);
  c.rect(1, 4, 4, 1, z);
  c.outline(OUT);
  return c;
}
