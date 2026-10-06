// Productos de la cafetería y del bar del club en pixel-art: se llevan en la mano, salen en la carta y
// se consumen con F. Son chiquitos (caben en la mano del chibi); la carta los muestra ampliados.
// Cada uno cambia con el uso: los vasos se vacían, la comida pierde un mordisco y el cigarro se acorta.
import { SILLETA, heldParts, silletaCodeOf, usesOf } from "@hyvento/shared";
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
  liquid?: { chars: string; foam?: string; /** Color del vidrio ya vacío (por defecto, vidrio claro). */ empty?: RGBA };
  /**
   * Taza opaca: solo se ve la superficie (letras `chars` de la fila de arriba). Con cada sorbo una parte
   * se vuelve el interior de la taza (`inner`), como si el nivel bajara y asomara la loza.
   */
  surface?: { chars: string; inner: RGBA };
  /** Comida: color de la miga que queda a la vista en cada mordisco. */
  crumb?: RGBA;
  /** Brasa (cigarro, habano): letras que titilan y brillan al pitar. El papel (`body`) se quema. */
  ember?: { chars: string; body: string };
  /** Letras que no reciben la luz automática (etiquetas, rayas, pintas: detalles que ya van a mano). */
  flat?: string;
}

type Hexes = Record<string, string>;
const legend = (h: Hexes): Legend => Object.fromEntries(Object.entries(h).map(([k, v]) => [k, hex(v)]));

/** Caja de crispetas: el copete (`p`, `P`) sobre la caja de rayas (`r`, `w`) que se angosta abajo. */
function popcorn(c: Hexes, crumb: string): ItemArt {
  return {
    crumb: hex(crumb),
    // Las rayas de la caja van parejas (sin la luz automática, que las manchaba).
    flat: "rw",
    rows: [
      "..oPpo..", //
      ".oPHPpo.",
      "opPpPHPo",
      "oHpPpPpo",
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

/**
 * Pocillo blanco con asa y su platico (el tinto y sus parientes). La bebida es la superficie (`S` el brillo
 * de la izquierda, `s` el resto y, si viene, `m` una gota de leche) y se va a sorbos dejando ver la loza.
 */
function pocillo(c: Hexes): ItemArt {
  const milk = Boolean(c.m);
  return {
    fx: "steam",
    from: [3, 0],
    rows: [
      ".oooooo..", //
      milk ? ".oSmsso.." : ".oSssso..",
      ".o1wwWooo",
      ".o1wwWo.o",
      ".o1wwWooo",
      "oPPppppPo",
      ".ooooooo.",
    ],
    colors: { ...legend(c), 1: hex("#fffaf0"), w: hex("#f2e8d6"), W: hex("#cdbda2"), P: hex("#fffaf0"), p: hex("#ddd0b8") },
    surface: { chars: "Ssm", inner: hex("#b8a88e") },
    flat: "1Pp",
  };
}

const ITEMS: Record<string, ItemArt> = {
  // Negrito y cargado: casi negro, con el borde de crema rojiza.
  tinto: pocillo({ S: "#6e3a22", s: "#2a140c" }),
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
  // Taza ancha de franja roja, el chocolate espumoso y la tajada de queso hundiéndose.
  chocolate: {
    fx: "steam",
    from: [2, 0],
    rows: [
      "ooooooo..", //
      "oFfqQfo..",
      "o1wwwWooo",
      "orrrrRo.o",
      "o1wwwWooo",
      "o1wwwWo..",
      ".ooooo...",
    ],
    colors: {
      F: hex("#c8966a"),
      f: hex("#7a4428"),
      q: hex("#fff2c0"),
      Q: hex("#e6c46e"),
      1: hex("#fffaf0"),
      w: hex("#f2e8d6"),
      W: hex("#cdbda2"),
      r: hex("#d0452e"),
      R: hex("#8e2a1e"),
    },
    surface: { chars: "FfqQ", inner: hex("#b89a80") },
    flat: "1",
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
  // Bolita perfecta, más tostada que el pandebono y con el brillo del aceite.
  bunuelo: {
    crumb: hex("#f8dc9a"),
    flat: "H",
    rows: [
      "..oooo..", //
      ".oHBbbo.",
      "obBbbbbo",
      "obbbbbdo",
      "obbbbddo",
      ".odddDo.",
      "..oooo..",
    ],
    colors: { b: hex("#cf8a36"), B: hex("#eeb866"), H: hex("#fff2cc"), d: hex("#a4622a"), D: hex("#7a4418") },
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
      "oooooooo", //
      "offwwwwe",
      "oooooooo",
    ],
    colors: { f: hex("#d9923e"), w: hex("#f4ecdc"), e: hex("#ff7a2a") },
    flat: "fw",
  },
  // La lata: tapa de aluminio, el rojo con su brillo a la izquierda y la cinta blanca en diagonal.
  "coca-cola": {
    rows: [
      ".oooo.", //
      "o1ssSo",
      "ohrrRo",
      "ohwwro",
      "ohrwwo",
      "ohrrwo",
      "ohrrRo",
      "o1ssSo",
      ".oooo.",
    ],
    colors: { 1: hex("#f4f4f8"), s: hex("#c4c4cc"), S: hex("#8c8c98"), h: hex("#ff8a78"), r: hex("#d8262a"), R: hex("#8e1418"), w: hex("#fff8f0") },
    flat: "1sSw",
  },
  // ---------- La carta colombiana: bebidas calientes ----------
  // El perico: el pocillo del tinto, café con leche claro y la gota de leche encima.
  perico: pocillo({ S: "#e2b988", s: "#a8703f", m: "#fff4e0" }),
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
  // Taza grande con la franja verde (como el tarro); el milo con sus grumitos encima.
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
    colors: { ...CUP, k: hex("#a06a44"), K: hex("#4e2c18"), r: hex("#4f9a3a"), R: hex("#2e6a2a") },
    surface: { chars: "kK", inner: hex("#a8977e") },
    flat: "K",
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
  crispetas: popcorn({ p: "#fff6d8", P: "#f3d27a", H: "#ffffff", r: "#d93a2b", w: "#f4ecdc" }, "#fffbe8"),
  // Las de caramelo, doradas, en la caja de rayas azules.
  "crispetas-caramelo": popcorn({ p: "#e8a64a", P: "#c97a28", H: "#ffd890", r: "#3a5fb0", w: "#f4ecdc" }, "#f6d49a"),
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
  // La cocada: montoncito de coco rallado con panela, tostado abajo y con hebras blancas arriba.
  cocada: {
    crumb: hex("#f4e0c0"),
    rows: [
      "..oooo..", //
      ".owcwco.",
      "ocwcwcwo",
      "owcwcwco",
      "ocCcCcCo",
      ".oooooo.",
    ],
    colors: { c: hex("#c89050"), C: hex("#8a5a28"), w: hex("#fff4e0") },
    flat: "w",
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
    flat: "gG",
  },
  // ---------- El bar del club: lo colombiano ----------
  // La copita de guaro: vidrio grueso con la franja azul impresa y el anisado transparente.
  aguardiente: {
    liquid: { chars: "aA" },
    rows: [
      "oooooo", //
      "ohaaAo",
      "obbbBo",
      "ohaaAo",
      ".oggo.",
      ".oooo.",
    ],
    colors: { a: alpha(hex("#e2f2f4"), 0.92), A: alpha(hex("#b4d4dc"), 0.92), b: hex("#3a6ac8"), B: hex("#24448a"), h: GLASS.h, g: alpha(hex("#d8eef6"), 0.95) },
  },
  // La media de ron: botella chata de vidrio oscuro, tapa dorada y etiqueta roja con su filete dorado.
  "ron-viejo": {
    liquid: { chars: "aA", empty: alpha(hex("#d8b890"), 0.55) },
    rows: [
      ".oyyo.", //
      ".oaAo.",
      "ooaAoo",
      "ohaaAo",
      "orrrRo",
      "orggRo",
      "ohaaAo",
      "ohaaAo",
      ".oooo.",
    ],
    colors: { y: hex("#e8c050"), a: hex("#9a4a14"), A: hex("#5e2a0a"), r: hex("#c0302a"), R: hex("#86201c"), g: hex("#f0cf6a"), h: alpha(hex("#f4d8b0"), 0.9) },
    flat: "gyrR",
  },
  // El shot de tequila: la copita con el borde de sal y la cuña de limón pegada al lado.
  tequila: {
    liquid: { chars: "aA" },
    rows: [
      "ossssoo.", //
      "ohaaAoLo",
      "ohaaAolo",
      "ohaaAoo.",
      ".oggo...",
      ".oooo...",
    ],
    colors: { s: hex("#fffcf4"), a: hex("#f2c24a"), A: hex("#c89020"), L: hex("#b8e060"), l: hex("#6aa83a"), h: GLASS.h, g: alpha(hex("#d8eef6"), 0.95) },
    flat: "sLl",
  },
  // Refajo: el vaso cervecero con la mezcla naranja de cerveza y gaseosa, y la espuma.
  refajo: {
    liquid: { chars: "aAb", foam: "fF" },
    rows: [
      "ooooooo", //
      "ofFfFfo",
      "ohaaaAo",
      "ohabaAo",
      ".ohaAo.",
      ".ohbAo.",
      ".ohaAo.",
      ".oggGo.",
      ".ooooo.",
    ],
    colors: {
      f: hex("#fffaf0"),
      F: hex("#e8dcc4"),
      a: hex("#f5982a"),
      A: hex("#c46a16"),
      b: hex("#ffd07a"),
      h: GLASS.h,
      g: alpha(hex("#d8eef6"), 0.85),
      G: alpha(hex("#e8f6fb"), 0.95),
    },
  },
  // Michelada: el borde de sal con ají, la cerveza oscura con limón y la rodaja pegada al vaso.
  michelada: {
    liquid: { chars: "aAb" },
    rows: [
      "......oo.", //
      "orsrsroLo",
      "ohaaaAolo",
      "ohabaAoo.",
      "ohaaaAo..",
      "ohaaaAo..",
      "ohabaAo..",
      "oggggGo..",
      ".ooooo...",
    ],
    colors: {
      r: hex("#d8402a"),
      s: hex("#fff8ec"),
      a: hex("#d88a2a"),
      A: hex("#a05a16"),
      b: hex("#ffc870"),
      L: hex("#b8e060"),
      l: hex("#6aa83a"),
      h: GLASS.h,
      g: alpha(hex("#d8eef6"), 0.85),
      G: alpha(hex("#e8f6fb"), 0.95),
    },
    flat: "rsLl",
  },
  // La lulada con ron de Cali: en copa, con sus pepitas, hielo y la cereza encima.
  "lulada-ron": goblet({ a: "#d8c43a", A: "#a8962a", b: "#3a4a14", c: "#f4fbff", top: "#e0283a" }),
  // Canelazo: pocillo de barro vidriado con la bebida caliente y la astilla de canela.
  canelazo: {
    fx: "steam",
    from: [1, 1],
    rows: [
      ".....s..", //
      "ooooso..",
      "oCcsco..",
      "oBBBBoo.",
      "owwwWo.o",
      "owkwWo.o",
      "owwwWoo.",
      "oBBBBo..",
      ".oooo...",
    ],
    colors: { c: hex("#c8641e"), C: hex("#f0a050"), s: hex("#8a4a1e"), B: hex("#f0c070"), w: hex("#b8603a"), W: hex("#84401e"), k: hex("#5a2412") },
    surface: { chars: "cC", inner: hex("#6a3018") },
    flat: "Bk",
  },
  // Coco loco: el coco peludo abierto arriba, con el pitillo y la sombrillita rosada.
  "coco-loco": {
    rows: [
      "....opPpo", //
      "......s..",
      "..ooooso.",
      ".okKkkko.",
      "obBbhbbbo",
      "obhbbbhdo",
      "obbbhbbdo",
      ".odbbbddo",
      "..oddDo..",
      "...ooo...",
    ],
    colors: {
      p: hex("#ff6a9a"),
      P: hex("#ffd0e0"),
      s: hex("#f4ecdc"),
      k: hex("#fff6e6"),
      K: hex("#e8dcc4"),
      b: hex("#8a5a30"),
      B: hex("#b47e48"),
      h: hex("#a8703e"),
      d: hex("#5e3a1e"),
      D: hex("#48280f"),
    },
    surface: { chars: "kK", inner: hex("#d8c49a") },
    flat: "pPsh",
  },
  // Chicha: la totuma grande con la chicha espumosa de maíz y el pirograbado de rayitas.
  chicha: {
    rows: [
      ".ooooooo.", //
      "ofFbffFfo",
      "otttttTTo",
      "otxtxtxTo",
      ".otttTTo.",
      "..ooooo..",
    ],
    colors: { f: hex("#f2e0a0"), F: hex("#d4ba6a"), b: hex("#fffbe0"), t: hex("#c09050"), T: hex("#8a6030"), x: hex("#6a4424") },
    surface: { chars: "fFb", inner: hex("#e6c98a") },
    flat: "x",
  },
  // La pola dorada: botella ámbar con la tapa y la etiqueta doradas (sin marca).
  "pola-dorada": {
    liquid: { chars: "nN", empty: alpha(hex("#c08850"), 0.7) },
    rows: [
      ".oyo.", //
      ".ono.",
      ".ono.",
      "oonoo",
      "ohnNo",
      "oLLlo",
      "oLrLo",
      "ohnNo",
      "ohnNo",
      ".ooo.",
    ],
    colors: { y: hex("#e8c050"), n: hex("#6a3a14"), N: hex("#48240c"), L: hex("#f4d67a"), l: hex("#c8a040"), r: hex("#c83a2a"), h: alpha(hex("#f4d8b0"), 0.85) },
    flat: "yLlr",
  },
  // Mojito: vaso alto con hierbabuena, limón y hielo; la ramita asoma arriba.
  mojito: {
    liquid: { chars: "aAiml" },
    rows: [
      "...oMo.", //
      "ooooMoo",
      "ohimaAo",
      "ohaiaAo",
      "ohmalAo",
      "ohaamAo",
      "ohiaaAo",
      "ohmaaAo",
      "oggggGo",
      ".ooooo.",
    ],
    colors: {
      a: alpha(hex("#eef8e4"), 0.92),
      A: alpha(hex("#c8e0c0"), 0.92),
      i: alpha(hex("#ffffff"), 0.95),
      m: hex("#4f9a3a"),
      M: hex("#7cc850"),
      l: hex("#b8e060"),
      h: GLASS.h,
      g: alpha(hex("#d8eef6"), 0.85),
      G: alpha(hex("#e8f6fb"), 0.95),
    },
    flat: "mMl",
  },
  // Cuba libre: vaso alto con ron y cola oscura, hielo y la rodaja de limón en el borde.
  "cuba-libre": {
    liquid: { chars: "cCi" },
    rows: [
      ".....oLo", //
      "oooooolo",
      "ohiccCo.",
      "ohcicCo.",
      "ohccCCo.",
      "ohcicCo.",
      "ohccCCo.",
      "ohcccCo.",
      "oggggGo.",
      ".ooooo..",
    ],
    colors: {
      c: hex("#5a2412"),
      C: hex("#341208"),
      i: alpha(hex("#e8f6ff"), 0.9),
      L: hex("#d8f080"),
      l: hex("#7ab83a"),
      h: GLASS.h,
      g: alpha(hex("#d8eef6"), 0.85),
      G: alpha(hex("#e8f6fb"), 0.95),
    },
    flat: "Ll",
  },
  // ---------- Lo que vende el Man del Sombrero (todo de mentiras) ----------
  // La bareta: cono de papel con boquilla de cartón y pintas verdes; se quema como el cigarro.
  bareta: {
    fx: "smoke",
    ember: { chars: "e", body: "wg" },
    rows: [
      "...oooooo", //
      "ooowwgwwe",
      "ofwgwwwge",
      "ooooooooo",
    ],
    colors: { f: hex("#d9b27a"), w: hex("#f1ead2"), g: hex("#6f9a3a"), e: hex("#ff7a2a") },
  },
  // El brownie con su hojita encima.
  "brownie-magico": {
    crumb: hex("#8a5634"),
    rows: [
      "...oo...", //
      "..olLo..",
      "oooooooo",
      "obbbbbBo",
      "obcbbcBo",
      "oBBBBBBo",
      "oooooooo",
    ],
    colors: { b: hex("#6b3a22"), B: hex("#4a2616"), c: hex("#3a1e10"), l: hex("#79b84a"), L: hex("#4f8a30") },
  },
  // Bolsita de cierre con el cierre rojo: el polvo baja con cada esnifada.
  "perico-bolsa": {
    liquid: { chars: "pP" },
    rows: [
      "ooooooo", //
      "orrrrro",
      "ohGGGGo",
      "ohpppPo",
      "ohpppPo",
      "oppppPo",
      ".ooooo.",
    ],
    colors: {
      r: hex("#c83a3a"),
      G: alpha(hex("#e8f0f4"), 0.55),
      p: hex("#f6f4ee"),
      P: hex("#d8d4ca"),
      h: GLASS.h,
    },
  },
  // Un hongo de sombrero dorado con pintas, como los de potrero.
  "hongos-quindio": {
    crumb: hex("#e8dcc0"),
    rows: [
      "..oooo..", //
      ".occdcCo",
      "ocdccdCo",
      "oCCCCCCo",
      ".oossoo.",
      "..osso..",
      "..oooo..",
    ],
    colors: { c: hex("#c89a4a"), C: hex("#96702e"), d: hex("#f4e6c0"), s: hex("#efe4cc") },
  },
  // El cartoncito con la mariposa amarilla (la de Macondo) y la línea de puntos para partirlo.
  carton: {
    crumb: hex("#e8dcc4"),
    rows: [
      "ooooooo", //
      "oyywyyo",
      "oyYkYyo",
      "owykywo",
      "owwkwwo",
      "opwpwpo",
      "ooooooo",
    ],
    colors: { w: hex("#f4ecdc"), y: hex("#f4d35e"), Y: hex("#d99a2a"), k: hex("#3a2a1a"), p: hex("#c8b89c") },
    flat: "yYkp",
  },
  // La totumita del yagé: se ve el brebaje oscuro y, al tomar, el fondo de la totuma.
  yage: {
    rows: [
      ".oooooo.", //
      "oaaaaaAo",
      "otttttTo",
      "otttttTo",
      ".otttTo.",
      "..oooo..",
    ],
    colors: { t: hex("#b88a4a"), T: hex("#8a6030"), a: hex("#4a2e1a"), A: hex("#3a2012") },
    surface: { chars: "aA", inner: hex("#d8b878") },
  },
  // Chirrinchi: botellita sin etiqueta, tapada con corcho.
  chirrinchi: {
    liquid: { chars: "aA" },
    rows: [
      ".oko.", //
      ".oho.",
      "oohoo",
      "ohaAo",
      "ohaAo",
      "ohaAo",
      "ohaAo",
      "ooooo",
    ],
    colors: { k: hex("#b8864a"), a: hex("#ddd8b0"), A: hex("#b8b088"), h: GLASS.h },
  },
  // Viche: botella reciclada con una etiqueta de papel a mano.
  viche: {
    liquid: { chars: "aA" },
    rows: [
      ".oko..", //
      ".oko..",
      "oohoo.",
      "ohaaAo",
      "ohllAo",
      "ohaaAo",
      "ohaaAo",
      "ohaaAo",
      "oooooo",
    ],
    colors: { k: hex("#8a5a30"), a: hex("#d9b86a"), A: hex("#a8843a"), l: hex("#f4ecdc"), h: GLASS.h },
    flat: "l",
  },
  // El popper: frasquito de vidrio café con la tapa amarilla y la etiqueta de rayas.
  popper: {
    liquid: { chars: "bB", empty: alpha(hex("#d0a070"), 0.6) },
    rows: [
      ".ooo.", //
      "oyYyo",
      "ooooo",
      "ohbBo",
      "oLlLo",
      "ohbBo",
      ".ooo.",
    ],
    colors: { y: hex("#f6d040"), Y: hex("#c89a1e"), b: hex("#8a4a1a"), B: hex("#5a2a0e"), L: hex("#f4ecdc"), l: hex("#d8322e"), h: alpha(hex("#f4d8b0"), 0.9) },
    flat: "Ll",
  },
  // El tusi: la bolsita del cierre morado con el polvito rosado y la estrellita pegada.
  tusi: {
    liquid: { chars: "pP" },
    rows: [
      "ooooooo", //
      "ovvvvVo",
      "ohGGkGo",
      "ohpppPo",
      "ohpppPo",
      "oppppPo",
      ".ooooo.",
    ],
    colors: { v: hex("#9a4ac8"), V: hex("#6a2a98"), G: alpha(hex("#f4e8f4"), 0.55), k: hex("#fff27a"), p: hex("#ff8ac8"), P: hex("#d8569e"), h: GLASS.h },
    flat: "k",
  },
  // La keta: frasquito de vidrio con la tapa azul, los cristalitos y la etiqueta del caballo.
  keta: {
    liquid: { chars: "wW" },
    rows: [
      ".ooo.", //
      "oBbBo",
      "ooooo",
      "ohwWo",
      "olLlo",
      "ohwWo",
      "ohwWo",
      ".ooo.",
    ],
    colors: { B: hex("#6a9ae8"), b: hex("#3a5ab8"), w: hex("#f4f4f8"), W: hex("#c8cad8"), l: hex("#f4ecdc"), L: hex("#8a5a30"), h: GLASS.h },
    flat: "wWlL",
  },
  // El chicle de mambe: la barrita envuelta en papel verde con la hojita y las puntas plateadas.
  "chicle-mambe": {
    crumb: hex("#9ab85a"),
    rows: [
      "oooooooo", //
      "owggggwo",
      "owgLlgwo",
      "owggggwo",
      "oooooooo",
    ],
    colors: { w: hex("#e8e8ec"), g: hex("#7a9a3a"), L: hex("#c8ec70"), l: hex("#3f7a2a") },
    flat: "Ll",
  },
  // La aguapanela trucada: pocillo de peltre de borde rojo, dorada y con un hongo flotando.
  "aguapanela-trucada": {
    fx: "steam",
    from: [2, 0],
    rows: [
      "ooooooo..", //
      "oSsmMso..",
      "orrrrRooo",
      "o1wwwWo.o",
      "o1wkwWooo",
      "o1wwwWo..",
      ".ooooo...",
    ],
    colors: {
      S: hex("#f6d27a"),
      s: hex("#d89a38"),
      m: hex("#b8823a"),
      M: hex("#fff0d0"),
      r: hex("#d0402e"),
      R: hex("#8e2a1e"),
      1: hex("#ffffff"),
      w: hex("#eef2f4"),
      W: hex("#c0c8d4"),
      k: hex("#2b3a55"),
    },
    surface: { chars: "SsmM", inner: hex("#dfe4ea") },
    flat: "1kmM",
  },
  // La galleta de la abuela: redonda y dorada, con los chips verdes "de menta".
  "galleta-abuela": {
    crumb: hex("#e8c080"),
    rows: [
      "..oooo..", //
      ".oBbgbo.",
      "obgbbbgo",
      "obbbgbbo",
      "ogbbbbdo",
      ".odgdDo.",
      "..oooo..",
    ],
    colors: { b: hex("#d8a456"), B: hex("#f0c880"), g: hex("#4f9a3a"), d: hex("#a8703a"), D: hex("#7a4a24") },
    flat: "g",
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
  // El agua de panela de la cafetera de la casa (no está en la carta): en jarrito de vidrio, dorada y con
  // la rodaja de limón en el borde.
  aguapanela: {
    fx: "steam",
    from: [2, 0],
    liquid: { chars: "aAb" },
    rows: [
      "....olo.", //
      "ooooLlo.",
      "ohbbAooo",
      "ohaaAo.o",
      "ohaaAooo",
      "oggggo..",
      ".oooo...",
    ],
    colors: { a: hex("#e0a23a"), A: hex("#b0701c"), b: hex("#f6d27a"), l: hex("#f3e36a"), L: hex("#9fc43a"), h: GLASS.h, g: alpha(hex("#d8eef6"), 0.85) },
    flat: "lL",
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
  // ---------- Jardín vivo: lo que se cosecha, la miel y las herramientas del cobertizo ----------
  cilantro: {
    crumb: hex("#b8e89a"),
    rows: [
      ".o.o.o..", //
      "olololo.",
      "olLlLlLo",
      ".olLlLo.",
      "..oggo..",
      "..obbo..",
      "..oggo..",
      "...oo...",
    ],
    colors: { l: hex("#6fbf4a"), L: hex("#3f8a2e"), g: hex("#8fcf5a"), b: hex("#e8d08a") },
  },
  fresa: {
    crumb: hex("#fbd0c8"),
    rows: [
      "..olLo..", //
      ".olLlLo.",
      "orrrrrro",
      "oryrrryo",
      "orrryrRo",
      ".oryrRo.",
      "..orRo..",
      "...oo...",
    ],
    colors: { r: hex("#e8323c"), R: hex("#a8202a"), y: hex("#f7e27a"), l: hex("#5fa83e"), L: hex("#3f7a2e") },
  },
  tomate: {
    crumb: hex("#f6b0a0"),
    rows: [
      "...lL...", //
      "..olLlo.",
      ".orrrRro",
      "orHrrrRo",
      "orrrrrRo",
      "orrrrRRo",
      ".oRRRRo.",
      "..oooo..",
    ],
    colors: { r: hex("#e04030"), R: hex("#a82820"), H: hex("#ff9a80"), l: hex("#6fb34a"), L: hex("#3f7a2e") },
  },
  papa: {
    crumb: hex("#fff0b8"),
    rows: [
      "..oooo..", //
      ".oyHyyo.",
      "oyyyyyYo",
      "oyydyyYo",
      "oyyyydYo",
      "oyyyyYYo",
      ".oYYYYo.",
      "..oooo..",
    ],
    colors: { y: hex("#e8c24a"), Y: hex("#b8902a"), H: hex("#f7e08a"), d: hex("#8a6a2a") },
  },
  mazorca: {
    crumb: hex("#fff6c8"),
    rows: [
      "..oooo..", //
      ".okKkko.",
      ".okkKko.",
      ".oKkkKo.",
      ".okkKko.",
      ".okKkko.",
      "oLokkoLo",
      "oLLooLLo",
      ".oLLLLo.",
      "..oooo..",
    ],
    colors: { k: hex("#f2c83a"), K: hex("#d09a22"), L: hex("#8fbf5a") },
  },
  lulo: {
    crumb: hex("#e8e26a"),
    rows: [
      "...oLo..", //
      "..oLlLo.",
      ".oaaaAo.",
      "oaHaaaAo",
      "oaaaaaAo",
      "oaaaaAAo",
      ".oAAAAo.",
      "..oooo..",
    ],
    colors: { a: hex("#f09a2a"), A: hex("#c06a18"), H: hex("#ffd08a"), l: hex("#6fb34a"), L: hex("#3f7a2e") },
  },
  // Frasco de miel con la tapa de tela a cuadros: se come a cucharadas y el nivel baja.
  miel: {
    liquid: { chars: "aA" },
    rows: [
      ".oooooo.", //
      ".ocCcCo.",
      "oooooooo",
      "ohaaaaAo",
      "ohaaaaAo",
      "oaaaaaAo",
      "oaaaaAAo",
      ".oooooo.",
    ],
    colors: { a: hex("#f0a830"), A: hex("#c07a18"), c: hex("#d9533a"), C: hex("#f4ecdc"), h: GLASS.h },
  },
  // La regadera verde: llena, con una gota que asoma por la flor; vacía, sin gota.
  // El celular de tapa, abierto: la tapa con la pantalla verdosa, la bisagra y el teclado (vinotinto).
  celular: {
    rows: [
      ".ooooo.", //
      "ovvvvvo",
      "ovsssvo",
      "ovsSsvo",
      "ovvhvvo",
      ".ooooo.",
      "ovkvkvo",
      "ovvvvvo",
      "ovkvkvo",
      ".ooooo.",
    ],
    colors: { v: hex("#7c2638"), s: hex("#b9cba4"), S: hex("#dce8cf"), h: hex("#ff86ae"), k: hex("#fbd6df") },
    flat: "sShk",
  },
  regadera: {
    rows: [
      ".........w", //
      "...ooo..oo",
      "..o...o.oo",
      ".ooooooogo",
      ".oGgggGoo.",
      ".oGgggGgo.",
      ".oGgggGo..",
      ".oGGGGGo..",
      "..ooooo...",
    ],
    colors: { g: hex("#5aa04a"), G: hex("#3f7a34"), w: hex("#7fd0ff") },
  },
  "regadera-vacia": {
    rows: [
      "...ooo..oo", //
      "..o...o.oo",
      ".ooooooogo",
      ".oGgggGoo.",
      ".oGgggGgo.",
      ".oGgggGo..",
      ".oGGGGGo..",
      "..ooooo...",
    ],
    colors: { g: hex("#6f9a5e"), G: hex("#4a6e40") },
  },
  // ---------- La cocina: los platos que se hacen en la estufa con lo del huerto ----------
  // Arepita dulce de maíz, dorada, con un hilo de miel encima.
  "pan-miel": {
    crumb: hex("#fff0b8"),
    rows: [
      "..oooooo..", //
      ".obbhhbbo.",
      "obbbbhhbBo",
      "obhhbbbbBo",
      "oBbbhhbBBo",
      ".oBBBBBBo.",
      "..oooooo..",
    ],
    colors: { b: hex("#e8b04a"), B: hex("#b8782a"), h: hex("#ffd86a") },
  },
  // Platico hondo con fresas bañadas en miel: a cucharadas asoma la loza.
  "fresas-miel": {
    surface: { chars: "rRhy", inner: hex("#e8dccb") },
    rows: [
      ".oooooooo.", //
      "orhrRyrhro",
      "oRrhyrRhro",
      ".owwwwwWo.",
      "..owwwWo..",
      "...oooo...",
    ],
    colors: { r: hex("#e8323c"), R: hex("#a8202a"), h: hex("#f7c040"), y: hex("#f7e27a"), w: hex("#f4ecdc"), W: hex("#cbbba2") },
  },
  // Lulada: el lulo machacado con hielo y miel, con trocitos verdes y pitillo.
  lulada: juiceGlass({ a: "#e8b43a", A: "#b8841e", b: "#5a8a2a", f: "#ffd86a", F: "#f0b840", s: "#8fd0e0" }),
  // Sopa de verduras en cuenco de barro: caldo con tomate y cilantro.
  "sopa-verduras": {
    fx: "steam",
    surface: { chars: "sSgt", inner: hex("#e8d8c0") },
    rows: [
      ".oooooooo.", //
      "ossgsstsso",
      "osSsstsgSo",
      ".occcccCo.",
      "..occcCo..",
      "...oooo...",
    ],
    colors: { s: hex("#e8a050"), S: hex("#c07a38"), g: hex("#5fa83e"), t: hex("#d8402a"), c: hex("#b86a3a"), C: hex("#8a4a2a") },
  },
  // Ajiaco en olla de barro negra: caldo amarillo, mazorca, cilantro y su cucharada de crema.
  ajiaco: {
    fx: "steam",
    surface: { chars: "sSgkw", inner: hex("#8a7a6a") },
    rows: [
      ".oooooooo.", //
      "oskswsgsSo",
      "osgssksSSo",
      "occcccccCo",
      ".occcccCo.",
      "..oooooo..",
    ],
    colors: { s: hex("#f0d060"), S: hex("#c8a83a"), g: hex("#4f9a3a"), k: hex("#fff0a0"), w: hex("#fff8e8"), c: hex("#4a4038"), C: hex("#2a241f") },
  },
  // Sancocho en olla de aluminio con orejas: caldo claro, mazorca, papa y cilantro por encima.
  "sancocho-abuela": {
    fx: "steam",
    surface: { chars: "sSgpm", inner: hex("#b8bcc0") },
    rows: [
      "o.oooooo.o", //
      "ooppsgmsoo",
      ".osgmssgo.",
      ".oaaaaaAo.",
      ".oaaaaaAo.",
      "..oooooo..",
    ],
    colors: { s: hex("#e8c880"), S: hex("#c8a060"), g: hex("#4f9a3a"), p: hex("#f0e0a0"), m: hex("#f2c230"), a: hex("#a8acb0"), A: hex("#787c80") },
  },
  // Tarta redonda de lulo y fresa con brillo de miel sobre la masa dorada.
  "tarta-lulo": {
    crumb: hex("#f7d898"),
    rows: [
      ".oooooooo.", //
      "ohlhfhlhho",
      "oflhhlhfho",
      "ohhlfhhlho",
      "oPPPPPPPPo",
      ".oppppppo.",
      "..oooooo..",
    ],
    colors: { h: hex("#f4c04a"), l: hex("#f09a2a"), f: hex("#e8323c"), P: hex("#c8883a"), p: hex("#a86a2a") },
  },
  ...Object.fromEntries(
    (
      [
        // El dibujito del frente (4x3): c y C el fruto, g la hoja, "." el papel.
        ["cilantro", "#6fbf4a", "#3f8a2e", ["g.g.", "CgCg", ".gC."]],
        ["fresa", "#e8323c", "#a8202a", [".gg.", "cccC", ".cC."]],
        ["tomate", "#e04030", "#a82820", [".g..", "cccC", "cCCC"]],
        ["papa", "#e8c24a", "#b8902a", [".cc.", "cCcc", ".CC."]],
        ["maiz", "#f2c83a", "#d09a22", [".cc.", "cCcC", "g..g"]],
        ["lulo", "#f09a2a", "#c06a18", [".g..", "cccC", ".CC."]],
        // Las del invernadero.
        ["uchuva", "#f2b233", "#b87a18", ["g..g", ".cc.", ".C.."]],
        ["pitahaya", "#e8457a", "#a8205a", ["g.cg", "cCcC", "gCCg"]],
        ["cacao", "#8a4a26", "#5a2a14", [".cc.", "cCCc", ".cc."]],
        ["cafe", "#c8302a", "#6a3a1e", ["g...", "c.c.", ".C.C"]],
        // Las flores de la Feria de las flores.
        ["clavel", "#e0303c", "#a01828", ["c.c.", "cCcC", ".g.."]],
        ["astromelia", "#f08a2a", "#b8501a", ["cg.c", "C..C", ".gg."]],
        ["girasol", "#f7c830", "#7a4a1a", [".cc.", "cCCc", "..g."]],
        ["hortensia", "#7a8ae8", "#5a4ab8", ["cCc.", "CcCc", ".cg."]],
      ] as const
    ).map(([crop, c, C, motif]) => [`semillas-${crop}`, seedPacket(c, C, motif)]),
  ),
  // ---------- Lo que se cosecha en el invernadero ----------
  uchuva: {
    crumb: hex("#fff0a0"),
    rows: [
      "..hHh...", //
      ".hHohHh.",
      "..oyyo..",
      ".oyYyyo.",
      ".oyyyYo.",
      "..oYYo..",
      "...oo...",
    ],
    colors: { y: hex("#f7b733"), Y: hex("#c8861a"), h: hex("#e8d8a0"), H: hex("#b8a070") },
  },
  pitahaya: {
    crumb: hex("#fffaf2"),
    rows: [
      "...ol...", //
      "..oppo..",
      ".lpppPo.",
      "oppwpppo",
      "opppwPPo",
      "olpppPlo",
      ".oPPPPo.",
      "..oooo..",
    ],
    colors: { p: hex("#e8457a"), P: hex("#a8205a"), w: hex("#fff4f0"), l: hex("#7fbf4a") },
  },
  // ---------- Las flores del huerto (Feria de las flores): una vara con su flor ----------
  // Clavel rojo de borde rizado.
  clavel: {
    rows: [
      "..o.o.o..", //
      ".oRoRoRo.",
      "oRrsrsrRo",
      "oRrrrrrRo",
      ".oRrrrRo.",
      "..ooGoo..",
      "...oGo...",
      "..oLGo...",
      "...oGo...",
      "....o....",
    ],
    colors: { r: hex("#e0303c"), R: hex("#a01828"), s: hex("#ff8a9a"), G: hex("#4f9a3a"), L: hex("#7fc04e") },
    flat: "s",
  },
  // Dos astromelias naranjas con sus pintas, en un mismo tallo.
  astromelia: {
    rows: [
      ".oo..oo..", //
      "onNooanNo",
      "onpNonpNo",
      ".onNoonNo",
      "..oGo.oGo",
      "...oGoGo.",
      "....oGo..",
      "...oLGo..",
      "....oGo..",
      "....oo...",
    ],
    colors: { n: hex("#f08a2a"), N: hex("#c05a1a"), a: hex("#f7b04a"), p: hex("#6a2a14"), G: hex("#4f9a3a"), L: hex("#7fc04e") },
    flat: "p",
  },
  // Girasol: pétalos amarillos alrededor del centro café.
  girasol: {
    rows: [
      "..oyoyo..", //
      ".oyYyYyo.",
      "oyYbbbYyo",
      "oyybBbyyo",
      "oyYbbbYyo",
      ".oyYyYyo.",
      "..oyoGo..",
      "....oGo..",
      "...oLGo..",
      "....oo...",
    ],
    colors: { y: hex("#f7c830"), Y: hex("#d89a1a"), b: hex("#7a4a1a"), B: hex("#4a2a10"), G: hex("#4f9a3a"), L: hex("#7fc04e") },
    flat: "bB",
  },
  // Hortensia: una bola de florecitas azules y lilas.
  hortensia: {
    rows: [
      "..oooo...", //
      ".obBvbo..",
      "obvbBvbo.",
      "oBbvbBvo.",
      "obvBbvbo.",
      ".ovbvBo..",
      "..oooGo..",
      "....oGo..",
      "...oLGo..",
      "....oo...",
    ],
    colors: { b: hex("#7a8ae8"), B: hex("#5a4ab8"), v: hex("#b48ae0"), G: hex("#4f9a3a"), L: hex("#7fc04e") },
    flat: "bBv",
  },
  // La chocolatina hecha con el cacao de la casa: una barra con su papel dorado.
  chocolatina: {
    crumb: hex("#b87a4a"),
    rows: [
      "ooooooo.", //
      "occCccgo",
      "oCcccCgo",
      "occCccgo",
      "oCcccCgo",
      "ooooooo.",
    ],
    colors: { c: hex("#6a3a1e"), C: hex("#4a2410"), g: hex("#e8c050") },
  },
  // ---------- Capítulo 2: las piezas del reloj de pie ----------
  // Engranaje de bronce con el hueco del eje y los dientes alrededor.
  "pieza-engranaje": {
    rows: [
      "..o.o.o..", //
      ".obobobo.",
      "obBBBBBbo",
      ".bBbobBb.",
      "obBo.oBbo",
      ".bBbobBb.",
      "obBBBBBbo",
      ".obobobo.",
      "..o.o.o..",
    ],
    colors: { b: hex("#a8742c"), B: hex("#d8a24a") },
  },
  // Resorte de acero templado, en espiral.
  "pieza-resorte": {
    rows: [
      ".ooooo.", //
      "osSSSso",
      ".ooooo.",
      "oSSSSSo",
      ".ooooo.",
      "osSSSso",
      ".ooooo.",
      "oSSSSSo",
      ".ooooo.",
    ],
    colors: { s: hex("#8a96a8"), S: hex("#c8d2e0") },
  },
  // El péndulo: la varilla dorada y el disco con el brillo al centro.
  "pieza-pendulo": {
    rows: [
      "..ooo..", //
      "..oGo..",
      "..oGo..",
      "..oGo..",
      ".ooGoo.",
      "oGGYGGo",
      "oGYWYGo",
      "oGGYGGo",
      ".ooooo.",
    ],
    colors: { G: hex("#c9962a"), Y: hex("#f2d16a"), W: hex("#fff6d0") },
  },
  // ---------- Capítulo 3: la llavecita del lago ----------
  // La llavecita oxidada: argolla con su hueco, la caña con un parche verde de agua y dos dientes.
  "llave-oxidada": {
    rows: [
      ".ooo......", //
      "oRrRo.....",
      "or.rooooo.",
      "oRrRRgRrRo",
      ".oooooRoRo",
      "......o.o.",
    ],
    colors: { R: hex("#8a5a2c"), r: hex("#c0763a"), g: hex("#6f8a6a") },
    flat: "g",
  },
  // La carnada de E.: ollita de barro con la masa de mazorca, pintas de fresa y una etiquetica.
  "carnada-e": {
    rows: [
      "..oooo..", //
      ".oYyrYo.",
      "oyYrYyYo",
      "oCCCCCCo",
      "ocwwcCco",
      "occccCCo",
      ".oooooo.",
    ],
    colors: { Y: hex("#f2d16a"), y: hex("#d9a83a"), r: hex("#d0404a"), C: hex("#b0603a"), c: hex("#8a4428"), w: hex("#f4ead0") },
    flat: "rw",
  },
};

// ---------- La granja del jardín: ingredientes y lo de la parrilla ----------
// Los huevos criollos del nido: dos, uno más oscuro.
ITEMS.huevo = {
  rows: [
    "..oo......", //
    ".owwo.oo..",
    "owwWwoccO.",
    "owwwWoccco",
    "owwwwocCco",
    ".oWWo.oCo.",
    "..oo...o..",
  ],
  colors: { w: hex("#fbf4e6"), W: hex("#e2d6c0"), c: hex("#e8c49a"), C: hex("#c89a6a"), O: hex("#e8c49a") },
};
// La bolsa de papel de la harina del molino, con la mazorca estampada.
ITEMS.harina = {
  rows: [
    ".oooooo.", //
    "oppPPppo",
    "opppppPo",
    "opyyYppo",
    "opyYyppo",
    "oppppPPo",
    "oPPPPPPo",
    ".oooooo.",
  ],
  colors: { p: hex("#f4ecd8"), P: hex("#d8ccb0"), y: hex("#f2c83a"), Y: hex("#c8961e") },
};
// Una tajada de queso campesino, blanca, con la corteza clarita.
ITEMS.queso = {
  rows: [
    "....ooo..", //
    "..oowwwo.",
    ".owwwwwwo",
    "owwWwwwWo",
    "oWWWWWWWo",
    ".ooooooo.",
  ],
  colors: { w: hex("#fffaee"), W: hex("#e8dcbc") },
};
// Una ristra de chorizos santarrosanos amarrados.
ITEMS.chorizo = {
  rows: [
    ".oo...oo..", //
    "orroo.orro",
    "oRrrtoRrro",
    "orRro.orRo",
    ".ooo...oo.",
  ],
  colors: { r: hex("#b8402a"), R: hex("#7e2a1c"), t: hex("#e8d8b0") },
};
// La mazorca asada: granos dorados con las marcas de la brasa, en su hoja.
ITEMS["mazorca-asada"] = {
  crumb: hex("#fff0b0"),
  rows: [
    "..oooo..", //
    ".okKbko.",
    ".obkKbo.",
    ".oKkbKo.",
    ".okbKko.",
    ".obKkbo.",
    "oLokkoLo",
    "oLLooLLo",
    ".oLLLLo.",
  ],
  colors: { k: hex("#f0b83a"), K: hex("#c8861e"), b: hex("#7a4a20"), L: hex("#a8b860") },
};
// La arepa asada con la cuadrícula de la parrilla y el queso derretido saliendo.
ITEMS["arepa-asada"] = {
  crumb: hex("#fff8e0"),
  rows: [
    "..ooooo..", //
    ".oaqaqao.",
    "oagagagao",
    "oaqqQqqao",
    "odgdddgDo",
    ".ooooooo.",
  ],
  colors: { a: hex("#f0d890"), g: hex("#8a5a2a"), q: hex("#fffaf0"), Q: hex("#e8dcbc"), d: hex("#d8b060"), D: hex("#b89040") },
};
// Chorizo a la brasa con dos papas criollas amarillas en su platico de hoja.
ITEMS["chorizo-asado"] = {
  crumb: hex("#e8a080"),
  rows: [
    "...oooo...", //
    "..orRrro..",
    ".oRrrrRyo.",
    "oyoooooyYo",
    "oYyloyyYlo",
    ".olllllllo",
    "..ooooooo.",
  ],
  colors: { r: hex("#b8402a"), R: hex("#7e2a1c"), y: hex("#f2c83a"), Y: hex("#c8961e"), l: hex("#6f9a4a") },
};
// Pan de bono de horno: tres bolitas doradas pegadas.
ITEMS["pan-bono-horno"] = {
  crumb: hex("#fff4cc"),
  rows: [
    "..ooo.ooo.", //
    ".obBbobBbo",
    "obbbdobbdo",
    "obooooobbo",
    "obBbbobDo.",
    ".obbDDbo..",
    "..oooooo..",
  ],
  colors: { b: hex("#e8b060"), B: hex("#f8dca0"), d: hex("#c98a3a"), D: hex("#a86a28") },
};
// La pizza del horno de barro, redonda, con tomate, queso y el borde tostado.
ITEMS["pizza-horno"] = {
  crumb: hex("#f8e0a0"),
  rows: [
    "..oooooo..", //
    ".oBqrqqBo.",
    "oBqrqqrqBo",
    "oBqqrqqrBo",
    "oBrqqrqqBo",
    ".oBqqqrBo.",
    "..oBBBBo..",
    "...oooo...",
  ],
  colors: { B: hex("#c8883a"), q: hex("#f8e6a8"), r: hex("#d8402a") },
};
// Las porciones que se reparten: un pedazo de cada plato.
ITEMS["porcion-mazorca-asada"] = {
  crumb: hex("#fff0b0"),
  rows: ["..oo..", ".okKo.", ".obko.", ".oKbo.", ".okKo.", "..oo.."],
  colors: { k: hex("#f0b83a"), K: hex("#c8861e"), b: hex("#7a4a20") },
};
ITEMS["porcion-arepa-asada"] = {
  crumb: hex("#fff8e0"),
  rows: ["..ooo..", ".oagqo.", "oaqgqao", "odgddDo", ".ooooo."],
  colors: { a: hex("#f0d890"), g: hex("#8a5a2a"), q: hex("#fffaf0"), d: hex("#d8b060"), D: hex("#b89040") },
};
ITEMS["porcion-chorizo-asado"] = {
  crumb: hex("#e8a080"),
  rows: ["..ooo.", ".orRro", "oRrrRo", "oyoooo", ".oYyo."],
  colors: { r: hex("#b8402a"), R: hex("#7e2a1c"), y: hex("#f2c83a"), Y: hex("#c8961e") },
};
ITEMS["porcion-pan-bono-horno"] = {
  crumb: hex("#fff4cc"),
  rows: ["..ooo..", ".obBbo.", "obbbdbo", "obbbbDo", ".oDDbo.", "..ooo.."],
  colors: { b: hex("#e8b060"), B: hex("#f8dca0"), d: hex("#c98a3a"), D: hex("#a86a28") },
};
// Una tajada triangular de la pizza, con la punta hacia abajo.
ITEMS["porcion-pizza-horno"] = {
  crumb: hex("#f8e0a0"),
  rows: ["oBBBBBo", "oqrqqro", ".oqqrqo", ".orqqo.", "..oqo..", "..oo..."],
  colors: { B: hex("#c8883a"), q: hex("#f8e6a8"), r: hex("#d8402a") },
};

// El tinto que sale de la cosecha del invernadero: la misma taza del tinto de la cafetería.
ITEMS["cafe-casa"] = { ...ITEMS.tinto! };

/**
 * Sobre de semillas de papel kraft con la solapa doblada y, al frente, el dibujito del cultivo (`motif`,
 * 4x3): así cada sobre se distingue del otro aunque sean parecidos de color.
 */
function seedPacket(c: string, dark: string, motif: readonly string[]): ItemArt {
  const front = motif.map((r) => `op${r.replaceAll(".", "p")}po`);
  return {
    rows: [
      ".oooooo.", //
      "oPPPPPPo",
      "oppppppo",
      ...front,
      "oppppppo",
      ".oooooo.",
    ],
    colors: { p: hex("#e8d8b0"), P: hex("#c9b48a"), c: hex(c), C: hex(dark), g: hex("#5fa83e") },
    flat: "cCg",
  };
}

// ---------- El puesto de pesca del lago ----------

/**
 * Caña de pescar en diagonal (el mango abajo a la izquierda, la punta arriba a la derecha) con su carrete
 * dorado. `rod`/`tip`: la vara y la punta; `grip`: el mango; `ring`: un anillo de guía (la de carbono).
 */
function fishingRod(rod: string, tip: string, grip: string, ring?: string, shine = false): ItemArt {
  return {
    rows: [
      shine ? ".....w..oo" : "........oo", //
      ".......oto",
      "......oRo.",
      `.....o${ring ? "y" : "R"}o..`,
      "....oRo...",
      "..ooRo....",
      ".ogGo.....",
      "oggo......",
      "ohho......",
      ".oo.......",
    ],
    colors: legend({ R: rod, t: tip, h: grip, g: "#dcae3f", G: "#f3d672", y: ring ?? rod, w: "#fffaf0" }),
    flat: "yw",
  };
}
ITEMS["cana-fibra"] = fishingRod("#4f9a6a", "#bfe0c0", "#e6d0a6");
ITEMS["cana-carbono"] = fishingRod("#34447c", "#7084b8", "#7a3a25", "#f3d672");
// La legendaria: dorada entera, con el anillo rojo y un brillito al lado de la punta.
ITEMS["cana-dorada"] = fishingRod("#dcae3f", "#fff0b0", "#7a1f2b", "#b8402a", true);
// La carnada: una cajita de cartón con tierra negra y una lombriz rosada asomada.
ITEMS.carnada = {
  rows: [
    ".oooooo.", //
    "oDdWdDdo",
    "odWWdwDo",
    "okkkkkko",
    "oKKKKKKo",
    "okkkkkko",
    ".oooooo.",
  ],
  colors: legend({ D: "#3b2418", d: "#5a3822", W: "#e8a0a8", w: "#c47d8a", k: "#c9a06a", K: "#a65132" }),
  flat: "WwK",
};
// La carnada de la buena: frasco de vidrio con camarones de río y la tapa dorada.
ITEMS["carnada-buena"] = {
  rows: [
    ".oooooo.", //
    "oLLLLLLo",
    ".oooooo.",
    "oghsgsgo",
    "osgssgso",
    "ogssgsgo",
    "osgsghso",
    ".oooooo.",
  ],
  colors: legend({ L: "#dcae3f", g: "#cfe6f0", h: "#f4fbff", s: "#e39462" }),
  flat: "sh",
};

// ---------- Mundo lleno: el vaso de agua, la hoja impresa y los peluches de la máquina de garra ----------

// El vaso del dispensador de las oficinas: vidrio liso (sin pitillo, a diferencia del jugo) y agua clarita.
ITEMS["vaso-agua"] = {
  liquid: { chars: "aA" },
  rows: ["ooooooo", "ohaaaAo", "ohaaaAo", "ohaaAAo", "ohaaaAo", "oggggGo", ".ooooo."],
  colors: { a: hex("#bfe6f5"), A: hex("#86c3dc"), h: GLASS.h, g: alpha(hex("#d8eef6"), 0.85), G: alpha(hex("#e8f6fb"), 0.95) },
};
// La hoja de la impresora: papel con renglones y la esquina doblada.
ITEMS.hoja = {
  rows: ["oooooo..", "owwwwFo.", "owlllFFo", "owwwwwwo", "owllllwo", "owwwwwwo", "owlllwwo", "owwwwwwo", "oooooooo"],
  colors: legend({ w: "#fbf7ea", F: "#d8ccb0", l: "#8aa0c8" }),
  flat: "l",
};
// Los peluches: de frente, cabezones y con ojitos de botón (`e`), cada uno con su silueta.
ITEMS["peluche-oso"] = {
  rows: [".oo...oo.", "obBo.oBbo", "obbbbbbbo", "obebbbebo", "obbmnmbbo", ".obRRRbo.", "obbbbbbbo", "obbbbbbbo", ".oo...oo."],
  colors: legend({ b: "#a8703e", B: "#e0b07a", e: "#2a1810", m: "#f0d6a8", n: "#3a2014", R: "#c8402e" }),
  flat: "enR",
};
ITEMS["peluche-gato"] = {
  rows: ["o.......o", "oPo...oPo", "ogPoooPgo", "ogegggego", "oggwnwggo", ".ogwwwgo.", "ogGgggGgo", "oggGgGggo", ".oo...oo."],
  colors: legend({ g: "#a8a4b0", G: "#6e6a78", P: "#f0a8b8", e: "#4f9a4a", w: "#f4f0ea", n: "#e87890" }),
  flat: "ePnG",
};
ITEMS["peluche-rana"] = {
  rows: [".oo...oo.", "owko.okwo", "olllllllo", "oplllllpo", "ollmmmllo", ".olyyylo.", "olLyyyLlo", ".oo...oo."],
  colors: legend({ l: "#6fb34a", L: "#3f7a2e", w: "#fffaf0", k: "#1a1a1a", p: "#f0909a", m: "#2e5a22", y: "#e8e08a" }),
  flat: "wkpm",
};
ITEMS["peluche-conejo"] = {
  rows: ["..o...o..", ".oPo.oPo.", ".oPo.oPo.", "oowooowoo", "owwwwwwwo", "owewwwewo", "owwwnwwwo", ".owwwwwo.", "owwcwcwwo", ".oo...oo."],
  colors: legend({ w: "#f6f0e4", P: "#f0a8b8", e: "#3a2a30", n: "#e87890", c: "#e0d0b8" }),
  flat: "Pen",
};
ITEMS["peluche-pulpo"] = {
  rows: ["..ooooo..", ".ovvpvvo.", "ovvvvvpvo", "ovevvvevo", "ovvvmvvvo", "ovVvvvVvo", "ovovovovo", ".o.o.o.o."],
  colors: legend({ v: "#b060c0", V: "#7a3a8e", p: "#e0a8ea", e: "#1a1420", m: "#5a2a66" }),
  flat: "pem",
};
ITEMS["peluche-oveja"] = {
  rows: ["..o.o.o..", ".owowowo.", "owWwwwWwo", "owwfffwwo", "owfefefwo", "owwfnfwwo", "owWwwwWwo", ".owwwwwo.", ".ofo.ofo."],
  colors: legend({ w: "#f8f4ea", W: "#d8d0c0", f: "#5a3a2a", e: "#f8f4ea", n: "#f0a0a0" }),
  flat: "en",
};
// El chigüiro (capibara), el especial: ancho, cuadrado y tranquilo.
ITEMS["peluche-capibara"] = {
  rows: [".oo....oo.", "occoooocco", "occcccccco", "ocecccceco", "occcCCccco", "occCnnCcco", "occcccccco", "oCccccccCo", ".oCo..oCo."],
  colors: legend({ c: "#b88a52", C: "#8a6038", e: "#1e140c", n: "#4a3020" }),
  flat: "en",
};

// ---------- La Noche de brujas: los dulces, la canasta y el premio ----------

// La chocolatina del dulce o truco: papel naranja con un murcielaguito y la punta abierta (papel dorado y
// el chocolate asomando). La de la casa es café con la franja dorada.
ITEMS["chocolatina-brujas"] = {
  crumb: hex("#b87a4a"),
  rows: [
    "ooooooooo", //
    "onnnnnfco",
    "onbnbnfCo",
    "onnbnnfco",
    "oNNNNNfCo",
    "ooooooooo",
  ],
  colors: legend({ n: "#f08a2a", N: "#c8601a", b: "#3e2f52", f: "#f3d672", c: "#6a3a1e", C: "#4a2410" }),
  flat: "bf",
};
// La chupeta: espiral naranja y crema en su palito.
ITEMS.chupeta = {
  crumb: hex("#ffe7a0"),
  rows: [
    "..ooo..", //
    ".orrwo.",
    "orwwrro",
    "orwrwro",
    "orrwwro",
    ".owrro.",
    "..ooo..",
    "...s...",
    "...s...",
    "...s...",
  ],
  colors: legend({ r: "#f08a2a", w: "#ffe7a0", s: "#fbf4e6" }),
  flat: "rws",
};
// El bombón: chocolate envuelto en papel morado, con las dos puntas torcidas.
ITEMS.bombon = {
  crumb: hex("#7a4428"),
  rows: [
    "oo.ooo.oo", //
    "oyoppPoyo",
    ".oopPPoo.",
    "oyoPPPoyo",
    "oo.ooo.oo",
  ],
  colors: legend({ y: "#f3c440", p: "#a070c8", P: "#6e3a96" }),
};
// Las gomitas: bolsita transparente con el cierre plateado y gomitas de colores adentro.
ITEMS.gomitas = {
  crumb: hex("#f8f4ea"),
  rows: [
    ".oooooo.", //
    "oMMMMMMo",
    "ohgghrro",
    "oggyyrro",
    "ohyyhbbo",
    "orrhbbho",
    ".oooooo.",
  ],
  colors: { ...legend({ M: "#c8c4d8", g: "#6fc24a", r: "#e8403a", y: "#f6d23a", b: "#f08a2a" }), h: alpha(hex("#f4fbff"), 0.9) },
  flat: "grybh",
};
// El masmelo trenzado: rosado y blanco (el malvavisco de la fogata es dorado y va en su palito).
ITEMS.masmelo = {
  crumb: hex("#fff6f8"),
  rows: [
    ".oooo.", //
    "owwppo",
    "owppwo",
    "oppwwo",
    "opwwpo",
    "owwppo",
    ".oooo.",
  ],
  colors: legend({ w: "#fffaf6", p: "#f4a6c0" }),
  flat: "wp",
};
// La canasta de dulce o truco: una ahuyama de plástico con la cara negra, el asa y dulces asomando.
ITEMS["canasta-dulces"] = {
  rows: [
    "..okkkko..", //
    ".ok....ko.",
    "ok.rgy..ko",
    "oooooooooo",
    "onnnnnnnNo",
    "onfnnnfnNo",
    "onnnnnnnNo",
    "onfffffnNo",
    ".onnnnnNo.",
    "..oooooo..",
  ],
  colors: legend({ k: "#3e2f52", n: "#f08a2a", N: "#c8601a", f: "#2a1c24", r: "#e8403a", g: "#6fc24a", y: "#f6d23a" }),
  flat: "frgy",
};
// La calabaza dorada: el premio, con su brillito.
ITEMS["calabaza-dorada"] = {
  rows: [
    "....oo..w", //
    "..oosoo..",
    ".ogGsGgo.",
    "ogwgGgGgo",
    "ogggGgGgo",
    "ogggGgGGo",
    ".oGGGGGo.",
    "..ooooo..",
  ],
  colors: legend({ g: "#f3c440", G: "#c8901e", w: "#fffbe0", s: "#6a8a2a" }),
  flat: "w",
};
// El sombrero de bruja de recuerdo (el puesto del caldero): negro de ala ancha, la punta doblada y la
// cinta naranja.
ITEMS["sombrero-bruja"] = {
  rows: [
    "......oo..", //
    ".....okKo.",
    "....okko..",
    "...okkKo..",
    "...okkKo..",
    "..oyyyyyo.",
    ".okkkkkkKo",
    "oooooooooo",
  ],
  colors: legend({ k: "#2a2232", K: "#4a3e5a", y: "#f08a2a" }),
  flat: "y",
};

// ---------- El Carnaval de Negros y Blancos ----------
// La bolsita de maicena (el talco): papel blanco amarrado con cabuya y un poco de polvo que se escapa.
ITEMS.maicena = {
  rows: [
    "..w...w..", //
    "...ww....",
    "..oyyo...",
    ".owwwwo..",
    "owwWwwwo.",
    "owwwwWwo.",
    "owWwwwwo.",
    ".owwwwo..",
    "..oooo...",
  ],
  colors: legend({ w: "#f6f4ef", W: "#d8d4cc", y: "#b8945a" }),
  flat: "y",
};
// Las serpentinas: un rollito blanco y negro con la cinta que se desenrolla.
ITEMS.serpentinas = {
  rows: [
    "......n.w", //
    ".....w.n.",
    "..oooo.w.",
    ".owknwo..",
    "owkwwnwo.",
    "onwkkwko.",
    "owknwkwo.",
    ".owwnwo..",
    "..oooo...",
  ],
  colors: legend({ w: "#f6f4ef", k: "#24212e", n: "#3a3646" }),
  flat: "kn",
};
// El antifaz de carnaval: mitad blanco, mitad negro, ribete dorado y una pluma.
ITEMS["antifaz-carnaval"] = {
  rows: [
    ".......p.", //
    "......pP.",
    "oooooooPo",
    "owwwykkko",
    "ow.wyk.ko",
    "owwwykkko",
    ".owwyko..",
    "..oooo...",
  ],
  colors: legend({ w: "#f6f4ef", k: "#24212e", y: "#dcae3f", p: "#c05a4a", P: "#e0835e" }),
  flat: "y",
};
// La máscara de cóndor: cabeza negra, el collar blanco y el pico de hueso.
ITEMS["mascara-condor"] = {
  rows: [
    "..oooo...", //
    ".okkkko..",
    "okkwkkko.",
    "okkkkkcco",
    ".okkkkcco",
    ".owwwwwo.",
    "owwwwwwwo",
    ".ooooooo.",
  ],
  colors: legend({ k: "#24212e", w: "#f6f4ef", c: "#e8d8a8" }),
};
// La máscara del sol: la cara dorada con rayos blancos y negros alrededor.
ITEMS["mascara-sol"] = {
  rows: [
    "..k.w.k..", //
    "...ooo...",
    "w.oyyyo.w",
    ".oykyyko.",
    "koyyyyyok",
    ".oyyryyo.",
    "w.oyyyo.w",
    "...ooo...",
    "..k.w.k..",
  ],
  colors: legend({ y: "#f3c440", k: "#24212e", w: "#f6f4ef", r: "#c05a4a" }),
  flat: "kwr",
};
// La velita de la Noche de velitas: la vela blanca prendida en su vasito de papel rojo plisado.
ITEMS.velita = {
  rows: [
    "...y...", //
    "..yfy..",
    "..ofo..",
    "..owo..",
    "orwrwro",
    "orwwwro",
    ".rRrRr.",
    ".rRrRr.",
    ".ooooo.",
  ],
  colors: legend({ y: "#fbb23c", f: "#fff4c8", w: "#faf4e6", r: "#d8463c", R: "#9c2a2a" }),
  flat: "yfrR",
};
// El farol de deseos (sin soltar): papel de seda amarillo y naranja, más ancho arriba, con su aro de alambre.
ITEMS["farol-deseos"] = {
  rows: [
    ".oooooo.", //
    "opPpPpPo",
    "opPpPpPo",
    ".opPpPo.",
    ".opPpPo.",
    "..oaao..",
    "..a..a..",
    "...yy...",
  ],
  colors: legend({ p: "#f6d23a", P: "#f08a2a", a: "#5a4a3a", y: "#fff0a0" }),
  flat: "pPy",
};
// ---------- Las novenas: la natilla y los buñuelos de la cocina (cocina.ts) ----------

// La natilla casera: dos cuadritos temblorosos con canela en un platico de loza (la de la cafetería es un
// solo bloque en su molde).
ITEMS["natilla-casera"] = {
  crumb: hex("#e8c088"),
  rows: [
    ".ooo..ooo.", //
    "oTdToodTTo",
    "onnNoonnNo",
    "onnNoonnNo",
    "oppppppppo",
    ".oPPPPPPo.",
    "..oooooo..",
  ],
  colors: legend({ T: "#f0cc92", d: "#8a4a22", n: "#d29a56", N: "#a87034", p: "#f4ecdc", P: "#cbbba2" }),
  flat: "d",
};
// Los buñuelos de la novena: tres bolitas doradas, dos abajo y una encima (el de la panadería va solo).
ITEMS["bunuelos-novena"] = {
  crumb: hex("#f8dc9a"),
  rows: [
    "...ooo....", //
    "..oHbbo...",
    "..obbdo...",
    ".oooooooo.",
    "oHbbooHbbo",
    "obbdoobbdo",
    "obddoobddo",
    ".ooo..ooo.",
  ],
  colors: legend({ b: "#d08c38", H: "#fff2cc", d: "#a4622a" }),
  flat: "H",
};

// ---------- El Año viejo (ano-viejo.ts de @hyvento/shared) ----------

// La uva del agüero: un racimito morado con su tallito y una hoja.
ITEMS.uva = {
  crumb: hex("#c8a0d8"),
  rows: [
    "....gl...", //
    "...oglo..",
    "..ouuuo..",
    ".ouUuUuo.",
    ".ouuuuuo.",
    "..ouUuo..",
    "..ouuuo..",
    "...ouo...",
    "....o....",
  ],
  colors: legend({ g: "#6a4a2a", l: "#5ea247", u: "#6a2a7a", U: "#b07ac8" }),
  flat: "U",
};
// La maleta de viaje: cuero café con correas y la manija arriba.
ITEMS.maleta = {
  rows: [
    "...ooo...", //
    "...o.o...",
    "ooooooooo",
    "obbybbybo",
    "obbybbybo",
    "oBBBBBBBo",
    "obbybbybo",
    "ooooooooo",
  ],
  colors: legend({ b: "#a8642e", B: "#7a4220", y: "#e0b84a" }),
  flat: "y",
};
// El puñado de lentejas: una bolsita de tela abierta con las lentejas asomando.
ITEMS.lentejas = {
  rows: [
    "..lLlLl..", //
    ".oLlLlLo.",
    ".ottttto.",
    "otttyttto",
    "otTtttTto",
    "otttttTto",
    ".ottttto.",
    "..ooooo..",
  ],
  colors: legend({ l: "#b8743a", L: "#8a5226", t: "#e8dcc0", T: "#cbbb98", y: "#c0392b" }),
  flat: "lLy",
};
// La ropa vieja: una camisa a cuadros doblada con un parche en el codo.
ITEMS["ropa-vieja"] = {
  rows: [
    "..oo.oo..", //
    ".orrorro.",
    "orRrRrRro",
    "orrrrrrro",
    "oRrRpRrRo",
    "orrrpprro",
    "oRrRrRrRo",
    ".ooooooo.",
  ],
  colors: legend({ r: "#b8402e", R: "#5a3a2a", p: "#5a7a9a" }),
  flat: "Rp",
};
// La careta del muñeco: cara de cartón pintada, con bigote y cachetes.
ITEMS["careta-muneco"] = {
  rows: [
    "..ooooo..", //
    ".occccco.",
    "ocKcccKco",
    "occcnccco",
    "orcmmmcro",
    "occccccco",
    ".occccco.",
    "..ooooo..",
  ],
  colors: legend({ c: "#f2d6b0", K: "#2a2232", n: "#d08a5a", m: "#3a2418", r: "#e0807a" }),
  flat: "Kmr",
};
// El costal de aserrín: costal amarrado arriba, con el aserrín que se sale.
ITEMS.aserrin = {
  rows: [
    "...ooo...", //
    "...oyo...",
    "..okkko..",
    ".okkKkko.",
    "okkkkkKko",
    "okKkkkkko",
    "okkkkKkko",
    ".ooooooo.",
    "a.a.a..a.",
  ],
  colors: legend({ k: "#c8a46a", K: "#9a7a48", y: "#7a5a32", a: "#e8c890" }),
  flat: "Ka",
};
// El manojo de paja: amarrado por la mitad con cabuya.
ITEMS.paja = {
  rows: [
    "p.P.p.P..", //
    ".pPpPpP..",
    ".oppPppo.",
    "..oPpPo..",
    "..oyyyo..",
    "..opPpo..",
    ".oPppPpo.",
    "oPpPpPpPo",
  ],
  colors: legend({ p: "#e8c858", P: "#c09a3a", y: "#7a5a32" }),
  flat: "y",
};
// La varita de luz (juguete, nada de pólvora): un palito con la punta que brilla de colores.
ITEMS["varita-luz"] = {
  rows: [
    "..r.y....", //
    ".rWWy....",
    "..WWWb...",
    "..gWb....",
    "...hh....",
    "...hh....",
    "...hh....",
    "...ho....",
  ],
  colors: legend({ W: "#fffaf0", r: "#ff7aa8", y: "#ffe070", b: "#8ad0ff", g: "#9af07a", h: "#6a4a8a" }),
  flat: "Wrybg",
};
// El acordeón de Don Aurelio: el fuelle de pliegues entre las dos tapas, con sus botoncitos.
ITEMS.acordeon = {
  rows: [
    "ooooooooo", //
    "orwkwkwro",
    "orKwKwKro",
    "orwkwkwro",
    "orKwKwKro",
    "orwkwkwro",
    "ooooooooo",
  ],
  colors: legend({ r: "#c0392b", w: "#f2ead8", k: "#3a2a2a", K: "#d8c8a8" }),
  flat: "wkK",
};
// La guacharaca de Tomás: la caña rayada y el trinche.
ITEMS.guacharaca = {
  rows: [
    "........o", //
    ".......oy",
    "......oyo",
    ".....oyo.",
    "..o.oyo..",
    ".oto.o...",
    ".otoo....",
    ".oto.....",
    "..o......",
  ],
  colors: legend({ t: "#c89a5a", y: "#d8d8de" }),
  flat: "y",
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

/** Mezcla dos colores (t = 0, el primero; t = 1, el segundo), con el alfa del primero. */
const mix = (a: RGBA, b: RGBA, t: number): RGBA => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
  a[3],
];
/** Luz cálida y sombra violeta (el corrimiento de tono de Stardew: nada de blanco ni negro puros). */
const LIGHT = hex("#fff2c8");
const DUSK = hex("#3a1f3d");
export const lighten = (c: RGBA, t: number) => mix(c, LIGHT, t);
export const darken = (c: RGBA, t: number) => mix(c, DUSK, t);

/**
 * Pinta las filas. Cada material opaco recibe luz de arriba a la izquierda: el borde de arriba (o de la
 * izquierda) se aclara y el de abajo (o de la derecha) se oscurece, así una pieza de dos tonos queda con
 * cuatro. Lo de vidrio (con transparencia), la brasa y las letras de `flat` quedan como están.
 */
function paint(item: ItemArt, rows: string[], ember: number): PixelCanvas {
  const w = Math.max(...rows.map((r) => r.length));
  const c = new PixelCanvas(w, rows.length);
  const chAt = (x: number, y: number) => rows[y]?.[x] ?? ".";
  const edge = (x: number, y: number) => {
    const ch = chAt(x, y);
    return ch === "." || ch === "o" || ch === "e";
  };
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      if (ch === "e" && !item.ember) return c.set(x, y, item.liquid?.empty ?? GLASS.empty);
      if (ch === "i" && item.surface) return c.set(x, y, item.surface.inner);
      const hot = item.ember?.chars.includes(ch);
      let color = ch === "o" ? OUT : hot ? EMBER[ember]! : item.colors[ch];
      if (!color) return;
      if (ch !== "o" && !hot && color[3] === 255 && !item.flat?.includes(ch)) {
        const lit = edge(x, y - 1) || edge(x - 1, y);
        const dark = edge(x, y + 1) || edge(x + 1, y);
        if (lit && !dark) color = lighten(color, 0.2);
        else if (dark && !lit) color = darken(color, 0.13);
      }
      c.set(x, y, color);
    }),
  );
  return c;
}

/**
 * Contorno de color (el "sel-out" del pixel-art): cada píxel del contorno toma un tono muy oscuro del
 * material que tiene al lado, en vez del mismo café para todo. Se hace al final (después de morder e
 * inclinar), que es cuando ya no se busca el contorno por su color exacto.
 */
function tintOutline(c: PixelCanvas): PixelCanvas {
  const out = new PixelCanvas(c.width, c.height);
  out.data.set(c.data);
  const px = (x: number, y: number): RGBA | null => {
    if (x < 0 || y < 0 || x >= c.width || y >= c.height) return null;
    const i = (y * c.width + x) * 4;
    if (c.data[i + 3]! < 90 || isOutAt(c, x, y)) return null;
    return [c.data[i]!, c.data[i + 1]!, c.data[i + 2]!, 255];
  };
  const lum = (k: RGBA) => k[0] * 0.3 + k[1] * 0.59 + k[2] * 0.11;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      if (!isOutAt(c, x, y)) continue;
      // El vecino más oscuro manda (el contorno no se aclara con un brillo).
      const near = [px(x, y + 1), px(x + 1, y), px(x - 1, y), px(x, y - 1)].filter((k): k is RGBA => k !== null);
      if (near.length === 0) continue;
      const base = near.reduce((a, b) => (lum(b) < lum(a) ? b : a));
      out.set(x, y, mix(OUT, darken(base, 0.5), 0.26));
    }
  return out;
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

/** Cada flor de la silleta en una casilla de 2x2: la letra de arriba a la izquierda y la de al lado. */
const SILLETA_CELL: Record<string, [string, string]> = { c: ["r", "R"], a: ["n", "N"], g: ["y", "b"], h: ["v", "V"], "-": ["e", "E"] };

/**
 * La silleta en la mano (`silleta:<código>`, ver silleta.ts de @hyvento/shared): el marco de madera con la
 * grilla de flores (las casillas vacías llevan follaje) y las dos patas de cargarla. Sale del código, así
 * cada silleta se ve como la armaron.
 */
function silletaItem(code: string): ItemArt {
  const bar = `o${"W".repeat(SILLETA.cols * 2)}o`;
  const rows = [`.${"o".repeat(SILLETA.cols * 2)}.`, bar];
  for (let r = 0; r < SILLETA.rows; r++)
    for (const half of [0, 1]) {
      let row = "o";
      for (let c = 0; c < SILLETA.cols; c++) {
        const [a, b] = SILLETA_CELL[code[r * SILLETA.cols + c]!] ?? SILLETA_CELL["-"]!;
        row += half ? b + a : a + b;
      }
      rows.push(`${row}o`);
    }
  rows.push(bar, `.oWo${".".repeat(SILLETA.cols * 2 - 6)}oWo.`);
  return {
    rows,
    colors: legend({ W: "#a8682a", r: "#e0303c", R: "#a01828", n: "#f08a2a", N: "#c05a1a", y: "#f7c830", b: "#7a4a1a", v: "#9a8ae8", V: "#5a4ab8", e: "#5fa83e", E: "#3f7a2e" }),
    flat: "rRnNybvVeE",
  };
}

/** Lo que se dibuja de un id que no está en la tabla (la silleta, que sale de su código), o undefined. */
function dynamicItem(id: string): ItemArt | undefined {
  const code = silletaCodeOf(id);
  return code ? silletaItem(code) : undefined;
}

/** Algo que se lleva en la mano, según cómo está (ver `HeldArtState`). Un id desconocido da un lienzo de 1x1. */
export function drawHeldItem(id: string, state: HeldArtState = {}): PixelCanvas {
  const item = ITEMS[id] ?? dynamicItem(id);
  if (!item) return new PixelCanvas(1, 1);
  const uses = usesOf(id);
  const left = Math.max(1, Math.min(uses, state.left ?? uses));
  let c = paint(item, rowsFor(item, id, left), state.ember ?? 1);
  if (item.crumb) c = bite(c, uses - left, item.crumb);
  // Inclinado para el sorbo: hacia la boca, que queda del lado contrario a la mano.
  if (state.tilt) c = leaned(c, state.tilt);
  return tintOutline(c);
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
