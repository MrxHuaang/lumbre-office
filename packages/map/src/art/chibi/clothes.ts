// Ropa del chibi: piernas y zapatos, brazos, parte de arriba (con su patrón), parte de abajo y
// conjuntos. Filas del cuerpo: torso 13-17, cintura 18, piernas 19-21, zapatos 22-23 (ver kit.ts).
import type { Bottom, FullLook, Outfit, Pattern, Top } from "@hyvento/shared";
import { hex, type PixelCanvas, type RGBA } from "../pixel";
import type { Ctx, Row, Tones, View } from "./kit";

/** Largo de manga de cada parte de arriba. */
const SLEEVE: Record<Top, "none" | "short" | "long"> = {
  tshirt: "short",
  longsleeve: "long",
  hoodie: "long",
  sweater: "long",
  "shirt-tie": "long",
  tank: "none",
  polo: "short",
};

/** Partes de arriba que usan el color secundario (top2) aunque sean lisas. */
export const TOPS_WITH_TOP2: readonly Top[] = ["hoodie", "sweater", "shirt-tie", "polo"];

/** Dónde se ve el color secundario: patrón, capucha (forro y cordones), cuello, corbata o puños. */
export type Top2Part = Exclude<Pattern, "solid"> | "hood" | "collar" | "tie" | "cuffs";

/**
 * Lo que se pinta con top2 en este look, para que el editor diga dónde se ve (o que no se ve). El
 * vestido tapa cuello, capucha y corbata, pero sus mangas siguen siendo las de la parte de arriba; la
 * chaqueta cambia las mangas por las suyas.
 */
export function top2Parts(look: FullLook): Top2Part[] {
  const parts: Top2Part[] = look.pattern === "solid" ? [] : [look.pattern];
  const dress = look.outfit === "dress";
  if (!dress && look.top === "hoodie") parts.push("hood");
  if (!dress && look.top === "shirt-tie") parts.push("tie");
  if (look.top === "sweater" || look.top === "polo") {
    if (!dress) parts.push("collar");
    if (look.outfit !== "jacket") parts.push("cuffs");
  }
  return parts;
}

/** Botones dorados del overol y del polo. */
const BUTTON = hex("#f4d35e");

/** ¿Ese píxel de tela lleva el color del patrón? Rayas cada dos filas; puntos en filas alternas, corridos. */
function inPattern(p: Pattern, x: number, row: number): boolean {
  if (p === "stripes") return row % 2 === 0;
  if (p === "dots") return row % 2 === 0 && (x + row) % 4 === 0;
  return false;
}

/** Pinta un píxel de la tela de arriba con el tono k (0 sombra, 1 base, 2 luz): el patrón sigue la sombra. */
type Cloth = (x: number, row: number, k: 0 | 1 | 2) => void;
function cloth({ c, t, look, y }: Ctx): Cloth {
  return (x, row, k) => c.set(x, y(row), inPattern(look.pattern, x, row) ? t.top2[k] : t.shirt[k]);
}

// ---------- Piernas y zapatos ----------

/** Piernas (tela o piel según la parte de abajo) y zapatos. Sentado, las piernas se doblan hacia adelante. */
export function drawLegs(ctx: Ctx) {
  const { c, t, look, frame, sit, y, Y } = ctx;
  // Con vestido la parte de abajo no se ve: piernas de piel.
  const bottom = look.outfit === "dress" ? null : look.bottom;
  // Filas de tela desde la cadera (el resto de la pierna es piel).
  const cover = bottom === "pants" ? 3 : bottom === "shorts" ? 1 : 0;
  if (sit) return drawLap(ctx, bottom);
  // La cadera baja con el torso en cada paso (la cintura tapa la fila 19): la pierna empieza bajo
  // ella, así el short se ve en los tres frames.
  const hip = y(19) - Y(0);
  const lift = (leg: 0 | 1) => (frame === 1 && leg === 0) || (frame === 2 && leg === 1);
  for (const leg of [0, 1] as const) {
    const x = leg === 0 ? 5 : 8;
    const up = lift(leg) ? 1 : 0;
    // La pierna de atrás (0) va con luz y la de adelante (1) en sombra.
    const fabric = t.pants[leg === 0 ? 1 : 0];
    const skin = t.skin[leg === 0 ? 1 : 0];
    for (let r = hip; r <= 21 - up; r++) c.rect(x, Y(r), 3, 1, r - hip < cover ? fabric : skin);
    drawShoe(ctx, leg, x - (leg === 0 ? 1 : 0), 22 - up, hip);
  }
}

/** Un zapato de 4 px de ancho: empeine en la fila `row` y suela en la siguiente. */
function drawShoe({ c, t, look, Y }: Ctx, leg: 0 | 1, x: number, row: number, hip: number) {
  const [s0, s1, s2] = t.shoes;
  const upper = leg === 0 ? s2 : s1;
  if (look.shoes === "boots") {
    // Caña de hasta dos filas, con el borde doblado más claro. Deja libre la primera fila bajo la
    // cadera: al dar el paso la pierna se acorta y la bota no sube hasta la cintura.
    const shin = x + (leg === 0 ? 1 : 0);
    const top = Math.max(row - 2, hip + 1);
    for (let r = top; r < row; r++) c.rect(shin, Y(r), 3, 1, r === top ? (leg === 0 ? s2 : s1) : leg === 0 ? s1 : s0);
    c.rect(x, Y(row), 4, 1, upper);
    c.rect(x, Y(row + 1), 4, 1, s0);
    return;
  }
  if (look.shoes === "sandals") {
    // Se ve el pie: piel con una tira y los dedos adelante; suela delgada.
    const skin = t.skin[leg === 0 ? 1 : 0];
    c.rect(x, Y(row), 4, 1, skin);
    c.set(x + 1, Y(row), upper);
    c.set(x + 3, Y(row), t.skin[2]);
    c.rect(x, Y(row + 1), 4, 1, s0);
    return;
  }
  // Tenis: empeine del color del zapato y suela de goma clara.
  c.rect(x, Y(row), 4, 1, upper);
  c.rect(x, Y(row + 1), 4, 1, leg === 0 ? t.cream[1] : t.cream[0]);
}

/** Sentado (solo se ven de frente): muslos, espinilla y el pie adelante. */
function drawLap({ c, t, look, view, Y }: Ctx, bottom: Bottom | null) {
  const dress = look.outfit === "dress";
  // Sobre las rodillas va el vestido, la falda o la tela de abajo; con falda, shorts o vestido se ve la espinilla.
  const lap: [RGBA, RGBA] = dress ? [t.shirt[0], t.shirt[1]] : t.pants;
  const shin = bottom === "pants" ? t.pants[0] : t.skin[0];
  if (view === "back") {
    c.rect(4, Y(20), 8, 2, lap[0]);
    return;
  }
  c.rect(5, Y(20), 7, 2, lap[1]);
  c.rect(5, Y(22), 7, 1, lap[0]);
  c.rect(10, Y(22), 3, 2, shin);
  const [s0, s1, s2] = t.shoes;
  if (look.shoes === "boots") {
    c.rect(10, Y(22), 3, 1, s2);
    c.rect(10, Y(23), 3, 1, s1);
    c.rect(10, Y(24), 4, 1, s0);
  } else if (look.shoes === "sandals") {
    c.rect(10, Y(24), 4, 1, t.skin[0]);
    c.set(11, Y(24), s1);
    c.set(13, Y(24), t.skin[1]);
  } else {
    c.rect(10, Y(24), 3, 1, s1);
    c.set(13, Y(24), t.cream[1]);
  }
  if (bottom === "skirt") {
    // La falda cae sobre la rodilla (encima de la caña de las botas), con el borde abierto.
    c.rect(10, Y(22), 3, 1, t.pants[1]);
    c.set(13, Y(22), t.pants[0]);
  }
}

// ---------- Brazos ----------

/** Brazos (se balancean al caminar): manga según la parte de arriba y piel. Con chaqueta, mangas de la chaqueta. */
export function drawArms(ctx: Ctx) {
  const { c, t, look, y, swing } = ctx;
  const paint = cloth(ctx);
  // Brazo de atrás (x = 3, con luz) y de adelante (x = 12, en sombra): el balanceo los alarga o acorta.
  const arms = [
    [3, 4 + swing, t.skin[1]],
    [12, 4 - swing, t.skin[0]],
  ] as const;
  for (const [x, len, skin] of arms) {
    const hand = 14 + len;
    c.set(x, y(hand), skin);
    if (look.outfit === "jacket") {
      c.rect(x, y(14), 1, len, t.accent[0]);
      continue;
    }
    const kind = SLEEVE[look.top];
    const sleeve = kind === "long" ? len : kind === "short" ? Math.min(2, len) : 0;
    for (let r = 14; r < 14 + sleeve; r++) paint(x, r, 0);
    c.rect(x, y(14 + sleeve), 1, len - sleeve, skin);
    // Puños y bordes de manga.
    const cuff = y(13 + sleeve);
    if (look.top === "sweater") c.set(x, cuff, t.top2[1]);
    else if (look.top === "hoodie") c.set(x, cuff, t.shirt[1]);
    else if (look.top === "shirt-tie") c.set(x, cuff, t.shirt[2]);
    else if (look.top === "polo") c.set(x, cuff, t.top2[1]);
  }
}

// ---------- Torso ----------

/** Parte de arriba (con patrón), cintura, falda y, si hay, el conjunto encima. */
export function drawTorso(ctx: Ctx) {
  const { c, t, look, view, sit, y, Y } = ctx;
  const paint = cloth(ctx);
  // Cuerpo: base, sombra a la derecha y luz arriba a la izquierda.
  for (let r = 13; r <= 17; r++) for (let x = 4; x <= 11; x++) paint(x, r, x === 11 ? 0 : x === 5 && r <= 15 ? 2 : 1);
  // El vestido es la parte de arriba y tapa la de abajo.
  if (look.outfit === "dress") return drawDress(ctx, paint);
  drawTopDetails(ctx);
  if (look.bottom === "skirt" && !sit) drawSkirt(c, t, y);
  if (look.outfit) drawOutfit(c, look.outfit, t, view, sit, y, Y);
}

/** Cuello, capucha, corbata, botones y la cintura de cada parte de arriba. */
function drawTopDetails({ c, t, look, view, y }: Ctx) {
  const front = view === "front";
  const [s0, s1, s2] = t.shirt;
  const [k0, k1, k2] = t.top2;
  const belt = () => c.rect(4, y(18), 8, 1, t.pants[0]);
  switch (look.top) {
    case "tshirt":
    case "longsleeve":
      belt();
      if (front) c.rect(7, y(13), 3, 1, s2);
      return;
    case "tank": {
      belt();
      // Sin mangas: hombros y escote de piel, con dos tirantes.
      c.set(4, y(13), t.skin[1]);
      c.set(11, y(13), t.skin[0]);
      if (front) c.rect(7, y(13), 2, 1, t.skin[1]);
      else c.rect(7, y(13), 2, 1, t.skin[0]);
      return;
    }
    case "polo":
      belt();
      if (front) {
        // Cuello de otro color y la tapeta con un botón.
        c.set(6, y(12), k2);
        c.set(9, y(12), k1);
        c.set(6, y(13), k1);
        c.set(7, y(13), k1);
        c.set(9, y(13), k0);
        c.set(8, y(13), s0);
        c.set(8, y(14), BUTTON);
      } else c.rect(5, y(13), 6, 1, k1);
      return;
    case "shirt-tie":
      belt();
      if (front) {
        // Cuello claro en punta y la corbata del color secundario.
        c.set(6, y(13), s2);
        c.set(7, y(13), s2);
        c.set(9, y(13), s2);
        c.set(8, y(13), k1);
        c.set(8, y(14), k1);
        c.rect(7, y(15), 2, 2, k1);
        c.set(8, y(15), k0);
        c.set(8, y(16), k0);
        c.set(8, y(17), k0);
      } else c.rect(5, y(13), 6, 1, s2);
      return;
    case "sweater":
      // Cuello redondo de otro color y el borde tejido abajo.
      for (let x = 4; x <= 11; x++) c.set(x, y(18), x % 2 ? s0 : s1);
      if (front) c.rect(6, y(13), 4, 1, k1);
      else c.rect(5, y(13), 6, 1, k1);
      return;
    case "hoodie":
      for (let x = 4; x <= 11; x++) c.set(x, y(18), x % 2 ? s0 : s1);
      if (front) {
        // La capucha asoma detrás de la cabeza y alrededor del cuello (con el forro del color
        // secundario) y cuelgan dos cordones cortos.
        c.set(3, y(11), s1);
        c.rect(3, y(12), 3, 1, s1);
        c.set(6, y(12), k1);
        c.set(9, y(12), k0);
        c.rect(10, y(12), 2, 1, s0);
        c.set(8, y(13), s0);
        c.set(7, y(13), k1);
        c.set(9, y(13), k1);
        c.set(7, y(14), k2);
        c.set(9, y(14), k1);
        // Bolsillo canguro.
        c.rect(6, y(16), 5, 1, s0);
        c.set(6, y(17), s0);
        c.set(10, y(17), s0);
      } else {
        // De espaldas, la capucha cae sobre la espalda y deja su sombra en punta.
        c.rect(4, y(12), 8, 1, s1);
        c.set(6, y(12), k1);
        c.set(9, y(12), k1);
        c.rect(5, y(13), 6, 2, s1);
        c.rect(5, y(13), 1, 2, s2);
        c.rect(10, y(13), 1, 2, s0);
        c.rect(6, y(15), 4, 1, s0);
        c.rect(7, y(16), 2, 1, s0);
      }
      return;
  }
}

/** Falda (del color de abajo) con tablas; sentada va sobre las rodillas (ver drawLap). */
function drawSkirt(c: PixelCanvas, t: Tones, y: Row) {
  const [p0, p1] = t.pants;
  c.rect(4, y(19), 8, 1, p1);
  c.rect(3, y(20), 10, 1, p1);
  c.set(11, y(19), p0);
  c.rect(11, y(20), 2, 1, p0);
  for (const x of [5, 8]) c.set(x, y(20), p0);
}

/** Vestido del color de arriba (con su patrón): lazo en la cintura y falda con vuelo que tapa la parte de abajo. */
function drawDress({ c, t, view, sit, y }: Ctx, paint: Cloth) {
  if (view === "front") c.rect(7, y(13), 3, 1, t.skin[1]);
  c.rect(4, y(17), 8, 1, t.shirt[0]);
  for (let x = 4; x <= 11; x++) paint(x, 18, x === 11 ? 0 : x === 4 ? 2 : 1);
  if (sit) return;
  // La falda se abre abajo; en la fila de las manos queda angosta para no taparlas.
  for (let x = 4; x <= 11; x++) paint(x, 19, x === 11 ? 0 : x === 4 ? 2 : 1);
  for (let x = 3; x <= 12; x++) paint(x, 20, x >= 11 || x === 6 || x === 9 ? 0 : x === 3 ? 2 : 1);
}

/** Conjuntos encima de la parte de arriba (el torso ya está dibujado con su cintura). */
function drawOutfit(c: PixelCanvas, outfit: Exclude<Outfit, "dress">, t: Tones, view: View, sit: boolean, y: Row, Y: Row) {
  const front = view === "front";
  if (outfit === "overalls") {
    // Overol del color de abajo: tirantes con botones, peto y la parte de arriba asomando.
    const [p0, p1] = t.pants;
    c.set(5, y(13), p1);
    c.set(10, y(13), p1);
    if (front) {
      c.rect(5, y(14), 6, 2, p1);
      c.rect(7, y(15), 2, 1, p0);
      c.set(5, y(14), BUTTON);
      c.set(10, y(14), BUTTON);
    } else {
      c.rect(5, y(14), 1, 2, p1);
      c.rect(10, y(14), 1, 2, p1);
    }
    c.rect(4, y(16), 8, 3, p1);
    c.rect(11, y(16), 1, 3, p0);
    c.rect(4, y(16), 1, 1, p0);
    return;
  }
  if (outfit === "jacket") {
    // Chaqueta abierta del color de acento: de frente se ve la parte de arriba en el medio.
    const [a0, a1, a2] = t.accent;
    if (front) {
      c.rect(4, y(13), 3, 6, a1);
      c.rect(10, y(13), 2, 6, a1);
      c.rect(11, y(13), 1, 6, a0);
      c.rect(5, y(13), 1, 3, a2);
      c.set(6, y(13), a2);
      c.set(10, y(13), a2);
      c.set(6, y(16), a0);
      c.set(5, y(17), a0);
    } else {
      c.rect(4, y(13), 8, 6, a1);
      c.rect(11, y(13), 1, 6, a0);
      c.rect(5, y(13), 1, 3, a2);
      c.rect(5, y(13), 6, 1, a2);
      c.rect(8, y(16), 1, 3, a0);
    }
    return;
  }
  // Delantal crema, como el de la cafetería.
  const [c0, c1, c2] = t.cream;
  if (front) {
    c.set(6, y(13), c1);
    c.set(9, y(13), c1);
    c.rect(6, y(14), 4, 2, c1);
    c.rect(6, y(14), 4, 1, c2);
    c.rect(5, y(16), 6, 3, c1);
    c.rect(10, y(16), 1, 3, c0);
    c.set(4, y(16), c0);
    c.set(11, y(16), c0);
    c.rect(7, y(17), 2, 1, c0);
    if (sit) c.rect(6, Y(20), 5, 1, c1);
    else {
      c.rect(5, y(19), 6, 2, c1);
      c.rect(10, y(19), 1, 2, c0);
      c.rect(5, y(20), 6, 1, c0);
    }
  } else {
    // De espaldas solo se ven la tira de la cintura y el lazo.
    c.rect(4, y(16), 8, 1, c1);
    c.rect(7, y(16), 2, 1, c2);
    c.set(6, y(15), c1);
    c.set(9, y(15), c1);
    c.set(7, y(17), c0);
    c.set(8, y(17), c0);
  }
}
