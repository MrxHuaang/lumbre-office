// Ropa del chibi: piernas y zapatos, brazos y parte de arriba (con su patrón y sus estampados). Los
// conjuntos que van encima están en outfits.ts. Filas del cuerpo: torso 13-19, cintura 20, piernas
// 21-24, zapatos 25-26 (ver kit.ts).
import { isSwimwear, type Outfit, type Pattern, type Top, type WornLook } from "@hyvento/shared";
import { hex, type PixelCanvas, type RGBA } from "../pixel";
import type { Ctx, Row, Three, Tones } from "./kit";
import { drawOutfit, drawSwimwear } from "./outfits";

/** Largo de manga de cada parte de arriba. */
const SLEEVE: Record<Top, "none" | "short" | "long"> = {
  tshirt: "short",
  longsleeve: "long",
  hoodie: "long",
  sweater: "long",
  "shirt-tie": "long",
  tank: "none",
  polo: "short",
  "dress-shirt": "long",
  flannel: "long",
  turtleneck: "long",
  jersey: "short",
  hawaiian: "short",
  sailor: "long",
  cardigan: "long",
  "graphic-tee": "short",
};
export const sleeveOf = (top: Top) => SLEEVE[top];

/** Partes de arriba que usan el color secundario (top2) aunque sean lisas. */
export const TOPS_WITH_TOP2: readonly Top[] = [
  "hoodie",
  "sweater",
  "shirt-tie",
  "polo",
  "flannel",
  "jersey",
  "hawaiian",
  "sailor",
  "cardigan",
  "graphic-tee",
];

/** Conjuntos que tapan la parte de arriba entera (no se dibujan su cuello, su corbata ni su cintura). */
export const HIDES_TOP: ReadonlySet<Outfit> = new Set(["dress", "gown", "coveralls", "coat", "raincoat", "chef-coat", "pajamas", "robe", "ruana", "trenchcoat"]);
/** Conjuntos que tapan la parte de abajo: las piernas son del conjunto o de piel. */
export const HIDES_BOTTOM: ReadonlySet<Outfit> = new Set(["dress", "gown", "coveralls", "pajamas", "trunks", "swimsuit", "bikini"]);

/** Conjuntos con mangas propias (o sin mangas): no se ven las de la parte de arriba. */
export const OWN_SLEEVES: ReadonlySet<Outfit> = new Set([
  "jacket",
  "blazer",
  "coveralls",
  "coat",
  "raincoat",
  "trenchcoat",
  "robe",
  "lab-coat",
  "chef-coat",
  "pajamas",
  "gown",
  "trunks",
  "swimsuit",
  "bikini",
]);

/** Botones dorados del overol y del polo. */
export const BUTTON = hex("#f4d35e");

/** ¿Ese píxel de tela lleva el color del patrón? Rayas cada dos filas; puntos en filas alternas, corridos. */
export function inPattern(p: Pattern, x: number, row: number): boolean {
  if (p === "stripes") return row % 2 === 0;
  if (p === "dots") return row % 2 === 0 && (x + row) % 4 === 0;
  return false;
}

/**
 * Color de un píxel de la tela de arriba con el tono k (0 sombra, 1 base, 2 luz): los cuadros de la
 * camisa de franela y las flores de la hawaiana van por encima del patrón; el patrón sigue la sombra.
 */
function topColor(look: WornLook, t: Tones, x: number, row: number, k: 0 | 1 | 2): RGBA {
  // Los estampados son de la parte de arriba: la tela de un vestido o de un traje de baño lleva solo el patrón.
  const own = !look.outfit || (!HIDES_TOP.has(look.outfit) && !isSwimwear(look.outfit));
  if (own && look.top === "flannel") {
    const v = x % 3 === 1;
    const h = row % 3 === 1;
    if (v && h) return t.top2[0];
    if (v || h) return t.top2[k === 0 ? 0 : 1];
  }
  if (own && look.top === "hawaiian") {
    // Flores en cruz (cuatro pétalos y el centro claro), en tresbolillo: una fila de flores cada tres.
    const band = Math.floor((row - 13) / 3);
    const cy = 14 + band * 3;
    const cx = band % 2 ? 7 : 5;
    const dx = (((x - cx) % 4) + 4) % 4;
    const dy = row - cy;
    if (dx === 0 && dy === 0) return t.cream[2];
    if ((dx === 0 && Math.abs(dy) === 1) || ((dx === 1 || dx === 3) && dy === 0)) return t.top2[k === 0 ? 1 : 2];
  }
  return inPattern(look.pattern, x, row) ? t.top2[k] : t.shirt[k];
}

/** Pinta un píxel de la tela de arriba con el tono k. */
export type Cloth = (x: number, row: number, k: 0 | 1 | 2) => void;
export function cloth({ c, t, look, y }: Ctx): Cloth {
  return (x, row, k) => c.set(x, y(row), topColor(look, t, x, row, k));
}

/**
 * Corbata (la de la camisa y la del cuello): nudo bajo el cuello, la hoja de dos píxeles con su borde a
 * la sombra, que se ensancha y termina en punta. Con el torso alto se lee de lejos.
 */
export function drawTieShape(c: PixelCanvas, k: Three, y: Row) {
  const [k0, k1, k2] = k;
  // Nudo.
  c.set(7, y(13), k2);
  c.set(8, y(13), k1);
  // Hoja: luz a la izquierda y sombra a la derecha.
  for (let r = 14; r <= 17; r++) {
    c.set(7, y(r), r === 14 ? k1 : k2);
    c.set(8, y(r), k1);
  }
  c.set(9, y(16), k0);
  c.set(9, y(17), k0);
  c.set(7, y(18), k1);
  c.set(8, y(18), k0);
  // Punta.
  c.set(8, y(19), k0);
}

// ---------- Piernas y zapatos ----------

/** De qué son las piernas: la parte de abajo, el conjunto (mono, pijama, bañador) o la piel. */
type LegWear = { rows: number; tone: (leg: 0 | 1, x: number, r: number) => RGBA; cuff: ((leg: 0 | 1) => RGBA) | null };

function legWear({ look, t }: Ctx): LegWear {
  const pants = (leg: 0 | 1) => t.pants[leg === 0 ? 1 : 0];
  const bare: LegWear = { rows: 0, tone: pants, cuff: null };
  const cuffOf = (leg: 0 | 1) => t.pants[leg === 0 ? 0 : 1];
  switch (look.outfit) {
    case "dress":
    case "gown":
    case "swimsuit":
    case "bikini":
      return bare;
    case "trunks":
      return { rows: 2, tone: pants, cuff: null };
    case "coveralls":
      return { rows: 9, tone: pants, cuff: cuffOf };
    case "pajamas":
      return {
        rows: 9,
        tone: (leg, x, r) => (inPattern(look.pattern, x, r) ? t.top2 : t.shirt)[leg === 0 ? 1 : 0],
        cuff: () => t.top2[1],
      };
  }
  switch (look.bottom) {
    case "pants":
    case "cargo":
      return { rows: 9, tone: pants, cuff: null };
    case "joggers":
      return { rows: 9, tone: pants, cuff: cuffOf };
    case "shorts":
      return { rows: 2, tone: pants, cuff: cuffOf };
    default:
      // Falda y falda larga: la pierna es de piel (la falda va encima, en el torso).
      return bare;
  }
}

/** Piernas (tela o piel según lo que se lleve) y zapatos. Sentado, las piernas se doblan hacia adelante. */
export function drawLegs(ctx: Ctx) {
  const { c, t, look, frame, sit, y, Y } = ctx;
  if (sit) return drawLap(ctx);
  const wear = legWear(ctx);
  const checks = look.details.includes("chef-check");
  const reflective = look.details.includes("reflective");
  const trunks = look.outfit === "trunks";
  // La cadera baja con el torso en cada paso (la cintura tapa la fila 21): la pierna empieza bajo
  // ella, así el short se ve en los tres frames.
  const hip = y(21) - Y(0);
  const lift = (leg: 0 | 1) => (frame === 1 && leg === 0) || (frame === 2 && leg === 1);
  for (const leg of [0, 1] as const) {
    const x0 = leg === 0 ? 5 : 8;
    const up = lift(leg) ? 1 : 0;
    const last = 24 - up;
    // La pierna de atrás (0) va con luz y la de adelante (1) en sombra.
    const skin = t.skin[leg === 0 ? 1 : 0];
    for (let r = hip; r <= last; r++) {
      const cloth = r - hip < wear.rows;
      for (let x = x0; x < x0 + 3; x++) {
        let col = cloth ? wear.tone(leg, x, r) : skin;
        if (cloth && checks && (x + r) % 2 === 0) col = t.white[leg === 0 ? 1 : 0];
        if (cloth && reflective && r - hip === 2) col = t.metal[2];
        c.set(x, Y(r), col);
      }
      // Franja de acento del bañador, por fuera de la pierna de adelante.
      if (trunks && leg === 1 && cloth) c.set(x0 + 2, Y(r), t.accent[0]);
      // Dobladillo o puño: la última fila de tela.
      const end = Math.min(last, hip + wear.rows - 1);
      if (wear.cuff && r === end && cloth) c.rect(x0, Y(r), 3, 1, wear.cuff(leg));
    }
    if (look.outfit === null || !HIDES_BOTTOM.has(look.outfit)) {
      // Rodilla del pantalón: un pliegue a la sombra en la pierna de adelante.
      if ((look.bottom === "pants" || look.bottom === "cargo") && leg === 1 && !checks) c.set(x0, Y(hip + 2), t.pants[0]);
      // Bolsillos del pantalón cargo, a los lados del muslo.
      if (look.bottom === "cargo") {
        const px = leg === 0 ? x0 : x0 + 2;
        const pc = t.pants[leg === 0 ? 0 : 1];
        c.set(px, Y(hip + 1), pc);
        c.set(px, Y(hip + 2), pc);
      }
    }
    drawShoe(ctx, leg, x0 - (leg === 0 ? 1 : 0), 25 - up, hip);
  }
}

/** Un zapato de 4 px de ancho: empeine en la fila `row` y suela en la siguiente. */
function drawShoe({ c, t, look, Y }: Ctx, leg: 0 | 1, x: number, row: number, hip: number) {
  const [s0, s1, s2] = t.shoes;
  const upper = leg === 0 ? s2 : s1;
  const shin = x + (leg === 0 ? 1 : 0);
  switch (look.shoes) {
    case "boots": {
      // Caña de hasta dos filas, con el borde doblado más claro. Deja libre la primera fila bajo la
      // cadera: al dar el paso la pierna se acorta y la bota no sube hasta la cintura.
      const top = Math.max(row - 2, hip + 1);
      for (let r = top; r < row; r++) c.rect(shin, Y(r), 3, 1, r === top ? (leg === 0 ? s2 : s1) : leg === 0 ? s1 : s0);
      c.rect(x, Y(row), 4, 1, upper);
      c.rect(x, Y(row + 1), 4, 1, s0);
      return;
    }
    case "rain-boots": {
      // Botas de caucho altas y brillantes: caña de tres filas con un brillo que baja por el frente.
      const top = Math.max(row - 3, hip + 1);
      for (let r = top; r < row; r++) {
        c.rect(shin, Y(r), 3, 1, leg === 0 ? s1 : s0);
        c.set(shin + (leg === 0 ? 0 : 1), Y(r), leg === 0 ? s2 : s1);
      }
      c.rect(x, Y(row), 4, 1, upper);
      c.set(x + 3, Y(row), s2);
      c.rect(x, Y(row + 1), 4, 1, t.ink[1]);
      return;
    }
    case "sandals": {
      // Se ve el pie: piel con una tira y los dedos adelante; suela delgada.
      const skin = t.skin[leg === 0 ? 1 : 0];
      c.rect(x, Y(row), 4, 1, skin);
      c.set(x + 1, Y(row), upper);
      c.set(x + 3, Y(row), t.skin[2]);
      c.rect(x, Y(row + 1), 4, 1, s0);
      return;
    }
    case "dress-shoes":
      // Zapato de vestir: empeine con brillo en la punta y suela oscura con tacón.
      c.rect(x, Y(row), 4, 1, leg === 0 ? s1 : s0);
      c.set(x + 3, Y(row), s2);
      c.rect(x, Y(row + 1), 4, 1, t.ink[0]);
      return;
    case "slippers":
      // Pantuflas mullidas: la felpa clara en el tobillo y la punta redonda.
      c.rect(x, Y(row), 4, 1, upper);
      c.set(x + 1, Y(row), t.cream[2]);
      c.set(x, Y(row), t.cream[1]);
      c.rect(x, Y(row + 1), 4, 1, s1);
      c.set(x + 3, Y(row + 1), s0);
      return;
    case "heels": {
      // Tacones: el empeine al aire, la punta del color del zapato y el taco fino atrás.
      const skin = t.skin[leg === 0 ? 1 : 0];
      c.rect(x, Y(row), 2, 1, skin);
      c.rect(x + 2, Y(row), 2, 1, upper);
      c.set(x, Y(row + 1), s0);
      c.set(x + 3, Y(row + 1), s0);
      c.set(x + 2, Y(row + 1), s1);
      return;
    }
    default:
      // Tenis: empeine del color del zapato con los cordones claros y suela de goma clara.
      c.rect(x, Y(row), 4, 1, upper);
      c.set(x + 2, Y(row), t.cream[leg === 0 ? 2 : 1]);
      c.rect(x, Y(row + 1), 4, 1, leg === 0 ? t.cream[1] : t.cream[0]);
  }
}

/** Sentado (solo se ven de frente): el muslo, la espinilla y el pie adelante. */
function drawLap(ctx: Ctx) {
  const { c, t, look, view, Y } = ctx;
  const wear = legWear(ctx);
  const o = look.outfit;
  const bottomShown = o === null || !HIDES_BOTTOM.has(o);
  // Sobre las rodillas va el vestido, la tela de abajo o, si no, la piel.
  const bareLap = o === "swimsuit" || o === "bikini";
  const lap: [RGBA, RGBA] =
    o === "dress" || o === "gown" || o === "pajamas"
      ? [t.shirt[0], t.shirt[1]]
      : bareLap || (bottomShown && wear.rows === 0 && look.bottom !== "skirt" && look.bottom !== "long-skirt")
        ? [t.skin[0], t.skin[1]]
        : t.pants;
  const coat = o === "raincoat" || o === "robe" ? t.shirt : o === "lab-coat" ? t.white : o === "trenchcoat" ? t.accent : null;
  if (view === "back") {
    c.rect(4, Y(23), 8, 2, (coat ?? lap)[0]);
    return;
  }
  c.rect(5, Y(23), 7, 2, lap[1]);
  c.rect(5, Y(25), 7, 1, lap[0]);
  // La parte de abajo del traje de baño asoma en la cadera.
  if (bareLap) c.rect(5, Y(25), 2, 1, t.shirt[0]);
  // Espinilla: tela si la pierna es larga, falda larga o vestido largo si los hay, o piel.
  const longLeg = wear.rows > 2;
  const shin = o === "gown" ? t.shirt[0] : bottomShown && look.bottom === "long-skirt" ? t.pants[1] : longLeg ? wear.tone(1, 10, 25) : t.skin[0];
  c.rect(10, Y(25), 3, 2, shin);
  if (wear.cuff && longLeg) c.rect(10, Y(26), 3, 1, wear.cuff(1));
  if (look.details.includes("chef-check")) for (let x = 5; x <= 12; x++) if ((x + 25) % 2 === 0) c.set(x, Y(25), t.white[1]);
  if (look.details.includes("reflective")) c.rect(5, Y(25), 4, 1, t.metal[2]);
  if (bottomShown && look.bottom === "cargo") c.rect(7, Y(25), 2, 1, t.pants[1]);
  drawSitShoe(ctx);
  if (bottomShown && look.bottom === "skirt") {
    // La falda cae sobre la rodilla (encima de la caña de las botas), con el borde abierto.
    c.rect(10, Y(25), 3, 1, t.pants[1]);
    c.set(13, Y(25), t.pants[0]);
  }
  if (bottomShown && look.bottom === "long-skirt") {
    // La falda larga tapa la espinilla y deja ver el pie.
    c.rect(10, Y(25), 4, 1, t.pants[1]);
    c.rect(10, Y(26), 4, 1, t.pants[0]);
  }
  if (o === "gown") {
    c.rect(10, Y(25), 4, 2, t.shirt[1]);
    c.rect(10, Y(26), 4, 1, t.shirt[0]);
  }
  // Lo largo (impermeable, bata) cae sobre el regazo.
  if (coat) c.rect(5, Y(25), 8, 1, coat[1]);
}

/** El pie de sentado, adelante del regazo (fila 27 del cuerpo), según el zapato. */
function drawSitShoe({ c, t, look, Y }: Ctx) {
  const [s0, s1, s2] = t.shoes;
  switch (look.shoes) {
    case "boots":
      c.rect(10, Y(25), 3, 1, s2);
      c.rect(10, Y(26), 3, 1, s1);
      c.rect(10, Y(27), 4, 1, s0);
      return;
    case "rain-boots":
      c.rect(10, Y(25), 3, 2, s1);
      c.set(10, Y(25), s2);
      c.set(10, Y(26), s2);
      c.rect(10, Y(27), 4, 1, t.ink[1]);
      return;
    case "sandals":
      c.rect(10, Y(27), 4, 1, t.skin[0]);
      c.set(11, Y(27), s1);
      c.set(13, Y(27), t.skin[1]);
      return;
    case "dress-shoes":
      c.rect(10, Y(27), 3, 1, s0);
      c.set(13, Y(27), s2);
      return;
    case "slippers":
      c.rect(10, Y(27), 4, 1, s1);
      c.set(10, Y(27), t.cream[2]);
      c.set(13, Y(27), s2);
      return;
    case "heels":
      c.rect(10, Y(27), 2, 1, t.skin[0]);
      c.rect(12, Y(27), 2, 1, s1);
      c.set(11, Y(28), s0);
      return;
    default:
      c.rect(10, Y(27), 3, 1, s1);
      c.set(13, Y(27), t.cream[1]);
  }
}

// ---------- Brazos ----------

/** Cómo son las mangas: largo, color de cada píxel y el puño (el borde de la manga), si lo hay. */
export interface ArmWear {
  kind: "none" | "short" | "long";
  paint: (x: number, r: number) => RGBA;
  cuff: RGBA | null;
}

/** Las mangas de lo que se lleva: las del conjunto si tiene (chaqueta, saco, abrigo…) o las de la parte de arriba. */
export function armWear(look: WornLook, t: Tones): ArmWear {
  const solid = (col: RGBA, cuff: RGBA | null): ArmWear => ({ kind: "long", paint: () => col, cuff });
  switch (look.outfit) {
    case "trunks":
    case "swimsuit":
    case "bikini":
    case "gown":
      return { kind: "none", paint: () => t.skin[0], cuff: null };
    case "jacket":
      return solid(t.accent[0], t.accent[1]);
    case "blazer":
      return solid(t.pants[0], t.shirt[2]);
    case "coveralls":
      return solid(t.pants[0], t.pants[1]);
    case "coat":
      // Acolchado: franjas de relleno cada tres filas.
      return { kind: "long", paint: (_x, r) => (r % 3 === 0 ? t.shirt[0] : t.shirt[1]), cuff: t.shirt[0] };
    case "raincoat":
      return solid(t.shirt[0], t.shirt[1]);
    case "trenchcoat":
      return solid(t.accent[0], t.accent[1]);
    case "robe":
      return solid(t.shirt[0], t.top2[1]);
    case "lab-coat":
    case "chef-coat":
      return solid(t.white[1], t.white[2]);
    case "pajamas":
      return { kind: "long", paint: (x, r) => (inPattern(look.pattern, x, r) ? t.top2[0] : t.shirt[0]), cuff: t.top2[1] };
  }
  const cuffs: Partial<Record<Top, RGBA>> = {
    sweater: t.top2[1],
    hoodie: t.shirt[1],
    "shirt-tie": t.shirt[2],
    "dress-shirt": t.shirt[2],
    polo: t.top2[1],
    flannel: t.top2[1],
    jersey: t.top2[1],
    sailor: t.top2[1],
    cardigan: t.shirt[1],
    turtleneck: t.shirt[1],
  };
  return { kind: SLEEVE[look.top], paint: (x, r) => topColor(look, t, x, r, 0), cuff: cuffs[look.top] ?? null };
}

/** Brazos (se balancean al caminar): manga según lo que se lleve, la mano de piel (o el guante). */
export function drawArms(ctx: Ctx) {
  const { c, t, look, y, swing } = ctx;
  const wear = armWear(look, t);
  // Brazo de atrás (x = 3, con luz) y de adelante (x = 12, en sombra): el balanceo los alarga o acorta.
  const arms = [
    [3, 6 + swing, t.skin[1], 1],
    [12, 6 - swing, t.skin[0], 0],
  ] as const;
  for (const [x, len, skin, k] of arms) {
    const hand = 14 + len;
    const sleeve = wear.kind === "long" ? len : wear.kind === "short" ? Math.min(3, len) : 0;
    for (let r = 14; r < 14 + sleeve; r++) c.set(x, y(r), wear.paint(x, r));
    c.rect(x, y(14 + sleeve), 1, len - sleeve, skin);
    if (sleeve && wear.cuff) c.set(x, y(13 + sleeve), wear.cuff);
    c.set(x, y(hand), skin);
    // Guantes: la mano y el puño del guante.
    if (t.gloves) {
      c.set(x, y(hand), t.gloves[k]);
      c.set(x, y(hand - 1), t.gloves[k === 1 ? 2 : 1]);
    }
  }
}

// ---------- Torso ----------

/** Parte de arriba (con patrón), cintura, falda y, si hay, el conjunto encima. */
export function drawTorso(ctx: Ctx) {
  const { c, t, look, sit, y } = ctx;
  const paint = cloth(ctx);
  // El traje de baño deja el torso al aire: no hay parte de arriba ni de abajo.
  if (isSwimwear(look.outfit)) return drawSwimwear(ctx, look.outfit, paint);
  // Cuerpo: base, sombra a la derecha y luz arriba a la izquierda.
  for (let r = 13; r <= 19; r++) for (let x = 4; x <= 11; x++) paint(x, r, x === 11 ? 0 : x === 5 && r <= 16 ? 2 : 1);
  const o = look.outfit;
  if (!o || !HIDES_TOP.has(o)) drawTopDetails(ctx);
  if (!sit && (!o || !HIDES_BOTTOM.has(o))) {
    if (look.bottom === "skirt") drawSkirt(c, t, y);
    if (look.bottom === "long-skirt") drawLongSkirt(c, t, y);
  }
  if (o) drawOutfit(ctx, o, paint);
}

/** Cuello, capucha, corbata, botones, estampados y la cintura de cada parte de arriba. */
function drawTopDetails(ctx: Ctx) {
  const { c, t, look, view, y } = ctx;
  const front = view === "front";
  const [s0, s1, s2] = t.shirt;
  const [k0, k1, k2] = t.top2;
  const belt = () => c.rect(4, y(20), 8, 1, t.pants[0]);
  const ribbed = (k: Three) => {
    for (let x = 4; x <= 11; x++) c.set(x, y(20), x % 2 ? k[0] : k[1]);
  };
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
      if (front) {
        c.rect(7, y(13), 2, 1, t.skin[1]);
        c.set(7, y(14), t.skin[1]);
      } else c.rect(7, y(13), 2, 1, t.skin[0]);
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
        c.set(8, y(14), s0);
        c.set(8, y(15), BUTTON);
        c.set(8, y(16), s0);
      } else c.rect(5, y(13), 6, 1, k1);
      return;
    case "shirt-tie":
      belt();
      if (front) {
        // Cuello claro en punta y la corbata del color secundario.
        c.set(6, y(13), s2);
        c.set(9, y(13), s2);
        c.set(6, y(14), s2);
        drawTieShape(c, t.top2, y);
      } else {
        c.rect(5, y(13), 6, 1, s2);
        c.rect(6, y(14), 4, 1, s1);
      }
      return;
    case "dress-shirt":
      belt();
      // Hebilla del cinturón.
      c.set(8, y(20), t.metal[1]);
      if (front) {
        // Cuello en punta, la tapeta con sus botones y el bolsillo del pecho.
        c.set(6, y(12), s2);
        c.set(9, y(12), s1);
        c.set(6, y(13), s2);
        c.set(9, y(13), s2);
        c.set(7, y(13), t.skin[1]);
        for (let r = 14; r <= 19; r++) c.set(8, y(r), r % 2 ? s2 : s0);
        c.rect(5, y(15), 2, 1, s0);
      } else {
        c.rect(5, y(13), 6, 1, s2);
        c.rect(5, y(15), 6, 1, s0);
      }
      return;
    case "flannel":
      belt();
      if (front) {
        // Cuello abierto y dos bolsillos con solapa.
        c.set(6, y(13), s2);
        c.set(9, y(13), s2);
        c.set(7, y(13), t.skin[1]);
        c.set(8, y(13), t.skin[0]);
        for (let r = 14; r <= 19; r++) c.set(8, y(r), k0);
        c.rect(5, y(15), 2, 1, k0);
        c.rect(9, y(15), 2, 1, k0);
      } else c.rect(5, y(13), 6, 1, k0);
      return;
    case "turtleneck":
      // Cuello alto enrollado que tapa el cuello, y el borde tejido abajo.
      ribbed(t.shirt);
      c.rect(6, y(12), 4, 1, s1);
      c.set(6, y(12), s2);
      c.rect(5, y(13), 6, 1, s2);
      for (const x of [6, 8, 10]) c.set(x, y(13), s1);
      return;
    case "jersey":
      // Camiseta de equipo: cuello en V del color secundario y el número adelante y atrás.
      for (let x = 4; x <= 11; x++) c.set(x, y(20), s0);
      if (front) {
        c.set(6, y(13), k1);
        c.set(9, y(13), k1);
        c.set(7, y(13), t.skin[1]);
        c.set(8, y(13), t.skin[0]);
        c.set(7, y(14), k1);
        c.set(8, y(14), k0);
        // Un 7 chico sobre el pecho.
        c.rect(8, y(16), 3, 1, k2);
        c.set(10, y(17), k1);
        c.set(9, y(18), k1);
        c.set(9, y(19), k1);
      } else {
        c.rect(5, y(13), 6, 1, k1);
        // El 7 grande en la espalda.
        c.rect(6, y(15), 4, 1, k2);
        c.set(9, y(16), k1);
        c.set(8, y(17), k1);
        c.set(8, y(18), k1);
        c.set(7, y(19), k1);
      }
      return;
    case "hawaiian":
      // Camisa suelta: cuello abierto en V, botones y el borde por fuera.
      for (let x = 4; x <= 11; x++) c.set(x, y(20), x % 3 ? s1 : s0);
      if (front) {
        c.set(6, y(12), s2);
        c.set(9, y(12), s1);
        c.set(6, y(13), s2);
        c.set(9, y(13), s2);
        c.rect(7, y(13), 2, 1, t.skin[1]);
        c.set(8, y(14), t.skin[0]);
        for (const r of [16, 18]) c.set(8, y(r), t.cream[2]);
      } else c.rect(5, y(13), 6, 1, s2);
      return;
    case "sailor": {
      belt();
      const knot = t.ribbon;
      if (front) {
        // Cuello marinero en V del color secundario con el pañuelo rojo anudado abajo.
        for (const [x, r] of [[5, 13], [6, 13], [9, 13], [10, 13], [6, 14], [9, 14], [7, 15], [8, 15]] as const) c.set(x, y(r), k1);
        c.set(5, y(13), k2);
        c.rect(7, y(13), 2, 2, t.skin[1]);
        c.set(8, y(14), t.skin[0]);
        c.set(7, y(16), knot[2]);
        c.set(8, y(16), knot[1]);
        c.set(7, y(17), knot[1]);
        c.set(9, y(17), knot[0]);
      } else {
        // De espaldas, la solapa cuadrada con su franja blanca.
        c.rect(5, y(13), 6, 4, k1);
        c.rect(5, y(13), 1, 4, k2);
        c.rect(5, y(16), 6, 1, s2);
      }
      return;
    }
    case "cardigan":
      ribbed(t.shirt);
      if (front) {
        // Abierto adelante: la camiseta de adentro (color secundario) y los botones del borde.
        c.rect(7, y(13), 2, 7, k1);
        c.set(8, y(13), k0);
        for (let r = 13; r <= 20; r++) c.set(9, y(r), s0);
        for (const r of [15, 17, 19]) c.set(9, y(r), t.cream[1]);
        c.set(6, y(13), s2);
      } else c.rect(5, y(13), 6, 1, s2);
      return;
    case "graphic-tee":
      belt();
      if (front) {
        c.rect(7, y(13), 3, 1, s2);
        // Estampado: una estrella en el pecho.
        c.set(7, y(15), k2);
        c.rect(5, y(16), 5, 1, k1);
        c.set(7, y(16), k2);
        c.rect(6, y(17), 3, 1, k1);
        c.set(5, y(18), k0);
        c.set(9, y(18), k0);
      } else {
        // Atrás, un logo chico debajo de la nuca.
        c.rect(7, y(14), 2, 1, k1);
        c.rect(7, y(15), 2, 1, k0);
      }
      return;
    case "sweater":
      // Cuello redondo de otro color y el borde tejido abajo.
      ribbed(t.shirt);
      for (let x = 4; x <= 11; x++) if (x % 2) c.set(x, y(19), s0);
      if (front) {
        c.rect(6, y(13), 4, 1, k1);
        c.set(9, y(13), k0);
      } else c.rect(5, y(13), 6, 1, k1);
      return;
    case "hoodie":
      ribbed(t.shirt);
      if (front) {
        // La capucha asoma detrás de la cabeza y alrededor del cuello (con el forro del color
        // secundario) y cuelgan dos cordones.
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
        c.set(7, y(15), k1);
        c.set(9, y(15), k0);
        // Bolsillo canguro.
        c.rect(6, y(17), 5, 1, s0);
        c.set(6, y(18), s0);
        c.set(10, y(18), s0);
        c.rect(7, y(18), 3, 1, s2);
      } else {
        // De espaldas, la capucha cae sobre la espalda y deja su sombra en punta.
        c.rect(4, y(12), 8, 1, s1);
        c.set(6, y(12), k1);
        c.set(9, y(12), k1);
        c.rect(5, y(13), 6, 3, s1);
        c.rect(5, y(13), 1, 3, s2);
        c.rect(10, y(13), 1, 3, s0);
        c.rect(6, y(16), 4, 1, s0);
        c.rect(7, y(17), 2, 1, s0);
      }
      return;
  }
}

/** Falda (del color de abajo) con tablas; sentada va sobre las rodillas (ver drawLap). */
function drawSkirt(c: PixelCanvas, t: Tones, y: Row) {
  const [p0, p1] = t.pants;
  c.rect(4, y(21), 8, 1, p1);
  c.rect(3, y(22), 10, 1, p1);
  c.set(11, y(21), p0);
  c.rect(11, y(22), 2, 1, p0);
  for (const x of [5, 8]) c.set(x, y(22), p0);
}

/** Falda larga hasta el tobillo, con pliegues; los pies asoman abajo. */
function drawLongSkirt(c: PixelCanvas, t: Tones, y: Row) {
  const [p0, p1] = t.pants;
  c.rect(4, y(21), 8, 1, p1);
  for (let r = 22; r <= 24; r++) {
    c.rect(3, y(r), 10, 1, p1);
    for (const x of [6, 9, 12]) c.set(x, y(r), p0);
  }
  c.rect(3, y(24), 10, 1, p0);
  c.set(3, y(22), p1);
}
