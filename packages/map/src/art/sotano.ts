// El sótano rediseñado: pisos del vestíbulo, del club y de los baños, y los muebles nuevos (guardarropa,
// estatua y alfombras del vestíbulo, apliques, humidor y vitrina de habanos del bar, pista de baile,
// gradas del cine, baños y el estante de premios del arcade).
import { C, OUT, mix } from "./palette";
import { alpha, at, bayer, flat, noise, renderSprite, smoothNoise, solidBox, type Box, type Ramp, type RGBA, type Shader, type Sprite } from "./pixel";
import { blob, leg, roundShadow, shadowUnder, volume, type Variant } from "./kit";
import { CINEMA_TIER_STEP, SOTANO_CATALOG } from "../world/catalog-sotano";

const mod = (n: number, m: number) => ((n % m) + m) % m;
const none: Shader = () => null;

// ---------- Pisos ----------

/**
 * Mármol del vestíbulo: damero de losas negras y crema con vetas, juntas finas y un rombito dorado
 * donde se juntan cuatro losas.
 */
export function marbleFloor(X: number, Y: number): RGBA {
  const x = Math.floor(X);
  const y = Math.floor(Y);
  const tx = Math.floor(x / 16);
  const ty = Math.floor(y / 16);
  const u = x - tx * 16;
  const v = y - ty * 16;
  // Rombo dorado en las esquinas (se reparte entre las cuatro losas que se tocan).
  const cu = Math.min(u + 0.5, 16 - u - 0.5);
  const cv = Math.min(v + 0.5, 16 - v - 0.5);
  if (cu + cv < 2.6) return at(C.gold, cu + cv < 1.4 ? 4 : 3);
  const dark = mod(tx + ty, 2) === 1;
  if (u === 0 || v === 0) return dark ? at(C.metal, 0) : at(C.cream, 2);
  // Vetas: bandas finas de un ruido suave estirado en diagonal.
  const n = smoothNoise(X * 0.8 + Y * 0.35, Y * 0.8 - X * 0.2, 9, dark ? 71 : 72);
  const vein = Math.abs(n - 0.5) < 0.025;
  const vein2 = Math.abs(n - 0.28) < 0.012;
  if (dark) {
    if (vein) return at(C.metal, 3);
    if (vein2) return at(C.metal, 2);
    return at(C.metal, bayer(x, y) < 0.12 ? 1 : noise(x, y, 5) < 0.04 ? 2 : 0);
  }
  if (vein) return at(C.stone, 3);
  if (vein2) return at(C.stone, 4);
  // Brillo del pulido en la mitad de arriba de cada losa crema.
  return at(C.cream, u + v < 9 && bayer(x, y) < 0.3 ? 5 : noise(x, y, 6) < 0.05 ? 3 : 4);
}

/** Baldosas de baño: cuadritos blancos con junta gris y una guarda del color de la sala. */
export function bathFloor(X: number, Y: number, accent: Ramp): RGBA {
  const x = Math.floor(X);
  const y = Math.floor(Y);
  if (mod(x, 4) === 0 || mod(y, 4) === 0) return at(C.stone, 3);
  const cx = Math.floor(x / 4);
  const cy = Math.floor(y / 4);
  // Guarda en damero cada tres baldosas del piso (una losa de 16 = 4 cuadritos).
  const inTileX = mod(cx, 4);
  const inTileY = mod(cy, 4);
  if ((inTileX === 0 || inTileY === 0) && mod(Math.floor(cx / 4) + Math.floor(cy / 4), 2) === 0 && mod(cx + cy, 2) === 0) return at(accent, 3);
  const shine = mod(x, 4) === 1 && mod(y, 4) === 1;
  return at(C.white, shine ? 4 : noise(cx, cy, 31) < 0.15 ? 2 : 3);
}

/** Madera oscura en espiga (cestería) para el club: listones de 8x2 que alternan de dirección. */
export function loungeFloor(X: number, Y: number): RGBA {
  const x = Math.floor(X);
  const y = Math.floor(Y);
  const bx = Math.floor(x / 8);
  const by = Math.floor(y / 8);
  const across = mod(bx + by, 2) === 0;
  const k = across ? Math.floor(mod(y, 8) / 2) : Math.floor(mod(x, 8) / 2);
  const seam = across ? mod(y, 2) === 0 && mod(y, 8) !== 0 : mod(x, 2) === 0 && mod(x, 8) !== 0;
  if (mod(x, 8) === 0 || mod(y, 8) === 0) return at(C.woodDark, 0);
  const tone = noise(bx * 4 + k, by, 41);
  if (seam && bayer(x, y) < 0.5) return at(C.woodDark, 1);
  return at(C.woodDark, tone < 0.3 ? 2 : tone < 0.85 ? 3 : 4);
}

// ---------- Vestíbulo ----------

/** Colores de los abrigos, en el orden en que cuelgan. */
const COATS: Ramp[] = [C.woodDark, C.rug, C.cream, C.fabric, C.metal, C.sage, C.curtain, C.violet];

/**
 * Riel del guardarropa (1x2, contra la pared): dos parantes, la barra de bronce con abrigos colgados de
 * perchas (se ven de costado, uno tras otro, como en un guardarropa de verdad) y la repisa de los sombreros.
 */
function coatRail(): Sprite {
  const wd = C.woodDark;
  const top = 25;
  const coats: Box[] = [];
  for (let k = 0; k < 8; k++) {
    const r = COATS[k]!;
    const long = k % 3 !== 1;
    const h = long ? 19 : 14;
    const y = 2.4 + k * 3.4;
    const d = 2.5;
    // Cara +y: el frente del abrigo, con la línea de botones y el cinturón de los largos.
    const face =
      (shade: number): Shader =>
      (u, v, fw, fh) => {
        if (v < 0.8) return at(r, shade - 1);
        if (fh - v < 3 && Math.abs(u - fw / 2) < (3 - (fh - v)) * 0.7) return at(r, shade - 2);
        if (Math.abs(u - fw / 2) < 0.4) return mod(Math.floor(v), 3) === 1 ? at(C.gold, 4) : at(r, shade - 1);
        if (long && Math.abs(v - fh * 0.45) < 0.6) return at(r, shade - 2);
        return at(r, shade);
      };
    // Costado (+x): la manga que cae.
    const side =
      (shade: number): Shader =>
      (u, v, fw, fh) => {
        if (v < 0.8) return at(r, shade - 1);
        if (v > fh - 7 && v < fh - 1 && u > fw * 0.3) return at(r, shade + 1);
        return at(r, shade);
      };
    const part = (x: number, w: number, z: number, hh: number): Box => ({ x, y, z, w, d, h: hh, top: flat(at(r, 4)), left: face(3), right: side(2) });
    coats.push(solidBox({ x: 7.5, y: y + 0.8, z: top - 0.5, w: 1, d: 1, h: 2 }, C.metal, 4));
    coats.push(part(3.6, 8.8, top - h, h - 1.4), part(5.2, 5.6, top - 1.4, 1.4));
    // Una bufanda colgando de algunos.
    if (noise(k, 7, 3) < 0.35) coats.push(solidBox({ x: 10.6, y: y + 0.3, z: top - 10, w: 1.2, d: 1.8, h: 8 }, k % 2 ? C.rug : C.mustard, 3));
  }
  const hat = (y: number, r: Ramp): Box[] => [
    solidBox({ x: 5, y: y - 0.5, z: 29.3, w: 6, d: 5, h: 0.8 }, r, 2),
    solidBox({ x: 6, y: y + 0.3, z: 30.1, w: 4, d: 3.4, h: 2.6 }, r, 2),
    { x: 6, y: y + 0.3, z: 30.1, w: 4, d: 3.4, h: 0.9, left: flat(at(C.rug, 2)), right: flat(at(C.rug, 3)) },
  ];
  return renderSprite(
    [
      solidBox({ x: 1, y: 0.5, z: 0, w: 3, d: 2, h: 29 }, wd, 4),
      solidBox({ x: 7, y: 0.5, z: top + 0.5, w: 2, d: 31, h: 1 }, C.gold, 3),
      ...coats,
      solidBox({ x: 1, y: 29.5, z: 0, w: 3, d: 2, h: 29 }, wd, 4),
      // Repisa de los sombreros, apoyada en los parantes.
      solidBox({ x: 1, y: 0.5, z: 28.5, w: 12, d: 31, h: 1 }, wd, 4),
      ...hat(3, C.metal),
      ...hat(14, C.cork),
      ...hat(24, C.rug),
    ],
    { outline: OUT, under: shadowUnder(1, 0.5, 12, 31, 0.25) },
  );
}

/** Mostrador del guardarropa (1x2, el frente hacia +x): paneles de madera, timbre, fichas y un libro. */
function coatCheck(): Sprite {
  const wd = C.woodDark;
  const front: Shader = (u, v, fw, fh) => {
    if (v >= fh - 1.5) return at(C.gold, v >= fh - 0.8 ? 4 : 2);
    if (v < 1.5) return at(wd, 1);
    // Paneles con marco en relieve.
    const pu = mod(u, 10);
    if (pu < 1 || v < 3 || v >= fh - 3) return at(wd, 2);
    if (pu < 2 || v < 4) return at(wd, 4);
    if (pu >= 9) return at(wd, 1);
    // Placa dorada con un gancho en el panel del medio.
    if (Math.abs(u - fw / 2) < 3 && Math.abs(v - fh / 2) < 2) return Math.abs(u - fw / 2) < 0.6 || Math.floor(v) === Math.floor(fh / 2) ? at(wd, 1) : at(C.gold, 4);
    return at(wd, 3);
  };
  const top: Shader = (u, v, fw, fh) => {
    if (u < 1 || v < 1 || u >= fw - 1 || v >= fh - 1) return at(C.gold, 3);
    return at(C.wood, mod(Math.floor(v), 6) === 0 ? 2 : 3);
  };
  // Fichas numeradas colgando de una tabla.
  const tickets: Shader = (u, v, fw) => {
    if (v < 1) return at(wd, 2);
    const k = Math.floor(u / 2);
    if (mod(u, 2) < 1 || k * 2 + 2 > fw) return null;
    return v < 3 ? at(C.rug, 3) : at(C.cream, 5);
  };
  return renderSprite(
    [
      { x: 2, y: 0.5, z: 0, w: 12, d: 31, h: 17, top: flat(at(wd, 3)), left: flat(at(wd, 2)), right: front },
      { x: 1.5, y: 0, z: 17, w: 13, d: 32, h: 1.5, top, left: flat(at(C.gold, 2)), right: flat(at(C.gold, 3)) },
      // Libro de registro abierto.
      solidBox({ x: 6, y: 3, z: 18.5, w: 6, d: 8, h: 0.8 }, C.cream, 4),
      solidBox({ x: 6, y: 6.8, z: 18.5, w: 6, d: 0.6, h: 1 }, C.rug, 2),
      // Timbre de bronce.
      solidBox({ x: 9, y: 20, z: 18.5, w: 3, d: 3, h: 0.8 }, C.woodDark, 3),
      volume(8.5, 19.5, 19.3, 4, 4, 3),
      // Tablero con fichas del guardarropa.
      solidBox({ x: 3, y: 26, z: 18.5, w: 2, d: 5, h: 8 }, wd, 3),
      { x: 5, y: 26, z: 20, w: 0.6, d: 5, h: 5, right: tickets },
    ],
    {
      outline: OUT,
      under: shadowUnder(2, 0.5, 12, 31),
      extra: (c, p) => {
        const b = p(10.5, 21.5, 19.3);
        blob(c, b.x, b.y - 1, 2.6, 2, (nx, ny) => at(C.gold, ny < -0.2 && nx < 0.2 ? 5 : ny > 0.4 ? 2 : 4));
        c.set(b.x, b.y - 3, at(C.gold, 5));
        c.set(b.x, b.y - 4, at(C.gold, 3));
      },
    },
  );
}

/** Cara de un dado dorado con sus puntos (n de 1 a 6); `u`, `v` en la cara. */
function dieFace(n: number, shade: number): Shader {
  const PIPS: Record<number, [number, number][]> = {
    1: [[0.5, 0.5]],
    2: [[0.25, 0.25], [0.75, 0.75]],
    3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
    5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
    6: [[0.25, 0.22], [0.75, 0.22], [0.25, 0.5], [0.75, 0.5], [0.25, 0.78], [0.75, 0.78]],
  };
  return (u, v, fw, fh) => {
    for (const [pu, pv] of PIPS[n]!) if (Math.hypot(u + 0.5 - pu * fw, v + 0.5 - pv * fh) < 1.05) return at(C.rug, 1);
    const e = Math.min(u, v, fw - 1 - u, fh - 1 - v);
    return at(C.gold, e < 0.6 ? shade - 1 : shade);
  };
}

/** Estatua del vestíbulo (2x2): pedestal de mármol con ribete dorado, cojín de terciopelo y dos dados de oro. */
function lobbyStatue(): Sprite {
  const marble: Shader = (u, v) => {
    const n = smoothNoise(u * 0.9 + v * 0.4, v, 5, 3);
    return Math.abs(n - 0.5) < 0.04 ? at(C.stone, 3) : at(C.cream, 4);
  };
  const marbleSide =
    (shade: number): Shader =>
    (u, v, _fw, fh) => {
      if (v >= fh - 1) return at(C.cream, 5);
      const n = smoothNoise(u * 0.9 + v * 0.6, v * 0.8, 5, 4);
      return Math.abs(n - 0.5) < 0.04 ? at(C.stone, 2) : at(C.cream, shade);
    };
  const band: Shader = (u, v, _fw, fh) => (v >= fh - 1 || v < 1 ? at(C.gold, 4) : mod(Math.floor(u), 4) === 0 ? at(C.gold, 5) : at(C.gold, 3));
  const cushionTop: Shader = (u, v, fw, fh) => {
    const e = Math.min(u, v, fw - 1 - u, fh - 1 - v);
    if (e < 1) return at(C.gold, 4);
    return at(C.rug, e < 2 ? 3 : (Math.floor(u) + Math.floor(v)) % 5 === 0 ? 4 : 3);
  };
  return renderSprite(
    [
      { x: 2, y: 2, z: 0, w: 28, d: 28, h: 3, top: marble, left: marbleSide(3), right: marbleSide(2) },
      { x: 6, y: 6, z: 3, w: 20, d: 20, h: 16, top: marble, left: marbleSide(4), right: marbleSide(3) },
      { x: 5.5, y: 5.5, z: 14, w: 21, d: 21, h: 2, top: none, left: band, right: band },
      { x: 4.5, y: 4.5, z: 19, w: 23, d: 23, h: 2.5, top: marble, left: marbleSide(4), right: marbleSide(3) },
      { x: 9, y: 9, z: 21.5, w: 14, d: 14, h: 3, top: cushionTop, left: flat(at(C.rug, 2)), right: flat(at(C.rug, 1)) },
      // Dados: uno grande apoyado y uno chico encima, corrido.
      { x: 9.5, y: 10, z: 24.5, w: 12, d: 12, h: 12, top: dieFace(5, 4), left: dieFace(3, 3), right: dieFace(2, 2) },
      { x: 12.5, y: 12, z: 36.5, w: 8, d: 8, h: 8, top: dieFace(1, 4), left: dieFace(6, 3), right: dieFace(4, 2) },
      volume(0, 0, 0, 32, 32, 48),
    ],
    {
      outline: OUT,
      under: shadowUnder(2, 2, 28, 28, 0.35),
      extra: (c, p) => {
        // Destellos sobre el oro y borlas en las esquinas del cojín.
        for (const [x, y, z] of [
          [10.5, 11, 36],
          [13.5, 13, 44],
          [20, 11, 33],
        ] as const) {
          const s = p(x, y, z);
          c.set(s.x, s.y - 1, at(C.gold, 5));
          c.set(s.x - 1, s.y - 1, alpha(at(C.white, 4), 0.8));
        }
        for (const [x, y] of [
          [9, 23],
          [23, 23],
          [23, 9],
        ] as const) {
          const s = p(x, y, 21.5);
          c.set(s.x, s.y + 1, at(C.gold, 4));
          c.set(s.x, s.y + 2, at(C.gold, 2));
        }
      },
    },
  );
}

/** Alfombra del vestíbulo (6x9): campo vino con medallón dorado, guardas, esquineras y flecos. */
function lobbyRug(): Sprite {
  const top: Shader = (u, v, fw, fh) => {
    const x = Math.floor(u);
    const y = Math.floor(v);
    // Flecos en las puntas.
    if (v < 2 || v >= fh - 2) return mod(x, 2) === 0 ? at(C.cream, v < 1 || v >= fh - 1 ? 3 : 4) : null;
    const e = Math.min(u, v - 2, fw - 1 - u, fh - 3 - v);
    if (e < 1) return at(C.rug, 0);
    if (e < 4) {
      // Guarda exterior con un zigzag dorado.
      const t = mod(u + v, 6);
      return Math.abs(e - 2.5) < 1 && (t < 1 || t >= 5) ? at(C.gold, 4) : at(C.navy, 2);
    }
    if (e < 5) return at(C.gold, 3);
    const cu = u - fw / 2;
    const cv = v - fh / 2;
    // Medallón central en rombo (más ancho que la estatua que va encima), con rombitos dorados adentro,
    // doble filete y puntas festoneadas.
    const d = Math.abs(cu) / (fw * 0.42) + Math.abs(cv) / (fh * 0.36);
    if (d < 0.2) return at(C.gold, d < 0.1 ? 5 : 4);
    if (d < 0.62) return mod(x + y, 8) === 0 && mod(x - y, 8) === 0 ? at(C.gold, 4) : at(C.navy, d < 0.3 ? 3 : 2);
    if (d < 0.67) return at(C.gold, 4);
    if (d < 0.71) return at(C.rug, 0);
    if (d < 0.75) return at(C.gold, 2);
    if (d < 0.86 && mod(Math.floor(d * 60), 3) === 0 && mod(x + y, 3) === 0) return at(C.cream, 4);
    // Esquineras: cuartos de rombo en cada esquina del campo.
    const ex = Math.min(u - 5, fw - 6 - u);
    const ey = Math.min(v - 7, fh - 8 - v);
    if (ex + ey < 9 && ex >= 0 && ey >= 0) return ex + ey > 7 ? at(C.gold, 3) : at(C.navy, 2);
    // Campo con florcitas sueltas.
    if (mod(x, 12) === 6 && mod(y, 12) === 6) return at(C.gold, 4);
    if ((mod(x, 12) === 6 && Math.abs(mod(y, 12) - 6) === 1) || (mod(y, 12) === 6 && Math.abs(mod(x, 12) - 6) === 1)) return at(C.rug, 4);
    return at(C.rug, bayer(x, y) < 0.15 ? 1 : 2);
  };
  return renderSprite([{ x: 0, y: 0, z: 0, w: 96, d: 144, h: 0.6, top, left: flat(at(C.rug, 0)), right: flat(at(C.rug, 1)) }], { outline: OUT });
}

/** Alfombra de pasillo (12x1): larga, con rayas en los bordes, rombos a lo largo y flecos en las puntas. */
function hallRunner(): Sprite {
  const W = 192;
  const top: Shader = (u, v, fw, fh) => {
    const x = Math.floor(u);
    const y = Math.floor(v);
    if (u < 2 || u >= fw - 2) return mod(y, 2) === 0 ? at(C.cream, 4) : null;
    const e = Math.min(v, fh - 1 - v, u - 2, fw - 3 - u);
    if (e < 1) return at(C.rug, 0);
    if (e < 2) return at(C.gold, 3);
    if (e < 3) return at(C.rug, 1);
    const k = mod(x - 2, 16) - 8;
    const d = Math.abs(k) + Math.abs(v - fh / 2) * 1.4;
    if (d < 2) return at(C.gold, 4);
    if (d < 4.5) return at(C.navy, 2);
    if (d < 5.5) return at(C.gold, 3);
    return at(C.rug, bayer(x, y) < 0.15 ? 2 : 3);
  };
  return renderSprite([{ x: 0, y: 1, z: 0, w: W, d: 14, h: 0.6, top, left: flat(at(C.rug, 0)), right: flat(at(C.rug, 1)) }], { outline: OUT });
}

/**
 * Aplique de pared de dos brazos (colgado del lado -x del tile; con "down" queda en la pared norte):
 * placa de bronce con remate, brazos en S y dos pantallas de tela plisada encendidas, con su halo.
 */
function wallSconce(): Sprite {
  const pleats: Shader = (u, v, _fw, fh) => {
    if (v >= fh - 0.8) return at(C.gold, 4);
    if (v < 0.8) return at(C.gold, 3);
    return at(C.cream, mod(Math.floor(u), 2) === 0 ? 5 : 4);
  };
  // Brazo que sale de la placa, sube y sostiene una pantalla acampanada (ancha abajo, angosta arriba).
  const arm = (y: number): Box[] => [
    solidBox({ x: 1.2, y: y + 0.5, z: 27, w: 3.8, d: 1, h: 1 }, C.gold, 3),
    solidBox({ x: 4, y: y + 0.5, z: 28, w: 1, d: 1, h: 2.5 }, C.gold, 3),
    solidBox({ x: 3.5, y, z: 30, w: 2, d: 2, h: 1 }, C.gold, 4),
    { x: 2.5, y: y - 1, z: 31, w: 4, d: 4, h: 2.5, top: flat(at(C.cream, 5)), left: pleats, right: pleats },
    { x: 3, y: y - 0.5, z: 33.5, w: 3, d: 3, h: 2, top: flat(at(C.cream, 5)), left: pleats, right: pleats },
  ];
  return renderSprite(
    [
      // Placa contra la pared, con un remate arriba y una gota abajo.
      { x: 0, y: 6.5, z: 24, w: 1.2, d: 3, h: 11, top: flat(at(C.gold, 4)), left: flat(at(C.gold, 2)), right: (_u, v, _fw, fh) => at(C.gold, v >= fh - 1 || v < 1 ? 5 : 3) },
      solidBox({ x: 0.2, y: 7.3, z: 35, w: 1.4, d: 1.4, h: 1.5 }, C.gold, 4),
      solidBox({ x: 0.2, y: 7.3, z: 22.5, w: 1.4, d: 1.4, h: 1.5 }, C.gold, 2),
      ...arm(3),
      ...arm(11),
    ],
    {
      outline: OUT,
      pad: 6,
      extra: (c, p) => {
        for (const y of [4, 12]) {
          const s = p(4.5, y, 31);
          c.glow(s.x, s.y + 3, 6, 4, at(C.gold, 5), 0.2, 2);
          // El bombillo asoma bajo la pantalla.
          c.set(s.x, s.y + 1, at(C.gold, 5));
        }
      },
    },
  );
}

// ---------- Club: el rincón de los habanos ----------

const CIGAR_BOX: Ramp[] = [C.rug, C.gold, C.green, C.woodDark];

/**
 * Humidor (1x1, el frente hacia +x): armario de cedro con puerta de vidrio, repisas con cajas de habanos,
 * higrómetro de bronce arriba y una luz cálida adentro.
 */
function cigarHumidor(): Sprite {
  const cedar = C.wood;
  const door: Shader = (u, v, fw, fh) => {
    // Marco de la puerta y manija.
    if (u < 1.2 || u >= fw - 1.2 || v < 1.2 || v >= fh - 1.2) return at(cedar, u < 1.2 || v >= fh - 1.2 ? 4 : 2);
    if (u >= fw - 2.2 && Math.abs(v - fh / 2) < 2) return at(C.gold, 5);
    // Higrómetro en la parte de arriba de la puerta.
    const hy = fh - 4.2;
    const hd = Math.hypot(u + 0.5 - fw / 2, v - hy);
    if (hd < 2.4) return hd > 1.7 ? at(C.gold, 4) : Math.abs(u + 0.5 - fw / 2 - (v - hy) * 0.6) < 0.4 ? at(C.rug, 2) : at(C.cream, 5);
    if (v >= fh - 7) return at(cedar, 1);
    // Repisas: cada 6 de alto, con cajas de colores y la luz que baja.
    const shelf = Math.floor((v - 1.2) / 6);
    const sv = mod(v - 1.2, 6);
    if (sv < 1) return at(cedar, 3);
    const k = Math.floor((u - 1.2) / 3.3);
    const r = CIGAR_BOX[Math.floor(noise(k, shelf, 13) * CIGAR_BOX.length)]!;
    const bh = 2.5 + noise(k, shelf, 7) * 2;
    if (sv < 1 + bh && mod(u - 1.2, 3.3) < 2.9) {
      // Etiqueta dorada en la caja.
      if (Math.abs(sv - 1 - bh / 2) < 0.6 && mod(u - 1.2, 3.3) > 0.8 && mod(u - 1.2, 3.3) < 2) return at(C.gold, 5);
      return at(r, 2);
    }
    // Vidrio con un reflejo diagonal sobre el fondo iluminado.
    if (Math.abs(u - v * 0.5 - 1) < 0.7) return alpha(at(C.white, 4), 0.85);
    return mix(at(C.fire, 2), at(cedar, 1), 0.55);
  };
  const side: Shader = (u, v, _fw, fh) => {
    if (v >= fh - 1) return at(cedar, 4);
    return at(cedar, mod(Math.floor(u), 5) === 0 ? 1 : 2);
  };
  return renderSprite(
    [
      leg(3.5, 2.5, 3, C.woodDark),
      leg(11, 2.5, 3, C.woodDark),
      leg(3.5, 11.5, 3, C.woodDark),
      leg(11, 11.5, 3, C.woodDark),
      { x: 3, y: 2, z: 3, w: 10.5, d: 12, h: 31, top: flat(at(cedar, 3)), left: side, right: door },
      // Cornisa con ribete dorado.
      { x: 2.5, y: 1.5, z: 34, w: 11.5, d: 13, h: 2, top: flat(at(cedar, 4)), left: flat(at(C.gold, 3)), right: flat(at(C.gold, 4)) },
      solidBox({ x: 4, y: 3, z: 36, w: 9, d: 10, h: 1.2 }, cedar, 3),
    ],
    { outline: OUT, under: shadowUnder(3, 2, 10.5, 12) },
  );
}

/**
 * Vitrina de habanos (1x1, al final de la barra; el frente hacia +x): base de madera, caja de vidrio
 * con marco de bronce y cajas abiertas llenas de cigarros con su anillo dorado.
 */
function cigarCase(): Sprite {
  const wd = C.woodDark;
  // Cigarros vistos desde arriba: filas de cafés con anillo dorado, en dos cajas abiertas.
  const cigars: Shader = (u, v, fw, fh) => {
    const box = v < fh / 2 ? 0 : 1;
    const bv = box ? v - fh / 2 : v;
    const bh = fh / 2;
    if (u < 1 || u >= fw - 1 || bv < 0.8 || bv >= bh - 0.8) return at(box ? C.rug : C.green, 2);
    const row = Math.floor((bv - 0.8) / 1.6);
    if (mod(bv - 0.8, 1.6) < 0.35) return at(C.woodDark, 0);
    if (Math.abs(u - fw * 0.3) < 0.6) return at(C.gold, 5);
    return at(C.cork, row % 2 ? 1 : 2);
  };
  const glass: Shader = (u, v, fw, fh) => {
    if (u < 0.8 || u >= fw - 0.8 || v >= fh - 0.8) return at(C.gold, 4);
    if (Math.abs(u - v * 0.8 - 2) < 0.7) return alpha(at(C.white, 4), 0.8);
    return alpha(at(C.sky, 4), 0.28);
  };
  const base: Shader = (u, v, _fw, fh) => {
    if (v >= fh - 1) return at(C.gold, 3);
    if (v < 1) return at(wd, 1);
    return at(wd, mod(Math.floor(u), 6) === 0 ? 2 : 3);
  };
  return renderSprite(
    [
      { x: 1, y: 0.5, z: 0, w: 14, d: 15, h: 9, top: flat(at(wd, 3)), left: base, right: base },
      { x: 2.5, y: 2, z: 9, w: 11, d: 12, h: 0.6, top: cigars, left: flat(at(wd, 2)), right: flat(at(wd, 2)) },
      // Tapas de las cajas, abiertas contra el fondo.
      { x: 2.5, y: 2, z: 9.6, w: 1, d: 12, h: 5, top: flat(at(C.gold, 3)), left: flat(at(C.rug, 2)), right: (u, v) => (mod(Math.floor(u), 6) === 2 && Math.floor(v) === 2 ? at(C.gold, 5) : at(C.rug, 3)) },
      { x: 1, y: 0.5, z: 9, w: 14, d: 15, h: 8, top: flat(alpha(at(C.sky, 5), 0.25)), left: glass, right: glass },
      { x: 1, y: 0.5, z: 17, w: 14, d: 15, h: 1.2, top: flat(at(C.gold, 4)), left: flat(at(C.gold, 2)), right: flat(at(C.gold, 3)) },
      // Cenicero de cristal y un cortapuros.
      solidBox({ x: 8, y: 9, z: 18.2, w: 4, d: 4, h: 1 }, C.white, 2),
      solidBox({ x: 4, y: 4, z: 18.2, w: 2.5, d: 1.2, h: 0.8 }, C.metal, 3),
    ],
    {
      outline: OUT,
      under: shadowUnder(1, 0.5, 14, 15),
      extra: (c, p) => {
        // Un habano apoyado en el cenicero, con la brasa.
        const a = p(9, 10, 19.2);
        const b = p(12.5, 12, 19.6);
        c.line(a.x, a.y, b.x, b.y, at(C.cork, 1));
        c.set(b.x, b.y, at(C.fire, 3));
        c.set(b.x + 1, b.y - 2, alpha(at(C.white, 3), 0.6));
        c.set(b.x, b.y - 4, alpha(at(C.white, 3), 0.4));
      },
    },
  );
}

// ---------- Club: la pista ----------

/** Pista de baile (5x5): baldosas de luz de colores con marco cromado y bombillos en el borde. */
function danceFloor(): Sprite {
  const S = 80;
  const PAL = [C.neon, C.cyan, C.violet, C.gold];
  const top: Shader = (u, v, fw, fh) => {
    const e = Math.min(u, v, fw - 1 - u, fh - 1 - v);
    if (e < 2) {
      const lit = mod(Math.floor(u + v), 4) === 0;
      return e < 1 ? at(C.metal, 2) : lit ? at(C.gold, 5) : at(C.metal, 4);
    }
    const x = u - 2;
    const y = v - 2;
    const cx = Math.floor(x / 8);
    const cy = Math.floor(y / 8);
    const lu = mod(x, 8);
    const lv = mod(y, 8);
    if (lu < 1 || lv < 1) return at(C.metal, 0);
    // Diagonales de colores que se cruzan (como un patrón de luces en ese instante).
    const k = mod(cx + cy, 4);
    const r = PAL[k]!;
    const lit = noise(cx, cy, 57) < 0.4 || mod(cx - cy, 5) === 0;
    if (lu < 2.5 && lv < 2.5) return at(r, lit ? 5 : 3);
    if (!lit) return at(r, bayer(Math.floor(u), Math.floor(v)) < 0.25 ? 0 : 1);
    return at(r, lu + lv > 11 ? 3 : 4);
  };
  return renderSprite([{ x: 0, y: 0, z: 0, w: S, d: S, h: 1, top, left: flat(at(C.metal, 1)), right: flat(at(C.metal, 2)) }], { outline: OUT });
}

// ---------- Cine: las gradas ----------

/** Alto de cada grada: sale del catálogo (`lift`), que es lo que usaría el cliente para subir al avatar. */
const TIER_STEP = CINEMA_TIER_STEP;

/**
 * Grada del cine (`w` tiles de fondo en x, 8 de largo en y): alfombra azul con una nariz de bronce y luces
 * en el borde de adelante (-x), y el costado del pasillo con su fila de luces de escalón.
 */
function cinemaTier(level: number, w: number): () => Sprite {
  return () => {
    const h = TIER_STEP * level;
    const top: Shader = (u, v) => {
      const x = Math.floor(u);
      const y = Math.floor(v);
      if (u < 2) return mod(y, 4) === 1 ? at(C.gold, 5) : at(C.gold, u < 1 ? 2 : 3);
      // Alfombra un poco más clara que la del piso, para que se lea cada escalón.
      const cu = mod(x, 12) - 6;
      const cv = mod(y, 12) - 6;
      const d = Math.abs(cu) + Math.abs(cv);
      if (d === 2) return at(C.gold, 3);
      if (d < 2) return at(C.curtain, 2);
      return at(C.navy, (bayer(x, y) < 0.15 ? 2 : 3) - (level === 2 ? 1 : 0));
    };
    const side: Shader = (u, v, _fw, fh) => {
      if (v >= fh - 1) return at(C.gold, 3);
      if (Math.abs(v - fh / 2) < 0.8 && mod(Math.floor(u), 5) === 2) return at(C.gold, 5);
      return at(C.navy, v < 1 ? 0 : 1);
    };
    return renderSprite([{ x: 0, y: 0, z: 0, w: 16 * w, d: 16 * 8, h, top, left: side, right: side }], { outline: OUT });
  };
}

// ---------- Baños ----------

/**
 * Cubículo del baño (1x1, la puerta hacia +x): tabiques de laminado levantados del piso, riel cromado
 * arriba, puerta con placa, pestillo de "libre" y el inodoro que se asoma adentro.
 */
function bathStall(): Sprite {
  const panel = C.cream;
  const doorShade: Shader = (u, v, fw, fh) => {
    if (u < 0.8 || u >= fw - 0.8 || v < 0.8 || v >= fh - 0.8) return at(C.wood, 2);
    // Bisagras a la izquierda, placa redonda arriba y pestillo verde a la derecha.
    if (u < 1.8 && (Math.abs(v - 4) < 1 || Math.abs(v - fh + 5) < 1)) return at(C.metal, 4);
    const pd = Math.hypot(u + 0.5 - fw / 2, v - fh + 5.5);
    if (pd < 2.2) return pd < 1.4 ? at(C.fabric, 4) : at(C.metal, 4);
    if (u >= fw - 3 && u < fw - 1.6 && Math.abs(v - fh / 2) < 1) return at(C.green, 4);
    if (u >= fw - 3 && u < fw - 1.6 && Math.abs(v - fh / 2) < 1.8) return at(C.metal, 3);
    return at(C.wood, u < 2.4 ? 4 : 3);
  };
  const wall: Shader = (u, v, fw, fh) => (v >= fh - 1 ? at(panel, 5) : u >= fw - 1 ? at(C.wood, 2) : at(panel, v < 1 ? 2 : 4));
  const wallDark: Shader = (_u, v, _fw, fh) => (v >= fh - 1 ? at(panel, 4) : at(panel, 2));
  return renderSprite(
    [
      // Inodoro contra la pared: estanque y taza blancos con la tapa levantada.
      solidBox({ x: 1.5, y: 5, z: 0, w: 3, d: 6, h: 13 }, C.white, 3),
      solidBox({ x: 1.8, y: 7.2, z: 13, w: 1.2, d: 1.6, h: 0.8 }, C.metal, 4),
      solidBox({ x: 4, y: 5.5, z: 0, w: 5.5, d: 5, h: 7 }, C.white, 3),
      { x: 4, y: 5.5, z: 7, w: 5.5, d: 5, h: 0.6, top: (u, v, fw, fh) => (Math.hypot((u + 0.5 - fw / 2) * 0.9, v + 0.5 - fh / 2) < 1.7 ? at(C.sky, 2) : at(C.white, 4)) },
      solidBox({ x: 4.2, y: 5.5, z: 7.6, w: 1, d: 5, h: 5 }, C.white, 4),
      // Tabique del fondo (-y) y el del frente (+y), con patas de metal.
      leg(13.5, 0.4, 2.5, C.metal),
      { x: 1, y: 0.4, z: 2.5, w: 14, d: 1.2, h: 25, top: flat(at(panel, 5)), left: wall, right: wallDark },
      leg(13.5, 14.4, 2.5, C.metal),
      { x: 1, y: 14.4, z: 2.5, w: 14, d: 1.2, h: 25, top: flat(at(panel, 5)), left: wall, right: wallDark },
      // Puerta y riel cromado de arriba.
      { x: 14, y: 1.6, z: 3, w: 1.2, d: 12.8, h: 23, top: flat(at(C.wood, 4)), left: flat(at(C.wood, 2)), right: doorShade },
      solidBox({ x: 14, y: 0.4, z: 27.5, w: 1.4, d: 15.2, h: 1 }, C.metal, 4),
    ],
    { outline: OUT, under: shadowUnder(1, 0.4, 14, 15.2, 0.22) },
  );
}

/**
 * Lavamanos (1x1, el frente hacia +x): mueble con lavatorio, grifo cromado, jabón y un salpicadero de
 * azulejos. Sin espejo: va contra la pared baja del pasillo y se vería flotando del otro lado.
 */
function bathSink(): Sprite {
  const cab: Shader = (u, v, fw, fh) => {
    if (v >= fh - 1) return at(C.wood, 4);
    if (Math.abs(u - fw / 2) < 0.5) return at(C.wood, 1);
    if (v > fh - 4 && Math.abs(u - fw / 2) < 2 && Math.abs(u - fw / 2) > 1) return at(C.gold, 4);
    return at(C.wood, u < 1 || u >= fw - 1 ? 2 : 3);
  };
  // Azulejos blancos con juntas celestes y un ribete dorado arriba.
  const tiles: Shader = (u, v, _fw, fh) => {
    if (v >= fh - 1) return at(C.gold, 4);
    if (mod(Math.floor(u), 3) === 0 || Math.floor(v) === 1) return at(C.sky, 3);
    return at(C.white, 4);
  };
  return renderSprite(
    [
      // Salpicadero contra la pared, apenas más alto que la mesada.
      { x: 1, y: 1.5, z: 12, w: 1.5, d: 13, h: 4, top: flat(at(C.gold, 4)), left: flat(at(C.white, 2)), right: tiles },
      { x: 3, y: 2, z: 0, w: 10, d: 12, h: 12, top: flat(at(C.wood, 3)), left: flat(at(C.wood, 2)), right: cab },
      {
        x: 2.5,
        y: 1.5,
        z: 12,
        w: 11,
        d: 13,
        h: 1.5,
        top: (u, v, fw, fh) => {
          const r = Math.hypot((u + 0.5 - fw / 2 - 0.5) / 3.6, (v + 0.5 - fh / 2) / 4.4);
          if (r < 0.6) return at(C.sky, r < 0.2 ? 1 : 3);
          if (r < 1) return at(C.white, r < 0.8 ? 3 : 2);
          return at(C.white, 4);
        },
        left: flat(at(C.white, 3)),
        right: flat(at(C.white, 2)),
      },
      // Grifo y jabón.
      solidBox({ x: 3.5, y: 7, z: 13.5, w: 1.5, d: 1.5, h: 3 }, C.metal, 4),
      solidBox({ x: 5, y: 7.2, z: 15.5, w: 2, d: 1, h: 1 }, C.metal, 4),
      solidBox({ x: 4, y: 11, z: 13.5, w: 2, d: 2, h: 3 }, C.rose, 3),
    ],
    { outline: OUT, under: shadowUnder(3, 2, 10, 12) },
  );
}

// ---------- Arcade ----------

const PLUSHIES: Ramp[] = [C.rose, C.gold, C.cyan, C.leaf, C.cream, C.violet, C.terracotta];

/** Estante de premios (1x2, el frente hacia +x): tres repisas llenas de peluches y una estrella arriba. */
function prizeShelf(): Sprite {
  const body = C.violet;
  const boxes: Box[] = [];
  const faces: [number, number, number, Ramp][] = [];
  for (const [z, row] of [
    [1, 0],
    [12, 1],
    [23, 2],
  ] as const)
    for (let k = 0; k < 4; k++) {
      const r = PLUSHIES[Math.floor(noise(k, row, 21) * PLUSHIES.length)]!;
      const y = 2 + k * 7.2;
      const s = 5 + Math.floor(noise(k, row, 3) * 2);
      boxes.push(volume(5, y, z + 1, s, s, s));
      faces.push([8, y + s / 2, z + 1 + s / 2, r]);
    }
  const shelf = (z: number): Box => solidBox({ x: 2, y: 0.5, z, w: 11, d: 31, h: 1 }, C.cream, 3);
  return renderSprite(
    [
      { x: 1, y: 0, z: 0, w: 2, d: 32, h: 34, top: flat(at(body, 3)), left: flat(at(body, 2)), right: (_u, v) => at(body, Math.floor(v) % 11 === 0 ? 1 : 2) },
      shelf(0.5),
      shelf(11.5),
      shelf(22.5),
      solidBox({ x: 1, y: 0, z: 33, w: 12, d: 32, h: 1.5 }, body, 3),
      { x: 1, y: -0.5, z: 0, w: 12, d: 1, h: 34, top: flat(at(body, 3)), left: flat(at(body, 3)), right: flat(at(body, 2)) },
      ...boxes,
      { x: 1, y: 31.5, z: 0, w: 12, d: 1, h: 34, top: flat(at(body, 3)), left: flat(at(body, 3)), right: flat(at(body, 2)) },
      volume(4, 12, 34.5, 4, 8, 8),
    ],
    {
      outline: OUT,
      under: shadowUnder(1, 0, 12, 32),
      extra: (c, p) => {
        // Peluches redondos con orejas, ojitos y cachetes.
        for (const [x, y, z, r] of faces) {
          const q = p(x, y, z);
          blob(c, q.x - 3.4, q.y - 4.6, 1.6, 1.6, (nx, ny) => at(r, ny < 0 && nx < 0 ? 4 : 3));
          blob(c, q.x + 3.4, q.y - 4.6, 1.6, 1.6, (nx, ny) => at(r, ny < 0 && nx < 0 ? 4 : 2));
          blob(c, q.x, q.y - 1, 4.2, 3.8, (nx, ny) => at(r, -(nx * 0.5 + ny * 0.8) > 0.3 ? 4 : -(nx * 0.5 + ny * 0.8) < -0.4 ? 2 : 3));
          c.set(q.x - 1.5, q.y - 1.5, OUT);
          c.set(q.x + 1.5, q.y - 1.5, OUT);
          c.set(q.x, q.y, at(C.rug, 2));
          c.set(q.x - 2.5, q.y - 0.3, at(C.rose, 4));
          c.set(q.x + 2.5, q.y - 0.3, at(C.rose, 4));
        }
        // Estrella de premio arriba.
        const s = p(6, 16, 38);
        blob(c, s.x, s.y, 4, 4, (nx, ny) => {
          const a = Math.atan2(ny, nx);
          const rr = 0.55 + 0.45 * Math.cos(a * 5 + Math.PI / 2);
          return Math.hypot(nx, ny) < rr ? at(C.gold, ny < 0 ? 5 : 4) : null;
        });
      },
    },
  );
}

/**
 * Máquina de pinball (2x1, el jugador del lado +x): caja de luces al fondo, mesa con vidrio, bumpers y
 * flippers, patas cromadas y costados con franjas de neón.
 */
function pinball(): Sprite {
  const body = C.navy;
  const field = (u: number, v: number, fw: number, fh: number): RGBA => {
    if (u < 1 || v < 1 || u >= fw - 1 || v >= fh - 1) return at(C.metal, 3);
    const x = u + 0.5;
    const y = v + 0.5;
    // Bumpers: tres hongos de colores arriba.
    for (const [bx, by, r] of [
      [7, 4, C.neon],
      [10, 9.5, C.cyan],
      [5, 10, C.gold],
    ] as const) {
      const d = Math.hypot(x - bx, y - by);
      if (d < 2) return at(r, d < 1 ? 5 : 3);
    }
    // Flippers al final de la mesa y la bola plateada.
    if (u > fw - 5 && u < fw - 3 && Math.abs(v - fh / 2) > 1 && Math.abs(v - fh / 2) < 4.5) return at(C.white, 4);
    if (Math.hypot(x - 16, y - 6) < 0.9) return at(C.white, 5);
    // Carriles de luces y el fondo pintado.
    if (Math.abs(v - 2.5) < 0.5 && mod(Math.floor(u), 3) === 0) return at(C.gold, 5);
    if (Math.abs(u - v - 8) < 0.6) return at(C.violet, 4);
    return at(C.navy, bayer(Math.floor(u), Math.floor(v)) < 0.2 ? 3 : 2);
  };
  const glass = (du: number): Shader => (u, v, _fw, fh) => {
    const c = field(u + du, v, 27, fh);
    return Math.abs(u + du - v * 1.5 - 6) < 0.8 ? mix(c, at(C.white, 4), 0.6) : c;
  };
  const side: Shader = (u, v, _fw, fh) => {
    if (v >= fh - 1) return at(C.metal, 3);
    if (Math.abs(v - fh / 2) < 0.8) return at(C.neon, 4);
    return at(body, 2);
  };
  const front: Shader = (u, v, fw, fh) => {
    if (v < fh - 1 && v > 0.5 && Math.abs(u - fw / 2) < 1.5) return v > fh - 1.8 ? at(C.gold, 5) : at(C.metal, 2);
    return at(body, 1);
  };
  const backbox: Shader = (u, v, fw, fh) => {
    if (u < 1 || u >= fw - 1 || v < 1 || v >= fh - 1) return at(C.metal, 2);
    // Marcador de puntos abajo y una estrella con rayos.
    if (v < 4) return mod(Math.floor(u), 2) === 0 && v > 1.5 && v < 3 ? at(C.gold, 5) : at(C.fire, 0);
    const cx = fw / 2;
    const cy = fh * 0.62;
    const a = Math.atan2(v - cy, u - cx);
    const rr = 3.5 * (0.55 + 0.45 * Math.cos(a * 5 - Math.PI / 2));
    if (Math.hypot(u - cx, v - cy) < rr) return at(C.gold, 5);
    return mod(Math.floor(a * 3 + 10), 2) ? at(C.neon, 3) : at(C.violet, 3);
  };
  return renderSprite(
    [
      leg(2, 2.5, 12, C.metal),
      leg(2, 11.5, 12, C.metal),
      // Caja de luces al fondo.
      { x: 1, y: 1.5, z: 12, w: 3, d: 13, h: 20, top: flat(at(body, 3)), left: flat(at(body, 2)), right: backbox },
      leg(28, 2.5, 9, C.metal),
      leg(28, 11.5, 9, C.metal),
      { x: 4, y: 1.5, z: 9, w: 27, d: 13, h: 4, top: flat(at(body, 3)), left: side, right: front },
      // La mesa baja hacia el jugador: dos tramos para que se note la inclinación.
      { x: 4, y: 1.5, z: 13, w: 14, d: 13, h: 1.5, top: glass(0), left: side, right: flat(at(body, 2)) },
      { x: 18, y: 1.5, z: 13, w: 13, d: 13, h: 0.7, top: glass(14), left: side, right: flat(at(body, 2)) },
    ],
    { outline: OUT, under: shadowUnder(1, 1.5, 30, 13) },
  );
}

/** Letrero del vestíbulo: un poste de bronce con cuatro flechas del color de cada neón. */
function lobbySign(): Sprite {
  const arrow =
    (r: Ramp, right: boolean): Shader =>
    (u, v, fw, fh) => {
      const tip = right ? fw - u : u + 1;
      if (tip < 3 && Math.abs(v - fh / 2) > tip * 0.8) return null;
      if (Math.abs(v - fh / 2) < 0.6 && tip > 3 && tip < fw - 1.5) return at(r, 5);
      return at(r, v >= fh - 1 ? 4 : 2);
    };
  const board = (z: number, r: Ramp, toward: number): Box => ({
    x: toward > 0 ? 8 : 0.5,
    y: 7.3,
    z,
    w: 7.5,
    d: 1.4,
    h: 4,
    top: flat(at(r, 3)),
    left: arrow(r, toward > 0),
    right: flat(at(r, 1)),
  });
  return renderSprite(
    [
      solidBox({ x: 5, y: 5, z: 0, w: 6, d: 6, h: 1.5 }, C.gold, 3),
      board(27, C.neon, -1),
      board(17, C.gold, -1),
      solidBox({ x: 7.3, y: 7.3, z: 1.5, w: 1.4, d: 1.4, h: 31 }, C.gold, 3),
      board(22, C.cyan, 1),
      board(12, C.violet, 1),
      solidBox({ x: 6.8, y: 6.8, z: 32.5, w: 2.4, d: 2.4, h: 1.5 }, C.gold, 4),
    ],
    { outline: OUT, under: roundShadow(8, 8, 3.5) },
  );
}

/**
 * Tarima frente a la pantalla del cine (2x7): tablas de madera oscura con un borde de bronce y una fila
 * de candilejas en el borde que da a las butacas (+x).
 */
function cinemaStage(): Sprite {
  const top: Shader = (u, v, fw, fh) => {
    const x = Math.floor(u);
    const y = Math.floor(v);
    if (u >= fw - 2) return mod(y, 6) === 3 ? at(C.gold, 5) : at(C.gold, u >= fw - 1 ? 2 : 3);
    if (v < 1 || v >= fh - 1) return at(C.gold, 3);
    const off = Math.floor(noise(x >> 3, 0, 5) * 16);
    if (mod(x, 8) === 0 || mod(y + off, 24) === 0) return at(C.woodDark, 1);
    return at(C.woodDark, noise(x >> 3, (y + off) >> 4, 9) < 0.5 ? 3 : 4);
  };
  const side: Shader = (u, v, _fw, fh) => {
    if (v >= fh - 1) return at(C.gold, 3);
    return at(C.curtain, mod(Math.floor(u), 4) === 0 ? 1 : 2);
  };
  return renderSprite([{ x: 0, y: 0, z: 0, w: 32, d: 112, h: SOTANO_CATALOG["cinema-stage"].lift, top, left: side, right: side }], { outline: OUT });
}

/** Dibujos para registrar en DRAW de furniture.ts. */
export const SOTANO_DRAW: Record<string, (v: Variant) => Sprite> = {
  "coat-rail": coatRail,
  "coat-check": coatCheck,
  "lobby-statue": lobbyStatue,
  "lobby-rug": lobbyRug,
  "hall-runner": hallRunner,
  "wall-sconce": wallSconce,
  "cigar-humidor": cigarHumidor,
  "cigar-case": cigarCase,
  "dance-floor": danceFloor,
  "cinema-tier-1": cinemaTier(1, 2),
  "cinema-tier-2": cinemaTier(2, 2),
  "cinema-tier-3": cinemaTier(3, 3),
  "cinema-stage": cinemaStage,
  "bath-stall": bathStall,
  "bath-sink": bathSink,
  "prize-shelf": prizeShelf,
  pinball,
  "lobby-sign": lobbySign,
};
