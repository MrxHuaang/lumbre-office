// PNG mínimo (RGBA, sin compresión especial) para las herramientas de revisión del arte: firma + IHDR +
// IDAT + IEND. Escala entera y fondo opaco donde el lienzo es transparente.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import type { PixelCanvas } from "../src/art/pixel";

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

/** Escribe el lienzo a `out` escalado `scale` veces, sobre el color `bg` (#rrggbb) donde es transparente. */
export function writePng(canvas: PixelCanvas, out: string, scale = 2, bg = "#2a2033"): void {
  const n = parseInt(bg.slice(1), 16);
  const [br, bgc, bb] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const W = canvas.width * scale;
  const H = canvas.height * scale;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (Math.floor(y / scale) * canvas.width + Math.floor(x / scale)) * 4;
      const a = canvas.data[i + 3]! / 255;
      const o = y * (W * 4 + 1) + 1 + x * 4;
      raw[o] = Math.round(canvas.data[i]! * a + br * (1 - a));
      raw[o + 1] = Math.round(canvas.data[i + 1]! * a + bgc * (1 - a));
      raw[o + 2] = Math.round(canvas.data[i + 2]! * a + bb * (1 - a));
      raw[o + 3] = 255;
    }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    out,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
