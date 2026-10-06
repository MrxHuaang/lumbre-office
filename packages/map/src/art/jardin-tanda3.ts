// Muebles del jardín dibujados a mano en la tanda 3 (docs/estandar-arte.md, VIR-177): el macizo de flores,
// el poste de la cerca, el tronco para sentarse, la banca y la mesa de terraza, en grillas de letras. En
// cada leyenda los dígitos son los tonos del material principal (0 el más oscuro, 5 el más claro), `o` su
// contorno cálido y `s` la sombra en el piso; las demás letras van explicadas en cada pieza. Cada grilla
// trae dónde queda el origen del mueble.
import { C, mix } from "./palette";
import { at, ramp, type Ramp, type Sprite } from "./pixel";
import { edgeOf, gridSprite, groundShadow, rampLegend, type Legend } from "./grilla";
import type { Variant } from "./kit";

type Grid = { rows: readonly string[]; ox: number; oy: number };
const sprite = (g: Grid, l: Legend): Sprite => gridSprite(g.rows, l, g.ox, g.oy);

/** Hierro de los clavos: café muy oscuro y cálido (nada gris frío). */
const IRON = ramp("#2e221c", "#7d6150");
/** Piedra de río tibia, tirada al corcho (la cabaña es cálida). */
const PIEDRA = C.stone.map((c, i) => mix(c, at(C.cork, Math.min(i, 4)), 0.5)) as Ramp;
/** Hoja del macizo: el verde de la paleta tirado al verde hondo, para que las flores resalten. */
const HOJA = C.leaf.map((c, i) => mix(c, at(C.green, i), 0.4)) as Ramp;

// <macizo>
const MACIZO: Grid = {
  ox: 16,
  oy: 9,
  rows: [
    ".........o..oVo.oVo..o..........",
    "........oVooVvooVvo.oVo..o......",
    ".......oVvoovVoovVooVvo.oVo.....",
    ".......ovV33Vq35Vq34vV3oVvo.....",
    "......o3Vq33vq33vq33Vq32vV3o....",
    ".....o33vq322322Y322vq23Vq32o...",
    "....o3422321322YYy332342vq21o...",
    "...o345433334PR3yz312PR12145o...",
    "..o333PR2334RRRr3322RRRr14443o..",
    ".o334RRRr343rRrt1454rRrt113PR5o.",
    "o334WrRrt4432tt245433tt341RRRr3o",
    "o34WYWtt2332224534PR113443rRrt2o",
    "o334x45221PR24553RRRr523Y21tt40o",
    "o34YYy432RRRr4432rRrt43YYy43Y43o",
    "o2eedzW22rRrt33245tt4320yz4dde2o",
    "oedddcYW54tt21Y4543121W450cdddco",
    "odccbbeed3W23YYy43204WYddebccbbo",
    ".obbbedddcYW44yz21W455cdddcbbbo.",
    "..ooodccbbeed3234WYddebccbbooo..",
    ".....obbbedddc3443cdddcbbboss...",
    "......ooodccbbeddebccbbooos.....",
    "........sobbbecdddcbbboss.......",
    "..........ooodbccbbooos.........",
    ".............obbbboss...........",
    "..............oooo..............",
  ],
};
// </macizo>
// <poste>
const POSTE: Grid = {
  ox: 7,
  oy: 12,
  rows: [
    "......oo.......",
    "....oo54oo.....",
    "..oo5wccw3oo...",
    ".o45cc3wcc32o..",
    ".o54cww2wc31o..",
    ".o544wcc2310o..",
    ".o5444432111o..",
    ".o5444321211o..",
    ".o5434321211o..",
    ".o5434321111o..",
    ".o5444321211o..",
    ".o54n4321N11o..",
    ".o5434321211o..",
    ".o4534321111o..",
    ".o5433321211o..",
    ".o5434322111o..",
    ".o5444321211o..",
    ".o5434321111o..",
    ".oM4n4321N11o..",
    ".oMM4432121mo..",
    ".omMm432m111o..",
    "..oMm432m11oss.",
    "..sooM421oossss",
    ".ssssoooossssss",
    ".ssssssssssssss",
    "..sssssssssssss",
    "....sssssssss..",
  ],
};
// </poste>
// <tronco>
const TRONCO: Grid = {
  ox: 29,
  oy: 7,
  rows: [
    "..............................oooooo......",
    "............................oo44eeddoo....",
    "..........................oo42eeddcd41o...",
    "........................oo42eeddcd41133o..",
    "......................oo42eeddcd41133322o.",
    "....................oo42eeddcb4Mm3343222o.",
    "..................oo42eeddcb3mMM343002233o",
    "................oo42eedddb113334300223330o",
    "..............oo42eedcdd111334o3o22333002o",
    "............oo42eedddb1113343o343o3300211o",
    "..........oo42eedddd1113432202o1o20021211o",
    "........oo42eeddcb11134400222300222120120o",
    "......oo44eeddcdMMm344000223000021201201o.",
    ".....o44edddcdmMMm44000223000021201101oos.",
    "...oooeeddcb4mM134000222200021101211oosss.",
    ".oo222oocd441133220222322022011201oosssss.",
    "o2eeeee2o41133332222333222001201oosssssss.",
    "o2edddde2o33330022333002001200oossssssss..",
    "o2edcccde2o30022333001001110oosssssssss...",
    "o2edcdddce2o22233001111120oossssssssss....",
    "o2ecdbbdce2o222001221120oossssssssss......",
    ".o2ecddbdce2o221220121oosssssssssss.......",
    ".o2edcddcde2o1220122oosssssssssss.........",
    "..o2edcccde2o20212oosssssssssss...........",
    "..o2eddddde2o202oosssssssssss.............",
    "...o2eeeee22o2oosssssssssss...............",
    "....o222222ososssssssssss.................",
    "....ssooooossssssssssss...................",
    "....ssssssssssssssss......................",
    "....ssssssssssss..........................",
  ],
};
// </tronco>
// <banca>
const BANCA: Grid = {
  ox: 30,
  oy: 21,
  rows: [
    "............................oo................",
    "...........................oDDoo..............",
    "..........................oDDDDAo.............",
    "..........................oCDDBAo.............",
    "........................oo55BBBAo.............",
    "......................oo55555BoAo.............",
    "....................oo55555434N4o.............",
    "..................oo555554333ooAo.............",
    "................oo55555433332oBAo.............",
    "..............oo555554333322oBBAo.............",
    "............oo555554333322oo54Noo.............",
    "..........oo555554333322oo5433oAo.............",
    "........oo555554333322oo543333oAo.............",
    "..oooo.o555554333322oo5433332oBAoo............",
    ".oDDDDo55554333322oo5433332ooBBA54oo..........",
    ".oDDDDo554333322oo5433332ooCoB54o444oo........",
    ".oCBBAo4333322oo5433332oo.oo5444N40054oo......",
    "o555BAo33322oo5433332oo.oo544334005o4444oo....",
    "o334Noo322oo5433332oo.oo54433400544N440054oo..",
    "o333oAo2oo5433332oo.oo54433400544444054o4444o.",
    "o333BAoo5433332oo.oo5443340054444400544N44444o",
    "o332BAo433332oo.oo544334005444440054444444421o",
    ".oooBAo3332oo.oo5443340054444400543344444211o.",
    "o334Noo32oo.oo5444340054444400543344444211oo..",
    "o333oAooo.oo5444440054334400543344444211ooAo..",
    "o333oAo.oo5444440054334400543344444211ooBBAo..",
    ".o3oBAoo5444440054334400543344444211ooCBBBAo..",
    "..oBBA5444440054334400544444444211oosoCBBBAo..",
    "..oo54o4440054334400544444444211oosssoCBBBAo..",
    ".o3444N40054334400544444444211oosssssoCBBBAo..",
    ".o33340054o44400544444444211oossssssssoBBoo...",
    ".o22333444N400544444444211oosssssssssssooss...",
    "..oo2233340054o444444211oossssssssssssssss....",
    ".oCBoo22333444N4444211oosssssssssssssssss.....",
    ".oCBBBoo223334444211oossssssssssssssssss......",
    ".oCBBBBBoo22333211oosssssssssssssssssss.......",
    ".oCBooBBBBoo2221oossssssssssssssssssss........",
    "..oBBoooBBBBooooAossssssssssssssssss..........",
    "...oosssooBBoCoBAossssssssssssssss............",
    ".....sssssoooCBBAossssssssssssss..............",
    ".....sssssssoCBBAossssssssssss................",
    ".....sssssssoCBBAossssssssss..................",
    "......ssssssoCBBAosssssss.....................",
    "........sssssoooosssss........................",
    "..........ssssssss............................",
  ],
};
// </banca>
// <banca-b>
const BANCA_B: Grid = {
  ox: 31,
  oy: 15,
  rows: [
    ".......................................ooooo..",
    "......................................oDDDDDo.",
    "......................................oDDDDAo.",
    "....................................oo5oBBBAo.",
    "..................................oo55555BBAo.",
    "................................oo5555553NoAo.",
    "..............................oo555555333oBAo.",
    "............................oo55555533332BBAo.",
    "..........................oo555555333322oBBAo.",
    "........................oo555555333322oo5BBAo.",
    "......................oo555555333322oo543NoAo.",
    "....................oo555555333322oo54333oBAo.",
    "...............oo.oo555555333322oo5433332BBAo.",
    "..............oDDo555555333322oo5433332ooBBAo.",
    ".............oDDDDo555333322oo5433332ooCBBBAo.",
    "............ooCBDDo5333322oo5433332oo442BBBAo.",
    "..........oo55CBBAo33322oo5433332oo44221BBBAo.",
    "........oo5o335BBAo322oo5433332oo44221111BBo..",
    "......oo544o333BNoo2oo5433332oo44221111oBAAo..",
    "....oo54444o333BoAoo5433332oo44221111ooCoBBAo.",
    "..oo5444440o332BBAo433332oo44221111oosoCBBBAo.",
    ".o544o44005ooooBBAo3332oo44221111oosssoCBBBAo.",
    "o3444N455o3o335BNoo32oo44221111oosssssoCBBBAo.",
    "o33300544N4o333BBAooo44221111oosssssssoCBBBAo.",
    "o2233344440o333BBAo44221111oossssssssssoBBBo..",
    ".oo22333054oo32BBAo221111oosssssssssssssooos..",
    "...oo22333444ooBBAo1111oossssssssssssssssss...",
    "...oCoo2233344CBBAo11oosssssssssssssssssss....",
    "...oCBBooo2332CBBAooossssssssssssssssssss.....",
    "...oCBBBBooo211BBAosssssssssssssssssssss......",
    "...oCBBBBBBooo1BBoAosssssssssssssssssss.......",
    "...oCBBooBBBBooBAoossssssssssssssssss.........",
    "....oBBBoooBBoCBBAossssssssssssssss...........",
    ".....ooosssoooCBBAossssssssssssss.............",
    "......sssssssoCBBAossssssssssss...............",
    "......sssssssoCBBAossssssssss.................",
    ".......ssssssoCBBAosssssss....................",
    ".........sssssoBBosssss.......................",
    "...........ssssooss...........................",
  ],
};
// </banca-b>
// <mesa>
const MESA: Grid = {
  ox: 13,
  oy: 13,
  rows: [
    "........oo.oo.............",
    ".......oRRoRRoo...........",
    "......oRrRRrRo5ooooo......",
    "....oooGrRgrgo444443oo....",
    "...o55ogGgGggo224oo4o3o...",
    "..o544oTTTTTto44oYYoYo3o..",
    ".o22544otTTtuo4oYyYgGgo3o.",
    ".o44224outtuuo4oWWWWWxo3o.",
    ".o444422oooo4322oWxxxo22o.",
    ".o444444224444442ooo4443o.",
    ".o3444444422444444224431o.",
    ".o3344444444224444442211o.",
    "..o33344444444224443211o..",
    "....o3333224333221111o....",
    "...o31oo3322222111oo21o...",
    "...o31o.oooo321ooo.o21o...",
    "...o31o...so321os..o21o...",
    "...o31osssso321ossso21o...",
    "...o31osssso321ossso21o...",
    "...o31osssso321ossso21os..",
    "..so31osssso321ossso21oss.",
    "..so31osssso321ossso21oss.",
    "..soooosssso321osssooooss.",
    "...sssssssso321ossssssss..",
    "....ssssssso321osssssss...",
    "......ssssso321osssss.....",
    "..........sooooos.........",
  ],
};
// </mesa>

/**
 * Macizo de flores: un cantero redondeado con borde de piedras de río, el montículo de matas y las flores
 * por grupos: lavanda atrás (V..q), geranios rojos en el medio (R..t), caléndulas (Y..z) y margaritas (W, x)
 * adelante, que se desbordan sobre las piedras (b..e).
 */
export const flowerPatchSprite = (): Sprite =>
  sprite(MACIZO, {
    ...rampLegend(HOJA),
    ...rampLegend(PIEDRA, "abcdef"),
    V: at(C.violet, 5),
    v: at(C.violet, 4),
    q: at(C.violet, 3),
    P: mix(at(C.rug, 5), at(C.white, 4), 0.3),
    R: mix(at(C.rug, 4), at(C.fire, 1), 0.45),
    r: mix(at(C.rug, 3), at(C.fire, 1), 0.35),
    t: at(C.rug, 2),
    Y: at(C.fire, 4),
    y: at(C.fire, 3),
    z: at(C.fire, 2),
    W: at(C.white, 4),
    x: at(C.cream, 3),
    o: edgeOf(HOJA, 0.55),
    s: groundShadow(0.28),
  });

/**
 * Poste de la cerca (el de las esquinas): un palo de corteza de la familia de la cerca de palos, más grueso,
 * con la cabeza cortada y sus anillos (w, c), las vetas de la corteza, los clavos donde llegan los travesaños
 * (n con luz, N en sombra) y musgo al pie (M, m). Queda en (10, 10), donde se cruzan las dos líneas de cerca.
 */
export const fencePostSprite = (): Sprite =>
  sprite(POSTE, {
    ...rampLegend(C.logs),
    w: at(C.cork, 4),
    c: at(C.cork, 2),
    N: at(IRON, 1),
    n: at(IRON, 0),
    M: at(C.sage, 4),
    m: at(C.sage, 3),
    o: edgeOf(C.logs, 0.55),
    s: groundShadow(0.25),
  });

/**
 * Tronco para sentarse, a lo largo de y: la corteza en placas con sus grietas (dígitos), una franja de
 * arriba cepillada para sentarse (b..e), la punta cortada con sus anillos y una grieta mirando a la cámara,
 * parches de musgo (M, m) y un nudo de rama cortada.
 */
export const logSeatSprite = (): Sprite =>
  sprite(TRONCO, {
    ...rampLegend(C.logs),
    ...rampLegend(C.cork, "abcde"),
    M: at(C.sage, 4),
    m: at(C.sage, 2),
    o: edgeOf(C.logs, 0.55),
    s: groundShadow(0.28),
  });

/**
 * Banca de jardín: tres listones de asiento con su luz, su veta y las juntas (dígitos), el respaldo de dos
 * tablas y los clavos (N), sobre patas y travesaños de madera oscura (A..D). De espaldas, el respaldo queda
 * hacia la cámara (es otra grilla, no el espejo).
 */
export const benchSprite = (v: Variant): Sprite =>
  sprite(v === "back" ? BANCA_B : BANCA, {
    ...rampLegend(C.wood),
    A: at(C.woodDark, 2),
    B: at(C.woodDark, 3),
    C: at(C.woodDark, 4),
    D: at(C.woodDark, 5),
    N: at(IRON, 1),
    o: edgeOf(C.wood, 0.6),
    s: groundShadow(0.28),
  });

/**
 * Mesa redonda de terraza: el tablero de tablas con sus juntas y su canto, tres patas a la vista, y encima
 * una matera de barro con geranios (T..u, R..r, G..g) y un platón de loza con naranjas (W, x, Y, y).
 */
export const patioTableSprite = (): Sprite =>
  sprite(MESA, {
    ...rampLegend(C.wood),
    T: at(C.terracotta, 4),
    t: at(C.terracotta, 3),
    u: at(C.terracotta, 1),
    R: mix(at(C.rug, 4), at(C.fire, 1), 0.45),
    r: mix(at(C.rug, 3), at(C.fire, 1), 0.35),
    G: at(C.leaf, 4),
    g: at(C.leaf, 2),
    W: at(C.white, 4),
    x: at(C.cream, 2),
    Y: at(C.fire, 3),
    y: at(C.fire, 2),
    o: edgeOf(C.wood, 0.6),
    s: groundShadow(0.28),
  });
