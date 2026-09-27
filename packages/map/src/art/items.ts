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

type Hexes = Record<string, string>;
const legend = (h: Hexes): Legend => Object.fromEntries(Object.entries(h).map(([k, v]) => [k, hex(v)]));

/** Caja de crispetas: el copete (`p`, `P`) sobre la caja de rayas (`r`, `w`) que se angosta abajo. */
function popcorn(c: Hexes, crumb: string): ItemArt {
  return {
    crumb: hex(crumb),
    rows: [
      "..oPpo..", //
      ".oPpPpo.",
      "opPpPpPo",
      "oPpPpPpo",
      "orwrwrwo",
      "orwrwrwo",
      ".orwrwo.",
      ".orwrwo.",
      ".oooooo.",
    ],
    colors: legend(c),
  };
}

/**
 * Vaso alto de jugo con pitillo (`s`): el jugo (`a`, sombra `A`, pepitas o trocitos `b`) y, si trae
 * `f`/`F`, la espuma de arriba (se va con el primer sorbo). `flakes`: la espuma lleva coco rallado.
 */
function juiceGlass(c: Hexes, flakes = false): ItemArt {
  const foam = Boolean(c.f);
  return {
    liquid: { chars: "aAb", foam: foam ? "fF" : "" },
    rows: [
      "....ss.", //
      "oooosoo",
      foam ? (flakes ? "ohfFsfo" : "ohffsFo") : "ohaasAo",
      foam && flakes ? "ohFffFo" : "ohaaaAo",
      "ohabaAo",
      "ohaaaAo",
      "ohbaAAo",
      "oggggGo",
      ".ooooo.",
    ],
    colors: { ...legend(c), h: GLASS.h, g: alpha(hex("#d8eef6"), 0.85), G: alpha(hex("#e8f6fb"), 0.95) },
  };
}

/** Copa de pie (champús, salpicón): el líquido `a`/`A` con trocitos `b` y `c`, y lo que asoma arriba (`top`). */
function goblet(c: Hexes & { top: string }): ItemArt {
  const { top, ...rest } = c;
  return {
    liquid: { chars: "aAbc" },
    rows: [
      "....t..", //
      "oooootoo".slice(0, 7),
      "ohabaAo",
      "oaacaAo",
      "oabaaAo",
      ".oacAo.",
      "..ogo..",
      "..ogo..",
      ".oggGo.",
      ".ooooo.",
    ],
    colors: { ...legend(rest), t: hex(top), h: GLASS.h, g: alpha(hex("#d8eef6"), 0.85), G: alpha(hex("#e8f6fb"), 0.95) },
  };
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
  // ---------- La carta colombiana: bebidas calientes ----------
  // El perico: el pocillo del tinto, con la leche que le aclara el color.
  perico: {
    fx: "steam",
    rows: [
      ".ooooo.", //
      ".opPpo.",
      ".owwWoo",
      ".owwWoo",
      "ooooooo",
      "oWwwwWo",
      ".ooooo.",
    ],
    colors: { ...CUP, p: hex("#a8703f"), P: hex("#e6c79a") },
    surface: { chars: "pP", inner: hex("#a8977e") },
  },
  // Pocillo de peltre (blanco con el borde azul y un desportillado) y su astilla de canela.
  "cafe-campesino": {
    fx: "steam",
    from: [1, 1],
    rows: [
      ".....s..", //
      "ooooso..",
      "occsCo..",
      "oBBBBoo.",
      "owwwWo.o",
      "owkwWo.o",
      "owwwWoo.",
      "oBBBBo..",
      ".oooo...",
    ],
    colors: { c: hex("#3b1f14"), C: hex("#5a3220"), s: hex("#9a5a2a"), B: hex("#3f6fb0"), w: hex("#f2f4f6"), W: hex("#c3ccd8"), k: hex("#2b3a55") },
    surface: { chars: "cC", inner: hex("#c3ccd8") },
  },
  // Taza verde con el agua de panela dorada y el cubo de queso flotando.
  "agua-panela-queso": {
    fx: "steam",
    from: [2, 0],
    rows: [
      "oooooo..", //
      "opPyYo..",
      "ogggGoo.",
      "ogggGo.o",
      "ogggGoo.",
      "ogggGo..",
      ".oooo...",
    ],
    colors: { p: hex("#c9862e"), P: hex("#e8a64a"), y: hex("#fff6d8"), Y: hex("#e6d4a0"), g: hex("#6a9a5a"), G: hex("#46704a") },
    surface: { chars: "pPyY", inner: hex("#355a38") },
  },
  // Taza grande con franja amarilla; el milo con sus grumitos encima.
  milo: {
    fx: "steam",
    from: [3, 0],
    rows: [
      "ooooooo..", //
      "okKkkKo..",
      "owwwwWoo.",
      "owwwwWo.o",
      "orrrrRo.o",
      "owwwwWoo.",
      "owwwwWo..",
      ".ooooo...",
    ],
    colors: { ...CUP, k: hex("#8a5634"), K: hex("#4e2c18"), r: hex("#e8b83a"), R: hex("#c0902a") },
    surface: { chars: "kK", inner: hex("#a8977e") },
  },
  // ---------- Bebidas frías ----------
  // Botella de vidrio con la gaseosa roja, tapa dorada y la etiqueta con la hojita.
  "gaseosa-manzana": {
    liquid: { chars: "rR" },
    rows: [
      ".oyo.", //
      ".oro.",
      ".oro.",
      "orrRo",
      "ohrRo",
      "owlwo",
      "owwwo",
      "ohrRo",
      "orrRo",
      ".ooo.",
    ],
    colors: { y: hex("#e8c050"), r: hex("#d8322e"), R: hex("#9a1c1c"), h: GLASS.h, w: hex("#fff4dc"), l: hex("#6fb34a") },
  },
  "jugo-mora": juiceGlass({ a: "#8e2a5e", A: "#621a40", b: "#b84a80", f: "#d690b8", F: "#b0648e", s: "#f4ecdc" }),
  "jugo-lulo": juiceGlass({ a: "#b9c23c", A: "#8a9426", b: "#4a5418", f: "#e2e8a0", F: "#bcc470", s: "#6fb34a" }),
  "jugo-guanabana": juiceGlass({ a: "#f3e7c4", A: "#cdb98a", b: "#2b2420", s: "#8cc653" }),
  // Vaso bajo con hielo: el maracuyá con sus pepas negras.
  "jugo-maracuya": {
    liquid: { chars: "aAbcC" },
    rows: [
      "oooooo", //
      "ohcCao",
      "ohacCo",
      "ohbaAo",
      "ohaabo",
      "ohbaAo",
      "oggggo",
      ".oooo.",
    ],
    colors: { a: hex("#f7c52a"), A: hex("#d49a14"), b: hex("#3a2a1a"), c: alpha(hex("#f4fbff"), 0.95), C: alpha(hex("#b8dcea"), 0.95), h: GLASS.h, g: alpha(hex("#d8eef6"), 0.85) },
  },
  // Vaso ancho con la tajada de mango en el borde.
  "jugo-mango": {
    liquid: { chars: "aAb" },
    rows: [
      "....omo.", //
      "oooomMmo",
      "ohaaaAo.",
      "ohabaAo.",
      "ohaaaAo.",
      "ohaaaAo.",
      "oggggGo.",
      ".ooooo..",
    ],
    colors: { a: hex("#ffb838"), A: hex("#e8901c"), b: hex("#ffd070"), m: hex("#ffd24a"), M: hex("#f08a1c"), h: GLASS.h, g: alpha(hex("#d8eef6"), 0.85), G: alpha(hex("#e8f6fb"), 0.95) },
  },
  // Frappé blanco con coco rallado arriba y pedacitos de limón.
  "limonada-coco": juiceGlass({ a: "#eee7cf", A: "#cfc3a0", b: "#9cc45a", f: "#fffaf0", F: "#d9ccaa", s: "#9cc45a" }, true),
  // Vaso grande de avena con canela espolvoreada.
  avena: {
    liquid: { chars: "aA", foam: "fFd" },
    rows: [
      "ooooooo", //
      "ohfdfFo",
      "ohaaaAo",
      "ohaaaAo",
      "ohaaaAo",
      "ohaaaAo",
      "ohaaaAo",
      "oggggGo",
      ".ooooo.",
    ],
    colors: { a: hex("#e6d09c"), A: hex("#c4a870"), f: hex("#f6e8c8"), F: hex("#dcc8a0"), d: hex("#8a5a2a"), h: GLASS.h, g: alpha(hex("#d8eef6"), 0.85), G: alpha(hex("#e8f6fb"), 0.95) },
  },
  // Vasito chico de kumis, blanco y espeso.
  kumis: {
    liquid: { chars: "aA", foam: "fF" },
    rows: [
      "oooooo", //
      "ohfFfo",
      "ohaaAo",
      "ohaaAo",
      "ohaaAo",
      "oggggo",
      ".oooo.",
    ],
    colors: { a: hex("#f4e8c8"), A: hex("#d0bd90"), f: hex("#fffdf6"), F: hex("#e8dcc0"), h: GLASS.h, g: alpha(hex("#d8eef6"), 0.85) },
  },
  // En copa: el champús amarillo con granos de maíz y su hojita de naranjo.
  champus: goblet({ a: "#f2b43c", A: "#c88a1e", b: "#fff09a", c: "#f2b43c", top: "#6fb34a" }),
  // En copa: el salpicón rojo de sandía con los cuadritos de fruta y la cuchara.
  salpicon: goblet({ a: "#f04a60", A: "#b82a40", b: "#ffd84a", c: "#8cc653", top: "#c9c9d0" }),
  // ---------- Confitería del cine ----------
  // La caja de rayas rojas con el copete de crispetas: los mordiscos se llevan primero el copete.
  crispetas: popcorn({ p: "#fff6d8", P: "#f3d27a", r: "#d93a2b", w: "#f4ecdc" }, "#fffbe8"),
  // Las de caramelo, doradas, en la caja de rayas azules.
  "crispetas-caramelo": popcorn({ p: "#e8a64a", P: "#c97a28", r: "#3a5fb0", w: "#f4ecdc" }, "#f6d49a"),
  // ---------- Panadería ----------
  // En herradura, pálido y con el queso que se tuesta en las puntas.
  "pan-yuca": {
    crumb: hex("#fff6d8"),
    rows: [
      "..ooooo..", //
      ".obBBbbo.",
      "obBbbbbdo",
      "obbooobdo",
      "obdo.obdo",
      "oDdo.odDo",
      ".oo...oo.",
    ],
    colors: { b: hex("#f0d48a"), B: hex("#fff0c0"), d: hex("#d4aa52"), D: hex("#b88a3c") },
  },
  // Alta y esponjosa, más pálida que el pandebono, con la grieta de arriba.
  almojabana: {
    crumb: hex("#fffae8"),
    rows: [
      "..oooo..", //
      ".oBBcbo.",
      "oBbbbcbo",
      "obbbbbbo",
      "obbbbbdo",
      "obbbbddo",
      "oddddDDo",
      ".oooooo.",
    ],
    colors: { b: hex("#f6e0a0"), B: hex("#fff4d4"), c: hex("#d8b870"), d: hex("#dcb468"), D: hex("#b8903e") },
  },
  // Anillo trenzado con azúcar por encima y el arequipe asomando por debajo.
  roscon: {
    crumb: hex("#f0c890"),
    rows: [
      "..ooooo..", //
      ".obsbsbo.",
      "osbooobso",
      "obso.osbo",
      "osbooobso",
      ".odadado.",
      "..ooooo..",
    ],
    colors: { b: hex("#d8943e"), s: hex("#fff8f0"), d: hex("#a86024"), a: hex("#7a3e14") },
  },
  // Media luna dorada con capas y el jamón rosado asomando.
  croissant: {
    crumb: hex("#fff0c8"),
    rows: [
      "...ooo...", //
      ".oobBboo.",
      "obdbdbdbo",
      "odbpPpbdo",
      "odoooooDo",
      ".o.....o.",
    ],
    colors: { b: hex("#e8a848"), B: hex("#f8d488"), d: hex("#b87424"), p: hex("#f09aa0"), P: hex("#d86a78"), D: hex("#8a5418") },
  },
  // Bolsita de papel con dos achiras asomando.
  achiras: {
    crumb: hex("#fff0c0"),
    rows: [
      ".oo.oo.", //
      ".oyoYo.",
      "ooyoYoo",
      "okkkkKo",
      "okllkKo",
      "okkkkKo",
      "okkkkKo",
      ".ooooo.",
    ],
    colors: { y: hex("#f4dc8a"), Y: hex("#d8b860"), k: hex("#c89a60"), K: hex("#9a7040"), l: hex("#d8322e") },
  },
  // ---------- Fritos y arepas ----------
  empanada: {
    crumb: hex("#f6d27a"),
    rows: [
      "...oooo...", //
      "..oaBaAo..",
      ".oaBaaaAo.",
      "oaaaaaaaAo",
      "ocCcCcCcCo",
      ".oooooooo.",
    ],
    colors: { a: hex("#eba43a"), A: hex("#c87a22"), B: hex("#f8c870"), c: hex("#d8902c"), C: hex("#a8601a") },
  },
  // Palito apanado con la punta de queso a la vista.
  dedito: {
    crumb: hex("#fff6d0"),
    rows: [
      ".ooooooo.", //
      "obBbBbBwo",
      "obbbbbbwo",
      "odddddddo",
      ".ooooooo.",
    ],
    colors: { b: hex("#e0a040"), B: hex("#f4c870"), d: hex("#b8782a"), w: hex("#fff6d0") },
  },
  "papa-rellena": {
    crumb: hex("#f0d890"),
    rows: [
      "..ooooo..", //
      ".obBbdbo.",
      "obBbbbbdo",
      "obdbbbbbo",
      "obbbdbbDo",
      ".oDbbbDo.",
      "..ooooo..",
    ],
    colors: { b: hex("#c8742a"), B: hex("#e89a4a"), d: hex("#8a4a1a"), D: hex("#9a5420") },
  },
  // Alargada con las puntas finas: la de yuca de la Costa.
  carimanola: {
    crumb: hex("#fff4dc"),
    rows: [
      "...oooo...", //
      ".oobBBboo.",
      "obbbbbbbbo",
      "obbbbbbbdo",
      ".ooddddoo.",
      "...oooo...",
    ],
    colors: { b: hex("#ecc070"), B: hex("#fae0a0"), d: hex("#c8903a") },
  },
  // Apanado naranja con el maduro y el queso asomando.
  aborrajado: {
    crumb: hex("#f6c84a"),
    rows: [
      "..ooooo..", //
      ".oAaaaAo.",
      "oaaaAaaao",
      "oayywyaAo",
      ".oaaaaao.",
      "..ooooo..",
    ],
    colors: { a: hex("#d88a34"), A: hex("#f0b060"), y: hex("#f8c838"), w: hex("#fff6e0") },
  },
  // Gruesa y dorada, con la costura donde metieron el huevo.
  "arepa-huevo": {
    crumb: hex("#fff0c4"),
    rows: [
      "..ooooo..", //
      ".oAaAaao.",
      "oaaaaaaao",
      "odwwyyddo",
      "oddddddDo",
      ".ooooooo.",
    ],
    colors: { a: hex("#f2b440"), A: hex("#fad07a"), d: hex("#d08a22"), D: hex("#a86a14"), w: hex("#fffaf0"), y: hex("#ffb020") },
  },
  // Pálida, con las marcas de la parrilla y la tajada de queso encima.
  "arepa-queso": {
    crumb: hex("#fff8e0"),
    rows: [
      "..ooooo..", //
      ".oaqqqao.",
      "oagqQqgao",
      "oagaagaao",
      "oddddddDo",
      ".ooooooo.",
    ],
    colors: { a: hex("#f4e2a8"), g: hex("#b8884a"), q: hex("#fffaf0"), Q: hex("#e8dcbc"), d: hex("#d8b870"), D: hex("#b89650") },
  },
  // Amarilla y gruesa, rellena de cuajada (la franja blanca del medio).
  "arepa-boyacense": {
    crumb: hex("#fff0b0"),
    rows: [
      "..ooooo..", //
      ".oyYyyyo.",
      "oyyyyyyYo",
      "owwwwwwWo",
      "oYyyyyyYo",
      ".ooooooo.",
    ],
    colors: { y: hex("#f6c43c"), Y: hex("#d89a20"), w: hex("#fff8ec"), W: hex("#e8dcc4") },
  },
  // De choclo: más naranja, con manchas tostadas y el quesito blanco encima.
  "arepa-choclo": {
    crumb: hex("#ffe08a"),
    rows: [
      "..ooooo..", //
      ".oaqqQao.",
      "oasqqQsao",
      "oaasaasao",
      "oddddddDo",
      ".ooooooo.",
    ],
    colors: { a: hex("#f0a830"), s: hex("#a8601a"), q: hex("#fffaf0"), Q: hex("#e6dcc0"), d: hex("#c8801e"), D: hex("#a06414") },
  },
  // ---------- Desayunos (en plato o taza: se comen a cucharadas y se ve el plato) ----------
  "huevos-pericos": {
    rows: [
      "..ooooo..", //
      ".oyYryyo.",
      "opyrygyPo",
      "opYyyryPo",
      ".oppppPo.",
      "..ooooo..",
    ],
    colors: { y: hex("#f8d040"), Y: hex("#fce890"), r: hex("#d8322e"), g: hex("#6fb34a"), p: hex("#f8f4ec"), P: hex("#d8d0c0") },
    surface: { chars: "yYrg", inner: hex("#f8f4ec") },
  },
  // Taza de barro con el caldo de leche, la yema y el cilantro; la cuchara adentro.
  changua: {
    fx: "steam",
    from: [2, 0],
    rows: [
      ".......s", //
      ".oooooso",
      "omgmmsMo",
      "ommgmyMo",
      "obbbbbBo",
      ".obbbBo.",
      "..oooo..",
    ],
    colors: { m: hex("#f8f2e0"), M: hex("#e2d8c0"), g: hex("#5aa84a"), y: hex("#ffc030"), s: hex("#c9c9d0"), b: hex("#b8683a"), B: hex("#8a4a26") },
    surface: { chars: "mMgy", inner: hex("#8a4a26") },
  },
  // Plato con fríjoles, arroz, huevo frito y un pedazo de arepa.
  calentado: {
    fx: "steam",
    from: [5, 0],
    rows: [
      "..oooooo..", //
      ".ofFfrrro.",
      "offfwywrro",
      "opaAapppPo",
      ".oppppppo.",
      "..oooooo..",
    ],
    colors: {
      f: hex("#7a3422"),
      F: hex("#a24a2e"),
      r: hex("#fbf6e8"),
      w: hex("#fffcf4"),
      y: hex("#ffb020"),
      a: hex("#f0d890"),
      A: hex("#d8b870"),
      p: hex("#f4f0e6"),
      P: hex("#d0c8b8"),
    },
    surface: { chars: "fFrwyaA", inner: hex("#f4f0e6") },
  },
  // Envuelto en hoja de plátano y amarrado, abierto arriba para que se vea la masa.
  tamal: {
    crumb: hex("#f0a050"),
    rows: [
      ".ooooooo.", //
      "olmmMmmLo",
      "olLllllLo",
      "ossssssso",
      "ollLlllLo",
      "olllllLLo",
      ".ooooooo.",
    ],
    colors: { l: hex("#4a8a3a"), L: hex("#2e6a2a"), m: hex("#e8903a"), M: hex("#f4b868"), s: hex("#e0c890") },
  },
  // ---------- Postres y dulces ----------
  cocada: {
    crumb: hex("#f4e0c0"),
    rows: [
      "..ooo..", //
      ".owcwo.",
      "ocwcwco",
      "ocCcCco",
      ".ooooo.",
    ],
    colors: { c: hex("#c89050"), C: hex("#a06a30"), w: hex("#fff4e0") },
  },
  bocadillo: {
    crumb: hex("#d8485a"),
    rows: [
      ".oooooo.", //
      "obbbbbBo",
      "obbbbbBo",
      "owwwwwWo",
      "owwwwwWo",
      ".oooooo.",
    ],
    colors: { b: hex("#b8283a"), B: hex("#8a1a2a"), w: hex("#fff8e8"), W: hex("#e8dcc4") },
  },
  natilla: {
    crumb: hex("#e8c088"),
    rows: [
      "ooooooo", //
      "oTTdTto",
      "odTTdto",
      "onnnnNo",
      "onnnnNo",
      "ooooooo",
    ],
    colors: { T: hex("#e8c088"), t: hex("#d8a868"), d: hex("#8a4a22"), n: hex("#c8904e"), N: hex("#a87034") },
  },
  // La oblea redonda con su rejilla y, en el canto, el arequipe con mora.
  obleas: {
    crumb: hex("#f6e6b8"),
    rows: [
      "..ooooo..", //
      ".owWwWwo.",
      "owWwWwWwo",
      "oWwWwWwWo",
      "oaamaaaAo",
      "owwwwwwWo",
      ".ooooooo.",
    ],
    colors: { w: hex("#f6e6b8"), W: hex("#d8c090"), a: hex("#9a5a24"), A: hex("#6e3a14"), m: hex("#6a1a4a") },
  },
  // Vasito de vidrio con el arroz con leche, pasas, canela y la cuchara parada.
  "arroz-con-leche": {
    liquid: { chars: "rRcp" },
    rows: [
      "....s..", //
      "oooosoo",
      "ohrcsro",
      "ohrprRo",
      "ohrrrRo",
      "ohprrRo",
      "oggggGo",
      ".ooooo.",
    ],
    colors: { r: hex("#f8f0dc"), R: hex("#ddd0b4"), c: hex("#9a5a2a"), p: hex("#5a2a3a"), s: hex("#c9c9d0"), h: GLASS.h, g: alpha(hex("#d8eef6"), 0.85), G: alpha(hex("#e8f6fb"), 0.95) },
  },
  // Una breva calada con el arequipe chorreando encima.
  brevas: {
    crumb: hex("#c86a5a"),
    rows: [
      "...os...", //
      "..oaAo..",
      ".oaAaao.",
      "obaabaao",
      "obBbbbBo",
      "obbbbBBo",
      ".obbBBo.",
      "..oooo..",
    ],
    colors: { s: hex("#6a8a3a"), a: hex("#c8782e"), A: hex("#e8a050"), b: hex("#6a2e2a"), B: hex("#4a1c1c") },
  },
  // Vaso plástico con capas de fruta y hielo, leche condensada arriba y el barquillo.
  cholado: {
    liquid: { chars: "mckpPrRyYgG" },
    rows: [
      ".....o.", //
      "....obo",
      "oooooBo",
      "ohmcmko",
      "ohpppPo",
      "ohrrrRo",
      "ohyyyYo",
      "ohgggGo",
      "oqqqqQo",
      ".ooooo.",
    ],
    colors: {
      b: hex("#e8c070"),
      B: hex("#c89a48"),
      m: hex("#fffaf0"),
      c: hex("#e0283a"),
      k: hex("#6fb34a"),
      p: hex("#ffb030"),
      P: hex("#e08a18"),
      r: hex("#c83a5a"),
      R: hex("#9a2440"),
      y: hex("#f8e060"),
      Y: hex("#d8bc3a"),
      g: hex("#a8c848"),
      G: hex("#86a430"),
      h: GLASS.h,
      q: alpha(hex("#d8eef6"), 0.85),
      Q: alpha(hex("#e8f6fb"), 0.95),
    },
  },
  // Base de merengue, crema rosada y dos fresas encima.
  merengon: {
    crumb: hex("#fff6f0"),
    rows: [
      "..oo.oo..", //
      ".orRoorRo",
      "ocpcpcpco",
      "owwwwwwWo",
      "owswwswWo",
      ".ooooooo.",
    ],
    colors: { r: hex("#e0283a"), R: hex("#b01a2a"), c: hex("#fff4f6"), p: hex("#f4a0b8"), w: hex("#fffcf4"), W: hex("#e8dccc"), s: hex("#f0e6d8") },
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
