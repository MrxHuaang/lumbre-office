// Dibuja un nivel completo a un PNG para revisar el arte sin abrir el juego.
// Uso: pnpm --filter @hyvento/map render <nivel> [salida.png] [noche] [cumple,karaoke]
// (el último, para ver lo que ponen los eventos: el pastel de cumpleaños o el club en modo karaoke).
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { composeArea } from "../src/art/compose";
import { eventOverlays } from "../src/art/eventos";
import { buildCasaPropia, CASA_PLANTILLA, getWorld } from "../src/index";

const [areaId = "jardin", out = `${areaId}.png`, mode = "dia", events = ""] = process.argv.slice(2);
// `casa` es la plantilla de la casa de cada persona (no está en el mundo: se arma por persona).
const map = areaId === CASA_PLANTILLA ? buildCasaPropia("casa:plantilla") : getWorld().areas.get(areaId);
if (!map) throw new Error(`No existe el nivel ${areaId} (hay: ${[...getWorld().areas.keys(), CASA_PLANTILLA].join(", ")})`);
const on = events.split(",");
const canvas = composeArea(map, mode !== "noche", 80, eventOverlays(areaId, { birthday: on.includes("cumple"), karaoke: on.includes("karaoke") }));

// Escala x2 sobre el fondo de la noche de afuera.
const scale = 2;
const W = canvas.width * scale;
const H = canvas.height * scale;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = (Math.floor(y / scale) * canvas.width + Math.floor(x / scale)) * 4;
    const a = canvas.data[i + 3]! / 255;
    const o = y * (W * 4 + 1) + 1 + x * 4;
    raw[o] = Math.round(canvas.data[i]! * a + 0x2a * (1 - a));
    raw[o + 1] = Math.round(canvas.data[i + 1]! * a + 0x20 * (1 - a));
    raw[o + 2] = Math.round(canvas.data[i + 2]! * a + 0x33 * (1 - a));
    raw[o + 3] = 255;
  }

// PNG mínimo (RGBA, sin compresión especial): firma + IHDR + IDAT + IEND.
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
writeFileSync(
  out,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
console.log(`${areaId} → ${out} (${W}x${H})`);
