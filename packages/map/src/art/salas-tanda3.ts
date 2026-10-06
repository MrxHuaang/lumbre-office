// Más muebles de las salas dibujados a mano (docs/estandar-arte.md, VIR-177 tanda 3): la lámpara de pie
// (con su pantalla prendida y apagada), la lámpara hongo, la mesita, la mesa de centro y la mesa de café,
// en grillas de letras. Cada grilla trae dónde queda el origen del mueble y su leyenda; `o` es el contorno
// cálido y `s` la sombra en el piso.
import { C, mix } from "./palette";
import { at, hex, ramp, type RGBA, type Sprite } from "./pixel";
import { edgeOf, gridSprite, groundShadow, rampLegend, type Legend } from "./grilla";

type Grid = { rows: readonly string[]; ox: number; oy: number };
const sprite = (g: Grid, l: Legend): Sprite => gridSprite(g.rows, l, g.ox, g.oy);

/** Latón cálido de los pies y las perillas (0 el más oscuro, 5 el brillo). */
const LATON = ramp("#4a2c12", "#74471c", "#a06a2a", "#c8923c", "#e6ba5e", "#fbe29a");
/** Lino color durazno de la pantalla de la lámpara. */
const LINO = ramp("#7a4c36", "#9c6a4c", "#bb875e", "#d3a574", "#e8c290", "#f8dfb0", "#fff2d6");

// ---------- Lámpara de pie ----------

// La pantalla es de lino plisado (a..f, de la sombra a la luz) con cinta de color ladrillo arriba y abajo
// (T, R, q, Q); por la boca de arriba se ve el forro (i, j), el bombillo (k) y el remate de latón (H, h).
// El pie es una vara de latón (dígitos) con dos anillos torneados y una base redonda.
// <lampara>
const LAMPARA: Grid = {
  ox: 12,
  oy: 37,
  rows: [
    ".......oooooooooo.......",
    ".....ooTTTRRRRRqqoo.....",
    "....oTiiiiiiiiiiiiqo....",
    "...oTiiiijjjjjjiiiiqo...",
    "...oTiiijjjHhjjjiiiqo...",
    "...oTTiijjkHhkjjiiqqo...",
    "...ofeTTjjkkkkjjRqcbo...",
    "...offeeTRRRRRRqccbbo...",
    "..offdeeddcddbcbcbabao..",
    "..offdeeddcddbcbcbabao..",
    "..offdeeddcddbcbcbabao..",
    ".offfdeeddcddbccbbabaao.",
    ".offeeededcddbccbbbaaao.",
    ".offeeededcddbccbbbaaao.",
    "oTffeeededcddbccbbbaaaqo",
    "oRTTeeededcddbccbbbaqqQo",
    ".oRRTTTdedcddbccbqqqQQo.",
    "..ooRRRTTRRRRRRqqQQQoo..",
    "....oooRRRRqqqqQQooo....",
    ".......oooooooooo.......",
    ".........o5431o.........",
    "..........o52o..........",
    "..........o52o..........",
    "..........o52o..........",
    "..........o52o..........",
    "..........o52o..........",
    "..........o52o..........",
    "..........o52o..........",
    ".........o4531o.........",
    "........o455321o........",
    ".........o3321o.........",
    "..........o52o..........",
    "..........o52o..........",
    "..........o52o..........",
    "..........o52o..........",
    "..........o52o..........",
    "..........o52o..........",
    "..........o52o..........",
    "..........o52o..........",
    ".........o4531o.........",
    "......oooo5532oooo......",
    ".....o554455323332o.....",
    "....o45544444333322o....",
    "....o34444444333221o....",
    "....o23333333222110os...",
    ".....oo1111110000oos....",
    ".......oooooooooosss....",
    "........ssssssssss......",
  ],
};
// </lampara>

/** Las letras de la pantalla (lo que cambia al prender y apagar). */
const PANTALLA = new Set([..."abcdefijkHhTRqQ"]);

const lampLegend = (): Legend => ({
  ...rampLegend(LATON),
  ...rampLegend(LINO.slice(1), "abcdef"),
  i: hex("#5a3a30"),
  j: hex("#7a5240"),
  k: at(C.cream, 4),
  H: at(LATON, 4),
  h: at(LATON, 2),
  T: at(C.rug, 4),
  R: at(C.rug, 3),
  q: at(C.rug, 2),
  Q: at(C.rug, 1),
  o: edgeOf(LATON, 0.5),
  s: groundShadow(0.3),
});

/** Lámpara de pie: pantalla de lino plisado con cinta, vara de latón torneada y base redonda. */
export const lampSprite = (): Sprite => sprite(LAMPARA, lampLegend());

/** Solo la pantalla, con otra leyenda, del mismo tamaño y origen que la lámpara (cae justo encima). */
function shadeLayer(l: Legend, tweak?: (col: RGBA, ch: string, y: number) => RGBA): Sprite {
  const rows = LAMPARA.rows.map((r) => r.replace(/./g, (ch) => (PANTALLA.has(ch) ? ch : ".")));
  const s = sprite({ ...LAMPARA, rows }, l);
  if (tweak) rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== "." && s.canvas.set(x, y, tweak(l[ch]!, ch, y))));
  return s;
}

/** Fila donde termina la pantalla (la cinta de abajo): de ahí sale la luz. */
const SHADE_BOTTOM = 18;

/**
 * Prendida: el lino deja pasar la luz y queda dorado, más claro abajo, por donde sale; el forro y el bombillo
 * casi blancos, y la cinta encendida en naranja.
 */
export function lampShadeOn(): Sprite {
  const glow: Legend = {
    a: hex("#e08a3c"),
    b: hex("#eda04a"),
    c: hex("#f6b85c"),
    d: hex("#fccd72"),
    e: hex("#ffde8e"),
    f: hex("#ffecb4"),
    i: hex("#ffd27a"),
    j: hex("#fff0bc"),
    k: hex("#fffcf0"),
    H: hex("#fff0b0"),
    h: hex("#f0b450"),
    T: hex("#f49a5a"),
    R: hex("#e07a44"),
    q: hex("#c45a34"),
    Q: hex("#9c4028"),
  };
  const hot = hex("#fff6dc");
  // La parte de abajo de la pantalla, por donde sale la luz, más blanca.
  return shadeLayer(glow, (col, ch, y) => {
    const k = "abcdef".includes(ch) ? Math.max(0, (y - (SHADE_BOTTOM - 7)) / 7) * 0.45 : 0;
    return k > 0 ? mix(col, hot, k) : col;
  });
}

/** Apagada: el lino más opaco y gris, y la boca oscura; de día también se nota que no da luz. */
export function lampShadeOff(): Sprite {
  const dusk = hex("#4e3e48");
  const night = hex("#20161c");
  return shadeLayer(lampLegend(), (col, ch) => (ch === "k" ? at(C.cream, 2) : mix(col, ch === "i" || ch === "j" ? night : dusk, ch === "i" || ch === "j" ? 0.45 : 0.32)));
}

// ---------- Lámpara hongo ----------

// Sombrero de hongo rosado con pintas de crema (w, W, x), las laminillas que brillan por debajo (g, h, H),
// el pie de crema (N..k) y una rodaja de tronco con anillos (P, p, q), corteza (dígitos), musgo (G, j), la
// luz que cae sobre la madera (Y, y) y un hongito chiquito al lado.
// <hongo>
const HONGO: Grid = {
  ox: 14,
  oy: 15,
  rows: [
    "..........oooooooo..........",
    "........ooffWWeeedoo........",
    "......oeeffWwwxeedwddo......",
    "....odeefffwxeeeeddddcco....",
    "...oddeeffffeeeeeddwwxcco...",
    "..odWweeeffeeeeeddddwxccco..",
    ".ocwwxeeeeeeedddddddccccbbo.",
    ".occxdddeeeeWwwxddcccccbbbo.",
    ".occcdddddddwwxddcccccbxbao.",
    ".obccWxcdddddcccccccbbbbaao.",
    ".oebbxccccccccccbbbbbbaaaco.",
    ".oheebbbccccccbbbbbbaaaccgo.",
    "..ohheebbbcccccbbbbaaccggo..",
    "...oohheeebbccbbbacccggoo...",
    ".....oohHHeeeeeccchggoo.....",
    ".......oooHHHHHhhgooo.......",
    "..........oNNnmmlo..........",
    "........oooNNnmmkooo........",
    "......ooPPoNNnmmkoppoo......",
    ".....oPpqPoNNnmmkopqpPo.....",
    "....oGjpPqYNNnmmlkYqedpo....",
    "....o4GPpqYYYyyyyYqPqn4o....",
    "....o44GPpqPPpPPqpPP211o....",
    "....o4434PPPPPPPP322111o....",
    "....so4434333433222211os....",
    ".....o4344334333222111o.....",
    ".....soo433343332221oos.....",
    "......ssoooo3333ooooss......",
    "........ssssoooossss........",
  ],
};
// </hongo>

/** Rosado del sombrero del hongo (a el más oscuro, f el brillo). */
const SOMBRERO = ramp("#6a2446", "#9c3664", "#c8507e", "#e3749c", "#f49cbb", "#ffcadf");

/** Lámpara hongo: sombrero rosado con pintas, laminillas encendidas y rodaja de tronco con musgo. */
export const lampMushroomSprite = (): Sprite =>
  sprite(HONGO, {
    ...rampLegend(SOMBRERO, "abcdef"),
    ...rampLegend(C.logs),
    w: at(C.cream, 4),
    W: at(C.cream, 5),
    x: hex("#e0b4b8"),
    g: hex("#f0a24c"),
    h: hex("#ffd27a"),
    H: hex("#fff3c8"),
    N: hex("#fff6e2"),
    n: at(C.cream, 4),
    m: at(C.cream, 3),
    l: at(C.cream, 2),
    k: at(C.cream, 1),
    P: hex("#c8945e"),
    p: hex("#a87444"),
    q: hex("#7c5030"),
    Y: hex("#f6c47c"),
    y: hex("#e0a868"),
    G: at(C.sage, 3),
    j: at(C.sage, 4),
    o: edgeOf(C.logs, 0.45),
    s: groundShadow(0.3),
  });

// ---------- Mesita ----------

// Mesita de noche pintada de verde salvia (a..f): tapa de madera con veta y canto claro (dígitos), el
// costado con un tablero enmarcado y el frente con el cajón y su perilla de latón (K, L). Encima, un libro
// azul acostado (F, G, H con las hojas w) y el pocillo de tinto (W, V, v con el café k).
// <mesita>
const MESITA: Grid = {
  ox: 15,
  oy: 16,
  rows: [
    ".............oooo.............",
    "...........oo5G55oo...........",
    ".........oo5GFFGG45oo.........",
    ".......oo5GFFFFFFGG55oo.......",
    ".....oo5GGFFFFFFFFFG455oo.....",
    "...oo544HFFFFFFFFFww44455oo...",
    "..o54443HHHFFFWkWW444444455o..",
    ".o44444433HHHWkkkW3344444444o.",
    ".o4344444433HWWVVv4433444424o.",
    ".o33444444443WWVVv4444334422o.",
    "..o3333444444WWVVv444442222o..",
    "...od33343444444334424222ao...",
    "...oddd3334444444434222ddao...",
    "...oddddd333344442222ddccao...",
    "...oddccddd33334222ddLcccao...",
    "...oddddccddd3322ddcKLccaao...",
    "...oddddddccdddeacccccaacbo...",
    "...oddddddddcddeacccaaczzbo...",
    "...oddddddddeddeacaaczzZZbo...",
    "...oddddddddeddeaaczzZZZZbo...",
    "...oddeeddddeddeczGJZZZZbbo...",
    "...o3cddeeddeddecZFIZZccb3o...",
    "...o22ccddeeeddecZFIccbb11o...",
    "...o2211ccddeddecZccbb2211o...",
    ".sso2211ooccdddeccbboo2211oss.",
    ".ssso21ossooccdebboosso21osss.",
    "...ssoossssso2231osssssooss...",
    ".....ssssssso2211osssssss.....",
    ".......ssssso2211osssss.......",
    ".........ssso2211osss.........",
    "...........ssooooss...........",
    ".............ssss.............",
  ],
};
// </mesita>

/** Mesita de noche: cuerpo verde salvia con cajón, tapa de madera, un libro y el tinto encima. */
export const sideTableSprite = (): Sprite =>
  sprite(MESITA, {
    // La madera un tono más oscura que la rampa, para que la tapa no quede naranja.
    ...rampLegend([at(C.woodDark, 2), ...C.wood.slice(0, 5)]),
    ...rampLegend(C.sage, "abcdef"),
    K: at(C.gold, 4),
    L: at(C.gold, 2),
    F: at(C.fabric, 3),
    G: at(C.fabric, 4),
    H: at(C.fabric, 2),
    w: at(C.cream, 4),
    W: at(C.cream, 5),
    V: at(C.cream, 4),
    v: at(C.cream, 3),
    k: at(C.woodDark, 1),
    I: at(C.rug, 3),
    J: at(C.rug, 4),
    z: at(C.sage, 0),
    Z: mix(at(C.sage, 0), at(C.woodDark, 0), 0.5),
    o: edgeOf(C.wood, 0.55),
    s: groundShadow(0.3),
  });

// ---------- Mesa de centro ----------

// Mesa de centro de nogal (dígitos, con veta), con faldón y patas cuadradas; encima, un camino tejido de
// colores (a..f, con flecos Y, y), el pocillo de tinto (W, V, v, k) y una matica en su
// matera de barro (T, t, R, tierra u, hojas N, n, m).
// <mesa-centro>
const MESA_CENTRO: Grid = {
  ox: 17,
  oy: 10,
  rows: [
    "........o.o.....oo................",
    ".......oNoNo.ooo55oo..............",
    "....o.oNnNnooN544455oo............",
    "...oNoNnmNnmNn44434455oo..........",
    "...onNnmNnmnNm43344444y5ooo.......",
    "....omnNmmNnm3443444ffdWkWWo......",
    "....oouuuuuR44344bccfffWkkWvoo....",
    "..oo54TTttRu344bddceecfWVVVv55oo..",
    ".o5544TTttR444bffdddcbbWVVVv4455o.",
    "o53343TTttR4bccfffdbb44WVVV443335o",
    "o33333444bddddeccbb44443444333322o",
    "o3333333yfffdddbb4444334433332222o",
    ".oo3333333fffbb4444344433332222oo.",
    "..o223333333b444434443333222211o..",
    "..o2112333333343444333322221221o..",
    "..o2111o233333334333322221o2221o..",
    "..o2111ooo23333333322221ooo2221o..",
    "..o2111ossoo2333322221oosso2221o..",
    "..o2111ossssoo233221oosssso2221o..",
    "..soooossssssso2211osssssssoooos..",
    "....sssssssssso2211ossssssssss....",
    "......sssssssso2211ossssssss......",
    "........sssssso2211ossssss........",
    "..........sssso2211ossss..........",
    "............sso2211oss............",
    "..............soooos..............",
    "................ss................",
  ],
};
// </mesa-centro>

/** Mesa de centro de nogal con faldón, camino tejido, el tinto y una matica. */
export const coffeeTableSprite = (): Sprite =>
  sprite(MESA_CENTRO, {
    ...rampLegend(C.woodDark),
    ...rampLegend(C.rug, "abcdef"),
    Y: at(C.cream, 4),
    y: at(C.cream, 2),
    W: at(C.cream, 5),
    V: at(C.cream, 4),
    v: at(C.cream, 3),
    k: at(C.woodDark, 0),
    T: at(C.terracotta, 4),
    t: at(C.terracotta, 3),
    R: at(C.terracotta, 2),
    u: at(C.dirt, 1),
    N: at(C.leaf, 4),
    n: at(C.leaf, 3),
    m: at(C.leaf, 2),
    o: edgeOf(C.woodDark, 0.3),
    s: groundShadow(0.3),
  });

// ---------- Mesa de café ----------

// Mesa redonda de café: tapa de mármol crema con veta (a..f) y canto de latón (dígitos); pie de hierro
// forjado cálido (M..q) con anillo y base redonda; encima, un florero de vidrio azul (A, B, Q) con un clavel.
// <mesa-cafe>
const MESA_CAFE: Grid = {
  ox: 15,
  oy: 17,
  rows: [
    ".............ooo..............",
    "............oRRRo.............",
    "............orRRro............",
    ".........ooooorGoGooo.........",
    ".......oo455ffffG5552oo.......",
    ".....oo55fffffffGffff55oo.....",
    "....o5ceeffeeeeBQQeeee551o....",
    "....o4edceeeeeBBAQeedee41o....",
    "...o4eeeecceceBBAQeeecce44o...",
    "...o4dddddddcdBAAQdddddd41o...",
    "...o44cddddddcdccdddddc411o...",
    "...o443cccccccccccccccc311o...",
    "....o4443ccccccccccc33311o....",
    "....o444433333c3333222311o....",
    ".....oo4433333333332222oo.....",
    ".......oo333333333322oo.......",
    "............oqppmo............",
    ".............oqmo.............",
    ".............oqmo.............",
    "............oqppmo............",
    ".............oqmo.............",
    ".............oqmo.............",
    ".......oooooqpppmmooooo.......",
    "......oqqqqqppppppmmmmMo......",
    ".....oqqqqppppppppmmmmMMo.....",
    ".....opqqqppppppppmmmmMMo.....",
    ".....oMpppppppmmmmmmmMMMos....",
    "......ooMMMMMMMMMMMMMMoos.....",
    "........oooooooooooooosss.....",
    ".........sssssssssssss........",
  ],
};
// </mesa-cafe>

/** Hierro forjado de la mesa de café: café muy oscuro y cálido, con su brillo (q el más claro). */
const HIERRO = ramp("#2a1e18", "#45342a", "#66503f", "#8c725a", "#b39a7e");

/** Mesa de café: tapa redonda de mármol con canto de latón, pie de hierro forjado con base redonda y un clavel en su florero. */
export const cafeTableSprite = (): Sprite =>
  sprite(MESA_CAFE, {
    ...rampLegend(LATON),
    ...rampLegend(ramp("#8a7058", "#b49a7c", "#d6c2a0", "#ecdcbc", "#f8eed6", "#fffaf0"), "abcdef"),
    M: at(HIERRO, 0),
    m: at(HIERRO, 1),
    p: at(HIERRO, 2),
    q: at(HIERRO, 3),
    A: at(C.sky, 1),
    B: at(C.sky, 3),
    Q: at(C.blue, 2),
    G: at(C.leaf, 3),
    r: at(C.rug, 2),
    R: at(C.rug, 3),
    o: edgeOf(HIERRO, 0.3),
    s: groundShadow(0.3),
  });
