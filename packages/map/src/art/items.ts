// Productos de la cafetería y del bar del club en pixel-art: se llevan en la mano, salen en la carta y
// se consumen con F. Son chiquitos (caben en la mano del chibi); la carta los muestra ampliados.
// Cada uno cambia con el uso: los vasos se vacían, la comida pierde un mordisco y el cigarro se acorta.
import { heldParts, usesOf } from "@hyvento/shared";
import { C, OUT } from "./palette";
import { PixelCanvas, alpha, at, hex, type RGBA } from "./pixel";

type Legend = Record<string, RGBA>;

const CUP: Legend = { w: hex("#f4ecdc"), W: hex("#cbbba2") };
/** Vidrio: brillo y el vidrio vacío (cuando el líquido ya bajó). */
const GLASS = { h: alpha(hex("#f4fbff"), 0.9), empty: alpha(hex("#cfe6f0"), 0.45) };

/** Vapor (bebidas calientes) o humo (cigarro, habano) que sale del producto en la mano. */
export type HeldEffect = "steam" | "smoke";

interface ItemArt {
  /** Filas de caracteres: "." = vacío, "o" = contorno; el resto, letras de `colors`. */
  rows: string[];
  colors: Legend;
  /** Echa vapor o humo desde el píxel `from` (relativo a la esquina de arriba a la izquierda). */
  fx?: HeldEffect;
  from?: [number, number];
  /** Vaso de vidrio: letras del líquido (bajan con cada sorbo) y de la espuma (se va con el primero). */
  liquid?: { chars: string; foam?: string };
  /**
   * Taza opaca: solo se ve la superficie (letras `chars` de la fila de arriba). Con cada sorbo una parte
   * se vuelve el interior de la taza (`inner`), como si el nivel bajara y asomara la loza.
   */
  surface?: { chars: string; inner: RGBA };
  /** Comida: color de la miga que queda a la vista en cada mordisco. */
  crumb?: RGBA;
  /** Brasa (cigarro, habano): letras que titilan y brillan al pitar. El papel (`body`) se quema. */
  ember?: { chars: string; body: string };
}

const ITEMS: Record<string, ItemArt> = {
  tinto: {
    fx: "steam",
    rows: [
      ".ooooo.", //
      ".occco.",
      ".owwWoo",
      ".owwWoo",
      "ooooooo",
      "oWwwwWo",
      ".ooooo.",
    ],
    colors: { ...CUP, c: hex("#3b1f14") },
    surface: { chars: "c", inner: hex("#a8977e") },
  },
  "cafe-leche": {
    fx: "steam",
    from: [2, 0],
    rows: [
      "oooooo..", //
      "offfFo..",
      "ommmMoo.",
      "ommmMo.o",
      "ommmMoo.",
      "ommmMo..",
      ".oooo...",
    ],
    colors: { f: hex("#f2d9b0"), F: hex("#c9955e"), m: hex("#d0694a"), M: hex("#9c4632") },
    surface: { chars: "fF", inner: hex("#7a3526") },
  },
  aromatica: {
    fx: "steam",
    rows: [
      "oooooo", //
      "ohaaao",
      "ohArao",
      "oaaaAo",
      "ohraao",
      ".oooo.",
    ],
    colors: { a: hex("#e8894a"), A: hex("#c9552f"), r: hex("#8cc653"), h: alpha(hex("#fff6dc"), 0.85) },
    // Es un vaso de vidrio: se ve bajar la infusión.
    liquid: { chars: "aAr" },
  },
  chocolate: {
    fx: "steam",
    from: [2, 0],
    rows: [
      "oooooo...", //
      "okkkko...",
      "owwwWoo..",
      "owwwWo.o.",
      "owwwWoooo",
      "owwwWoyyo",
      ".ooooyYyo",
      ".....oooo",
    ],
    colors: { ...CUP, k: hex("#6b3a22"), y: hex("#f6e3a0"), Y: hex("#e0c270") },
    surface: { chars: "k", inner: hex("#a8977e") },
  },
  pandebono: {
    crumb: hex("#fff0c4"),
    rows: [
      "..oooo..", //
      ".obBbbo.",
      "obBbbdbo",
      "obbdbbbo",
      "obbbbbDo",
      ".oDbbDo.",
      "..oooo..",
    ],
    colors: { b: hex("#ecc070"), B: hex("#f8e0a0"), d: hex("#c98a3a"), D: hex("#b87a30") },
  },
  bunuelo: {
    crumb: hex("#f8dc9a"),
    rows: [
      "..oooo..", //
      ".obBbbo.",
      "obBbbbbo",
      "obbbbbdo",
      "obbbbddo",
      ".odddDo.",
      "..oooo..",
    ],
    colors: { b: hex("#d99a45"), B: hex("#f0c476"), d: hex("#b0702a"), D: hex("#8c5520") },
  },
  torta: {
    crumb: hex("#fff8e4"),
    rows: [
      "...r...", //
      ".ooroo.",
      "owwwwwo",
      "oyyyyYo",
      "owwwwWo",
      "oyyyyYo",
      "ooooooo",
      "oPppppo",
      ".ooooo.",
    ],
    colors: {
      w: hex("#fff4dc"),
      W: hex("#e8d6b0"),
      y: hex("#f0d28a"),
      Y: hex("#d8b264"),
      r: hex("#d93a2b"),
      p: hex("#f4ecdc"),
      P: hex("#cbbba2"),
    },
  },
  cigarro: {
    fx: "smoke",
    ember: { chars: "e", body: "w" },
    rows: [
      "ooooooo", //
      "ofwwwwe",
      "ooooooo",
    ],
    colors: { f: hex("#d9923e"), w: hex("#f4ecdc"), e: hex("#ff7a2a") },
  },
  "coca-cola": {
    rows: [
      ".ooo.", //
      "ossso",
      "orrRo",
      "owwro",
      "orwwo",
      "orrRo",
      "ossso",
      ".ooo.",
    ],
    colors: { s: hex("#c9c9d0"), r: hex("#d42a2a"), R: hex("#9c1c1c"), w: hex("#f4ecdc") },
  },
  // ---------- El bar del club ----------
  cerveza: {
    liquid: { chars: "aAb", foam: "fF" },
    rows: [
      ".oooo...", //
      "ofFffo..",
      "ohaaAooo",
      "ohabAo.o",
      "ohaaAo.o",
      "ohbaAooo",
      "ohaaAo..",
      "oggggo..",
      ".oooo...",
    ],
    colors: {
      f: hex("#fffaf0"),
      F: hex("#e6dcc4"),
      a: hex("#f0b43c"),
      A: hex("#c98622"),
      b: hex("#ffe08a"),
      h: GLASS.h,
      g: alpha(hex("#d8eef6"), 0.85),
    },
  },
  vino: {
    liquid: { chars: "rR" },
    rows: [
      "oggggo", //
      "ohrrRo",
      "orrrRo",
      ".orRo.",
      "..og..",
      "..og..",
      ".oggo.",
      ".oooo.",
    ],
    colors: { r: hex("#9c1f3c"), R: hex("#6a1428"), h: GLASS.h, g: alpha(hex("#d8eef6"), 0.85) },
  },
  whisky: {
    liquid: { chars: "aA" },
    rows: [
      "oggggo", //
      "ohgigo",
      "ohiIao",
      "oaaaAo",
      "oaaaAo",
      "oGGGGo",
      ".oooo.",
    ],
    colors: {
      a: hex("#d98a2b"),
      A: hex("#a85e18"),
      i: hex("#eefaff"),
      I: hex("#b8dcea"),
      h: GLASS.h,
      g: alpha(hex("#d8eef6"), 0.7),
      G: alpha(hex("#e8f6fb"), 0.95),
    },
  },
  coctel: {
    liquid: { chars: "cC" },
    rows: [
      "......pP.", //
      ".....pPpp",
      "ooooooos.",
      "ohcckcCo.",
      ".occcCo..",
      "..ocCo...",
      "...og....",
      "...og....",
      "..oggo...",
      "..oooo...",
    ],
    colors: {
      c: hex("#ff8a5c"),
      C: hex("#e0476a"),
      k: hex("#c8102e"),
      p: hex("#ffd166"),
      P: hex("#e05a8a"),
      s: hex("#b8733a"),
      h: GLASS.h,
      g: alpha(hex("#d8eef6"), 0.85),
    },
  },
  habano: {
    fx: "smoke",
    ember: { chars: "e", body: "bB" },
    rows: [
      ".oooooooo", //
      "obbbbgbbe",
      "oBBBBGBBe",
      ".oooooooo",
    ],
    colors: { b: hex("#8a5530"), B: hex("#5e3620"), g: hex("#e8c050"), G: hex("#b88a24"), e: hex("#ff7a2a") },
  },
  // ---------- Casa viva: lo gratis de la nevera y de la fogata ----------
  jugo: {
    liquid: { chars: "aA" },
    rows: [
      "....ss.", //
      "oooosoo",
      "ohaasAo",
      "ohaaaAo",
      "ohaaAAo",
      "ohaaaAo",
      "oggggGo",
      ".ooooo.",
    ],
    colors: { a: hex("#ffa62b"), A: hex("#e07a18"), s: hex("#f25c7a"), h: GLASS.h, g: alpha(hex("#d8eef6"), 0.85), G: alpha(hex("#e8f6fb"), 0.95) },
  },
  // El agua de panela de la cafetera de la casa (no está en la carta): la taza del tinto, dorada y con
  // una rodaja de limón.
  aguapanela: {
    fx: "steam",
    rows: [
      ".oooool", //
      ".occcoL",
      ".owwWoo",
      ".owwWoo",
      "ooooooo",
      "oWwwwWo",
      ".ooooo.",
    ],
    colors: { ...CUP, c: hex("#b8742e"), l: hex("#f3e36a"), L: hex("#9fc43a") },
    surface: { chars: "c", inner: hex("#dca45a") },
  },
  manzana: {
    crumb: hex("#fff3d0"),
    rows: [
      "...ol..", //
      "..oolL.",
      ".ooRo..",
      "orrRrro",
      "orHrrRo",
      "orrrrRo",
      "orrrRRo",
      ".oRRRo.",
      "..ooo..",
    ],
    colors: { r: hex("#d93a3a"), R: hex("#a8242c"), H: hex("#ff9a8a"), l: hex("#6fb34a"), L: hex("#3f7a2e") },
  },
  banano: {
    crumb: hex("#fff6d6"),
    rows: [
      "......oo", //
      ".....odo",
      "....oyyo",
      "...oyyYo",
      "..oyyyYo",
      "ooyyyYo.",
      "oyyyYo..",
      ".oooo...",
    ],
    colors: { y: hex("#f7d84a"), Y: hex("#c9a526"), d: hex("#5a3b1c") },
  },
  malvavisco: {
    crumb: hex("#fffaf0"),
    rows: [
      "....ooo.", //
      "...obBbo",
      "...oBwbo",
      "...obbbo",
      "..oooooo",
      "..s.....",
      ".s......",
      "s.......",
    ],
    // Dorado por fuera (asado en la fogata) y blanco por dentro; el palito de madera abajo.
    colors: { b: hex("#d9923e"), B: hex("#f3c47a"), w: hex("#fff4e0"), s: hex("#8a5530") },
  },
};

export const CAFE_ITEM_ART = Object.keys(ITEMS);

/** Brasa: apagada (0), titilando (1) o encendida al pitar (2). */
const EMBER: RGBA[] = [hex("#b8401c"), hex("#ff7a2a"), hex("#ffd76a")];

/** Cómo está lo que se tiene en la mano. Sin nada, entero y con la brasa normal. */
export interface HeldArtState {
  /** Usos que le quedan (sin esto, entero). */
  left?: number;
  ember?: 0 | 1 | 2;
  /** Inclinado hacia la boca (-1 = arriba hacia la izquierda, 1 = hacia la derecha). */
  tilt?: -1 | 0 | 1;
}

/** Columnas de papel u hoja que se queman con las pitadas (desde la brasa hacia atrás). */
function burnt(item: ItemArt, left: number, uses: number): number {
  if (!item.ember) return 0;
  const cols = new Set<number>();
  item.rows.forEach((r) => [...r].forEach((ch, x) => item.ember!.body.includes(ch) && cols.add(x)));
  // Queda al menos una columna de papel: el último uso lo apaga y se va de la mano.
  return Math.min(cols.size - 1, Math.round(((uses - left) / uses) * (cols.size - 1)));
}

/** Filas del dibujo según el uso: el cigarro se acorta y el vaso se vacía (la comida se muerde aparte). */
function rowsFor(item: ItemArt, id: string, left: number): string[] {
  const uses = usesOf(id);
  let rows = item.rows;
  const cut = burnt(item, left, uses);
  if (cut > 0) {
    // Se sacan columnas de papel pegadas a la brasa: la brasa (y su contorno) se corre hacia atrás.
    const emberCol = Math.max(...rows.map((r) => [...r].findIndex((ch) => item.ember!.chars.includes(ch))));
    rows = rows.map((r) => r.slice(0, emberCol - cut) + r.slice(emberCol));
  }
  if (item.surface && left < uses) {
    // Asoma la loza desde atrás (la izquierda) hacia adelante; algo de bebida queda hasta el último sorbo.
    const { chars } = item.surface;
    const cells: [number, number][] = [];
    rows.forEach((r, y) => [...r].forEach((ch, x) => chars.includes(ch) && cells.push([x, y])));
    const drained = Math.min(cells.length - 1, Math.round((cells.length * (uses - left)) / uses));
    const gone = new Set(cells.slice(0, drained).map(([x, y]) => `${x},${y}`));
    rows = rows.map((r, y) => [...r].map((ch, x) => (gone.has(`${x},${y}`) ? "i" : ch)).join(""));
  }
  if (item.liquid && left < uses) {
    const { chars, foam = "" } = item.liquid;
    const liquidRows = rows.map((r, y) => ([...r].some((ch) => chars.includes(ch)) ? y : -1)).filter((y) => y >= 0);
    // Con cada sorbo baja el nivel: las filas de arriba quedan de vidrio vacío ("e").
    const keep = Math.ceil((liquidRows.length * left) / uses);
    const drained = new Set(liquidRows.slice(0, liquidRows.length - keep));
    rows = rows.map((r, y) => [...r].map((ch) => (foam.includes(ch) || (drained.has(y) && chars.includes(ch)) ? "e" : ch)).join(""));
  }
  return rows;
}

function paint(item: ItemArt, rows: string[], ember: number): PixelCanvas {
  const w = Math.max(...rows.map((r) => r.length));
  const c = new PixelCanvas(w, rows.length);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      if (ch === "e" && !item.ember) return c.set(x, y, GLASS.empty);
      if (ch === "i" && item.surface) return c.set(x, y, item.surface.inner);
      const color = ch === "o" ? OUT : item.ember?.chars.includes(ch) ? EMBER[ember]! : item.colors[ch];
      if (color) c.set(x, y, color);
    }),
  );
  return c;
}

/**
 * Mordiscos: se sacan medialunas por el borde de arriba a la derecha (primero la esquina, después hacia
 * la izquierda y hacia abajo). El borde del mordisco queda con contorno y, adentro, la miga a la vista.
 */
function bite(c: PixelCanvas, bites: number, crumb: RGBA): PixelCanvas {
  if (bites <= 0) return c;
  const out = new PixelCanvas(c.width, c.height);
  out.data.set(c.data);
  const r = Math.max(1.7, c.width * 0.27);
  const centers: [number, number][] = [
    [c.width - 0.2, 0.9],
    [c.width - 0.4 - r * 1.45, -0.1],
    [c.width + 0.1, 0.9 + r * 1.5],
    [c.width - 0.6 - r * 2.8, 0.2],
  ];
  const cut = new Uint8Array(c.width * c.height);
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (centers.slice(0, bites).some(([cx, cy]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r)) {
        cut[y * c.width + x] = 1;
        out.data.fill(0, (y * c.width + x) * 4, (y * c.width + x) * 4 + 4);
      }
  const cutAt = (x: number, y: number) => x >= 0 && y >= 0 && x < c.width && y < c.height && cut[y * c.width + x] === 1;
  const nearCut = (x: number, y: number, d: number) => {
    for (let j = -d; j <= d; j++) for (let i = -d; i <= d; i++) if (Math.abs(i) + Math.abs(j) <= d && cutAt(x + i, y + j)) return true;
    return false;
  };
  const solid = (x: number, y: number) => out.alphaAt(x, y) > 0 && !cutAt(x, y);
  const isOut = (x: number, y: number) => {
    const i = (y * c.width + x) * 4;
    return out.data[i] === OUT[0] && out.data[i + 1] === OUT[1] && out.data[i + 2] === OUT[2];
  };
  const edge: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      if (!solid(x, y)) continue;
      if (nearCut(x, y, 1)) edge.push([x, y]);
      else if (nearCut(x, y, 2)) inner.push([x, y]);
    }
  // La miga no pinta lo que sobresale (la cereza de la torta): solo lo que tiene cuerpo alrededor.
  const body = (x: number, y: number) => [solid(x - 1, y), solid(x + 1, y), solid(x, y - 1), solid(x, y + 1)].filter(Boolean).length >= 3;
  for (const [x, y] of inner) if (!isOut(x, y) && body(x, y)) out.set(x, y, crumb);
  for (const [x, y] of edge) out.set(x, y, OUT);
  return out;
}

const isOutAt = (c: PixelCanvas, x: number, y: number) => {
  const i = (y * c.width + x) * 4;
  return c.data[i + 3]! > 0 && c.data[i] === OUT[0] && c.data[i + 1] === OUT[1] && c.data[i + 2] === OUT[2];
};

/**
 * Inclina el dibujo hacia un lado corriendo 1 px la mitad de arriba: la base queda firme en la mano y se
 * lee como un vaso que se lleva a la boca, sin deformar toda la silueta como un sesgo parejo. Después se
 * cierra el contorno donde las dos mitades se separaron.
 */
function leaned(c: PixelCanvas, dir: -1 | 1): PixelCanvas {
  const shift = (y: number) => (y < Math.floor(c.height / 2) ? 1 : 0);
  const extra = shift(0);
  const out = new PixelCanvas(c.width + extra + 2, c.height + 2);
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (!c.data[i + 3]) continue;
      const tx = 1 + (dir > 0 ? x + shift(y) : x + extra - shift(y));
      out.data.set(c.data.subarray(i, i + 4), ((y + 1) * out.width + tx) * 4);
    }
  const marks: [number, number][] = [];
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      if (out.alphaAt(x, y)) continue;
      const near = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const;
      if (near.some(([X, Y]) => out.alphaAt(X, Y) > 160 && !isOutAt(out, X, Y))) marks.push([x, y]);
    }
  for (const [x, y] of marks) out.set(x, y, OUT);
  return trim(out);
}

/** Recorta el lienzo a lo que tiene color. */
function trim(c: PixelCanvas): PixelCanvas {
  let x0 = c.width;
  let y0 = c.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (c.alphaAt(x, y)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) return new PixelCanvas(1, 1);
  const out = new PixelCanvas(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) out.data.set(c.data.subarray((y * c.width + x0) * 4, (y * c.width + x1 + 1) * 4), (y - y0) * out.width * 4);
  return out;
}

/** Algo que se lleva en la mano, según cómo está (ver `HeldArtState`). Un id desconocido da un lienzo de 1x1. */
export function drawHeldItem(id: string, state: HeldArtState = {}): PixelCanvas {
  const item = ITEMS[id];
  if (!item) return new PixelCanvas(1, 1);
  const uses = usesOf(id);
  const left = Math.max(1, Math.min(uses, state.left ?? uses));
  let c = paint(item, rowsFor(item, id, left), state.ember ?? 1);
  if (item.crumb) c = bite(c, uses - left, item.crumb);
  // Inclinado para el sorbo: hacia la boca, que queda del lado contrario a la mano.
  if (state.tilt) c = leaned(c, state.tilt);
  return c;
}

/** Sprite de un producto entero (sin escalar). Un id desconocido devuelve un lienzo vacío de 1x1. */
export function drawCafeItem(id: string): PixelCanvas {
  return drawHeldItem(id);
}

/** Lo que muestra la carta: el producto o, en los combos, las dos cosas lado a lado. */
export function drawMenuItem(menuId: string): PixelCanvas {
  const parts = heldParts(menuId).map((p) => drawHeldItem(p));
  if (parts.length <= 1) return parts[0] ?? drawHeldItem(menuId);
  const w = parts.reduce((s, p) => s + p.width, 0) + parts.length - 1;
  const h = Math.max(...parts.map((p) => p.height));
  const out = new PixelCanvas(w, h);
  let x0 = 0;
  for (const p of parts) {
    for (let y = 0; y < p.height; y++)
      for (let x = 0; x < p.width; x++) {
        const i = (y * p.width + x) * 4;
        if (p.data[i + 3]) out.set(x0 + x, h - p.height + y, [p.data[i]!, p.data[i + 1]!, p.data[i + 2]!, p.data[i + 3]!]);
      }
    x0 += p.width + 1;
  }
  return out;
}

/**
 * Vapor o humo del producto y el píxel del que sale (por defecto, el centro de arriba). En el cigarro y
 * el habano sale de la brasa, que se corre a medida que se fuma.
 */
export function heldEffect(id: string, left?: number): { fx: HeldEffect; from: [number, number] } | null {
  const item = ITEMS[id];
  if (!item?.fx) return null;
  const rows = rowsFor(item, id, Math.max(1, left ?? usesOf(id)));
  const w = Math.max(...rows.map((r) => r.length));
  if (item.ember) {
    for (let y = 0; y < rows.length; y++) {
      const x = [...rows[y]!].findIndex((ch) => item.ember!.chars.includes(ch));
      if (x >= 0) return { fx: item.fx, from: [x, y] };
    }
  }
  return { fx: item.fx, from: item.from ?? [Math.floor(w / 2), 0] };
}

/** Color de las migas que caen al morder (el de la miga del producto). */
export function crumbColor(id: string): RGBA | null {
  return ITEMS[id]?.crumb ?? null;
}

/** Bocanada de vapor (blanca) o de humo (gris): se anima en el juego subiendo y desvaneciéndose. */
export function puff(fx: HeldEffect = "steam"): PixelCanvas {
  const c = new PixelCanvas(3, 4);
  const color = fx === "smoke" ? hex("#b8b0bc") : hex("#fff8e8");
  const s = alpha(color, 0.8);
  c.set(1, 0, s);
  c.set(0, 1, s);
  c.set(1, 2, s);
  c.set(2, 3, alpha(color, 0.5));
  return c;
}

/**
 * Voluta de humo o vapor de tamaño `size` (0 = un píxel, 3 = una nube chica): redonda, con luz arriba a
 * la izquierda y el borde más transparente. Se ondula y se deshace en el juego.
 */
export function wisp(size: 0 | 1 | 2 | 3, fx: HeldEffect = "smoke"): PixelCanvas {
  const base = fx === "smoke" ? [hex("#8e8698"), hex("#b8b0bc"), hex("#dcd6e0")] : [hex("#e8e0d4"), hex("#fff8e8"), hex("#ffffff")];
  // Crece hasta 9 px: a escala de juego el humo se tiene que ver de lejos.
  const d = [2, 3, 5, 8][size]!;
  const c = new PixelCanvas(d + 1, d + 1);
  const r = d / 2;
  for (let y = 0; y <= d; y++)
    for (let x = 0; x <= d; x++) {
      const nx = (x + 0.5 - r - 0.5) / (r + 0.01);
      const ny = (y + 0.5 - r - 0.5) / (r + 0.01);
      const dd = Math.hypot(nx, ny);
      if (dd > 1.05) continue;
      const light = nx + ny < -0.4 ? 2 : nx + ny > 0.6 ? 0 : 1;
      c.set(x, y, alpha(base[light]!, dd > 0.75 ? 0.6 : 0.92));
    }
  return c;
}

/** Halo de la brasa al pitar (se suma con luz). */
export function emberGlow(): PixelCanvas {
  const c = new PixelCanvas(7, 7);
  c.glow(3.5, 3.5, 3.5, 3.5, at(C.fire, 3), 0.7, 3);
  return c;
}

/** Miga que cae al morder (1x1 o 2x1). */
export function crumb(color: RGBA, big = false): PixelCanvas {
  const c = new PixelCanvas(big ? 2 : 1, 1);
  c.set(0, 0, color);
  if (big) c.set(1, 0, alpha(color, 0.8));
  return c;
}
