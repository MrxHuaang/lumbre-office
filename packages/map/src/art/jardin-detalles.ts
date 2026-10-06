// Los detalles del jardín dibujados a mano (docs/arte/estandar-arte.md): hongos, piedras, nenúfares, el tocón,
// la cerca de palos de la granja y los faroles, en grillas de letras. Leyenda común: a..f la piedra (de
// oscura a clara), los dígitos la madera y la corteza, g..j y G el musgo y las hojas, M..q el hierro
// cálido de los faroles (Q su brillo), y..Y..z el vidrio ámbar, `o` el contorno y `s` la sombra en el
// piso. Cada grilla trae dónde queda el origen del mueble. El farol del camino, el farolito y el del muelle
// tienen la luz de noche del catálogo justo en su vidrio.
import { C, mix } from "./palette";
import { alpha, at, ramp, type Sprite } from "./pixel";
import { edgeOf, gridSprite, groundShadow, rampLegend, type Legend } from "./grilla";

type Grid = { rows: readonly string[]; ox: number; oy: number };
const sprite = (g: Grid, l: Legend): Sprite => gridSprite(g.rows, l, g.ox, g.oy);

/** Hierro de los faroles: café muy oscuro y cálido (nada de azul ni gris frío, como la cabaña). */
const IRON = ramp("#1e1612", "#2e221c", "#45332a", "#5e4738", "#7d6150", "#a08470");

const LEGEND: Legend = {
  ...rampLegend(C.stone, "abcdef"),
  ...rampLegend(C.logs),
  g: at(C.sage, 1),
  h: at(C.sage, 2),
  i: at(C.sage, 3),
  j: at(C.sage, 4),
  G: at(C.sage, 5),
  ...rampLegend(IRON, "MmnpqQ"),
  y: at(C.gold, 3),
  Y: at(C.gold, 4),
  z: at(C.gold, 5),
  F: at(C.fire, 4),
  T: at(C.rug, 1),
  t: at(C.rug, 2),
  r: at(C.rug, 3),
  R: at(C.rug, 4),
  W: at(C.white, 4),
  w: at(C.cream, 5),
  x: at(C.cream, 3),
  u: at(C.dirt, 2),
  U: at(C.dirt, 3),
  v: at(C.dirt, 4),
  P: at(C.cork, 2),
  O: at(C.cork, 4),
  k: alpha(at(C.sky, 1), 0.55),
  K: alpha(at(C.sky, 4), 0.8),
  l: at(C.leaf, 2),
  L: at(C.leaf, 4),
  N: mix(at(C.rose, 5), at(C.white, 4), 0.3),
  o: edgeOf(C.logs, 0.6),
  s: groundShadow(0.28),
};

// <hongos>
const HONGOS: Grid = {
  ox: 10,
  oy: 5,
  rows: [
    "...ooooo.............",
    ".ooRRRRRoo...........",
    "oRWWRRRrrro..........",
    "oRWWRrrWrto..........",
    "oRRRrrrWWto.oooo.....",
    "orrrWrrrttooRRRro....",
    "ottttttttToRWRrrro...",
    ".oxxxxxxxooRRrrWto...",
    "...owwxo..otrrrtto...",
    "...owwxo..oTTTTTTo...",
    "...owwoooo.oxxxxo....",
    "...ooovvUUo.owxooo...",
    ".....oUUUuosowovUuo..",
    "..sssouuuuosoooUuuo..",
    "ssssssoxxosssssoxosss",
    "ssssssowxosssssowosss",
    "..ssssoooosssssooos..",
    "........sssss........",
  ],
};
// </hongos>
export const mushroomsSprite = (): Sprite => sprite(HONGOS, LEGEND);

// <piedra-chica>
const PIEDRA_CHICA: Grid = {
  ox: 12,
  oy: 0,
  rows: [
    "..........ooooo.......",
    "........ooefeeboo.....",
    ".......offffeeebbo....",
    "......odeeeeeeccbo....",
    ".....odedcccccccbbo...",
    ".oooooddbcccccccbbo...",
    "odffcoddddcbcccbcbo...",
    "oceccoodccccccbbbaoss.",
    "oacccaooaoaccacaoossss",
    ".ooooossosoooooossssss",
    ".......ssoffcosssssss.",
    "........odccbosssss...",
    ".........oaccao.......",
    "..........oooo........",
  ],
};
// </piedra-chica>
// <piedra-mediana>
const PIEDRA_MEDIANA: Grid = {
  ox: 11,
  oy: 5,
  rows: [
    ".........ooo.............",
    "......oooeeeoooo.........",
    "....ooeffffeeeeboo.......",
    "...odfffeeeeeeeebbo......",
    "..oddeeeeeeeeeceebbo.....",
    ".odeedeeeeeeeeeecbbbo....",
    ".odeddeeeeeeeccccbbbo....",
    ".oddddccccccccccccbbbo...",
    "odddbdcccccaccccccbbbo...",
    "oddddddccccaaccccbbbbo...",
    "oddddddccbcccaccbcbbos...",
    ".oddddcccccccacbbbbaoss..",
    "..odccccccccccbbbbbossss.",
    ".ssoacccaccccacbaoossssss",
    ".sssooooooooooooossssssss",
    "..ssssssssssssssssssssss.",
    "...ssssssssssssssssssss..",
    "....ssssssssssssssssss...",
    "........ssssssssss.......",
  ],
};
// </piedra-mediana>
// <piedra-musgo>
const PIEDRA_MUSGO: Grid = {
  ox: 10,
  oy: 4,
  rows: [
    "........ooo............",
    "......ooeeeooo.........",
    "....ooefjfeeeeoo.......",
    "...odffieihejhebo......",
    "..odeejeGjeiecebbo.....",
    ".odedhheeehegeccbbo....",
    ".oedieegeeecccccbbo....",
    "oddhddccccccccccbbbo...",
    "odddbdccccaaccccbbbo...",
    "odddddccbccaccccbbo....",
    ".oddddccccccacbbbboss..",
    ".oddcccccccccbbbbaosss.",
    ".sooaccaccccacaooosssss",
    ".sssooooooooooossssssss",
    "..ssssssodffcossssssss.",
    "...sssssobeccosssssss..",
    ".....sssoaaccaossss....",
    ".........ooooo.........",
  ],
};
// </piedra-musgo>
// <piedra-plana>
const PIEDRA_PLANA: Grid = {
  ox: 13,
  oy: 0,
  rows: [
    "..........o.o.o...........",
    "........oofofofoo.........",
    "......oofffffffffoo.......",
    "....oofofffffffffofoo.....",
    "...oedeedeeeeeeeeeedeoo...",
    ".ooeeeeeiiideeceeeeeeeeoo.",
    "obcdeedeeiiieeeccdeedeoobo",
    "obccceeeedeedeeeeceeeebbbo",
    ".oocccbeeeeeeeedeedebabbo.",
    "..soocbccedeeeeeeebbbaooss",
    "..sssoocccceodeebabboossss",
    "...ssssooccbcobbbaoosssss.",
    "....sssssoobcobboossssss..",
    "......sssssoosoosssss.....",
    "...........ssssss.........",
  ],
};
// </piedra-plana>
export const smallRockSprite = (): Sprite => sprite(PIEDRA_CHICA, { ...LEGEND, o: edgeOf(C.stone, 0.5) });
export const mediumRockSprite = (): Sprite => sprite(PIEDRA_MEDIANA, { ...LEGEND, o: edgeOf(C.stone, 0.5) });
export const mossyRockSprite = (): Sprite => sprite(PIEDRA_MUSGO, { ...LEGEND, o: edgeOf(C.stone, 0.5) });
export const flatRockSprite = (): Sprite => sprite(PIEDRA_PLANA, { ...LEGEND, o: edgeOf(C.stone, 0.5) });

// <tocon>
const TOCON: Grid = {
  ox: 11,
  oy: 4,
  rows: [
    ".........oooo..........",
    ".......oo2222ooo.......",
    ".....oo255555142o......",
    "....o255455515552o.....",
    "...oi2545455454422o....",
    "...oi2544544554542o....",
    "...o22221144555221o....",
    "...o23222222222201o....",
    ".ooo332iii22ii2201o....",
    "oL33l3232332212201o....",
    "o33L33232332212200oo...",
    ".ool3333233221211033oo.",
    "..ol233333232221102333o",
    "...o3333332vv2211ooooo.",
    "...o323333vvUU21osss...",
    "..o33ooooooUUo23os.....",
    "...oo......owoo3o......",
    "............o..o.......",
  ],
};
// </tocon>
export const stumpSprite = (): Sprite => sprite(TOCON, LEGEND);

// <nenufares>
const NENUFARES: Grid = {
  ox: 14,
  oy: -3,
  rows: [
    "........o.......oooooooo..",
    "....ooooNo.....ohjjjhiiho.",
    "..oohhhWWWoo..ohjjjiiiiiho",
    ".ohjjjNWYxWho.ogjikiiiiigk",
    "ohjjjNWWyWxxho.okkiiihigkk",
    "ogjjiiiikkiigk...KKkkkkkk.",
    ".ogiiiiiikkkkk.o..........",
    "..okggggggkkkoohooo.......",
    "...KKkkkkkkhjjojihho......",
    "..........ohhhiiiihk......",
    "..........ogiiiiihgk......",
    "...........okkggkkkk......",
    "............KKokk.........",
  ],
};
// </nenufares>
export const lilyPadsSprite = (): Sprite => sprite(NENUFARES, { ...LEGEND, o: edgeOf(C.green, 0.5) });

// <cerca-palos>
const CERCA_PALOS: Grid = {
  ox: 10,
  oy: 11,
  rows: [
    "...............ooo..",
    "..............o555o.",
    "..............o4422o",
    "..............o3322o",
    "..............o3311o",
    "..............o3244o",
    ".............oo4P31o",
    "...........oo443112o",
    ".ooo.....oo44311222o",
    "o555o...o44311o3311o",
    "o4422ooo4411ooo3444o",
    "o333333431oooo44P11o",
    "o322222333333333332o",
    "o344311oo4443112221o",
    "o3P11oo443311oo3322o",
    "o3122443111oo.o3322o",
    "o3444311ooo....oooo.",
    "o3P311oo............",
    "o3112o..............",
    "o3222o..............",
    "o3311o..............",
    "o3322o..............",
    "o3322o..............",
    ".oooo...............",
  ],
};
// </cerca-palos>
export const stickFenceSprite = (): Sprite => sprite(CERCA_PALOS, LEGEND);

// <farol>
const FAROL: Grid = {
  ox: 9,
  oy: 42,
  rows: [
    "........oo........",
    ".......opmo.......",
    "......oopmoo......",
    "....ooqpqqmqoo....",
    "..ooqpqqpmqqmqoo..",
    ".oQpqqppqqmmqqmQo.",
    "opQQppqqpmqqmmQQmo",
    ".oppQQppqqmmQQmmo.",
    "..opppQQpmQQmmmo..",
    "..opYYppQQmmyymo..",
    "..opYYYYpmyyyymo..",
    "..opYYYYpmyyyymo..",
    "..opzYYYpmyyyYmo..",
    "..opzzzYpmyYYYmo..",
    "..opzzzzpmYYYYmo..",
    ".opqppzzpmYYmmqmo.",
    "..oppqpppmmmqmmo..",
    "...ooppqpmqmmoo...",
    ".....opppmmpo.....",
    "......oppmmpo.....",
    "......oqpmmpo.....",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqqqqo......",
    ".....opqqqqmo.....",
    "......oppmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqpmmo......",
    "......oqqqqo......",
    ".....opqqqqmo.....",
    "....ooeppmmeoo....",
    "...oeeeqpmmeeeo...",
    "..odeeeepmeeeeco..",
    "..oddbeeeeeeacco..",
    ".sobdbddeeccacaos.",
    ".ssobbddbcccaaoss.",
    "...soobbbcaaoos...",
    ".....soobaoos.....",
    ".......soos.......",
  ],
};
// </farol>
// <farolito>
const FAROLITO: Grid = {
  ox: 8,
  oy: 25,
  rows: [
    ".......oo.......",
    "......opmo......",
    "....ooqpmqoo....",
    "..ooqpqqqqmqoo..",
    ".oQpqqppmmqqmQo.",
    "opQQppqqqqmmQQmo",
    ".oppQQppmmQQmmo.",
    "..opppQQQQmmmo..",
    "..opYnppmmmymo..",
    "..opYnYpmymymo..",
    "..opznYpmymYmo..",
    ".opqppzpmYmmqmo.",
    "..oppqppmmqmmo..",
    "...ooppqqmmoo...",
    ".....o4pmlo.....",
    ".....o43l2o.....",
    ".....oLl22o.....",
    ".....oL322o.....",
    ".....oL322o.....",
    ".....oL3G2o.....",
    ".....o4LL2o.....",
    "....oG43llo.....",
    ".....oll22o.....",
    ".....oL322o.....",
    ".....oL322o.....",
    ".....oL322o.....",
    ".....o4LL2o.....",
    "...ooe432Geoo...",
    "..oeee43l2eeeo..",
    ".odeeee32eeeeco.",
    ".obddeeeeeeccao.",
    ".odbbbdeecaaaco.",
    ".odddbbdcaaccco.",
    "..oddbdbacacco..",
    "...oobddccaoo...",
    ".....oodcoo.....",
    ".......oo.......",
  ],
};
// </farolito>
// <farol-muelle>
const FAROL_MUELLE: Grid = {
  ox: 8,
  oy: 29,
  rows: [
    ".....oooooo..........",
    "....o444444o.........",
    "...o44444444o........",
    "...o33333333o........",
    "...o33333332o........",
    "...o33323212o........",
    "...o33323212o........",
    "...o3332mm12o........",
    "...o33323mm2o........",
    "...o3332321mmo.......",
    "...o33323212mmo......",
    "...o33323212omo......",
    "...o33323212omo......",
    "...o33323212omo......",
    "...o33323212oqo......",
    "..oO33323212pqmoo....",
    "..oP333232qqpqmqqoo..",
    "..oPOP32QppqqqqqmmQo.",
    "..oPOOOppQQppqmmQQmmo",
    "..oOOOOPOppQQQQQmmoo.",
    "...oOOOPOpYppQmmymo..",
    "...o33323pznYqymYmo..",
    "...o33323ppnzqYmmmo..",
    "...o3332ppqppqmmqmmo.",
    "...o333232ppqqqmmoo..",
    "...o33323212pomoo....",
    "...o33323212o.o......",
    "...o33323212o........",
    "...o33323212o........",
    "...o33323212o........",
    "...o33323212o........",
    "...o33323212o........",
    "...o33323212o........",
    "...o33323212o........",
    "..KK33323212KK.......",
    ".KKkh3323212kKK......",
    "KKkkhh32321hkkKK.....",
    "KKkk3hhhhhhhkkKK.....",
    ".KKk33hhhhh2kKK......",
    "..KK33323212KK.......",
    "....oo32321o.........",
    "......ooooo..........",
  ],
};
// </farol-muelle>
export const lampPostSprite = (): Sprite => sprite(FAROL, { ...LEGEND, o: edgeOf(IRON, 0.3) });
export const gardenLanternSprite = (): Sprite => sprite(FAROLITO, LEGEND);
export const dockLampSprite = (): Sprite => sprite(FAROL_MUELLE, LEGEND);
