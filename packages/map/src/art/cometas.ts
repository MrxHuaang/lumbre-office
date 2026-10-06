// El Festival de cometas (VIR-168): las cometas que vuelan (salen del código, ver cometa.ts de
// @hyvento/shared: forma, dos colores de papel y la cola de trapitos), la mesa del taller, el puesto de
// Chepe, el carrito del raspao, el tablero del concurso, la manga de viento (con sus variantes, que la
// escena elige según el viento), los banderines, las cometas amarradas, el mantel del picnic, el árbol con
// la cometa enredada y la escalera del garaje. Cálido y de verano: papel de seda, guadua y cabuya; nada gris.
//
// Pixel art pintado a mano (docs/arte/estandar-arte.md): cada cometa es una grilla de letras (las de la cara con
// la luz de arriba a la izquierda, las de la sombra abajo a la derecha, los palitos de guadua y el nudo del
// frenillo), pintada con los dos colores del código; las piezas chicas (carretes, el tarro del engrudo, la
// canasta, la sombrilla, la manga de viento) también son grillas, y lo grande (mesas, mostradores, el
// toldo, el corcho, el mantel) son caras isométricas pintadas píxel a píxel con el lienzo de la decoración
// del Carnaval. Lo que se mueve (la cola de las cometas, los banderines, la manga) tiene cuadros que el
// navegador pasa en bucle (`COMETAS_DECOR_FRAMES`, `cometasDecorSprite`). Coordenadas locales de arte
// (tile = 16); lo de enfrente mira a +y.
import { COMETA_COLORES, COMETAS_GENTE, cometaPartes, type CometaColorLetra, type CometaForma } from "@hyvento/shared";
import { Lienzo, cuerdaPx, hexRamp, mismoLienzo, tablas, tonos, type Ley, type Pinta } from "./carnaval-decor";
import { NATURE_DRAW } from "./exterior-naturaleza";
import { C, OUT, mix } from "./palette";
import { alpha, at, hex, type Ramp, type RGBA, type Sprite } from "./pixel";

// ---------- Colores ----------

/** El papel de seda de cada color del código. */
const PAPEL = Object.fromEntries(Object.entries(COMETA_COLORES).map(([k, v]) => [k, hexRamp(v.hex)])) as Record<CometaColorLetra, Ramp>;
/** La guadua de los palitos (amarilla verdosa, con nudos más oscuros) y la cabuya del hilo. */
const GUADUA = hexRamp("#c8a24a");
const CABUYA = hexRamp("#d8c08a");
const MADERA = C.wood;
const OSCURA = C.woodDark;
const CREMA = C.cream;
const MIMBRE = hexRamp("#c89a52");
const NARANJA = PAPEL.n;
const BLANCO = hexRamp("#f1ebdc");
const AZUL = PAPEL.z;
const AMARILLO = PAPEL.a;
const ROJO = PAPEL.r;
const VERDE = PAPEL.v;
const ROSADO = PAPEL.s;
const MORADO = PAPEL.m;
const HIELO = hexRamp("#bfe4f2");
const LIMONADA = hexRamp("#d8e86a");
const METAL = C.metal;
const HILO = at(CABUYA, 3);
const HILO_OSCURO = at(CABUYA, 1);

// ---------- Las cometas ----------

/**
 * Las letras de una cometa: `a`/`A`/`q` el papel del color 1 (base, luz y sombra), `b`/`B`/`p` el del
 * color 2, `c`/`C` el color 2 aclarado (los gajos de la hexagonal), `g`/`G`/`f` la guadua, `k` el nudo de
 * cabuya del frenillo, `e` los ojos, `w` el brillo, `y` el pico y `r` la boca.
 */
function leyCometa(c1: CometaColorLetra, c2: CometaColorLetra): Ley {
  const A = PAPEL[c1];
  const B = PAPEL[c2];
  return {
    a: [A, 3],
    A: [A, 4.3],
    q: [A, 2],
    b: [B, 3],
    B: [B, 4.3],
    p: [B, 2],
    c: [B, 4],
    C: [B, 4.6],
    g: [GUADUA, 3],
    G: [GUADUA, 4.4],
    f: [GUADUA, 2],
    k: at(CABUYA, 1),
    e: hex("#2b1b17"),
    w: hex("#fffaf0"),
    y: [AMARILLO, 4],
    r: hex("#7a2a3a"),
  };
}

interface FormaGrilla {
  rows: readonly string[];
  /** El frenillo (donde llega el hilo) y de dónde sale la cola, en la grilla. */
  frenillo: [number, number];
  cola: [number, number];
}

/** El rombo de siempre: cuatro paños de dos colores, la cruz de guadua y los flecos en las puntas. */
const ROMBO: FormaGrilla = {
  frenillo: [10, 9],
  cola: [10, 24],
  rows: [
    "..........o..........",
    ".........oGo.........",
    "........oAgBo........",
    ".......oAagBbo.......",
    "......oAaagBbbo......",
    ".....oAaaAgBbbbo.....",
    "....oAaaAAgBbbbbo....",
    "...oAaaAAAgBbbbbbo...",
    "..oAaaAAAwgBbbbbbbo..",
    ".oGgggggggkgggggggfo.",
    ".oApbbbbbBgqaaaaaqBo.",
    ".oaopbbbbbgaaaaaqobo.",
    ".oaopbbbbbgaaaaqqobo.",
    "..o.opbbbbgaaaqqo.o..",
    "....opbbbbgaaqqqo....",
    ".....opbbbgaqqqo.....",
    ".....oppbbgaqqqo.....",
    "......opbbgqqqo......",
    "......oppbgqqqo......",
    ".......opbgqqo.......",
    ".......oppgqqo.......",
    "........opgqo........",
    ".........ogo.........",
    ".........ogo.........",
    "..........o..........",
  ],
};

/** La hexagonal: tres palitos cruzados, seis gajos alternados, el borde del otro color y el rosetón. */
const HEXAGONAL: FormaGrilla = {
  frenillo: [10, 11],
  cola: [10, 21],
  rows: [
    "..........o..........",
    ".........oGo.........",
    ".......oobgBoo.......",
    "......obBAgcbbo......",
    "....oobbAAgccbBoo....",
    "...obBAAAAgccccbbo...",
    ".oobbAAAAAgcccccbBoo.",
    "obGgAAAAAAgccccccggbo",
    "obBCggAAAAgccccggabbo",
    "obbCCCggAAgccggaaabbo",
    "obbCCCCCgbBbgaaaaabbo",
    "obbcccccbbkbbaaaaabbo",
    "obbcccccgbpbgqqqqqbbo",
    "obbcccggaagccggqqqbbo",
    "obbcggaaaagccccggqbbo",
    "obggaaaaaagccccccgfbo",
    ".oobbaaaaagcccccbboo.",
    "...obbaaaagccccbbo...",
    "....oobbaagccbboo....",
    "......obbagcbbo......",
    ".......oobgboo.......",
    ".........ogo.........",
    "..........o..........",
  ],
};

/** El pájaro: alas abiertas con la punta levantada y las plumas del otro color, cabeza con pico y cola en abanico. */
const PAJARO: FormaGrilla = {
  frenillo: [15, 6],
  cola: [15, 19],
  rows: [
    "..............ooo..............",
    ".............owbbo.............",
    ".o..........oBebebo..........o.",
    "oAoooo......obbybbo......ooooao",
    "oaAAAAoooo...oBbbo...ooooaaaaao",
    "oaggggAAAAooooBbbooooaaaaffffqo",
    "oqbaaaggggAAAoBbboaaaffffaaapqo",
    ".obabaaaaagggABBbafffaaaaapqpo.",
    "..oqbabaaaaaagBbbfaaaaaapqpqo..",
    "...ooqbabaaaaabBbaaaaapqpqoo...",
    ".....ooqbaaaaabbpaaqqqpqoo.....",
    ".......ooaaaaabBpqqqqqoo.......",
    ".........oooaabbpqqooo.........",
    "............oobbpoo............",
    ".............obbpo.............",
    "............oabapqo............",
    "...........obabapqpo...........",
    "..........oababapqpqo..........",
    ".........obababapqpqpo.........",
    "........oqpqpqpqpqpqpqo........",
    ".........ooooooooooooo.........",
  ],
};

/** El pez: cuerpo de escamas del otro color, ojos, aletas, el espinazo de guadua y la cola en V. */
const PEZ: FormaGrilla = {
  frenillo: [9, 9],
  cola: [9, 28],
  rows: [
    "...................",
    "........ooo........",
    "......oobbboo......",
    ".....obbbrbbbo.....",
    "....obbbbbbbbbo....",
    "....obwbbbbbwbo....",
    "...oAAeaaaaaeaao...",
    "...obbAaaaaaabbo...",
    "...oAAbbagabbaao...",
    "..obAAAabgbaaaabo..",
    ".obAbbAaagaaabbapo.",
    "obbAAAbbagabbaaappo",
    "obboAAAabgbaqqqoppo",
    "oboobbaaagaaqppoopo",
    ".o.oaabbagabpqqo.o.",
    "....oaaabgbaqqo....",
    "....obaaagaaqpo....",
    ".....obbagabpo.....",
    "......oobbboo......",
    "........obo........",
    ".......oaaqo.......",
    "......obbbppo......",
    ".....oaaaoqqqo.....",
    "....obbbo.opppo....",
    "...oaaao...oqqqo...",
    "..obbbo.....opppo..",
    ".oaaaao.....oqqqqo.",
    "obbbbo.......oppppo",
    ".oooo.........oooo.",
  ],
};

const FORMAS: Record<CometaForma, FormaGrilla> = { rombo: ROMBO, hexagonal: HEXAGONAL, pajaro: PAJARO, pez: PEZ };

/** El moñito de trapo de la cola (dos lazos y el nudo), en los tonos de un papel. */
const MONITO = ["4.k.3", "43k32", "3.k.2"];

/** Cuadros de la cola que se mece (la escena los alterna). */
export const COMETA_FRAMES = 4;

/** Cuántos píxeles mide la cola de trapitos con cada largo. */
const COLA_LARGO: Record<1 | 2 | 3, number> = { 1: 14, 2: 24, 3: 34 };

/**
 * La cola: la cabuya que cuelga meciéndose (la fase del cuadro corre por ella como una onda) y un moñito
 * cada seis píxeles, alternando los dos colores.
 */
function pintarCola(L: Lienzo, x0: number, y0: number, largo: number, frame: number, c1: Ramp, c2: Ramp) {
  const fase = (frame / COMETA_FRAMES) * Math.PI * 2;
  const x = (i: number) => Math.round(x0 + Math.sin(i * 0.3 - fase) * Math.min(3.5, i * 0.2));
  for (let i = 1; i <= largo; i++) L.linea(x(i - 1), y0 + i - 1, x(i), y0 + i, i % 2 ? HILO_OSCURO : at(CABUYA, 2));
  for (let i = 4, n = 0; i <= largo; i += 6, n++) L.estampa(x(i) - 2, y0 + i - 1, MONITO, tonos(n % 2 ? c2 : c1, { k: at(CABUYA, 1) }), { luz: false });
}

/** Una cometa de frente, con su cola, pintada en un lienzo con el frenillo en (sx, sy) de pantalla. */
function pintarCometa(L: Lienzo, code: string, sx: number, sy: number, frame: number, cola = true) {
  const p = cometaPartes(code) ?? { forma: "rombo" as const, color1: "r" as const, color2: "a" as const, cola: 2 as const };
  const f = FORMAS[p.forma];
  if (cola) pintarCola(L, sx - f.frenillo[0] + f.cola[0], sy - f.frenillo[1] + f.cola[1], COLA_LARGO[p.cola], frame, PAPEL[p.color1], PAPEL[p.color2]);
  L.estampa(sx - f.frenillo[0], sy - f.frenillo[1], f.rows, leyCometa(p.color1, p.color2));
}

/**
 * La cometa en el cielo: el papel con sus palitos y la cola de trapitos que se mece (`frame`). El origen del
 * sprite es el frenillo, donde llega el hilo. Sirve para las de la gente y las de los NPC.
 */
export function cometaCielo(code: string, frame = 0): Sprite {
  const L = new Lienzo(1, 1, 40, 40);
  pintarCometa(L, code, L.ox, L.oy, frame);
  return L.sprite(false);
}

// ---------- Cometicas de adorno (las del puesto y el tablero) ----------

const MINI_ROMBO = ["...o...", "..oAo..", ".oAgbo.", "oAagbbo", "ogggggo", "obbgaqo", ".obgqo.", "..ogo..", "...o..."];
const MINI_HEXA = ["..ooo..", ".oAgbo.", "oAAgbbo", "ogggggo", "obbgaqo", ".obgqo.", "..ooo.."];

/** Una cometica de adorno colgada de (sx, sy), con su colita de dos moñitos que se mece. */
function cometica(L: Lienzo, sx: number, sy: number, c1: CometaColorLetra, c2: CometaColorLetra, hexa: boolean, f: number, fase: number) {
  const rows = hexa ? MINI_HEXA : MINI_ROMBO;
  const sw = [0, 1, 0, -1][(f + fase) % 4]!;
  L.estampa(sx - 3, sy, rows, leyCometa(c1, c2));
  const by = sy + rows.length;
  L.linea(sx, by - 1, sx + sw, by + 3, HILO_OSCURO);
  L.estampa(sx + sw - 2, by + 2, MONITO, tonos(PAPEL[c1], { k: HILO_OSCURO }), { luz: false });
  L.linea(sx + sw, by + 4, sx - sw, by + 7, HILO_OSCURO);
  L.estampa(sx - sw - 2, by + 6, MONITO, tonos(PAPEL[c2], { k: HILO_OSCURO }), { luz: false });
}

// ---------- Piezas chicas ----------

/** El carrete de cabuya parado: las tapas de madera y la cabuya enrollada. */
const CARRETE = [".ooooo.", "oMMmmmo", "ommmmqo", ".oCcdo.", ".occdo.", ".oCcdo.", "oMmmmqo", ".ooooo."];
const LEY_CARRETE: Ley = { m: [MADERA, 3], M: [MADERA, 4.5], q: [MADERA, 2], c: [CABUYA, 3], C: [CABUYA, 4.5], d: [CABUYA, 1.8] };

/** El tarro del engrudo de yuca con su brocha. */
const TARRO = ["...o..", "..ogo.", ".oogoo", "oWwwWo", "occcco", "occcdo", ".oooo."];
const LEY_TARRO: Ley = { g: [GUADUA, 3], W: [CREMA, 5], w: [CREMA, 4.6], c: [CREMA, 3.4], d: [CREMA, 2.4] };

/** Unos rollos de papel de seda parados en un cajoncito. */
const ROLLOS = [".o.o.o.", "oRoAoZo", "oRoAoZo", "oroaozo", ".o.o.o."];

/** La canasta de mimbre del picnic, con el trapo de cuadros que se asoma. */
const CANASTA = [
  "....ooooo....",
  "...om...mo...",
  "..om.....mo..",
  "ooooRWRWRoooo",
  "oMmMmMmMmMmMo",
  "omMmMmMmMmMqo",
  "oMmMmMmMmMmqo",
  "omMmMmMmMmqqo",
  ".oqmqmqmqmqo.",
  "..ooooooooo..",
];
const LEY_CANASTA: Ley = { m: [MIMBRE, 3], M: [MIMBRE, 4.3], q: [MIMBRE, 2], R: [ROJO, 3], W: [BLANCO, 4] };

/** Un plato con pandeyucas y la jarra de limonada con su vaso. */
const PLATO = [".ooooo.", "oWyYyWo", "owWWWwo", ".ooooo."];
const LEY_PLATO: Ley = { W: [BLANCO, 4.6], w: [BLANCO, 3], y: [AMARILLO, 3], Y: [AMARILLO, 4.4] };
const JARRA = [".oooo..", "ogGGgo.", "oLLlloo", "oLlllo.o", "oLllloo", "oLdllo.", ".oooo.."];
const LEY_JARRA: Ley = { g: alpha(hex("#e8f4fa"), 0.85), G: hex("#ffffff"), L: [LIMONADA, 4.4], l: [LIMONADA, 3.2], d: [LIMONADA, 2.2] };
const VASO = ["ooo", "oLo", "olo", "ooo"];

/** La rueda de radios del carrito, vista de lado. */
const RUEDA = ["..ooo..", ".oMmmo.", "oMk.kqo", "om.k.qo", "omkhkqo", "om.k.qo", "oMk.kqo", ".oqqqo.", "..ooo.."];
const LEY_RUEDA: Ley = { m: [OSCURA, 3], M: [OSCURA, 4.4], q: [OSCURA, 2], k: [OSCURA, 4], h: [METAL, 4] };

/** El bloque de hielo del raspao, con su brillo. */
const BLOQUE_HIELO = ["..oooo..", ".oWWWWo.", "oWWwWWwo", "ocWWwwbo", "occcbbbo", ".occbbo.", "..oooo.."];
const LEY_HIELO: Ley = { W: [HIELO, 4.6], w: hex("#ffffff"), c: [HIELO, 3.2], b: [HIELO, 2.2] };

/** Una botella de melao (mora, mango o maracuyá). */
const BOTELLA = [".oo.", ".ok.", "oRRo", "oRro", "orro", ".oo."];

/** La sombrilla del carrito: ocho gajos naranja y blanco, la punta de madera y los festones. */
const SOMBRILLA = [
  ".........ooo.........",
  ".........oko.........",
  "........oNnno........",
  "......oNWnnwnno......",
  "....oNNWWnnwwnnno....",
  "..oNNNNWWnnwwnnnnno..",
  ".oNNnnWwwnnwwwnnndddo",
  "oNnnnwwwnnnnweenndddo",
  "Nnnnwwwwnnnnweeeddddd",
  ".nn..ww..nn..ee..dd..",
];
const LEY_SOMBRILLA: Ley = { n: [NARANJA, 3], N: [NARANJA, 4.4], d: [NARANJA, 2], w: [BLANCO, 3.4], W: [BLANCO, 4.6], e: [BLANCO, 2.2], k: [MADERA, 4] };

/** La escarapela azul del premio, con sus dos cintas. */
const ESCARAPELA = [".ooo.", "oZzZo", "ozWzo", "oZzzo", ".ooo.", ".oZo.", "oz.zo", "oo.oo"];
const LEY_ESCARAPELA: Ley = { z: [AZUL, 3], Z: [AZUL, 4.4], W: [AMARILLO, 4.6] };

/** El banderín triangular de papel (dos cuadros: quieto y movido por el viento). */
const BANDERIN = [["o4o", "o3o", "o3o", ".2o", ".o."], ["o4o", "o3o", ".o3o", ".o2o", "..o."]];

// ---------- Letreros pintados a mano ----------

/** Letras de 3x5 para los letreros chicos (las de 5x7 no caben en una tabla de un tile). */
const LETRA: Record<string, readonly string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  C: [".##", "#..", "#..", "#..", ".##"],
  N: ["##.", "#.#", "#.#", "#.#", "#.#"],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  E: ["###", "#..", "##.", "#..", "###"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
};

/**
 * Un letrero sobre una cara que corre a lo largo de x: cada letra derecha (sesgada, en 3x5 no se lee) y de
 * su color, con su sombrita; la siguiente baja medio píxel por cada uno que avanza, en escalera.
 */
function letrero(L: Lienzo, sx: number, sy: number, text: string, cols: RGBA[], sombra: RGBA) {
  [...text].forEach((ch, n) => {
    const g = LETRA[ch];
    if (!g) return;
    const x = Math.round(sx + n * 4);
    const y = Math.round(sy + n * 2);
    const col = cols[n % cols.length]!;
    for (let gy = 0; gy < 5; gy++)
      for (let gx = 0; gx < 3; gx++)
        if (g[gy]![gx] === "#") {
          L.set(x + gx + 1, y + gy + 1, sombra);
          L.set(x + gx, y + gy, gy === 0 ? mix(col, hex("#fffaf0"), 0.3) : col);
        }
  });
}

// ---------- La mesa del taller ----------

/** La mesa de tablas sobre caballetes, con lo que se necesita para armar una cometa. */
function tallerCometas(): Sprite {
  const L = new Lienzo(2, 1, 44);
  L.sombra(1, 1, 30, 14, 0.26);
  // Los caballetes: dos patas abiertas en cada punta, con el travesaño.
  for (const x of [4, 26]) {
    for (const y of [2.5, 12.5]) L.bloque(x, y, 0, 1.6, 1.4, 11, OSCURA, 0.4);
    L.bloque(x, 3.4, 4, 1.4, 9.4, 1.2, OSCURA, 0.2);
  }
  // El tablero: tablas a lo largo con veta, el canto claro adelante.
  L.caja(1, 1, 11, 30, 14, 2, tablas(MADERA, 3.6, 4, 7), (_u, v) => at(MADERA, v > 1.1 ? 4 : 3), (_u, v) => at(MADERA, v > 1.1 ? 2.6 : 2));
  const z = 13.05;
  // Los pliegos de papel de seda apilados, cada uno corrido un poquito, con el de encima de rojo.
  [AZUL, VERDE, AMARILLO, ROSADO, ROJO].forEach((R, i) => {
    const x = 3 + i * 0.6;
    const y = 2.5 + i * 0.4;
    L.caja(x, y, z + i * 0.45, 9, 7, 0.45, (u, v) => at(R, u < 1 || v < 1 ? 4.4 : (Math.floor(u + v * 0.7) % 5 === 0 ? 3.6 : 3.2)), () => at(R, 2), () => at(R, 1.6));
  });
  // La cometa a medio armar, acostada: la cruz de guadua con el papel pegado solo arriba.
  const ley = leyCometa("r", "a");
  L.plano([15, 2, z], [1, 0, 0], [0, 1, 0], 13, 12, (u, v) => {
    const row = MEDIA_COMETA[Math.floor(v)];
    const ch = row?.[Math.floor(u)];
    if (!ch || ch === ".") return null;
    if (ch === "o") return at(OSCURA, 2);
    const m = ley[ch];
    return m ? (Array.isArray(m[0]) ? at(m[0] as Ramp, m[1] as number) : (m as RGBA)) : null;
  });
  // Los palitos de guadua sueltos, uno al lado del otro.
  for (let k = 0; k < 4; k++) L.caja(4 + k * 0.2, 10.4 + k * 1.1, z, 10, 0.7, 0.6, (u) => at(GUADUA, u % 5 < 0.6 ? 2 : 4), () => at(GUADUA, 3), () => at(GUADUA, 2));
  // El tarro del engrudo y el carrete de cabuya, en la esquina de adelante.
  const t = L.p(27, 5, z);
  L.estampa(t.x - 3, t.y - 6, TARRO, LEY_TARRO);
  const c = L.p(28, 11, z);
  L.estampa(c.x - 3, c.y - 7, CARRETE, LEY_CARRETE);
  // El letrerito del taller, clavado en un palo detrás de la mesa.
  for (const x of [3, 28]) L.poste(x, 1, 0, 30, [OSCURA], 2);
  L.caja(2, 0.2, 22, 28, 0.8, 8, null, tablas(CREMA, 2.6, 4.2, 5), () => at(CREMA, 2.4));
  const s = L.p(4, 1, 28.5);
  letrero(L, s.x, s.y, "TALLER", [at(ROJO, 3), at(AZUL, 3), at(VERDE, 2), at(NARANJA, 2), at(MORADO, 3), at(ROJO, 2)], at(CREMA, 2));
  return L.sprite();
}

/** La cometa que se está armando en la mesa: arriba ya tiene papel, abajo todavía es la cruz pelada. */
const MEDIA_COMETA = [
  "......o......",
  ".....oAo.....",
  "....oAagbo...",
  "...oAaagbbo..",
  "..oAaaagbbbo.",
  ".oAaaaagbbbbo",
  "ggggggggggggg",
  "......g......",
  "......g......",
  "......g......",
  "......g......",
  "......g......",
];

// ---------- El puesto de cometas ----------

/** El toldo a rayas azules y amarillas con su festón, inclinado hacia adelante. */
const toldo: Pinta = (u, v) => {
  const raya = Math.floor(u / 4) % 2;
  const R = raya ? AMARILLO : AZUL;
  // La lona se templa en el medio de cada raya y se arruga en las costuras.
  const costura = u % 4 < 0.7;
  return at(R, costura ? 2.6 : v < 1.2 ? 4.4 : 3.4);
};

function puestoCometas(f = 0): Sprite {
  const L = new Lienzo(2, 1, 64);
  L.sombra(1, 1, 30, 15, 0.24);
  // Los cuatro postes: los de atrás más altos para que el toldo caiga hacia adelante.
  for (const [x, y, h] of [[2, 2, 40], [29, 2, 40], [2, 14, 34], [29, 14, 34]] as const) L.poste(x, y, 0, h, [OSCURA], 3);
  // La repisa de atrás con las cometas que cuelgan del travesaño.
  L.bloque(2, 1.4, 30, 28, 1.2, 1.4, OSCURA, 0.3);
  ([["r", "a", false], ["z", "b", true], ["v", "n", false], ["m", "s", true]] as const).forEach(([c1, c2, hx], i) => {
    const a = L.p(6 + i * 7, 2, 30);
    L.linea(a.x, a.y, a.x, a.y + 2, HILO_OSCURO);
    cometica(L, a.x, a.y + 2, c1, c2, hx, f, i);
  });
  // El mostrador: tablas paradas con el letrero pintado y la tabla de encima.
  L.caja(2, 8, 0, 28, 6, 12, tablas(MADERA, 6, 4.2, 9), (u, v) => {
    if (v > 10.8) return at(MADERA, 4);
    if (v > 2.6 && v < 9.4 && u > 0.6 && u < 27.4) return at(CREMA, v > 8.6 ? 3.4 : u < 1.4 ? 4.8 : 4.4);
    const tabla = Math.floor(u / 3.2);
    return at(MADERA, u - tabla * 3.2 < 0.6 ? 1.6 : tabla % 2 ? 3 : 3.4);
  }, (_u, v) => at(MADERA, v > 10.8 ? 2.8 : 2));
  const s = L.p(3.2, 14, 8.6);
  letrero(L, s.x, s.y, "COMETAS", [ROJO, AZUL, NARANJA, VERDE, MORADO, ROJO, AZUL].map((R) => at(R, 2)), at(CREMA, 2.6));
  // Los carretes de cabuya sobre el mostrador y unos rollos de papel.
  for (let i = 0; i < 3; i++) {
    const c = L.p(6 + i * 4.4, 10.4, 12);
    L.estampa(c.x - 3, c.y - 7, CARRETE, LEY_CARRETE);
  }
  const r = L.p(22, 10, 12);
  L.estampa(r.x - 3, r.y - 4, ROLLOS, { R: [ROJO, 3.4], A: [AMARILLO, 3.6], Z: [AZUL, 3.4], r: [ROJO, 2], a: [AMARILLO, 2], z: [AZUL, 2] });
  // El travesaño de adelante y el toldo encima.
  L.bloque(1.6, 14.4, 33, 28.8, 1.2, 1.2, OSCURA, 0.3);
  L.plano([1, 1, 41], [1, 0, 0], [0, 1, -0.42], 30.4, 15.2, toldo);
  // El festón del toldo: la lona que cae en ondas adelante.
  L.plano([1, 16.2, 34.6], [1, 0, 0], [0, 0, 1], 30.4, 3, (u, v) => {
    const onda = 1.2 + Math.abs(Math.sin((u / 4) * Math.PI)) * 1.6;
    if (v < 3 - onda) return null;
    return toldo(u, 0.5);
  });
  return L.sprite();
}

// ---------- El carrito del raspao ----------

function carritoRaspao(): Sprite {
  const L = new Lienzo(1, 1, 64, 30);
  L.sombra(1, 2, 14, 12, 0.24);
  // Las patas de atrás y la manija para empujarlo.
  L.bloque(2, 3, 0, 1.2, 1.2, 5, OSCURA, 0.2);
  L.bloque(2, 11.5, 0, 1.2, 1.2, 5, OSCURA, 0.2);
  const h0 = L.p(1, 4, 12);
  const h1 = L.p(-3, 4, 15);
  L.linea(h0.x, h0.y, h1.x, h1.y, at(OSCURA, 3));
  L.linea(h0.x, h0.y + 1, h1.x, h1.y + 1, at(OSCURA, 2));
  // La caja, pintada de verde con la franja roja y el raspao pintado en la cara de adelante.
  L.caja(2, 3, 5, 12, 10, 10, (u, v) => at(BLANCO, u < 0.8 || v > 9.2 ? 5 : 4), (u, v) => {
    if (v > 3.6 && v < 5.6) return at(ROJO, v > 5 ? 4 : 3);
    if (v > 9.2) return at(VERDE, 4);
    return at(VERDE, u < 0.8 ? 3.6 : Math.floor(u) % 3 === 0 ? 2.6 : 3);
  }, (_u, v) => (v > 3.6 && v < 5.6 ? at(ROJO, 2) : at(VERDE, v > 9.2 ? 3 : 2)));
  const cara = L.p(5, 13, 13);
  L.estampa(cara.x, cara.y - 2, VASO_PINTADO, { x: [HIELO, 4.6], m: [ROSADO, 2], c: [AMARILLO, 4], C: [BLANCO, 4.6] });
  // La rueda del lado de afuera.
  const w = L.p(14, 9, 0);
  L.estampa(w.x - 3, w.y - 9, RUEDA, LEY_RUEDA, { luz: false });
  // Encima: el bloque de hielo, las tres botellas de melao y los vasitos apilados.
  const zt = 15;
  const ice = L.p(5, 5, zt);
  L.estampa(ice.x - 4, ice.y - 5, BLOQUE_HIELO, LEY_HIELO);
  ([ROJO, AMARILLO, NARANJA] as const).forEach((R, i) => {
    const b = L.p(10 + (i % 2) * 2, 5 + i * 2.6, zt);
    L.estampa(b.x - 2, b.y - 6, BOTELLA, { R: [R === ROJO ? hexRamp("#8a1f4a") : R, 3.6], r: [R === ROJO ? hexRamp("#8a1f4a") : R, 2.2], k: [BLANCO, 4.4] });
  });
  const v = L.p(5, 11, zt);
  for (let i = 0; i < 3; i++) L.estampa(v.x - 1, v.y - 4 - i * 2, ["ooo", "oCo", "ooo"], { C: [BLANCO, 4.4 - i * 0.4] }, { luz: false });
  // La sombrilla en su palo.
  const top = L.poste(8, 8, zt, 22, [MADERA], 2);
  L.estampa(top.x - 10, top.top - 7, SOMBRILLA, LEY_SOMBRILLA);
  return L.sprite();
}

/** El raspao pintado a mano en la cara del carrito. */
const VASO_PINTADO = ["..ooo..", ".oxmxo.", ".ommmo.", "ooooooo", ".oCcCo.", "..oco..", "...o..."];

// ---------- El tablero del concurso ----------

function tableroCometas(): Sprite {
  const L = new Lienzo(2, 1, 54);
  L.sombra(1, 6, 30, 6, 0.24);
  for (const x of [3, 29]) L.poste(x, 9, 0, 36, [OSCURA], 3);
  // El corcho con su marco.
  L.caja(1.5, 8.6, 12, 29, 0.8, 20, null, (u, v) => {
    if (u < 1.2 || u > 27.8 || v < 1.2 || v > 18.8) return at(MADERA, v > 18.8 || u < 1.2 ? 4 : 3);
    // El corcho: grumitos claros y oscuros en sitios fijos.
    const k = (Math.floor(u) * 7 + Math.floor(v) * 13) % 11;
    return at(C.cork, k === 0 ? 4 : k === 5 ? 2 : 3);
  }, () => at(MADERA, 2));
  // La cabecera de tablas con el letrero pintado de colores.
  L.caja(0.5, 8.4, 32, 31, 1.2, 8, (u) => at(MADERA, u < 1 ? 5 : 4), tablas(CREMA, 4, 4.3, 11), () => at(CREMA, 2.4));
  const t = L.p(1.6, 9.6, 38.4);
  letrero(L, t.x, t.y, "CONCURSO", [at(ROJO, 3), at(AZUL, 3), at(NARANJA, 2), at(VERDE, 2), at(MORADO, 3), at(ROSADO, 2), at(AZUL, 2), at(ROJO, 2)], at(CREMA, 2.2));
  // Las cometicas inscritas, pinchadas con su chinche, y la escarapela del premio.
  const p = (x: number, z: number) => L.p(x, 9.4, z);
  const pinchadas: [number, number, CometaColorLetra, CometaColorLetra, boolean][] = [
    [5, 29, "r", "a", false],
    [12, 30, "z", "b", true],
    [19, 29, "v", "n", false],
    [8.5, 20, "m", "s", true],
    [16, 20, "n", "z", false],
  ];
  for (const [x, z, c1, c2, hx] of pinchadas) {
    const q = p(x, z);
    L.estampa(q.x - 3, q.y, hx ? MINI_HEXA : MINI_ROMBO, leyCometa(c1, c2));
    L.set(q.x, q.y + 1, at(ROJO, 4));
  }
  const e = p(24.5, 27);
  L.estampa(e.x - 2, e.y, ESCARAPELA, LEY_ESCARAPELA);
  // La urna de los votos al pie, con su ranura y la tapa clara.
  L.bloque(20, 10.4, 0, 7, 4.4, 7, MADERA, 0.2);
  const u = L.p(22, 12.6, 7);
  L.linea(u.x, u.y, u.x + 3, u.y + 1, at(OSCURA, 1));
  return L.sprite();
}

// ---------- La manga de viento ----------

/** La manga estirada (mucho viento), en dos cuadros: apunta a la derecha y el aro queda a la izquierda. */
const MANGA_ESTIRADA = [
  [
    ".oo................",
    "omoooooooooo.......",
    "omNNNWWWNNNWoooo...",
    "omnnnwwwnnnWWWNNoo.",
    "omnnnwwwnnnwwwnnNNo",
    "omnnnwwwnnnwwwnnddo",
    "omdddeeedddeeeddoo.",
    "omoooooooooooooo...",
    ".oo................",
  ],
  [
    ".oo................",
    "omoooooooooo...oo..",
    "omNNNWWWNNNWoooNNo.",
    "omnnnwwwnnnWWWNNddo",
    "omnnnwwwnnnwwwnndo.",
    "omnnnwwwnnnwwwddo..",
    "omdddeeedddeeeoo...",
    "omoooooooooooo.....",
    ".oo................",
  ],
];

/** A media asta (viento flojo): sale derecha y se va doblando hacia abajo. */
const MANGA_MEDIA = [
  [
    ".oo............",
    "omoooooooo.....",
    "omNNNWWWNNoo...",
    "omnnnwwwnnNNo..",
    "omnnnwwwnnnnNo.",
    "omdddeeeddnnndo",
    "omoooooooWwwweo",
    ".oo.....oWwwweo",
    "........oNnnndo",
    "........oNnndo.",
    ".........oWweo.",
    "..........oooo.",
  ],
  [
    ".oo............",
    "omoooooooo.....",
    "omNNNWWWNNoo...",
    "omnnnwwwnnNNo..",
    "omnnnwwwnnnnNo.",
    "omdddeeeddnnndo",
    "omoooooooWwwweo",
    ".oo.....oWwwweo",
    "........oNnnndo",
    ".........oNnndo",
    "..........oWweo",
    "...........ooo.",
  ],
];

/** Caída (sin viento): cuelga del aro. */
const MANGA_CAIDA = [
  [
    ".oo.......",
    "omoo......",
    "omNnoo....",
    "omNnnno...",
    "omdNnnno..",
    ".ooWwwweo.",
    "...oWwweo.",
    "...oNnnndo",
    "....oNnndo",
    "....oWweo.",
    ".....oeeo.",
    "......oo..",
  ],
  [
    ".oo.......",
    "omoo......",
    "omNnoo....",
    "omNnnno...",
    "omdNnnno..",
    ".ooWwwweo.",
    "...oWwweo.",
    "..oNnnndo.",
    "..oNnnndo.",
    "...oWweo..",
    "....oeeo..",
    ".....oo...",
  ],
];
const LEY_MANGA: Ley = { n: [NARANJA, 3.2], N: [NARANJA, 4.4], d: [NARANJA, 2], w: [BLANCO, 3.6], W: [BLANCO, 4.8], e: [BLANCO, 2.4], m: [METAL, 4] };

function mangaSola(dir: number, nivel: number, frame: number): Sprite {
  const L = new Lienzo(1, 1, 60);
  L.sombra(6, 6, 4, 4, 0.28);
  // El poste de guadua con sus nudos y la base de piedra.
  L.bloque(6, 6, 0, 4, 4, 2, C.stone, 0.4);
  const top = L.poste(8, 8, 2, 40, [GUADUA, GUADUA, GUADUA, GUADUA, hexRamp("#8a6a24")], 3, 2);
  const rows = (nivel === 2 ? MANGA_ESTIRADA : nivel === 1 ? MANGA_MEDIA : MANGA_CAIDA)[frame % 2]!;
  // En pantalla la manga se va hacia la derecha (+x y -y) o hacia la izquierda (+y y -x).
  const derecha = dir === 0 || dir === 3;
  const w = Math.max(...rows.map((r) => r.length));
  L.estampa(derecha ? top.x + 1 : top.x + 2 - w, top.top - 1, rows, LEY_MANGA, { espejo: !derecha });
  return L.sprite();
}

const MANGAS = mismoLienzo([0, 1, 2, 3].flatMap((dir) => [0, 1, 2].flatMap((nivel) => [0, 1].map((frame) => mangaSola(dir, nivel, frame)))));

/**
 * La manga de viento en su poste: la manga a rayas naranja y blanco sale hacia `dir` (0 = +x, 1 = +y,
 * 2 = -x, 3 = -y) y se estira según el viento (`nivel` 0 = caída, 1 = a media asta, 2 = estirada); `frame`
 * la hace ondear. Todas las variantes tienen el mismo lienzo y el mismo origen (la escena las cambia).
 */
export function mangaViento(dir = 0, nivel = 1, frame = 0): Sprite {
  return MANGAS[(((dir % 4) + 4) % 4) * 6 + Math.max(0, Math.min(2, nivel)) * 2 + (frame % 2)]!;
}

// ---------- Banderines ----------

/** Un palo de guadua con un cometín en la punta y tres cuerdas de banderines que bajan a sus estacas. */
function banderines(f = 0): Sprite {
  const L = new Lienzo(1, 1, 60, 34);
  L.sombra(6, 6, 4, 4, 0.28);
  const top = L.poste(8, 8, 0, 44, [GUADUA, GUADUA, GUADUA, hexRamp("#8a6a24")], 3, 3);
  const cols = [ROJO, AMARILLO, AZUL, VERDE, ROSADO, NARANJA, MORADO];
  const destinos: [number, number][] = [[20, 8], [8, 20], [-4, 8]];
  destinos.forEach(([x, y], k) => {
    const e = L.p(x, y, 0);
    L.estampa(e.x - 1, e.y - 4, ["o", "m", "m", "m"].map((r) => r), { m: [MADERA, 3] }, { luz: false });
    const a = { x: top.x + 1, y: top.top + 3 };
    const b = { x: e.x, y: e.y - 4 };
    cuerdaPx(L, a, b, (t) => Math.sin(t * Math.PI) * 4, HILO);
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      const x0 = Math.round(a.x + (b.x - a.x) * t);
      const y0 = Math.round(a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * 4);
      const g = BANDERIN[(f + i + k) % 2]!;
      L.estampa(x0 - 1, y0, g, tonos(cols[(i + k * 3) % cols.length]!), { luz: false });
    }
  });
  // El cometín de la punta.
  L.estampa(top.x - 2, top.top - 9, MINI_ROMBO, leyCometa("r", "a"));
  return L.sprite();
}

// ---------- Las cometas amarradas ----------

/** Una estaca en el pasto con su cometa volando bajito, el hilo templado en diagonal. */
function cometaAmarrada(code: string, lado: 1 | -1): (f: number) => Sprite {
  return (f) => {
    const L = new Lienzo(1, 1, 80, 40);
    L.sombra(6, 6, 4, 4, 0.24);
    const s = L.p(8, 8, 0);
    L.estampa(s.x - 1, s.y - 6, ["oo", "mq", "mq", "mq", "mq", "oo"], { m: [MADERA, 3.4], q: [MADERA, 2] }, { luz: false });
    const bob = [0, -1, -2, -1][f % 4]!;
    const kx = s.x + lado * 22;
    const ky = s.y - 58 + bob;
    cuerdaPx(L, { x: s.x, y: s.y - 5 }, { x: kx, y: ky }, (t) => Math.sin(t * Math.PI) * 5, HILO);
    pintarCometa(L, code, kx, ky, f);
    return L.sprite();
  };
}

// ---------- El mantel del picnic ----------

/** El mantel de cuadros (rojo y crema, tejido de verdad), con sus dobleces y los flecos. */
const mantel: Pinta = (u, v) => {
  const ru = Math.floor(u / 4) % 2 === 0;
  const rv = Math.floor(v / 4) % 2 === 0;
  // Donde se cruzan dos franjas rojas el rojo es pleno; donde se cruza con crema, rosado; crema con crema, crema.
  let c: RGBA = ru && rv ? at(ROJO, 2.6) : ru || rv ? mix(at(ROJO, 3), at(BLANCO, 4), 0.45) : at(BLANCO, 4.4);
  // Los dobleces de cuando venía doblado.
  if (Math.abs(u - 22) < 0.6 || Math.abs(v - 14) < 0.6) c = mix(c, hex("#ffffff"), 0.18);
  if (Math.abs(u - 23) < 0.6 || Math.abs(v - 15) < 0.6) c = mix(c, OUT, 0.08);
  // Los flecos de la orilla.
  if (u < 1 || v > 27) return Math.floor(u + v) % 2 ? at(BLANCO, 4) : null;
  return c;
};

function mantelPicnic(): Sprite {
  const L = new Lienzo(3, 2, 26);
  L.plano([2, 2, 0.2], [1, 0, 0], [0, 1, 0], 44, 28, mantel);
  // La canasta atrás en el medio, los platos con pandeyucas junto a cada puesto y la limonada.
  const k = L.p(24, 6, 0);
  L.estampa(k.x - 6, k.y - 9, CANASTA, LEY_CANASTA);
  for (const [x, y] of [[13, 12], [35, 12], [24, 19]] as const) {
    const p = L.p(x, y, 0);
    L.estampa(p.x - 3, p.y - 2, PLATO, LEY_PLATO);
  }
  const j = L.p(38, 24, 0);
  L.estampa(j.x - 3, j.y - 7, JARRA, LEY_JARRA);
  for (const [x, y] of [[34, 26], [10, 22]] as const) {
    const p = L.p(x, y, 0);
    L.estampa(p.x - 1, p.y - 4, VASO, { L: [LIMONADA, 4.2], l: [LIMONADA, 3] });
  }
  return L.sprite();
}

// ---------- El árbol con la cometa y la escalera del garaje ----------

/** La cometa de Mateo enredada en las ramas: torcida, con una punta rota y la cabuya en bucles. */
const ENREDADA = [
  "........oo.....",
  "......ooAAo....",
  "....ooAAaago...",
  "..ooAAaaagbbo..",
  ".oggggaagbbbbo.",
  "..obbbggggbbqo.",
  "...obbbbgaggggo",
  "....obbbgaaqo..",
  ".....obbgaqo...",
  "......obgqo....",
  ".......ogo.....",
];

/** El roble con (o sin) la cometa de Mateo enredada en la copa. */
function arbolSolo(conCometa: boolean): Sprite {
  const base = NATURE_DRAW["oak-1"]!();
  const L = new Lienzo(1, 1, base.oy, 40);
  // El roble tal cual, con su origen sobre el del lienzo.
  for (let y = 0; y < base.canvas.height; y++)
    for (let x = 0; x < base.canvas.width; x++) {
      const i = (y * base.canvas.width + x) * 4;
      const a = base.canvas.data[i + 3]!;
      if (a) L.set(L.ox - base.ox + x, L.oy - base.oy + y, [base.canvas.data[i]!, base.canvas.data[i + 1]!, base.canvas.data[i + 2]!, a]);
    }
  if (conCometa) {
    const p = cometaPartes(COMETAS_GENTE.mateo)!;
    const x = L.ox + 4;
    const y = L.oy - 40;
    L.estampa(x, y, ENREDADA, leyCometa(p.color1, p.color2));
    // La cabuya que quedó colgando en bucles hasta abajo, con un moñito de la cola.
    for (let k = 0; k < 18; k++) L.set(x + 8 + Math.round(Math.sin(k * 0.45) * 1.6), y + 11 + k, k % 2 ? HILO_OSCURO : HILO);
    L.estampa(x + 6, y + 22, MONITO, tonos(PAPEL[p.color2], { k: HILO_OSCURO }), { luz: false });
  }
  return L.sprite(false);
}

const ARBOLES = mismoLienzo([arbolSolo(true), arbolSolo(false)]);

/** El roble con (o sin) la cometa de Mateo enredada en la copa (mismo lienzo y origen en las dos). */
export function arbolCometa(conCometa = true): Sprite {
  return ARBOLES[conCometa ? 0 : 1]!;
}

/** La escalera de madera recostada al alero del garaje, con (o sin) la cometa de Santiago arriba. */
function escaleraSola(conCometa: boolean): Sprite {
  const L = new Lienzo(1, 1, 70, 30);
  L.sombra(4, 2, 8, 12, 0.2);
  // Los dos largueros, del pie (adelante) al alero (atrás y arriba): el canto claro y el oscuro.
  const pie = (x: number) => L.p(x, 13, 0);
  const tope = (x: number) => L.p(x, -3, 50);
  for (const [x, luz] of [[5, 0.6], [11, 0]] as const) {
    const a = pie(x);
    const b = tope(x);
    L.linea(a.x, a.y, b.x, b.y, at(MADERA, 4 + luz));
    L.linea(a.x + 1, a.y, b.x + 1, b.y, at(MADERA, 2.4 + luz));
  }
  // Los peldaños, con su cara de arriba clara.
  for (let k = 1; k < 10; k++) {
    const t = k / 10;
    const a = L.p(5, 13 - 16 * t, 50 * t);
    const b = L.p(11, 13 - 16 * t, 50 * t);
    L.linea(a.x + 1, a.y, b.x, b.y, at(MADERA, 4.5));
    L.linea(a.x + 1, a.y + 1, b.x, b.y + 1, at(MADERA, 2.6));
  }
  if (conCometa) {
    const t = tope(8);
    pintarCometa(L, COMETAS_GENTE.santiago, t.x + 3, t.y - 6, 1, false);
    // La cola enredada que cuelga junto a la escalera.
    pintarCola(L, t.x + 3, t.y + 14, 22, 1, PAPEL.z, PAPEL.b);
  }
  return L.sprite();
}

const ESCALERAS = mismoLienzo([escaleraSola(true), escaleraSola(false)]);

/** La escalera recostada al garaje con (o sin) la cometa de Santiago (mismo lienzo y origen en las dos). */
export function escaleraGaraje(conCometa = true): Sprite {
  return ESCALERAS[conCometa ? 0 : 1]!;
}

// ---------- Los cuadros y el catálogo ----------

const CUADROS = 4;

/** Lo que se mueve y cuántos cuadros tiene (el navegador los pasa en bucle con `cometasDecorSprite`). */
export const COMETAS_DECOR_FRAMES: Record<string, number> = {
  "puesto-cometas": CUADROS,
  "banderines-cometas": CUADROS,
  "cometa-amarrada": CUADROS,
  "cometa-amarrada-2": CUADROS,
  "cometa-amarrada-3": CUADROS,
};

const DIBUJO: Record<string, (f: number) => Sprite> = {
  "taller-cometas": () => tallerCometas(),
  "puesto-cometas": puestoCometas,
  "carrito-raspao": () => carritoRaspao(),
  "tablero-cometas": () => tableroCometas(),
  "manga-viento": () => mangaViento(0, 1, 0),
  "banderines-cometas": banderines,
  "cometa-amarrada": cometaAmarrada("hzb1", 1),
  "cometa-amarrada-2": cometaAmarrada("pva2", -1),
  "cometa-amarrada-3": cometaAmarrada("zmn3", 1),
  "mantel-picnic": () => mantelPicnic(),
  "arbol-cometa": () => arbolCometa(true),
  "escalera-garaje": () => escaleraGaraje(true),
};

const cuadros = new Map<string, Sprite[]>();

/**
 * El cuadro `f` de un mueble del festival. Todos los cuadros de un mueble tienen el mismo lienzo y el mismo
 * origen que el dibujo del catálogo (el cuadro 0): el navegador solo le cambia la textura.
 */
export function cometasDecorSprite(type: string, f = 0): Sprite {
  let list = cuadros.get(type);
  if (!list) {
    const draw = DIBUJO[type];
    if (!draw) throw new Error(`Sin dibujo de cometas: ${type}`);
    const n = COMETAS_DECOR_FRAMES[type] ?? 1;
    list = n > 1 ? mismoLienzo(Array.from({ length: n }, (_, k) => draw(k))) : [draw(0)];
    cuadros.set(type, list);
  }
  return list[((f % list.length) + list.length) % list.length]!;
}

/** Los dibujos del catálogo (van en DRAW de furniture.ts): el cuadro 0 de cada uno. */
export const COMETAS_DRAW: Record<string, () => Sprite> = Object.fromEntries(Object.keys(DIBUJO).map((t) => [t, () => cometasDecorSprite(t, 0)]));
