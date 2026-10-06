// Los muebles comunes de las salas dibujados a mano (docs/estandar-arte.md): silla, taburete, sillón, puf,
// barra, parlante y proyector, en grillas de letras. Los dígitos son los tonos de la madera (0 el más
// oscuro, 5 el más claro); las minúsculas a..f, los de la tela; m..r, los del metal; `o` es el contorno
// cálido y `s` la sombra en el piso. Cada grilla trae dónde queda el origen del mueble.
import { C } from "./palette";
import { alpha, at, ramp as rampOf, type Ramp, type Sprite } from "./pixel";
import { edgeOf, gridSprite, groundShadow, rampLegend, type Legend } from "./grilla";
import type { Variant } from "./kit";

/** Madera en dígitos, una tela en a..f, el metal en m..r y el contorno y la sombra. */
function legend(wood: Ramp, cloth: Ramp, outline: Ramp = wood): Legend {
  return {
    ...rampLegend(wood),
    ...rampLegend(cloth, "abcdef"),
    ...rampLegend(C.metal, "Mmnpqr"),
    o: edgeOf(outline, 0.55),
    s: groundShadow(0.3),
  };
}

type Grid = { rows: readonly string[]; ox: number; oy: number };
const sprite = (g: Grid, l: Legend): Sprite => gridSprite(g.rows, l, g.ox, g.oy);

// <silla>
const SILLA: Grid = {
  ox: 15,
  oy: 24,
  rows: [
    "..............oo..............",
    ".............o55o.............",
    "...........oo5544o............",
    ".........oo555533o............",
    ".......oo55553322o............",
    "....ooo5555332122o............",
    "...o5555533222211o............",
    "..o44553312221122o............",
    "..o44332212114322o............",
    "..o44222211424322o............",
    "..o44221142424322o............",
    "..o33114242424322o............",
    "..o43224242424322o............",
    "..o43224242424322o............",
    "..o43224242424422o............",
    "..o43224242442222o............",
    "..o43224244222332o............",
    "..o4344442224eeee3oo..........",
    "..o43332224eeeeeeee3oo........",
    "..o432324eeddddddddee3oo......",
    "..o4324eeddddddbeddddee3oo....",
    "..o4444ccccddddddddddccb33o...",
    "..o34444cccccddddddccbbb552o..",
    "..o2334444cccccddccbbb55221o..",
    "..o422333344cccccbbb552211o...",
    "..o43222333344ccbb5522112o....",
    "..o4322o22333344552211322o....",
    "..o4322ooo2233552211o3322o....",
    "..o4322ossoo223211ooo3322o....",
    "..o4322osssso4212osso3322o....",
    "..o4322osssso3322osso3322os...",
    ".so4322osssso3322osso3321osss.",
    "ssso32ossssso3322ossso31osssss",
    ".sssoosssssso3322ossssoosssss.",
    "...ssssssssso3322osssssssss...",
    ".....ssssssso3321osssssss.....",
    ".......sssssso31ossssss.......",
    ".........sssssoosssss.........",
    "...........ssssssss...........",
    ".............ssss.............",
  ],
};
// </silla>
// <silla-b>
const SILLA_B: Grid = {
  ox: 15,
  oy: 19,
  rows: [
    "........................oo....",
    ".......................o55o...",
    ".....................oo5544o..",
    "...................oo555533o..",
    ".................oo55553322o..",
    "..............ooo5555332122o..",
    ".............o5555533222211o..",
    "............o44553312221122o..",
    "............o44332212114322o..",
    "............o44222211424322o..",
    "............o44221142424322o..",
    "...........oo33114242424322o..",
    ".........ooee43224242424322o..",
    ".......ooeeee43224242424322o..",
    "......oeedddd43224242424422o..",
    "....oocccdddd43224242442222o..",
    "...o44cccccdd43224244222322o..",
    "..o34444ccccc43444422244322o..",
    "..o2334444ccc43332224454322o..",
    "...o22333344c43232445524322o..",
    "....o4223333443224552214322o..",
    "....o33222333432252211o4322o..",
    "....o3322o2234322211ooo4322o..",
    "....o3322ooo243221oosso4322o..",
    "....o3322osso4322osssso4322o..",
    "...so3322osso4322osssso4322o..",
    ".ssso3321osso4322osssso4322os.",
    "ssssso31ossso4322ossssso32osss",
    ".sssssoosssso4322ossssssoosss.",
    "...ssssssssso4322osssssssss...",
    ".....ssssssso4322osssssss.....",
    ".......ssssso4322osssss.......",
    ".........sssso32ossss.........",
    "...........sssoosss...........",
    ".............ssss.............",
  ],
};
// </silla-b>

/** Silla de madera con cojín; el respaldo queda del lado contrario a donde mira quien se sienta. */
export const chairSprite = (v: Variant): Sprite => sprite(v === "back" ? SILLA_B : SILLA, legend(C.wood, C.sage));

// <taburete>
const TABURETE: Grid = {
  ox: 12,
  oy: 11,
  rows: [
    ".........oooooo.........",
    ".......ooeeeeeeoo.......",
    ".....ooeeeeeeeeeeoo.....",
    "....oeeeeeeeeeeeeeeo....",
    "...oeddddddbbddddddeo...",
    "...ocddddccbbccddddco...",
    "..oddccddddccddddcccco..",
    "..occddccddddddccccbbo..",
    "..occccddccddccccbbbbo..",
    "...o3ccccdd21ccbbbb1o...",
    "...o321cccc33bbbb211o...",
    "...o3211occ33bbo3211o...",
    "...o3211oo3211oo3211o...",
    "...o3211oo3211oo3211o...",
    "...o3233oo3211oo3311o...",
    "...o3222333211331111o...",
    "...o3211223211113211o...",
    "...o3211oo3211oo3211o...",
    ".sso3211oo3211oo3211oss.",
    "sssso21oso3211oso21ossss",
    ".ssssoosso3211ossoossss.",
    "...sssssso3211ossssss...",
    ".....ssssso21osssss.....",
    ".......ssssoossss.......",
    ".........ssssss.........",
  ],
};
// </taburete>

/** Taburete de madera oscura con travesaños y un cojín rojo capitoneado. */
export const stoolSprite = (): Sprite => sprite(TABURETE, legend(C.woodDark, C.rug, C.woodDark));

// <sillon>
const SILLON: Grid = {
  ox: 15,
  oy: 21,
  rows: [
    "..............oo..............",
    "............ooeeoo............",
    "..........ooffffeeo...........",
    "........ooffffffffdo..........",
    "......ooffffffffddbo..........",
    "....ooffffffffddbbbo..........",
    "..ooffffffffddbbbbbo..........",
    ".offffffffddbbbbbbbo..........",
    "oeeeffffddbbbbbbbbao..........",
    "oceeeeddbbbbbbbbbbbo..........",
    "occcedbbbbbbbbacbbbfoo........",
    "occccbbbbbbbbbbbbbbeffoo......",
    "occccbbbbbacbbbbbbbdeeffoo....",
    "occccbbbbbbbbbbbacbeddeeffoo..",
    "oceeffacbbbbbbccbbbceeddeeffo.",
    "oeddeeffbbbbccccccbccceeddeeco",
    "oceeddeeffcccceecccccccceeccbo",
    "occceeddeeffddddddccccccccbdbo",
    "odcccceeddeeffddddddccccccbdbo",
    "ocddcccceeddeeffddddddccccbbbo",
    "occcddcccceeddeeffddddffbcccbo",
    "occcccddcccceeddccccffbbbcccbo",
    "occcccccddccccecdbffbbbbccbbbo",
    "odccccccccddcccbdbbbbbccbbbbco",
    "ocddccccccccddcbbbbbccbbbbccbo",
    "occcddccccccccdbbbccbbbbccbbbo",
    "oaccccddcccccccbbbbbbbccbbbbao",
    ".oaaccccddcccccbbbbbccbbbbaao.",
    ".so3aaccccddcccbbbccbbbbaa1os.",
    "ssso21aaccccddcbccbbbbaa21osss",
    ".sssooooaaccccdcbbbbaaoooosss.",
    "...sssssooaacc33bbaaoosssss...",
    ".....sssssooa3331aoosssss.....",
    ".......ssssso3211osssss.......",
    ".........sssso21ossss.........",
    "...........sssoosss...........",
    ".............ssss.............",
  ],
};
// </sillon>
// <sillon-b>
const SILLON_B: Grid = {
  ox: 15,
  oy: 16,
  rows: [
    "........................oo....",
    "......................ooeeoo..",
    "..............oo....ooffffeeo.",
    "............ooffooooffffffffdo",
    "...........oddeeffffffffffddbo",
    "...........oeeddffffffffddbbbo",
    "...........occffffffffddbbbbbo",
    "...........offffffffddbbbbbbbo",
    "..oooo....oeeeffffddbbbbbbbbao",
    ".oeeffoo..oceeeeddbbbbbbbbbbbo",
    "oeddeeffoofcccedbbbbbbbbacbbbo",
    "oceeddeeffdccccbbbbbbbbbbbbbbo",
    "occceeddeeffcccbbbbbacbbbbbbbo",
    "odcccceeddeeffcbbbbbbbbbbbacbo",
    "ocddcccceeddeeffacbbbbbbbbbbbo",
    "occcddcccceeddeeffbbbbacbbbbbo",
    "occcccddcccceeddccbbbbbbbbbbbo",
    "occcccccddccccecdbacbbbbbbbbbo",
    "odccccccccddcccbdbbbbbbbbbbbco",
    "ocddccccccccddcbbbbbbbbbbbccbo",
    "occcddccccccccdbbbbbbbbbccbbbo",
    "oaccccddcccccccbbbbbbbccbbbbao",
    ".oaaccccddcccccbbbbbccbbbbaao.",
    ".so3aaccccddcccbbbccbbbbaa1os.",
    "ssso21aaccccddcbccbbbbaa21osss",
    ".sssooooaaccccdcbbbbaaoooosss.",
    "...sssssooaacc33bbaaoosssss...",
    ".....sssssooa3331aoosssss.....",
    ".......ssssso3211osssss.......",
    ".........sssso21ossss.........",
    "...........sssoosss...........",
    ".............ssss.............",
  ],
};
// </sillon-b>

/** Sillón tapizado: respaldo capitoneado, brazos enrollados con su ribete, dos cojines y patas de madera. */
export const armchairSprite = (v: Variant): Sprite => sprite(v === "back" ? SILLON_B : SILLON, legend(C.woodDark, C.green, C.green));

// <puf>
const PUF: Grid = {
  ox: 12,
  oy: 9,
  rows: [
    ".....oooooooo...........",
    "....offeeeeeeo..........",
    "...ofeeeeeeebdo.........",
    "..oeebeeeeedbddo........",
    ".oeeebeeeddddbddo.......",
    ".oeeebeddddddbddo.......",
    ".oeeebddddddddbco.......",
    ".oeedbddddddccbcooo.....",
    ".oeddbdddddcbbbbdddo....",
    ".oeddbdddbbbbbbbbbbco...",
    "..oddbdddcccccccbcccco..",
    ".odddbdddcccccccbccccco.",
    ".odddbdddccccccccbcccco.",
    "oddddbdddccceeeecbeffbbo",
    ".odddbdcccccccccccbbbbo.",
    ".oddcbccccccccccbbbbbbo.",
    "..occcccccccccbbbbbbboss",
    "..socccccccbbbbbbbbbosss",
    "..ssoaaaaaaaaaaaaaaossss",
    "...ssoooaaaaaaaaooossss.",
    "......ssoooooooossss....",
  ],
};
// </puf>
// <puf-b>
const PUF_B: Grid = {
  ox: 12,
  oy: 7,
  rows: [
    "............ooooo.......",
    "..........oofeeeeoo.....",
    ".........offeeeeeeeo....",
    "........ofeeeeeeebddo...",
    ".....oooeeebeeeeddbddo..",
    "....obbeeebeeeddddbdddo.",
    "....occeebffedddddbddco.",
    "...oecceeeedddddddbccco.",
    "..oeeccebddddddddcbccco.",
    ".odddddebddddddddcbccco.",
    ".odddddbeddddddddcbccco.",
    "oddddddbeddddddddcbccbbo",
    ".oddddbccddddddddcbcbbo.",
    ".oddcbbcccccccccbbbbbbo.",
    "..occcccccccccbbbbbbboss",
    "..socccccccbbbbbbbbbosss",
    "..ssoaaaaaaaaaaaaaaossss",
    "...ssoooaaaaaaaaooossss.",
    "......ssoooooooossss....",
  ],
};
// </puf-b>

/** Lila del puf (la misma de la tienda). */
const LILAC = rampOf("#2e2140", "#4a3466", "#6a4d8c", "#8c6fb0", "#b597d0", "#dcc4ea");

/** Puf: un saco blando con el respaldo que sale del mismo saco, el hundido del asiento y sus costuras. */
export const beanbagSprite = (v: Variant): Sprite => sprite(v === "back" ? PUF_B : PUF, legend(LILAC, LILAC));

// <barra>
const BARRA: Grid = {
  ox: 17,
  oy: 19,
  rows: [
    "................oo..............",
    "..............ooeeoo............",
    "............ooeeeeeeoo..........",
    "..........ooeeeeeeeeeeoo........",
    "........ooeeeeeeeeeeeeeeoo......",
    "......ooeeeeeeeeeecceeeeeeoo....",
    "....ooeeeeeeeeeeeecceeeeeeeeoo..",
    "..ooeeeeeeeeeeeeeeeeeeeeeeeeeeo.",
    ".oeeeecceeeeeeeeeeeeeeeeeeeeffdo",
    "oceeeecceeeeeeeeeeeeeeeeeeffddco",
    "occceeddeeeeddeeccddeeeeffddcco.",
    "o4cccceeeeeeeeeecceeeeffddcc3o..",
    "o244cccceeeeeeeecceeffddcc313o..",
    "o24444cccceeeeeeeeffddcc31123o..",
    "o2444444cccceeeeffddcc3112223o..",
    "o242244444ccccffddcc313122223o..",
    "o24232244244cccdcc31313122223o..",
    "o2423332424443cc3112313122223o..",
    "o2423333424441311222313122223o..",
    "o2423333424221312222313122223o..",
    "o2423333424231312222313122223o..",
    "o2423333424231312222313122223o..",
    "o2423333424231312222313122333o..",
    "o242333342423131222231313333ko..",
    "o2423333424231312222313133kkko..",
    "ok4444334242313122223133kkkko...",
    "okkk444442423131223331kkkkoo....",
    ".okkkk44424231313333kkkkoo......",
    "..ookkkk4242313133kkkkoo........",
    "....ookkkk444133kkkkoo..........",
    "......ookkkk41kkkkoo............",
    "........ookkkkkkoo..............",
    "..........ookkoo................",
  ],
};
// </barra>
// <barra-cafe>
const BARRA_CAFE: Grid = {
  ox: 17,
  oy: 30,
  rows: [
    "..............ooo...............",
    ".............owwroo.............",
    "...........ooWwwxrroo...........",
    ".........oorrWWxxrrrroo.........",
    ".......oorrrrwwwrrrrrrro........",
    "......orrrrrWWwxxrrrrppo........",
    ".....oqrrrrrrWrxrrrppppo........",
    ".....oqqqrrrrrrrrppppppo........",
    ".....orqqqqrrrrpppppppmo........",
    ".....orqqqqqqpppppppmmpo........",
    ".....ornqqqqqpppppmmpppo........",
    ".....orqnnqqqpppmmpppppo........",
    ".....orqqqnnqpmmpzMMpppo........",
    ".....orqqqqqnmppMMnnnnpo........",
    ".....orqqqqqqpppMZmmMMmo........",
    ".....orqqqqqqpppMMmmMMpeoo......",
    ".....ornqqqqqpppMzmmMMpeeeoo....",
    "....oorqnnqqqpppmmpppppeeeeeoo..",
    "..ooeerqqqnnqpmmppppppeeeeeeeeo.",
    ".oeeeerqqqqqnmwwwwppeeeeeeeeffdo",
    "oceeeeccqqqqqWwwkwxeeeeeeeffddco",
    "occceeddeeqqqWWWxxxdeeeeffddcco.",
    "o4cccceeeeeeqWWWxxxeeeffddcc3o..",
    "o244cccceeeeeeWWxxeeffddcc313o..",
    "o24444cccceeeeeeeeffddcc31123o..",
    "o2444444cccceeeeffddcc3112223o..",
    "o242244444ccccffddcc313122223o..",
    "o24232244244cccdcc31313122223o..",
    "o2423332424443cc3112313122223o..",
    "o2423333424441311222313122223o..",
    "o2423333424221312222313122223o..",
    "o2423333424231312222313122223o..",
    "o2423333424231312222313122223o..",
    "o2423333424231312222313122333o..",
    "o242333342423131222231313333ko..",
    "o2423333424231312222313133kkko..",
    "ok4444334242313122223133kkkko...",
    "okkk444442423131223331kkkkoo....",
    ".okkkk44424231313333kkkkoo......",
    "..ookkkk4242313133kkkkoo........",
    "....ookkkk444133kkkkoo..........",
    "......ookkkk41kkkkoo............",
    "........ookkkkkkoo..............",
    "..........ookkoo................",
  ],
};
// </barra-cafe>

/** Lo de la barra de la cafetería: madera con tableros enmarcados, zócalo y tapa de mármol crema. */
function counterLegend(): Legend {
  return {
    ...legend(C.wood, C.cream),
    k: at(C.woodDark, 1),
    G: at(C.gold, 4),
    w: at(C.white, 4),
    W: at(C.white, 3),
    x: at(C.white, 1),
    z: alpha(at(C.cream, 5), 0.7),
    Z: alpha(at(C.cream, 5), 0.45),
  };
}
export const counterSprite = (): Sprite => sprite(BARRA, counterLegend());
/** La misma barra con la cafetera espresso, sus tazas tibias, el pocillo y el vapor. */
export const counterCoffeeSprite = (): Sprite => sprite(BARRA_CAFE, counterLegend());

// <barra-club>
const BARRA_CLUB: Grid = {
  ox: 17,
  oy: 19,
  rows: [
    "................oo................",
    "..............oommoo..............",
    "............ooMMMMMMoo............",
    "..........ooMMMMMMyyyyoo..........",
    "........ooMMMMMMphyyyyNMoo........",
    "......ooMMMMMMMMphhhNNNMMMoo......",
    "....ooMMMMMMMMmmMMhhNNMMMMMMoo....",
    "..ooMMMMMMMMMMMMMMMWxMMMMMMMMMoo..",
    ".oMMmmMMMMMMMMMMMMwWxwMMMMMMMMMMo.",
    "ognnMMMMppMMMMMMMMMWxMmmMMMMMMnnGo",
    "ogggnnMMppMMMMMMMMMMMMMMMMMMnnGGGo",
    ".oggggnnMMMMmmMMMMMMMMMMMMnnGGGGo.",
    ".oGGggggnnMMMMMMMMppMMMMnnGGGGggo.",
    ".oggGGggggnnMMMMMMppMMnnGGGGgg10o.",
    ".o02ggGGggggnnMMMMMMnnGGGGgg1110o.",
    ".o0222ggGGggggnnMMnnGGGGgg011110o.",
    ".o022220ggGGggggnnGGGGgg11011110o.",
    ".o02222022ggGGgggGGGgg1111011110o.",
    ".o0222202222ggGGgGgg101111013110o.",
    ".o023220222202gggg11101111011110o.",
    ".o022220222202220111101111011110o.",
    ".o022220232202220111101311011110o.",
    ".o022220222202220111101111011110o.",
    ".o022220222202220131101111011110o.",
    ".o022220222202320111101111013110o.",
    ".o0232202222022201111011110111NNo.",
    ".oNN222022220222011110111101NNhho.",
    ".ohhNN20232202220111101311NNhhoo..",
    "..oohhNN2222022201111011NNhhoo....",
    "....oohhNN220222013110NNhhoo......",
    "......oohhNN02320111NNhhoo........",
    "........oohhNN2201NNhhoo..........",
    "..........oohhNNNNhhoo............",
    "............oohhhhoo..............",
    "..............oooo................",
  ],
};
// </barra-club>

/** Barra del club: duelas de madera oscura con tachas, moldura dorada, neón rosado y mármol negro. */
export const barCounterSprite = (): Sprite =>
  sprite(BARRA_CLUB, {
    ...legend(C.woodDark, C.woodDark, C.woodDark),
    g: at(C.gold, 2),
    G: at(C.gold, 4),
    h: at(C.neon, 3),
    N: at(C.neon, 4),
    y: at(C.neon, 5),
    w: at(C.white, 4),
    W: at(C.white, 3),
    x: at(C.white, 1),
  });

// <parlante>
const PARLANTE: Grid = {
  ox: 12,
  oy: 24,
  rows: [
    "..........oooo..........",
    ".........opqqno.........",
    ".......oonnpnnnoo.......",
    ".....oonnnnnnnnnnoo.....",
    "...oonnnnnnnnnnnnnnoo...",
    "..onnnnnnnnnnnnnnnnnno..",
    ".opnnnnnnnnnnnnnnnnnnno.",
    ".opppnnnnnnnnnnnnnnnnno.",
    ".opmmppnnnnnnnnnnnnMMno.",
    ".opmmmmppnnqqnnnnMMMMno.",
    ".opmnmmmmpppnnnMMMMMMno.",
    ".opmmnnmmmmpnmMMMMMMMno.",
    ".opmmmmnnmmmnmMMMMMMMno.",
    ".opmmmmmmnmmnmMMMppMMno.",
    ".opmmmmmmmmmnmMMnnnMMno.",
    ".opmnmmmmmmmnmMpyypMMno.",
    ".opmmnnmmmmmnmMnnnMMMno.",
    ".opmmmmnnmmmnmMppMMMMno.",
    ".opmmmmmmnmmnmMMMMMMMno.",
    ".opmmmmmmmmmnmMMMMMMMno.",
    ".opmnmmmmmmmnmMMMMMMMno.",
    ".opmmnnmmmmmnmMMMMMMMno.",
    ".opmmmmnnmmmnmMMqqpqqno.",
    ".opmmmmmmnmmnmMqpppnqno.",
    ".opmmmmmmmmmnmqpppnnmno.",
    ".opmnmmmmmmmnmppprnmmno.",
    ".opmmnnmmmmmmmpprrmmqno.",
    ".opmmmmnmmmmmmmmrmmmMno.",
    ".opmmmmmmmmmmmmmmmmqMno.",
    ".opmmmmmmmmmmmmmmmmmMno.",
    ".ommmmmmmmmmmmmmmmmmmmo.",
    "oMmmmmmmmmmmmmmmmmmmmmMo",
    ".oMMmmmmmmmmmmmmmmmmMMo.",
    "..ooMMmmmmmmmmmmmmMMoo..",
    "....ooMMmmmmmmmmMMoo....",
    "......ooMMmmmmMMoo......",
    "........ooMMMMoo........",
    "..........oooo..........",
  ],
};
// </parlante>

/** Parlante alto: caja negra con rejilla al costado, el woofer con su anillo y el tweeter azul. */
export const speakerSprite = (): Sprite => sprite(PARLANTE, { ...legend(C.metal, C.metal, C.metal), y: at(C.cyan, 4) });

// <proyector>
const PROYECTOR: Grid = {
  ox: 10,
  oy: 18,
  rows: [
    "....oooo.............",
    "...oqrrro............",
    "...oqMGGrooo.........",
    "...oqMMGGrrroo.......",
    "...oqGGrMqqGrro......",
    "...ooqGrGqMMGGro.....",
    ".oonnqMMGqGMrMroo....",
    "onnnnnqqkqGGrMMrqoo..",
    "oqqnnnnnqqqMMGGrnqqo.",
    "oppqqnnnnnnqkMGrqppo.",
    "oppppqqnnnnnqqqrpnno.",
    "opppMppqqnnqqppqqqqo.",
    "opppppMppqqppqqqqGGo.",
    "opppMpppMppnnnnpzzzo.",
    ".o4pppMppppnnnnGyyGo.",
    ".o344pppMppnnnnzzzpo.",
    ".o33344ppppnnnnGG2o..",
    ".o3333344ppnn22222o..",
    ".o3323333432222122o..",
    ".o3322233322211122o..",
    ".o3322223322111122o..",
    ".o3322223322111122o..",
    ".o3322223322111122o..",
    ".o3322223322111122o..",
    ".o3322223322111122o..",
    ".o1332223322111221o..",
    "..o11332332212211oss.",
    "...oo1133322211oossss",
    ".....oo113211oosssss.",
    ".......oo11oosssss...",
    ".........oosssss.....",
    "............ss.......",
  ],
};
// </proyector>
// <proyector-b>
const PROYECTOR_B: Grid = {
  ox: 10,
  oy: 18,
  rows: [
    "....oooo.............",
    "...oqrrro............",
    "...oqMGGrooo.........",
    "...oqMMGGrrroo.......",
    "...oqGGrMqqGrro......",
    "...ooqGrGqMMGGro.....",
    ".oonnqMMGqGMrMroo....",
    "onnnnnqqkqGGrMMrqoo..",
    "oqqnnnnnqqqMMGGrnqqo.",
    "oppqqnnnnnnqkMGrqppo.",
    "oppppqqnnnnnqqqrpnno.",
    "opppMppqqnnqqppnnnno.",
    "opppppMppqqppnnnMnno.",
    "opppMpppMppnnnMnnnno.",
    ".o4pppMppppnnnnnMnno.",
    ".o344pppMppnnnMnn2o..",
    ".o33344ppppnnnn222o..",
    ".o3333344ppnn22222o..",
    ".o3323333432222122o..",
    ".o3322233322211122o..",
    ".o3322223322111122o..",
    ".o3322223322111122o..",
    ".o3322223322111122o..",
    ".o3322223322111122o..",
    ".o3322223322111122o..",
    ".o1332223322111221o..",
    "..o11332332212211oss.",
    "...oo1133322211oossss",
    ".....oo113211oosssss.",
    ".......oo11oosssss...",
    ".........oosssss.....",
    "............ss.......",
  ],
};
// </proyector-b>

/** Proyector de cine sobre su pedestal: cuerpo con rejillas, el lente encendido y dos carretes. */
export const projectorSprite = (v: Variant): Sprite =>
  sprite(v === "back" ? PROYECTOR_B : PROYECTOR, { ...legend(C.woodDark, C.metal, C.metal), k: at(C.metal, 0), G: at(C.gold, 3), y: at(C.white, 4), z: at(C.sky, 4) });
