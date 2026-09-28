// La tina caliente y la sauna de barril de la orilla este del lago: la tinaja redonda de duelas con su
// estufa de leña adentro, la sauna acostada (la base con la banca y la estufa, y el barril con el techito
// de tejas, la puerta y las toallas colgadas, que se transparenta con alguien adentro) y el reflejo de las
// luces en el lago. Y lo que el cliente anima encima: el agua que se mueve y los destellos del reflejo.
// Coordenadas locales de arte (tile = 16).
import { SPA, TUB_SIZE, TUB_WATER_Z } from "../world/catalog-tina";
import { Escena, type Limites, type Tinte } from "./exterior-escena";
import { C, mix } from "./palette";
import { PixelCanvas, alpha, at, bayer, noise, smoothNoise, toScreen, type RGBA, type Ramp, type Sprite } from "./pixel";

const L = 16;
const scene = (w: number, d: number, h: number, pad = 6, z0 = -2) => new Escena({ x0: -pad, y0: -pad, z0, x1: w * L + pad, y1: d * L + pad, z1: h }, 2);
const flatT = (c: RGBA): Tinte => () => c;

/** Agua de la tina: verde azulado hondo (la madera la entibia), de lo oscuro a los brillos. */
export const TUB_WATER: Ramp = [
  [20, 64, 74, 255],
  [28, 88, 98, 255],
  [44, 118, 122, 255],
  [72, 150, 146, 255],
  [128, 192, 180, 255],
  [214, 238, 226, 255],
];
/** Bronce cálido de los aros y la estufa (nada de fierro gris). */
const BRONZE: Ramp = [mix(C.gold[0]!, C.woodDark[1]!, 0.4), C.gold[1]!, mix(C.gold[2]!, C.terracotta[3]!, 0.3), C.gold[3]!, C.gold[4]!];
/** Bronce ennegrecido por el fuego: la estufa de la tina y su caño. */
const STOVE: Ramp = [C.woodDark[0]!, C.woodDark[1]!, mix(C.woodDark[2]!, C.gold[1]!, 0.35), mix(C.woodDark[3]!, C.gold[2]!, 0.45)];
/** Piedra tibia de la estufa de la sauna. */
const WARM_STONE: Ramp = [mix(C.stone[1]!, C.cork[1]!, 0.4), mix(C.stone[2]!, C.cork[2]!, 0.45), mix(C.stone[3]!, C.cream[2]!, 0.5), mix(C.stone[4]!, C.cream[3]!, 0.55), C.cream[4]!];

// ---------- La tina ----------

/** Centro, radios (afuera y adentro de las duelas) y alto de la tina; la estufa va al noroeste, adentro. */
const TUB = { cx: (TUB_SIZE[0] * L) / 2, cy: (TUB_SIZE[1] * L) / 2, R: 21, r: 18.4, H: TUB_WATER_Z + 3 };
const HEATER = { x: 13.5, y: 13.5 };
/** Tope del caño de la estufa de la tina (para el humo que anima el cliente). */
export const TUB_CHIMNEY_TOP = { x: HEATER.x, y: HEATER.y, z: TUB_WATER_Z + 21 };

/** Una duela de madera (tono según la duela, la luz y lo mojado abajo), con sus juntas. */
function stave(ang: number, radius: number, v: number, luz: number, damp: number): RGBA {
  const k = ((ang + 8) * radius) / 3.4;
  if (k % 1 < 0.14) return at(C.woodDark, 2);
  const i = Math.floor(k);
  let t = 3 + (noise(i, 3, 17) < 0.35 ? -1 : noise(i, 4, 17) > 0.8 ? 1 : 0) + (luz > 0.35 ? 1 : luz < -0.3 ? -1 : 0);
  if (v < damp) t -= 1;
  return at(C.wood, t);
}

/** La tinaja: duelas con dos aros de bronce, el agua caliente, la banca de adentro y la estufa con su caño. */
function drawHotTub(night: boolean): Sprite {
  const { cx, cy, R, r, H } = TUB;
  const WZ = TUB_WATER_Z;
  const s = scene(TUB_SIZE[0], TUB_SIZE[1], WZ + 40, 4);
  s.roundShadow(cx + 1, cy + 1.5, R + 1.5, 0.3);
  // Por fuera: las duelas y los aros (con remaches), un poco más oscuras abajo, donde salpica.
  s.cylinder(cx, cy, 0, R, H, (ang, v, luz) => {
    const hoop = (v > 2 && v < 3.6) || (v > H - 4.4 && v < H - 2.8);
    if (hoop) {
      const rivet = ((ang + 8) * R) % 9 < 0.8;
      return at(BRONZE, rivet ? 4 : luz > 0.3 ? 3 : luz < -0.3 ? 1 : 2);
    }
    return stave(ang, R, v, luz, 1.2);
  });
  // Por dentro se ve la mitad del fondo (noroeste): madera mojada, más oscura cerca del agua.
  for (let a = (3 * Math.PI) / 4 - 0.35; a <= (7 * Math.PI) / 4 + 0.35; a += 0.02)
    for (let z = WZ; z < H; z += 0.4) {
      const c = stave(a, r, z - WZ, -0.4, 1.6);
      s.plot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z, z - WZ < 1.2 ? mix(c, at(TUB_WATER, 1), 0.45) : c);
    }
  // El canto de arriba: las puntas de las duelas.
  for (let dy = -R; dy <= R; dy += 0.4)
    for (let dx = -R; dx <= R; dx += 0.4) {
      const d = Math.hypot(dx, dy);
      if (d < r || d > R) continue;
      const k = ((Math.atan2(dy, dx) + 8) * R) / 3.4;
      s.plot(cx + dx, cy + dy, H, k % 1 < 0.16 ? at(C.wood, 3) : at(C.wood, d > R - 0.8 ? 4 : 5));
    }
  // El agua: más oscura contra la pared del fondo, la banca de adentro que se ve bajo el agua y ondas.
  s.disc(cx, cy, WZ, r - 0.1, (dx, dy) => {
    const d = Math.hypot(dx, dy);
    const back = (dx + dy) / (r * 1.41);
    const x = cx + dx;
    const y = cy + dy;
    let k = 2 + smoothNoise(x, y, 7, 91) * 0.9 + (bayer(Math.floor(x * 2), Math.floor(y * 2)) - 0.5) * 0.4;
    if (back < -0.55) k -= 1;
    if (d > 12.6 && d < 16.8) k += 0.7;
    if (Math.abs(Math.sin(d * 0.9 - smoothNoise(x, y, 5, 92) * 3)) > 0.97 && d < 15) k += 1.4;
    const c = at(TUB_WATER, Math.max(0, Math.min(4, Math.round(k))));
    // De noche la luz de adentro entibia el agua hacia el centro.
    return night ? mix(c, at(C.gold, 3), Math.max(0, 0.34 - d / 60)) : c;
  });
  // La estufa de leña: una caja de bronce oscuro que asoma del agua, con la puertita del fuego, y su caño.
  s.box(HEATER.x - 3.5, HEATER.y - 3.5, WZ - 1, 7, 7, 4.5, flatT(at(STOVE, 2)), (u, v) => (u > 2 && u < 5 && v > 1.2 && v < 3.6 ? at(C.fire, night ? 4 : 2) : at(STOVE, 1)), () => at(STOVE, 0));
  s.cylinder(HEATER.x, HEATER.y, WZ + 3.5, 1.3, TUB_CHIMNEY_TOP.z - WZ - 5.5, (_a, v, luz) => (v % 6 < 0.7 ? at(STOVE, 0) : at(STOVE, luz > 0.3 ? 3 : luz < -0.2 ? 1 : 2)));
  s.disc(HEATER.x, HEATER.y, TUB_CHIMNEY_TOP.z - 2, 2.2, () => at(STOVE, 2));
  s.cone(HEATER.x, HEATER.y, TUB_CHIMNEY_TOP.z - 2, 2.2, 1.6, (_a, _s, luz) => at(STOVE, luz > 0.3 ? 3 : 1));
  // Una toalla colgada del canto, del lado del frente (se ve usada).
  for (let a = 0.35; a < 0.72; a += 0.012) {
    const stripe = Math.floor((a - 0.35) / 0.07) % 3 === 1;
    const col = stripe ? C.rug : C.cream;
    for (let v = H - 7; v < H + 0.6; v += 0.4) s.plot(cx + Math.cos(a) * (R + 0.6), cy + Math.sin(a) * (R + 0.6), v, at(col, v < H - 5.5 ? 3 : 4));
    for (let t = R + 0.6; t > r + 0.5; t -= 0.4) s.plot(cx + Math.cos(a) * t, cy + Math.sin(a) * t, H + 0.6, at(col, 5));
  }
  // Un poquito de vapor quieto sobre el agua (el cliente anima el resto).
  s.borde = false;
  for (let i = 0; i < 90; i++) {
    const a = noise(i, 1, 93) * Math.PI * 2;
    const d = noise(i, 2, 93) * (r - 4);
    const z = WZ + 2 + noise(i, 3, 93) * 7;
    s.plot(cx + Math.cos(a) * d, cy + Math.sin(a) * d, z, alpha(at(C.cream, 5), 0.22 + noise(i, 4, 93) * 0.2));
  }
  s.borde = true;
  return s.sprite();
}

// ---------- El deck ----------

/** Tablas del deck a lo largo de x, con juntas, clavos y alguna tabla más gastada. */
function deckBoard(x: number, y: number): RGBA {
  const row = Math.floor(y / 4);
  const off = noise(row, 2, 7) * 40;
  if (y % 4 < 0.7) return at(C.woodDark, 2);
  const seg = Math.floor((x + off) / 40);
  if ((x + off) % 40 < 0.6) return at(C.woodDark, 3);
  if ((x + off) % 40 > 38.4 && y % 4 > 1.4 && y % 4 < 2.4) return at(C.woodDark, 2);
  const t = noise(seg, row, 11);
  return at(C.wood, t < 0.18 ? 3 : t > 0.8 ? 5 : 4);
}

/**
 * El deck: tablas con su marco, el canto del frente y, alrededor de la tina, la madera mojada de lo que
 * salpica; frente a la puerta de la sauna, un felpudo de cuerda. Al oeste, sobre el agua del lago, el
 * reflejo de las luces (va con el deck: es plano y queda debajo de todo, como él).
 */
function drawSpaDeck(night: boolean): Sprite {
  const [w, d] = SPA.deck;
  const s = scene(w, d, 4, 4, -4);
  const W = w * L;
  const D = d * L;
  const tub = { x: (SPA.tub[0] + TUB_SIZE[0] / 2) * L, y: (SPA.tub[1] + TUB_SIZE[1] / 2) * L };
  const mat = { x0: SPA.sauna[0] * L + 3, x1: (SPA.sauna[0] + 2) * L - 3, y0: (SPA.sauna[1] + 3) * L + 1, y1: (SPA.sauna[1] + 3) * L + 9 };
  s.box(
    0,
    0,
    -2,
    W,
    D,
    2,
    (x, y) => {
      if (x < 2 || y < 2 || x > W - 2 || y > D - 2) return at(C.woodDark, 4);
      if (x > mat.x0 && x < mat.x1 && y > mat.y0 && y < mat.y1) return at(C.cork, (Math.floor(x) + Math.floor(y)) % 3 ? 3 : 2);
      const c = deckBoard(x, y);
      // Lo mojado alrededor de la tina, a manchas.
      const wet = Math.hypot(x - tub.x, y - tub.y) - 24 - smoothNoise(x, y, 5, 61) * 9;
      return wet < 0 ? mix(c, at(C.woodDark, 1), 0.35) : wet < 3 && bayer(Math.floor(x * 2), Math.floor(y * 2)) < 0.3 ? mix(c, at(C.woodDark, 1), 0.25) : c;
    },
    (u) => at(C.woodDark, Math.floor(u) % 16 === 0 ? 1 : 3),
    (u) => at(C.woodDark, Math.floor(u) % 16 === 0 ? 0 : 2),
  );
  return over(s.sprite(), drawSpaReflection(night));
}

// ---------- La sauna ----------

/** El barril: acostado a lo largo de y, con su eje a la altura Z0 sobre la cuna y la puerta al sur (y = 48). */
const BAR = { cx: 16, z0: 18.5, r: 14.5, y0: 0, y1: 48 };
/**
 * El barril va como mueble aparte en la fila de la banca (1 tile de fondo, 2 más al sur que la base): así se
 * ordena delante de quien está sentado adentro y, transparentado, se lo ve a través. Se dibuja corrido.
 */
const SHELL_DY = -2 * L;
/** Tope del caño de barro de la sauna, relativo al barril (para el humo que anima el cliente). */
export const SAUNA_CHIMNEY_TOP = { x: BAR.cx, y: 9 + SHELL_DY, z: BAR.z0 + BAR.r + 15 };

/** Escena que corre todo lo que pinta en y (el barril, dibujado con las medidas de la base). */
class Corrida extends Escena {
  constructor(
    lim: Limites,
    pad: number,
    private readonly dy: number,
  ) {
    super(lim, pad);
  }

  override plot(x: number, y: number, z: number, c: RGBA | null) {
    super.plot(x, y + this.dy, z, c);
  }
}
const FLOOR_Z = 6.5;

/**
 * La base de la sauna: la cuna de madera, el piso de tablas, la pared de adentro (pino claro), la estufa de
 * piedra con las piedras calientes y el balde, y la banca con respaldo mirando a la puerta.
 */
function drawSauna(night: boolean): Sprite {
  const s = scene(2, 3, 50, 4);
  s.shadow(1, 1, 30, 47, 0.3);
  // La cuna: dos travesaños con el hueco del barril.
  for (const y of [5, 39]) s.box(2, y, 0, 28, 4, 5.5, flatT(at(C.woodDark, 4)), (u) => at(C.woodDark, u % 7 < 0.6 ? 1 : 3), flatT(at(C.woodDark, 2)));
  // Adentro: la pared oeste y la del fondo (norte), de pino claro, con las tablas a lo largo.
  const pine = (u: number, v: number, seed: number) => (v % 3 < 0.45 ? at(C.cork, 2) : at(C.cork, noise(Math.floor(v / 3), Math.floor(u / 12), seed) < 0.3 ? 3 : 4));
  for (let t = Math.PI * 0.55; t <= Math.PI * 1.25; t += 0.02)
    for (let y = 1; y < 47; y += 0.4) {
      const x = BAR.cx + Math.cos(t) * (BAR.r - 1.2);
      const z = BAR.z0 + Math.sin(t) * (BAR.r - 1.2);
      if (z < FLOOR_Z) continue;
      s.plot(x, y, z, pine(y, t * 14, 5));
    }
  for (let z = FLOOR_Z; z < BAR.z0 + BAR.r; z += 0.4)
    for (let x = 2; x < 30; x += 0.4) {
      if (Math.hypot(x - BAR.cx, z - BAR.z0) > BAR.r - 1.2) continue;
      s.plot(x, 1.2, z, x % 5 < 0.5 ? at(C.cork, 2) : at(C.cork, 4));
    }
  // Un reloj de arena en la pared del fondo.
  s.solid(22, 1.4, 20, 3, 0.6, 0.8, at(C.wood, 4), at(C.wood, 3), at(C.wood, 2));
  s.solid(22, 1.4, 26, 3, 0.6, 0.8, at(C.wood, 4), at(C.wood, 3), at(C.wood, 2));
  for (let z = 20.8; z < 26; z += 0.4) s.plot(23.5, 1.8, z, at(C.gold, Math.abs(z - 23.4) < 0.6 ? 3 : 4));
  // El piso de tablas a lo largo del barril.
  s.box(3, 1.2, FLOOR_Z - 1.5, 26, 45.6, 1.5, (u) => (u % 5 < 0.5 ? at(C.wood, 2) : at(C.wood, 4)), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  // La estufa: piedra tibia con la puertita del fuego al frente y las piedras de la sauna encima.
  s.box(5, 3, FLOOR_Z, 11, 9, 11, flatT(at(WARM_STONE, 3)), (u, v) => {
    if (u > 3 && u < 8 && v > 2 && v < 6) return at(C.fire, night ? 4 : 3);
    return (Math.floor(v / 2.5) + Math.floor(u / 3.5)) % 2 ? at(WARM_STONE, 2) : at(WARM_STONE, 1);
  }, (u, v) => ((Math.floor(v / 2.5) + Math.floor(u / 3)) % 2 ? at(WARM_STONE, 1) : at(WARM_STONE, 0)));
  for (let i = 0; i < 16; i++) {
    const x = 6.5 + noise(i, 1, 55) * 8;
    const y = 4.5 + noise(i, 2, 55) * 6;
    s.disc(x, y, FLOOR_Z + 11.2 + noise(i, 3, 55) * 0.8, 1.5, (dx, dy) => at(WARM_STONE, dx + dy < -0.5 ? 4 : dx + dy > 0.6 ? 1 : 2 + (i % 2)));
  }
  // El balde con el cucharón (para echarle agua a las piedras).
  s.cylinder(21, 8, FLOOR_Z, 2.8, 4.5, (ang, v, luz) => (v > 1.2 && v < 2 ? at(BRONZE, 2) : stave(ang, 2.8, v, luz, 0)));
  s.disc(21, 8, FLOOR_Z + 4.5, 2.2, () => at(TUB_WATER, 2));
  for (let t = 0; t <= 1; t += 0.05) s.plot(21 + t * 2.5, 8 - t * 3, FLOOR_Z + 4.8 + t * 3, at(C.wood, 4));
  // La banca: tablas a lo largo, a la altura del asiento, con patas y un respaldo de listones detrás.
  const SEAT = FLOOR_Z + 8.5;
  s.box(3.5, 34, FLOOR_Z, 25, 10, SEAT - FLOOR_Z, (u) => (u % 6 < 0.6 ? at(C.cork, 2) : at(C.cork, 4)), (u, v) => (v > SEAT - FLOOR_Z - 1.6 ? at(C.cork, 3) : u % 12 < 2 ? at(C.wood, 3) : null), flatT(at(C.cork, 2)));
  for (const x of [4, 14.5, 26]) s.solid(x, 43, FLOOR_Z, 1.5, 1, SEAT - FLOOR_Z - 1.4, at(C.wood, 3), at(C.wood, 3), at(C.wood, 2));
  for (let z = SEAT + 2; z < SEAT + 11; z += 3.2) s.solid(3.5, 32.5, z, 25, 1.4, 1.8, at(C.cork, 4), at(C.cork, 3), at(C.cork, 2));
  for (const x of [4, 27]) s.solid(x, 32.2, SEAT, 1.4, 1.6, 12, at(C.wood, 4), at(C.wood, 3), at(C.wood, 2));
  return s.sprite();
}

/** Tono de una duela del barril (a lo largo de y), con los aros de bronce y el tejado encima. */
function barrelWall(t: number, y: number): RGBA | null {
  const nx = Math.cos(t);
  const nz = Math.sin(t);
  const luz = nz * 0.7 - nx * 0.3 + 0.05;
  const hoop = [4.5, 24, 43.5].some((h) => Math.abs(y - h) < 0.8);
  if (hoop) return at(BRONZE, luz > 0.3 ? 3 : luz < -0.2 ? 1 : 2);
  return stave(t, BAR.r, 5, luz, 0);
}

/**
 * El barril de la sauna: las duelas con tres aros, el techito de tejas encima, la tapa del sur con la
 * puerta y su ventanita redonda (de noche, con la luz de adentro), el caño de barro y dos toallas colgadas
 * del costado este. Se transparenta con alguien adentro (ver catálogo).
 */
function drawSaunaShell(night: boolean): Sprite {
  const s = new Corrida({ x0: -4, y0: SHELL_DY - 4, z0: -2, x1: 2 * L + 4, y1: 3 * L + SHELL_DY + 4, z1: 52 }, 2, SHELL_DY);
  const { cx, z0, r } = BAR;
  // Las duelas (todo el contorno: el z-buffer deja lo que se ve).
  for (let t = -Math.PI; t < Math.PI; t += 0.018)
    for (let y = 0.2; y < 48; y += 0.4) {
      if (t > Math.PI / 2 - 1 && t < Math.PI / 2 + 1) continue; // arriba va el tejado
      s.plot(cx + Math.cos(t) * r, y, z0 + Math.sin(t) * r, barrelWall(t, y));
    }
  // El tejado: hileras de tejas rojizas a lo largo, un poco por fuera y con alero en las puntas.
  for (let t = Math.PI / 2 - 1.08; t < Math.PI / 2 + 1.08; t += 0.015) {
    const row = Math.floor((t - (Math.PI / 2 - 1.08)) / 0.2);
    for (let y = -1.6; y < 49.6; y += 0.4) {
      const off = row % 2 ? 2.5 : 0;
      const joint = (y + off + 10) % 5 < 0.55;
      const edge = ((t - (Math.PI / 2 - 1.08)) / 0.2) % 1 < 0.2;
      const luz = Math.sin(t) * 0.6 - Math.cos(t) * 0.45;
      const k = edge ? 1 : joint ? 2 : luz > 0.35 ? 4 : 3;
      s.plot(cx + Math.cos(t) * (r + 1.2), y, z0 + Math.sin(t) * (r + 1.2), at(C.roof, k - (noise(Math.floor(y / 5), row, 21) < 0.2 ? 1 : 0)));
    }
  }
  // La tapa del sur: tablas verticales, el canto de las duelas y la puerta con su ventanita.
  const DOOR = { x0: 10, x1: 22, z0: 5, z1: 27 };
  const WIN = { x: cx, z: 21.5, r: 3.6 };
  for (let z = z0 - r; z <= z0 + r; z += 0.35)
    for (let x = cx - r; x <= cx + r; x += 0.35) {
      const d = Math.hypot(x - cx, z - z0);
      if (d > r) continue;
      let c: RGBA;
      const inDoor = x > DOOR.x0 && x < DOOR.x1 && z > DOOR.z0 && z < DOOR.z1;
      const w = Math.hypot(x - WIN.x, z - WIN.z);
      if (d > r - 1.1) c = at(C.wood, 3);
      else if (inDoor && w < WIN.r) c = night ? at(w < WIN.r - 1.4 ? C.gold : C.fire, 4) : w < 1.4 && x < WIN.x ? at(C.sky, 4) : at(C.sky, 2);
      else if (inDoor && w < WIN.r + 0.9) c = at(C.woodDark, 2);
      else if (inDoor) c = x < DOOR.x0 + 1 || x > DOOR.x1 - 1 || z > DOOR.z1 - 1 ? at(C.woodDark, 3) : x % 4 < 0.5 ? at(C.wood, 2) : at(C.wood, 3);
      else c = x % 4 < 0.5 ? at(C.wood, 2) : at(C.wood, 4);
      s.plot(x, 48, z, c);
    }
  // El tirador de bronce.
  s.solid(19.5, 48, 14, 1.2, 0.8, 2.4, at(BRONZE, 4), at(BRONZE, 3), at(BRONZE, 2));
  // La tapa del norte (casi no se ve, pero cierra el barril).
  for (let z = z0 - r; z <= z0 + r; z += 0.5)
    for (let x = cx - r; x <= cx + r; x += 0.5) if (Math.hypot(x - cx, z - z0) <= r) s.plot(x, 0, z, at(C.wood, 3));
  // El caño de barro con su sombrerito de tejas.
  const chimneyY = SAUNA_CHIMNEY_TOP.y - SHELL_DY;
  s.cylinder(SAUNA_CHIMNEY_TOP.x, chimneyY, z0 + r - 1, 2.2, 13, (_a, v, luz) => (v > 11.5 ? at(C.terracotta, 2) : at(C.terracotta, luz > 0.3 ? 4 : luz < -0.3 ? 2 : 3)));
  s.cone(SAUNA_CHIMNEY_TOP.x, chimneyY, z0 + r + 13.5, 3.6, 2.4, (_a, _s, luz) => at(C.roof, luz > 0.3 ? 4 : 2));
  // Toallas colgadas de dos ganchos en el costado este (bajan por la curva del barril).
  for (const [y0, col, band] of [
    [11, C.cream, C.rug],
    [28, C.sage, C.cream],
  ] as const) {
    s.solid(cx + Math.cos(0.5) * (r + 0.4), y0 + 3, z0 + Math.sin(0.5) * r + 0.5, 1, 1, 1.2, at(BRONZE, 4), at(BRONZE, 3), at(BRONZE, 2));
    for (let t = 0.5; t > -0.55; t -= 0.02)
      for (let y = y0; y < y0 + 7; y += 0.4) {
        const stripe = Math.floor(y - y0) % 3 === 1;
        s.plot(cx + Math.cos(t) * (r + 0.9), y, z0 + Math.sin(t) * (r + 0.9), at(stripe ? band : col, t > 0.3 ? 5 : t < -0.35 ? 3 : 4));
      }
  }
  return s.sprite();
}

// ---------- El reflejo en el lago ----------

/** La franja de agua del reflejo, en unidades de arte relativas al deck (al oeste de él). */
const RX0 = SPA.reflection[0] * L;
const RY0 = SPA.reflection[1] * L;
const RX1 = RX0 + SPA.reflectionSize[0] * L;
const RY1 = RY0 + SPA.reflectionSize[1] * L;
/**
 * Las luces que se reflejan, en unidades de arte del deck: cada fuente se refleja del otro lado del borde
 * del deck (x = 0), en el agua. `warm`: cuánto brilla de noche.
 */
const REFLECTED = (() => {
  const mirror = (tx: number, ty: number, min: number) => ({ x: Math.min(-min, -tx * L), y: ty * L });
  const out: { x: number; y: number; r: number; warm: number; kind: "lantern" | "tub" }[] = [];
  for (const [lx, ly] of SPA.shoreLanterns) out.push({ ...mirror(lx + 0.5, ly + 0.5, 8), r: 12, warm: 1, kind: "lantern" });
  out.push({ ...mirror(SPA.tub[0] + TUB_SIZE[0] / 2, SPA.tub[1] + TUB_SIZE[1] / 2, 14), r: 15, warm: 0.6, kind: "tub" });
  return out;
})();

/** Recorre los píxeles del plano del agua de la franja (del píxel al punto del lago que se ve ahí). */
function waterPlane(paint: (x: number, y: number, px: number, py: number) => RGBA | null): Sprite {
  const corners = [toScreen(RX0, RY0), toScreen(RX1, RY0), toScreen(RX0, RY1), toScreen(RX1, RY1)];
  const minX = Math.floor(Math.min(...corners.map((c) => c.x)));
  const minY = Math.floor(Math.min(...corners.map((c) => c.y)));
  const maxX = Math.ceil(Math.max(...corners.map((c) => c.x)));
  const maxY = Math.ceil(Math.max(...corners.map((c) => c.y)));
  const canvas = new PixelCanvas(maxX - minX + 1, maxY - minY + 1);
  for (let py = 0; py < canvas.height; py++)
    for (let px = 0; px < canvas.width; px++) {
      const sx = px + 0.5 + minX;
      const sy = py + 0.5 + minY;
      const x = sy + sx / 2;
      const y = sy - sx / 2;
      // Con un poco de aire en los bordes (no se pinta hasta la orilla ni debajo de las tablas).
      if (x < RX0 + 2 || y < RY0 + 2 || x > RX1 - 1.5 || y > RY1 - 2) continue;
      const c = paint(x, y, px, py);
      if (c) canvas.set(px, py, c);
    }
  return { canvas, ox: -minX, oy: -minY };
}

/** `top` encima de `base`, con el mismo origen (un lienzo que cubre a los dos). */
function over(base: Sprite, top: Sprite): Sprite {
  const x0 = Math.min(-base.ox, -top.ox);
  const y0 = Math.min(-base.oy, -top.oy);
  const x1 = Math.max(base.canvas.width - base.ox, top.canvas.width - top.ox);
  const y1 = Math.max(base.canvas.height - base.oy, top.canvas.height - top.oy);
  const canvas = new PixelCanvas(x1 - x0, y1 - y0);
  for (const sp of [base, top])
    for (let y = 0; y < sp.canvas.height; y++)
      for (let x = 0; x < sp.canvas.width; x++) {
        const i = (y * sp.canvas.width + x) * 4;
        const d = sp.canvas.data;
        if (d[i + 3]) canvas.set(x - sp.ox - x0, y - sp.oy - y0, [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!]);
      }
  return { canvas, ox: -x0, oy: -y0 };
}

/**
 * El reflejo quieto: de día, la madera de la tina y el vapor claro, apenas, rotos por las ondas; de noche,
 * el halo tibio del farolito y de la tina sobre el agua oscura.
 */
function drawSpaReflection(night: boolean): Sprite {
  return waterPlane((x, y, px, py) => {
    // Las ondas: filas de pantalla que se cortan cada tanto.
    if ((py + Math.floor(smoothNoise(x, y, 6, 97) * 3)) % 3 === 0) return null;
    for (const s of REFLECTED) {
      const d = Math.hypot((x - s.x) * 0.8, (y - s.y) * 1.25);
      if (d > s.r) continue;
      const k = 1 - d / s.r;
      if (night) {
        if (bayer(px, py) > 0.25 + k * 0.9) continue;
        return alpha(at(k > 0.5 ? C.gold : C.fire, k > 0.5 ? 4 : 3), (0.3 + k * 0.5) * s.warm);
      }
      if (bayer(px, py) > k * 0.8) continue;
      return s.kind === "tub" ? alpha(k > 0.6 ? at(C.cream, 5) : at(C.wood, 2), 0.18 + k * 0.12) : alpha(at(C.woodDark, 2), 0.2);
    }
    return null;
  });
}

/** Destellos del reflejo que se mueven (el cliente cicla los cuadros): rayitas cortas que ondulan. Mismo origen que el deck. */
export const SPA_GLINT_FRAMES = 4;
export function spaGlints(frame: number, night: boolean): Sprite {
  const ph = (frame / SPA_GLINT_FRAMES) * Math.PI * 2;
  return waterPlane((x, y, px, py) => {
    for (const s of REFLECTED) {
      const d = Math.hypot((x - s.x) * 0.8, (y - s.y) * 1.25);
      if (d > s.r * (night ? 1.1 : 0.9)) continue;
      // Rayitas horizontales en pantalla: una fila de cada tres, cortada por una onda que se corre.
      const row = py % 3 === 1;
      const wave = Math.sin(px * 0.5 + ph + Math.floor(py / 3) * 1.7) + Math.sin(px * 0.21 - ph * 0.6 + py * 0.3);
      if (!row || wave < (night ? 0.8 : 1.2) + d / s.r) continue;
      if (night) return alpha(at(d < s.r * 0.4 ? C.gold : C.fire, 4), 0.85 * s.warm + 0.1);
      return alpha(at(TUB_WATER, 5), 0.7);
    }
    return null;
  });
}

// ---------- El agua de la tina (la anima el cliente) ----------

/** Ondas y burbujitas que se mueven sobre el agua de la tina: mismo origen que la tina. */
export const TUB_RIPPLE_FRAMES = 4;
export function tubRipples(frame: number, night: boolean): Sprite {
  const { cx, cy, r } = TUB;
  const WZ = TUB_WATER_Z;
  const corners = [toScreen(cx - r, cy - r, WZ), toScreen(cx + r, cy - r, WZ), toScreen(cx - r, cy + r, WZ), toScreen(cx + r, cy + r, WZ)];
  const minX = Math.floor(Math.min(...corners.map((c) => c.x))) - 1;
  const minY = Math.floor(Math.min(...corners.map((c) => c.y))) - 1;
  const maxX = Math.ceil(Math.max(...corners.map((c) => c.x))) + 1;
  const maxY = Math.ceil(Math.max(...corners.map((c) => c.y))) + 1;
  const canvas = new PixelCanvas(maxX - minX + 1, maxY - minY + 1);
  const ph = (frame / TUB_RIPPLE_FRAMES) * Math.PI * 2;
  const bright = alpha(at(TUB_WATER, 5), night ? 0.6 : 0.7);
  const soft = alpha(at(TUB_WATER, 4), 0.5);
  for (let py = 0; py < canvas.height; py++)
    for (let px = 0; px < canvas.width; px++) {
      const sx = px + 0.5 + minX;
      const sy = py + 0.5 + minY + WZ;
      const x = sy + sx / 2;
      const y = sy - sx / 2;
      const d = Math.hypot(x - cx, y - cy);
      if (d > r - 1.5) continue;
      // Anillos que salen de la estufa (el agua se mueve con el calor) y burbujas que suben y revientan.
      const hd = Math.hypot(x - HEATER.x, y - HEATER.y);
      const ring = Math.sin(hd * 0.8 - ph * 1.5 + Math.sin(x * 0.3 + ph) * 0.8);
      if (ring > 0.93 && hd > 7) canvas.set(px, py, bright);
      else if (ring > 0.82 && hd > 7 && bayer(px, py) < 0.3) canvas.set(px, py, soft);
    }
  for (let i = 0; i < 6; i++) {
    const a = noise(i, frame, 71) * Math.PI * 2;
    const d = 4 + noise(i, frame, 72) * (r - 7);
    const p = toScreen(cx + Math.cos(a) * d, cy + Math.sin(a) * d, WZ);
    const bx = Math.round(p.x - minX);
    const by = Math.round(p.y - minY);
    canvas.set(bx, by, bright);
    if (i % 2) canvas.set(bx + 1, by, soft);
  }
  return { canvas, ox: -minX, oy: -minY };
}

/** Los que tienen versión de noche (las estufas y la ventanita prendidas, el reflejo de las luces en el lago). */
export const TINA_NIGHT: Record<string, (night: boolean) => Sprite> = {
  "hot-tub": drawHotTub,
  sauna: drawSauna,
  "sauna-shell": drawSaunaShell,
  "spa-deck": drawSpaDeck,
};

/** Una bocanada de vapor (el cliente la sube, la agranda y la desvanece). */
export function steamPuff(): PixelCanvas {
  const c = new PixelCanvas(9, 6);
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 9; x++) {
      const d = Math.hypot((x + 0.5 - 4.5) / 4.5, (y + 0.5 - 3) / 3);
      if (d > 1 || bayer(x, y) > 1.15 - d) continue;
      c.set(x, y, alpha(at(C.cream, d < 0.5 ? 5 : 4), 0.75 - d * 0.35));
    }
  return c;
}
