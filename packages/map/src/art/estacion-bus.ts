// La "Estación Hyvento" del Megabús (world/areas/parada.ts), dibujada a mano (docs/arte/estandar-arte.md, VIR-177
// tanda 3): la plataforma de losas de arenisca con la franja podotáctil y el cordón pintado, los torniquetes
// de acero, y la estación de vidrio casi negro con postes verde lima, bancas de madera, materas, el mapa de
// la ruta, la pantalla de "Próximo", la viga de madera del alero con sus focos, la cenefa lima con el letrero
// y el techo de tablas con sus claraboyas. Todo son grillas de letras: las losas y las tablas se dibujan
// vistas desde arriba (una letra por unidad de arte) y las caras de lo vertical
// como se ven de frente; `Lienzo` las pone en isométrico, una letra por píxel (la proyección 2:1 llena la
// pantalla sin huecos), de atrás hacia adelante. Las puertas de vidrio y el renglón de la pantalla son capas
// aparte (art/bus.ts, apps/web/src/game/bus.ts) en el mismo marco: no se mueve nada de su geometría.
import { BUS_DOOR_X, STATION, TURNSTILES } from "../world/areas/parada";
import { BLACK, LED, LIME, TINT } from "./bus-colores";
import { textMask } from "./digits";
import { edgeOf, rampLegend, type Legend } from "./grilla";
import { C, OUT, SHADOW, mix } from "./palette";
import { PixelCanvas, alpha, at, ramp, toScreen, type Ramp, type RGBA, type Sprite } from "./pixel";

const L = 16;

// ---------- Geometría (la usan también las capas de art/bus.ts y las luces de noche) ----------

/** La pieza de la estación empieza 3 tiles al oeste y 2 al norte de la plataforma (ver catalog-bus.ts). */
export const PX = 3 * L;
export const PY = 2 * L;
export const SW = STATION.w * L;
export const SD = STATION.d * L;
/** Vidrio del norte (en y) y del sur (pegado al cordón), las puntas (en x) y la altura hasta el techo. */
export const NORTH_Y = 8;
export const SOUTH_Y = SD - 2;
export const END_X0 = 8;
export const END_X1 = SW - 8;
export const GLASS_TOP = 42;
/** La cenefa lima del techo (de z0 a z1; arriba, el entablado). */
export const ROOF = { z0: 42, z1: 51 };
/** La viga de madera del alero, debajo de la cenefa y un poco metida. */
export const VIGA = { z0: 38, y: SD + 5 };
/** El hueco de los torniquetes en el vidrio del norte. */
export const GATE = { x0: (TURNSTILES[0] - STATION.x) * L, x1: (TURNSTILES[1] + 1 - STATION.x) * L };
/** Centro (x, en la plataforma) de cada puerta de vidrio: enfrente de las del bus parado. */
export const STATION_DOORS = BUS_DOOR_X.map((x) => (x - STATION.x) * L);
export const DOOR_W = 20;
/** La pantalla colgada del alero, sobre el borde de la plataforma, mirando a la calle (el bus la tapa al parar). */
export const SCREEN = { x0: 113, x1: 163, y: 50, z0: 18, z1: 36 };
/** Los focos bajo el alero (x de cada uno, 10 de ancho): las luces de noche (luces-ventanas.ts) van ahí. */
export const FOCOS_ALERO = [20, 60, 100, 140, 180, 220, 260];
/** El letrero de la cenefa: dónde empieza (x en la plataforma) y la base de las letras (z). */
export const LETRERO = { text: "ESTACION HYVENTO", x0: 10, z0: 43 };

/** Postes de la estación (en x): los del sur esquivan las puertas y los del norte enmarcan los torniquetes. */
const SOUTH_POSTS = [END_X0, 76, 138, 206, 262, END_X1];
const NORTH_POSTS = [END_X0, 76, GATE.x0 - 3, GATE.x1 + 1, 206, 262, END_X1];
const DOOR_SPANS = STATION_DOORS.map((c) => [Math.round(c - DOOR_W / 2), Math.round(c + DOOR_W / 2)] as const).sort((p, q) => p[0] - q[0]);

// ---------- El lienzo isométrico ----------

/**
 * Pone grillas en isométrico: cada letra es una unidad de arte del mundo (x, y, z) y cae en un píxel. Se
 * pinta de atrás hacia adelante (lo de adelante tapa).
 */
class Lienzo {
  readonly c: PixelCanvas;
  readonly ox: number;
  readonly oy: number;
  /** Corrimiento de lo que se pinta (la estación dibuja en coordenadas de la plataforma). */
  dx = 0;
  dy = 0;

  constructor(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, pad = 3) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const x of [x0, x1])
      for (const y of [y0, y1])
        for (const z of [z0, z1]) {
          const s = toScreen(x, y, z);
          xs.push(s.x);
          ys.push(s.y);
        }
    this.ox = Math.ceil(-Math.min(...xs)) + pad;
    this.oy = Math.ceil(-Math.min(...ys)) + pad;
    this.c = new PixelCanvas(Math.ceil(Math.max(...xs) - Math.min(...xs)) + pad * 2 + 1, Math.ceil(Math.max(...ys) - Math.min(...ys)) + pad * 2 + 1);
  }

  put(x: number, y: number, z: number, col: RGBA | null | undefined) {
    if (!col) return;
    const X = x + this.dx;
    const Y = y + this.dy;
    this.c.set(X - Y + this.ox, Math.floor((X + Y) / 2) - z + this.oy, col);
  }

  /** Una cara que corre a lo largo de x (se ve su lado +y): la fila de arriba de la grilla es la más alta. */
  caraX(rows: readonly string[], leg: Legend, x0: number, y: number, z0: number) {
    const h = rows.length;
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) this.put(x0 + c, y, z0 + h - 1 - r, color(leg, row[c]!, row));
    });
  }

  /** Una cara que corre a lo largo de y (se ve su lado +x), como se ve en pantalla: la columna 0 es la de `yLeft`. */
  caraY(rows: readonly string[], leg: Legend, x: number, yLeft: number, z0: number) {
    const h = rows.length;
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) this.put(x, yLeft - c, z0 + h - 1 - r, color(leg, row[c]!, row));
    });
  }

  /** Una superficie horizontal vista desde arriba: fila = y, columna = x. */
  tapa(rows: readonly string[], leg: Legend, x0: number, y0: number, z: number) {
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) this.put(x0 + c, y0 + r, z, color(leg, row[c]!, row));
    });
  }

  /** Un dibujo de pantalla con su ancla (ax, ay) en el punto del mundo (x, y, z). */
  sello(rows: readonly string[], leg: Legend, ax: number, ay: number, x: number, y: number, z: number) {
    const X = x + this.dx;
    const Y = y + this.dy;
    const sx = X - Y + this.ox - ax;
    const sy = Math.floor((X + Y) / 2) - z + this.oy - ay;
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const col = color(leg, row[c]!, row);
        if (col) this.c.set(sx + c, sy + r, col);
      }
    });
  }

  /** Contorno cálido afuera y recorte al contenido. */
  sprite(edge: RGBA | null): Sprite {
    if (edge) this.c.outline(edge);
    const { width: w, height: h, data } = this.c;
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (data[(y * w + x) * 4 + 3]) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
    if (x1 < 0) return { canvas: this.c, ox: this.ox, oy: this.oy };
    const out = new PixelCanvas(x1 - x0 + 1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) out.data.set(data.subarray((y * w + x0) * 4, (y * w + x1 + 1) * 4), (y - y0) * out.width * 4);
    return { canvas: out, ox: this.ox - x0, oy: this.oy - y0 };
  }
}

/** Color de una letra (el punto y el espacio no se pintan; una letra sin color es un error). */
function color(leg: Legend, ch: string, row: string): RGBA | null {
  if (ch === "." || ch === " ") return null;
  const c = leg[ch];
  if (!c) throw new Error(`Letra sin color en la estación: "${ch}" (${row})`);
  return c;
}

/** Una fila de `len` letras repitiendo un módulo dibujado (desde la columna `from` del módulo). */
const tira = (mod: string, len: number, from = 0) => Array.from({ length: len }, (_, i) => mod[(i + from) % mod.length]).join("");

// ---------- Materiales ----------

/** Arenisca de las losas (cálida, como el cordón de la calle) y un ocre para las que cambian de tono. */
const ARENISCA = ramp("#5a4434", "#7a5f49", "#9a7d62", "#b99c7d", "#d3b999", "#eadbbf");
const OCRE = ramp("#563f2c", "#76583f", "#977552", "#b39069", "#cbab84", "#e0c6a2");
/** Amarillo de la franja podotáctil y de la pintura del borde. */
const AMARILLO = ramp("#5e4210", "#8a6418", "#b88a24", "#d9ac3a", "#ecc95e", "#f8e39a");
/** Acero de los torniquetes: tibio, con brillo crema (nada azulado). */
const ACERO = ramp("#3a3430", "#57504a", "#7b736a", "#a39a8f", "#cbc3b7", "#f1ece2");

const lime = (i: number) => at(LIME, i);
/** Contorno cálido del lima: su sombra más honda tirada al café. */
const LIME_EDGE = mix(at(LIME, 0), OUT, 0.5);

// ---------- La plataforma ----------

// Losas de arenisca de 16 x 14 vistas desde arriba (x a la derecha, y hacia abajo = hacia la calle). La luz
// viene de arriba a la izquierda de la pantalla: el canto del oeste (columna 0) es el más claro, el del norte
// (fila 0) le sigue, el del este y el del sur van en sombra. La última fila y la última columna son la junta.
// <losas>
const LOSA_LIMPIA = [
  "544444444444443o",
  "543333343333332o",
  "533333333323332o",
  "433433333333342o",
  "533333323333332o",
  "533333333334332o",
  "532333333333332o",
  "433333433333232o",
  "533333333333332o",
  "533343333233332o",
  "533333333333332o",
  "433233333334332o",
  "322222222222221o",
  "oooooooooooooooo",
];
const LOSA_GASTADA = [
  "544444444444443o",
  "543333343333332o",
  "533334444333332o",
  "433444444443342o",
  "533444454444332o",
  "534444555444432o",
  "534445554444432o",
  "433444454444332o",
  "533444444443332o",
  "533334444433332o",
  "533333344333332o",
  "433333333333332o",
  "322222222222221o",
  "oooooooooooooooo",
];
const LOSA_RAJADA = [
  "544444444444443o",
  "533333333333332o",
  "533x33333333332o",
  "4334x3333333342o",
  "53334xx33333332o",
  "5333334x3333332o",
  "53333334xx33332o",
  "433333333x43332o",
  "5333333334x3332o",
  "53333333334xx32o",
  "533333333333x22o",
  "4332333333333x2o",
  "322222222222221o",
  "oooooooooooooooo",
];
const LOSA_MANCHADA = [
  "122444444444443o",
  "123333343333332o",
  "233333333323332o",
  "433433333333342o",
  "5333333kk333332o",
  "533333kkkk33332o",
  "53233kkkkkk3332o",
  "433333kkkk33232o",
  "5333333kk333332o",
  "533343333233332o",
  "533333333333332o",
  "433233333334332o",
  "322222222222221o",
  "oooooooooooooooo",
];
const LOSA_HOJA = [
  "544444444444443o",
  "543333343333332o",
  "5333333333lL332o",
  "43343333lLLLL42o",
  "5333333lLLLv332o",
  "53333333vLL4332o",
  "5323333v3333332o",
  "4333334v3333232o",
  "533333333333332o",
  "533343333233332o",
  "533333333333332o",
  "433233333334332o",
  "322222222222221o",
  "ommooooooommmooo",
];
// </losas>

/** Qué losa va en cada lugar (a propósito: las gastadas, frente a los torniquetes y las puertas). */
const LOSAS: Record<string, { rows: string[]; r: Ramp }> = {
  A: { rows: LOSA_LIMPIA, r: ARENISCA },
  B: { rows: LOSA_GASTADA, r: ARENISCA },
  C: { rows: LOSA_RAJADA, r: ARENISCA },
  D: { rows: LOSA_LIMPIA, r: OCRE },
  E: { rows: LOSA_MANCHADA, r: ARENISCA },
  F: { rows: LOSA_HOJA, r: OCRE },
};
/** La fila de losas del norte (de x = 0) y la del medio, trabada (de x = -8). */
const FILA_NORTE = "AEADCAFABBADACEAFD";
const FILA_MEDIO = "DACBAEBADBFBACABEAD";

// La franja podotáctil: baldosas amarillas de 16 x 8 con botones (cada uno con su brillo arriba a la izquierda).
// <podotactil>
const PODOTACTIL = [
  "544444444444443o",
  "5hb33hb33hb33hbo",
  "5bs33bs33bs33bso",
  "533333333333332o",
  "533hb33hb33hb32o",
  "533bs33bs33bs32o",
  "533333333333332o",
  "oooooooooooooooo",
];
// </podotactil>
/** Remate: adoquines de 8 x 3 entre las losas y la franja. */
const REMATE = ["5444443o", "4333332o", "oooooooo"];
/** El cordón: la pintura amarilla gastada sobre la piedra y la nariz del borde, en bloques de 32. */
// <cordon>
const CORDON = [
  "YYYYYYYYYY4YYYYYYYYYYYYYY44YYYYu",
  "yyyyyyyyyyyyyyyy3yyyyyyyyyyyyyyu",
  "4444444434444444444444444444443o",
  "5555555555555555455555555555554o",
];
// </cordon>

const losaLegend = (r: Ramp): Legend => ({
  ...rampLegend(r),
  o: mix(at(r, 1), OUT, 0.45),
  x: mix(at(r, 0), OUT, 0.3),
  k: mix(at(r, 3), at(r, 2), 0.55),
  l: at(C.terracotta, 3),
  L: at(C.terracotta, 2),
  v: at(C.woodDark, 2),
  m: at(C.sage, 2),
});
const LEG_LOSA = { arenisca: losaLegend(ARENISCA), ocre: losaLegend(OCRE) };
const LEG_AMARILLO: Legend = {
  ...rampLegend(AMARILLO),
  h: at(AMARILLO, 5),
  b: at(AMARILLO, 4),
  s: at(AMARILLO, 1),
  o: mix(at(AMARILLO, 0), OUT, 0.4),
};
const LEG_CORDON: Legend = {
  ...rampLegend(ARENISCA),
  o: mix(at(ARENISCA, 1), OUT, 0.45),
  Y: at(AMARILLO, 4),
  y: at(AMARILLO, 3),
  u: at(AMARILLO, 1),
};

/** El color del piso de la plataforma en (x, y) (unidades de arte, desde su esquina). */
function pisoAnden(x: number, y: number): RGBA | null {
  if (y < 2) return y === 0 ? at(ARENISCA, 3) : mix(at(ARENISCA, 1), OUT, 0.45);
  if (y < 30) {
    const norte = y < 16;
    const fila = norte ? FILA_NORTE : FILA_MEDIO;
    const sx = norte ? x : x + 8;
    const losa = LOSAS[fila[Math.floor(sx / 16)]!]!;
    const leg = losa.r === OCRE ? LEG_LOSA.ocre : LEG_LOSA.arenisca;
    return color(leg, losa.rows[(y - (norte ? 2 : 16)) % 14]![sx % 16]!, "losa");
  }
  if (y < 33) return color(LEG_LOSA.arenisca, REMATE[y - 30]![(x + 4) % 8]!, "remate");
  if (y < 41) return color(LEG_AMARILLO, PODOTACTIL[y - 33]![x % 16]!, "podotáctil");
  if (y < 44) return color(LEG_LOSA.arenisca, REMATE[y - 41]![x % 8]!, "remate");
  return color(LEG_CORDON, CORDON[y - 44]![x % 32]!, "cordón");
}

// Los torniquetes: tres gabinetes de acero con la tapa lima, el validador prendido y el lector de tarjeta
// arriba, y los brazos del trípode cruzando cada paso.
// <torniquete>
const TORNIQUETE_FRENTE = ["GGg", "gqq", "543", "543", "543", "432", "543", "543", "543", "543", "543", "432", "321", "ooo"];
const TORNIQUETE_LADO = [
  "ggggggggggg",
  "qqqqqqqqqqq",
  "33333333332",
  "2VV22222221",
  "2vV22222221",
  "2vv22k22221",
  "22222kk2221",
  "22222222221",
  "22222122221",
  "22222222221",
  "22222122221",
  "11111111110",
  "00000000000",
  "ooooooooooo",
];
const TORNIQUETE_TAPA = ["GGG", "GGg", "GGg", "GGg", "GGg", "GGg", "GGg", "GGg", "GGg", "GkG", "Gkg", "ggg"];
// </torniquete>
/** Los brazos del trípode desde el eje (x, y, z relativos): el de arriba cruza el paso y los otros dos bajan. */
const BRAZO_RECTO = Array.from({ length: 11 }, (_, t) => [t, 0, 0] as const);
const BRAZO_ATRAS = [
  [0, -1, -1],
  [1, -2, -2],
  [2, -2, -3],
  [3, -3, -4],
  [4, -4, -5],
] as const;
const BRAZO_ADELANTE = [
  [0, 1, -1],
  [1, 2, -2],
  [2, 2, -3],
  [3, 3, -4],
  [4, 4, -5],
] as const;

const LEG_TORNIQUETE: Legend = {
  ...rampLegend(ACERO),
  G: lime(5),
  g: lime(4),
  q: lime(2),
  V: at(C.sage, 5),
  v: at(C.sage, 3),
  k: at(BLACK, 1),
  o: mix(at(ACERO, 0), OUT, 0.4),
};

function torniquetes(g: Lienzo) {
  const cabinas = [GATE.x0 - 1, (GATE.x0 + GATE.x1) / 2 - 1, GATE.x1 - 2];
  // Sombra al piso hacia la derecha de la pantalla (la luz viene de arriba a la izquierda).
  for (const gx of cabinas) for (let y = 3; y < 15; y++) for (let x = gx + 3; x < gx + 6; x++) g.put(x, y, 0, alpha(SHADOW, 0.22));
  cabinas.forEach((gx, i) => {
    g.tapa(TORNIQUETE_TAPA, LEG_TORNIQUETE, gx, 2, 14);
    g.caraX(TORNIQUETE_FRENTE, LEG_TORNIQUETE, gx, 13, 0);
    g.caraY(TORNIQUETE_LADO, LEG_TORNIQUETE, gx + 2, 12, 0);
    if (i === cabinas.length - 1) return;
    // El trípode: el brazo que cruza (con su brillo arriba) y los dos que bajan, con la punta de caucho.
    const hub = { x: gx + 3, y: 7, z: 8 };
    for (const brazo of [BRAZO_ATRAS, BRAZO_RECTO, BRAZO_ADELANTE])
      brazo.forEach(([dx, dy, dz], k) => {
        const end = k === brazo.length - 1;
        g.put(hub.x + dx, hub.y + dy, hub.z + dz + 1, end ? at(BLACK, 3) : at(ACERO, 5));
        g.put(hub.x + dx, hub.y + dy, hub.z + dz, end ? at(BLACK, 1) : at(ACERO, 3));
      });
    g.put(hub.x, hub.y, hub.z, at(BLACK, 2));
    g.put(hub.x, hub.y, hub.z + 1, at(ACERO, 4));
  });
}

/** Plataforma (plana, debajo de todos): las losas, el remate, la franja podotáctil, el cordón y los torniquetes. */
export function busPlatform(): Sprite {
  const g = new Lienzo(-2, -2, -2, SW + 2, SD + 2, 22);
  for (let y = 0; y < SD; y++) for (let x = 0; x < SW; x++) g.put(x, y, 0, pisoAnden(x, y));
  torniquetes(g);
  return g.sprite(null);
}

// ---------- La estación ----------

// Paños de vidrio de 24 x 36 (de z = 38 a z = 3), con el parteluz lima, el riel del medio y los reflejos:
// cielo tibio arriba, vetas de luz en diagonal y el verde del jardín abajo. Se alternan para que los
// reflejos no se repitan.
// <vidrio>
const PANO_A = [
  "MRRRRRRRRRRRRRRRRRRRRRRR",
  "Mrrrrrrrrrrrrrrrrrrrrrrr",
  "Mnbbbbbbbbbbbbbbbbbbbbbb",
  "Mnbbbbbbbbbbbbbbbbbcccbb",
  "Mnbbbabbbabbbabbbacccbbb",
  "Mnabbbabbbabbbabbwccaabb",
  "Mnbaaabaaabaaabawccabaca",
  "Mnaaaaaaaaaaaaacccaaacaa",
  "Mnaaaaaaaaaaaacccaaacaaa",
  "Mnaaaaaaaaaaacccaaacaaaa",
  "Mnaaaaaaaaaacccaaacaaaaa",
  "Mnaaaaaaaaacccaaacaaaaaa",
  "Mnaaaaaaaacccaaacaaaaaaa",
  "Mnaaaaaaacccaaacaaaaaaaa",
  "Mnaaaaaacccaaacaaaaaaaaa",
  "Mnaaaaacccaaacaaaaaaaaaa",
  "Mnaaaacccaaacaaaaaaaaaaa",
  "Mnaaacccaaacaaaaaaaaaaaa",
  "Mnaacccaaacaaaaaaaaaaaaa",
  "Mnacccaaacaaaaaaaaaaaaaa",
  "MRRRRRRRRRRRRRRRRRRRRRRR",
  "Mrrrrrrrrrrrrrrrrrrrrrrr",
  "Mnaaaaaaaaaccaaaaaaaaaaa",
  "Mnaaaaaaaaccaaaaaaaaaaaa",
  "Mnaaaaaaaccaaaaaaaaaaaaa",
  "Mnaaaaaaccaaaaaaaaaaaaaa",
  "Mnaaaaaccaaaaaaaaaaaaaaa",
  "Mnaaaaccaaaaaaaaaaaaaaaa",
  "Mnaaaccaaaaaaaaaaaaaaaaa",
  "Mnaaccaaaeaaaeaaaeaaaeaa",
  "Mnaccaeaaaeaaaeaaaeaaaea",
  "Mnccaeaeaeaeaeaeaeaeaeae",
  "Mneeeeeeeeeeeeeeeeeeeeee",
  "Mneeeeeeeeeeeeeeeeeeeeee",
  "Mneeeeeeeeeeeeeeeeeeeeee",
  "MEEEEEEEEEEEEEEEEEEEEEEE",
];
const PANO_B = [
  "MRRRRRRRRRRRRRRRRRRRRRRR",
  "Mrrrrrrrrrrrrrrrrrrrrrrr",
  "Mnbbbbbbbbbbbbbbbbbbbbbc",
  "Mnbbbbbbbbbbbbbbbbbbbbcc",
  "Mnbbbabbbabbbabbbabbbcwb",
  "Mnabbbabbbabbbabbbabccab",
  "Mnbaaabaaabaaabaaabccaba",
  "Mnaaaaaaaaaaaaaaaaccaaaa",
  "Mnaaaaaaaaaaaaaaaccaaaaa",
  "Mnaaaaaaaaaaaaaaccaaaaaa",
  "Mnaaaaaaaaaaaaaccaaaaaaa",
  "Mnaaaaaaaaaaaaccaaaaaaaa",
  "Mnaaaaaaaaaaaccaaaaaaaaa",
  "Mnaaaaaaaaaaccaaaaaaaaaa",
  "Mnaaaaaaaaaaaaaaaaaaaaaa",
  "Mnaaaaaaaaaaaaaaaaaaaaaa",
  "Mnaaaaaaaaaaaaaaaaaaaaaa",
  "Mnaaaaaaaaaaaaaaaaaaaaaa",
  "Mnaaaaaaaaaaaaaaaaaaaaaa",
  "Mnaaaaaaaaaaaaaaaaaaaaaa",
  "MRRRRRRRRRRRRRRRRRRRRRRR",
  "Mrrrrrrrrrrrrrrrrrrrrrrr",
  "Mnaaaaaaaaaaaaaacccaaaaa",
  "Mnaaaaaaaaaaaaacccaaaaaa",
  "Mnaaaaaaaaaaaacccaacaaaa",
  "Mnaaaaaaaaaaacccaacaaaaa",
  "Mnaaaaaaaaaawccaacaaaaaa",
  "Mnaaaaaaaaacccaacaaaaaaa",
  "Mnaaaaaaaacccaacaaaaaaaa",
  "Mnaaaeaaacccaecaaaeaaaea",
  "Mneaaaeacccaecaaeaaaeaaa",
  "Mnaeaeacccaeceaeaeaeaeae",
  "Mneeeeccceeceeeeeeeeeeee",
  "Mneeeccceeceeeeeeeeeeeee",
  "Mneeeeeeeeeeeeeeeeeeeeee",
  "MEEEEEEEEEEEEEEEEEEEEEEE",
];
const PANO_C = [
  "MRRRRRRRRRRRRRRRRRRRRRRR",
  "Mrrrrrrrrrrrrrrrrrrrrrrr",
  "Mnbbbbbbbbbbbbbbbbbbbbbb",
  "Mnbbbbbbbbbbbbbbbbbbbbcb",
  "Mnbbbabbbabbbabbbabbbcbb",
  "Mnabbbabbbabbbabbbabbcbb",
  "Mnbaaabaaabaaabaaabcbaba",
  "Mnaaaaaaaaaaaaaaaacaaaaa",
  "Mnaaaaaaaaaaaaaaacaaaaaa",
  "Mnaaaaaaaaaaaaaacaaaaaaa",
  "Mnaaaaaaaaaccaaaaaaaaaaa",
  "Mnaaaaaaaaccaaaaaaaaaaaa",
  "Mnaaaaaaaccaawaaaaaaaaaa",
  "Mnaaaaaaccaaaaaaaaaaaaaa",
  "Mnaaaaaccaaaaaaaaaaaaaaa",
  "Mnaaaaccaaaaaaaaaaaaaaaa",
  "Mnaaaccaaaaaaaaaaaaaaaaa",
  "Mnaaccaaaaaaaaaaaaaaaaaa",
  "Mnaccaaaaaaaaaaaaaaaaaaa",
  "Mnccaaaaaaaaaaaaaaaaaaaa",
  "MRRRRRRRRRRRRRRRRRRRRRRR",
  "Mrrrrrrrrrrrrrrrrrrrrrrr",
  "Mnaaaaaaaaaaaaaaaaaaaaaa",
  "Mnaaaaaaaaaaaaaaaaaaaaaa",
  "Mnaaaaaaaaaaaaaaaaaaaaaa",
  "Mnaaaaaaaaaaaaaaaaaaaaaa",
  "Mnaaaaaaaaaaaaaaaaaaaaaa",
  "Mnaaaaaaaaaaaaaaaaaaaaaa",
  "Mnaaaaaaaaaaaaaaaaaaaaaa",
  "Mnaaaeaaaeaaaeaaaeaaaeaa",
  "Mneaaaeaaaeaaaeaaaeaaaea",
  "Mnaeaeaeaeaeaeaeaeaeaeae",
  "Mneeeeeeeeeeeeeeeeeeeeee",
  "Mneeeeeeeeeeeeeeeeeeeeee",
  "Mneeeeeeeeeeeeeeeeeeeeee",
  "MEEEEEEEEEEEEEEEEEEEEEEE",
];
// </vidrio>
const PANOS = [PANO_A, PANO_B, PANO_C];
/** El orden de los paños a lo largo de cada pared (a propósito, sin que dos vecinos repitan reflejo). */
const ORDEN_PANOS = [0, 2, 1, 0, 1, 2, 2, 0, 1, 2, 0, 1];

/** Los colores del vidrio: casi negro y translúcido de día (con reflejos tibios); prendido por dentro de noche. */
function vidrioLegend(night: boolean, lado = false): Legend {
  const k = lado ? 0.28 : 0;
  const sombra = (c: RGBA) => mix(c, at(TINT, 0), k);
  const a = night ? 0.74 : 0.62;
  return {
    M: lado ? lime(3) : lime(4),
    n: alpha(at(TINT, 0), 0.82),
    R: lado ? lime(4) : lime(5),
    r: lado ? lime(2) : lime(3),
    E: lado ? lime(2) : lime(3),
    a: alpha(sombra(night ? mix(at(TINT, 2), at(C.gold, 3), 0.5) : at(TINT, 1)), a),
    b: alpha(sombra(night ? mix(at(TINT, 3), at(C.gold, 4), 0.55) : mix(at(TINT, 3), at(C.cream, 3), 0.32)), a),
    c: alpha(sombra(night ? at(C.gold, 4) : mix(at(TINT, 4), at(C.cream, 4), 0.4)), night ? 0.8 : 0.72),
    w: alpha(night ? at(C.gold, 5) : at(C.cream, 5), 0.88),
    e: alpha(sombra(night ? mix(at(TINT, 2), at(C.gold, 2), 0.45) : mix(at(TINT, 2), at(C.leaf, 2), 0.4)), a),
  };
}

/**
 * Las filas de una pared de vidrio de `len` de largo que empieza en `u0` de la pared (así los paños quedan
 * en su sitio aunque la pared tenga huecos de puertas).
 */
function paredVidrio(u0: number, len: number): string[] {
  return PANO_A.map((_, r) =>
    Array.from({ length: len }, (_, i) => {
      const u = u0 + i;
      const pano = PANOS[ORDEN_PANOS[Math.floor(u / 24) % ORDEN_PANOS.length]!]!;
      return pano[r]![u % 24]!;
    }).join(""),
  );
}

/**
 * El vidrio de las puertas (capa de art/bus.ts): el mismo vidrio casi negro con sus vetas de luz. `u` a lo
 * largo de x (de la plataforma) y `v` hacia arriba desde el piso de la hoja.
 */
export function vidrioPuerta(night: boolean, u: number, v: number): RGBA {
  const leg = vidrioLegend(night);
  const k = (((Math.floor(u) + Math.floor(v)) % 29) + 29) % 29;
  if (k === 7 || k === 8) return leg.c!;
  if (k === 12) return leg.c!;
  if (v > 29) return leg.b!;
  if (v < 4) return leg.e!;
  return leg.a!;
}

/** Zócalo lima del vidrio (3 de alto) y su tapa. */
const ZOCALO = ["HHHHHHHH", "GGGGGgGG", "qqqqqqqq"];
const LEG_LIMA: Legend = { h: lime(6), H: lime(5), G: lime(4), g: lime(3), q: lime(2), Q: lime(1), Z: lime(0), o: LIME_EDGE };

/** Un poste lima de 3 x 3: la cara del frente (la de la luz, con su brillo) y la del lado (en sombra). */
function poste(g: Lienzo, cx: number, cy: number, h = GLASS_TOP) {
  const frente = ["HHG", ...Array.from({ length: h - 5 }, () => "hHG"), "GGg", "qqQ", "ZZZ", "ooo"].slice(0, h);
  const lado = ["Gg", ...Array.from({ length: h - 5 }, () => "gq"), "qQ", "QZ", "ZZ", "oo"].slice(0, h);
  g.caraX(frente, LEG_LIMA, cx - 1, cy + 1, 0);
  g.caraY(lado, LEG_LIMA, cx + 1, cy, 0);
}

// El mapa de la ruta pegado al vidrio del norte, por dentro: marco lima, la franja del encabezado, la ruta con
// sus paradas y el "usted está aquí".
// <mapa>
const MAPA = [
  "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
  "F6666666666666666666666666666666666666666f",
  "F5GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG5f",
  "F5GG666G66G6666G66GGGGGGGGGGGGGGGGGGGGGG5f",
  "F5gggggggggggggggggggggggggggggggggggggg5f",
  "F5555555555555555555555555555555555555555f",
  "F555555555555555555555555555tttttt5555555f",
  "F55555555ttttt555555555555555555555555555f",
  "F55555555555555555555555555555o5555555o55f",
  "F5555555555o55555555555555555oWoLLLLLoWo5f",
  "F555555555oWoLLLLL555555555555olllllllo55f",
  "F555555555LollllllL5555555555Ll5555555555f",
  "F55o55555Ll5555555lLo555R555Ll55555ttttt5f",
  "F5oWoLLLLl555555555oWoLLrLLLl555555555555f",
  "F55olllll55555555555olllolll5555555555555f",
  "F5555555555555555555555555555555555555555f",
  "F5tttt555555555555ttttt555555555555555555f",
  "F5555555555555555555555555t5t5t5t5t5t5t55f",
  "F5555555555555555555555555555555555555555f",
  "Ffffffffffffffffffffffffffffffffffffffffff",
];
// </mapa>
const mapaLegend = (night: boolean): Legend => ({
  F: lime(4),
  f: lime(2),
  G: lime(4),
  g: lime(3),
  "6": night ? at(C.cream, 5) : at(C.cream, 5),
  "5": night ? mix(at(C.cream, 4), at(C.gold, 4), 0.3) : at(C.cream, 4),
  L: lime(3),
  l: lime(1),
  W: at(C.white, 4),
  o: at(TINT, 2),
  r: at(C.fire, 1),
  R: at(C.fire, 3),
  t: at(C.cream, 1),
});

// Las bancas de adentro, contra el vidrio del norte: tablas de madera sobre patas de hierro.
const MADERA: Legend = { ...rampLegend(C.wood), o: edgeOf(C.wood, 0.55), k: at(C.woodDark, 0), K: at(C.woodDark, 2), j: mix(at(BLACK, 2), OUT, 0.3), J: mix(at(BLACK, 4), C.wood[2]!, 0.2) };

function banca(g: Lienzo, x0: number, x1: number) {
  const len = x1 - x0;
  const patas = [x0 + 1, Math.round((x0 + x1) / 2) - 1, x1 - 3];
  // Espaldar: las patas de atrás y dos tablas contra el vidrio (y = 10).
  for (const px of patas) g.caraX(["J", ...Array.from({ length: 15 }, () => "j")], MADERA, px, 10, 0);
  g.caraX([tira("4", len), tira("3332333323", len), tira("1", len)], MADERA, x0, 10, 13);
  g.caraX([tira("4", len), tira("3323333233", len, 3), tira("1", len)], MADERA, x0, 10, 10);
  // Asiento (de y = 10 a 13, 2 de grueso): tablas a lo largo con su junta y la veta.
  g.tapa([tira("5554555545", len), tira("4443444434", len, 2), tira("k", len), tira("4434444344", len, 5)], MADERA, x0, 10, 9);
  g.caraX([tira("3", len), tira("2221222212", len)], MADERA, x0, 13, 7);
  g.caraY(["32", "21"], MADERA, x1 - 1, 12, 7);
  // Patas de adelante.
  for (const px of patas) {
    g.caraX(Array.from({ length: 7 }, (_, i) => (i === 0 ? "JJ" : "Jj")), MADERA, px, 13, 0);
    g.caraY(Array.from({ length: 7 }, () => "j"), MADERA, px + 1, 12, 0);
  }
}

// Las materas de barro de las puntas, con su mata (dibujo de pantalla, el ancla al pie).
// <mata>
const MATA = [
  "......oo.....oo....",
  "....oo54o...o45o...",
  "...o5543o.oo5543o..",
  "..o55444oo55444o...",
  ".oo4443o554443oo...",
  "o554432o4443322o...",
  "o5444o44433222oooo.",
  ".o443o544432o44443o",
  "..oo3o44432o4433221o",
  "...o54443oo4332211o.",
  "..o54433o5o432211o..",
  ".o5443o2o55o3211o...",
  ".o433oo2o443o11o....",
  "..ooo.o21o3o2oo.....",
  "......o1oo1o........",
  ".......o..o.........",
];
// </mata>
const LEG_MATA: Legend = { ...rampLegend(C.leaf), o: edgeOf(C.leaf, 0.5) };
const MATERA_FRENTE = ["5444444", "4333333", "3322222", "3322222", "3222221", "3222221", "2211111", "ooooooo"];
const MATERA_LADO = ["3333333", "2222222", "1111111", "1111111", "1111110", "1111110", "1100000", "ooooooo"];
const MATERA_TAPA = ["5444444", "4211113", "4100003", "4100003", "4100003", "4100003", "4100003", "3333332"];
const LEG_MATERA: Legend = { ...rampLegend(C.terracotta), o: edgeOf(C.terracotta, 0.5) };

function matera(g: Lienzo, x0: number, y0: number) {
  g.tapa(MATERA_TAPA, LEG_MATERA, x0, y0, 8);
  g.caraX(MATERA_FRENTE, LEG_MATERA, x0, y0 + 7, 0);
  g.caraY(MATERA_LADO, LEG_MATERA, x0 + 6, y0 + 6, 0);
  g.sello(MATA, LEG_MATA, 9, 14, x0 + 3, y0 + 4, 8);
}

// La pantalla colgada: marco negro, "PROXIMO" en ámbar arriba y el renglón de abajo apagado (lo pinta el
// cliente con `busScreenText`).
function pantalla(g: Lienzo, night: boolean) {
  const w = SCREEN.x1 - SCREEN.x0;
  const h = SCREEN.z1 - SCREEN.z0;
  const m = textMask("PROXIMO", 1);
  const u0 = Math.floor((w - m.w) / 2);
  const rows = Array.from({ length: h }, (_, r) =>
    Array.from({ length: w }, (_, u) => {
      if (r === 0) return "s";
      if (r === h - 1) return "o";
      if (u === 0) return "s";
      if (u === w - 1) return "o";
      if (r === 1 || u === 1) return "b";
      // Las letras van de la fila 2 a la 8 (z 34 … 28).
      if (m.on(u - u0, r - 2)) return "L";
      return (u + r) % 2 ? "n" : "N";
    }).join(""),
  );
  const leg: Legend = { s: at(BLACK, 4), b: at(BLACK, 2), o: at(BLACK, 0), n: at(BLACK, 0), N: at(BLACK, 1), L: at(LED, night ? 4 : 3) };
  // Varillas hasta la viga.
  for (const x of [SCREEN.x0 + 4, SCREEN.x1 - 5]) for (let z = SCREEN.z1; z < VIGA.z0; z++) g.put(x, SCREEN.y - 1, z, at(ACERO, z % 2 ? 4 : 3));
  g.tapa([tira("s", w), tira("b", w)], leg, SCREEN.x0, SCREEN.y - 2, SCREEN.z1);
  g.caraX(rows, leg, SCREEN.x0, SCREEN.y, SCREEN.z0);
  g.caraY(Array.from({ length: h }, (_, r) => (r === 0 ? "bs" : r === h - 1 ? "oo" : "ob")), leg, SCREEN.x1 - 1, SCREEN.y - 1, SCREEN.z0);
}

// La viga de madera del alero (4 de alto: la fila de arriba queda detrás de la cenefa), con la veta y los
// nudos puestos a mano.
// <viga>
const VIGA_FRENTE = [
  "4444444444444444444444444444444444444444",
  "5554555455555455545555545554555545555545",
  "3343332333433323333433k33233343332333433",
  "2221222122212222122212K21222122212221222",
];
// </viga>
const LEG_VIGA: Legend = { ...rampLegend(C.logs), k: at(C.logs, 0), K: at(C.logs, 1), B: at(C.gold, 2), b: at(C.gold, 1) };

// El techo: un entablado de madera a lo largo de y (tablas de 4 con su junta), cada tabla con su tono, su
// veta y sus nudos; los clavos sobre las vigas de abajo, las juntas de las puntas trabadas, un poco de musgo
// en las juntas del norte (la sombra) y tres claraboyas de vidrio sobre los lugares de espera.
// <tablas>
const TABLA_LISA = ["4332", "4332", "4342", "4342", "4342", "4332", "4332", "4232", "4232", "4232", "4332", "4332", "4342", "4332", "4332", "4332"];
const TABLA_NUDO = ["4332", "4342", "4342", "4332", "4332", "4432", "4kK2", "4Kk2", "4432", "4332", "4332", "4232", "4232", "4332", "4342", "4332"];
const TABLA_VETA = ["4332", "4322", "4322", "4332", "4432", "4432", "4332", "4332", "4322", "4322", "4332", "4342", "4342", "4332", "4332", "4232"];
// </tablas>
const TABLAS: Record<string, readonly string[]> = { L: TABLA_LISA, N: TABLA_NUDO, V: TABLA_VETA };
/** Tres maderas: miel, rojiza y una más gastada por el sol. */
const TABLON = {
  m: ramp("#4a2e1e", "#6b4429", "#8d5d36", "#ad7a49", "#c9985f", "#dfb57c"),
  r: ramp("#45281d", "#653a29", "#874f37", "#a8694a", "#c4875f", "#dba57c"),
  g: ramp("#4d3a2c", "#6a5240", "#8a6e57", "#a78a6f", "#c1a68a", "#d8c2a6"),
};
const tablonLegend = (r: Ramp): Legend => ({ ...rampLegend(r), k: mix(at(r, 0), OUT, 0.2), K: at(r, 1), o: mix(at(r, 0), OUT, 0.35), n: mix(at(r, 0), OUT, 0.5), N: at(r, 5) });
const LEG_TABLON = { m: tablonLegend(TABLON.m), r: tablonLegend(TABLON.r), g: tablonLegend(TABLON.g) };
/** Cada tabla, de oeste a este: su veta (L, N, V) y su madera (m, r, g), puestas a mano. */
const TABLAS_VETA = "LVNLLVLNVLLVNLVLLNVLVLNLLVLLVNLVLLNVLVLNLLVLVNLLVLNVLLVLNLV";
const TABLAS_MADERA = "mmrmgmmrmmgmrmmmgmrmmgmmrmgmmmrmgmmrmmgmrmmmgmrmmgmmrmmgmr";
/** Dónde cae la junta de la punta de cada tabla (trabadas, nunca dos vecinas iguales). */
const JUNTAS = [13, 31, 46, 22, 5, 38, 17, 50, 28, 9, 42, 25, 34, 2, 47, 19];
/** Las filas de clavos (sobre las vigas de abajo). */
const CLAVOS_Y = [-3, SD / 2, SD + 3];
/** Las claraboyas (x0, x1), sobre las bancas y los lugares de espera; de y0 a y1. */
const CLARABOYAS: [number, number][] = [
  [36, 84],
  [124, 172],
  [208, 256],
];
const CLARABOYA_Y = { y0: 18, y1: 30 };
/** Hojas que cayeron al techo (x, y, cuál), puestas a mano. */
const HOJAS_TECHO: [number, number, number][] = [
  [10, 6, 0],
  [27, 40, 1],
  [61, 12, 2],
  [98, 44, 0],
  [113, 6, 1],
  [150, 38, 2],
  [189, 9, 0],
  [232, 41, 1],
  [271, 14, 2],
];
// <hojas>
const HOJA = [
  ["lL", ".Lv"],
  [".ll", "lLv"],
  ["yl", ".lL"],
];
// </hojas>
const LEG_HOJA: Legend = { l: at(C.terracotta, 4), L: at(C.terracotta, 2), v: at(C.woodDark, 2), y: at(AMARILLO, 4) };

function claraboya(x: number, y: number, night: boolean): RGBA | null {
  for (const [a, b] of CLARABOYAS) {
    if (x < a || x > b || y < CLARABOYA_Y.y0 || y > CLARABOYA_Y.y1) continue;
    // Marco lima (claro del lado de la luz), parteluces cada 16 y el vidrio que refleja el cielo, con una
    // veta de luz en diagonal y el brillo junto al marco de arriba.
    if (x === a || y === CLARABOYA_Y.y0) return lime(5);
    if (x === b || y === CLARABOYA_Y.y1) return lime(2);
    const u = x - a;
    const v = y - CLARABOYA_Y.y0;
    if (u % 16 === 0) return lime(4);
    if (u % 16 === 1) return lime(1);
    const k = (u + v * 2) % 26;
    if (night) {
      if (k < 3) return at(C.gold, 5);
      return mix(at(TINT, 3), at(C.gold, 4), v < 3 ? 0.8 : 0.66);
    }
    if (k === 6 || k === 7) return mix(at(TINT, 4), at(C.cream, 5), 0.6);
    if (k === 8) return mix(at(TINT, 4), at(C.cream, 4), 0.35);
    if (v === 1) return mix(at(TINT, 4), at(C.sky, 3), 0.45);
    if (v < 4) return mix(at(TINT, 3), at(C.sky, 2), 0.35);
    return mix(at(TINT, 2), at(C.sky, 1), 0.22);
  }
  return null;
}

/** El techo visto desde arriba: el remate lima, el entablado y las claraboyas. */
function techo(x: number, y: number, night: boolean): RGBA | null {
  if (x <= -5 || x >= SW + 5 || y <= -5 || y >= SD + 5) {
    if (x === -6 || y === -6) return lime(6);
    if (x === SW + 6 || y === SD + 6) return lime(3);
    return lime(5);
  }
  const vidrio = claraboya(x, y, night);
  if (vidrio) return vidrio;
  const b = Math.floor((x + 4) / 5);
  const col = (x + 4) % 5;
  const madera = TABLAS_MADERA[b % TABLAS_MADERA.length] as keyof typeof LEG_TABLON;
  const leg = LEG_TABLON[madera];
  const junta = JUNTAS[b % JUNTAS.length]!;
  // La junta entre tablas, con musgo en la sombra del remate del norte.
  if (col === 0) return y < 2 && (x * 7 + y * 3) % 5 < 2 ? at(C.sage, y < -2 ? 2 : 3) : leg.o!;
  if (y === junta) return leg.o!;
  if (y === junta + 1) return leg.N!;
  // Los clavos, dos por tabla sobre cada viga.
  if (CLAVOS_Y.includes(y) && (col === 1 || col === 4)) return leg.n!;
  if (CLAVOS_Y.includes(y - 1) && (col === 1 || col === 4)) return leg["5"]!;
  // La sombra del remate lima (más alto) sobre la punta del norte y la del oeste.
  const tabla = TABLAS[TABLAS_VETA[b % TABLAS_VETA.length]!]!;
  const c = color(leg, tabla[(y + 6 + b * 7) % 16]![col - 1]!, "tabla");
  return y === -4 || x === -4 ? mix(c!, leg.o!, 0.45) : c;
}

/**
 * La estación: vidrio a los cuatro lados (con el hueco de los torniquetes al norte y las puertas al sur),
 * postes lima, bancas y materas adentro, el mapa de la ruta, la pantalla de "PROXIMO", la viga de madera del
 * alero con sus focos, la cenefa lima con el letrero "ESTACION HYVENTO" y el techo de tablas. De noche, el vidrio
 * se ve prendido por dentro y los focos y el letrero se encienden.
 */
export function drawBusStation(night: boolean): Sprite {
  const g = new Lienzo(PX - 8, PY - 8, -2, PX + SW + 8, PY + SD + 8, ROOF.z1 + 14);
  g.dx = PX;
  g.dy = PY;
  const vidrio = vidrioLegend(night);
  const vidrioLado = vidrioLegend(night, true);

  // --- Pared del norte (la de atrás): vidrio, el mapa por dentro, el zócalo y los postes.
  for (const [a, b] of [
    [END_X0, GATE.x0 - 3],
    [GATE.x1 + 1, END_X1],
  ] as const) {
    g.caraX(paredVidrio(a - END_X0, b - a), vidrio, a, NORTH_Y, 3);
    g.caraX(ZOCALO.map((r) => tira(r, b - a)), LEG_LIMA, a, NORTH_Y + 1, 0);
  }
  g.caraX(MAPA, mapaLegend(night), 24, NORTH_Y + 1, 12);
  // Dintel lima sobre los torniquetes.
  g.caraX(["HHHHH", "GGGGG", "qqqqq"].map((r) => tira(r, GATE.x1 - GATE.x0 + 4)), LEG_LIMA, GATE.x0 - 3, NORTH_Y + 1, GLASS_TOP - 4);
  for (const x of NORTH_POSTS) poste(g, x, NORTH_Y);

  // --- Punta del oeste (se ve su cara de adentro).
  const fondo = SOUTH_Y - NORTH_Y - 1;
  g.caraY(paredVidrio(5, fondo), vidrioLado, END_X0, SOUTH_Y - 1, 3);
  g.caraY(ZOCALO.map((r) => tira(r.toLowerCase().replace(/h/g, "G"), fondo)), { ...LEG_LIMA, g: lime(3) }, END_X0 + 1, SOUTH_Y - 1, 0);

  // --- Adentro: las bancas contra el vidrio del norte y las materas de las puntas.
  banca(g, 84, 118);
  banca(g, 166, 200);
  banca(g, 214, 256);
  matera(g, 10, 20);
  matera(g, END_X1 - 9, 20);

  // --- Pared del sur (la del cordón): vidrio entre puertas, zócalo, marcos negros de las puertas y postes.
  let from = END_X0;
  const tramos: [number, number][] = [];
  for (const [a, b] of DOOR_SPANS) {
    tramos.push([from, a]);
    from = b;
  }
  tramos.push([from, END_X1]);
  for (const [a, b] of tramos) {
    g.caraX(paredVidrio(a - END_X0 + 11, b - a), vidrio, a, SOUTH_Y, 3);
    g.tapa([tira("H", b - a), tira("G", b - a)], LEG_LIMA, a, SOUTH_Y, 3);
    g.caraX(ZOCALO.map((r) => tira(r, b - a)), LEG_LIMA, a, SOUTH_Y + 1, 0);
  }
  const marco = { ...rampLegend(BLACK), o: at(BLACK, 0) };
  for (const [a, b] of DOOR_SPANS)
    for (const x of [a, b - 2]) {
      g.caraX(["32", ...Array.from({ length: GLASS_TOP - 2 }, () => "31"), "oo"], marco, x, SOUTH_Y + 1, 0);
      g.caraY(["2", ...Array.from({ length: GLASS_TOP - 2 }, () => "1"), "o"], marco, x + 1, SOUTH_Y, 0);
    }
  for (const x of SOUTH_POSTS) poste(g, x, SOUTH_Y);

  // --- Punta del este (se ve su cara de afuera).
  g.caraY(paredVidrio(13, fondo), vidrioLado, END_X1, SOUTH_Y - 1, 3);
  g.caraY(ZOCALO.map((r) => tira(r.replace(/H/g, "G").replace(/G/g, "g"), fondo)), LEG_LIMA, END_X1 + 1, SOUTH_Y - 1, 0);
  poste(g, END_X1, SOUTH_Y);

  // --- La pantalla colgada del alero.
  pantalla(g, night);

  // --- La viga de madera del alero, con los focos (bronce y vidrio crema; de noche, prendidos) y la luz de
  // aviso sobre cada puerta.
  const largo = SW + 11;
  const vigaFilas = VIGA_FRENTE.map((r, i) => tira(r, largo, i * 7)).map((r) => r.split(""));
  const foco = (x0: number, w: number, lente: string) => {
    for (let u = 0; u < w; u++) {
      const i = x0 + 5 + u;
      vigaFilas[1]![i] = u === 0 || u === w - 1 ? "b" : "B";
      vigaFilas[2]![i] = u === 0 || u === w - 1 ? "b" : lente;
    }
  };
  for (const x of FOCOS_ALERO) foco(x, 10, "f");
  for (const c of STATION_DOORS) foco(Math.round(c) - 1, 3, "a");
  const legViga: Legend = { ...LEG_VIGA, f: night ? at(C.gold, 5) : at(C.cream, 3), a: night ? at(C.fire, 4) : at(C.fire, 2) };
  g.caraX(
    vigaFilas.map((r) => r.join("")),
    legViga,
    -5,
    VIGA.y,
    VIGA.z0,
  );
  g.caraY(VIGA_FRENTE.map((r) => tira(r, SD + 10, 11).replace(/[kK]/g, "2")).map((r) => r.replace(/[45]/g, "3")), LEG_VIGA, SW + 5, VIGA.y - 1, VIGA.z0);

  // --- La cenefa lima con el letrero (adelante) y su costado (el este, en sombra).
  const sign = textMask(LETRERO.text, 1);
  const cw = SW + 13;
  const cenefa = Array.from({ length: ROOF.z1 - ROOF.z0 }, (_, r) => {
    const z = ROOF.z1 - 1 - r;
    return Array.from({ length: cw }, (_, u) => {
      const x = u - 6;
      if (r === 0) return "h";
      if (z === ROOF.z0) return "q";
      const lu = x - LETRERO.x0;
      const lv = LETRERO.z0 + sign.h - 1 - z;
      if (sign.on(lu, lv)) return "W";
      // La sombrita de cada letra, abajo a la derecha: se lee mejor sobre el lima.
      if (sign.on(lu - 1, lv - 1) && lv - 1 >= 0) return "s";
      // Las juntas de las láminas de la cenefa, cada 48, con un remache a cada lado arriba y abajo.
      const j = (u + 20) % 48;
      if (j === 0) return "g";
      if (j === 1) return "H";
      const fuera = !(sign.on(lu, lv) || sign.on(lu - 2, lv) || sign.on(lu + 2, lv));
      if (fuera && (j === 3 || j === 46) && (r === 2 || r === 6)) return r === 2 ? "h" : "g";
      // El canal de abajo: una línea más oscura y el borde que recibe la luz.
      if (r === 7) return "g";
      return r === 1 ? "H" : "G";
    }).join("");
  });
  g.caraX(cenefa, { ...LEG_LIMA, W: night ? at(C.cream, 5) : at(C.cream, 4), s: lime(1) }, -6, SD + 6, ROOF.z0);
  const costado = Array.from({ length: ROOF.z1 - ROOF.z0 }, (_, r) => tira(r === 0 ? "H" : r === ROOF.z1 - ROOF.z0 - 1 ? "Q" : "gggggggggggggggggggggggq", SD + 12));
  g.caraY(costado, LEG_LIMA, SW + 6, SD + 5, ROOF.z0);

  // --- El techo: el entablado, las claraboyas y las hojas que cayeron.
  for (let y = -6; y <= SD + 6; y++) for (let x = -6; x <= SW + 6; x++) g.put(x, y, ROOF.z1, techo(x, y, night));
  for (const [x, y, k] of HOJAS_TECHO) g.tapa(HOJA[k]!, LEG_HOJA, x, y, ROOF.z1);
  return g.sprite(LIME_EDGE);
}
