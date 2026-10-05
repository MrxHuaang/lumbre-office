// La Noche de brujas por código: calabazas talladas (de noche, prendidas por dentro), la pila de
// calabazas, el espantapájaros con sombrero de bruja, el farol de papel, la telaraña, el caldero, la
// lápida de cartón, el fardo de paja, las matas de maíz del laberinto y su arco. Coordenadas locales de
// arte (tile = 16), mirando hacia +x. Cálido y de otoño: naranjas, paja, violeta y madera; nada tétrico.
import { Escena, type Tinte, type V3 } from "./exterior-escena";
import { C, mix } from "./palette";
import { volume } from "./kit";
import { at, hex, noise, ramp, renderSprite, type Ramp, type RGBA, type Sprite } from "./pixel";
import { glyphOn } from "./room";

const scene = (w: number, d: number, h: number, pad = 6) => new Escena({ x0: -pad, y0: -pad, z0: -4, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const flatT = (c: RGBA): Tinte => () => c;

/** Ahuyama de Noche de brujas: naranja vivo con sombras rojizas. */
const PUMPKIN = ramp("#4f1f0e", "#8a3412", "#c2561a", "#e57e26", "#f5a548", "#ffd68f");
/** Ahuyama crema y la verde de rayas, para que la pila no sea toda igual. */
const CREAM_SQUASH = ramp("#6e5038", "#a8865e", "#d2b689", "#ecd8a8", "#fbefcc", "#fffaf0");
const GREEN_SQUASH = ramp("#1f3a24", "#2f5a32", "#4a7a3e", "#6f9a4e", "#9cbe6a", "#cfe09a");
/** El sombrero de bruja y el papel lila de la lápida: violeta, nunca gris. */
const LILAC = ramp("#3e2f52", "#5c4878", "#7e6a9c", "#a08cbc", "#c4b4d8", "#e6dcf0");
/** Hierro del caldero: oscuro pero tirando a morado, como las sombras de la cabaña. */
const IRON = ramp("#1a1420", "#2a2232", "#3c3247", "#54485f", "#706480", "#9488a2");
/** El brebaje del caldero: verde limón que brilla. */
const BREW = ramp("#1f4a1a", "#3a7a22", "#62a82e", "#94d43e", "#c8f070", "#f0ffc0");
/** La luz de la vela de adentro de lo tallado y el hueco oscuro de día. */
const CANDLE: RGBA[] = [hex("#ff9a2a"), hex("#ffc94a"), hex("#fff0a0")];
const HOLE = hex("#3a1a14");

// ---------- Formas redondas ----------

/**
 * Cuerpo redondo salpicado punto a punto (ahuyamas, el farol, el caldero): elipsoide de radio `r` y alto
 * `rz`, con `ribs` gajos (los surcos meten un poco el radio). El tinte recibe el ángulo (0 = +x), la
 * elevación (-π/2 abajo, π/2 arriba), la luz (-1..1) y si es cresta (1) o surco (0).
 */
function orb(
  s: Escena,
  cx: number,
  cy: number,
  cz: number,
  r: number,
  rz: number,
  tinte: (a: number, e: number, luz: number, crest: number) => RGBA | null,
  ribs = 0,
  eMin = -Math.PI / 2,
  eMax = Math.PI / 2,
) {
  const da = 0.42 / Math.max(1, r * 1.2);
  const de = 0.42 / Math.max(1, Math.max(r, rz) * 1.2);
  for (let e = eMin; e <= eMax; e += de) {
    const ce = Math.cos(e);
    const se = Math.sin(e);
    for (let a = -Math.PI; a < Math.PI; a += da) {
      const crest = ribs ? Math.pow(Math.abs(Math.cos((a * ribs) / 2)), 0.5) : 1;
      const k = ribs ? 0.88 + 0.12 * crest : 1;
      const nx = Math.cos(a) * ce;
      const ny = Math.sin(a) * ce;
      const luz = ny * 0.5 - nx * 0.3 + se * 0.7;
      s.plot(cx + nx * r * k, cy + ny * r * k, cz + se * rz, tinte(a, e, luz, crest));
    }
  }
}

/** Tono de una cáscara de ahuyama: luz de arriba a la izquierda y los surcos más oscuros. */
const rind = (r: Ramp, luz: number, crest: number, a: number, e: number) =>
  at(r, 2.7 + luz * 1.5 - (1 - crest) * 1.4 + (noise(Math.floor(a * 9), Math.floor(e * 9), 3) < 0.15 ? -0.5 : 0));

/** Cabito curvo de la ahuyama, con una hojita o un zarcillo. */
function stem(s: Escena, cx: number, cy: number, z: number, size: number, leaf = true) {
  for (let t = 0; t < 1; t += 0.08) {
    const x = cx - t * size * 0.5;
    const y = cy + t * size * 0.3;
    const zz = z + t * size * 1.6;
    s.box(x - 0.6, y - 0.6, zz, 1.2, 1.2, 0.5, flatT(at(C.logs, 4)), flatT(at(C.logs, 3)), flatT(at(C.logs, 2)));
  }
  if (!leaf) return;
  // Hojita que cae de lado y el zarcillo enroscado.
  for (let t = 0; t < 1; t += 0.06) {
    const w = Math.sin(t * Math.PI) * size * 0.45;
    for (let k = -w; k <= w; k += 0.4) s.plot(cx + 0.5 + t * size * 1.1, cy - 0.5 + k, z + 0.4 - t * size * 0.4, at(C.leaf, 3 + (k < 0 ? 1 : 0)));
  }
  for (let t = 0; t < 1; t += 0.04) {
    const ang = t * Math.PI * 3;
    s.plot(cx - 1 + Math.cos(ang) * 1.2 - t * 1.5, cy + 1.2 + Math.sin(ang) * 1.2, z + 0.6 + t * 1.2, at(C.leaf, 2));
  }
}

/**
 * Caras talladas en píxeles de pantalla ("#" = hueco), una por tamaño: en algo tan chico un dibujo a mano
 * se lee mucho mejor que una forma proyectada sobre la esfera.
 */
const FACE_BIG = [
  "..#.....#..", //
  ".###...###.",
  ".....#.....",
  "#.........#",
  "##.#####.##",
  ".#########.",
  "...#####...",
];
const FACE_SMALL = [
  ".#.....#.", //
  "###...###",
  "....#....",
  "##.###.##",
  ".#######.",
];
const FACE_TINY = [
  ".#...#.", //
  "##...##",
  "#.###.#",
  ".#####.",
];

/** La cara mira entre +x (el frente del mueble) y la cámara: corrida a la derecha, en radios. */
const FACE_SHIFT = 0.28;

/**
 * Ahuyama tallada: de día los huecos se ven oscuros; de noche, prendidos con la vela de adentro (amarillo
 * en el centro, naranja en el borde) y la cáscara de alrededor un poco encendida.
 */
function carvedPumpkin(s: Escena, cx: number, cy: number, cz: number, r: number, rz: number, night: boolean, face: readonly string[]) {
  orb(s, cx, cy, cz, r, rz, (a, e, luz, crest) => rind(PUMPKIN, luz, crest, a, e), 5);
  stem(s, cx, cy, cz + rz - 0.6, Math.max(1.6, r * 0.38));
  carveFace(s, cx, cy, cz, r, night, face);
}

/** Pinta la cara tallada sobre lo ya dibujado (va al final si algo, como un sombrero, la taparía). */
function carveFace(s: Escena, cx: number, cy: number, cz: number, r: number, night: boolean, face: readonly string[]) {
  // El punto que mira a la cámara cae en el centro del dibujo; la cara se corre un poco hacia +x.
  const q = s.p(cx, cy, cz);
  const w = face[0]!.length;
  const x0 = Math.round(q.x + r * FACE_SHIFT) - Math.floor(w / 2);
  const y0 = Math.round(q.y) - Math.floor(face.length / 2);
  const hole = (x: number, y: number) => face[y]?.[x] === "#";
  if (night)
    for (let y = -1; y <= face.length; y++)
      for (let x = -1; x <= w; x++)
        if (!hole(x, y) && (hole(x + 1, y) || hole(x - 1, y) || hole(x, y + 1) || hole(x, y - 1)) && s.canvas.alphaAt(x0 + x, y0 + y) > 200)
          s.canvas.set(x0 + x, y0 + y, [CANDLE[0]![0], CANDLE[0]![1], CANDLE[0]![2], 110]);
  face.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== "#") return;
      const inner = hole(x + 1, y) && hole(x - 1, y) && hole(x, y + 1) && hole(x, y - 1);
      const col = night ? (inner || (hole(x, y + 1) && hole(x, y - 1)) ? CANDLE[2]! : CANDLE[1]!) : hole(x, y + 1) ? HOLE : mix(HOLE, at(C.fire, 0), 0.45);
      s.canvas.set(x0 + x, y0 + y, col);
    }),
  );
}

// ---------- Calabazas ----------

function pumpkinSmall(night: boolean): Sprite {
  const s = scene(1, 1, 20, 6);
  s.roundShadow(8, 8.5, 6.2, 0.3);
  carvedPumpkin(s, 8, 8, 4.4, 5.6, 4.6, night, FACE_SMALL);
  return s.sprite();
}

function pumpkinBig(night: boolean): Sprite {
  const s = scene(1, 1, 26, 6);
  s.roundShadow(8, 8.5, 8.4, 0.32);
  carvedPumpkin(s, 7.6, 7.8, 6, 7.4, 6, night, FACE_BIG);
  return s.sprite();
}

/** Una hoja seca de otoño tirada en el piso (roja, naranja o mostaza). */
function leafOnGround(s: Escena, x: number, y: number, k: number) {
  const r = [C.rug, C.terracotta, C.mustard][k % 3]!;
  for (let u = -1.6; u <= 1.6; u += 0.35)
    for (let v = -1; v <= 1; v += 0.35) if (Math.abs(u) / 1.6 + Math.abs(v) < 1) s.plot(x + u, y + v * (k % 2 ? 1.2 : 0.8), 0.2, at(r, Math.abs(v) < 0.2 ? 2 : 3));
}

/** Pila de ahuyamas sin tallar: la grande naranja atrás, la crema, la verde de rayas y una chiquita. */
function pumpkinPile(): Sprite {
  const s = scene(1, 1, 24, 6);
  s.roundShadow(8, 8.5, 8, 0.3);
  const plain = (r: Ramp, stripes = false) => (a: number, e: number, luz: number, crest: number) =>
    stripes && crest > 0.85 ? at(CREAM_SQUASH, 3 + luz) : rind(r, luz, crest, a, e);
  orb(s, 6, 6, 5, 6, 5, plain(PUMPKIN), 5);
  stem(s, 6, 6, 9.4, 2.2, false);
  orb(s, 11.6, 7, 3.6, 4.2, 3.6, plain(CREAM_SQUASH), 6);
  stem(s, 11.6, 7, 6.6, 1.6, false);
  orb(s, 6, 12.2, 3, 3.6, 3, plain(GREEN_SQUASH, true), 4);
  stem(s, 6, 12.2, 5.6, 1.4, false);
  orb(s, 11.8, 12.4, 2.4, 2.8, 2.4, plain(PUMPKIN), 5);
  stem(s, 11.8, 12.4, 4.4, 1.3);
  leafOnGround(s, 14.5, 3, 0);
  leafOnGround(s, 2, 14.5, 2);
  return s.sprite();
}

// ---------- Espantapájaros de brujas ----------

/** Sombrero de bruja: ala ancha, el cono con la punta doblada y la cinta naranja con su hebilla. */
function witchHat(s: Escena, cx: number, cy: number, z: number, r: number, h: number) {
  s.disc(cx, cy, z, r, (dx, dy) => at(LILAC, Math.hypot(dx, dy) > r - 0.7 ? 1 : dx + dy < -2 ? 2 : 1));
  s.cylinder(cx, cy, z - 0.6, r, 0.6, () => at(LILAC, 0));
  const cr = r * 0.5;
  s.cone(cx, cy, z, cr, h, (_a, sl, luz) => {
    if (sl < 1.4) return at(C.mustard, luz > 0.3 ? 4 : 3);
    return at(LILAC, luz > 0.55 ? 3 : luz > 0 ? 2 : 1);
  });
  // Hebilla dorada de frente y la punta doblada hacia atrás.
  for (const [dx, dz] of [
    [0, 0.4],
    [0, 1],
  ] as const)
    s.plot(cx + cr * 0.75 + dx, cy + cr * 0.65, z + dz, at(C.gold, 5));
  for (let t = 0; t < 1; t += 0.08) s.box(cx - t * 3.2 - 0.6, cy - t * 1.2 - 0.6, z + h - 1 + Math.sin(t * Math.PI) * 1.2 - t * 1.6, 1.2, 1.2, 1.1, flatT(at(LILAC, 2)), flatT(at(LILAC, 1)), flatT(at(LILAC, 1)));
}

/** Paja: amarillo con briznas más oscuras. */
function straw(u: number, v: number, seed = 2): RGBA {
  const n = noise(Math.floor(u * 1.5), Math.floor(v), seed);
  return at(C.mustard, n < 0.2 ? 2 : n > 0.8 ? 4 : 3);
}

/** Espantapájaros con cabeza de ahuyama tallada, sombrero de bruja, camisa de cuadros y capa lila. */
function witchScarecrow(night: boolean): Sprite {
  const s = scene(1, 1, 52, 8);
  s.roundShadow(8, 8.5, 5, 0.28);
  s.solid(7.1, 7.1, 0, 1.8, 1.8, 26, at(C.logs, 4), at(C.logs, 3), at(C.logs, 2));
  // Capa lila deshilachada atrás (cae del palo de los brazos).
  s.quad([5, 1.5, 22], [0, 1, 0], [0.12, 0, -1], 13, 12, (u, v) => (v > 10 + noise(Math.floor(u), 0, 5) * 2.5 ? null : at(LILAC, v < 1 ? 3 : 2)));
  // El palo de los brazos.
  s.box(7.3, 0.5, 21.5, 1.4, 15, 1.4, flatT(at(C.logs, 4)), flatT(at(C.logs, 3)), flatT(at(C.logs, 2)));
  // Camisa de cuadros naranja con un parche y las mangas.
  const plaid = (base: number): Tinte => (u, v) => {
    if (Math.abs(u - 2.5) < 1 && Math.abs(v - 5) < 1) return at(C.sage, 3);
    const line = Math.floor(u) % 3 === 0 || Math.floor(v) % 3 === 0;
    return line ? at(LILAC, base - 1) : at(PUMPKIN, base);
  };
  s.box(5.4, 4.6, 11, 5.2, 6.8, 11.5, flatT(at(PUMPKIN, 4)), plaid(3), plaid(2));
  for (const y of [1, 11.4]) s.box(6.2, y, 19.5, 3.6, 3.6, 3, flatT(at(PUMPKIN, 4)), plaid(3), plaid(2));
  // Paja que sale por las mangas y por debajo de la camisa.
  for (const [x, y, z, dy] of [
    [8, 1, 20, -1],
    [8, 15, 20, 1],
  ] as const)
    for (let k = 0; k < 4; k++) for (let t = 0; t < 2; t += 0.3) s.plot(x - 1 + k * 0.6, y + dy * t, z + 1 - t * 0.8 - k * 0.3, straw(k * 3, t * 4));
  for (let k = 0; k < 9; k++) for (let t = 0; t < 2.4; t += 0.3) s.plot(5.6 + (k % 3) * 2.2, 5 + Math.floor(k / 3) * 2.8, 11 - t, straw(k, t * 3, 7));
  // Bufanda mostaza y la cabeza.
  s.box(6, 5.8, 22.3, 4.4, 4.4, 1.4, flatT(at(C.mustard, 4)), flatT(at(C.mustard, 3)), flatT(at(C.mustard, 2)));
  orb(s, 8.2, 8.2, 27.2, 4.4, 3.6, (a, e, luz, crest) => rind(PUMPKIN, luz, crest, a, e), 5);
  witchHat(s, 8.2, 8.2, 31.6, 5.4, 9.5);
  // La cara después del sombrero: el ala, vista desde arriba, le taparía los ojos.
  carveFace(s, 8.2, 8.2, 26.6, 4.4, night, FACE_TINY);
  return s.sprite();
}

// ---------- Farol de papel ----------

/**
 * Farol de papel naranja que cuelga del brazo de un poste de madera, con sus aros, la tapa y la borla.
 * De noche el papel se ve prendido por dentro.
 */
function paperLantern(night: boolean): Sprite {
  const s = scene(1, 1, 46, 6);
  s.roundShadow(4, 8.5, 2.6, 0.26);
  s.roundShadow(11, 8.5, 3.6, 0.18);
  s.solid(3, 7.2, 0, 1.8, 1.8, 36, at(C.logs, 4), at(C.logs, 3), at(C.logs, 2));
  s.solid(2.4, 6.6, 0, 3, 3, 1.5, at(C.logs, 3), at(C.logs, 2), at(C.logs, 1));
  // El brazo y una mensulita en diagonal.
  s.box(3, 7.4, 34.5, 10, 1.4, 1.4, flatT(at(C.logs, 4)), flatT(at(C.logs, 3)), flatT(at(C.logs, 2)));
  for (let t = 0; t < 1; t += 0.12) s.box(4.6 + t * 3.6, 7.6, 30 + t * 4.4, 1, 1, 1, flatT(at(C.logs, 3)), flatT(at(C.logs, 2)), flatT(at(C.logs, 2)));
  // El cordel.
  for (let z = 30.6; z < 34.6; z += 0.4) s.plot(11.5, 8.1, z, at(C.woodDark, 1));
  // El farol: papel con aros (más oscuros) cada tanto.
  const paper = (_a: number, e: number, luz: number) => {
    const ring = Math.abs(((Math.sin(e) * 5 + 10) % 2) - 1) > 0.78;
    if (night) return ring ? at(C.fire, 2) : at(C.fire, 3 + (luz > 0 ? 1 : 0));
    return ring ? at(PUMPKIN, 1) : at(PUMPKIN, 3 + luz * 1.2);
  };
  orb(s, 11.5, 8.1, 25, 4.4, 4.8, paper);
  s.disc(11.5, 8.1, 29.7, 2.2, () => at(C.woodDark, 2));
  s.cylinder(11.5, 8.1, 29.2, 2.2, 0.8, (_a, _v, luz) => at(C.woodDark, luz > 0 ? 3 : 1));
  s.cylinder(11.5, 8.1, 19.7, 2, 0.8, (_a, _v, luz) => at(C.woodDark, luz > 0 ? 3 : 1));
  // La borla roja abajo.
  for (let z = 16; z < 19.6; z += 0.4) for (const dx of [-0.4, 0, 0.4]) s.plot(11.5 + dx, 8.1 - dx, z, at(C.rug, z < 17 ? 2 : 3));
  return s.sprite();
}

// ---------- Telaraña ----------

/**
 * Telaraña de la esquina de atrás (entre la pared del norte y la del oeste), con su arañita colgando de
 * un hilo. Se pasa por debajo: no bloquea. Sin contorno, que se vea delgadita.
 */
function cobweb(): Sprite {
  const T = hex("#f4f0ff", 230);
  const T2 = hex("#d8d0ee", 220);
  const Z = 36;
  const R = 16;
  return renderSprite([volume(0, 0, 0, 16, 16, Z + 1)], {
    extra: (c, p) => {
      // Rayos desde la esquina: uno por la pared del norte (a lo largo de x), uno por la del oeste (a lo
      // largo de y), uno bajando por la esquina y dos en medio, cruzando en el aire.
      const rays: [number, number, number][] = [
        [R, 0, -R * 0.12],
        [R * 0.8, R * 0.3, -R * 0.62],
        [R * 0.42, R * 0.42, -R * 0.95],
        [R * 0.3, R * 0.8, -R * 0.62],
        [0, R, -R * 0.12],
      ];
      const pt = (v: [number, number, number], k: number) => p(v[0] * k, v[1] * k, Z + v[2] * k);
      for (const v of rays) {
        const a = pt(v, 0.08);
        const b = pt(v, 1);
        c.line(a.x, a.y, b.x, b.y, T);
      }
      // Anillos entre rayo y rayo, con la seda un poco caída en el medio.
      for (const k of [0.38, 0.66, 0.92])
        for (let i = 0; i + 1 < rays.length; i++) {
          const a = pt(rays[i]!, k);
          const b = pt(rays[i + 1]!, k);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2 + 1 + k;
          c.line(a.x, a.y, mx, my, k > 0.9 ? T2 : T);
          c.line(mx, my, b.x, b.y, k > 0.9 ? T2 : T);
        }
      // La arañita: un hilo y el cuerpo lila con dos puntitos de ojos.
      const top = pt(rays[2]!, 0.66);
      const sp = { x: top.x, y: top.y + 6 };
      c.line(top.x, top.y, sp.x, sp.y - 1, T2);
      c.rect(sp.x - 1, sp.y, 3, 2, at(LILAC, 1));
      c.set(sp.x, sp.y + 2, at(LILAC, 0));
      for (const dx of [-2, 2]) {
        c.set(sp.x + dx, sp.y, at(LILAC, 0));
        c.set(sp.x + dx, sp.y + 2, at(LILAC, 0));
      }
      c.set(sp.x - 1, sp.y + 1, at(C.mustard, 5));
      c.set(sp.x + 1, sp.y + 1, at(C.mustard, 5));
    },
  });
}

// ---------- Caldero ----------

/** Llamita pintada en 2D (bajo el caldero). */
function flame(s: Escena, x: number, y: number, z: number, rx: number, h: number) {
  const q = s.p(x, y, z);
  for (let j = 0; j < h; j++) {
    const w = rx * Math.sin((1 - j / h) * Math.PI * 0.6 + 0.08);
    for (let i = -Math.ceil(w); i <= Math.ceil(w); i++) {
      if (Math.abs(i) > w) continue;
      const k = Math.abs(i) / Math.max(1, w) + j / h;
      s.canvas.set(Math.round(q.x + i), Math.round(q.y - j), at(C.fire, k < 0.5 ? 4 : k < 0.9 ? 3 : 2));
    }
  }
}

/** Caldero de hierro sobre tres patas y unos leños prendidos, con el brebaje verde y sus burbujas. */
function cauldron(): Sprite {
  const s = scene(1, 1, 28, 6);
  s.roundShadow(8, 8.5, 7.5, 0.3);
  // Leños cruzados y las brasas.
  for (const [x, y, w, d] of [
    [2.5, 6.5, 11, 2.4],
    [6.6, 2.5, 2.4, 11],
  ] as const)
    s.box(x, y, 0, w, d, 2.2, (u, v) => (Math.hypot(u % 11, v % 11) < 1.2 ? at(C.logs, 5) : at(C.logs, 3)), flatT(at(C.logs, 2)), flatT(at(C.logs, 1)));
  for (const [x, y] of [
    [3.5, 3.5],
    [12, 4],
    [4, 12],
  ] as const)
    s.solid(x - 0.6, y - 0.6, 0, 1.2, 1.2, 5, at(IRON, 3), at(IRON, 2), at(IRON, 1));
  // La olla: media esfera barriguda con el borde grueso.
  orb(s, 8, 8, 8.4, 7, 6, (_a, _e, luz) => at(IRON, 2.2 + luz * 1.8), 0, -Math.PI / 2, 0.55);
  s.cylinder(8, 8, 11.2, 6.2, 1.4, (_a, v, luz) => at(IRON, v > 0.9 ? 4 : 2.8 + luz * 1.4));
  // Las orejas por donde pasa el asa.
  s.solid(14.2, 7.3, 9.6, 1, 1.4, 2.2, at(IRON, 3), at(IRON, 2), at(IRON, 1));
  s.solid(7.3, 14.2, 9.6, 1.4, 1, 2.2, at(IRON, 3), at(IRON, 2), at(IRON, 1));
  // El brebaje: remolino claro en el centro y burbujas.
  s.disc(8, 8, 12.4, 6.2, (dx, dy) => {
    const r = Math.hypot(dx, dy);
    if (r > 5.3) return at(IRON, 4);
    const swirl = Math.sin(Math.atan2(dy, dx) * 2 + r * 1.3);
    return at(BREW, swirl > 0.6 ? 4 : r < 2 ? 4 : 3 - (r > 4.4 ? 1 : 0));
  });
  for (const [x, y, z, r] of [
    [6, 9, 12.8, 1.3],
    [9.6, 6.4, 12.6, 1],
    [8.8, 10.4, 13.8, 0.9],
    [6.6, 6.2, 15, 0.7],
    [9.4, 8.6, 16.8, 0.55],
  ] as const)
    orb(s, x, y, z, r, r, (_a, _e, luz) => at(BREW, luz > 0.55 ? 5 : luz > -0.2 ? 4 : 3));
  // Las brasas de abajo, por delante de los leños.
  flame(s, 10.5, 12, 0.8, 1.6, 4);
  flame(s, 12, 10.5, 0.8, 1.2, 3);
  return s.sprite();
}

// ---------- Lápida de cartón ----------

/** Letras extra de 3x5 que los letreros de neón no tienen. */
const EXTRA_GLYPHS: Record<string, string> = {
  Q: ".#. #.# #.# #.# .##",
};

/** Ancho de cada carácter en píxeles: las letras 3, el punto 1 y el espacio 2. */
const charW = (ch: string) => (ch === "." ? 1 : ch === " " ? 2 : 3);

/** Dónde empieza cada carácter: 1 de aire entre letras, sin aire antes de un punto ni alrededor del espacio. */
function layout(text: string): { ch: string; x: number }[] {
  const out: { ch: string; x: number }[] = [];
  let x = 0;
  [...text].forEach((ch, i) => {
    out.push({ ch, x });
    const next = text[i + 1];
    x += charW(ch) + (next && next !== "." && next !== " " && ch !== " " ? 1 : 0);
  });
  return out;
}

const textWidth = (text: string) => {
  const last = layout(text).at(-1);
  return last ? last.x + charW(last.ch) : 0;
};

/** ¿Está prendido el píxel (lx, gy) del carácter? (lx desde la izquierda, gy de arriba abajo, 0..4). */
function glyphPixel(ch: string, lx: number, gy: number): boolean {
  if (ch === ".") return gy === 4;
  if (ch === " ") return false;
  const extra = EXTRA_GLYPHS[ch];
  return extra ? extra.split(" ")[gy]?.[lx] === "#" : glyphOn(ch, lx, gy);
}

/**
 * Un renglón sobre una cara vertical: cada letra va derecha (sin sesgar, que en 3x5 se deshace) y la
 * siguiente sube o baja con la cara, en escalera. `o` es la esquina de arriba a la izquierda (vista desde
 * la cámara) y `du`, un paso hacia la derecha en pantalla.
 */
function paintText(s: Escena, text: string, o: V3, du: V3, col: RGBA) {
  for (const { ch, x } of layout(text)) {
    const k = x + charW(ch) / 2;
    const q = s.p(o[0] + du[0] * k, o[1] + du[1] * k, o[2]);
    const left = Math.round(q.x - charW(ch) / 2);
    const top = Math.round(q.y);
    for (let gy = 0; gy < 5; gy++) for (let lx = 0; lx < charW(ch); lx++) if (glyphPixel(ch, lx, gy)) s.canvas.set(left + lx, top + gy, col);
  }
}

/**
 * Lápida de cartón de chiste: papel lila con el arco arriba, "Q.E.P.D. EL LUNES" pintado, cinta de
 * enmascarar en una esquina y dos estacas atrás. Mira a +x (el texto se lee derecho con right o left).
 */
function cardboardTombstone(): Sprite {
  const s = scene(1, 2, 30, 6);
  const X = 7;
  const W = 1.3;
  const Y0 = 0.5;
  const Y1 = 31.5;
  const MID = 16;
  const BASE = 14;
  const ARCH = 9;
  const height = (y: number) => BASE + ARCH * Math.sqrt(Math.max(0, 1 - ((y - MID) / 15.5) ** 2));
  s.shadow(X - 1, Y0, 5, Y1 - Y0 + 1, 0.26);
  // Estacas de atrás, inclinadas.
  for (const y of [8, 24]) for (let z = 0; z < 16; z += 0.4) s.box(X - 0.4 - z * 0.18, y, z, 1.1, 1.1, 0.5, flatT(at(C.wood, 4)), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  const step = 0.5;
  for (let y = Y0; y < Y1; y += step) {
    const h = height(y + step / 2);
    const face: Tinte = (u, v) => {
      const Y = y + u;
      const top = height(Y) - 0.4;
      if (v > top) return null;
      if (Y < Y0 + 0.8 || Y > Y1 - 0.8 || v > top - 0.9 || v < 0.9) return at(LILAC, 2);
      // Cinta de enmascarar en la esquina de arriba a la izquierda (vista desde la cámara: y alto).
      if (Y > Y1 - 5 && Y < Y1 - 2 && v > BASE - 2 && v < BASE + 1.4) return at(C.cream, 4);
      return at(LILAC, v > top - 3 ? 4 : 3);
    };
    // El canto de cartón corrugado (café) arriba y en los costados.
    s.box(X, y, 0.4, W, step, h - 0.4, (u) => at(C.cork, Math.floor((y + u) * 2) % 2 ? 3 : 4), y + step >= Y1 ? flatT(at(C.cork, 3)) : null, face);
  }
  // Un pastico y una florecita naranja al pie.
  for (const [y, k] of [
    [4, 0],
    [12, 1],
    [21, 2],
    [28, 3],
  ] as const)
    for (let t = 0; t < 3; t += 0.35) s.plot(X + 2 + (k % 2), y + (t % 1) * (k % 2 ? 1 : -1), t, at(C.grass, 3 + (t > 1.5 ? 1 : 0)));
  orb(s, X + 3, 17, 1.4, 1, 0.8, () => at(PUMPKIN, 4));
  // Las letras, centradas: se lee hacia -y (de izquierda a derecha en pantalla).
  for (const [text, zTop] of [
    ["Q.E.P.D.", 19],
    ["EL LUNES", 11],
  ] as const)
    paintText(s, text, [X + W, MID + textWidth(text) / 2, zTop], [0, -1, 0], at(LILAC, 0));
  return s.sprite();
}

// ---------- Fardo de paja ----------

/**
 * Una paca de paja con sus dos amarres. Los amarres dan la vuelta a lo largo de la paca: se ven arriba y en
 * los costados largos, no en las puntas. `alongX`: la paca es larga en x.
 */
function bale(s: Escena, x: number, y: number, z: number, w: number, d: number, h: number, alongX: boolean, seed: number) {
  const len = alongX ? w : d;
  const twine = (t: number) => Math.abs(t - len * 0.27) < 0.6 || Math.abs(t - len * 0.73) < 0.6;
  const side = (t: number, v: number, k: number, dark: number) => (twine(t) ? at(C.cork, 1) : mix(straw(t + seed, v, k), at(C.cork, 2), dark));
  s.box(
    x,
    y,
    z,
    w,
    d,
    h,
    (u, v) => side(alongX ? u : v, (alongX ? v : u) + seed, seed, 0),
    (u, v) => (alongX ? side(u, v, seed + 5, 0) : mix(straw(u, v, seed + 5), at(C.cork, 2), 0.15)),
    (u, v) => (alongX ? mix(straw(u, v, seed + 9), at(C.cork, 2), 0.3) : side(u, v, seed + 9, 0.3)),
  );
}

/** Fardo de paja: dos pacas, una cruzada encima, con una ahuyamita, un manojo de mazorcas y hojas secas. */
function strawBale(): Sprite {
  const s = scene(1, 1, 24, 6);
  s.shadow(1, 1.5, 15, 14, 0.28);
  bale(s, 1.2, 3, 0, 14, 10.5, 8, true, 0);
  // Briznas sueltas encima.
  for (let k = 0; k < 12; k++) {
    const x = 1.6 + noise(k, 1, 3) * 13;
    const y = 3.2 + noise(k, 2, 3) * 10;
    s.plot(x, y, 8.3, straw(k, 1, 6));
    s.plot(x + 0.4, y - 0.3, 8.6, straw(k, 2, 6));
  }
  // Una ahuyama encima y dos mazorcas secas (una roja, una amarilla) recostadas al lado.
  orb(s, 10.2, 8.4, 10.8, 3.4, 2.8, (a, e, luz, crest) => rind(PUMPKIN, luz, crest, a, e), 5);
  stem(s, 10.2, 8.4, 13.2, 1.5);
  for (const [y, k] of [
    [5, 0],
    [7, 1],
  ] as const)
    for (let t = 0; t < 1; t += 0.06) orb(s, 3 + t * 4, y, 8.9 + t * 0.3, 0.9, 0.9, (_a, _e, luz) => at(k ? C.rug : C.mustard, 3 + luz + (t > 0.8 ? -1 : 0)));
  leafOnGround(s, 14, 2, 0);
  leafOnGround(s, 15.5, 14, 1);
  return s.sprite();
}

// ---------- Matas de maíz del laberinto ----------

/** Maíz de otoño: las hojas ya doradas, con algo de verde abajo. */
const HUSK = ramp("#5e3e1c", "#8a6230", "#b48a44", "#d6ae5c", "#ecd082", "#fbecb4");
/** Las hojas a medio secar, entre verde y dorado. */
const OLIVE = ramp("#3e4a1e", "#5e6e2a", "#83913a", "#a8b450", "#cad37a", "#e8eeb0");

/**
 * Un tile de maizal tupido para las paredes del laberinto: varias matas altas con hojas largas que se
 * doblan, mazorcas en su capacho y las espigas arriba. Cada variante sale de otra semilla.
 */
function cornStalks(seed: number): Sprite {
  const s = scene(1, 1, 50, 10);
  s.shadow(0, 0, 17, 17, 0.26);
  // Tierra removida de la base.
  s.quad([0.5, 0.5, 0.2], [1, 0, 0], [0, 1, 0], 15, 15, (u, v) => (noise(Math.floor(u), Math.floor(v), seed + 40) < 0.5 ? at(C.dirt, 2) : at(C.dirt, 3)));
  const spots: [number, number][] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      if (noise(i, j, seed) < 0.2) continue;
      spots.push([2.6 + i * 5.2 + (noise(i, j, seed + 1) - 0.5) * 2.6, 2.6 + j * 5.2 + (noise(i, j, seed + 2) - 0.5) * 2.6]);
    }
  // De atrás hacia adelante no importa (z-buffer), pero el orden fija qué hoja tapa a cuál si empatan.
  spots.forEach(([x, y], k) => {
    const n = (o: number) => noise(k, o, seed * 7 + 3);
    const H = 32 + n(1) * 12;
    const lx = (n(2) - 0.5) * 2.4;
    const ly = (n(3) - 0.5) * 2.4;
    const px = (z: number) => x + (lx * z) / H;
    const py = (z: number) => y + (ly * z) / H;
    // La caña: verde abajo, dorada arriba, con nudos.
    for (let z = 0; z < H; z += 0.45) {
      const knot = z % 6 < 0.5;
      const col = z < H * 0.35 ? at(GREEN_SQUASH, knot ? 2 : 3) : at(HUSK, knot ? 2 : 3);
      s.plot(px(z), py(z), z, col);
      s.plot(px(z) + 0.45, py(z) - 0.45, z, z < H * 0.35 ? at(GREEN_SQUASH, 4) : at(HUSK, 4));
    }
    // Hojas largas que salen en espiral y se doblan hacia el piso.
    const leaves = 5 + Math.floor(n(4) * 3);
    for (let i = 0; i < leaves; i++) {
      const zb = 5 + (i / leaves) * (H - 10) + n(10 + i) * 3;
      const ang = n(20 + i) * Math.PI * 2;
      const len = 7 + n(30 + i) * 5;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const r = zb < H * 0.3 ? GREEN_SQUASH : n(40 + i) < 0.35 ? OLIVE : HUSK;
      for (let t = 0; t <= 1; t += 0.04) {
        const w = Math.sin(t * Math.PI) * 1.1 + 0.2;
        const cx = px(zb) + dx * len * t;
        const cy = py(zb) + dy * len * t;
        const cz = zb + len * 0.55 * t - len * 0.85 * t * t;
        for (let k = -w; k <= w; k += 0.35) {
          // La cara de arriba de la hoja recibe la luz; la punta, seca y más oscura.
          const tone = (k < 0 ? 0.8 : -0.4) + (t > 0.8 ? -1 : 0) + (dx + dy < 0 ? 0.5 : -0.4);
          s.plot(cx - dy * k, cy + dx * k, cz, at(t > 0.85 && r !== GREEN_SQUASH ? HUSK : r, 2.6 + tone + (Math.abs(k) < 0.2 ? 0.8 : 0)));
        }
      }
    }
    // Una mazorca en su capacho (no en todas).
    if (n(5) > 0.35) {
      const zc = H * 0.5;
      const a = n(6) * Math.PI * 2;
      const ex = px(zc) + Math.cos(a) * 1.4;
      const ey = py(zc) + Math.sin(a) * 1.4;
      orb(s, ex, ey, zc, 1.15, 2.6, (_a, e, luz) => (e > 0.7 ? at(HUSK, 5) : at(HUSK, 3 + luz * 1.2)));
      for (let t = 0; t < 1.4; t += 0.3) s.plot(ex - t * 0.3, ey, zc + 2.6 + t, at(C.terracotta, 3));
    }
    // La espiga: unas varitas doradas abiertas.
    for (let b = 0; b < 5; b++) {
      const a = (b / 5) * Math.PI * 2 + n(7);
      for (let t = 0; t < 4; t += 0.35) s.plot(px(H) + Math.cos(a) * t * 0.5, py(H) + Math.sin(a) * t * 0.5, H + t * 0.9 - t * t * 0.12, at(C.mustard, 3 - (t > 2.5 ? 1 : 0)));
    }
  });
  return s.sprite();
}

// ---------- El arco del laberinto ----------

/** Pilar del arco: dos fardos de paja, el palo que sube y una ahuyama al pie. */
function archPillar(s: Escena, cx: number, cy: number) {
  for (const [z, rot] of [
    [0, 0],
    [8, 1],
  ] as const) {
    const w = rot ? 10 : 12;
    const d = rot ? 12 : 10;
    s.box(cx - w / 2, cy - d / 2, z, w, d, 8, (u, v) => straw(u + z, v), (u, v) => straw(u, v + z, 5), (u, v) => mix(straw(u, v, 9 + z), at(C.cork, 2), 0.3));
  }
  s.solid(cx - 1, cy - 1, 16, 2, 2, 25, at(C.logs, 4), at(C.logs, 3), at(C.logs, 2));
  orb(s, cx + 6.5, cy + 6, 3, 3.4, 2.8, (a, e, luz, crest) => rind(PUMPKIN, luz, crest, a, e), 5);
  stem(s, cx + 6.5, cy + 6, 5.4, 1.4);
}

/**
 * El arco de la entrada del laberinto: dos pilares de paja con el tablón "LABERINTO" arriba, guirnaldas de
 * hojas secas y un farolito. Fijo, en dos versiones para que el letrero siempre se lea derecho:
 * `alongX` = el paso va a lo largo de x (pilares en y = 0 y y = 2: el tablón mira a +x); si no, a lo largo
 * de y (pilares en x = 0 y x = 2: el tablón mira a +y).
 */
function mazeArch(alongX: boolean): Sprite {
  const s = scene(alongX ? 1 : 3, alongX ? 3 : 1, 52, 10);
  const A: [number, number] = [8, 8];
  const B: [number, number] = alongX ? [8, 40] : [40, 8];
  s.shadow(1, 1, alongX ? 15 : 47, alongX ? 47 : 15, 0.22);
  archPillar(s, ...A);
  archPillar(s, ...B);
  const TEXT = "LABERINTO";
  const tw = textWidth(TEXT);
  const L = 44;
  const z0 = 32;
  const H = 9;
  const board: Tinte = (u, v) => {
    if (u < 0.8 || u > L - 0.8 || v < 0.8 || v > H - 0.8) return at(C.woodDark, 2);
    return at(C.wood, 3 + (Math.floor(v) % 3 === 0 ? -1 : 0) + (noise(Math.floor(u / 5), Math.floor(v / 3), 8) < 0.2 ? -1 : 0));
  };
  // El tablón va por delante de los palos (del lado de la cámara), clavado a ellos.
  if (alongX) s.box(9, 2, z0, 1.6, L, H, flatT(at(C.wood, 4)), flatT(at(C.wood, 2)), board);
  else s.box(2, 9, z0, L, 1.6, H, flatT(at(C.wood, 4)), board, flatT(at(C.wood, 2)));
  // Se lee de izquierda a derecha en pantalla: a lo largo de x crece; a lo largo de y, al revés.
  if (alongX) paintText(s, TEXT, [10.6, 2 + L / 2 + tw / 2, z0 + H - 2], [0, -1, 0], at(C.cream, 5));
  else paintText(s, TEXT, [2 + L / 2 - tw / 2, 10.6, z0 + H - 2], [1, 0, 0], at(C.cream, 5));
  // Guirnalda de hojas secas que cuelga bajo el tablón, en dos curvas.
  const gar = (t: number): [number, number, number] => {
    const along = 4 + t * (L - 4);
    const sag = Math.sin(((t * 2) % 1) * Math.PI) * 3.5;
    return alongX ? [11, along, z0 - 0.5 - sag] : [along, 11, z0 - 0.5 - sag];
  };
  for (let t = 0; t < 1; t += 0.012) {
    const [x, y, z] = gar(t);
    const k = Math.floor(t * 60);
    const r = [C.rug, C.terracotta, C.mustard, PUMPKIN][k % 4]!;
    s.plot(x, y, z, at(r, 3));
    s.plot(x + 0.4, y - 0.4, z - 0.6, at(r, noise(k, 1, 4) < 0.5 ? 2 : 4));
  }
  // Ahuyamita en la punta de cada palo y un farolito colgado en el medio.
  for (const [x, y] of [A, B]) {
    orb(s, x, y, 43, 2.2, 1.8, (a, e, luz, crest) => rind(PUMPKIN, luz, crest, a, e), 5);
    stem(s, x, y, 44.6, 1, false);
  }
  const [mx, my, mz] = gar(0.5);
  for (let z = mz - 3; z < mz; z += 0.4) s.plot(mx, my, z, at(C.woodDark, 1));
  orb(s, mx, my, mz - 5, 1.8, 2, (_a, e, luz) => (Math.abs(Math.sin(e)) > 0.8 ? at(C.woodDark, 2) : at(PUMPKIN, 3 + luz)));
  return s.sprite();
}

// ---------- Registro ----------

/** Lo que no cambia de noche (va en DRAW de furniture.ts). */
export const BRUJAS_DRAW: Record<string, () => Sprite> = {
  "pumpkin-pile": pumpkinPile,
  cobweb,
  cauldron,
  "cardboard-tombstone": cardboardTombstone,
  "straw-bale": strawBale,
  "corn-maze-1": () => cornStalks(1),
  "corn-maze-2": () => cornStalks(2),
  "corn-maze-3": () => cornStalks(3),
  "corn-maze-4": () => cornStalks(4),
  "maze-arch": () => mazeArch(true),
  "maze-arch-y": () => mazeArch(false),
};

/** Lo que de noche se prende por dentro (va en OUTDOOR de outdoor.ts, que dibuja día y noche). */
export const BRUJAS_NIGHT: Record<string, (night: boolean) => Sprite> = {
  "carved-pumpkin": pumpkinSmall,
  "carved-pumpkin-big": pumpkinBig,
  "witch-scarecrow": witchScarecrow,
  "paper-lantern": paperLantern,
};
