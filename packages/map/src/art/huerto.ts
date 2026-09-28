// Jardín vivo: lo que crece encima de cada parcela del huerto (cuatro etapas por cultivo) y la tierra
// mojada después de regar. Lo pone el cliente sobre la parcela según `OfficeState.garden`; mismo marco
// que el dibujo de la parcela (1x1, tile = 16, la tierra arriba en z = 3).
import { Escena } from "./exterior-escena";
import { C } from "./palette";
import { alpha, at, hex, noise, type RGBA, type Sprite } from "./pixel";

export type CropStage = 0 | 1 | 2 | 3;

/**
 * Altura de la tierra: la de la parcela (el cantero de tablas mide 3). Los bancales del invernadero la
 * suben mientras se dibujan (ver bedCropSprite).
 */
let SOIL_Z = 3;

const scene = (h: number) => new Escena({ x0: -2, y0: -2, z0: 0, x1: 18, y1: 18, z1: h }, 2);

/** Dónde van las matas: cuatro en dos surcos (algunos cultivos usan menos). */
const SPOTS: [number, number][] = [
  [4.5, 4.5],
  [11.5, 4.5],
  [4.5, 11.5],
  [11.5, 11.5],
];

/** Montoncito de tierra removida (recién sembrado). */
function mound(s: Escena, x: number, y: number) {
  for (let a = 0; a < 40; a++) {
    const r = noise(a, 1, x * 7 + y) * 2.2;
    const t = noise(a, 2, x + y * 3) * Math.PI * 2;
    s.plot(x + Math.cos(t) * r, y + Math.sin(t) * r, SOIL_Z + (2.2 - r) * 0.5, at(C.dirt, r < 1 ? 3 : 2));
  }
}

/** Tallo vertical de `h` con un par de hojitas arriba. */
function sprout(s: Escena, x: number, y: number, h: number, leaf: RGBA, dark: RGBA) {
  for (let z = 0; z < h; z += 0.5) s.plot(x, y, SOIL_Z + z, dark);
  for (const d of [-1, 1]) {
    s.plot(x + d, y - d * 0.3, SOIL_Z + h, leaf);
    s.plot(x + d * 1.6, y - d * 0.5, SOIL_Z + h + 0.4, leaf);
  }
  s.plot(x, y, SOIL_Z + h + 0.6, leaf);
}

/** Mata frondosa: puntos al azar en un elipsoide, con luz arriba a la izquierda. */
function bush(s: Escena, x: number, y: number, r: number, h: number, ramp = C.leaf, seed = 1, z0 = SOIL_Z) {
  const n = Math.round(r * r * h * 1.4);
  for (let i = 0; i < n; i++) {
    const t = noise(i, 1, seed) * Math.PI * 2;
    const u = Math.sqrt(noise(i, 2, seed));
    const v = noise(i, 3, seed);
    const px = x + Math.cos(t) * r * u;
    const py = y + Math.sin(t) * r * u;
    const pz = z0 + v * h * (1 - u * 0.5);
    const lit = v * 1.2 - Math.cos(t) * 0.3 - Math.sin(t) * 0.3;
    s.plot(px, py, pz, at(ramp, lit > 0.9 ? 4 : lit > 0.4 ? 3 : 2));
  }
}

/** Bolita de fruta (tomate, lulo, fresa) con su brillo. */
function fruit(s: Escena, x: number, y: number, z: number, r: number, c: RGBA, dark: RGBA, shine: RGBA) {
  for (let dz = -r; dz <= r; dz += 0.5)
    for (let dy = -r; dy <= r; dy += 0.5)
      for (let dx = -r; dx <= r; dx += 0.5) {
        if (dx * dx + dy * dy + dz * dz > r * r) continue;
        const lit = -dx - dy + dz;
        s.plot(x + dx, y + dy, z + dz, lit > r * 0.9 ? shine : lit > -r * 0.3 ? c : dark);
      }
}

const RED = { c: hex("#e04030"), d: hex("#a82820"), s: hex("#ff9a80") };
const STRAW = { c: hex("#e8323c"), d: hex("#a8202a"), s: hex("#ffb0b0") };
const ORANGE = { c: hex("#f09a2a"), d: hex("#c06a18"), s: hex("#ffd08a") };
const YELLOW = { c: hex("#f2c83a"), d: hex("#c09422"), s: hex("#fff0a0") };
const POTATO = { c: hex("#e8c24a"), d: hex("#b8902a"), s: hex("#f7e08a") };

/** Estaca de madera (tomates): donde se amarra la mata. */
function stake(s: Escena, x: number, y: number, h: number) {
  for (let z = 0; z < h; z += 0.5) s.plot(x, y, SOIL_Z + z, at(C.wood, z > h - 1 ? 4 : 3));
}

/** Tallo de maíz con hojas largas que se arquean y, si está listo, la mazorca y la espiga. */
function cornStalk(s: Escena, x: number, y: number, h: number, ready: boolean, seed: number) {
  for (let z = 0; z < h; z += 0.5) s.plot(x, y, SOIL_Z + z, at(C.leaf, z > h * 0.7 ? 3 : 2));
  for (let k = 0; k < 4; k++) {
    const zb = SOIL_Z + h * (0.25 + k * 0.18);
    const t = noise(k, 1, seed) * Math.PI * 2;
    for (let l = 0; l < 5; l += 0.4) s.plot(x + Math.cos(t) * l, y + Math.sin(t) * l, zb + l * 0.6 - l * l * 0.12, at(C.leaf, l > 3 ? 4 : 3));
  }
  if (!ready) return;
  for (let z = 0; z < 4; z += 0.5) {
    // La mazorca con la hoja que la envuelve y los granos que asoman.
    s.plot(x + 1, y + 1, SOIL_Z + h * 0.5 + z, at(C.leaf, 4));
    s.plot(x + 1.5, y + 1, SOIL_Z + h * 0.5 + z, z > 2.5 ? YELLOW.s : z < 1 ? YELLOW.d : YELLOW.c);
  }
  for (let k = 0; k < 6; k++) s.plot(x + (noise(k, 4, seed) - 0.5) * 2, y + (noise(k, 5, seed) - 0.5) * 2, SOIL_Z + h + 1 + noise(k, 6, seed) * 2, at(C.gold, 4));
}

/** Lo que crece en una parcela: `stage` 0 recién sembrado, 1 brotes, 2 creciendo, 3 listo. */
export function cropSprite(crop: string, stage: CropStage): Sprite {
  const tall = crop === "maiz" ? 34 : crop === "tomate" || crop === "lulo" ? 22 : 16;
  const s = scene(tall + 6);
  const seed = crop.length * 7 + stage;
  if (stage === 0) {
    for (const [x, y] of SPOTS) {
      mound(s, x, y);
      s.plot(x, y, SOIL_Z + 1.4, at(C.leaf, 4));
    }
    return s.sprite();
  }
  if (stage === 1) {
    for (const [x, y] of SPOTS) {
      mound(s, x, y);
      sprout(s, x, y, crop === "maiz" ? 4 : 2.5, at(C.leaf, 4), at(C.leaf, 2));
    }
    return s.sprite();
  }
  const ready = stage === 3;
  SPOTS.forEach(([x, y], i) => {
    const k = seed + i * 13;
    switch (crop) {
      case "cilantro":
        // Plumoso y verde claro; listo, más alto y tupido.
        bush(s, x, y, ready ? 3 : 2.2, ready ? 7 : 4.5, C.leaf, k);
        for (let j = 0; j < (ready ? 10 : 5); j++) s.plot(x + (noise(j, 1, k) - 0.5) * 5, y + (noise(j, 2, k) - 0.5) * 5, SOIL_Z + (ready ? 7 : 4.5) + noise(j, 3, k) * 1.5, at(C.leaf, 5));
        break;
      case "fresa":
        // Matas bajas y, al final, fresas rojas colgando a los lados.
        bush(s, x, y, ready ? 3.2 : 2.4, ready ? 4 : 3, C.leaf, k);
        if (ready) for (const [dx, dy] of [[2.5, 1], [-1, 2.8], [1.5, -2.2]] as const) fruit(s, x + dx, y + dy, SOIL_Z + 1.2, 1.1, STRAW.c, STRAW.d, STRAW.s);
        else s.plot(x + 1, y + 1, SOIL_Z + 3.3, at(C.white, 4));
        break;
      case "tomate":
        stake(s, x - 0.5, y - 0.5, ready ? 17 : 11);
        bush(s, x, y, ready ? 3 : 2.4, ready ? 15 : 9, C.leaf, k);
        if (ready) for (const [dx, dy, dz] of [[2, 1.5, 6], [-1.5, 2, 10], [1.5, -1, 12], [0.5, 2.5, 3]] as const) fruit(s, x + dx, y + dy, SOIL_Z + dz, 1.3, RED.c, RED.d, RED.s);
        break;
      case "papa":
        // Mata tupida con florcitas moradas; lista, las papitas criollas asoman en la tierra.
        bush(s, x, y, ready ? 3.4 : 2.6, ready ? 7 : 5, C.leaf, k);
        for (let j = 0; j < 3; j++) s.plot(x + (noise(j, 1, k) - 0.5) * 4, y + (noise(j, 2, k) - 0.5) * 4, SOIL_Z + (ready ? 7.5 : 5.5), at(C.violet, 4));
        if (ready) for (const [dx, dy] of [[3, 2], [-2.5, 3]] as const) fruit(s, x + dx, y + dy, SOIL_Z + 0.4, 1, POTATO.c, POTATO.d, POTATO.s);
        break;
      case "maiz":
        // Dos matas altas por parcela (en la diagonal que se ve de lado a lado): el maíz necesita aire.
        if (i === 0 || i === 3) break;
        cornStalk(s, x, y, ready ? 28 : 16, ready, k);
        break;
      case "lulo":
        // Arbusto de hojas grandes y, al final, lulos naranjas.
        if (i === 0 || i === 3) break;
        bush(s, x, y, ready ? 4 : 3.2, ready ? 15 : 10, C.leaf, k);
        if (ready) for (const [dx, dy, dz] of [[2.5, 1, 6], [-1, 3, 8], [2, 2.5, 12], [3, -1.5, 9]] as const) fruit(s, x + dx, y + dy, SOIL_Z + dz, 1.5, ORANGE.c, ORANGE.d, ORANGE.s);
        break;
      default:
        bush(s, x, y, 2.5, 5, C.leaf, k);
    }
  });
  // Lista: unos destellos dorados encima para que se note desde lejos.
  if (ready) for (const [x, y, z] of [[3, 12, tall - 2], [13, 5, tall - 4]] as const) s.plot(x, y, z, alpha(at(C.gold, 5), 0.9));
  return s.sprite();
}

/** Tierra mojada: la parcela más oscura y con brillitos de agua (va encima de la parcela, debajo de las matas). */
export function wetSoil(): Sprite {
  const s = scene(6);
  s.borde = false;
  s.quad([2, 2, SOIL_Z + 0.05], [1, 0, 0], [0, 1, 0], 12, 12, (u, v) => {
    if (noise(Math.floor(u), Math.floor(v), 91) < 0.06) return alpha(at(C.sky, 4), 0.7);
    return alpha(at(C.night, 0), 0.5);
  });
  return s.sprite();
}

/** Tierra de la bandeja de un bancal del invernadero (el mesón mide 13). */
const BED_SOIL_Z = 13;
const PINK = { c: hex("#e8457a"), d: hex("#a8205a"), s: hex("#ffb0c8") };
const POD = { c: hex("#e0a030"), d: hex("#9a5a1a"), s: hex("#f7d070") };
const CHERRY = { c: hex("#c8302a"), d: hex("#7a1a18"), s: hex("#ff8a70") };
const BERRY = { c: hex("#f7b733"), d: hex("#c8861a"), s: hex("#fff0a0") };

/**
 * Lo que crece en un bancal del invernadero: una sola mata al centro de la bandeja (uchuva, pitahaya,
 * cacao o café). Mismo marco que el dibujo del bancal (1x1, la tierra en z = 13).
 */
export function bedCropSprite(crop: string, stage: CropStage): Sprite {
  const saved = SOIL_Z;
  SOIL_Z = BED_SOIL_Z;
  try {
    const s = scene(BED_SOIL_Z + 26);
    const [x, y] = [9, 9];
    const seed = crop.length * 11 + stage;
    if (stage === 0) {
      mound(s, x, y);
      s.plot(x, y, SOIL_Z + 1.4, at(C.leaf, 4));
      return s.sprite();
    }
    if (stage === 1) {
      mound(s, x, y);
      sprout(s, x, y, 3, at(C.leaf, 4), at(C.leaf, 2));
      return s.sprite();
    }
    const ready = stage === 3;
    switch (crop) {
      case "uchuva":
        // Mata baja y ancha con las uchuvas dentro de su capuchón de papel.
        bush(s, x, y, ready ? 4 : 3, ready ? 8 : 6, C.leaf, seed);
        if (ready) for (const [dx, dy, dz] of [[2.5, 1, 3], [-1.5, 2.5, 4], [1.5, -2, 6], [3, -0.5, 5]] as const) fruit(s, x + dx, y + dy, SOIL_Z + dz, 1, BERRY.c, BERRY.d, BERRY.s);
        break;
      case "pitahaya":
        // Cactus trepador en su tutor, con flores blancas y, al final, pitahayas rosadas.
        stake(s, x - 0.5, y - 0.5, ready ? 16 : 11);
        for (let z = 0; z < (ready ? 15 : 10); z += 0.5)
          for (const d of [-1, 1]) s.plot(x + d * (1 + Math.sin(z * 0.8) * 0.8), y + d * 0.5, SOIL_Z + z, at(C.leaf, z % 3 < 1 ? 4 : 2));
        if (ready) for (const [dx, dy, dz] of [[2, 1, 9], [-1.5, 1.5, 13], [1, -1.5, 15]] as const) fruit(s, x + dx, y + dy, SOIL_Z + dz, 1.6, PINK.c, PINK.d, PINK.s);
        else for (const [dx, dz] of [[1.5, 8], [-1.5, 10]] as const) s.plot(x + dx, y + 1, SOIL_Z + dz, at(C.white, 4));
        break;
      case "cacao":
        // Arbolito de tronco oscuro con copa y, listo, las mazorcas amarillas pegadas al tronco.
        for (let z = 0; z < (ready ? 12 : 8); z += 0.5) s.plot(x, y, SOIL_Z + z, at(C.woodDark, 2));
        bush(s, x, y, ready ? 4.5 : 3.2, 6, C.leaf, seed, SOIL_Z + (ready ? 11 : 7));
        if (ready) for (const [dx, dy, dz] of [[1.2, 1, 4], [-1, 1.2, 7], [1.2, -0.5, 9]] as const) fruit(s, x + dx, y + dy, SOIL_Z + dz, 1.4, POD.c, POD.d, POD.s);
        break;
      case "cafe":
        // Cafeto: ramas en pisos con hojas brillantes y, listo, las cerezas rojas en racimos.
        for (let z = 0; z < (ready ? 16 : 11); z += 0.5) s.plot(x, y, SOIL_Z + z, at(C.woodDark, 3));
        for (let k = 0; k < (ready ? 4 : 3); k++) bush(s, x, y, 3.8 - k * 0.7, 3, C.leaf, seed + k, SOIL_Z + 3 + k * 3.5);
        if (ready)
          for (let k = 0; k < 7; k++) {
            const t = noise(k, 1, seed) * Math.PI * 2;
            fruit(s, x + Math.cos(t) * 2.5, y + Math.sin(t) * 2.5, SOIL_Z + 4 + noise(k, 2, seed) * 9, 0.8, CHERRY.c, CHERRY.d, CHERRY.s);
          }
        break;
      default:
        bush(s, x, y, 3, 6, C.leaf, seed);
    }
    if (ready) s.plot(x + 4, y - 3, SOIL_Z + 16, alpha(at(C.gold, 5), 0.9));
    return s.sprite();
  } finally {
    SOIL_Z = saved;
  }
}
