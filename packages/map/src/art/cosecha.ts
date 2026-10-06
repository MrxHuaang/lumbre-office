// La Feria de la cosecha (VIR-169, catálogo en world/catalog-cosecha.ts): el mercado campesino que el
// festival pone en el jardín el 10 del otoño. Los cinco puestos (parales de rollizo, mostrador de tablas
// ásperas, el toldo de lona a rayas con su festón de ondas, el letrero pintado a mano y lo de cada uno
// encima y colgado), la olla del sancocho sobre el fogón de piedras con su leña, la candela y el vapor, la
// báscula de plataforma con su reloj, el tablero del concurso, la tómbola de la junta con el tambor que
// gira, bultos de papa, canastos, el poste y el arco de mazorcas, el canasto de mimbre, la carreta del
// premio y la Pinta, la mula de Don Ramiro. Cálido y de otoño: madera, fique, mimbre, maíz y ahuyamas.
//
// Pixel art pintado a mano (docs/estandar-arte.md): lo chico (papas, yucas, mazorcas, ahuyamas, frutas,
// arepas, costales, canastos, las piedras, la olla, el tambor, la mula) son grillas de letras con su leyenda
// de materiales, que reciben la luz de arriba a la izquierda y el contorno cálido del material de al lado
// (o van sombreadas a mano con dígitos, de 0 oscuro a 5 claro); lo grande (mostradores, toldos, la
// plataforma de la báscula, el tablero, la mesa, la carreta, el arco) son caras isométricas pintadas píxel a
// píxel con el lienzo de la decoración del Carnaval (carnaval-decor.ts). Lo que se mueve (lo colgado, la
// candela, el vapor, el tambor) tiene cuadros (`COSECHA_FRAMES`) que el navegador pasa en bucle con
// `cosechaSprite`. Coordenadas locales de arte (tile = 16).
import { anchoTexto, apoya, humoPx, Lienzo, LLAMA_LEY, LLAMAS, mismoLienzo, tablas, tonos, type Ley, type Pinta } from "./carnaval-decor";
import { C, mix } from "./palette";
import { PixelCanvas, alpha, at, ramp, type Ramp, type RGBA, type Sprite } from "./pixel";

// ---------- Colores ----------

const MADERA = C.wood;
const OSCURA = C.woodDark;
const TRONCO = C.logs;
const CREMA = C.cream;
const HOJA = C.leaf;
const BARRO = C.terracotta;
/** El fique de los costales y la cabuya. */
const FIQUE = ramp("#5a4428", "#7d6440", "#a8895a", "#c8aa78", "#e0c898", "#f2e2bc");
/** El mimbre de los canastos. */
const MIMBRE = ramp("#5a3a1a", "#8a5a2a", "#b07a3a", "#cf9a52", "#e6bc78", "#f6dca6");
/** La ahuyama: de la sombra al brillo. */
const AHUYAMA = ramp("#5a2a0a", "#9a4a12", "#c8661a", "#e8862a", "#f5a84a", "#ffd090");
/** El maíz amarillo, el blanco (el de las arepas) y el capacho. */
const MAIZ = ramp("#6b4a12", "#a0741f", "#cfa033", "#e9c65a", "#f6de8c", "#fff2c0");
const MAIZ_MORADO = ramp("#2a1430", "#4a2050", "#6a3070", "#8a4a8e", "#a86aa8", "#caa0c8");
const CAPACHO = ramp("#4a4a1a", "#6a6a2a", "#8a8a3a", "#b0a85a", "#d4c88a", "#ece4b0");
/** La papa criolla (amarilla) y la pastusa (rosada). */
const PAPA = ramp("#5a3a12", "#8a5a1a", "#b8862a", "#d8aa42", "#ecc868", "#f7e08a");
const PASTUSA = ramp("#4a2a1c", "#7a4a30", "#a06a48", "#c08a62", "#d8aa82", "#ecc8a2");
/** La cáscara de la yuca. */
const YUCA = ramp("#3a2414", "#5a3a22", "#7a5232", "#9a6c44", "#b88a5c", "#d4aa7c");
const FRESA = ramp("#4a0e14", "#7a1820", "#b02a30", "#d8403e", "#f07060", "#ffb0a0");
const LULO = ramp("#6a2a06", "#a0480e", "#d06a14", "#f08a1a", "#ffb04a", "#ffd890");
const TOMATE = ramp("#4a1010", "#7a1c18", "#a82e22", "#d04a30", "#ec7a52", "#ffb08a");
const PLATANO = ramp("#2a3a10", "#3e5a18", "#5a7e22", "#7aa032", "#a0c04a", "#cce07a");
const FRIJOL = ramp("#3a0e10", "#5a1618", "#7e2420", "#a03a2c", "#c05a44", "#e08a6e");
const ARVEJA = ramp("#1e3a14", "#2e5a1e", "#447a2a", "#5f9a3a", "#86bc56", "#b8de88");
const AREPA = ramp("#6a4a12", "#a07a2a", "#d0a64a", "#ecc870", "#f6e09a", "#fff4cc");
/** La olla tiznada del sancocho y el caldo amarillo. */
const OLLA = ramp("#1e1614", "#2e221e", "#43332b", "#5a463b", "#7a6352", "#a08a74");
const CALDO = ramp("#7a5a1a", "#a8842a", "#cfa840", "#e8c860", "#f6e08e", "#fff4c4");
/** Las piedras del fogón (cálidas, de río). */
const PIEDRA = ramp("#4a3426", "#6a4c38", "#8a6a50", "#a88a6a", "#c4a888", "#dcc8a8");
/** El hierro pintado de verde de la báscula y de la tómbola, y el bronce de los herrajes. */
const HIERRO = ramp("#142a1e", "#1e4030", "#2e5a44", "#42785a", "#66a07a", "#9ccaa6");
const BRONCE = C.gold;
const ROJO = ramp("#4a1010", "#7a1a1a", "#a82a24", "#d0402e", "#ec6a4a", "#ffa684");
const AZUL = ramp("#14244a", "#1e3a73", "#2e58a0", "#4a7ac4", "#7aa4e0", "#c0d8f4");

/** El toldo de cada puesto. */
const TOLDO: Record<string, Ramp> = {
  rojo: ramp("#4a1010", "#7a1c18", "#a82e24", "#cf4532", "#ec7458", "#ffac92"),
  amarillo: ramp("#6a4a0a", "#a0741a", "#d8a62a", "#f2c83a", "#ffe070", "#fff4c0"),
  verde: ramp("#1a3a1c", "#2a5a2a", "#3e7a36", "#58984a", "#84bc6a", "#bfe0a0"),
  naranja: ramp("#6a2a0a", "#a04a12", "#d06a1a", "#ec8a2a", "#ffb060", "#ffe0b0"),
  azul: AZUL,
};

/** Cuántos cuadros tiene lo que se mueve. */
const CUADROS = 4;
/** El vaivén de lo colgado (píxeles hacia los lados, cuadro a cuadro). */
const VAIVEN = [0, 1, 0, -1];

// ---------- Las grillas chicas ----------

/** Papas amontonadas (`P` la papa, `p` los ojitos). */
const PAPAS = ["...oo.oo...", "..oPPoPPo..", ".oPPpPPPPo.", "oPPPPoPpPPo", "oPpPPPPPPPo", ".ooooooooo."];
/** Una yuca acostada: la cáscara café y la punta cortada blanca. */
const YUCA_G = ["..ooooooooo.", ".oYyYYYyYYwo", "oYYYYyYYYYwo", ".oooooooooo."];
/** Una mazorca acostada con el capacho abierto a la derecha. */
const MAZORCA_H = ["..ooooooo..", ".oMmMmMmMoH", "oMMMMMMMMHH", ".oMmMmMmMoH", "..ooooooo.."];
/** Una mazorca colgada de su capacho (para las ristras). */
const MAZORCA_V = [".HHH.", "oHHHo", ".oMo.", "oMmMo", "oMMMo", "oMmMo", "oMMMo", "oMmMo", ".ooo."];
/** La ahuyama grande, sombreada a mano (gajos y su tallo). */
const AHUYAMA_G = [
  "......oGo......",
  "...ooo3g3ooo...",
  "..o5541443321o.",
  ".o554413443211o",
  "o5544314433211o",
  "o4443213332210o",
  ".o33321222110o.",
  "..oo2211110oo..",
  "....ooooooo....",
];
/** La ahuyama chiquita. */
const AHUYAMA_CH = ["...oGo...", ".oo434oo.", "o5443432o", "o4432321o", ".o32221o.", "..ooooo.."];
const ahuyamaLey: Ley = { ...tonos(AHUYAMA), G: [HOJA, 1.6], g: [HOJA, 3.2] };
/** Fresas, lulos y tomates amontonados (`F` la fruta, `f` las pintas, `g` las hojitas). */
const FRESAS = [".g.g..g..", "oFgFoFgFo", "oFfFFfFFo", ".ooo.ooo."];
const BOLITAS = ["..o..o..", ".oFoFFo.", "oFfFFFfo", ".oooooo."];
/** El racimo de plátano verde colgado de su tallo. */
const RACIMO = ["....o....", "...oTo...", "..oTTTo..", ".oPoPoPo.", "oPPoPPoPo", "oPPoPPoPo", "oPpoPpoPo", ".oPooPoo.", "..o..o..."];
/** La cebolla larga en atado: las hojas verdes y las cabezas blancas. */
const CEBOLLAS = ["...o...", "..oGo..", ".oGGGo.", "oGgGgGo", "oGGgGGo", "oWGWGWo", "oWWWWWo", "oWwWwWo", ".o.o.o."];
/** Una arepa de choclo, dorada y con las marcas del budare. */
const AREPA_G = ["..oooo..", ".oAaAAo.", "oAAAAaAo", ".oooooo."];
/** El budare de barro. */
const BUDARE = ["...oooooooo...", ".oBBBBBBBBBBo.", "oBbBBBBBBBBbBo", ".oBBBBBBBBBBo.", "...oooooooo..."];
/** El costal abierto con los granos (`X`) y el borde enrollado. */
const COSTAL = [
  "..ooooooo..",
  ".oXxXXxXXo.",
  "oSoXXxXXoSo",
  "oSSoooooSSo",
  "oSsSSSSSsSo",
  "oSSSSsSSSSo",
  "oSsSSSSSSSo",
  "oSSSSSSSsSo",
  ".oSSSSSSSo.",
  "..ooooooo..",
];
/** El bulto de papa cerrado, amarrado con cabuya y con la raya roja del costal. */
const BULTO = [
  "......oo......",
  ".....oCCo.....",
  "....oCooCo....",
  "....ooSSoo....",
  "...oSSSSsSo...",
  "..oSSsSSSSSo..",
  ".oSSSSSSSsSSo.",
  "oSSSsSSSSSSSSo",
  "oRRRRRRRRRRRRo",
  "oSSSSSSsSSSSSo",
  "oSsSSSSSSSsSSo",
  "oSSSSSSSSSSSSo",
  "oSSsSSSSSSSsSo",
  "oSSSSSSsSSSSSo",
  ".oSSSSSSSSsSo.",
  "..oooooooooo..",
];
/** El canasto de mimbre lleno (lo de arriba, `X`) con el tejido en rombos. */
const CANASTO = [
  "..ooooooooo..",
  ".oXXoXXXoXXo.",
  "oXXxXXXxXXXXo",
  "oBbBbBbBbBbBo",
  "obBbBbBbBbBbo",
  "oBbBbBbBbBbBo",
  ".obBbBbBbBbo.",
  "..ooooooooo..",
];
/** El cajón de madera lleno. */
const CAJON = [".oooooooooo.", "oXXxXXXxXXXo", "oXxXXXXXxXXo", "oMMMMMMMMMMo", "oMmMMmMMmMMo", "oMMMMMMMMMMo", "oMmMMmMMmMMo", ".oooooooooo."];
/** Una piedra del fogón. */
const PIEDRA_G = [".oooo.", "o5544o", "o4433o", "o3322o", ".oooo."];
/** Una cinta azul de premio con sus colas. */
const CINTA = [".ooo.", "oAaAo", "oaWao", "oAaAo", ".ooo.", "oA.Ao", "oA.Ao", ".o.o."];

const papasLey = (R: Ramp): Ley => ({ P: [R, 3.6], p: [R, 1.6] });
const yucaLey: Ley = { Y: [YUCA, 3.2], y: [YUCA, 2], w: [CREMA, 4.6] };
const mazorcaLey = (R: Ramp = MAIZ): Ley => ({ M: [R, 3.6], m: [R, 2.4], H: [CAPACHO, 3.4] });
const frutaLey = (R: Ramp): Ley => ({ F: [R, 3.4], f: [MAIZ, 4.6], g: [HOJA, 3.6] });
const racimoLey: Ley = { P: [PLATANO, 3.4], p: [PLATANO, 2.2], T: [TRONCO, 3] };
const cebollaLey: Ley = { G: [HOJA, 3.6], g: [HOJA, 2.4], W: [CREMA, 4.4], w: [ROJO, 4.4] };
const arepaLey: Ley = { A: [AREPA, 3.8], a: [AREPA, 2.2] };
const costalLey = (X: Ramp): Ley => ({ S: [FIQUE, 3.4], s: [FIQUE, 2.2], X: [X, 3.6], x: [X, 2.2] });
const bultoLey: Ley = { S: [FIQUE, 3.4], s: [FIQUE, 2.2], C: [FIQUE, 1.6], R: [ROJO, 3.2] };
const canastoLey = (X: Ramp): Ley => ({ B: [MIMBRE, 3.8], b: [MIMBRE, 2.4], X: [X, 3.6], x: [X, 2.2] });
const cajonLey = (X: Ramp): Ley => ({ M: [MADERA, 3.8], m: [MADERA, 2.4], X: [X, 3.6], x: [X, 2.2] });
const cintaLey: Ley = { A: [AZUL, 3.4], a: [AZUL, 2.2], W: [BRONCE, 4.4] };

// ---------- Piezas pintadas comunes ----------

/** Tablas ásperas paradas (el frente de un mostrador): juntas cada `ancho`, veta a lo largo y el filo de arriba. */
const tablasParadas =
  (R: Ramp, ancho: number, alto: number, base = 3.4): Pinta =>
  (u, v) => {
    const k = Math.floor(u / ancho);
    const uu = u - k * ancho;
    if (v > alto - 1) return at(R, base + 1.2);
    if (uu < 0.8) return at(R, base - 1.8);
    // Cada tabla con su tono, una veta y algún nudo, siempre en el mismo sitio.
    const t = base + ((k * 7) % 3 === 0 ? 0.4 : (k * 7) % 3 === 1 ? -0.3 : 0);
    if (Math.floor(uu) === 2 + (k % 2) && Math.floor(v) % 5 !== 0) return at(R, t - 0.7);
    if ((k * 5 + 3) % 4 === 0 && Math.abs(v - (3 + (k % 3) * 2)) < 0.8 && uu > 2 && uu < 4) return at(R, t - 1.4);
    return at(R, t);
  };

/**
 * Un rollizo (un palo redondo con su corteza) parado desde (x, y, z0): tres píxeles con el lado claro a la
 * izquierda y el oscuro a la derecha, nudos donde van y la punta cortada clara.
 */
function rollizo(L: Lienzo, x: number, y: number, z0: number, h: number) {
  const b = L.p(x, y, z0);
  const x0 = Math.round(b.x) - 1;
  const y0 = Math.round(b.y);
  const lado = [4.2, 3.1, 2];
  for (let k = 0; k < h; k++)
    for (let i = 0; i < 3; i++) {
      const nudo = (k * 5 + i * 3) % 13 === 4;
      L.set(x0 + i, y0 - 1 - k, at(TRONCO, lado[i]! - (nudo ? 1.3 : 0)));
    }
  L.set(x0, y0 - h - 1, at(MADERA, 4.6));
  L.set(x0 + 1, y0 - h - 1, at(MADERA, 4));
  L.set(x0 + 2, y0 - h - 1, at(MADERA, 3));
  return { x: x0, top: y0 - h - 1 };
}

/** Un palo acostado a lo largo de x (la leña, la vara de la carreta): caja delgada con la punta cortada. */
function palo(L: Lienzo, x: number, y: number, z: number, largo: number, grueso = 2.4) {
  L.caja(
    x,
    y,
    z,
    largo,
    grueso,
    grueso,
    (u, v) => at(TRONCO, v > grueso - 0.9 ? 4.4 : (Math.floor(u) * 3) % 7 === 2 ? 2.6 : 3.6),
    (u, v) => at(TRONCO, v > grueso - 0.9 ? 3.4 : (Math.floor(u) * 5) % 9 === 1 ? 1.6 : 2.6),
    (_u, v) => at(MADERA, v > grueso - 0.9 ? 4.6 : 3.8),
  );
}

/** El mismo palo a lo largo de y. */
function paloY(L: Lienzo, x: number, y: number, z: number, largo: number, grueso = 2.4) {
  L.caja(
    x,
    y,
    z,
    grueso,
    largo,
    grueso,
    (u, v) => at(TRONCO, u < 0.9 ? 4.4 : (Math.floor(v) * 3) % 7 === 2 ? 2.6 : 3.6),
    (_u, v) => at(MADERA, v > grueso - 0.9 ? 4.6 : 3.8),
    (u, v) => at(TRONCO, v > grueso - 0.9 ? 2.8 : (Math.floor(u) * 5) % 9 === 1 ? 1.2 : 2),
  );
}

/** Una ristra colgada desde un punto de pantalla: la cuerda de fique y las piezas que se mecen con el cuadro. */
function ristra(L: Lienzo, sx: number, sy: number, n: number, f: number, fase: number, pieza: "mazorca" | "cebolla" | "racimo") {
  const d = VAIVEN[(f + fase) % CUADROS]!;
  L.linea(Math.round(sx), Math.round(sy), Math.round(sx) + d, Math.round(sy) + 3, at(FIQUE, 2));
  if (pieza === "mazorca") {
    for (let i = 0; i < n; i++) {
      const R = i % 3 === 1 ? MAIZ_MORADO : MAIZ;
      L.estampa(sx - 2 + d + (i % 2 ? 2 : -2), sy + 2 + i * 5, MAZORCA_V, mazorcaLey(R));
    }
  } else if (pieza === "cebolla") L.estampa(sx - 3 + d, sy + 2, CEBOLLAS, cebollaLey);
  else L.estampa(sx - 4 + d, sy + 1, RACIMO, racimoLey);
}

/** Letras pintadas a mano sobre una tabla crema con su marco: el letrero de un puesto o del arco. */
function letrero(L: Lienzo, xc: number, y: number, z: number, text: string, cols: Ramp[], alongX = true) {
  const tw = anchoTexto(text);
  const bw = tw + 6;
  const hb = 11;
  const x0 = xc - bw / 2;
  // El canto de la tabla y la cara pintada.
  L.plano([x0 + bw, y - 1.2, z], [0, 1, 0], [0, 0, 1], 1.2, hb, () => at(OSCURA, 2));
  L.plano([x0, y, z], [1, 0, 0], [0, 0, 1], bw, hb, (u, v) => {
    if (v < 1 || v > hb - 1 || u < 1 || u > bw - 1) return at(MADERA, v > hb - 1 ? 3.8 : u < 1 ? 3.4 : 2.4);
    // La pintura crema, gastada en algunos sitios (asoma la madera).
    if ((Math.floor(u) * 7 + Math.floor(v) * 3) % 23 === 0) return at(MADERA, 3.6);
    return at(CREMA, v > hb - 2.2 ? 4.8 : 4.2);
  });
  const q = L.p(x0 + 3, y, z + hb - 2);
  L.letras(q.x, q.y, text, cols.map((R) => at(R, 2.2)), alpha(at(OSCURA, 0), 0.5), alongX ? 0.5 : -0.5);
}

/** Pone una grilla con la base (abajo al centro) en el punto del mundo, con la luz automática. */
const pon = (L: Lienzo, x: number, y: number, z: number, rows: readonly string[], ley: Ley, luz = true) => apoya(L, x, y, z, rows, ley, luz);

// ---------- 1. Los puestos del mercado ----------

interface PuestoOpts {
  toldo: Ramp;
  /** El letrero de encima del toldo y los colores de sus letras. */
  texto: string;
  letras: Ramp[];
  /** Lo de encima del mostrador. */
  mercancia: (L: Lienzo, zm: number) => void;
  /** Lo que cuelga del palo de adelante del toldo (se mece). */
  colgado: (L: Lienzo, xs: (x: number) => { x: number; y: number }, f: number) => void;
  /** Lo del piso, en la punta del puesto. */
  piso: (L: Lienzo, x: number) => void;
  /** Lo que sale del puesto (el humo del budare). */
  humo?: (L: Lienzo, zm: number, f: number) => void;
}

/**
 * Un puesto de mercado campesino: cuatro parales de rollizo, el mostrador de tablas ásperas, el toldo de lona
 * a rayas de su color con el festón de ondas y la costura, el letrero pintado encima, lo de cada uno en el
 * mostrador, lo colgado del palo de adelante y lo del piso en la punta. Quien lo atiende se para detrás (es
 * gente de la fiesta). Mira a +y.
 */
function puesto(o: PuestoOpts, f: number): Sprite {
  const len = 32;
  const L = new Lienzo(2, 1, 96);
  L.sombra(0, 0, len + 1, 18, 0.26);
  const zm = 12;
  const zA = 56;
  const zF = 46;
  const yF = 16.5;
  const hasta = len - 8;
  for (const x of [1.6, len - 1.6]) rollizo(L, x, 1.6, 0, zA - 1);
  // El mostrador: el frente de tablas paradas, el costado y la tabla de encima con su filo.
  L.caja(1.5, 7, 0, hasta - 1.5, 8, zm, null, tablasParadas(MADERA, 5, zm), (u, v) => at(OSCURA, v > zm - 1.2 ? 3.4 : Math.floor(u / 2.6) % 2 ? 2.6 : 2.2));
  L.caja(0.8, 6.4, zm, hasta - 0.3, 9.2, 1.6, tablas(MADERA, 3, 4.1, 9, 9.2), (_u, v) => at(MADERA, v > 0.8 ? 4 : 3), () => at(MADERA, 2.2));
  o.mercancia(L, zm + 1.6);
  o.humo?.(L, zm + 1.6, f);
  o.piso(L, hasta + 0.5);
  for (const x of [1.6, len - 1.6]) rollizo(L, x, 15.4, 0, zF - 1);
  // El toldo: franjas de lona que corren de atrás hacia adelante, con su costura y sus arrugas.
  const ancho = 4;
  const franja = (u: number) => (Math.floor(u / ancho) % 2 ? CREMA : o.toldo);
  const pend = (zF - zA) / (yF + 0.5);
  L.plano([-0.5, -0.5, zA], [1, 0, 0], [0, 1, pend], len + 1, yF + 0.5, (u, v) => {
    const uu = u % ancho;
    if (uu < 0.6) return at(franja(u), 2.4);
    const arruga = Math.floor(v) % 7 === 4 && uu > 1.2 && uu < 3.2;
    return at(franja(u), (v < 3 ? 4.6 : v < 10 ? 4.1 : 3.7) - (arruga ? 0.7 : 0) + (uu < 1.4 ? 0.3 : 0));
  });
  // El festón de ondas, al costado y al frente, con la costura de su color.
  const alto = 6;
  const onda = (u: number) => {
    const t = ((u % ancho) / ancho) * 2 - 1;
    return 2.2 + 2.6 * Math.sqrt(Math.max(0, 1 - t * t));
  };
  const feston = (u: number, v: number, luz: number): RGBA | null => {
    const bajo = alto - v;
    if (bajo > onda(u)) return null;
    if (bajo < 0.9) return at(o.toldo, 2 + luz);
    if (Math.abs(bajo - 1.7) < 0.4 && Math.floor(u) % 2 === 0) return at(CREMA, 4.6 + luz);
    return at(franja(u), 3.4 + luz - (bajo > onda(u) - 0.9 ? 1.1 : 0));
  };
  L.plano([len + 0.5, -0.5, zA - alto], [0, 1, pend], [0, 0, 1], yF + 0.5, alto, (u, v) => feston(u, v, -1));
  L.plano([-0.5, yF, zF - alto], [1, 0, 0], [0, 0, 1], len + 1, alto, (u, v) => feston(u, v, 0.3));
  // Lo colgado del palo de adelante, por debajo del festón.
  o.colgado(L, (x) => L.p(x, yF, zF - alto), f);
  letrero(L, len / 2, 1.2, zA - 2, o.texto, o.letras);
  return L.sprite();
}

/** Los tubérculos de Chepe: papa criolla y pastusa, yucas, arracacha; cebolla larga colgada y un bulto. */
function puestoTuberculos(f: number): Sprite {
  return puesto(
    {
      toldo: TOLDO.rojo!,
      texto: "PAPA",
      letras: [ROJO, HIERRO],
      mercancia: (L, zm) => {
        pon(L, 5, 11, zm, CANASTO, canastoLey(PAPA));
        pon(L, 5.5, 10.5, zm + 6, PAPAS, papasLey(PAPA));
        pon(L, 12.5, 12, zm, YUCA_G, yucaLey);
        pon(L, 13.5, 11, zm + 3, YUCA_G, yucaLey);
        pon(L, 20, 11.5, zm, PAPAS, papasLey(PASTUSA));
        pon(L, 19, 12.5, zm + 3, PAPAS, papasLey(PASTUSA));
      },
      colgado: (L, xs, f) => {
        const a = xs(4);
        const b = xs(14);
        ristra(L, a.x, a.y, 1, f, 0, "cebolla");
        ristra(L, b.x, b.y, 1, f, 2, "cebolla");
      },
      piso: (L, x) => {
        pon(L, x + 3.5, 8, 0, BULTO, bultoLey);
        pon(L, x + 5, 13.5, 0, PAPAS, papasLey(PAPA));
      },
    },
    f,
  );
}

/** Las frutas de Luz Dary: fresas, lulos y tomates; el racimo de plátano colgado y un cajón en el piso. */
function puestoFrutas(f: number): Sprite {
  return puesto(
    {
      toldo: TOLDO.amarillo!,
      texto: "FRUTAS",
      letras: [ROJO, HIERRO, LULO],
      mercancia: (L, zm) => {
        pon(L, 5.5, 11, zm, CAJON, cajonLey(FRESA));
        pon(L, 5.5, 10.5, zm + 8, FRESAS, frutaLey(FRESA));
        pon(L, 13, 11.5, zm, CANASTO, canastoLey(LULO));
        pon(L, 13, 11, zm + 6, BOLITAS, frutaLey(LULO));
        pon(L, 20, 12, zm, BOLITAS, frutaLey(TOMATE));
        pon(L, 19.5, 11, zm + 3, BOLITAS, frutaLey(TOMATE));
      },
      colgado: (L, xs, f) => {
        const a = xs(6);
        const b = xs(18);
        ristra(L, a.x, a.y, 1, f, 1, "racimo");
        ristra(L, b.x, b.y, 1, f, 3, "racimo");
      },
      piso: (L, x) => {
        pon(L, x + 3.5, 8, 0, CAJON, cajonLey(LULO));
        pon(L, x + 4.5, 13, 0, CAJON, cajonLey(FRESA));
      },
    },
    f,
  );
}

/** Granos y semillas de Doña Carmenza: costales abiertos de fríjol, maíz y arveja; mazorcas colgadas. */
function puestoGranos(f: number): Sprite {
  return puesto(
    {
      toldo: TOLDO.verde!,
      texto: "GRANOS",
      letras: [HIERRO, FRIJOL, MAIZ],
      mercancia: (L, zm) => {
        pon(L, 5, 11, zm, COSTAL, costalLey(FRIJOL));
        pon(L, 12.5, 11.5, zm, COSTAL, costalLey(MAIZ));
        pon(L, 20, 12, zm, COSTAL, costalLey(ARVEJA));
        // La totuma con la que se mide, sobre el fríjol.
        pon(L, 6, 12, zm + 9, [".ooo.", "o554o", "o433o", ".ooo."], tonos(MIMBRE), false);
      },
      colgado: (L, xs, f) => {
        for (const [x, fase] of [
          [3, 0],
          [29, 2],
        ] as const) {
          const p = xs(x);
          ristra(L, p.x, p.y, 3, f, fase, "mazorca");
        }
      },
      piso: (L, x) => {
        pon(L, x + 3.5, 8, 0, BULTO, { ...bultoLey, R: [HIERRO, 3.4] });
        pon(L, x + 5, 13.5, 0, MAZORCA_H, mazorcaLey());
      },
    },
    f,
  );
}

/** Las arepas de choclo de la Profe Marina: el budare sobre el fogoncito, la pila de arepas y su humo. */
function puestoArepas(f: number): Sprite {
  return puesto(
    {
      toldo: TOLDO.naranja!,
      texto: "AREPAS",
      letras: [ROJO, HIERRO, MAIZ],
      mercancia: (L, zm) => {
        // El fogoncito de barro con la candela adelante y el budare encima, con tres arepas.
        L.caja(13, 8, zm, 10, 7, 4, (u, v) => at(BARRO, u < 1 || v < 1 ? 3.4 : 4), (u, v) => at(BARRO, (Math.floor(u / 2.5) + Math.floor(v / 2)) % 2 ? 3 : 2.4), () => at(BARRO, 1.8));
        pon(L, 18, 11.5, zm + 4, BUDARE, { B: [BARRO, 2.4], b: [BARRO, 1.4] });
        pon(L, 16, 11, zm + 5, AREPA_G, arepaLey);
        pon(L, 20, 12, zm + 5, AREPA_G, arepaLey);
        // La pila de arepas en su plato y el quesito al lado.
        pon(L, 6, 12, zm, [".oooooooo.", "oCCCCCCCCo", ".oooooooo."], { C: [CREMA, 4] });
        for (let i = 0; i < 3; i++) pon(L, 6, 12, zm + 2 + i * 2, AREPA_G, arepaLey);
        pon(L, 9.5, 10, zm, ["oooo", "oWWo", "oWwo", "oooo"], { W: [CREMA, 4.6], w: [CREMA, 3.4] });
      },
      humo: (L, zm, f) => {
        const q = L.p(18, 11.5, zm + 6);
        humoPx(L, q.x - 1, q.y - 2, f);
        const r = L.p(15, 15, zm);
        L.estampa(r.x - 2, r.y - 4, LLAMAS[f % 4]!, LLAMA_LEY, { luz: false });
      },
      colgado: (L, xs, f) => {
        const p = xs(4);
        ristra(L, p.x, p.y, 2, f, 1, "mazorca");
      },
      piso: (L, x) => {
        pon(L, x + 3.5, 8, 0, CANASTO, canastoLey(MAIZ));
        pon(L, x + 3.5, 7.5, 6, MAZORCA_H, mazorcaLey());
        pon(L, x + 4.5, 13.5, 0, MAZORCA_H, mazorcaLey());
      },
    },
    f,
  );
}

/** Ahuyamas y canastos de Valentina: ahuyamas grandes en el mostrador y canastos de mimbre colgados. */
function puestoAhuyamas(f: number): Sprite {
  return puesto(
    {
      toldo: TOLDO.azul!,
      texto: "CANASTOS",
      letras: [AZUL, ROJO, HIERRO],
      mercancia: (L, zm) => {
        pon(L, 7, 11.5, zm, AHUYAMA_G, ahuyamaLey, false);
        pon(L, 15, 12, zm, AHUYAMA_CH, ahuyamaLey, false);
        pon(L, 19.5, 11, zm, AHUYAMA_G, ahuyamaLey, false);
        pon(L, 13, 10, zm, AHUYAMA_CH, ahuyamaLey, false);
      },
      colgado: (L, xs, f) => {
        // Los canastos que teje la abuela, vacíos y colgados de su asa.
        for (const [x, fase] of [
          [6, 0],
          [20, 2],
        ] as const) {
          const p = xs(x);
          const d = VAIVEN[(f + fase) % CUADROS]!;
          L.linea(Math.round(p.x), Math.round(p.y), Math.round(p.x) + d, Math.round(p.y) + 3, at(FIQUE, 2));
          L.estampa(p.x - 5 + d, p.y + 2, ["....ooo....", "...o...o...", "..o.....o..", ...CANASTO.slice(2).map((r) => r.slice(1, 12))], canastoLey(MIMBRE));
        }
      },
      piso: (L, x) => {
        pon(L, x + 4, 9, 0, AHUYAMA_G, ahuyamaLey, false);
        pon(L, x + 4, 14, 0, AHUYAMA_CH, ahuyamaLey, false);
      },
    },
    f,
  );
}

// ---------- 2. La olla del sancocho ----------

/** La olla tiznada vista desde arriba en 3/4: la boca con el caldo y lo que tiene, el aro, las orejas y el tizne. */
const OLLA_G = [
  "...........44444433333...........",
  ".......4444111111111113333.......",
  "....4441111111CCCCC1111111333....",
  "...44111CCCcCCCCCCcCCCCCC11133...",
  "..4411CCCCcCwwCCCcMMCCCCVCC1133..",
  "..41CCCCCPPCCCCVcCmmCCCcCCCCC13..",
  ".45CCCVCcPpCCCCcVCCCCCPPCCMCCc31.",
  ".455CCCcCCCCCCcCCCCCCcPpCCmCc331.",
  ".4455CcMmCCCCYYCCpCCcCCCCPCc3311.",
  ".444555CCCCVcCCCPPCcVCCCCC333111.",
  ".4444555555cCCCCCCcCCC3333211111.",
  "a4444554444554444444332222211111a",
  "a4444554444333333333222222211111a",
  ".5555555555444444444333333322222.",
  ".3333443333222222222111111100000.",
  ".4444554444333333333222222211111.",
  ".4444554444333333333222222211111.",
  "..kkkkKkkkkKkkkkKkkkkKkkkkKkkkk..",
  "..kkKkkkkKkkkkKkkkkKkkkkKkkkkKk..",
  "...kkkkKkkkkKkkkkKkkkkKkkkkKkk...",
  "....kKkkkkKkkkkKkkkkKkkkkKkkk....",
  ".......kKkkkkKkkkkKkkkkKkk.......",
  "...........KkkkkKkkkkK...........",
];
const OLLA_LEY: Ley = {
  ...tonos(OLLA),
  a: [OLLA, 1],
  k: at(OLLA, 0),
  K: mix(at(OLLA, 0), at(BARRO, 1), 0.4),
  C: at(CALDO, 3),
  c: at(CALDO, 2),
  w: at(CALDO, 5),
  P: at(PAPA, 4),
  p: at(PAPA, 2),
  Y: at(CREMA, 4),
  M: at(MAIZ, 4),
  m: at(MAIZ, 2),
  V: at(HOJA, 3),
};
/** El cucharón de palo que sale de la olla. */
const CUCHARON = ["....oo", "...oMo", "..oMo.", ".oMo..", "oMo...", "oo...."];
/** La candela del fogón, grande (cuatro cuadros). */
const CANDELA = [
  ["...y......y...", "..yay..y.yay..", ".yaRay.yaRRy..", "yaRRRayaRRRay.", "RRRRRRRRRRRRRR"],
  ["......y.......", ".y..yay...y...", "yay.yaRy.yay..", "yaRyaRRayaRay.", "RRRRRRRRRRRRRR"],
  ["..y.......y...", ".yay...y.yay..", ".yaRy.yay.aRy.", "yaRRayaRRaRRy.", "RRRRRRRRRRRRRR"],
  [".....y.....y..", "..y.yay...yay.", ".yayaRy..yaRy.", "yaRRaRRyyaRRay", "RRRRRRRRRRRRRR"],
];

/**
 * La olla del sancocho: el fogón de piedras de río en redondo, la leña cruzada con la candela, la olla
 * tiznada con el caldo, el cucharón de palo y el vapor; al lado, la leña arrumada. Ocupa 2x2.
 */
function ollaSancocho(f: number): Sprite {
  const L = new Lienzo(2, 2, 70);
  L.sombra(1, 1, 31, 31, 0.24);
  // La leña arrumada en el rincón de atrás.
  for (let i = 0; i < 3; i++) palo(L, 18 + (i % 2) * 2, 1 + i * 2.6, 0, 11, 2.6);
  palo(L, 19, 2.3, 2.6, 10, 2.6);
  // Las piedras de atrás del fogón, la leña cruzada y la candela.
  const piedras = Array.from({ length: 10 }, (_, k) => {
    const a = (k / 10) * Math.PI * 2 + 0.3;
    return { x: 16 + Math.cos(a) * 9, y: 17 + Math.sin(a) * 9 };
  }).sort((a, b) => a.x + a.y - (b.x + b.y));
  const atras = piedras.filter((p) => p.x + p.y < 33);
  const adelante = piedras.filter((p) => p.x + p.y >= 33);
  for (const p of atras) pon(L, p.x, p.y, 0, PIEDRA_G, tonos(PIEDRA), false);
  palo(L, 7, 15.5, 0.4, 17, 2.4);
  paloY(L, 15, 7, 1.2, 17, 2.4);
  // Las brasas rojas debajo y la candela que lame la olla.
  const q = L.p(16, 17, 2);
  for (let i = -6; i <= 6; i++) L.set(q.x + i, q.y + (Math.abs(i) > 4 ? 0 : 1), at(C.fire, 1 + ((i + f) % 3 === 0 ? 2 : 0)));
  L.estampa(q.x - 7, q.y - 4, CANDELA[f % 4]!, LLAMA_LEY, { luz: false });
  // La olla, sentada sobre las piedras.
  const o = L.p(16, 17, 7);
  L.estampa(o.x - 16, o.y - 22, OLLA_G, OLLA_LEY, { luz: false });
  // El cucharón de palo y el vapor.
  L.estampa(o.x + 5, o.y - 29, CUCHARON, { M: [MADERA, 3.8] });
  humoPx(L, o.x - 6, o.y - 24, f);
  humoPx(L, o.x + 3, o.y - 26, (f + 2) % 4);
  for (const p of adelante) pon(L, p.x, p.y, 0, PIEDRA_G, tonos(PIEDRA), false);
  return L.sprite();
}

// ---------- 3. La báscula y el tablero del concurso ----------

/** El reloj de la báscula: la cara crema, las rayitas de los kilos, la aguja roja y el aro de bronce. */
const RELOJ = [
  "...ooooo...",
  "..oBBBBBo..",
  ".oBWWkWWBo.",
  "oBWkWWWkWBo",
  "oBWWWWWrWBo",
  "oBkWWWrWkBo",
  "oBWWWnWWWBo",
  "oBWkWWWkWBo",
  ".oBWWkWWBo.",
  "..oBBBBBo..",
  "...ooooo...",
];
const RELOJ_LEY: Ley = { B: [BRONCE, 3.6], W: at(CREMA, 4.6), k: at(OSCURA, 1), r: at(ROJO, 3), n: at(OSCURA, 0) };

/**
 * La báscula de plataforma del concurso: la plataforma de tablas con su marco de hierro verde, la columna con
 * el reloj de cara al público y una ahuyama encima; la cinta azul colgada de un clavo.
 */
function bascula(): Sprite {
  const L = new Lienzo(2, 1, 60);
  L.sombra(0.5, 1, 31, 15, 0.26);
  // La columna de atrás (a la derecha), de hierro verde, con el reloj arriba.
  L.caja(25, 3, 0, 4, 4, 34, (u, v) => at(HIERRO, u < 1 || v > 3 ? 4.6 : 4), (u, v) => at(HIERRO, v > 33 ? 4.4 : u < 1 ? 3.6 : 3), (_u, v) => at(HIERRO, v > 33 ? 3 : 2));
  const r = L.p(27, 7, 32);
  L.estampa(r.x - 6, r.y - 9, RELOJ, RELOJ_LEY, { luz: false });
  L.estampa(r.x + 4, r.y + 4, CINTA, cintaLey, { luz: false });
  // La plataforma: el marco de hierro y las tablas de encima.
  L.caja(2, 4, 0, 22, 11, 3, null, (u, v) => at(HIERRO, v > 2 ? 4 : Math.floor(u) % 6 === 0 ? 2 : 3), (_u, v) => at(HIERRO, v > 2 ? 3 : 2));
  L.caja(2.6, 4.6, 3, 20.8, 9.8, 0.8, tablas(MADERA, 2.4, 4, 3, 9.8), (_u, v) => at(MADERA, v > 0.4 ? 3.8 : 3), () => at(MADERA, 2.4));
  // Los remaches de bronce en las esquinas del marco.
  for (const x of [3, 22.8]) {
    const p = L.p(x, 15, 2);
    L.set(p.x, p.y, at(BRONCE, 4.6));
  }
  pon(L, 13, 10, 3.8, AHUYAMA_G, ahuyamaLey, false);
  pon(L, 19, 12.5, 3.8, AHUYAMA_CH, ahuyamaLey, false);
  return L.sprite();
}

/**
 * El tablero del concurso: una pizarra verde enmarcada en madera sobre dos patas, con una ahuyama pintada
 * arriba, las filas de los primeros puestos escritas con tiza y la cinta azul clavada.
 */
function tablero(): Sprite {
  const L = new Lienzo(1, 1, 50);
  L.sombra(1, 6, 14, 6, 0.24);
  for (const x of [2.4, 13.6]) rollizo(L, x, 9, 0, 40);
  const z0 = 12;
  const alto = 26;
  L.caja(1, 8, z0, 14, 1.4, alto, (_u, v) => at(MADERA, v > 0.7 ? 4.4 : 3.8), (u, v) => {
    if (v < 1.4 || v > alto - 1.4 || u < 1.2 || u > 12.8) return at(MADERA, v > alto - 0.7 ? 4.4 : u < 0.6 ? 3.8 : 3);
    const fila = Math.floor((alto - v - 8) / 4.2);
    const vv = (alto - v - 8) - fila * 4.2;
    // Las filas de tiza: el número y el nombre (rayitas), cada vez más cortas.
    if (fila >= 0 && fila < 3 && vv > 1.4 && vv < 2.4) {
      if (u > 2 && u < 3.2) return at(CREMA, 4.8);
      if (u > 4.2 && u < 11.6 - fila * 1.8 && Math.floor(u * 1.4) % 4 !== 3) return at(CREMA, 4.2);
    }
    if (alto - v < 8) return at(MADERA, 4);
    return at(HIERRO, 1.6 + ((Math.floor(u) + Math.floor(v)) % 5 === 0 ? 0.4 : 0));
  }, (_u, v) => at(MADERA, v > alto - 0.7 ? 3.4 : 2.4));
  // La ahuyama pintada en el encabezado y la cinta azul de la esquina.
  const q = L.p(8, 9.4, z0 + alto - 1);
  L.estampa(q.x - 4, q.y, AHUYAMA_CH, ahuyamaLey, { luz: false });
  L.estampa(q.x + 2, q.y + 3, CINTA, cintaLey, { luz: false });
  return L.sprite();
}

// ---------- 4. La tómbola de la junta ----------

/** El tambor de la tómbola de lado, con las tablillas que corren al girar (cuadro `f`) y los aros de bronce. */
function tambor(f: number): string[] {
  const forma = [
    "......oooooooo......",
    "...oooRRRRRRRRooo...",
    "..oRRRRRRRRRRRRRRo..",
    ".oRRRRRRRRRRRRRRRRo.",
    "oYYYYYYYYYYYYYYYYYYo",
    "oRRRRRRRRRRRRRRRRRRo",
    "oRRRRRRRRRRRRRRRRRRo",
    "oRRRRRRRRRRRRRRRRRRo",
    "oRRRRRRRRRRRRRRRRRRo",
    "oRRRRRRRRRRRRRRRRRRo",
    "oYYYYYYYYYYYYYYYYYYo",
    ".oRRRRRRRRRRRRRRRRo.",
    "..oRRRRRRRRRRRRRRo..",
    "...oooRRRRRRRRooo...",
    "......oooooooo......",
  ];
  // Las juntas de las tablillas bajan una fila por cuadro (el tambor gira hacia adelante); la puertica
  // con su cerrojo sube y baja con ellas.
  return forma.map((row, y) =>
    [...row]
      .map((ch, x) => {
        if (ch !== "R") return ch;
        if ((y + f) % 4 === 0) return "r";
        if ((y + f) % 4 === 2 && x > 7 && x < 12) return x === 9 ? "Y" : "d";
        return ch;
      })
      .join(""),
  );
}
const TAMBOR_LEY: Ley = { R: [ROJO, 3.4], r: [ROJO, 1.8], d: [ROJO, 4.4], Y: [BRONCE, 4] };
/** Las balotas de colores en su platón. */
const BALOTAS = ["..o.o.o..", ".oRoYoBo.", "oWWWWWWWo", ".ooooooo."];

/**
 * La tómbola de la junta: la mesa con mantel de cuadros, el tambor rojo con aros de bronce sobre su
 * caballete y la manivela que gira, el platón de balotas, la caja de las boletas y el letrero encima.
 */
function tombola(f = 0): Sprite {
  const L = new Lienzo(2, 1, 76);
  L.sombra(0.5, 1, 31, 15, 0.26);
  // El letrero de la junta, bajito sobre dos palos detrás (no tapa los puestos de atrás).
  for (const x of [5, 27]) rollizo(L, x, 1.5, 0, 38);
  letrero(L, 16, 1.6, 34, "TOMBOLA", [ROJO, AZUL, HIERRO]);
  // Las patas de la mesa.
  for (const [x, y] of [
    [2, 3],
    [28.5, 3],
    [2, 13],
    [28.5, 13],
  ] as const)
    L.bloque(x, y, 0, 1.6, 1.6, 12, MADERA, -0.4);
  // El mantel de cuadros rojos y crema que cae por el frente.
  const cuadros: Pinta = (u, v) => ((Math.floor(u / 3) + Math.floor(v / 3)) % 2 ? at(CREMA, 4.4) : at(ROJO, 3.4));
  L.caja(1, 2, 12, 30, 13, 1, cuadros, (u, v) => (v > 0.5 ? cuadros(u, 4) : at(ROJO, 2.4)), () => at(ROJO, 2));
  L.plano([1, 15, 7], [1, 0, 0], [0, 0, 1], 30, 5, (u, v) => {
    if (v < 0.8 && Math.floor(u) % 2) return null;
    return (Math.floor(u / 3) + Math.floor(v / 3)) % 2 ? at(CREMA, 3.8) : at(ROJO, 3);
  });
  // El tambor sobre su caballete: dos patas en A de madera a los lados, con el eje de bronce.
  const zm = 13;
  const c = L.p(14, 8, zm + 15);
  L.estampa(c.x - 10, c.y - 7, tambor(f), TAMBOR_LEY);
  for (const dx of [-12, 11]) {
    L.linea(c.x + dx - 3, c.y + 13, c.x + dx, c.y, at(MADERA, 3.8));
    L.linea(c.x + dx - 2, c.y + 13, c.x + dx + 1, c.y, at(MADERA, 2.8));
    L.linea(c.x + dx + 4, c.y + 13, c.x + dx + 1, c.y, at(MADERA, 2.4));
    L.set(c.x + dx, c.y, at(BRONCE, 4.6));
    L.set(c.x + dx + 1, c.y, at(BRONCE, 3.4));
  }
  const ang = (f / CUADROS) * Math.PI * 2;
  const ex = c.x + 14;
  const ey = c.y;
  const hx = Math.round(ex + Math.cos(ang) * 3);
  const hy = Math.round(ey + Math.sin(ang) * 3);
  L.linea(c.x + 12, c.y, ex, ey, at(BRONCE, 3));
  L.linea(ex, ey, hx, hy, at(BRONCE, 4));
  L.estampa(hx - 1, hy - 1, ["oo", "MM", "oo"], { M: [MADERA, 3.6] });
  // El platón de balotas y la caja de las boletas.
  pon(L, 25, 10, zm, BALOTAS, { R: [ROJO, 3.6], Y: [MAIZ, 4], B: [AZUL, 3.6], W: [CREMA, 4.2] });
  L.caja(23, 4, zm, 6, 4, 4, (u, v) => (u > 1 && u < 5 && v > 1.6 && v < 2.4 ? at(OSCURA, 0) : at(MADERA, 4.2)), (_u, v) => at(MADERA, v > 3 ? 3.8 : 3.2), () => at(MADERA, 2.2));
  return L.sprite();
}

// ---------- 5. Bultos, canastos y el poste de mazorcas ----------

/** El bulto de papa: el costal de fique amarrado, con su raya roja, y unas papas que se salieron. */
function bultoPapa(): Sprite {
  const L = new Lienzo(1, 1, 30);
  L.sombra(1, 2, 14, 13, 0.24);
  pon(L, 7.5, 9, 0, BULTO, bultoLey);
  pon(L, 12.5, 14, 0, PAPAS.slice(1), papasLey(PAPA));
  return L.sprite();
}

/** El canasto de la cosecha: ancho y bajo, rebosado de mazorcas, ahuyamas y papas. */
function canastoLleno(): Sprite {
  const L = new Lienzo(1, 1, 30);
  L.sombra(1, 2, 14, 12, 0.24);
  const ancho = [
    "....ooooooooooooooo....",
    "..ooBBBBBBBBBBBBBBBoo..",
    ".oBBbBbBbBbBbBbBbBbBBo.",
    "oBbBbBbBbBbBbBbBbBbBbBo",
    "oCCCCCCCCCCCCCCCCCCCCCo",
    "obBbBbBbBbBbBbBbBbBbBbo",
    "oBbBbBbBbBbBbBbBbBbBbBo",
    "obBbBbBbBbBbBbBbBbBbBbo",
    ".oBbBbBbBbBbBbBbBbBbBo.",
    "..ooBbBbBbBbBbBbBbBoo..",
    "....ooooooooooooooo....",
  ];
  pon(L, 8, 10, 0, ancho, { ...canastoLey(MIMBRE), C: [MIMBRE, 4.4] });
  pon(L, 4.5, 8, 9, MAZORCA_H, mazorcaLey());
  pon(L, 10.5, 7, 9, AHUYAMA_G, ahuyamaLey, false);
  pon(L, 5, 11.5, 9, PAPAS, papasLey(PASTUSA));
  pon(L, 9.5, 12, 9, MAZORCA_H, mazorcaLey(MAIZ_MORADO));
  pon(L, 12, 11, 10, AHUYAMA_CH, ahuyamaLey, false);
  return L.sprite();
}

/** El canasto de mimbre (para la oficina): alto, con su asa trenzada y mazorcas y papas adentro. */
function canastoMimbre(): Sprite {
  const L = new Lienzo(1, 1, 40);
  L.sombra(1, 2, 14, 13, 0.24);
  const alto = [
    "....ooooooooooooo....",
    "..ooXXoXXXXoXXXXXoo..",
    ".oXXxXXXoXXxXXXoXXxo.",
    "oBBBBBBBBBBBBBBBBBBBo",
    "oBbBbBbBbBbBbBbBbBbBo",
    "obBbBbBbBbBbBbBbBbBbo",
    "oCCCCCCCCCCCCCCCCCCCo",
    "oBbBbBbBbBbBbBbBbBbBo",
    "obBbBbBbBbBbBbBbBbBbo",
    "oBbBbBbBbBbBbBbBbBbBo",
    "obBbBbBbBbBbBbBbBbBbo",
    ".oBbBbBbBbBbBbBbBbBo.",
    "..ooBbBbBbBbBbBbBoo..",
    "....ooooooooooooo....",
  ];
  // El asa trenzada por detrás del canasto: dos hilos de mimbre que se cruzan.
  const asa = ["......AAAAAAAAA......", "....AAaAaAaAaAaAA....", "..AAa...........aAA..", ".Aa...............aA.", "Aa.................aA", "aA.................Aa", "Aa.................aA"];
  const q = L.p(8, 9, 0);
  L.estampa(q.x - 10, q.y - 24, asa, { A: [MIMBRE, 4], a: [MIMBRE, 2.6] });
  pon(L, 8, 9, 0, alto, { ...canastoLey(PAPA), C: [ROJO, 3.4] });
  pon(L, 5.5, 8, 12, MAZORCA_V.slice(0, 6), mazorcaLey());
  pon(L, 9, 7.5, 12, MAZORCA_V.slice(0, 5), mazorcaLey(MAIZ_MORADO));
  pon(L, 11.5, 9, 12, PAPAS.slice(0, 4), papasLey(PAPA));
  return L.sprite();
}

/** El poste de mazorcas: un rollizo alto con la cruceta, ristras colgadas a cada lado y ahuyamas al pie. */
function posteMazorcas(f = 0): Sprite {
  const L = new Lienzo(1, 1, 64);
  L.sombra(3, 3, 10, 10, 0.24);
  const top = rollizo(L, 8, 8, 0, 54);
  // La cruceta, con un moño de fique.
  const a = L.p(2, 8, 50);
  const b = L.p(14, 8, 50);
  L.linea(a.x, a.y, b.x, b.y, at(TRONCO, 3.6));
  L.linea(a.x, a.y + 1, b.x, b.y + 1, at(TRONCO, 2));
  L.estampa(top.x - 2, top.top + 3, [".o.o.", "oSoSo", ".oSo.", "oS.So"], { S: [FIQUE, 3.8] });
  ristra(L, a.x + 1, a.y + 1, 4, f, 0, "mazorca");
  ristra(L, b.x - 1, b.y + 1, 4, f, 2, "mazorca");
  pon(L, 5, 12, 0, AHUYAMA_CH, ahuyamaLey, false);
  pon(L, 11, 12.5, 0, AHUYAMA_G, ahuyamaLey, false);
  return L.sprite();
}

// ---------- 6. El arco de mazorcas ----------

/**
 * El arco de mazorcas sobre el camino (5 tiles a lo largo de x; se pasa por los tres del medio): dos
 * rollizos gruesos, la viga de guadua curva con la guirnalda de mazorcas amarillas, blancas y moradas que se
 * mece, el letrero "COSECHA" pintado encima y ahuyamas y un canasto al pie de cada palo.
 */
function arcoMazorcas(f = 0): Sprite {
  const largo = 80;
  const L = new Lienzo(5, 1, 110);
  L.sombra(0, 2, 16, 13, 0.26);
  L.sombra(64, 2, 16, 13, 0.26);
  const colH = 58;
  for (const x of [7, largo - 7]) {
    // Cada palo es un rollizo doble (más grueso) sobre una piedra.
    pon(L, x, 9, 0, [".ooooooo.", "o5544332o", "o4433221o", ".ooooooo."], tonos(PIEDRA), false);
    rollizo(L, x - 1, 8, 2, colH);
    rollizo(L, x + 1.5, 8, 2, colH);
  }
  // La viga de guadua curva, con sus nudos.
  const a0 = 5;
  const a1 = largo - 5;
  const curva = (a: number) => colH + 2 + Math.sin((Math.PI * (a - a0)) / (a1 - a0)) * 10;
  const grueso = 4;
  L.plano([a0, 8, colH], [1, 0, 0], [0, 0, 1], a1 - a0, 20, (u, v) => {
    const z = colH + v;
    const base = curva(a0 + u);
    if (z < base || z > base + grueso) return null;
    const t = z - base;
    if (Math.floor(u) % 14 === 0) return at(MAIZ, 1.6);
    return at(MAIZ, t > grueso - 1 ? 4.6 : t > 1 ? 3.6 : 2.4);
  });
  // La guirnalda de mazorcas colgada de la viga, que se mece.
  for (let a = a0 + 6, i = 0; a < a1 - 5; a += 4.6, i++) {
    const q = L.p(a, 8, curva(a) - 0.5);
    const d = VAIVEN[(f + i) % CUADROS]!;
    const R = [MAIZ, CREMA, MAIZ_MORADO][i % 3]!;
    L.linea(q.x, q.y, q.x + d, q.y + 2 + (i % 2) * 2, at(FIQUE, 2));
    L.estampa(q.x - 2 + d, q.y + 2 + (i % 2) * 2, MAZORCA_V, mazorcaLey(R));
  }
  letrero(L, largo / 2, 8, curva(largo / 2) + 3, "COSECHA", [ROJO, HIERRO, AHUYAMA, AZUL]);
  // Al pie de cada palo: ahuyamas y un canasto de papas.
  pon(L, 13, 12, 0, AHUYAMA_G, ahuyamaLey, false);
  pon(L, 3, 13, 0, AHUYAMA_CH, ahuyamaLey, false);
  pon(L, largo - 13, 12, 0, CANASTO, canastoLey(PAPA));
  pon(L, largo - 3, 13, 0, AHUYAMA_CH, ahuyamaLey, false);
  return L.sprite();
}

// ---------- 7. La carreta de la cosecha (el premio de la tómbola) ----------

/** La rueda de madera de la carreta, con sus rayos y el aro de hierro. */
const RUEDA = [
  ".....AAAAA.....",
  "...AAaaaaaAA...",
  "..AaM..M..MaA..",
  ".Aa.M..M..M.aA.",
  ".A...M.M.M...A.",
  "Aa....MMM....aA",
  "AaMMMMMHMMMMMaA",
  "Aa....MMM....aA",
  ".A...M.M.M...A.",
  ".Aa.M..M..M.aA.",
  "..AaM..M..MaA..",
  "...AAaaaaaAA...",
  ".....AAAAA.....",
];

/**
 * La carreta de la cosecha: la caja de tablas con sus barandas, las dos ruedas de rayos, las varas para
 * jalarla y la carga de ahuyamas, mazorcas y papas, con el moño rojo del premio.
 */
function carreta(): Sprite {
  const L = new Lienzo(2, 1, 48);
  L.sombra(1, 2, 30, 13, 0.24);
  // La rueda de atrás asoma por debajo.
  const r1 = L.p(14, 3, 7);
  L.estampa(r1.x - 7, r1.y - 6, RUEDA, { A: [OSCURA, 2.2], a: [MADERA, 2], M: [MADERA, 2.6], H: [OSCURA, 1] });
  // Las varas, hacia adelante (+x).
  palo(L, 24, 4, 7, 9, 1.6);
  palo(L, 24, 11, 7, 9, 1.6);
  // La caja de tablas y las barandas.
  L.caja(2, 3, 8, 22, 10, 5, tablas(MADERA, 2.5, 3.6, 5, 10), tablas(MADERA, 2.4, 3.4, 6, 5), (_u, v) => at(MADERA, v > 4 ? 3.4 : 2.4));
  // La carga.
  pon(L, 7, 7, 13, AHUYAMA_G, ahuyamaLey, false);
  pon(L, 17, 7.5, 13, AHUYAMA_G, ahuyamaLey, false);
  pon(L, 12, 10, 13, AHUYAMA_CH, ahuyamaLey, false);
  pon(L, 6, 11, 13, MAZORCA_H, mazorcaLey());
  pon(L, 19, 11.5, 13, PAPAS, papasLey(PAPA));
  pon(L, 12, 12, 17, MAZORCA_H, mazorcaLey(MAIZ_MORADO));
  // La baranda de adelante tapa un poco la carga.
  L.caja(2, 12.6, 13, 22, 0.6, 2, () => at(MADERA, 4.4), (u) => at(MADERA, Math.floor(u) % 5 === 0 ? 2.4 : 3.8), () => at(MADERA, 2.6));
  // La rueda de adelante y el moño rojo del premio.
  const r2 = L.p(14, 13.4, 7);
  L.estampa(r2.x - 7, r2.y - 6, RUEDA, { A: [OSCURA, 2.8], a: [MADERA, 3.4], M: [MADERA, 3.8], H: [BRONCE, 4] });
  const m = L.p(23, 13, 13);
  L.estampa(m.x - 4, m.y - 4, ["oo...oo", "oRo.oRo", "oRRoRRo", ".oRRRo.", "oRRoRRo", "oRo.oRo", ".o...o."], { R: [ROJO, 3.6] });
  return L.sprite();
}

// ---------- Registro ----------

/** Cuántos cuadros tiene cada mueble que se mueve (el navegador los pasa en bucle). */
export const COSECHA_FRAMES: Record<string, number> = {
  "puesto-cosecha-rojo": CUADROS,
  "puesto-cosecha-amarillo": CUADROS,
  "puesto-cosecha-verde": CUADROS,
  "puesto-cosecha-naranja": CUADROS,
  "puesto-cosecha-azul": CUADROS,
  "olla-sancocho": CUADROS,
  tombola: CUADROS,
  "poste-mazorcas": CUADROS,
  "arco-mazorcas": CUADROS,
};

const DIBUJO: Record<string, (f: number) => Sprite> = {
  "puesto-cosecha-rojo": puestoTuberculos,
  "puesto-cosecha-amarillo": puestoFrutas,
  "puesto-cosecha-verde": puestoGranos,
  "puesto-cosecha-naranja": puestoArepas,
  "puesto-cosecha-azul": puestoAhuyamas,
  "olla-sancocho": ollaSancocho,
  bascula,
  "tablero-cosecha": tablero,
  tombola,
  "bulto-papa": bultoPapa,
  "canasto-lleno": canastoLleno,
  "poste-mazorcas": posteMazorcas,
  "arco-mazorcas": arcoMazorcas,
  "canasto-mimbre": canastoMimbre,
  "carreta-cosecha": carreta,
};

/** Los tipos con dibujo (para el catálogo y los tests). */
export const COSECHA_TYPES = Object.keys(DIBUJO);

const cuadros = new Map<string, Sprite[]>();

/**
 * El cuadro `f` de un mueble de la feria. Todos los cuadros tienen el mismo lienzo y el mismo origen que el
 * dibujo del catálogo (el cuadro 0): el navegador solo le cambia la textura.
 */
export function cosechaSprite(type: string, f = 0): Sprite {
  let list = cuadros.get(type);
  if (!list) {
    const draw = DIBUJO[type];
    if (!draw) throw new Error(`Sin dibujo de la cosecha: ${type}`);
    const n = COSECHA_FRAMES[type] ?? 1;
    list = n > 1 ? mismoLienzo(Array.from({ length: n }, (_, k) => draw(k))) : [draw(0)];
    cuadros.set(type, list);
  }
  return list[((f % list.length) + list.length) % list.length]!;
}

/** Los dibujos del catálogo (van en DRAW de furniture.ts): el cuadro 0 de cada uno. */
export const COSECHA_DRAW: Record<string, () => Sprite> = Object.fromEntries(COSECHA_TYPES.map((t) => [t, () => cosechaSprite(t, 0)]));

// ---------- La Pinta, la mula de Don Ramiro ----------

/** Vista de la mula: de lado (mirando a la derecha; a la izquierda se voltea), de frente o de espaldas. */
export type MulaView = "side" | "front" | "back";

/** El pelo pardo de la Pinta, la barriga y el hocico claros, la crin y la cola oscuras. */
const MULA = ramp("#2e1a10", "#4e2e1c", "#6e4428", "#8a5a3a", "#a87a52", "#c89a6e");
const MULA_CLARO = ramp("#5a3e2a", "#7e5c42", "#a07c5c", "#bc9a78", "#d6b896", "#ecd6b8");
const MULA_LEY: Ley = {
  p: [MULA, 3.2],
  P: [MULA, 2.2],
  q: [MULA_CLARO, 3.4],
  h: [OSCURA, 1.8],
  k: [OSCURA, 1],
  e: at(OSCURA, 0),
  N: at(OSCURA, 1),
  r: [ROJO, 3.2],
  R: [MAIZ, 3.6],
  c: [MIMBRE, 3.8],
  b: [MIMBRE, 2.6],
  n: [PAPA, 3.6],
  a: [AHUYAMA, 3.4],
  G: [HOJA, 2.6],
};

/** De lado, mirando a la derecha: dos cuadros del paso (las patas se cruzan). */
const MULA_LADO = [
  [
    "..........................oppooo....",
    "..........................oppoPPo...",
    "..........................oppoPo....",
    "..........................oppoPo....",
    "..........................oppoPoo...",
    ".........................ohhpppppo..",
    ".........................ohppppppo..",
    ".................ooo....ohhppppeppo.",
    "..........oooooooaGaoooohhppppppqqo.",
    ".........orrnnnnaaaaarrohhpppppqqqqo",
    ".....o..oorrnnnnaaaaarrhhpppppoqqqNo",
    "....ohoopprrnnnnaaaaarrppppppo.oqqqo",
    "....ohhpppRrbcbcbcbcbrRppppppo..ooo.",
    "...ohhppppppcbcbcbcbcppppppppo......",
    "...ohhppppppbcbcbcbcbppppppppo......",
    "...ohhppppppcbcbcbcbcppppppppo......",
    "...ohhppppppbcbcbcbcbppppppoo.......",
    "...ohhoppqqqcbcbcbcbcqqqppo.........",
    "..ohhhoopqqqbcbcbcbcbqqqpppo........",
    "..ohho.oPPppbbbbbbbbbppPoppo........",
    "..ohho.oPPoppopppppoooPPoppo........",
    "..ohho.oPPoppoooooo..oPPoppo........",
    "..ohho.oPPoppo.......oPPoppo........",
    "..ohho.oPPoppo.......oPPoppo........",
    "..oho..oPPoppo.......oPPoppo........",
    "...o...oPPoppo.......oPPoppo........",
    ".......oPPoppo.......oPPoppo........",
    ".......oPPoppo.......oPPoppo........",
    ".......okkokko.......okkokko........",
    "........oo.oo.........oo.oo.........",
  ],
  [
    "..........................oppooo....",
    "..........................oppoPPo...",
    "..........................oppoPo....",
    "..........................oppoPo....",
    "..........................oppoPoo...",
    ".........................ohhpppppo..",
    ".........................ohppppppo..",
    ".................ooo....ohhppppeppo.",
    "..........oooooooaGaoooohhppppppqqo.",
    ".........orrnnnnaaaaarrohhpppppqqqqo",
    ".....o..oorrnnnnaaaaarrhhpppppoqqqNo",
    "....ohoopprrnnnnaaaaarrppppppo.oqqqo",
    "....ohhpppRrbcbcbcbcbrRppppppo..ooo.",
    "...ohhppppppcbcbcbcbcppppppppo......",
    "...ohhppppppbcbcbcbcbppppppppo......",
    "...ohhppppppcbcbcbcbcppppppppo......",
    "...ohhppppppbcbcbcbcbppppppoo.......",
    "...ohhoppqqqcbcbcbcbcqqqppo.........",
    "..ohhhoPpqqqbcbcbcbcbqqqppo.........",
    "..ohhooPPoppbbbbbbbbbppPppo.........",
    "..ohhooPPooopppppppooooPppo.........",
    "..ohhooPPo.oppooooo...oPppo.........",
    "..ohhooPPo.oppo.......oPppo.........",
    "..ohhooPPo.oppo.......oPppo.........",
    "..oho.oPPo.oppo.......oPppo.........",
    "...o..oPPo.oppo.......oPppo.........",
    "......oPPo.oppo.......oPppo.........",
    "......oPPo.oppo.......oPppo.........",
    "......okko.okko.......okkko.........",
    ".......oo...oo.........ooo..........",
  ],
];

/** De frente: la cara larga con las orejas, los canastos a los dos lados y la enjalma. */
const MULA_FRENTE = [
  "......oo........oo......",
  ".....oppo......oppo.....",
  ".....oPpo......oPpo.....",
  ".....oPpo......oPpo.....",
  "......oPpoohhoopPo......",
  ".......oppphhpppo.......",
  "......opppphhppppo......",
  "......opepppppepo.......",
  "......oppppppppppo......",
  "......opppppppppo.......",
  "...oo..oppqqqqppo..oo...",
  "..onao.opqqqqqqpo.onao..",
  ".oaaaaoopqNqqNqpooaaaao.",
  "ocbcbcborqqqqqqrobcbcbco",
  "obcbcbcbrrrrrrrrcbcbcbco",
  "ocbcbcborpppppprocbcbcbo",
  "obcbcbcborpppprobcbcbcbo",
  ".obcbcbo.oppppo.obcbcbo.",
  "..ooooo..oPppPo..ooooo..",
  ".........oPo.Po.........",
  ".........oPo.Po.........",
  ".........oPo.Po.........",
  ".........oPo.Po.........",
  ".........oko.ko.........",
  "..........o...o.........",
];

/** De espaldas: el anca, la cola y los canastos. */
const MULA_ESPALDA = [
  "......oo........oo......",
  ".....oppo......oppo.....",
  ".....opPo......opPo.....",
  "......opPohhhhoPpo......",
  ".......ophhhhhhpo.......",
  "...oo...ophhhhpo...oo...",
  "..onao.orrrrrrrro.onao..",
  ".oaaaaorrRrRrRrrroaaaao.",
  "ocbcbcbopppppppppbcbcbco",
  "obcbcbcopppphpppocbcbcbo",
  "ocbcbcbopppphhpppcbcbcbo",
  "obcbcbcoppphhhpppocbcbco",
  ".obcbcbopppphhpppobcbco.",
  "..ooooo.opPPhhPPpo.ooo..",
  "........oPPohhoPPo......",
  "........oPPohhoPPo......",
  "........oPPo.hoPPo......",
  "........oPPo...oPPo.....",
  "........oPPo...oPPo.....",
  "........okko...okko.....",
  ".........oo.....oo......",
];

/** Una grilla de la mula sobre un lienzo de su tamaño, con la luz de arriba a la izquierda. */
function grillaMula(rows: readonly string[]): PixelCanvas {
  const w = Math.max(...rows.map((r) => r.length));
  const L = new Lienzo(Math.ceil(w / 16), 1, rows.length, 0);
  L.estampa(0, 0, rows, MULA_LEY);
  const out = new PixelCanvas(w, rows.length);
  for (let y = 0; y < rows.length; y++) out.data.set(L.c.data.subarray(y * L.c.width * 4, (y * L.c.width + w) * 4), y * w * 4);
  return out;
}

/**
 * La Pinta con sus dos canastos de papas y una ahuyama sobre la enjalma roja. `frame` 0 o 1: el paso (las
 * patas se cruzan). Mira a la derecha (a la izquierda se voltea); de frente sale en el retrato.
 */
export function drawMula(view: MulaView, frame = 0): PixelCanvas {
  if (view === "side") return grillaMula(MULA_LADO[frame % 2]!);
  return grillaMula(view === "front" ? MULA_FRENTE : MULA_ESPALDA);
}
