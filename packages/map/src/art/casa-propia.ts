// Lo de adentro de la casa de cada persona (ver world/catalog-casa-propia.ts): las camas, el armario, el
// tocador, la tina de patas, la mesa del comedor, la lámpara colgada y el baúl, y para pasarla bien la
// barra, el equipo de sonido, la bola de discoteca, el juego de la rana y el billar. Casa de finca paisa: madera
// cálida, telas de colores y bronce; nada gris. Casi todo se arma con la Escena (z-buffer), porque hay
// mucho encimado (almohadas, cobijas que cuelgan, cosas sobre las mesas). Coordenadas locales de arte
// (tile = 16), mirando hacia +x; las camas tienen versión de espaldas (la cabecera hacia +x).
import { Escena } from "./exterior-escena";
import type { Variant } from "./kit";
import { C, OUT, mix } from "./palette";
import { PixelCanvas, at, bayer, noise, ramp, smoothNoise, type Ramp, type RGBA, type Sprite } from "./pixel";

const scene = (w: number, d: number, h: number, pad = 4) => new Escena({ x0: -pad, y0: -pad, z0: -2, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);

/** Color según el punto del mundo (así un dibujo sigue de una cara a la otra sin cortarse). */
type W3 = (x: number, y: number, z: number) => RGBA | null;

/** Caja cuyas caras se pintan con coordenadas del mundo. */
function boxW(s: Escena, x: number, y: number, z: number, w: number, d: number, h: number, top: W3 | null, left: W3 | null, right: W3 | null) {
  s.box(
    x,
    y,
    z,
    w,
    d,
    h,
    top && ((u, v) => top(x + u, y + v, z + h)),
    left && ((u, v) => left(x + u, y + d, z + v)),
    right && ((u, v) => right(x + w, y + u, z + v)),
  );
}

/** Caja de un material, con la luz de siempre (arriba la más clara, +x la más oscura). */
const block = (s: Escena, x: number, y: number, z: number, w: number, d: number, h: number, r: Ramp, base = 3) =>
  s.solid(x, y, z, w, d, h, at(r, base + 1), at(r, base), at(r, base - 1));

/** Tono de luz de una superficie según su normal (luz desde arriba a la izquierda, como los cilindros). */
const luzDe = (nx: number, ny: number, nz: number) => nz * 0.75 + ny * 0.55 - nx * 0.3;
const tono = (luz: number) => (luz > 0.45 ? 4 : luz > 0 ? 3 : luz > -0.4 ? 2 : 1);

/** Esfera (frutas, el patico, las perillas): solo la mitad que mira a la cámara. */
function sphere(s: Escena, cx: number, cy: number, cz: number, r: number, color: (luz: number, nx: number, ny: number, nz: number) => RGBA | null) {
  const step = 0.35 / Math.max(1, r);
  for (let a = 0; a < Math.PI * 2; a += step)
    for (let b = -Math.PI / 2; b <= Math.PI / 2; b += step) {
      const nx = Math.cos(b) * Math.cos(a);
      const ny = Math.cos(b) * Math.sin(a);
      const nz = Math.sin(b);
      if (nx + ny + nz < -0.3) continue;
      s.plot(cx + nx * r, cy + ny * r, cz + nz * r, color(luzDe(nx, ny, nz), nx, ny, nz));
    }
}

/** Elipsoide (cuerpos achatados): como la esfera pero con un radio por eje. */
function ellipsoid(s: Escena, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, color: (luz: number, nx: number, ny: number, nz: number) => RGBA | null) {
  const step = 0.35 / Math.max(1, rx, ry, rz);
  for (let a = 0; a < Math.PI * 2; a += step)
    for (let b = -Math.PI / 2; b <= Math.PI / 2; b += step) {
      const nx = Math.cos(b) * Math.cos(a);
      const ny = Math.cos(b) * Math.sin(a);
      const nz = Math.sin(b);
      if (nx + ny + nz < -0.3) continue;
      s.plot(cx + nx * rx, cy + ny * ry, cz + nz * rz, color(luzDe(nx, ny, nz), nx, ny, nz));
    }
}

/**
 * Dibujo a mano (filas de letras, `.` vacío) encima de todo, con el centro de la fila de abajo en el punto
 * (x, y, z) del mundo. Para figuritas que en cajas y esferas no se leen.
 */
function pixelArt(s: Escena, rows: string[], pal: Record<string, RGBA>, x: number, y: number, z: number) {
  const c = new PixelCanvas(s.canvas.width, s.canvas.height);
  const q = s.p(x, y, z);
  const w = rows[0]!.length;
  const x0 = Math.round(q.x - w / 2);
  const y0 = Math.round(q.y) - rows.length + 1;
  rows.forEach((row, j) => [...row].forEach((ch, i) => pal[ch] && c.set(x0 + i, y0 + j, pal[ch]!)));
  s.encima(c);
}

/** Esmalte blanco tibio de la tina y la loza (nada de gris frío). */
const ENAMEL: Ramp = ramp("#8a7064", "#b59f8e", "#d9c8b4", "#eee2cf", "#faf4e8", "#fffdf8");
/** Agua de la tina, verde azulada clarita. */
const WATER: Ramp = ramp("#2d6a78", "#3f8c98", "#62adb2", "#8fcdc8", "#c3e8de");
/** Cuero de la maleta. */
const LEATHER: Ramp = ramp("#2a150e", "#472414", "#6a3820", "#8c512f", "#ab6c43", "#c78b5c");

// ---------- Telas ----------

const QUILT: Ramp[] = [C.rug, C.mustard, C.sage, C.fabric, C.curtain, C.rose, C.cream, C.green];

/**
 * Colcha de retazos: cuadros de colores con su costura, algunos con cuadritos, otros con una diagonal o
 * un botón. (a, b) es la tela "desdoblada" (lo de arriba y lo que cuelga siguen el mismo dibujo); `sh`
 * baja el tono en los costados.
 */
function quiltAt(a: number, b: number, sh: number): RGBA {
  const P = 5.4;
  const i = Math.floor(a / P);
  const j = Math.floor(b / P);
  const r = QUILT[Math.floor(noise(i, j, 41) * QUILT.length)]!;
  const pa = a - i * P;
  const pb = b - j * P;
  if (pa < 0.55 || pb < 0.55) return at(r, 1 + sh);
  const kind = noise(i, j, 43);
  let t = 3;
  if (kind < 0.3) t = (Math.floor(pa / 1.3) + Math.floor(pb / 1.3)) % 2 ? 4 : 3;
  else if (kind > 0.72) t = Math.abs(pa - pb) < 0.6 || Math.abs(pa + pb - P) < 0.6 ? 2 : 4;
  else if (kind > 0.5 && Math.hypot(pa - P / 2, pb - P / 2) < 1) return at(C.cream, 5 + sh);
  return at(r, t + sh);
}

/** Cobija de lana a rayas, como una ruana: azul con rayas mostaza, vino y crema, con el tejido marcado. */
function stripesAt(a: number, b: number, sh: number): RGBA {
  const STR: [Ramp, number][] = [
    [C.fabric, 4.5],
    [C.mustard, 0.9],
    [C.rug, 0.9],
    [C.mustard, 0.9],
    [C.fabric, 4.5],
    [C.cream, 1.4],
  ];
  const total = STR.reduce((n, [, w]) => n + w, 0);
  let k = ((a % total) + total) % total;
  let r = C.fabric;
  for (const [rr, w] of STR) {
    if (k < w) {
      r = rr;
      break;
    }
    k -= w;
  }
  const weave = bayer(Math.floor(a * 2), Math.floor(b * 2)) < 0.25 ? -1 : 0;
  return at(r, 3 + sh + weave);
}

// ---------- Camas ----------

interface BedSpec {
  /** Ancho (en y): 32 la doble, 16 la sencilla. */
  D: number;
  /** Lo que lleva encima: colcha de retazos o cobija a rayas. */
  cover: (a: number, b: number, sh: number) => RGBA;
  /** Ribete del borde de abajo de lo que cuelga. */
  hem: Ramp;
  /** Las almohadas, en y. */
  pillows: [number, number][];
  /** La madera de la cama. */
  wood: Ramp;
}

/**
 * Cama de finca: cabecera tallada contra -x (dos postes con remate y un panel con arco, una ranura que lo
 * sigue y un medallón de flor), colchón alto, sábana blanca doblada sobre la cobija, que cuelga por el
 * costado con su ribete, y una piecera baja (no tapa a quien se acueste). La tapa del colchón queda plana.
 * De espaldas, la cabecera va hacia +x y se ve su dorso de tablas.
 */
function bed(spec: BedSpec, variant: Variant): Sprite {
  const back = variant === "back";
  const { D, wood: wd } = spec;
  const L = 32;
  // x de la vista de frente → x del dibujo (de espaldas, todo al revés en x).
  const X = (x: number, w: number) => (back ? L - x - w : x);
  const s = scene(2, D / 16, 40);
  s.shadow(1, 0.5, L - 1, D - 1, 0.3);

  const MATT_TOP = 12;
  const FOLD = 10.5;
  const H = (y: number) => (D > 16 ? 24 : 21) + (D > 16 ? 5 : 3) * Math.sin((Math.PI * (y - 3.5)) / (D - 7));

  // Postes de la cabecera y de la piecera, con remate torneado.
  const post = (x: number, y: number, h: number) => {
    block(s, X(x, 3), y, 0, 3, 3, h, wd, 3);
    block(s, X(x - 0.4, 3.8), y - 0.4, h - 3, 3.8, 3.8, 1, wd, 3);
    block(s, X(x + 0.3, 2.4), y + 0.3, h, 2.4, 2.4, 1.6, wd, 4);
    block(s, X(x + 0.8, 1.4), y + 0.8, h + 1.6, 1.4, 1.4, 1, wd, 4);
  };
  const HEAD = D > 16 ? 30 : 26;
  post(0.5, 0.5, HEAD);
  post(0.5, D - 3.5, HEAD);
  post(28.8, 0.5, 15);
  post(28.8, D - 3.5, 15);

  // Panel de la cabecera, por columnas para seguir el arco.
  const carved: W3 = (_x, y, z) => {
    const top = H(y);
    const n = noise(Math.floor(y * 2), Math.floor(z / 3), 5) < 0.2 ? -1 : 0;
    if (z > top - 1) return at(wd, 5);
    // Ranura que sigue el arco.
    if (Math.abs(z - (top - 3)) < 0.5) return at(wd, 1);
    if (z > top - 3) return at(wd, 4);
    // Medallón de flor en el centro y dos rombos a los lados.
    const cy = D / 2;
    const mz = D > 16 ? 21 : 18.5;
    const dm = Math.hypot(y - cy, (z - mz) * 1.1);
    const mr = D > 16 ? 3.6 : 2.6;
    if (dm < mr) {
      if (dm < 1) return at(C.gold, 4);
      const petal = Math.abs(Math.sin(Math.atan2(z - mz, y - cy) * 3)) > 0.5;
      return at(wd, dm > mr - 0.6 ? 1 : petal ? 4 : 2);
    }
    if (D > 16) {
      for (const dy of [-8.5, 8.5]) if (Math.abs(y - cy - dy) + Math.abs(z - mz) * 0.9 < 2.2) return at(wd, Math.abs(y - cy - dy) + Math.abs(z - mz) * 0.9 < 1.2 ? 4 : 1);
    }
    // Varillas verticales abajo.
    if (z < mz - mr - 1 && Math.abs(((y - 3.5) % 3) - 1.5) < 0.35) return at(wd, 1);
    return at(wd, 3 + n);
  };
  const plainBack: W3 = (_x, y, z) => {
    const top = H(y);
    if (z > top - 1) return at(wd, 4);
    if (Math.abs(((y - 3.5) % 5) - 2.5) > 2.1) return at(wd, 1);
    return at(wd, noise(Math.floor((y - 3.5) / 5), Math.floor(z / 4), 9) < 0.3 ? 2 : 3);
  };
  const rim: W3 = () => at(wd, 5);
  for (let y = 3.5; y < D - 3.5; y += 0.5) {
    const h = H(y + 0.25);
    boxW(s, X(1, 2), y, 4, 2, 0.5, h - 4, rim, rim, back ? plainBack : carved);
  }
  // Piecera baja: tablero con una moldura.
  const foot: W3 = (_x, y, z) => (z > 13 ? at(wd, 5) : z < 5.5 ? at(wd, 2) : Math.abs(((y - 3.5) % 4) - 2) < 0.3 ? at(wd, 2) : at(wd, 3));
  boxW(s, X(29.3, 2), 3.5, 4, 2, D - 7, 9.6, rim, null, back ? null : foot);

  // Base y colchón (debajo, la sábana blanca).
  block(s, X(3, 26.3), 1, 3, 26.3, D - 2, 3, wd, 2);
  const sheet: W3 = (_x, _y, z) => (z < 7 ? at(C.cream, 4) : at(C.cream, 5));
  boxW(s, X(3, 26.3), 1.5, 6, 26.3, D - 3, MATT_TOP - 6, () => at(C.cream, 5), sheet, sheet);

  // La cobija: tapa lo de los pies y cuelga por el costado, con la sábana doblada encima al principio.
  const y0 = 0.9;
  const y1 = D - 0.9;
  const zb = 4.4;
  const zt = MATT_TOP + 0.6;
  const along = (x: number) => (back ? L - x : x) - FOLD;
  const cover: W3 = (x, y, z) => {
    const a = along(x);
    const b = z >= zt - 0.01 ? y : y1 + (zt - z);
    if (a < 2.6) return a < 0.5 || Math.abs(a - 1.8) < 0.3 ? at(C.cream, z >= zt - 0.01 ? 4 : 3) : at(C.cream, z >= zt - 0.01 ? 5 : 4);
    const side = z < zt - 0.01;
    // Ribete y orilla ondulada abajo.
    if (side) {
      const dz = z - zb;
      if (dz < 0.6 * Math.abs(Math.sin(a * 0.7))) return null;
      if (dz < 1.3) return at(spec.hem, 2);
    }
    return spec.cover(a - 2.6, b, side ? -1 : 0);
  };
  // De espaldas se ve el canto doblado hacia la cabecera: solo el grosor de encima del colchón.
  boxW(s, X(FOLD, 29.6 - FOLD), y0, zb, 29.6 - FOLD, y1 - y0, zt - zb, cover, cover, back ? (x, y, z) => (z < MATT_TOP ? null : cover(x, y, z)) : null);

  // Almohadas: blancas y gorditas, con un ribete rosado de bordado.
  for (const [py0, py1] of spec.pillows) {
    const pw = 6.6;
    const px = X(3.6, pw);
    const pill: W3 = (x, y, z) => {
      const ex = Math.min(x - px, px + pw - x);
      const ey = Math.min(y - py0, py1 - y);
      if (z >= MATT_TOP + 3.3) return at(C.cream, ex < 0.7 || ey < 0.7 ? 4 : 5);
      // El ribete del lado que mira a los pies.
      if (Math.abs(x - (back ? px + 0.6 : px + pw - 0.6)) < 0.45 && z > MATT_TOP + 0.6) return at(C.rose, 3);
      return at(C.cream, z < MATT_TOP + 1 ? 3 : 4);
    };
    boxW(s, px, py0, MATT_TOP, pw, py1 - py0, 2.8, pill, pill, pill);
    boxW(s, px + 0.8, py0 + 0.8, MATT_TOP + 2.8, pw - 1.6, py1 - py0 - 1.6, 0.8, pill, pill, pill);
  }
  return s.sprite(4);
}

const camaDoble = (v: Variant) =>
  bed(
    {
      D: 32,
      cover: quiltAt,
      hem: C.rug,
      pillows: [
        [3.4, 15],
        [17, 28.6],
      ],
      wood: C.woodDark,
    },
    v,
  );

const camaSencilla = (v: Variant) => bed({ D: 16, cover: stripesAt, hem: C.mustard, pillows: [[3.2, 12.8]], wood: C.wood }, v);

// ---------- Armario ----------

/**
 * Ropero alto de dos puertas: una con el espejo ovalado y la otra con tableros tallados, manijas y
 * bocallave de bronce, el cajón de abajo, patas de bola y la cornisa con su copete. Encima, una maleta de
 * cuero con correas y una sombrerera a rayas.
 */
function armario(): Sprite {
  const wd = C.wood;
  const s = scene(1, 2, 64);
  s.shadow(0.5, 1, 12, 30, 0.3);
  const X0 = 0.5;
  const X1 = 11;
  const Y0 = 1;
  const Y1 = 31;
  // Patas de bola.
  for (const y of [Y0 + 0.8, Y1 - 2.8]) {
    sphere(s, X1 - 1.5, y + 1, 1.3, 1.3, (l) => at(C.woodDark, tono(l) + 1));
    sphere(s, X0 + 1.5, y + 1, 1.3, 1.3, (l) => at(C.woodDark, tono(l) + 1));
  }
  const DW = (Y1 - Y0) / 2;
  const front: W3 = (_x, y, z) => {
    const u = y - Y0;
    if (z < 3.8) return at(C.woodDark, 3);
    // Cajón de abajo con dos tiradores.
    if (z < 10) {
      if (z < 4.4 || z > 9.4 || u < 0.8 || u > Y1 - Y0 - 0.8) return at(wd, 1);
      if (Math.abs(z - 7) < 0.8 && (Math.abs(u - 7.5) < 1.4 || Math.abs(u - 22.5) < 1.4)) return at(C.gold, Math.abs(z - 7) < 0.3 ? 5 : 3);
      return at(wd, z > 8.6 ? 4 : 3);
    }
    if (z > 44) return at(wd, z > 45 ? 4 : 2);
    if (z < 10.6) return at(wd, 2);
    const door = Math.floor(u / DW);
    const du = u - door * DW;
    // Marco de cada puerta y la junta del medio.
    if (du < 0.7 || du > DW - 0.7) return at(wd, 1);
    if (du < 1.8 || z > 42.8) return at(wd, 4);
    if (du > DW - 1.8 || z < 11.8) return at(wd, 2);
    // Manijas y bocallave junto a la junta.
    const nearJoint = door === 0 ? DW - du : du;
    if (nearJoint < 3.2 && nearJoint > 1.8 && Math.abs(z - 27) < 1.6) return at(C.gold, z > 27 ? 5 : 3);
    if (door === 0 && nearJoint < 3.2 && nearJoint > 2 && Math.abs(z - 23.5) < 0.9) return at(C.gold, 2);
    const cu = DW / 2;
    if (door === 1) {
      // El espejo ovalado, con moldura dorada.
      const e = Math.hypot((du - cu) / 4.4, (z - 27.5) / 12.5);
      if (e < 1) {
        if (e > 0.88) return at(C.gold, e > 0.95 ? 2 : 4);
        const glint = Math.abs(du - cu + (z - 27.5) * 0.45 - 1.2) < 0.9 || Math.abs(du - cu + (z - 27.5) * 0.45 + 1.8) < 0.55;
        return glint ? at(C.sky, 4) : mix(at(C.sky, z > 30 ? 3 : 2), at(C.wood, 3), 0.18);
      }
      return at(wd, 3);
    }
    // Tableros tallados: uno alto con arco y uno chico abajo.
    const inPanel = (z0: number, z1: number, arch: boolean) => {
      const top = arch ? z1 - 2.2 * (1 - ((du - cu) / (cu - 2.4)) ** 2) : z1;
      return du > 2.4 && du < DW - 2.4 && z > z0 && z < top;
    };
    for (const [z0, z1, arch] of [
      [13, 20, false],
      [22, 41.5, true],
    ] as const) {
      if (inPanel(z0, z1, arch)) {
        if (!inPanel(z0 + 0.7, z1 - 0.7, arch)) return at(wd, 1);
        // Rombo tallado en el tablero alto.
        if (arch && Math.abs(du - cu) * 1.6 + Math.abs(z - 31) < 5 && Math.abs(du - cu) * 1.6 + Math.abs(z - 31) > 3.8) return at(wd, 2);
        return at(wd, 4);
      }
    }
    return at(wd, 3);
  };
  const side: W3 = (x, _y, z) => {
    if (z < 3.8) return at(C.woodDark, 3);
    if (x < X0 + 1.2 || x > X1 - 1.2 || z < 5 || z > 44) return at(wd, 3);
    if (x < X0 + 1.9 || z > 43.2) return at(wd, 1);
    return at(wd, 2);
  };
  boxW(s, X0, Y0, 2.6, X1 - X0, Y1 - Y0, 44.4 - 2.6, () => at(wd, 4), side, front);
  // Cornisa con su copete en arco.
  block(s, X0 - 0.6, Y0 - 0.6, 47, X1 - X0 + 1.2, Y1 - Y0 + 1.2, 1.4, wd, 4);
  boxW(s, X0 - 0.2, Y0 - 0.2, 45, X1 - X0 + 0.4, Y1 - Y0 + 0.4, 2, () => at(wd, 4), () => at(wd, 2), (_x, _y, z) => at(wd, z > 46 ? 2 : 3));
  const crest = (y: number) => 2.6 * Math.sin((Math.PI * (y - Y0 - 6)) / (Y1 - Y0 - 12));
  for (let y = Y0 + 6; y < Y1 - 6; y += 0.5) {
    const h = crest(y + 0.25);
    boxW(s, X1 - 1.6, y, 48.4, 1.2, 0.5, h + 0.4, () => at(wd, 5), () => at(wd, 4), (_x, yy, z) => (Math.hypot(yy - (Y0 + Y1) / 2, (z - 49) * 1.3) < 1.1 ? at(C.gold, 4) : at(wd, 3)));
  }
  // Maleta de cuero con dos correas y la manija.
  const strap = (y: number) => Math.abs(y - 6.5) < 0.6 || Math.abs(y - 13) < 0.6;
  const suitcase: W3 = (x, y, z) => {
    if (strap(y)) return at(C.woodDark, z > 53.3 ? 2 : 1);
    if (z > 53.3) return at(LEATHER, x > 8.6 || y < 4.4 || y > 15.6 ? 3 : 4);
    if (Math.abs(z - 51) < 0.35) return at(LEATHER, 1);
    return at(LEATHER, x > 8.95 ? 2 : 3);
  };
  boxW(s, 1.8, 3.8, 48.4, 7.4, 12.4, 5.2, suitcase, suitcase, suitcase);
  block(s, 4.6, 8.6, 53.6, 1.6, 2.8, 0.8, C.gold, 3);
  // Sombrerera a rayas rosadas.
  s.cylinder(5.5, 23.5, 48.4, 3.8, 4.4, (a, v, luz) => (v > 3.8 ? at(C.rose, 2) : at(Math.floor(a * 5) % 2 ? C.rose : C.cream, (luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2) + (Math.floor(a * 5) % 2 ? 0 : 1))));
  s.disc(5.5, 23.5, 52.8, 3.8, (dx, dy) => (Math.hypot(dx, dy) > 3.2 ? at(C.rose, 3) : at(C.rose, 4)));
  return s.sprite(4);
}

// ---------- Tocador ----------

/**
 * Cómoda baja de tres cajones con el espejo ovalado parado atrás; encima, dos frascos de perfume, un
 * joyero con cantos dorados y un florerito con flores.
 */
function tocador(): Sprite {
  const wd = C.wood;
  const s = scene(1, 1, 40);
  s.shadow(1, 1.5, 11, 13, 0.3);
  for (const [x, y] of [
    [2, 2.5],
    [10, 2.5],
    [2, 13.5],
    [10, 13.5],
  ] as const)
    sphere(s, x, y, 1, 1, (l) => at(C.woodDark, tono(l) + 1));
  const TOPZ = 14.6;
  // Tres cajones: líneas de un píxel entero (más finas, en la cara inclinada se ven punteadas).
  const ROWS = [2.8, 6.6, 10.4, TOPZ - 1];
  const front: W3 = (_x, y, z) => {
    const u = y - 1.5;
    if (z > TOPZ - 1) return at(wd, 4);
    if (z < 2.8) return at(wd, 2);
    const r = ROWS.findIndex((zz, i) => z >= zz && z < ROWS[i + 1]!);
    const k = z - ROWS[r]!;
    const dh = ROWS[r + 1]! - ROWS[r]!;
    if (k < 1 || u < 1 || u > 12) return at(wd, 1);
    if (Math.abs(k - 0.5 - dh / 2) < 0.8 && (Math.abs(u - 3.5) < 1.1 || Math.abs(u - 9.5) < 1.1)) return at(C.gold, 4);
    return at(wd, k > dh - 1 ? 4 : 3);
  };
  boxW(s, 1, 1.5, 1.8, 10, 13, TOPZ - 1.8, () => at(wd, 4), (_x, _y, z) => at(wd, z > TOPZ - 1 ? 3 : 2), front);
  // Tapa que sobresale un poco.
  boxW(s, 0.6, 1, TOPZ - 0.3, 11, 14, 1, (x, y) => (x > 10.8 || y > 14.2 ? at(wd, 4) : at(wd, noise(Math.floor(y / 3), 1, 6) < 0.5 ? 4 : 5)), () => at(wd, 3), () => at(wd, 3));
  const Z = TOPZ + 0.7;
  // Espejo ovalado parado entre dos postes.
  for (const y of [2.6, 12.4]) block(s, 1.6, y, Z, 1.4, 1.4, 12, wd, 3);
  const cy = 8.2;
  const cz = Z + 9.5;
  s.quad([3, 3.2, Z + 1.5], [0, 1, 0], [0, 0, 1], 10, 17, (u, v) => {
    const e = Math.hypot((3.2 + u - cy) / 4.6, (Z + 1.5 + v - cz) / 7.6);
    if (e > 1) return null;
    if (e > 0.84) return at(wd, e > 0.93 ? 2 : 4);
    const dz = Z + 1.5 + v - cz;
    const du = 3.2 + u - cy;
    if (Math.abs(du + dz * 0.5 - 1.4) < 0.8 || Math.abs(du + dz * 0.5 + 1.2) < 0.5) return at(C.sky, 4);
    return mix(at(C.sky, dz > 2 ? 3 : 2), at(C.rose, 3), 0.15);
  });
  block(s, 2, cy - 1, cz + 7, 1.4, 2, 1.4, C.gold, 3);
  // Frascos de perfume (rosado y verde agua) con tapita dorada.
  s.cylinder(6.5, 3.6, Z, 1.1, 2.8, (_a, _v, luz) => at(C.rose, luz > 0.3 ? 5 : luz > -0.3 ? 4 : 3));
  sphere(s, 6.5, 3.6, Z + 3.3, 0.6, (l) => at(C.gold, tono(l) + 1));
  s.cylinder(8.6, 4.8, Z, 0.9, 3.8, (_a, _v, luz) => at(C.cyan, luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2));
  block(s, 8.2, 4.4, Z + 3.8, 0.8, 0.8, 1.3, C.gold, 3);
  // Joyero: cajita vino con canto dorado y la tapa.
  const box: W3 = (_x, _y, z) => (Math.abs(z - (Z + 1.6)) < 0.3 ? at(C.gold, 4) : at(C.curtain, 2));
  boxW(s, 6, 7.2, Z, 3.6, 3.4, 2.4, (x, y) => (Math.abs(x - 7.8) < 0.4 || Math.abs(y - 8.9) < 0.4 ? at(C.gold, 4) : at(C.curtain, 4)), box, box);
  // Florerito azul con flores.
  s.cylinder(8, 12.6, Z, 1.2, 2.6, (_a, v, luz) => (v > 2.1 ? at(C.blue, 4) : at(C.blue, luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2)));
  for (let i = 0; i < 10; i++) {
    const a = noise(i, 1, 21) * Math.PI * 2;
    const d = noise(i, 2, 21) * 1.6;
    s.plot(8 + Math.cos(a) * d, 12.6 + Math.sin(a) * d, Z + 3 + noise(i, 3, 21) * 2.2, at(C.leaf, 3 + (i % 2)));
  }
  for (const [dx, dy, dz, r] of [
    [-0.6, -0.4, 5.2, C.rug],
    [0.7, 0.3, 4.6, C.mustard],
    [0.1, 0.9, 5.6, C.rose],
  ] as const)
    sphere(s, 8 + dx, 12.6 + dy, Z + dz, 0.75, (l) => at(r, tono(l) + 1));
  return s.sprite(4);
}

// ---------- Tina ----------

/** Contorno de la tina (rectángulo redondeado): punto del borde para el ángulo t, con escala k. */
const TUB = { cx: 16, cy: 8, a: 14, b: 6.2, n: 3 };
function tubPoint(t: number, k: number): [number, number] {
  const c = Math.cos(t);
  const sn = Math.sin(t);
  const e = 2 / TUB.n;
  return [TUB.cx + TUB.a * k * Math.sign(c) * Math.abs(c) ** e, TUB.cy + TUB.b * k * Math.sign(sn) * Math.abs(sn) ** e];
}
const inTub = (x: number, y: number, k: number) => Math.abs((x - TUB.cx) / (TUB.a * k)) ** TUB.n + Math.abs((y - TUB.cy) / (TUB.b * k)) ** TUB.n <= 1;

/**
 * Tina de patas esmaltada: el cuerpo que se abre hacia arriba, el borde enrollado, agua con espuma, la
 * grifería de bronce en la cabecera, cuatro patas de garra, una toalla doblada en el borde y un patico.
 */
function tinaBano(): Sprite {
  const s = scene(2, 1, 30);
  s.shadow(3, 1.5, 26, 13, 0.25);
  const Z0 = 3.4;
  const ZR = 15;
  const prof = (z: number) => 0.84 + 0.16 * Math.sqrt(Math.max(0, (z - Z0) / (ZR - Z0)));
  // Patas de garra en bronce, con la bola abajo.
  for (const [x, y] of [
    [5.2, 4],
    [26.8, 4],
    [5.2, 12],
    [26.8, 12],
  ] as const) {
    sphere(s, x, y, 1.1, 1.1, (l) => at(C.gold, tono(l)));
    block(s, x - 0.7, y - 0.7, 1.4, 1.4, 1.4, 2.6, C.gold, 3);
    block(s, x - 1.1, y - 1.1, 3.6, 2.2, 2.2, 0.8, C.gold, 3);
  }
  // Cuerpo: paredes por anillos.
  for (let z = Z0; z < ZR; z += 0.4) {
    const k = prof(z);
    for (let t = 0; t < Math.PI * 2; t += 0.012) {
      const [x, y] = tubPoint(t, k);
      const nx = Math.cos(t);
      const ny = Math.sin(t);
      const l = luzDe(nx, ny, -0.1 + (z - Z0) * 0.02);
      s.plot(x, y, z, at(C.cream, (l > 0.35 ? 4 : l > -0.1 ? 3 : l > -0.45 ? 2 : 1) + (z < Z0 + 1 ? -1 : 0)));
    }
  }
  // Por dentro, el esmalte blanco hasta el agua.
  const ZW = 13.6;
  for (let z = ZW; z < ZR + 0.6; z += 0.4)
    for (let t = 0; t < Math.PI * 2; t += 0.014) {
      const [x, y] = tubPoint(t, 0.9);
      const l = -luzDe(Math.cos(t), Math.sin(t), 0);
      s.plot(x, y, z, at(ENAMEL, l > 0.2 ? 5 : l > -0.2 ? 4 : 3));
    }
  // Borde enrollado.
  for (let t = 0; t < Math.PI * 2; t += 0.012)
    for (let k = 0.9; k <= 1.04; k += 0.02) {
      const [x, y] = tubPoint(t, k);
      const edge = k > 1.0;
      s.plot(x, y, ZR + 0.6, at(ENAMEL, edge ? 4 : 5));
      if (edge) s.plot(x, y, ZR, at(ENAMEL, 4));
    }
  // Agua con espuma, más espumosa hacia la cabecera.
  for (let y = 0; y < 16; y += 0.4)
    for (let x = 0; x < 32; x += 0.4) {
      if (!inTub(x, y, 0.9)) continue;
      const f = smoothNoise(x, y, 3, 7) + (x < 12 ? 0.2 : 0) - (x > 16 ? 0.3 : 0);
      const ripple = Math.abs(Math.sin(x * 0.7 + y * 0.4)) < 0.12;
      s.plot(x, y, ZW, f > 0.62 ? at(C.cream, 5) : f > 0.55 ? at(WATER, 4) : ripple ? at(WATER, 4) : at(WATER, 3));
    }
  // Montoncitos de espuma.
  for (let i = 0; i < 6; i++) {
    const x = 5 + noise(i, 1, 33) * 9;
    const y = 4 + noise(i, 2, 33) * 8;
    sphere(s, x, y, ZW + 0.3, 0.8 + noise(i, 3, 33) * 0.7, (l) => (l > 0.2 ? at(ENAMEL, 5) : at(WATER, 4)));
  }
  // El patico amarillo.
  sphere(s, 20.5, 8.6, ZW + 0.9, 1.6, (l) => at(C.mustard, tono(l) + 1));
  sphere(s, 21.6, 9.2, ZW + 2.9, 1.05, (l) => at(C.mustard, tono(l) + 1));
  block(s, 22.4, 9, ZW + 2.5, 1.3, 0.8, 0.6, C.fire, 3);
  s.plot(22.2, 9.9, ZW + 3.4, at(C.night, 0));
  // Grifería de bronce en la cabecera: el tubo con el pico y las dos llaves de loza.
  block(s, 2.6, 7.4, ZR + 0.6, 1.2, 1.2, 4.6, C.gold, 3);
  for (let k = 0; k < 3.2; k += 0.3) block(s, 3 + k, 7.4, ZR + 5 - (k > 2 ? (k - 2) * 1.2 : 0), 0.6, 1.2, 1, C.gold, 3);
  for (const y of [5.4, 10.6]) {
    block(s, 2.8, y - 0.4, ZR + 0.6, 0.8, 0.8, 2, C.gold, 3);
    sphere(s, 3.2, y, ZR + 3.1, 0.8, (l) => at(ENAMEL, tono(l) + 1));
  }
  // Toalla doblada sobre el borde, del lado de la cámara (cuelga hacia afuera).
  const towel: W3 = (x, _y, z) => {
    if (z < 7.6) return Math.floor(x * 2) % 2 ? at(C.cream, 4) : null;
    if (Math.abs(z - 9.5) < 0.6 || Math.abs(z - 11) < 0.35) return at(C.cream, 5);
    return at(C.rose, z > ZR + 0.6 ? 4 : 3);
  };
  boxW(s, 20, 14.6, 7, 6, 0.9, ZR + 1.5 - 7, towel, towel, towel);
  boxW(s, 20, 12.4, ZR + 0.6, 6, 3.1, 0.9, () => at(C.rose, 4), towel, towel);
  return s.sprite(4);
}

// ---------- Comedor ----------

/** Pata torneada: base, bulbo, cuello y el taco cuadrado que recibe el faldón. */
function turnedLeg(s: Escena, cx: number, cy: number, h: number, wd: Ramp) {
  const r = (z: number) => {
    const k = z / h;
    if (k < 0.08) return 1.2;
    if (k < 0.16) return 0.8;
    if (k < 0.5) return 0.8 + 0.6 * Math.sin(((k - 0.16) / 0.34) * Math.PI);
    if (k < 0.62) return 0.75;
    return 1;
  };
  for (let z = 0; z < h * 0.78; z += 0.5) s.cylinder(cx, cy, z, r(z), 0.55, (_a, _v, luz) => at(wd, luz > 0.35 ? 4 : luz > -0.3 ? 3 : 2));
  block(s, cx - 1.1, cy - 1.1, h * 0.78, 2.2, 2.2, h * 0.22, wd, 3);
}

/**
 * Mesa de comedor para cuatro, de madera maciza: patas torneadas, tablones, un camino de mesa tejido
 * que cuelga por las puntas, el frutero de barro en el centro y dos individuales de fique con su plato.
 * (Las sillas van aparte.)
 */
function mesaComedor(): Sprite {
  const wd = C.wood;
  const s = scene(2, 2, 34);
  s.shadow(2, 2, 28, 28, 0.3);
  const TZ = 12.6;
  const TOP = 15;
  for (const [x, y] of [
    [4.5, 4.5],
    [27.5, 4.5],
    [4.5, 27.5],
    [27.5, 27.5],
  ] as const)
    turnedLeg(s, x, y, TZ, wd);
  // Faldón.
  block(s, 3.8, 3.8, TZ - 1.6, 24.4, 24.4, 1.6, wd, 2);
  // Tapa de tablones.
  const plank: W3 = (x, y) => {
    if (x < 2.6 || x > 29.4 || y < 2.6 || y > 29.4) return at(wd, 4);
    const k = Math.floor((y - 2) / 7);
    if (Math.abs(((y - 2) % 7) - 7) < 0.35 || (y - 2) % 7 < 0.3) return at(wd, 2);
    const grain = Math.abs(Math.sin(x * 0.4 + k * 3 + smoothNoise(x, y, 4, k) * 3)) < 0.1;
    return at(wd, grain ? 3 : noise(k, 1, 13) < 0.5 ? 4 : 5);
  };
  boxW(s, 2, 2, TZ, 28, 28, TOP - TZ, plank, (_x, _y, z) => at(wd, z > TOP - 0.8 ? 4 : 3), (_x, _y, z) => at(wd, z > TOP - 0.8 ? 3 : 2));
  // Camino de mesa tejido (rombos de colores), colgando por las puntas con flecos.
  const RW = [C.rug, C.mustard, C.sage, C.fabric];
  const weave = (a: number, b: number, sh: number): RGBA => {
    const band = Math.floor(a / 4);
    const r = RW[((band % RW.length) + RW.length) % RW.length]!;
    const la = a - band * 4;
    if (la < 0.5) return at(C.cream, 4 + sh);
    if (Math.abs(la - 2.2) + Math.abs(b - 4) * 0.55 < 1.4) return at(C.cream, 5 + sh);
    if (b < 0.7 || b > 7.3) return at(r, 2 + sh);
    return at(r, 3 + sh);
  };
  const runner: W3 = (x, y, z) => {
    const b = y - 12;
    if (z > TOP) return weave(x, b, 0);
    // Lo que cuelga por el frente (+x): flecos abajo.
    const a = 30.6 + (TOP + 0.3 - z);
    if (z < 10.6) return Math.floor(y * 2) % 2 ? at(C.cream, 4) : null;
    return weave(a, b, -1);
  };
  boxW(s, 1.4, 12, TOP, 29.2, 8, 0.3, runner, runner, runner);
  boxW(s, 30.6, 12, 9.4, 0.4, 8, TOP + 0.3 - 9.4, null, runner, runner);
  // Individuales de fique (redondos, en espiral) con su plato de loza de borde azul y los cubiertos.
  for (const py of [6.4, 25.6]) {
    s.disc(16, py, TOP + 0.3, 4, (dx, dy) => at(C.cork, Math.floor(Math.hypot(dx, dy) * 1.4) % 2 ? 3 : 4));
    s.disc(16, py, TOP + 0.6, 2.8, (dx, dy) => {
      const d = Math.hypot(dx, dy);
      return d > 2.3 ? at(C.blue, 3) : d > 1.9 ? at(ENAMEL, 4) : at(ENAMEL, 5);
    });
    block(s, 11.2, py - 0.3, TOP + 0.3, 3, 0.6, 0.3, C.gold, 4);
    block(s, 19.8, py - 0.3, TOP + 0.3, 3, 0.6, 0.3, C.gold, 4);
  }
  // Frutero de barro con dos naranjas, una manzana roja, una verde, el banano encima y uvas que se asoman.
  s.cylinder(16, 16, TOP + 0.3, 2.4, 0.8, (_a, _v, luz) => at(C.terracotta, luz > 0 ? 3 : 2));
  s.cylinder(16, 16, TOP + 1.1, 4.4, 1.8, (_a, v, luz) => (v > 1.3 ? at(C.terracotta, 4) : at(C.terracotta, luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2)));
  s.disc(16, 16, TOP + 2.9, 4, () => at(C.terracotta, 1));
  for (const [x, y, z, r, rr] of [
    [14.6, 14.8, 3.8, 1.8, C.fire],
    [17.6, 14.6, 3.8, 1.8, C.fire],
    [14.4, 17.6, 3.9, 1.7, C.rug],
    [17.4, 17.4, 3.8, 1.7, C.leaf],
  ] as const)
    sphere(s, x, y, TOP + z, r, (l) => at(rr, tono(l) + 1));
  for (const [x, y, z] of [
    [19.4, 17.6, 3.2],
    [19.4, 18.6, 2.6],
    [20.2, 18, 2.4],
    [18.8, 19.2, 2.2],
    [19.8, 19, 1.6],
  ] as const)
    sphere(s, x, y, TOP + z, 0.75, (l) => at(C.violet, tono(l) + 1));
  // El banano, curvito encima.
  for (let k = 0; k < 5; k += 0.25) sphere(s, 13.6 + k, 16.4 + Math.sin(k * 0.6) * 0.9, TOP + 5.6 + Math.sin((k / 5) * Math.PI) * 0.9, 0.75, (l) => at(C.gold, tono(l) + 1));
  return s.sprite(4);
}

// ---------- Lámpara colgada ----------

/**
 * Campana de lata esmaltada (verde, con el ala blanca y el remate de bronce), con la base del ala en Z0.
 * `k` la agranda o achica. La usan la lámpara del comedor y la del billar.
 */
function bell(s: Escena, cx: number, cy: number, Z0: number, k: number) {
  const ZT = Z0 + 6.5 * k;
  const rad = (t: number) => k * (t < 0.1 ? 6.2 - t * 6 : 1.4 + 4.2 * Math.sqrt(Math.max(0, 1 - ((t - 0.1) / 0.9) ** 1.6)));
  for (let z = Z0; z < ZT; z += 0.35) {
    const t = (z - Z0) / (ZT - Z0);
    s.cylinder(cx, cy, z, rad(t), 0.4, (_a, _v, luz) => {
      if (t < 0.1) return at(C.cream, luz > 0 ? 5 : 4);
      const l = luz + t * 0.6;
      // Un brillo vertical de esmalte del lado de la luz.
      if (luz > 0.55 && luz < 0.75 && t > 0.2) return at(C.green, 5);
      return at(C.green, l > 0.6 ? 4 : l > 0.1 ? 3 : l > -0.35 ? 2 : 1);
    });
  }
  s.cylinder(cx, cy, ZT - 0.2, 1.3 * k, 1.6, (_a, _v, luz) => at(C.gold, luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2));
  s.disc(cx, cy, ZT + 1.4, 1.3 * k, () => at(C.gold, 4));
}

/** Cadena de eslabones de bronce, de z0 a z1 (sin contorno: es delgadita). */
function chain(s: Escena, cx: number, cy: number, z0: number, z1: number) {
  for (let z = z0; z < z1; z += 0.35) {
    const link = Math.floor((z - z0) / 1.4) % 2;
    const ph = (z - z0) % 1.4;
    if (ph > 1.2) continue;
    if (link) s.plot(cx, cy, z, at(C.gold, 3));
    else {
      s.plot(cx - 0.35, cy + 0.35, z, at(C.gold, ph < 0.3 || ph > 0.9 ? 4 : 2));
      s.plot(cx + 0.35, cy - 0.35, z, at(C.gold, ph < 0.3 || ph > 0.9 ? 4 : 2));
    }
  }
}

/**
 * Lámpara de lata esmaltada (verde por fuera, con el borde blanco) en forma de campana, colgada de una
 * cadena de bronce con la roseta de madera del techo arriba. Va en el aire: nada en el piso.
 */
function lamparaColgante(): Sprite {
  const s = scene(1, 1, 70);
  const cx = 8;
  const cy = 8;
  const Z0 = 41;
  const ZT = Z0 + 6.5;
  bell(s, cx, cy, Z0, 1);
  // Cadena de eslabones.
  s.borde = false;
  chain(s, cx, cy, ZT + 1.4, 62);
  s.borde = true;
  // Roseta del techo.
  s.cylinder(cx, cy, 62, 2, 1.2, (_a, _v, luz) => at(C.woodDark, luz > 0 ? 4 : 3));
  s.disc(cx, cy, 63.2, 2, () => at(C.woodDark, 4));
  return s.sprite(4);
}

// ---------- Baúl ----------

/**
 * Baúl de madera oscura con tapa curva: tablas, dos flejes y las esquineras de bronce, la chapa al frente
 * y una manta de lana verde a rayas doblada encima, que cuelga por delante con flecos.
 */
function baul(): Sprite {
  const wd = C.woodDark;
  const s = scene(1, 1, 30);
  s.shadow(1.5, 1, 12, 14, 0.3);
  const X0 = 2;
  const X1 = 12.6;
  const Y0 = 1.4;
  const Y1 = 14.6;
  const ZB = 9.4;
  const lid = (x: number) => ZB + 3.4 * Math.sqrt(Math.max(0, 1 - ((x - (X0 + X1) / 2) / ((X1 - X0) / 2)) ** 2));
  const strapY = (y: number) => Math.abs(y - 4.2) < 0.75 || Math.abs(y - 11.8) < 0.75;
  // Tablas horizontales: la junta de un píxel entero.
  const planks = (z: number, k: number) => at(wd, (z - 0.4) % 3 < 1 ? k - 1 : k);
  // Esquinera: un triangulito de bronce en cada esquina de la cara.
  const corner = (a: number, b: number, w: number, h: number) => Math.min(a, w - a) + Math.min(b, h - b) < 2.6;
  const front: W3 = (_x, y, z) => {
    const u = y - Y0;
    if (z < 1.4) return at(wd, 1);
    if (corner(u, z - 0.4, Y1 - Y0, ZB - 0.4)) return at(C.gold, 4);
    if (strapY(y)) return at(C.gold, 3);
    // Chapa con su bocallave.
    if (Math.abs(y - 8) < 1.6 && z > ZB - 4.2 && z < ZB) return Math.abs(y - 8) < 0.5 && Math.abs(z - (ZB - 2.4)) < 0.9 ? at(C.night, 1) : at(C.gold, z > ZB - 1.2 ? 5 : 4);
    return planks(z, 3);
  };
  const side: W3 = (x, _y, z) => {
    if (z < 1.4) return at(wd, 1);
    if (corner(x - X0, z - 0.4, X1 - X0, ZB - 0.4)) return at(C.gold, 4);
    // Agarradera de bronce.
    if (Math.abs(x - (X0 + X1) / 2) < 1.6 && Math.abs(z - 6.4) < 0.6) return at(C.gold, 3);
    return planks(z, 4);
  };
  boxW(s, X0, Y0, 0.4, X1 - X0, Y1 - Y0, ZB - 0.4, () => at(wd, 4), side, front);
  // Tapa curva, por columnas: tablas a lo largo y los flejes cruzando.
  const lidTop: W3 = (_x, y) => (strapY(y) ? at(C.gold, 4) : (y - Y0) % 3.3 < 1 ? at(wd, 3) : at(wd, 5));
  const lidEnd: W3 = (x, _y, z) => (z < ZB + 1 ? at(C.gold, 3) : x < X0 + 1.2 || x > X1 - 1.2 ? at(C.gold, 4) : at(wd, 4));
  for (let x = X0; x < X1; x += 0.4) {
    const h = lid(x + 0.2);
    boxW(s, x, Y0, ZB, 0.4, Y1 - Y0, h - ZB, lidTop, lidEnd, (_x, y) => (strapY(y) ? at(C.gold, 3) : (y - Y0) % 3.3 < 1 ? at(wd, 2) : at(wd, 4)));
  }
  // La manta doblada (verde salvia con rayas crema y vino), del lado de la cámara.
  const MY0 = 9.8;
  const MY1 = 14.2;
  const wool = (a: number, sh: number): RGBA => {
    const k = ((a % 6) + 6) % 6;
    if (k < 1) return at(C.cream, 4 + sh);
    if (k > 1.6 && k < 2.6) return at(C.rug, 3 + sh);
    return at(C.sage, 3 + sh);
  };
  for (let x = X0 + 1.4; x < X1; x += 0.4) {
    const h = lid(x + 0.2) + 1;
    boxW(s, x, MY0, h - 1, 0.4, MY1 - MY0, 1, (xx) => wool(xx, 1), (xx) => wool(xx, 0), (xx) => wool(xx, 0));
  }
  const drape: W3 = (_x, y, z) => (z < 4.4 ? (Math.floor(y * 2) % 2 ? at(C.cream, 4) : null) : wool(X1 + (lid(X1 - 0.1) - z), 0));
  boxW(s, X1, MY0, 3.4, 1, MY1 - MY0, lid(X1 - 0.1) + 1 - 3.4, (xx) => wool(xx, 1), drape, drape);
  return s.sprite(4);
}

// ---------- Para pasarla bien ----------

/** Botella: cuerpo, hombro, cuello y tapa; con etiqueta si se pide. */
function bottle(
  s: Escena,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  glass: Ramp,
  opts: { label?: [number, number, Ramp]; cap?: Ramp; neck?: number } = {},
) {
  const tone3 = (luz: number) => (luz > 0.35 ? 4 : luz > -0.3 ? 3 : 2);
  s.cylinder(x, y, z, r, h, (_a, v, luz) => {
    const lb = opts.label;
    if (lb && v > lb[0] && v < lb[1]) return at(lb[2], tone3(luz));
    if (luz > 0.55) return at(glass, 5);
    return at(glass, tone3(luz));
  });
  s.disc(x, y, z + h, r * 0.8, () => at(glass, 3));
  const neck = opts.neck ?? h * 0.45;
  s.cylinder(x, y, z + h, r * 0.42, neck, (_a, _v, luz) => at(glass, tone3(luz)));
  s.cylinder(x, y, z + h + neck, r * 0.5, 0.8, (_a, _v, luz) => at(opts.cap ?? C.gold, tone3(luz)));
}

/** Vidrio de las botellas. */
const GLASS_CLEAR: Ramp = ramp("#5f8a94", "#86b2b4", "#b4d8d2", "#d8eee6", "#f3fbf6", "#ffffff");
const GLASS_AMBER: Ramp = ramp("#3a1a0c", "#5c2a10", "#843f14", "#a95a1c", "#cf8a3a", "#f0c070");
const GLASS_GREEN: Ramp = ramp("#173222", "#24502f", "#33703f", "#4c9152", "#79b874", "#b5dfa0");

/**
 * Barra de la casa (1x3), un bar casero paisa: frente de tableros con machimbre, tapa de madera oscura
 * pulida que sobresale, la barra de bronce para apoyar el pie y encima la jarra de barro, copitas, el
 * aguardiente, el ron, unas cervezas, un platico de limones y el farolito (la luz del catálogo).
 */
function barraCasa(): Sprite {
  const wd = C.wood;
  const s = scene(1, 3, 40);
  s.shadow(1, 0.5, 14, 47, 0.3);
  const X0 = 2;
  const X1 = 12.4;
  const Y0 = 1;
  const Y1 = 47;
  const TOP = 17;
  const P = 9.2;
  const front: W3 = (_x, y, z) => {
    if (z < 1.6) return at(C.woodDark, 2);
    if (z > TOP - 2.4) return at(C.woodDark, z > TOP - 1.4 ? 2 : 3);
    const pu = (y - Y0) % P;
    if (pu < 1.2 || z < 3) return at(C.woodDark, 3);
    // Machimbre: tablitas verticales.
    return at(wd, (pu - 1.2) % 2.6 < 1 ? 2 : 3);
  };
  const side: W3 = (x, _y, z) => {
    if (z < 1.6) return at(C.woodDark, 2);
    if (x > X1 - 1.2 || x < X0 + 1 || z < 3 || z > TOP - 2.4) return at(C.woodDark, 4);
    return at(wd, (x - X0) % 2.6 < 1 ? 3 : 4);
  };
  boxW(s, X0, Y0, 0.4, X1 - X0, Y1 - Y0, TOP - 1.4 - 0.4, () => at(wd, 4), side, front);
  // Tapa pulida, con brillos.
  const polished: W3 = (x, y) => {
    if (x > X1 + 0.8 || y < Y0 - 0.2 || y > Y1 + 0.2) return at(C.woodDark, 4);
    if (Math.abs(((x + y * 0.5) % 11) - 5.5) < 0.7) return at(C.woodDark, 5);
    return at(C.woodDark, noise(Math.floor(y / 4), 1, 17) < 0.5 ? 4 : 3);
  };
  boxW(s, X0 - 0.8, Y0 - 0.8, TOP - 1.4, X1 - X0 + 2.6, Y1 - Y0 + 1.6, 1.6, polished, () => at(C.woodDark, 3), () => at(C.woodDark, 2));
  // Barra de bronce para el pie, sobre tres soportes.
  for (const y of [Y0 + 2, (Y0 + Y1) / 2, Y1 - 3]) block(s, X1, y, 2.6, 1.8, 1, 1, C.gold, 3);
  block(s, X1 + 1.6, Y0 + 1.4, 2.4, 1.2, Y1 - Y0 - 2.8, 1.2, C.gold, 3);
  const Z = TOP + 0.2;
  // Jarra de barro con su asa.
  s.cylinder(5, 5, Z, 2, 4.6, (_a, v, luz) => (Math.abs(v - 3.2) < 0.5 ? at(C.cream, 4) : at(C.terracotta, luz > 0.35 ? 4 : luz > -0.3 ? 3 : 2)));
  s.disc(5, 5, Z + 4.6, 1.7, (dx, dy) => (Math.hypot(dx, dy) > 1.2 ? at(C.terracotta, 4) : at(C.mustard, 4)));
  for (let a = 0; a <= Math.PI; a += 0.2) s.plot(5, 7 + Math.sin(a) * 1.4, Z + 1.2 + (1 - Math.cos(a)) * 1.5, at(C.terracotta, 3));
  // Copitas de aguardiente.
  for (const [x, y] of [
    [9, 4.4],
    [9.6, 7],
    [8.4, 9.4],
  ] as const) {
    s.cylinder(x, y, Z, 0.8, 1.8, (_a, v, luz) => (v < 1 ? at(GLASS_CLEAR, 3) : at(GLASS_CLEAR, luz > 0 ? 5 : 4)));
    s.disc(x, y, Z + 1.8, 0.7, () => at(GLASS_CLEAR, 4));
  }
  // El aguardiente (vidrio claro, etiqueta azul y tapa roja) y el ron (ámbar, etiqueta crema).
  bottle(s, 4.6, 13, Z, 1.5, 6, GLASS_CLEAR, { label: [2, 4.4, C.fabric], cap: C.rug });
  bottle(s, 5.2, 17, Z, 1.7, 6.4, GLASS_AMBER, { label: [2.2, 4.6, C.cream], cap: C.gold });
  // Farolito de bronce con su vela (la luz de la barra).
  block(s, 3.6, 22.6, Z, 2.8, 2.8, 0.8, C.gold, 3);
  s.cylinder(5, 24, Z + 0.8, 1.2, 4.6, (_a, v, luz) => (luz > 0.5 ? at(C.white, 4) : at(C.gold, v < 2.6 ? 5 : 4)));
  for (const [dx, dy] of [
    [-1.3, -1.3],
    [1.3, -1.3],
    [-1.3, 1.3],
    [1.3, 1.3],
  ] as const)
    block(s, 5 + dx - 0.3, 24 + dy - 0.3, Z + 0.8, 0.6, 0.6, 4.6, C.gold, 2);
  block(s, 3.4, 22.4, Z + 5.4, 3.2, 3.2, 0.8, C.gold, 3);
  block(s, 4.6, 23.6, Z + 6.2, 0.8, 0.8, 1.2, C.gold, 4);
  // Cuatro cervezas.
  for (const [x, y] of [
    [4.4, 29],
    [6.6, 30.4],
    [4.4, 31.8],
    [8.8, 29.6],
  ] as const)
    bottle(s, x, y, Z, 0.95, 3.6, GLASS_AMBER, { label: [1, 2.4, C.mustard], cap: C.gold, neck: 2 });
  // Platico de limones.
  s.cylinder(5.6, 38, Z, 2.6, 0.7, (_a, _v, luz) => at(ENAMEL, luz > 0 ? 4 : 3));
  for (const [dx, dy] of [
    [-0.8, -0.6],
    [0.9, -0.3],
    [0, 0.9],
  ] as const)
    sphere(s, 5.6 + dx, 38 + dy, Z + 1.4, 0.95, (l) => at(C.leaf, tono(l) + 1));
  // Una botella de vino verde al final.
  bottle(s, 5, 43.4, Z, 1.4, 6, GLASS_GREEN, { label: [1.8, 4, C.cream], cap: C.curtain });
  return s.sprite(4);
}

/**
 * Equipo de sonido de mueble (1x2): dos bafles altos de madera con el woofer y el tweeter, y en el medio
 * el mueble con discos de acetato, la casetera, el amplificador con los vúmetros prendidos y el
 * tocadiscos con un disco puesto.
 */
function equipoSonido(): Sprite {
  const wd = C.wood;
  const s = scene(1, 2, 40);
  s.shadow(1, 0.5, 12, 31, 0.3);
  // Bafles.
  for (const [y0, y1] of [
    [1, 9.4],
    [22.6, 31],
  ] as const) {
    const cyy = (y0 + y1) / 2;
    const H = 20;
    const face: W3 = (_x, y, z) => {
      if (z < 1.4) return at(C.woodDark, 2);
      if (y < y0 + 1 || y > y1 - 1 || z > H - 1) return at(C.woodDark, 4);
      if (z < 2.4) return at(C.woodDark, 2);
      // Woofer abajo y tweeter arriba, sobre la tela tejida.
      const dw = Math.hypot(y - cyy, z - 8);
      if (dw < 3.6) return dw < 1.1 ? at(C.cream, 4) : dw > 3 ? at(C.gold, 3) : at(C.night, dw < 2 ? 2 : 1);
      const dt = Math.hypot(y - cyy, z - 14.6);
      if (dt < 1.9) return dt < 0.8 ? at(C.cream, 5) : dt > 1.3 ? at(C.gold, 3) : at(C.night, 1);
      return at(C.cork, (Math.floor(y * 2) + Math.floor(z * 2)) % 2 ? 2 : 3);
    };
    boxW(s, 2.6, y0, 0.4, 9, y1 - y0, H - 0.4, () => at(C.woodDark, 5), (x, _y, z) => (z < 1.4 ? at(C.woodDark, 2) : at(C.woodDark, noise(Math.floor(x / 3), Math.floor(z / 6), 4) < 0.4 ? 3 : 4)), face);
  }
  // Mueble del medio: abajo los discos, arriba la casetera.
  const Y0 = 9.6;
  const Y1 = 22.4;
  const CZ = 12;
  const cab: W3 = (_x, y, z) => {
    if (z < 1.4 || y < Y0 + 0.8 || y > Y1 - 0.8 || z > CZ - 0.8) return at(wd, z > CZ - 0.8 ? 4 : 2);
    if (z < 7.4) {
      // Lomos de los discos, de colores.
      if (z > 6.6) return at(C.woodDark, 1);
      const k = Math.floor((y - Y0) / 0.9);
      const r = [C.rug, C.mustard, C.fabric, C.cream, C.green, C.curtain, C.violet][k % 7]!;
      return at(r, noise(k, 1, 5) < 0.5 ? 3 : 2);
    }
    if (z < 8.2) return at(wd, 3);
    // Casetera: el frente dorado con la ventanita del casete y dos teclas.
    if (Math.abs(y - 16) < 3 && z > 8.8 && z < 11) {
      if (Math.abs(y - 16) < 2.2 && z > 9.4 && z < 10.6) return Math.abs(Math.abs(y - 16) - 1.1) < 0.5 ? at(C.cream, 5) : at(C.night, 1);
      return at(C.gold, 3);
    }
    if (z < 9.6 && z > 8.6 && (Math.abs(y - 12.4) < 0.6 || Math.abs(y - 19.6) < 0.6)) return at(C.rug, 4);
    return at(C.gold, 2);
  };
  boxW(s, 2.4, Y0, 0.4, 9.2, Y1 - Y0, CZ - 0.4, () => at(wd, 4), (_x, _y, z) => at(wd, z > CZ - 0.8 ? 4 : 3), cab);
  // Amplificador con los vúmetros encendidos y las perillas.
  const amp: W3 = (_x, y, z) => {
    if (z > CZ + 3) return at(wd, 4);
    for (const vy of [13.6, 18.4]) {
      if (Math.abs(y - vy) < 1.9 && z > CZ + 0.9 && z < CZ + 2.6) {
        // La aguja, inclinada (está sonando).
        if (Math.abs(y - vy - (z - CZ - 0.9) * 0.6 + 0.4) < 0.45) return at(C.rug, 2);
        return at(C.gold, z > CZ + 2 ? 5 : 4);
      }
    }
    if (z < CZ + 0.8 && Math.abs(((y - Y0) % 2.2) - 1.1) < 0.6) return at(C.cream, 4);
    if (Math.abs(y - 16) < 0.6 && Math.abs(z - CZ - 1.7) < 0.6) return at(C.leaf, 5);
    return at(C.woodDark, 2);
  };
  boxW(s, 3, Y0 + 0.4, CZ, 8.4, Y1 - Y0 - 0.8, 3.6, () => at(wd, 4), (_x, _y, z) => at(wd, z > CZ + 3 ? 4 : 3), amp);
  // Tocadiscos: base de madera, el plato con el disco y el brazo.
  const TZ = CZ + 3.6;
  block(s, 3.2, Y0 + 0.6, TZ, 8, Y1 - Y0 - 1.2, 1.2, wd, 3);
  s.disc(7, 15, TZ + 1.4, 3.6, (dx, dy) => {
    const d = Math.hypot(dx, dy);
    if (d < 0.5) return at(C.gold, 5);
    if (d < 1.4) return at(C.rug, 4);
    if (Math.abs(Math.atan2(dy, dx) - 2.4) < 0.25 && d > 1.8) return at(C.navy, 4);
    return at(C.navy, Math.floor(d * 2) % 2 ? 1 : 0);
  });
  block(s, 9.6, 19.4, TZ + 1.2, 1.2, 1.2, 1.4, C.gold, 3);
  for (let k = 0; k < 4; k += 0.3) block(s, 10 - k * 0.55, 19.6 - k * 0.6, TZ + 2.4, 0.5, 0.5, 0.5, C.gold, 4);
  return s.sprite(4);
}

/**
 * Bola de discoteca colgada del techo con su cadena: espejitos en retícula que reflejan colores y unos
 * destellos. Va en el aire: nada en el piso.
 */
function bolaDisco(): Sprite {
  const s = scene(1, 1, 70);
  const cx = 8;
  const cy = 8;
  const cz = 50;
  const R = 5.4;
  // Reflejos de colores: lo que la bola le devuelve a la fiesta.
  const TINTS: RGBA[] = [at(C.neon, 4), at(C.cyan, 4), at(C.mustard, 4), at(C.violet, 5)];
  const MIRROR: RGBA[] = [at(C.navy, 3), at(C.navy, 5), at(C.blue, 3), at(C.blue, 4), at(C.sky, 3), at(C.sky, 4), at(C.white, 4)];
  sphere(s, cx, cy, cz, R, (l, nx, ny, nz) => {
    const lat = Math.asin(Math.max(-1, Math.min(1, nz)));
    const lon = Math.atan2(ny, nx);
    const row = Math.floor(lat / 0.28);
    const ring = Math.max(1, Math.floor(Math.cos(lat) * 24));
    const fl = ((lon + Math.PI) / (Math.PI * 2)) * ring;
    const col = Math.floor(fl);
    // Las juntas entre espejitos, apenas.
    if (lat / 0.28 - row < 0.12 || fl - col < 0.12) return at(C.navy, 2);
    const n = noise(col, row, 61);
    if (n > 0.9) return TINTS[Math.floor(noise(col, row, 63) * TINTS.length)]!;
    // Cada espejito con su brillo: la luz general más un poco de azar.
    const k = Math.round((l + 1) * 2.2 + (n - 0.5) * 4);
    return MIRROR[Math.max(0, Math.min(MIRROR.length - 1, k))]!;
  });
  // Destellos en cruz, un poquito por delante de la bola.
  s.borde = false;
  for (const [nx, ny, nz] of [
    [0.2, 0.75, 0.6],
    [0.75, 0.3, -0.2],
    [0.35, 0.9, -0.3],
  ] as const) {
    const m = Math.hypot(nx, ny, nz);
    const px = cx + (nx / m) * R + 0.4;
    const py = cy + (ny / m) * R + 0.4;
    const pz = cz + (nz / m) * R + 0.4;
    s.plot(px, py, pz, at(C.white, 4));
    for (const k of [0.8, 1.6]) {
      const c = k > 1 ? at(C.sky, 5) : at(C.white, 4);
      s.plot(px + k / 2, py - k / 2, pz, c);
      s.plot(px - k / 2, py + k / 2, pz, c);
      s.plot(px, py, pz + k, c);
      s.plot(px, py, pz - k, c);
    }
  }
  // Remate y cadena.
  chain(s, cx, cy, cz + R + 1, 62);
  s.borde = true;
  s.cylinder(cx, cy, cz + R - 0.4, 1, 1.4, (_a, _v, luz) => at(C.gold, luz > 0 ? 4 : 3));
  s.cylinder(cx, cy, 62, 1.8, 1.2, (_a, _v, luz) => at(C.woodDark, luz > 0 ? 4 : 3));
  s.disc(cx, cy, 63.2, 1.8, () => at(C.woodDark, 4));
  return s.sprite(4);
}

/**
 * El juego de la rana: el mueble de madera con la tapa llena de huecos con aro de bronce, el puentecito,
 * la rana dorada con la boca abierta y, al frente, los cajoncitos numerados. Encima, tres argollas.
 */
function juegoRana(): Sprite {
  // Pintada de rojo con los filos crema (como las de las tiendas de pueblo); la tapa, de madera oscura.
  const wd = C.curtain;
  const s = scene(1, 1, 34);
  s.shadow(1.5, 1.5, 13, 13, 0.3);
  const X0 = 2;
  const X1 = 14;
  const Y0 = 2;
  const Y1 = 14;
  const TOP = 12;
  for (const [x, y] of [
    [X0 + 0.4, Y0 + 0.4],
    [X1 - 1.8, Y0 + 0.4],
    [X0 + 0.4, Y1 - 1.8],
    [X1 - 1.8, Y1 - 1.8],
  ] as const)
    block(s, x, y, 0, 1.4, 1.4, 2, C.woodDark, 3);
  // Frente: dos filas de cajoncitos, cada uno con su plaquita de número arriba.
  const front: W3 = (_x, y, z) => {
    const u = y - Y0;
    if (z > TOP - 1.2) return at(C.cream, 4);
    if (z < 3) return at(C.cream, z < 2.2 ? 3 : 4);
    const row = z > 7.2 ? 0 : 1;
    const zz = z - (row === 0 ? 7.2 : 3);
    const col = Math.min(2, Math.floor(u / 4));
    const cu = u - col * 4;
    if (cu < 1 || cu > 3.6 || zz < 0.6) return at(wd, 3);
    if (zz > 2.8) return zz < 3.8 && cu > 1.4 && cu < 3.2 ? at(C.cream, 5) : at(wd, 3);
    return at(C.woodDark, zz > 2 ? 1 : 0);
  };
  boxW(s, X0, Y0, 2, X1 - X0, Y1 - Y0, TOP - 2, () => at(wd, 4), (x, _y, z) => (z > TOP - 1.2 || z < 3 ? at(C.cream, 3) : at(wd, (x - X0) % 4 < 1 ? 2 : 3)), front);
  // Tapa con los huecos (aro de bronce) y el borde levantado.
  const holes: [number, number][] = [
    [11.2, 4.8],
    [11.2, 11.2],
    [4.6, 4.4],
    [4.6, 11.6],
  ];
  const lid: W3 = (x, y) => {
    if (x < X0 + 0.6 || x > X1 - 0.6 || y < Y0 + 0.6 || y > Y1 - 0.6) return at(C.woodDark, 5);
    for (const [hx, hy] of holes) {
      const d = Math.hypot(x - hx, y - hy);
      if (d < 1.3) return at(C.night, 1);
      if (d < 2.1) return at(C.gold, d < 1.7 ? 3 : 4);
    }
    return at(C.woodDark, 3);
  };
  boxW(s, X0 - 0.3, Y0 - 0.3, TOP, X1 - X0 + 0.6, Y1 - Y0 + 0.6, 0.8, lid, () => at(C.woodDark, 3), () => at(C.woodDark, 2));
  const Z = TOP + 0.8;
  // Puentecito de bronce.
  for (let a = 0; a <= Math.PI; a += 0.15) block(s, 8 + Math.cos(a) * 2.4, 11.6, Z + Math.sin(a) * 2.2, 0.7, 1.4, 0.7, C.gold, 3);
  // Tres argollas de bronce sobre la tapa.
  for (const [ax, ay] of [
    [12.4, 6.2],
    [9.6, 4],
    [12.6, 10],
  ] as const)
    for (let a = 0; a < Math.PI * 2; a += 0.25) s.plot(ax + Math.cos(a) * 0.9, ay + Math.sin(a) * 0.9, Z + 0.2, at(C.gold, Math.sin(a) > 0 ? 5 : 3));
  // La rana de bronce, a mano (en esferas encimadas no se lee a este tamaño): sentada mirando a +x, con
  // la boca bien abierta (ahí se tiran las argollas) y los ojos saltones.
  const FROG = [
    "..ooo.....ooo..",
    ".ohlpo...ohlpo.",
    ".olllooooolllo.",
    "olllllllllllllo",
    "ollooooooooollo",
    "olokkkkkkkkkolo",
    "olokkrrrrrkkolo",
    "ollokkkkkkkollo",
    "omllooooooollmo",
    "ommmmmmmmmmmmmo",
    "odmmdmmmmmdmmdo",
    ".ooooooooooooo.",
  ];
  pixelArt(s, FROG, { o: OUT, h: at(C.gold, 5), l: at(C.gold, 4), m: at(C.gold, 3), d: at(C.gold, 2), k: at(C.night, 0), p: at(C.night, 0), r: at(C.curtain, 3) }, 6.6, 8, Z);
  return s.sprite(4);
}

/**
 * Mesa de billar (2x3): paño verde con banda de madera oscura, seis buchacas, los diamantes de nácar,
 * patas torneadas gruesas, las bolas armadas en triángulo y la blanca, dos tacos recostados y la tiza.
 * Arriba, la lámpara de tres campanas colgada de una vara (la luz del catálogo).
 */
function mesaBillar(): Sprite {
  const wd = C.woodDark;
  const s = scene(2, 3, 70);
  s.shadow(1.5, 1.5, 29, 45, 0.3);
  const X0 = 1.5;
  const X1 = 30.5;
  const Y0 = 1.5;
  const Y1 = 46.5;
  const RZ = 14.5;
  const B = 3;
  // Patas torneadas gruesas.
  for (const [x, y] of [
    [5, 5],
    [27, 5],
    [5, 24],
    [27, 24],
    [5, 43],
    [27, 43],
  ] as const)
    for (let z = 0; z < 8; z += 0.5) {
      const k = z / 8;
      const r = k < 0.15 ? 2 : k < 0.3 ? 1.3 : 1.3 + 0.8 * Math.sin(((k - 0.3) / 0.7) * Math.PI);
      s.cylinder(x, y, z, r, 0.55, (_a, _v, luz) => at(wd, luz > 0.35 ? 4 : luz > -0.3 ? 3 : 2));
    }
  // Cajón con tableros.
  const apron: W3 = (_x, y, z) => (z < 8.8 || z > 11.6 ? at(wd, 2) : Math.abs(((y - Y0) % 7.5) - 3.75) > 3.2 ? at(wd, 2) : at(wd, 3));
  const apronL: W3 = (x, _y, z) => (z < 8.8 || z > 11.6 ? at(wd, 3) : Math.abs(((x - X0) % 7.25) - 3.6) > 3.1 ? at(wd, 3) : at(wd, 4));
  boxW(s, X0 + 1, Y0 + 1, 8, X1 - X0 - 2, Y1 - Y0 - 2, 4.4, null, apronL, apron);
  // Paño, bandas y buchacas.
  const pockets: [number, number][] = [
    [X0 + 1.4, Y0 + 1.4],
    [X1 - 1.4, Y0 + 1.4],
    [X0 + 1, (Y0 + Y1) / 2],
    [X1 - 1, (Y0 + Y1) / 2],
    [X0 + 1.4, Y1 - 1.4],
    [X1 - 1.4, Y1 - 1.4],
  ];
  const topT: W3 = (x, y) => {
    for (const [px, py] of pockets) {
      const d = Math.hypot(x - px, y - py);
      if (d < 1.5) return at(C.night, 1);
      if (d < 2.2) return at(C.gold, 3);
    }
    const inFelt = x > X0 + B && x < X1 - B && y > Y0 + B && y < Y1 - B;
    if (inFelt) {
      // La línea de cabecera y el punto de salida, apenas marcados.
      if (Math.abs(y - (Y1 - 12)) < 0.4 || Math.hypot(x - 16, y - 12) < 0.6) return at(C.green, 4);
      return at(C.green, smoothNoise(x, y, 6, 3) > 0.62 ? 3 : 2);
    }
    // Cojín verde de la banda por dentro.
    if (x > X0 + B - 0.9 && x < X1 - B + 0.9 && y > Y0 + B - 0.9 && y < Y1 - B + 0.9) return at(C.green, 1);
    // Diamantes de nácar en la banda.
    const onLong = x < X0 + B || x > X1 - B;
    const along = onLong ? y - Y0 : x - X0;
    const span = onLong ? (Y1 - Y0) / 8 : (X1 - X0) / 4;
    const mid = onLong ? Math.abs(x - (x < 16 ? X0 + B / 2 : X1 - B / 2)) : Math.abs(y - (y < 24 ? Y0 + B / 2 : Y1 - B / 2));
    if (Math.abs((along % span) - span / 2) > span / 2 - 0.6 && mid < 0.6 && along > 1 && along < (onLong ? Y1 - Y0 : X1 - X0) - 1) return at(C.cream, 5);
    return at(wd, 4);
  };
  boxW(s, X0, Y0, 12.4, X1 - X0, Y1 - Y0, RZ - 12.4, topT, (_x, _y, z) => at(wd, z > RZ - 0.8 ? 4 : 3), (_x, _y, z) => at(wd, z > RZ - 0.8 ? 3 : 2));
  // Las bolas: el triángulo (la punta hacia el centro) y la blanca.
  const BALLS: Ramp[] = [C.mustard, C.fabric, C.rug, C.violet, C.fire, C.green, C.curtain, C.navy, C.mustard, C.fabric, C.rug, C.violet, C.fire, C.green, C.curtain];
  const br = 0.95;
  let i = 0;
  for (let row = 0; row < 5; row++)
    for (let k = 0; k <= row; k++) {
      const r = BALLS[i]!;
      const stripe = i > 7;
      sphere(s, 16 + (k - row / 2) * 2, 15 - row * 1.75, RZ + br - 0.4, br, (l, _nx, _ny, nz) => (stripe && nz > 0.8 ? at(C.cream, 5) : at(r, Math.min(5, tono(l) + (r === C.navy ? 0 : 1)))));
      i++;
    }
  sphere(s, 15, 35, RZ + br - 0.4, br, (l) => at(C.cream, tono(l) + 1));
  // Tiza azul en la esquina de la banda.
  block(s, X1 - 2.6, Y1 - 6, RZ, 1.2, 1.2, 1.2, C.fabric, 3);
  // Dos tacos recostados en la banda de adelante.
  const cue = (from: [number, number, number], to: [number, number, number]) => {
    const n = 60;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const p: [number, number, number] = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
      const r = 0.55 - t * 0.2;
      const col = t < 0.32 ? at(C.curtain, 2) : t < 0.36 ? at(C.cream, 5) : t > 0.98 ? at(C.fabric, 4) : at(C.cork, 4);
      s.plot(p[0], p[1], p[2], col);
      s.plot(p[0] + r, p[1], p[2], col);
      s.plot(p[0], p[1] + r, p[2], col);
    }
  };
  cue([32.6, 27, 0], [30.8, 36, 27]);
  cue([32.4, 30.5, 0], [31, 39.6, 26]);
  // La lámpara: una vara de madera con tres campanas, colgada de dos cadenas.
  const LZ = 44;
  block(s, 15, 12, LZ + 8.5, 2, 24, 1.2, wd, 4);
  for (const y of [14, 24, 34]) {
    block(s, 15.6, y - 0.4, LZ + 7, 0.8, 0.8, 1.6, C.gold, 3);
    bell(s, 16, y, LZ, 0.75);
  }
  s.borde = false;
  chain(s, 16, 14, LZ + 9.7, 64);
  chain(s, 16, 34, LZ + 9.7, 64);
  s.borde = true;
  return s.sprite(4);
}

export const CASA_PROPIA_DRAW: Record<string, (v: Variant) => Sprite> = {
  "cama-doble": camaDoble,
  "cama-sencilla": camaSencilla,
  armario,
  tocador,
  "tina-bano": tinaBano,
  "mesa-comedor": mesaComedor,
  "lampara-colgante": lamparaColgante,
  baul,
  "barra-casa": barraCasa,
  "equipo-sonido": equipoSonido,
  "bola-disco": bolaDisco,
  "juego-rana": juegoRana,
  "mesa-billar": mesaBillar,
};
