// El Año viejo (VIR-170): el brasero de piedra (y su fuego, que la escena pone encima en la quema), la silla
// del muñeco y el muñeco de año viejo en sus cinco etapas (la capa que la escena pone sobre la silla), el
// cartel de los testamentos, el puesto de uvas y maletas, las guirnaldas doradas, el farol de papel
// amarillo, el letrerito de las paradas de la maleta, el costal de aserrín, las luces de colores del cielo
// y la marquita de la parada que sigue. Cálido y de fin de año: madera, piedra, paja, amarillo y dorado.
//
// Pixel art pintado a mano (docs/arte/estandar-arte.md): las piezas son grillas de letras (cada piedra del
// brasero, cada lengua de fuego, cada prenda del muñeco) que reciben la luz de arriba a la izquierda y el
// contorno cálido del material de al lado; lo grande (el tablero del cartel, el mostrador y el toldo del
// puesto) son caras isométricas pintadas píxel a píxel con el lienzo de la decoración del Carnaval. El fuego
// tiene cuadros (`FUEGO_CUADROS`). Coordenadas locales de arte (tile = 16); lo de enfrente mira a +y.
import { apoya, hexRamp, Lienzo, type Ley } from "./carnaval-decor";
import { C, mix } from "./palette";
import { at, hex, PixelCanvas, type RGBA, type Sprite } from "./pixel";

// ---------- Colores ----------

const WOOD = C.wood;
const DARK = C.woodDark;
const PIEDRA = C.stone;
const PIEDRA_CALIDA = hexRamp("#a3917f");
const PIEDRA_FRIA = hexRamp("#8a8790");
const CENIZA = hexRamp("#8c847e");
const CARBON = hexRamp("#4a3a34");
const FUEGO = C.fire;
/** El amarillo del año nuevo (toldo, faroles, guirnaldas, la bufanda). */
const AMARILLO = hexRamp("#f4c22e");
const ORO = C.gold;
const COSTAL = hexRamp("#b8945a");
const CABUYA = hexRamp("#8a6a3e");
const PAJA = hexRamp("#e6c46a");
const JEAN = hexRamp("#4a6a98");
const ROJO = hexRamp("#c0473a");
const CREMA = C.cream;
const CARTON = hexRamp("#ecc9a0");
const CUERO = hexRamp("#7a4a2a");
const MORADO = hexRamp("#7a3a8e");
const VERDE = C.leaf;
const ROSA = hexRamp("#e8578a");

const fijo = (h: string): RGBA => hex(h);

// ---------- El brasero ----------

/** Tres piedras del borde, cada una con su silueta (la luz y el contorno los pone la grilla). */
const PIEDRAS: readonly (readonly string[])[] = [
  [
    "..oooo..", //
    ".ossssoo",
    "osssssso",
    "osssssso",
    ".oooooo.",
  ],
  [
    ".ooooo.", //
    "osssssoo",
    "ossssssso",
    "osssssso",
    ".ooooooo",
  ],
  [
    "..ooo..", //
    ".osssoo",
    "osssssso",
    "osssssso",
    "ossssso.",
    ".ooooo..",
  ],
];

/** La cama del brasero: ceniza, leños quemados y brasas (de noche, las brasas prenden). */
const CAMA = [
  ".......oooooooooooo.......", //
  "....oooccccCccccccccooo....",
  "..ooccccCcccckkkccccCccoo..",
  ".occcCcckkkkkKkkkcceccccco.",
  "occcccekkKkkkkkkkkeEeccCcco",
  "occCcceEekkkkkkKkkkeccccccco",
  "occcccccekkkkkkkkkkcccCccco",
  ".occccCccceeccccCccccccco.",
  "..oocccccccccccccccccoo...",
  "....oooccccccCccccooo....",
  ".......oooooooooooo......",
];

function camaLey(night: boolean): Ley {
  return {
    c: [CENIZA, 2.6],
    C: [CENIZA, 4],
    k: [CARBON, 2.2],
    K: [CARBON, 3.6],
    e: night ? [FUEGO, 2.6] : [FUEGO, 1.2],
    E: night ? [FUEGO, 4.4] : [FUEGO, 2.6],
  };
}

/** Brasero redondo de piedras con su cama de ceniza y brasas (de noche, las brasas brillan). */
function brasero(night: boolean): Sprite {
  const L = new Lienzo(2, 2, 22, 8);
  L.sombra(2, 3, 28, 28, 0.24);
  const rampas = [PIEDRA, PIEDRA_CALIDA, PIEDRA_FRIA];
  // Las piedras del anillo, en dos hiladas, de atrás para adelante (las de adelante tapan la cama).
  const piedras: { x: number; y: number; z: number; k: number }[] = [];
  const N = 16;
  for (const [z, fase] of [
    [0, 0],
    [4.5, 0.5],
  ] as const)
    for (let i = 0; i < N; i++) {
      const a = ((i + fase) / N) * Math.PI * 2;
      piedras.push({ x: 16 + Math.cos(a) * 12, y: 16 + Math.sin(a) * 12, z, k: (i * 7 + (z ? 1 : 0)) % 3 });
    }
  const atras = piedras.filter((p) => p.x + p.y < 32).sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z);
  const adelante = piedras.filter((p) => p.x + p.y >= 32).sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z);
  const piedra = (p: (typeof piedras)[number]) =>
    apoya(L, p.x, p.y, p.z, PIEDRAS[p.k]!, { s: [rampas[p.k]!, p.z ? 3.2 : 2.7] });
  atras.forEach(piedra);
  const q = L.p(16, 16, 4);
  L.estampa(Math.round(q.x) - 13, Math.round(q.y) - 5, CAMA, camaLey(night), { luz: false });
  adelante.forEach(piedra);
  return L.sprite();
}

// ---------- El fuego ----------

/** Cuántos cuadros tiene el fuego (la escena los pasa en bucle). */
export const FUEGO_CUADROS = 4;

const FUEGO_LEY: Ley = {
  r: [FUEGO, 0.6],
  n: [FUEGO, 1.8],
  y: [FUEGO, 3],
  w: [FUEGO, 4],
  W: fijo("#fff6d0"),
  z: [CARBON, 0.8],
  e: [FUEGO, 2.4],
  h: [CARBON, 1.8],
};

/** La base del fuego chico (el corazón amarillo sobre los leños): no cambia entre cuadros. */
const FUEGO_BASE = [
  "..rnyyyrrnyynrn.", //
  "..rnywyrnnyyynn.",
  ".rnyywynnyywyyn.",
  ".rnywwwyyywwyyn.",
  ".rnywwwyywwwyynr",
  "rnyywwwwwwwwyynr",
  "rnyywwWWWwwwyynr",
  "rnnyywwWWwwyynnr",
  ".rnnyyywwyyynnr.",
  "..rrnnnnnnnnrr..",
];

/** Las puntas del fuego chico, una por cuadro: las lenguas suben, se doblan y se cortan. */
const FUEGO_PUNTAS: readonly (readonly string[])[] = [
  [
    "......r.........", //
    "......r....r....",
    ".....rn....r....",
    ".....rn...rn....",
    "....rnn...rnr...",
    "....rny..rnnr...",
    "...rnyn..rnyr...",
    "...rnyyr.rnyn.r.",
  ],
  [
    ".......r........", //
    ".......rn.......",
    "......rnn...r...",
    "......rny...rn..",
    ".....rnyn..rnn..",
    "..r..rnyyr.rnn..",
    "..rn.rnyyn.rnyr.",
    "..rnrnyyyn.rnyr.",
  ],
  [
    "................", //
    ".....r......r...",
    ".....rn.....rn..",
    "....rnn....rnn..",
    "....rny...rnny..",
    "...rnyy...rnyr..",
    ".r.rnyyn..rnyr..",
    ".rnrnyyn.rnyyr..",
  ],
  [
    "........r.......", //
    "...r....rn......",
    "...rn...rn......",
    "...rnn.rnn...r..",
    "..rnny.rnyr..r..",
    "..rnyn.rnyn.rn..",
    "..rnyyrnnyn.rnr.",
    "..rnyyrnyynrnyr.",
  ],
];

/** La silueta del muñeco que se quema: el sombrero, la cabeza, los brazos abiertos y las piernas, con grietas de brasa. */
const SILUETA = [
  ".......hhhhhh.......", //
  ".......hzzzzh.......",
  "....hhhzzzzzzhhh....",
  ".......hzzzzh.......",
  ".......hzezzh.......",
  ".......hzzzeh.......",
  "........hzzh........",
  "hh...hhhzzzzhhh...hh",
  ".hzhhzzzzzzzezzhhzh.",
  "..hzzzzezzzzzzzzzh..",
  "......hzzzzzzzh.....",
  "......hzzezzzzh.....",
  "......hzzzzzezh.....",
  "......hzzzzzzzh.....",
  "......hzzzhzzzh.....",
  "......hzzh.hzzh.....",
  "......hzeh.hzzh.....",
];

/** El fuego grande (con el muñeco adentro): base ancha y lenguas altas que cambian en cada cuadro. */
const FUEGO_GRANDE_BASE = [
  "..r.rnyyyrrnynnyyynr.r..", //
  ".rnrnywyrnnyywyyyynnrnr.",
  ".rnyywynnyywyyywwyyynyn.",
  "rnywwwyyywwyywwwwyyywynr",
  "rnywwwyywwwyywwWwwyywwnr",
  "rnyywwwwwwwwwwWWwwwwyynr",
  "rnyywwWWWwwwwWWWWwwwyynr",
  "rnnyywwWWwwwwwWWwwyyynnr",
  ".rnnyyywwyyyywwwyyynnnr.",
  "..rrnnnnnnnnnnnnnnnnrr..",
];

const FUEGO_GRANDE_PUNTAS: readonly (readonly string[])[] = [
  [
    "........r.......r.......", //
    "........r.......rn......",
    ".......rn......rnn......",
    "...r...rn......rny...r..",
    "...rn..rny....rnyy..rn..",
    "..rnn.rnyy....rnyy..rnr.",
    "..rny.rnyyr..rnyyn.rnyr.",
    ".rnyy.rnywn..rnyyn.rnyr.",
    ".rnyyrnywwn.rnywyyrnyyn.",
    "rnywyrnywwyrrnywwyrnyyyn",
  ],
  [
    ".........r.......r......", //
    "....r....rn......r......",
    "....rn...rnn....rn......",
    "...rnn..rnny....rnn..r..",
    "...rny..rnyy...rnny..rn.",
    "..rnyy.rnyyn...rnyyr.rn.",
    "..rnyyrrnywn..rnyywn.rnr",
    ".rnywyrnywwyr.rnywwnrnyr",
    ".rnywyrnywwyrrnywwyrnyyn",
    "rnywwyrnywwyrnywwwyrnywn",
  ],
  [
    ".......r..........r.....", //
    ".......rn........rn.....",
    "..r...rnn........rn.....",
    "..rn..rny.......rnn.....",
    "..rnn.rnyr..r...rny..r..",
    ".rnny.rnyn..rn.rnyyr.rn.",
    ".rnyy.rnyyrrnn.rnywn.rnr",
    ".rnyyrrnywnrny.rnywnrnyr",
    "rnywyrnywwnrnyrrnywyrnyn",
    "rnywyrnywwyrnyyrnywyrnyn",
  ],
  [
    "..........r.............", //
    "...r......rn.......r....",
    "...rn....rnn.......rn...",
    "...rn....rny......rnn...",
    "..rnnr...rnyr..r..rny...",
    "..rnyn..rnyyn..rn.rnyr..",
    ".rnyyn..rnywn.rnn.rnyr.r",
    ".rnyyr.rnywwnrnny.rnywrn",
    "rnywyrrnywwyrnyyrrnywyrn",
    "rnywyrnywwwyrnyyrnywwyrn",
  ],
];

/**
 * El fuego del brasero (la capa de la quema), cuadro `frame` (0..3), con el mismo origen que el brasero. Con
 * el muñeco, la silueta quemándose adentro y las lenguas altas; sin él, el fuego chico que queda.
 */
export function fuegoBrasero(frame: number, conMuneco: boolean): Sprite {
  const f = ((Math.round(frame) % FUEGO_CUADROS) + FUEGO_CUADROS) % FUEGO_CUADROS;
  const L = new Lienzo(2, 2, conMuneco ? 64 : 34, 8);
  const q = L.p(16, 16, 4);
  const cx = Math.round(q.x);
  const by = Math.round(q.y) + 2;
  const ley = FUEGO_LEY;
  if (conMuneco) {
    // La silueta detrás de las lenguas; las brasas de sus grietas laten con el cuadro.
    L.estampa(cx - 10, by - 33, SILUETA, { ...ley, e: [FUEGO, f % 2 ? 3.4 : 2.2] }, { luz: false });
    L.estampa(cx - 12, by - 20, FUEGO_GRANDE_PUNTAS[f]!, ley, { luz: false });
    L.estampa(cx - 12, by - 10, FUEGO_GRANDE_BASE, ley, { luz: false });
  } else {
    L.estampa(cx - 8, by - 18, FUEGO_PUNTAS[f]!, ley, { luz: false });
    L.estampa(cx - 8, by - 10, FUEGO_BASE, ley, { luz: false });
  }
  // Las chispitas que suben (cada cuadro, un poco más arriba).
  const alto = conMuneco ? 50 : 24;
  [
    [-5, 0],
    [4, 3],
    [-1, 6],
    [7, 9],
  ].forEach(([dx, dy], i) => L.set(cx + dx! + (f % 2 ? 1 : 0), by - alto - ((dy! + f * 3 + i * 2) % 12), at(FUEGO, 4)));
  return L.sprite(false);
}

// ---------- La silla y el muñeco ----------

/** La silla de madera, de frente, con el asiento visto desde arriba y el lado derecho en sombra. */
const SILLA = [
  "...oooooooooooo...", //
  "..oWWWWWWWWWWWWo..",
  "..owwwwwwwwwwwwWo.",
  "..ooooooooooooooo.",
  "...oPo......oPPo..",
  "...oPo......oPPo..",
  "...oPooooooooPPo..",
  "...oPWWWWWWWWPPo..",
  "...oPooooooooPPo..",
  "...oPo......oPPo..",
  "...oPo......oPPo..",
  ".oooooooooooooooo.",
  ".oSSSSSSSSSSSSSSxo",
  ".oSSSSSSSSSSSSSSxo",
  ".oSSSSSSSSSSSSSSxo",
  ".offffffffffffffxo",
  ".ooooooooooooooooo",
  "..oLo........oLoKo",
  "..oLo........oLoKo",
  "..oLo........oLoKo",
  "..oLooooooooooLoKo",
  "..oLttttttttttLoKo",
  "..oLooooooooooLoKo",
  "..oLo........oLoo.",
  "..oLo........oLo..",
  "..ooo........ooo..",
];
const SILLA_LEY: Ley = {
  W: [WOOD, 3.4],
  w: [WOOD, 4.3],
  P: [WOOD, 2.8],
  S: [WOOD, 4],
  f: [WOOD, 2.3],
  x: [DARK, 2.2],
  L: [WOOD, 3],
  K: [DARK, 1.8],
  t: [WOOD, 2.6],
};

/** El costal relleno (la etapa 0, y el cuerpo o la cabeza mientras no tiene prendas), amarrado con cabuya. */
const COSTAL_GRANDE = [
  "....oooo....", //
  "...oyyyyo...",
  "....obbo....",
  "..oobbbboo..",
  ".obbbbbbbbo.",
  "obbbbBbbbbbo",
  "obbbbbbbbBbo",
  "obBbbbbbbbbo",
  "obbbbbbBbbbo",
  "obbbbbbbbbbo",
  ".obbbbbbbbo.",
  "..oooooooo..",
];
const COSTAL_CABEZA = [
  "..oooo..", //
  ".oyyyyo.",
  "..obbo..",
  ".obbbbo.",
  "obbbBbbo",
  "obBbbbbo",
  ".obbbbo.",
  "..oooo..",
];
const COSTAL_LEY: Ley = { b: [COSTAL, 3.2], B: [COSTAL, 1.8], y: [CABUYA, 3] };

/** El pantalón: los muslos sobre el asiento, las piernas colgando, el parche, la paja en el ruedo y los zapatos. */
const PANTALON = [
  ".oooooooooooo.", //
  "ojjjjjjjjjjjjo",
  "ojjjjjJjjjjjjo",
  "ojjjjjJjjjjjjo",
  "ojjjjjJJjjjjjo",
  "oJjjjjJJjjjjJo",
  ".ojjjo..ojjjo.",
  ".ojjjo..ojjjo.",
  ".ojppo..ojjjo.",
  ".ojppo..ojjjo.",
  ".ojjjo..ojjjo.",
  ".ojjjo..ojjjo.",
  ".oJJJo..oJJJo.",
  ".h.h.h..h.hh..",
  "oddddo..oddddo",
  "oddDdo..oddDdo",
  ".oooo....oooo.",
];
const PANTALON_LEY: Ley = { j: [JEAN, 3.2], J: [JEAN, 1.8], p: [ROJO, 3], h: [PAJA, 4], d: [CUERO, 2.6], D: [CUERO, 4.2] };

/** La camisa a cuadros con los brazos colgando, los guantes de costal y la paja en las muñecas. */
const CAMISA = [
  "....oooooooooooo....", //
  "..ooRRrRRkkRRrRRoo..",
  ".oRRrRRrRkkRrRRrRRo.",
  "oRRRroRRrRRrRRorRRRo",
  "orrrrorrrrrrrrorrrro",
  "oRRRroRRrRRrRRorRRRo",
  "oRRrRoRRrRRrRRoRrRRo",
  "orrrrorrrrrrrrorrrro",
  "oRRrRoRRrRRrRRoRrRRo",
  "oRRrRoRRrRRrRRoRrRRo",
  "ogggooRRrRRrRRooggGo",
  "ogGgohhorrrrohhoggGo",
  ".oooo.oooooooo.oooo.",
];
const CAMISA_LEY: Ley = { R: [ROJO, 3.2], r: [ROJO, 1.6], k: [CREMA, 4], g: [COSTAL, 3.2], G: [COSTAL, 1.8], h: [PAJA, 4] };

/** La cara de cartón pintada: ojos, nariz, bigote, cachetes y la sonrisa. */
const CABEZA = [
  "..oooooooo..", //
  ".occcccccco.",
  "occcccccccco",
  "occKcccccKco",
  "occcccnnccco",
  "orcmmmmmmcro",
  "occmcccccmco",
  "occsssssscco",
  ".occcccccco.",
  "..oooooooo..",
];
const CABEZA_LEY: Ley = { c: [CARTON, 3.4], K: fijo("#2a2232"), n: [CARTON, 1.6], m: fijo("#3a2418"), r: fijo("#e0807a"), s: fijo("#9a3a32") };

/** El sombrero de paja con su cinta (en la etapa 4, la cinta amarilla y la flor). */
const SOMBRERO = [
  "......oooooo......", //
  ".....oaaaaaao.....",
  ".....oaaAaaao.....",
  ".....oNNNNNFo.....",
  "..oooaaaaaaaaooo..",
  "ooaaaaaaaaaaaaaaoo",
  ".oooooooooooooooo.",
];

/** La bufanda amarilla del año nuevo, con su punta colgando. */
const BUFANDA = [
  "oyyyyyyyyyyo", //
  ".oyyYyyyyyo.",
  "......oyyo..",
  "......oyYo..",
  ".......oo...",
];

/** Cuántas etapas tiene el muñeco (0: un costal en la silla; 4: listo para la quema). */
export const MUNECO_ETAPAS = 5;

/** Pinta la silla (y el muñeco hasta la etapa `etapa`, o sin muñeco con -1) con las patas en el centro del tile. */
function sillaYMuneco(etapa: number): Sprite {
  const L = new Lienzo(1, 1, 48, 10);
  L.sombra(2, 3, 12, 12, 0.24);
  const q = L.p(8, 8, 0);
  // La esquina de arriba a la izquierda del dibujo (22 de ancho y 42 de alto, las patas en la última fila).
  const x0 = Math.round(q.x) - 11;
  const y0 = Math.round(q.y) + 3 - 42;
  const pon = (rows: readonly string[], ley: Ley, x: number, y: number) => L.estampa(x0 + x, y0 + y, rows, ley);
  pon(SILLA, SILLA_LEY, 2, 16);
  if (etapa < 0) return L.sprite();
  if (etapa === 0) {
    pon(COSTAL_GRANDE, COSTAL_LEY, 5, 19);
    return L.sprite();
  }
  pon(PANTALON, PANTALON_LEY, 4, 25);
  if (etapa === 1) {
    pon(COSTAL_GRANDE, COSTAL_LEY, 5, 14);
    return L.sprite();
  }
  pon(CAMISA, CAMISA_LEY, 1, 13);
  if (etapa === 2) {
    pon(COSTAL_CABEZA, COSTAL_LEY, 7, 6);
    return L.sprite();
  }
  pon(CABEZA, CABEZA_LEY, 5, 4);
  const lista = etapa >= 4;
  pon(SOMBRERO, { a: [PAJA, 3.4], A: [PAJA, 4.6], N: lista ? [AMARILLO, 3.4] : [CUERO, 1.6], F: lista ? [ROSA, 3.6] : [CUERO, 1.6] }, 2, 0);
  if (lista) pon(BUFANDA, { y: [AMARILLO, 3.4], Y: [AMARILLO, 1.8] }, 5, 13);
  return L.sprite();
}

const sillaMuneco = (): Sprite => sillaYMuneco(-1);

/**
 * El muñeco de año viejo sentado en su silla, en la etapa `etapa` (0..4): el costal; el pantalón con las
 * piernas colgando; la camisa a cuadros con los brazos; la cara de cartón con bigote y el sombrero; y la
 * bufanda amarilla con la flor en el sombrero. Mismo origen que la silla (se pone encima de ella).
 */
export function munecoEnSilla(etapa: number): Sprite {
  return sillaYMuneco(Math.max(0, Math.min(MUNECO_ETAPAS - 1, Math.round(etapa))));
}

// ---------- El cartel de los testamentos ----------

/** Los papelitos del tablero (u a lo largo, v de alto, en unidades de arte), cada uno con su tono de papel. */
const PAPELES: readonly [number, number, number, number, number][] = [
  [2, 10.5, 6, 7, 4.6],
  [9.5, 11.5, 5, 6, 4],
  [16, 10, 6, 7.5, 4.6],
  [23, 11, 4, 6.5, 4.2],
  [3, 2, 5, 7, 4.2],
  [10, 1.5, 6, 7, 4.8],
  [18, 2.5, 4.5, 6.5, 4],
];

/** Tablero de tablas en dos postes con papelitos clavados (cada uno un testamento) y su techito. */
function cartel(): Sprite {
  const L = new Lienzo(2, 1, 46);
  L.sombra(1, 7, 30, 6, 0.22);
  L.poste(3, 10, 0, 33, [DARK], 3);
  L.poste(29, 10, 0, 33, [DARK], 3);
  // El tablero: el canto de arriba, la cara del frente (+y) con tablas y papeles, y la punta derecha.
  L.caja(
    2,
    8.6,
    12,
    28,
    1.4,
    20,
    () => at(WOOD, 4.6),
    (u, v) => {
      for (const [u0, v0, w, h, t] of PAPELES) {
        if (u < u0 || u >= u0 + w || v < v0 || v >= v0 + h) continue;
        const du = u - u0;
        const dv = v - v0;
        // La tachuela roja arriba al centro, la sombrita del papel abajo y los renglones de letra.
        if (dv > h - 1.2 && Math.abs(du - w / 2) < 0.6) return at(ROJO, 3.6);
        if (dv < 0.7 || du > w - 0.7) return at(CREMA, t - 1.4);
        // Tres renglones de letra (el último más cortico).
        const renglon = [2, 3.6, 5.2].findIndex((r) => dv >= r && dv < r + 0.8 && dv < h - 1.4);
        if (renglon >= 0 && du > 0.8 && du < w - (renglon === 2 ? 2.4 : 1)) return at(CABUYA, 1.4);
        return at(CREMA, t);
      }
      const tabla = Math.floor(v / 5);
      if (v - tabla * 5 < 0.7) return at(WOOD, 1.6);
      if ((Math.floor(u / 3) + tabla * 2) % 7 === 3 && Math.floor(u) % 3 !== 0) return at(WOOD, 2.6);
      return at(WOOD, v - tabla * 5 > 4.2 ? 3.8 : 3.2);
    },
    () => at(WOOD, 2),
  );
  // El techito de tablas, con su alero.
  L.bloque(1, 6.4, 33, 30, 5.2, 1.6, C.roof, 0.2);
  return L.sprite();
}

// ---------- El puesto de uvas y maletas ----------

const RACIMO = [
  "...gl...", //
  "..ogglo.",
  ".ouUuuo.",
  "ouUuUuuo",
  "ouuuuUuo",
  ".ouUuuo.",
  ".ouuuuo.",
  "..ouuo..",
  "...oo...",
];
const RACIMO_LEY: Ley = { u: [MORADO, 2.8], U: [MORADO, 4.6], g: [CABUYA, 2.4], l: [VERDE, 3.4] };

const BOLSITA = [
  ".lLlL.", //
  "olLlLo",
  "otttto",
  "otyTto",
  "otttTo",
  ".oooo.",
];
const BOLSITA_LEY: Ley = { l: [CUERO, 3.6], L: [CUERO, 2.2], t: [CREMA, 4], T: [CREMA, 2.8], y: [ROJO, 3] };

const MALETA = [
  "...ooo...", //
  "...o.o...",
  "ooooooooo",
  "obbybbybo",
  "obbybbybo",
  "oBBYBBYBo",
  "obbybbybo",
  "ooooooooo",
];
const MALETA_LEY: Ley = { b: [CUERO, 3.4], B: [CUERO, 2], y: [AMARILLO, 3.6], Y: [AMARILLO, 2.4] };

/** El puesto: mostrador de tablas con faldón amarillo, la cesta de racimos, las lentejas, las maletas y el toldo a rayas. */
function puestoUvas(): Sprite {
  const L = new Lienzo(2, 1, 52);
  L.sombra(1, 1, 30, 15, 0.22);
  for (const [x, y, h] of [
    [2, 2, 38],
    [29, 2, 38],
  ] as const)
    L.poste(x, y, 0, h, [DARK], 3);
  // El mostrador: tablas arriba, el faldón amarillo con flecos en el frente y el costado en sombra.
  L.caja(
    3,
    8,
    0,
    26,
    6,
    12,
    (u, v) => (v > 5.2 ? at(WOOD, 4.8) : Math.floor(u / 4) % 2 ? at(WOOD, 4) : at(WOOD, 3.6)),
    (u, v) => {
      if (v > 11.2) return at(WOOD, 4.2);
      if (v > 10.2) return at(WOOD, 2.2);
      if (v < 1.6) return Math.floor(u) % 2 ? at(AMARILLO, 2.2) : at(AMARILLO, 3.2);
      const franja = Math.floor(u / 4.5) % 2;
      const pliegue = u % 4.5 < 0.8 ? -0.9 : 0;
      return franja ? at(AMARILLO, 3.4 + pliegue) : at(CREMA, 4 + pliegue);
    },
    (_u, v) => (v > 10.2 ? at(WOOD, 2.4) : at(AMARILLO, 1.8)),
  );
  // Lo del mostrador: la cesta con los racimos, las bolsitas de lentejas y las maletas apiladas.
  L.bloque(5, 9.4, 12, 10, 4, 1.8, COSTAL, 0.2);
  [7, 10.4, 13.6].forEach((x) => apoya(L, x, 11.4, 13.8, RACIMO, RACIMO_LEY));
  [17.6, 20.4].forEach((x) => apoya(L, x, 11, 12, BOLSITA, BOLSITA_LEY));
  apoya(L, 25.6, 11, 12, MALETA, MALETA_LEY);
  apoya(L, 26, 11.6, 19.6, MALETA, { ...MALETA_LEY, b: [ROJO, 3], B: [ROJO, 1.8] });
  // El toldo a rayas amarillas y crema, inclinado, con el borde de ondas al frente.
  L.plano([1, 1, 40], [1, 0, 0], [0, 1, -0.36], 30.4, 15.2, (u, v) => {
    const franja = Math.floor(u / 3.8) % 2;
    const t = (v < 1 ? 4.6 : 3.4) + (u % 3.8 < 0.7 ? -0.6 : 0);
    return franja ? at(CREMA, t + 0.4) : at(AMARILLO, t);
  });
  for (let x = 1; x < 31.4; x += 0.5) {
    const franja = Math.floor((x - 1) / 3.8) % 2;
    const caida = 1.4 + Math.abs(Math.sin(((x - 1) / 3.8) * Math.PI)) * 1.6;
    for (let z = 0; z < caida; z += 0.5) {
      const p = L.p(x, 16.2, 34.6 - z);
      L.set(p.x, p.y, franja ? at(CREMA, 3.4) : at(AMARILLO, z > caida - 0.6 ? 1.8 : 2.8));
    }
  }
  return L.sprite();
}

// ---------- Guirnaldas, farol, parada de la maleta y costal ----------

/** La estrella dorada de la punta del poste de las guirnaldas. */
const ESTRELLA = [
  "....o....", //
  "...oyo...",
  "oooyYyooo",
  "oyyYYYyyo",
  ".oyyyyyo.",
  "..oyoyo..",
  ".oyo.oyo.",
  ".oo...oo.",
];

/**
 * Las tiras de escarcha que bajan en arcos desde la punta del poste, con campanitas de papel amarillo
 * (de frente: la luz por la izquierda, las tiras de la derecha un tono más oscuras).
 */
const ESCARCHA = [
  "...........oGo..........", //
  ".........ogYgYgo........",
  ".......ogYg.o.gYgo......",
  ".....ogYg...o...gYgo....",
  "....gYg.....o.....gYg...",
  "...gYg......o......gYg..",
  "..oyo.......o.......oyo.",
  "..oYo.......o.......oYo.",
  ".oyyyo......o......oyyyo",
  ".ooooo......o......ooooo",
  "............o...........",
];
const ESCARCHA_LEY: Ley = { g: [ORO, 3.6], G: [ORO, 4.6], Y: [AMARILLO, 4.2], y: [AMARILLO, 3.2] };

function guirnalda(): Sprite {
  const L = new Lienzo(1, 1, 64, 18);
  L.sombra(5.5, 5.5, 5, 5, 0.24);
  L.bloque(6, 6, 0, 4, 4, 2, DARK, 0.3);
  const pt = L.poste(8, 8, 2, 46, [DARK], 3);
  // Dos vueltas de escarcha a distintas alturas y la estrella arriba.
  L.estampa(pt.x - 10, pt.top + 4, ESCARCHA, ESCARCHA_LEY);
  L.estampa(pt.x - 10, pt.top + 16, ESCARCHA, { ...ESCARCHA_LEY, y: [ROSA, 3.4], Y: [ROSA, 4.4] });
  L.estampa(pt.x - 3, pt.top - 7, ESTRELLA, { y: [ORO, 3.6], Y: [ORO, 4.8] });
  return L.sprite();
}

/** El farol de papel amarillo, con sus costillas, la tapa y la borla. */
const FAROL = [
  "...ooo...", //
  "..oTTTo..",
  ".ofFfFfo.",
  "ofFFfFFfo",
  "ofFFfFFfo",
  "okkkkkkko",
  "ofFFfFFfo",
  "ofFFfFFfo",
  ".ofFfFfo.",
  "..oTTTo..",
  "...ooo...",
  "....b....",
  "...bbb...",
  "...b.b...",
];

/** Farol de papel amarillo colgado de su poste (el farol hacia +x), prendido de noche. */
function farolAno(night: boolean): Sprite {
  const L = new Lienzo(1, 1, 50);
  L.sombra(2, 6, 5, 5, 0.26);
  L.bloque(2.4, 6, 0, 4, 4, 2, DARK, 0.3);
  L.poste(4.4, 8, 2, 36, [DARK], 3);
  const a0 = L.p(4.4, 8, 39);
  const a1 = L.p(13, 8, 39);
  L.linea(a0.x, a0.y, a1.x, a1.y, at(DARK, 3.6));
  L.linea(a0.x, a0.y + 1, a1.x, a1.y + 1, at(DARK, 1.8));
  const top = { x: Math.round(a1.x), y: Math.round(a1.y) + 2 };
  L.linea(top.x, top.y - 1, top.x, top.y + 1, at(DARK, 1.4));
  const ley: Ley = night
    ? { F: fijo("#fff2a8"), f: fijo("#ffc94a"), k: fijo("#ff9a2a"), T: [ORO, 3], b: [ROJO, 3.6] }
    : { F: [AMARILLO, 3.8], f: [AMARILLO, 2.6], k: [ORO, 2], T: [ORO, 3.4], b: [ROJO, 3] };
  L.estampa(top.x - 4, top.y + 2, FAROL, ley, { luz: !night });
  return L.sprite();
}

/** El letrero de una parada de la maleta: la tabla con la maleta amarilla pintada y la flechita. */
const LETRERO_PARADA = [
  "oooooooooooo", //
  "owwwwwwwwwwo",
  "owwwoyyowwwo",
  "owwoooooowwo",
  "owwoyyyyowwo",
  "owwoYYYYowwo",
  "owwoooooowwo",
  "owwwwaawwwwo",
  "owwwaaaawwwo",
  "oWWWWWWWWWWo",
  "oooooooooooo",
];

function paradaMaleta(): Sprite {
  const L = new Lienzo(1, 1, 34);
  L.sombra(5.5, 6.5, 5, 5, 0.24);
  const pt = L.poste(8, 9, 0, 20, [DARK], 3);
  L.estampa(pt.x - 5, pt.top - 2, LETRERO_PARADA, { w: [WOOD, 3.8], W: [WOOD, 2.4], y: [AMARILLO, 3.6], Y: [AMARILLO, 2.2], a: [ROJO, 3.4] });
  // La cinta amarilla amarrada al poste.
  L.estampa(pt.x - 1, pt.top + 12, ["oyyo", ".oyo", "..o."], { y: [AMARILLO, 3.8] });
  return L.sprite();
}

/** El costal de aserrín amarrado arriba y el montoncito que se le salió al lado. */
const COSTAL_ASERRIN = [
  ".....oooo.....", //
  "....oyyyyo....",
  ".....obbo.....",
  "...oobbbboo...",
  "..obbbbbbbbo..",
  ".obbbbBbbbbbo.",
  "obbbbbbbbbBbbo",
  "obBbbbbbbbbbbo",
  "obbbbbbBbbbbbo",
  "obbbbbbbbbbBbo",
  "obbBbbbbbbbbbo",
  ".obbbbbbbbbbo.",
  "..oooooooooo..",
];
const MONTONCITO = [
  "...aAa...", //
  ".aAaaaAa.",
  "aaaaAaaaa",
];

function costalAserrin(): Sprite {
  const L = new Lienzo(1, 1, 24);
  L.sombra(3, 4, 10, 9, 0.24);
  apoya(L, 7, 9, 0, COSTAL_ASERRIN, COSTAL_LEY);
  apoya(L, 12, 12, 0, MONTONCITO, { a: [COSTAL, 4.4], A: [COSTAL, 3] }, false);
  return L.sprite();
}

// ---------- Las luces de colores del cielo (sin pólvora) y la marquita de la maleta ----------

/** Los colores de las luces que suben en la quema y en el año nuevo. */
export const LUCES_COLORES = ["#ffd24a", "#ff7aa8", "#8ad0ff", "#9af07a", "#ffffff", "#c8a0ff"] as const;

/** Una lucecita (de 7x7): el centro blanco, el color alrededor y el borde que se desvanece. */
const LUZ = [
  "..aba..", //
  ".abcba.",
  "abcdcba",
  "bcdWdcb",
  "abcdcba",
  ".abcba.",
  "..aba..",
];

/** Una lucecita de un color: la escena las sube, las abre en corona y las apaga despacio. */
export function luzDeColor(color: string): PixelCanvas {
  const base = hex(color);
  const conAlfa = (c: RGBA, a: number): RGBA => [c[0], c[1], c[2], Math.round(255 * a)];
  const ley: Record<string, RGBA> = {
    a: conAlfa(base, 0.22),
    b: conAlfa(base, 0.55),
    c: conAlfa(mix(base, [255, 255, 255, 255], 0.25), 0.9),
    d: mix(base, [255, 255, 255, 255], 0.6),
    W: [255, 255, 255, 255],
  };
  const c = new PixelCanvas(7, 7);
  LUZ.forEach((row, y) => [...row].forEach((ch, x) => ley[ch] && c.set(x, y, ley[ch]!)));
  return c;
}

/** La marquita de la parada que sigue: la maleta amarilla y la flecha hacia abajo. */
const MARCA = [
  "...ooooo...", //
  "...o...o...",
  "ooooooooooo",
  "oyyByyyByyo",
  "oyyByyyByyo",
  "oYYBYYYBYYo",
  "oyyByyyByyo",
  "ooooooooooo",
  "...........",
  "....ooo....",
  "....oyo....",
  "..oooyooo..",
  "...oyyyo...",
  "....oyo....",
  ".....o.....",
];

export function marcaMaleta(): PixelCanvas {
  const L = new Lienzo(1, 1, 20, 2);
  L.estampa(0, 0, MARCA, { y: [AMARILLO, 3.8], Y: [AMARILLO, 2.4], B: [CUERO, 2.4] });
  return L.sprite().canvas;
}

/** Lo que no cambia de noche (va en DRAW de furniture.ts). */
export const ANO_VIEJO_DRAW: Record<string, () => Sprite> = {
  "silla-muneco": sillaMuneco,
  "cartel-testamentos": cartel,
  "puesto-uvas": puestoUvas,
  "guirnalda-ano": guirnalda,
  "parada-maleta": paradaMaleta,
  "costal-aserrin": costalAserrin,
};

/** Lo que se prende de noche (va en OUTDOOR de outdoor.ts). */
export const ANO_VIEJO_NIGHT: Record<string, (night: boolean) => Sprite> = {
  "brasero-piedra": brasero,
  "farol-ano": farolAno,
};

