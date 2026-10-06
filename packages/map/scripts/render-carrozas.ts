// Dibuja las carrozas del Carnaval armadas con sus partes en varias poses (siempre de día), en una hoja
// PNG (para revisar el arte y el movimiento sin abrir el juego). Al lado de cada una va un chibi, para ver
// la escala desde la vereda.
// Uso: pnpm --filter @hyvento/map carrozas [salida.png] [ids separados por coma] [escala]
// (con SOLO=1, una sola pose por carroza; con COLS=n, en una grilla de n columnas).
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { CARROZA_IDS, type CarrozaId } from "@hyvento/shared";
import { drawCharacter, FEET_Y, FRAME, styleFor } from "../src/art/chibi";
import { carrozaArte, posesCarroza } from "../src/art/carrozas";
import { ANCHO } from "../src/art/carrozas/plataforma";
import { hex, PixelCanvas, toScreen } from "../src/art/pixel";

const [out = "carrozas.png", ids = "", escala = "2"] = process.argv.slice(2);
const lista = (ids ? ids.split(",") : [...CARROZA_IDS]) as CarrozaId[];
const MOMENTOS = process.env.SOLO ? [0] : [0, 900, 2100];
const CELDA = { w: 280, h: 280 };
const ORIGEN = { x: 100, y: 190 };

const COLS = process.env.COLS ? Number(process.env.COLS) : MOMENTOS.length;
const TOTAL = lista.length * MOMENTOS.length;
const hoja = new PixelCanvas(CELDA.w * COLS, CELDA.h * Math.ceil(TOTAL / COLS));

/** Pega `src` girado y escalado alrededor de su pivote (px, py) en (x, y). */
function pegar(dst: PixelCanvas, src: PixelCanvas, px: number, py: number, x: number, y: number, rot: number, sx: number, sy: number, a: number) {
  const co = Math.cos(rot);
  const si = Math.sin(rot);
  const r = Math.hypot(src.width, src.height) * Math.max(sx, sy) + 2;
  for (let dy = Math.floor(y - r); dy <= Math.ceil(y + r); dy++)
    for (let dx = Math.floor(x - r); dx <= Math.ceil(x + r); dx++) {
      const ox = dx + 0.5 - x;
      const oy = dy + 0.5 - y;
      const u = Math.floor((ox * co + oy * si) / sx + px);
      const v = Math.floor((-ox * si + oy * co) / sy + py);
      if (u < 0 || v < 0 || u >= src.width || v >= src.height) continue;
      const i = (v * src.width + u) * 4;
      if (!src.data[i + 3]) continue;
      dst.set(dx, dy, [src.data[i]!, src.data[i + 1]!, src.data[i + 2]!, Math.round(src.data[i + 3]! * a)]);
    }
}

const chibi = (() => {
  const sheet = drawCharacter(styleFor("ada", null));
  const c = new PixelCanvas(FRAME, FRAME);
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      const i = (y * sheet.width + x) * 4;
      if (sheet.data[i + 3]) c.set(x, y, [sheet.data[i]!, sheet.data[i + 1]!, sheet.data[i + 2]!, sheet.data[i + 3]!]);
    }
  return c;
})();

lista.forEach((id, fila) => {
  for (let col = 0; col < MOMENTOS.length; col++) {
    const k = fila * MOMENTOS.length + col;
    const gx = k % COLS;
    const gy = Math.floor(k / COLS);
    const ox = gx * CELDA.w + ORIGEN.x;
    const oy = gy * CELDA.h + ORIGEN.y;
    // El fondo: la vereda arriba, la calle abajo.
    const calle = hex("#5d5a66");
    const vereda = hex("#b8ab96");
    for (let y = gy * CELDA.h; y < (gy + 1) * CELDA.h; y++)
      for (let x = gx * CELDA.w; x < (gx + 1) * CELDA.w; x++) hoja.set(x, y, y - oy < 6 + (x - ox) * 0.0 ? vereda : calle);
    const arte = carrozaArte(id);
    const poses = posesCarroza(arte, MOMENTOS[col]!);
    arte.partes.forEach((p, i) => {
      const q = poses[i]!;
      if (!q.visible) return;
      pegar(hoja, p.canvas, p.px, p.py, ox + q.x, oy + q.y, q.rot, q.sx, q.sy, q.alpha);
    });
    // Un chibi en la calle, junto a la carroza (para la escala).
    const ch = toScreen(arte.largo + 6, ANCHO + 14, -12);
    pegar(hoja, chibi, FRAME / 2, FEET_Y, ox + ch.x, oy + ch.y, 0, 1, 1, 1);
  }
});

const scale = Number(escala);
const W = hoja.width * scale;
const H = hoja.height * scale;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = (Math.floor(y / scale) * hoja.width + Math.floor(x / scale)) * 4;
    const o = y * (W * 4 + 1) + 1 + x * 4;
    raw[o] = hoja.data[i]!;
    raw[o + 1] = hoja.data[i + 1]!;
    raw[o + 2] = hoja.data[i + 2]!;
    raw[o + 3] = 255;
  }
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
writeFileSync(out, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log(`carrozas → ${out} (${W}x${H})`);
