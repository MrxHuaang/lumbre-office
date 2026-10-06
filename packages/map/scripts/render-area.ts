// Dibuja un nivel completo a un PNG para revisar el arte sin abrir el juego.
// Uso: pnpm --filter @hyvento/map render <nivel> [salida.png] [noche] [cumple,karaoke,brujas] [hh:mm]
// (el cuarto, para ver lo que ponen los eventos: el pastel de cumpleaños, el club en modo karaoke o la
// decoración de un festival, por su id, como `brujas`; con la hora del juego al final, también la gente de
// la fiesta parada donde está a esa hora).
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { DIAS_POR_ESTACION, festivalById, GENTE_FIESTA, SEASONS } from "@hyvento/shared";
import { drawCharacter, FEET_Y, FRAME, SHEET_DIRECTIONS, styleFor } from "../src/art/chibi";
import { composeArea } from "../src/art/compose";
import { eventOverlays, type EventOverlay } from "../src/art/eventos";
import { PixelCanvas } from "../src/art/pixel";
import { buildCasaPropia, CASA_PLANTILLAS, festivalDecorAreas, genteDelNivel, getWorld, setFestivalDecor } from "../src/index";

const [areaId = "jardin", out = `${areaId}.png`, mode = "dia", events = ""] = process.argv.slice(2);
const on = events.split(",");
for (const e of on) if (festivalDecorAreas(e).length) setFestivalDecor(e, 0);
// `casa-afuera`, `casa-abajo` y `casa-arriba` son la plantilla de la casa de cada persona (no están en el
// mundo: se arman por persona).
const casa = CASA_PLANTILLAS[areaId as keyof typeof CASA_PLANTILLAS];
const map = casa ? buildCasaPropia(casa === "afuera" ? "casa:plantilla" : `casa:plantilla:${casa}`) : getWorld().areas.get(areaId);
if (!map) throw new Error(`No existe el nivel ${areaId} (hay: ${[...getWorld().areas.keys(), ...Object.keys(CASA_PLANTILLAS)].join(", ")})`);
const canvas = composeArea(map, mode !== "noche", 80, [...eventOverlays(areaId, { birthday: on.includes("cumple"), karaoke: on.includes("karaoke") }), ...genteOverlays()]);

/**
 * La gente de la fiesta (VIR-167) parada donde está a esa hora del juego: el quinto argumento es la hora
 * ("12:30"), con un festival que tenga gente en el cuarto (`render jardin out.png dia brujas 12:30`).
 */
function genteOverlays(): EventOverlay[] {
  const [h = "", m = "0"] = (process.argv[6] ?? "").split(":");
  const fest = on.map((e) => festivalById(e)).find((f) => f && GENTE_FIESTA[f.id]);
  if (!fest || !h || !map) return [];
  const day = SEASONS.indexOf(fest.estacion) * DIAS_POR_ESTACION + (fest.dia - 1);
  const nivel = genteDelNivel(map, fest.id, day, "despejado");
  const minuto = Number(h) * 60 + Number(m);
  const out: EventOverlay[] = [];
  for (const npc of nivel?.npcs ?? []) {
    const p = nivel!.pose(npc.id, minuto);
    if (!p.visible || npc.animal) continue;
    const sheet = drawCharacter(styleFor("ada", npc.look));
    const row = SHEET_DIRECTIONS.indexOf(p.mira);
    const frame = new PixelCanvas(FRAME, FRAME);
    for (let y = 0; y < FRAME; y++)
      for (let x = 0; x < FRAME; x++) {
        const i = ((row * FRAME + y) * sheet.width + x) * 4;
        if (sheet.data[i + 3]) frame.set(x, y, [sheet.data[i]!, sheet.data[i + 1]!, sheet.data[i + 2]!, sheet.data[i + 3]!]);
      }
    out.push({ key: npc.id, sprite: { canvas: frame, ox: FRAME / 2, oy: FEET_Y }, tile: { x: p.x / map.tileSize - 0.5, y: p.y / map.tileSize - 0.5 } });
  }
  return out;
}

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
