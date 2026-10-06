// Hojas de contacto del arte (docs/estandar-arte.md): dibuja a PNG, por grupos, cada mueble del catálogo
// (de frente, de espaldas si tiene y de noche si tiene) sobre el rombo de su lugar y con un chibi al lado
// para la escala, y todos los objetos de mano. Además deja `metricas.json` con números que ayudan a
// auditar (cuántas veces se usa cada pieza en el mundo, cuántos colores tiene, cuánto es plano).
//
// Uso: pnpm --filter @hyvento/map hoja <carpeta> [filtro] [escala]
//   El filtro deja solo los grupos o los tipos que contienen algo de la lista (`exterior`, `oak,pine`;
//   `objetos` son los de mano; "" para todo). La escala, 2 por defecto, sirve para mirar de cerca unas
//   pocas piezas.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { drawCharacter, FEET_Y, FRAME, HUMANS } from "../src/art/chibi";
import { COMETA_FRAMES, cometaCielo, mangaViento } from "../src/art/cometas";
import { drawFurniture } from "../src/art/furniture";
import { CAFE_ITEM_ART, drawHeldItem } from "../src/art/items";
import { alpha, floorDiamond, hex, L, PixelCanvas, toScreen, type RGBA, type Sprite } from "../src/art/pixel";
import { FESTIVAL_DECOR } from "../src/festival-decor";
import { buildCasaPropia, CASA_PLANTILLAS, festivalDecorAreas, getWorld, setFestivalDecor } from "../src/index";
import { CATALOG, catalogItem, type CatalogItem } from "../src/world/catalog";
import { AGUA_CATALOG } from "../src/world/catalog-agua";
import { ANO_VIEJO_CATALOG } from "../src/world/catalog-ano-viejo";
import { BRUJAS_CATALOG } from "../src/world/catalog-brujas";
import { BUS_CATALOG } from "../src/world/catalog-bus";
import { CARNAVAL_CATALOG } from "../src/world/catalog-carnaval";
import { COSECHA_CATALOG } from "../src/world/catalog-cosecha";
import { CASA_ARBOL_CATALOG } from "../src/world/catalog-casa-arbol";
import { CASA_PROPIA_CATALOG } from "../src/world/catalog-casa-propia";
import { CASA_CATALOG } from "../src/world/catalog-casa";
import { COMETAS_CATALOG } from "../src/world/catalog-cometas";
import { ESCENARIO_CATALOG } from "../src/world/catalog-escenario";
import { EXTERIOR_CATALOG } from "../src/world/catalog-exterior";
import { FERIA_CATALOG } from "../src/world/catalog-feria-flores";
import { GARAJE_CATALOG } from "../src/world/catalog-garaje";
import { GRANJA_CATALOG } from "../src/world/catalog-granja";
import { INTERIOR_CATALOG } from "../src/world/catalog-interior";
import { NOVENAS_CATALOG } from "../src/world/catalog-novenas";
import { OBSERVATORIO_CATALOG } from "../src/world/catalog-observatorio";
import { PESCA_CATALOG } from "../src/world/catalog-pesca";
import { PLANTAS_CATALOG } from "../src/world/catalog-plantas";
import { PODCAST_CATALOG } from "../src/world/catalog-podcast";
import { SOTANO_CATALOG } from "../src/world/catalog-sotano";
import { TINA_CATALOG } from "../src/world/catalog-tina";
import { VELITAS_CATALOG } from "../src/world/catalog-velitas";
import { writePng } from "./png";

const [outArg = "hojas-arte", filtro = "", escalaArg = "2"] = process.argv.slice(2);
/** Píxeles de pantalla por píxel de arte (las hojas miden ~1440 de ancho a cualquier escala). */
const ESCALA = Math.max(1, Number(escalaArg) || 2);
/** Grupos o partes del tipo separados por comas (`exterior`, `oak,pine`, `objetos`). */
const filtros = filtro.split(",").filter(Boolean);
const OUT = resolve(outArg);
mkdirSync(OUT, { recursive: true });

// ---------- Grupos ----------

const SUBCATALOGS: Record<string, object> = {
  exterior: EXTERIOR_CATALOG,
  interior: INTERIOR_CATALOG,
  sotano: SOTANO_CATALOG,
  casa: CASA_CATALOG,
  plantas: PLANTAS_CATALOG,
  garaje: GARAJE_CATALOG,
  "casa-arbol": CASA_ARBOL_CATALOG,
  bus: BUS_CATALOG,
  agua: AGUA_CATALOG,
  tina: TINA_CATALOG,
  escenario: ESCENARIO_CATALOG,
  podcast: PODCAST_CATALOG,
  granja: GRANJA_CATALOG,
  observatorio: OBSERVATORIO_CATALOG,
  pesca: PESCA_CATALOG,
  "casa-propia": CASA_PROPIA_CATALOG,
  brujas: BRUJAS_CATALOG,
  carnaval: CARNAVAL_CATALOG,
  cosecha: COSECHA_CATALOG,
  velitas: VELITAS_CATALOG,
  cometas: COMETAS_CATALOG,
  feria: FERIA_CATALOG,
  novenas: NOVENAS_CATALOG,
  "ano-viejo": ANO_VIEJO_CATALOG,
};
const groupOf = new Map<string, string>();
for (const [g, cat] of Object.entries(SUBCATALOGS)) for (const t of Object.keys(cat)) groupOf.set(t, g);
for (const t of Object.keys(CATALOG)) if (!groupOf.has(t)) groupOf.set(t, "base");

// Cuántas veces sale cada tipo en el mundo (todos los niveles y la plantilla de la casa): lo que más se ve.
const usage = new Map<string, number>();
const maps = [...getWorld().areas.values(), ...Object.values(CASA_PLANTILLAS).map((p) => buildCasaPropia(p === "afuera" ? "casa:plantilla" : `casa:plantilla:${p}`)!)];
for (const m of maps) for (const f of m.furniture) usage.set(f.type, (usage.get(f.type) ?? 0) + 1);
// Lo de los festivales cuenta lo que pone su decoración (se prende uno a la vez y se apaga al final).
for (const id of Object.keys(FESTIVAL_DECOR)) {
  setFestivalDecor(id, 0);
  for (const a of festivalDecorAreas(id)) {
    const base = maps.find((m) => m.id === a);
    const now = getWorld().areas.get(a)!;
    const before = new Map<string, number>();
    for (const f of base?.furniture ?? []) before.set(f.type, (before.get(f.type) ?? 0) + 1);
    for (const f of now.furniture) before.set(f.type, (before.get(f.type) ?? 0) - 1);
    for (const [t, n] of before) if (n < 0) usage.set(t, (usage.get(t) ?? 0) - n);
  }
}
setFestivalDecor(null);

// ---------- Letras 3x5 para los rótulos ----------

const FONT: Record<string, string> = {
  A: ".#. #.# ### #.# #.#", B: "##. #.# ##. #.# ##.", C: ".## #.. #.. #.. .##", D: "##. #.# #.# #.# ##.",
  E: "### #.. ##. #.. ###", F: "### #.. ##. #.. #..", G: ".## #.. #.# #.# .##", H: "#.# #.# ### #.# #.#",
  I: "### .#. .#. .#. ###", J: "..# ..# ..# #.# .#.", K: "#.# #.# ##. #.# #.#", L: "#.. #.. #.. #.. ###",
  M: "#.# ### ### #.# #.#", N: "##. #.# #.# #.# #.#", O: ".#. #.# #.# #.# .#.", P: "##. #.# ##. #.. #..",
  Q: ".#. #.# #.# ##. .##", R: "##. #.# ##. #.# #.#", S: ".## #.. .#. ..# ##.", T: "### .#. .#. .#. .#.",
  U: "#.# #.# #.# #.# ###", V: "#.# #.# #.# #.# .#.", W: "#.# #.# ### ### #.#", X: "#.# #.# .#. #.# #.#",
  Y: "#.# #.# .#. .#. .#.", Z: "### ..# .#. #.. ###", "0": "### #.# #.# #.# ###", "1": ".#. ##. .#. .#. ###",
  "2": "##. ..# .#. #.. ###", "3": "##. ..# .#. ..# ##.", "4": "#.# #.# ### ..# ..#", "5": "### #.. ##. ..# ##.",
  "6": ".## #.. ### #.# ###", "7": "### ..# .#. .#. .#.", "8": "### #.# ### #.# ###", "9": "### #.# ### ..# ##.",
  "-": "... ... ### ... ...", ":": "... .#. ... .#. ...", ".": "... ... ... ... .#.", " ": "... ... ... ... ...",
  x: "... #.# .#. #.# ...",
};

function text(c: PixelCanvas, x: number, y: number, s: string, col: RGBA) {
  let cx = x;
  for (const raw of s) {
    const ch = raw === "x" ? "x" : raw.toUpperCase();
    const g = (FONT[ch] ?? FONT[" "]!).split(" ");
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) if (g[gy]![gx] === "#") c.set(cx + gx, y + gy, col);
    cx += 4;
  }
}
const textW = (s: string) => s.length * 4 - 1;

// ---------- Piezas ----------

const chibi = (() => {
  const sheet = drawCharacter(HUMANS.ada);
  const f = new PixelCanvas(FRAME, FRAME);
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      const i = (y * sheet.width + x) * 4;
      if (sheet.data[i + 3]) f.set(x, y, [sheet.data[i]!, sheet.data[i + 1]!, sheet.data[i + 2]!, sheet.data[i + 3]!]);
    }
  return f;
})();

function blit(dst: PixelCanvas, src: PixelCanvas, ax: number, ay: number) {
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      if (src.data[i + 3]) dst.set(ax + x, ay + y, [src.data[i]!, src.data[i + 1]!, src.data[i + 2]!, src.data[i + 3]!]);
    }
}

interface Metrics {
  type: string;
  group: string;
  name: string;
  uses: number;
  size: [number, number];
  sprite: [number, number];
  colors: number;
  /** Parte de lo opaco que es de un solo color con sus 8 vecinos iguales (áreas planas). */
  flat: number;
  /** Lo opaco sobre el área del rombo de su lugar (mide si llena su lugar; lo alto pasa de 1). */
  fill: number;
}

function measure(s: Sprite): { colors: number; flat: number; opaque: number } {
  const c = s.canvas;
  const colors = new Set<number>();
  let opaque = 0;
  let flat = 0;
  const px = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= c.width || y >= c.height) return -1;
    const i = (y * c.width + x) * 4;
    return c.data[i + 3]! < 200 ? -1 : (c.data[i]! << 16) | (c.data[i + 1]! << 8) | c.data[i + 2]!;
  };
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const v = px(x, y);
      if (v < 0) continue;
      opaque++;
      colors.add(v);
      let same = true;
      for (let dy = -1; dy <= 1 && same; dy++) for (let dx = -1; dx <= 1; dx++) if (px(x + dx, y + dy) !== v) same = false;
      if (same) flat++;
    }
  return { colors: colors.size, flat: opaque ? flat / opaque : 0, opaque };
}

/** Una celda: las variantes del mueble sobre el rombo de su lugar, el chibi al lado y el rótulo abajo. */
function furnitureCell(type: string): { canvas: PixelCanvas; metrics: Metrics } {
  const item: CatalogItem = catalogItem(type);
  const [w, d] = item.size;
  const variants: { s: Sprite; night: boolean }[] = [{ s: drawFurniture(type, "front", false), night: false }];
  if (item.hasBack) variants.push({ s: drawFurniture(type, "back", false), night: false });
  if (item.hasNight) variants.push({ s: drawFurniture(type, "front", true), night: true });

  // Cada variante en su cuadro, con el origen del mueble en (ox, oy).
  const boxes = variants.map(({ s, night }) => {
    const foot = { l: -d * L, r: w * L, t: 0, b: ((w + d) * L) / 2 };
    const l = Math.min(-s.ox, foot.l) - 2;
    const r = Math.max(s.canvas.width - s.ox, foot.r) + 2;
    const t = Math.min(-s.oy, foot.t) - 2;
    const b = Math.max(s.canvas.height - s.oy, foot.b) + 2;
    return { s, night, l, r, t, b };
  });
  const chibiW = 24;
  const top = Math.min(...boxes.map((b) => b.t), -FEET_Y);
  const bottom = Math.max(...boxes.map((b) => b.b));
  const uses = usage.get(type) ?? 0;
  const label = `${type} x${uses}`;
  const bodyW = boxes.reduce((a, b) => a + (b.r - b.l), 0) + chibiW;
  const W = Math.max(bodyW, textW(label)) + 4;
  const H = bottom - top + 9;
  const canvas = new PixelCanvas(W, H);
  let x0 = 2;
  for (const b of boxes) {
    const ox = x0 - b.l;
    const oy = -top;
    if (b.night) canvas.rect(x0, 0, b.r - b.l, bottom - top, hex("#141428"));
    // El lugar que ocupa en el piso (para ver si lo llena).
    floorDiamond(canvas, (x, y, z = 0) => {
      const p = toScreen(x, y, z);
      return { x: p.x + ox, y: p.y + oy };
    }, 0, 0, w * L, d * L, alpha(hex("#8a7a6a"), 0.35));
    blit(canvas, b.s.canvas, ox - b.s.ox, oy - b.s.oy);
    x0 += b.r - b.l;
  }
  // El chibi parado a la profundidad del centro del lugar.
  blit(canvas, chibi, x0 + chibiW / 2 - FRAME / 2, -top + ((w + d) * L) / 4 - FEET_Y);
  text(canvas, 2, H - 6, label, hex("#f7ebc8"));

  const m = measure(variants[0]!.s);
  return {
    canvas,
    metrics: {
      type,
      group: groupOf.get(type)!,
      name: item.name,
      uses,
      size: [w, d],
      sprite: [variants[0]!.s.canvas.width, variants[0]!.s.canvas.height],
      colors: m.colors,
      flat: Math.round(m.flat * 100) / 100,
      fill: Math.round((m.opaque / (w * d * L * L)) * 100) / 100,
    },
  };
}

/** Acomoda celdas en hojas de `pageW` x `pageH` (en píxeles de arte) y las escribe. */
function pages(name: string, cells: PixelCanvas[], pageW: number, pageH: number, scale: number, gap = 6): string[] {
  const files: string[] = [];
  let rows: { cells: PixelCanvas[]; h: number }[] = [];
  let row: PixelCanvas[] = [];
  let rowW = 0;
  let total = 0;
  const flushPage = () => {
    if (!rows.length) return;
    const W = Math.max(...rows.map((r) => r.cells.reduce((a, c) => a + c.width + gap, gap)));
    const H = rows.reduce((a, r) => a + r.h + gap, gap);
    const page = new PixelCanvas(W, H);
    let y = gap;
    for (const r of rows) {
      let x = gap;
      for (const c of r.cells) {
        page.rect(x - 1, y - 1, c.width + 2, r.h + 2, hex("#3a2e44"));
        blit(page, c, x, y + r.h - c.height);
        x += c.width + gap;
      }
      y += r.h + gap;
    }
    const file = join(OUT, `${name}-${files.length + 1}.png`);
    writePng(page, file, scale, "#2a2033");
    files.push(file);
    rows = [];
    total = 0;
  };
  const flushRow = () => {
    if (!row.length) return;
    const h = Math.max(...row.map((c) => c.height));
    if (total + h > pageH && rows.length) flushPage();
    rows.push({ cells: row, h });
    total += h + gap;
    row = [];
    rowW = 0;
  };
  for (const c of cells) {
    if (rowW + c.width + gap > pageW && row.length) flushRow();
    row.push(c);
    rowW += c.width + gap;
  }
  flushRow();
  flushPage();
  return files;
}

// ---------- Muebles ----------

const all: Metrics[] = [];
const byGroup = new Map<string, string[]>();
for (const t of Object.keys(CATALOG)) {
  const g = groupOf.get(t)!;
  if (filtros.length && !filtros.some((f) => g === f || t.includes(f))) continue;
  byGroup.set(g, [...(byGroup.get(g) ?? []), t]);
}
const written: string[] = [];
for (const [g, types] of byGroup) {
  types.sort((a, b) => (usage.get(b) ?? 0) - (usage.get(a) ?? 0) || a.localeCompare(b));
  const cells = types.map((t) => {
    const { canvas, metrics } = furnitureCell(t);
    all.push(metrics);
    return canvas;
  });
  written.push(...pages(`muebles-${g}`, cells, 1440 / ESCALA, 1040 / ESCALA, ESCALA));
}

// ---------- Objetos de mano ----------

if (!filtros.length || filtros.includes("objetos")) {
  const ids = [...CAFE_ITEM_ART].sort();
  // El objeto aumentado tres veces (son de 10x10 como mucho) y, a su lado, a tamaño real junto a la mano.
  const ZOOM = 3;
  const cells = ids.map((id) => {
    const art = drawHeldItem(id);
    const big = new PixelCanvas(art.width * ZOOM, art.height * ZOOM);
    for (let y = 0; y < big.height; y++)
      for (let x = 0; x < big.width; x++) {
        const i = (Math.floor(y / ZOOM) * art.width + Math.floor(x / ZOOM)) * 4;
        if (art.data[i + 3]) big.set(x, y, [art.data[i]!, art.data[i + 1]!, art.data[i + 2]!, art.data[i + 3]!]);
      }
    const c = new PixelCanvas(Math.max(big.width + art.width + 6, textW(id)) + 2, 10 * ZOOM + 9);
    blit(c, big, 1, 10 * ZOOM - big.height + 1);
    blit(c, art, big.width + 5, 10 * ZOOM - art.height + 1);
    text(c, 1, 10 * ZOOM + 3, id, hex("#f7ebc8"));
    return c;
  });
  // Un chibi al principio de cada hoja para la escala.
  const withChibi = [chibi, ...cells];
  written.push(...pages("objetos", withChibi, 1440 / ESCALA, 1000 / ESCALA, ESCALA, 3));
}

// ---------- Las cometas en el cielo (Festival de cometas) ----------

if (filtros.includes("cometas")) {
  // Cada forma con varios colores y los tres largos de cola, y los cuadros de la cola que se mece; al final
  // las variantes de la manga de viento. Con un chibi al principio para la escala.
  const cells: PixelCanvas[] = [chibi];
  const pinta = (c: PixelCanvas, label: string) => {
    const out = new PixelCanvas(Math.max(c.width, textW(label)) + 2, c.height + 8);
    blit(out, c, 1, 0);
    text(out, 1, c.height + 2, label, hex("#f7ebc8"));
    return out;
  };
  for (const forma of ["r", "h", "p", "z"])
    for (const [c1, c2, cola] of [["r", "a", 1], ["z", "b", 2], ["v", "n", 3], ["m", "s", 2]] as const) {
      const code = `${forma}${c1}${c2}${cola}`;
      cells.push(pinta(cometaCielo(code, 0).canvas, code));
    }
  for (let f = 0; f < COMETA_FRAMES; f++) cells.push(pinta(cometaCielo("pzn3", f).canvas, `pzn3 ${f}`));
  for (const dir of [0, 1]) for (const nivel of [0, 1, 2]) for (const f of [0, 1]) cells.push(pinta(mangaViento(dir, nivel, f).canvas, `manga ${dir}${nivel}${f}`));
  written.push(...pages("cometas-cielo", cells, 1440 / ESCALA, 1000 / ESCALA, ESCALA, 4));
}

writeFileSync(join(OUT, "metricas.json"), JSON.stringify(all, null, 1));
console.log(`${written.length} hojas en ${OUT}`);
