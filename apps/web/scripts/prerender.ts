// Pre-dibuja en el build el arte que no cambia, para que el navegador no lo pinte píxel a píxel en el
// hilo principal (el jardín tardaba varios segundos con la pestaña congelada, y otro tanto al anochecer):
//   - el fondo de cada nivel (piso, losa y paredes altas), de día y de noche;
//   - un atlas con todos los muebles del catálogo (cada versión: de frente, de espaldas, de noche);
//   - la baldosa del bosque de alrededor;
//   - la portada: la escena viva, los dioramas, los objetos y las hojas de sus personajes.
// Todo queda en public/prerender/ (ignorado en git) con un manifiesto por consumidor. Lo que falte o no
// coincida (p. ej. una oficina con otro piso) se dibuja en el navegador como antes.
//
// Corre antes de `next build` y de `next dev` (prebuild/predev). Si las fuentes del arte no cambiaron
// desde la última vez no hace nada; `--force` lo rehace. Con el servidor de desarrollo prendido, un
// cambio en el arte se ve recién al volver a correr `pnpm --filter @hyvento/web prerender`.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { getWorld } from "@hyvento/map";
import { drawAreaBase, drawCharacter, drawFurniture, drawSurroundings, FEET_Y, FRAME, PixelCanvas, styleFor } from "@hyvento/map/art";
import { HUMAN_AVATARS, randomLook, seededRandom } from "@hyvento/shared";
import { OBJETOS, SEMILLAS_PORTADA } from "../src/components/lumbre/escena";
import { DIBUJO_DE_OBJETO, SALAS, dibujarEscena, dibujarSala, lucesDeEscena, recorte } from "../src/components/lumbre/escena-arte";
import { allFurnitureVariants, areaDecorSignature, furnitureKey, type AtlasFrame, type GameManifest } from "../src/game/iso/prerender-keys";
import { GAME_MANIFEST, LANDING_MANIFEST, type LandingImage, type LandingManifest } from "../src/game/iso/prerender-paths";
import { characterKey } from "../src/game/lookKey";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(WEB, "../..");
const OUT = path.join(WEB, "public/prerender");
/** Lo que cambia el dibujo: si nada de esto cambió, las imágenes que hay siguen sirviendo. */
const SOURCES = [
  "packages/map/src",
  "packages/shared/src",
  "apps/web/src/components/lumbre",
  "apps/web/src/game/iso/prerender-keys.ts",
  "apps/web/src/game/iso/prerender-paths.ts",
  "apps/web/src/game/lookKey.ts",
  "apps/web/scripts/prerender.ts",
];
/** Ancho de cada atlas de muebles y alto máximo (debajo del límite de canvas de cualquier navegador). */
const ATLAS_W = 2048;
const ATLAS_MAX_H = 2048;

function sourceHash(): string {
  const h = createHash("sha256");
  const walk = (p: string) => {
    if (statSync(p).isDirectory()) for (const f of readdirSync(p).sort()) walk(path.join(p, f));
    else if (!/\.test\.ts$/.test(p)) h.update(path.relative(ROOT, p).replaceAll("\\", "/")).update(readFileSync(p));
  };
  for (const s of SOURCES) walk(path.join(ROOT, s));
  return h.digest("hex").slice(0, 12);
}

// ---------- PNG ----------

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
}

/** PNG RGBA con el filtro de cada fila elegido a ojo (el que deja valores más chicos): pesa bastante menos. */
function png(px: PixelCanvas): Buffer {
  const { width: W, height: H, data } = px;
  const stride = W * 4;
  const raw = Buffer.alloc((stride + 1) * H);
  const row = Buffer.alloc(stride);
  const best = Buffer.alloc(stride);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < H; y++) {
    const cur = y * stride;
    const prev = cur - stride;
    let bestSum = Infinity;
    let bestType = 0;
    for (let type = 0; type < 5; type++) {
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const x = data[cur + i]!;
        const a = i >= 4 ? data[cur + i - 4]! : 0;
        const b = y > 0 ? data[prev + i]! : 0;
        const c = i >= 4 && y > 0 ? data[prev + i - 4]! : 0;
        const v = (type === 0 ? x : type === 1 ? x - a : type === 2 ? x - b : type === 3 ? x - ((a + b) >> 1) : x - paeth(a, b, c)) & 0xff;
        row[i] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) {
        bestSum = sum;
        bestType = type;
        row.copy(best);
      }
    }
    raw[y * (stride + 1)] = bestType;
    best.copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Salida ----------

let bytes = 0;
/** Imágenes ya escritas por contenido: una igual (el jardín de día y de noche) se baja una sola vez. */
const written = new Map<string, string>();
function write(dir: string, file: string, px: PixelCanvas) {
  const buf = png(px);
  const sum = createHash("sha1").update(buf).digest("hex");
  const same = written.get(sum);
  if (same) return same;
  written.set(sum, file);
  bytes += buf.length;
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  writeFileSync(path.join(dir, file), buf);
  return file;
}

function crop(px: PixelCanvas, r: { x0: number; y0: number; w: number; h: number }) {
  const out = new PixelCanvas(r.w, r.h);
  for (let y = 0; y < r.h; y++) out.data.set(px.data.subarray(((r.y0 + y) * px.width + r.x0) * 4, ((r.y0 + y) * px.width + r.x0 + r.w) * 4), y * r.w * 4);
  return out;
}

/** Una imagen de la portada recortada a lo dibujado (con la esquina, para ubicar cosas encima). */
function landingImage(dir: string, file: string, px: PixelCanvas, margen = 2): LandingImage {
  const r = recorte(px, margen);
  return { src: write(dir, file, crop(px, r)), ...r };
}

function blit(dst: PixelCanvas, src: PixelCanvas, dx: number, dy: number) {
  for (let y = 0; y < src.height; y++) dst.data.set(src.data.subarray(y * src.width * 4, (y + 1) * src.width * 4), ((dy + y) * dst.width + dx) * 4);
}

/** Atlas de muebles: estantes de izquierda a derecha, los más altos primero. */
function furnitureAtlases(dir: string): Pick<GameManifest, "atlases" | "frames"> {
  const sprites: { key: string; s: ReturnType<typeof drawFurniture> }[] = [];
  const seen = new Set<string>();
  for (const { type, variant, night } of allFurnitureVariants()) {
    const key = furnitureKey(type, variant, night);
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      sprites.push({ key, s: drawFurniture(type, variant, night) });
    } catch (e) {
      // Sin dibujo en el build, el juego lo intenta en el navegador (y ahí se ve el error).
      console.warn(`[prerender] ${key}: ${(e as Error).message}`);
    }
  }
  sprites.sort((a, b) => b.s.canvas.height - a.s.canvas.height || b.s.canvas.width - a.s.canvas.width);
  const pages: { key: string; s: (typeof sprites)[number]["s"]; x: number; y: number }[][] = [[]];
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const sp of sprites) {
    const w = sp.s.canvas.width + 1;
    const h = sp.s.canvas.height + 1;
    if (w > ATLAS_W || h > ATLAS_MAX_H) throw new Error(`El mueble ${sp.key} no cabe en el atlas (${w}x${h})`);
    if (x + w > ATLAS_W) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    if (y + h > ATLAS_MAX_H) {
      pages.push([]);
      x = 0;
      y = 0;
      shelf = 0;
    }
    pages.at(-1)!.push({ ...sp, x, y });
    x += w;
    shelf = Math.max(shelf, h);
  }
  const frames: GameManifest["frames"] = {};
  const atlases = pages.map((page, i) => {
    const height = Math.max(1, ...page.map((p) => p.y + p.s.canvas.height));
    const canvas = new PixelCanvas(ATLAS_W, height);
    for (const p of page) {
      blit(canvas, p.s.canvas, p.x, p.y);
      frames[p.key] = [i, p.x, p.y, p.s.canvas.width, p.s.canvas.height, p.s.ox, p.s.oy] satisfies AtlasFrame;
    }
    return write(dir, `muebles-${i}.png`, canvas);
  });
  return { atlases, frames };
}

function gameManifest(dir: string, version: string): GameManifest {
  const areas: GameManifest["areas"] = {};
  for (const [id, map] of getWorld().areas) {
    const dia = drawAreaBase(map, true).base;
    const noche = drawAreaBase(map, false).base;
    areas[id] = {
      decor: areaDecorSignature(map),
      ox: dia.ox,
      oy: dia.oy,
      w: dia.canvas.width,
      h: dia.canvas.height,
      dia: write(dir, `areas/${id}-dia.png`, dia.canvas),
      noche: write(dir, `areas/${id}-noche.png`, noche.canvas),
    };
  }
  const surroundings: GameManifest["surroundings"] = { forest: write(dir, "alrededores-forest.png", drawSurroundings("forest")) };
  return { version, areas, surroundings, ...furnitureAtlases(dir) };
}

function landingManifest(dir: string, version: string): LandingManifest {
  const salas: LandingManifest["salas"] = {};
  for (const sala of Object.keys(SALAS))
    salas[sala] = { dia: landingImage(dir, `portada/sala-${sala}-dia.png`, dibujarSala(sala, false)), noche: landingImage(dir, `portada/sala-${sala}-noche.png`, dibujarSala(sala, true)) };
  const objetos: LandingManifest["objetos"] = {};
  OBJETOS.forEach((o, i) => (objetos[o] = landingImage(dir, `portada/objeto-${i}.png`, DIBUJO_DE_OBJETO[o](), 1)));
  // Los seis fijos y los looks al azar con las semillas que usa la portada.
  const personajes: LandingManifest["personajes"] = {};
  const hojas = [...HUMAN_AVATARS.map((a) => [a, null] as const), ...SEMILLAS_PORTADA.map((s) => ["ada", randomLook(seededRandom(s))] as const)];
  for (const [avatar, look] of hojas) {
    const key = characterKey(avatar, look);
    personajes[key] = write(dir, `portada/personaje-${key}.png`, drawCharacter(styleFor(avatar, look)));
  }
  return {
    version,
    escena: { dia: landingImage(dir, "portada/escena-dia.png", dibujarEscena(false)), noche: landingImage(dir, "portada/escena-noche.png", dibujarEscena(true)) },
    salas,
    objetos,
    personajes,
    luces: lucesDeEscena(),
    frame: FRAME,
    feetY: FEET_Y,
  };
}

/** Borra las imágenes de antes que ya nadie usa (si alguna está tomada, queda: no molesta). */
function pruneExcept(keep: Set<string>) {
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (!keep.has(path.relative(OUT, p).replaceAll("\\", "/")))
        try {
          rmSync(p);
        } catch {
          // Tomada por otro proceso: se borra la próxima vez.
        }
    }
  };
  walk(OUT);
}

function main() {
  const force = process.argv.includes("--force");
  const version = sourceHash();
  const current = path.join(OUT, GAME_MANIFEST);
  if (!force && existsSync(current) && existsSync(path.join(OUT, LANDING_MANIFEST))) {
    try {
      if ((JSON.parse(readFileSync(current, "utf8")) as GameManifest).version === version) {
        console.log(`[prerender] al día (${version}): no hay nada que dibujar.`);
        return;
      }
    } catch {
      // Manifiesto roto: se rehace.
    }
  }
  const t0 = performance.now();
  // Se escribe en el lugar (en Windows, con `next dev` prendido, la carpeta no se puede renombrar) y los
  // manifiestos al final: si el script se corta, el manifiesto viejo queda con otra versión y la próxima
  // vez se rehace todo.
  mkdirSync(OUT, { recursive: true });
  for (const m of [GAME_MANIFEST, LANDING_MANIFEST]) rmSync(path.join(OUT, m), { force: true });
  const game = gameManifest(OUT, version);
  const landing = landingManifest(OUT, version);
  pruneExcept(new Set(written.values()));
  writeFileSync(path.join(OUT, GAME_MANIFEST), JSON.stringify(game));
  writeFileSync(path.join(OUT, LANDING_MANIFEST), JSON.stringify(landing));
  const frames = Object.keys(game.frames).length;
  console.log(
    `[prerender] ${Object.keys(game.areas).length} niveles, ${frames} muebles en ${game.atlases.length} atlas y la portada → public/prerender ` +
      `(${(bytes / 1024 / 1024).toFixed(1)} MB, ${((performance.now() - t0) / 1000).toFixed(1)} s, versión ${version})`,
  );
}

main();
