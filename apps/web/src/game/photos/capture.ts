// La foto en el navegador de quien la saca: recortar el canvas del juego alrededor suyo (el HUD es DOM,
// no sale), armar la polaroid con su pie y comprimirla bajo el tope de la API. Todo por código.
import { PHOTO, POLAROID, peopleText, photoDateText, type PhotoPerson } from "@hyvento/shared";
import { MARCO_ENAMORADOS } from "@hyvento/map/art";
import { COZY, cozyFontFamily } from "@/lib/cozy";

/** Lo visible de la cámara de Phaser que hace falta para ubicar el recorte en el canvas. */
export interface CameraView {
  zoom: number;
  x: number;
  y: number;
  worldView: { x: number; y: number };
}

/**
 * Recorta `PHOTO.shot` px de juego alrededor de `feet` (pantalla del juego, zoom 1) a escala 1: el zoom
 * de la cámara es entero, así que cada píxel de arte cae en un píxel de la foto (pixel-perfect).
 */
export function captureShot(game: HTMLCanvasElement, cam: CameraView, feet: { x: number; y: number }): HTMLCanvasElement {
  const { w, h } = PHOTO.shot;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  // Lo que queda fuera del nivel es la noche de afuera (el canvas del juego es transparente).
  ctx.fillStyle = COZY.void;
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  const z = cam.zoom;
  const left = feet.x - w / 2;
  const top = feet.y - PHOTO.lift - h / 2;
  // Del mundo (px de juego) al canvas: lo mismo que hace la cámara al dibujar.
  let sx = (left - cam.worldView.x) * z + cam.x;
  let sy = (top - cam.worldView.y) * z + cam.y;
  let sw = w * z;
  let sh = h * z;
  let dx = 0;
  let dy = 0;
  // Recortar a lo que existe del canvas (si la foto se sale por un borde, ahí queda la noche).
  if (sx < 0) {
    dx = -sx / z;
    sw += sx;
    sx = 0;
  }
  if (sy < 0) {
    dy = -sy / z;
    sh += sy;
    sy = 0;
  }
  sw = Math.min(sw, game.width - sx);
  sh = Math.min(sh, game.height - sy);
  if (sw > 0 && sh > 0) ctx.drawImage(game, sx, sy, sw, sh, dx, dy, sw / z, sh / z);
  return out;
}

export interface PolaroidInfo {
  takenAt: number;
  areaName: string;
  people: PhotoPerson[];
  caption: string;
  /** Marco especial: la banca de los enamorados (papel rosado con corazones en el borde). */
  marco?: "enamorados";
}

/** Un corazón de pixel (7x6) en (x, y) del lienzo, de `s` px por punto. */
const CORAZON = [".xx.xx.", "xxxxxxx", "xxxxxxx", ".xxxxx.", "..xxx..", "...x..."];
function corazonPixel(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, brillo?: string) {
  CORAZON.forEach((row, j) =>
    [...row].forEach((c, i) => {
      if (c !== "x") return;
      ctx.fillStyle = brillo && j === 1 && i === 1 ? brillo : color;
      ctx.fillRect(x + i * s, y + j * s, s, s);
    }),
  );
}

/** El marco de la banca de los enamorados: corazones repartidos por el borde de papel. */
function marcoEnamorados(ctx: CanvasRenderingContext2D, w: number, h: number, s: number, top: number, side: number, bottom: number) {
  const { borde, corazon, brillo } = MARCO_ENAMORADOS;
  const css = (c: readonly number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  // Por arriba y por los lados, en el papel que rodea la foto.
  const paso = 16 * s;
  for (let x = side * s; x < w - 8 * s; x += paso) corazonPixel(ctx, x + 2 * s, Math.max(s, (top * s - 6 * s) / 2), s, css(corazon), css(brillo));
  for (let y = top * s + paso / 2; y < h - bottom * s; y += paso)
    for (const x of [Math.max(s, (side * s - 7 * s) / 2), w - Math.max(s, (side * s - 7 * s) / 2) - 7 * s]) corazonPixel(ctx, x, y, s, css(borde));
  // Y uno en la esquina de abajo a la derecha, junto al pie.
  corazonPixel(ctx, w - 10 * s, h - 9 * s, s, css(corazon), css(brillo));
}

/** Corta un texto para que quepa en `max` px (con "…"). */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** La polaroid: la foto con su marco de papel y el pie (fecha, nivel, quiénes salen y el texto). */
export function composePolaroid(shot: HTMLCanvasElement, info: PolaroidInfo, scale = 2): HTMLCanvasElement {
  const { side, top, bottom } = PHOTO.frame;
  const s = scale;
  const out = document.createElement("canvas");
  out.width = POLAROID.w * s;
  out.height = POLAROID.h * s;
  const ctx = out.getContext("2d")!;
  // Papel crema con un borde apenas más oscuro (se ve bien sobre el corcho y sobre el panel).
  const enamorados = info.marco === "enamorados";
  ctx.fillStyle = enamorados ? "#fde4ec" : "#f7efdc";
  ctx.fillRect(0, 0, out.width, out.height);
  if (enamorados) marcoEnamorados(ctx, out.width, out.height, s, top, side, bottom);
  ctx.fillStyle = enamorados ? "#e87a9a" : "#e3d5b5";
  ctx.fillRect(0, 0, out.width, s);
  ctx.fillRect(0, out.height - s, out.width, s);
  ctx.fillRect(0, 0, s, out.height);
  ctx.fillRect(out.width - s, 0, s, out.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(shot, side * s, top * s, PHOTO.shot.w * s, PHOTO.shot.h * s);
  // Sombra fina bajo la foto, como si estuviera pegada.
  ctx.fillStyle = "rgba(74, 42, 28, 0.25)";
  ctx.fillRect(side * s, (top + PHOTO.shot.h) * s, PHOTO.shot.w * s, s);

  const font = cozyFontFamily();
  const x = side * s + s;
  const max = PHOTO.shot.w * s - s * 2;
  const baseY = (top + PHOTO.shot.h) * s;
  const names = info.people.length ? `Con ${peopleText(info.people, 5)}` : "";
  const lines: { text: string; size: number; color: string; weight: number }[] = [];
  if (info.caption) lines.push({ text: info.caption, size: 10, color: COZY.ink, weight: 600 });
  if (names) lines.push({ text: names, size: info.caption ? 7 : 9, color: info.caption ? COZY.inkSoft : COZY.ink, weight: info.caption ? 400 : 600 });
  lines.push({ text: `${photoDateText(info.takenAt)} · ${info.areaName}`, size: 7, color: COZY.inkSoft, weight: 400 });
  // Repartidas en la franja de abajo.
  const step = bottom / (lines.length + 0.6);
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => {
    ctx.font = `${l.weight} ${l.size * s}px ${font}`;
    ctx.fillStyle = l.color;
    ctx.fillText(fit(ctx, l.text, max), x, baseY + step * (i + 0.9) * s);
  });
  return out;
}

const toBlob = (c: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => c.toBlob((b) => resolve(b), type, quality));

/**
 * La polaroid lista para subir, bajo `PHOTO.maxBytes`: primero a escala 2 en PNG (sin pérdida, lo mejor
 * para pixel art); si pesa de más, WebP y luego escala 1. null si nada entra (no debería pasar).
 */
export async function encodePolaroid(make: (scale: number) => HTMLCanvasElement): Promise<Blob | null> {
  const attempts: [scale: number, type: string, quality?: number][] = [
    [2, "image/png"],
    [2, "image/webp", 0.95],
    [1, "image/png"],
    [2, "image/webp", 0.8],
    [1, "image/webp", 0.85],
    [1, "image/webp", 0.6],
  ];
  const canvases = new Map<number, HTMLCanvasElement>();
  for (const [scale, type, quality] of attempts) {
    let canvas = canvases.get(scale);
    if (!canvas) canvases.set(scale, (canvas = make(scale)));
    const blob = await toBlob(canvas, type, quality);
    // Un navegador que no sabe WebP devuelve PNG: ese intento no sirve (ya se probó).
    if (blob && blob.type === type && blob.size <= PHOTO.maxBytes) return blob;
  }
  return null;
}

/**
 * La miniatura para el corcho: la foto (sin el marco) achicada a `w` x `h` con suavizado (así se ve lo
 * que hay, no un píxel suelto). `mirror` la voltea (el tablón mirando hacia "down" se dibuja espejado).
 */
export function thumbnailOf(img: CanvasImageSource & { width: number }, w: number, h: number, mirror: boolean): ImageData {
  const s = img.width / POLAROID.w;
  // Se achica a la mitad de a poco: de un salto, el suavizado del navegador solo mira unos pocos píxeles.
  let src: CanvasImageSource = img;
  let sx = PHOTO.frame.side * s;
  let sy = PHOTO.frame.top * s;
  let sw = PHOTO.shot.w * s;
  let sh = PHOTO.shot.h * s;
  while (sw > w * 2) {
    const half = document.createElement("canvas");
    half.width = Math.max(w, Math.round(sw / 2));
    half.height = Math.max(h, Math.round(sh / 2));
    const hctx = half.getContext("2d")!;
    hctx.imageSmoothingEnabled = true;
    hctx.imageSmoothingQuality = "high";
    hctx.drawImage(src, sx, sy, sw, sh, 0, 0, half.width, half.height);
    src = half;
    [sx, sy, sw, sh] = [0, 0, half.width, half.height];
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}
