// Matas, helechos, pasto y flores del jardín dibujados a mano (docs/arte/estandar-arte.md), en grillas de letras.
// Los dígitos son los tonos de la rampa del follaje (0 el más oscuro, 5 el más claro) y `o` su contorno
// cálido; `s` es la sombra en el piso. Las flores y las bayas llevan sus letras: la mayúscula es el lado
// con luz y la minúscula el de sombra.
import { C, mix } from "./palette";
import { at, type Ramp, type RGBA, type Sprite } from "./pixel";
import { edgeOf, gridSprite, groundShadow, rampLegend, type Legend } from "./grilla";

const leafLegend = (leaf: Ramp): Legend => ({ ...rampLegend(leaf), o: edgeOf(leaf, 0.5), s: groundShadow(0.28) });

/** Pétalo con luz (P), en sombra (p) y su pliegue más oscuro (q), desde el color de la flor. */
const petals = (col: RGBA): Legend => ({ P: mix(col, at(C.white, 4), 0.25), p: col, q: mix(col, at(C.navy, 0), 0.4) });

// <mata>
const MATA = [
  "..............................",
  "..............................",
  "............oo.oo.............",
  ".........ooo54o54oooo.........",
  "........o555445345454oo.......",
  ".......o544444444333343o......",
  ".....oo433544433332322ooo.....",
  "...oo55555544334433544543oo...",
  "..o554454444443334433333343o..",
  ".oo444344343343322233332222oo.",
  "o5544334443335544433322232133o",
  "o4443444355554443444421222221o",
  "o4334444543333344333333211111o",
  "o5444354433443333323323221210o",
  ".oo3333333233322223222231111o.",
  "..o211342243222333221120000o..",
  "...oo00333332333222122200oo...",
  ".....sss23222222211121sssss...",
  "....sssss11011100000ssssssss..",
  "....ssssssss00s00sssssssssss..",
  ".....ssssssssssssssssssssss...",
  ".........ssssssssssssss.......",
  "..............................",
];
// </mata>
// <mata-moras>
const MATA_MORAS = [
  "..............................",
  "..............................",
  "............ooooo.............",
  "........oooo44554ooo..........",
  "......oo554455444444ooo.o.....",
  ".....o55455444443444443o4o....",
  ".....o445444333Hb433322433oo..",
  "....o5444443443bd33433333333o.",
  "...oo45555333343332332Hb2222o.",
  "..o555444Hb43233223222bd1111o.",
  ".oo543354bd33553542332222112o.",
  "o5544544435b4444344443111121o.",
  "o443544444334333333Hb243021o..",
  "o544433344444334332bd33330o...",
  "o44333Hb33333323322322222o....",
  ".oo322bd32322Hb322322b2112o...",
  "...o100333331bd2222212221o....",
  "....os00222222221Hb1221ssss...",
  "....ssssss1001000bd000ssssss..",
  "....sssssssssss00s0sssssssss..",
  ".....ssssssssssssssssssssss...",
  ".........ssssssssssssss.......",
  "..............................",
];
// </mata-moras>
// <rosal>
const ROSAL = [
  "..............................",
  "..............................",
  "............oo.ooo............",
  ".........ooo55o554ooo.........",
  ".......oo555445444543oo.......",
  "......o555444344P334444o......",
  ".....oo45443333PqP33332oo.....",
  "...oo55554434444p23555444ooo..",
  "..o5545544555333344333332333o.",
  ".o5444444P443422233323222321o.",
  "o5543544PqP3455554223P2222213o",
  "o44444433p4444443334PqP121112o",
  "o43334354334443343332p3111022o",
  "o44334P3344433333323213222111o",
  ".o333PqP4433P22322P22323P110o.",
  "..o121p4333PqP122PqP132PqP0o..",
  "...oo1033333p33232p12220poo...",
  ".....ss222322222221111sssss...",
  "....sssss11101100000ssssssss..",
  "....ssssssssss000sssssssssss..",
  ".....ssssssssssssssssssssss...",
  ".........ssssssssssssss.......",
  "..............................",
];
// </rosal>
// <hortensia>
const HORTENSIA = [
  "..............................",
  "..............................",
  "............oo.oo.............",
  ".........ooo54o55ooo.o........",
  ".......oo55545543453o4ooo.....",
  "......o555445444PP4443334o....",
  ".....o434443443PPpP3222233oo..",
  "....o5555333433pPpq434333233o.",
  "...oo4555PP44343qq3333322222o.",
  "..o55544PPpP332322322PP21221o.",
  ".o554435pPpq35435522PPpP2211o.",
  "o54433444qq454443344pPpq1110o.",
  "o33334434454443332232qq31001o.",
  "o444443PP44433PP2243332343oo..",
  ".o3333PPpP333PPpP233PP222o....",
  ".o3322pPpq233pPpq23PPpP212o...",
  "..o1110qq33222qq132pPpq11o....",
  "...oos00222213222221qq1ssss...",
  "....ssssss001110000000ssssss..",
  "....sssssssssss00sssssssssss..",
  ".....ssssssssssssssssssssss...",
  ".........ssssssssssssss.......",
  "..............................",
];
// </hortensia>

// Todas las matas tienen el pie en el mismo lugar de su grilla (el centro del tile).
const BUSH_OX = 15;
const BUSH_OY = 10;

export const bushSprite = (leaf: Ramp): Sprite => gridSprite(MATA, leafLegend(leaf), BUSH_OX, BUSH_OY);
export const berryBushSprite = (leaf: Ramp, berry: RGBA): Sprite =>
  gridSprite(MATA_MORAS, { ...leafLegend(leaf), H: mix(berry, at(C.white, 4), 0.55), b: berry, d: mix(berry, at(C.navy, 0), 0.45) }, BUSH_OX, BUSH_OY);
export const roseBushSprite = (leaf: Ramp, rose: RGBA): Sprite => gridSprite(ROSAL, { ...leafLegend(leaf), ...petals(rose) }, BUSH_OX, BUSH_OY);
export const hydrangeaSprite = (leaf: Ramp, bloom: RGBA): Sprite => gridSprite(HORTENSIA, { ...leafLegend(leaf), ...petals(bloom) }, BUSH_OX, BUSH_OY);

// <helecho>
const HELECHO = [
  "................o2o...............",
  "...............o123o....oooo......",
  "........oo.o...o123oo.oo3222o.....",
  ".......o22o3ooo112333o3222oo......",
  "........oo2233311233o32211o.......",
  ".........o1122o111333221oo........",
  "..........o1123o11331211ooo.......",
  ".....o..ooo1o1111133111oo33ooo....",
  "....o4oo444o131121o32233o33333ooo.",
  "..oooo4444oo443341333333o22222222o",
  ".o3333333444444533444344441111ooo.",
  "..ooooo244444555544444414444oo....",
  "......o43333255554444442333o4o....",
  ".....o33322255433222334222233o....",
  "....o332os2254332122233422o233o...",
  "...o3ooo.sss443sssss2232ss.ooo3o..",
  "....o.....s44sssssssss33s.....o...",
  "..........o4o.........o3o.........",
  "...........o...........o..........",
];
// </helecho>
// <pasto>
const PASTO = [
  ".........o........oGo.....",
  "........oGo.......ogo.....",
  "........ogo....o..o4o.....",
  "....o...o5o...o4oo4o......",
  "...o4o..o5o.o.o4oo3o......",
  "....o4o.o4oo5o4o.o3o......",
  "....o43o.o4o553o.o3o...o..",
  ".....o3o.o4oo43oo33o..o3o.",
  ".....o33oo4oo34o43o..o33o.",
  "......o55o43o344432oo22o..",
  "..oo...o5445o343o32oo2o...",
  ".o44oo.o34453323332o2oo...",
  "..o433oo324552331102213o..",
  "...oo33o1044503210o213o...",
  ".....o322124543210002o....",
  "......s100225420100221o...",
  "....ssss10s12320s0000ss...",
  "....ssssssss2320ss00sss...",
  "......sssssssssssssss.....",
  "..........................",
];
// </pasto>
// <flores>
const FLORES = [
  "..............oAo.......oCyco...oDo.",
  ".....o.......oAyao.......oco...oDydo",
  "....oDo.......oao....o...o3o..o.odo.",
  "...oDydo.o..o.o3o...oBoo.o3o.oAoo3o.",
  "....od4oo4oo3oo3o.ooByb4oo3ooAyao3o.",
  "....o3o4o43o4oo3oo3ooboo4o43o3aoo3o.",
  "....o3o44432o4o43o3oo3oo44432o34o43o",
  "..o.o3oo3221s44432sss3sss3221o344432",
  ".o4oo3ss3sssss3221sss3ssssssss3o3221",
  "..o4s43s3sssssssss4ss3ss3ss4ss3so3oo",
  "..o44432s4ss4ss3sss4s43s3sss4s43s3o.",
  "...s3221ss4s43s3sss44432ssss44432o..",
  "....ssssss444324ss4s3321sssss3221o..",
  "......sssss3221s4s43s3ssssssssooo...",
  ".........sssssss44432ssssss.........",
  "................o3221o..............",
  ".................oooo...............",
];
// </flores>

export const fernSprite = (leaf: Ramp): Sprite => gridSprite(HELECHO, leafLegend(leaf), 17, 6);
export const tallGrassSprite = (): Sprite => gridSprite(PASTO, { ...leafLegend(C.grass), G: at(C.mustard, 5), g: at(C.mustard, 3) }, 13, 8);
export const wildflowersSprite = (): Sprite =>
  gridSprite(
    FLORES,
    {
      ...leafLegend(C.grass),
      A: at(C.white, 4),
      a: at(C.white, 2),
      B: at(C.gold, 5),
      b: at(C.gold, 3),
      C: at(C.violet, 5),
      c: at(C.violet, 3),
      D: at(C.rose, 5),
      d: at(C.rose, 3),
      y: at(C.gold, 4),
    },
    18,
    3,
  );
