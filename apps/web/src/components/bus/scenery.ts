// La vista por la ventana del Megabús, dibujada por código con el motor pixel: tiras que se repiten de lado
// para el parallax (nubes, la cordillera con el nevado, los cafetales, el medio con guaduales, postes y
// casitas paisas, y adelante la baranda del carril con el pasto), más lo que pasa por el vidrio (gotas,
// lluvia, nieve). Todo con el tono del momento del día (de noche, las ventanas de las casitas y los postes
// prendidos) y la estación. Solo en el navegador; se dibuja una vez por momento, estación y clima.
import { alpha, at, C, hex, mix, noise, OUT, PixelCanvas, raindrop, snowflake, type RGBA } from "@hyvento/map/art";
import { isWet, type Season, type SkyPhase, type Weather } from "@hyvento/shared";
import { AUTUMN, blit, drawStars, drawSun, finish, grassRamp, pine, url, WINTER_PINE, wrap } from "../entry/scenery";

/** Alto de la vista en píxeles de arte (todas las tiras miden esto y se apoyan abajo). */
export const TRIP_H = 120;

export interface TripMood {
  phase: SkyPhase;
  season: Season;
  weather: Weather;
}

/** Una tira del paisaje: imagen, ancho (se repite cada tanto) y segundos por vuelta a toda velocidad. */
export interface TripStrip {
  src: string;
  w: number;
  secs: number;
}

/** Lo que cae afuera (lluvia o nieve): un mosaico que se corre en diagonal. */
export interface TripFall {
  kind: "rain" | "snow";
  src: string;
  /** Lado del mosaico (px de arte). */
  size: number;
  /** Segundos por vuelta del mosaico. */
  secs: number;
}

export interface TripScenery {
  clouds: TripStrip;
  mountains: TripStrip;
  cafetal: TripStrip;
  middle: TripStrip;
  near: TripStrip;
  stars: string | null;
  sun: string;
  fall: TripFall | null;
  /** Gotas quietas en el vidrio y los hilos que bajan (con lluvia). */
  glass: { drops: string; trails: string; size: number } | null;
}

const TAU = Math.PI * 2;
/** Distancia en x dentro de una tira que se repite (para los bultos de las montañas). */
const wrapDist = (x: number, c: number, w: number) => {
  const d = Math.abs(x - c) % w;
  return Math.min(d, w - d);
};
const bump = (x: number, c: number, r: number, w: number) => Math.exp(-((wrapDist(x, c, w) / r) ** 2));

/** Con lluvia, niebla o nublado todo se ve más lavado (más mientras más lejos: `k`). */
function wash(c: PixelCanvas, weather: Weather, k: number): PixelCanvas {
  const toward = isWet(weather) ? hex("#6c7480") : weather === "niebla" ? hex("#dde2e6") : weather === "nublado" ? hex("#8e959c") : null;
  if (!toward) return c;
  const t = (weather === "niebla" ? 0.5 : isWet(weather) ? 0.32 : 0.18) * k;
  const d = c.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = Math.round(d[i]! + (toward[0] - d[i]!) * t);
    d[i + 1] = Math.round(d[i + 1]! + (toward[1] - d[i + 1]!) * t);
    d[i + 2] = Math.round(d[i + 2]! + (toward[2] - d[i + 2]!) * t);
  }
  return c;
}

/** El tono del momento, lo lavado del clima y encima las luces (que no se tiñen). */
const tone = (c: PixelCanvas, mood: TripMood, k: number, lights?: PixelCanvas) => finish(wash(c, mood.weather, k), mood.phase, lights);

// ---------- Nubes ----------

function drawClouds({ phase, weather }: TripMood): TripStrip {
  const W = 384;
  const c = new PixelCanvas(W, TRIP_H);
  const grey = isWet(weather) || weather === "nublado";
  const night = phase === "noche";
  const body = night ? hex(grey ? "#4b4f6e" : "#6b6f9a") : grey ? hex("#b9bec4") : phase === "dia" ? at(C.white, 4) : hex("#fbe3d2");
  const shade = night ? hex(grey ? "#383b58" : "#4d5180") : grey ? hex("#8d939b") : phase === "dia" ? at(C.blue, 5) : hex("#e9b8b0");
  const puffs: [number, number, number][] = [
    [20, 14, 1.1],
    [120, 24, 0.7],
    [205, 10, 1.3],
    [300, 28, 0.8],
  ];
  // Con el cielo tapado, más nubes y más gordas.
  if (grey)
    puffs.push(
      [70, 8, 1.4],
      [165, 30, 1],
      [255, 18, 1.2],
      [350, 12, 1.1],
    );
  for (const [x0, y0, s] of puffs)
    wrap(W, x0, (x) => {
      const w = Math.round(24 * s);
      c.ellipse(x, y0 + 2, w, 4 * s + 1, shade);
      c.ellipse(x - w * 0.35, y0, w * 0.5, 4 * s + 1, body);
      c.ellipse(x + w * 0.2, y0 - 2 * s, w * 0.55, 5 * s + 1, body);
      c.rect(Math.round(x - w), Math.round(y0 + 2 + 4 * s), w * 2, 1, shade);
    });
  return { src: url(c), w: W, secs: 260 };
}

// ---------- La cordillera ----------

function drawMountains(mood: TripMood): TripStrip {
  const W = 480;
  const c = new PixelCanvas(W, TRIP_H);
  const winter = mood.season === "invierno";
  const farBase = mix(at(C.blue, 3), at(C.sage, 2), 0.45);
  const farLight = mix(farBase, at(C.white, 4), 0.25);
  let near = mix(at(C.green, 2), at(C.blue, 2), 0.3);
  if (mood.season === "otono") near = mix(near, hex("#9a7a3a"), 0.25);
  if (winter) near = mix(near, hex("#dfe8ee"), 0.35);
  const snow = at(C.white, 4);
  const snowShade = mix(at(C.white, 3), at(C.blue, 4), 0.35);
  // En invierno la nieve baja más.
  const snowLine = winter ? 40 : 30;
  // La cordillera de atrás con dos nevados (picos gaussianos) y sumas de senos de período W: empalma sola.
  const ridge = (x: number) => 46 + Math.sin((x / W) * TAU * 3 + 0.4) * 5 + Math.sin((x / W) * TAU * 7) * 2 - 26 * bump(x, 130, 34, W) - 18 * bump(x, 360, 26, W);
  for (let x = 0; x < W; x++) {
    const far = ridge(x);
    const f = Math.round(far);
    // La cara que sube hacia la derecha recibe la luz (la de la izquierda del pico).
    const lit = far - ridge(x + 1) > 0;
    for (let y = f; y < TRIP_H; y++) {
      let col = y === f ? farLight : lit ? farBase : mix(farBase, OUT, 0.08);
      if (y < snowLine + noise(x, 0, 3) * 3) col = lit || y === f ? snow : snowShade;
      c.set(x, y, col);
    }
    const n = Math.round(62 + Math.sin((x / W) * TAU * 4 + 2) * 6 + Math.sin((x / W) * TAU * 9 + 1) * 2);
    for (let y = n; y < TRIP_H; y++) {
      const dither = (x + y) % 4 === 0 && y > n + 2;
      c.set(x, y, y === n ? mix(near, at(C.white, 4), 0.2) : dither ? mix(near, OUT, 0.15) : near);
    }
  }
  return { src: url(tone(c, mood, 1.4)), w: W, secs: 150 };
}

// ---------- Los cafetales ----------

function drawCafetal(mood: TripMood): TripStrip {
  const W = 320;
  const c = new PixelCanvas(W, TRIP_H);
  const { season } = mood;
  const grass = grassRamp(season);
  const bush = season === "invierno" ? WINTER_PINE : C.leaf;
  const hill = (x: number) => 70 + Math.sin((x / W) * TAU * 2 + 1.2) * 5 + Math.sin((x / W) * TAU * 5) * 1.5;
  for (let x = 0; x < W; x++) {
    const h = Math.round(hill(x));
    for (let y = h; y < TRIP_H; y++) c.set(x, y, at(grass, y === h ? 4 : noise(x, y, 5) > 0.9 ? 2 : 3));
  }
  // Los surcos del café siguiendo la loma: matas redonditas, con granos rojos en la cosecha (otoño).
  for (let r = 0; r < 6; r++)
    for (let x = (r % 2) * 2; x < W; x += 4) {
      const y = Math.round(hill(x) + 3 + r * 4 + Math.sin((x / W) * TAU * 3 + r) * 0.8);
      c.ellipse(x + 0.5, y, 1.8, 1.4, at(bush, 1));
      c.set(x, y - 1, at(bush, 3));
      if (season === "invierno") c.set(x, y - 1, at(C.white, 4));
      else if ((season === "otono" || season === "verano") && noise(x, r, 9) > 0.7) c.set(x + 1, y, at(C.rug, season === "otono" ? 3 : 2));
    }
  // Matas de plátano y guamos de sombrío, de trecho en trecho.
  for (const [x0, kind] of [
    [40, "platano"],
    [96, "guamo"],
    [170, "platano"],
    [236, "guamo"],
    [290, "platano"],
  ] as const)
    wrap(W, x0, (x) => {
      const base = Math.round(hill(x0) + 4);
      if (kind === "platano") {
        c.rect(x, base - 9, 1, 9, at(C.sage, 2));
        const leaf = season === "invierno" ? WINTER_PINE : C.leaf;
        for (const [dx, dy] of [
          [-5, 2],
          [5, 1],
          [-3, -2],
          [4, -3],
        ] as const)
          c.line(x, base - 9, x + dx, base - 9 + dy, at(leaf, dy < 0 ? 4 : 2));
      } else {
        c.rect(x, base - 6, 1, 6, at(C.woodDark, 2));
        const leaves = season === "otono" ? AUTUMN : season === "invierno" ? WINTER_PINE : C.leaf;
        c.ellipse(x, base - 8, 6, 3, at(leaves, 2));
        c.ellipse(x - 1, base - 9, 4, 2, at(leaves, 3));
        if (season === "invierno") c.rect(x - 3, base - 11, 5, 1, at(C.white, 4));
      }
    });
  return { src: url(tone(c, mood, 1)), w: W, secs: 55 };
}

// ---------- El medio: guaduales, postes y casitas ----------

/** Un guadual: varas verdes con nudos que se arquean arriba, con hojitas. */
function guadual(c: PixelCanvas, x: number, base: number, seed: number, season: Season) {
  const stalk = season === "otono" ? [mix(at(C.leaf, 2), at(C.mustard, 3), 0.3), mix(at(C.leaf, 3), at(C.mustard, 4), 0.3)] : [at(C.leaf, 2), at(C.leaf, 4)];
  const leaf = season === "otono" ? AUTUMN : C.leaf;
  for (let i = 0; i < 8; i++) {
    const h = 40 + Math.round(noise(i, seed, 1) * 18);
    const lean = (noise(i, seed, 2) - 0.5) * 10;
    const bx = x + i * 2 - 7;
    let px = bx;
    let py = base;
    for (let k = 0; k <= h; k++) {
      const t = k / h;
      // Se arquea más arriba (las puntas de la guadua se doblan).
      const nx = Math.round(bx + lean * t * t * 1.6);
      const ny = base - k;
      c.set(nx, ny, (k % 6 === 0 ? stalk[0] : stalk[1])!);
      if (k % 6 === 0) c.set(nx + 1, ny, at(C.leaf, 1));
      px = nx;
      py = ny;
    }
    // Hojitas en la punta y de a ratos.
    for (let k = 0; k < 5; k++) {
      const ly = py + k * 3;
      const dir = (k + i) % 2 ? 1 : -1;
      c.line(px, ly, px + dir * 3, ly + 1, at(leaf, 3));
      if (season === "invierno" && k === 0) c.set(px, ly - 1, at(C.white, 4));
    }
  }
}

/** Una casita de la vereda: paredes blancas, zócalo y puerta de color, tejas de barro y alero. */
function casita(c: PixelCanvas, lights: PixelCanvas, x0: number, base: number, color: number, mood: TripMood) {
  const W = 30;
  const wallH = 15;
  const top = base - wallH;
  const accents = [C.rug, C.fabric, C.green, C.mustard];
  const acc = accents[color % accents.length]!;
  const lit = mood.phase === "noche" || mood.phase === "atardecer";
  // Paredes encaladas.
  for (let y = top; y < base; y++) for (let x = x0; x < x0 + W; x++) c.set(x, y, at(C.cream, noise(x, y, 31) > 0.92 ? 4 : 5));
  // Zócalo de color.
  c.rect(x0, base - 4, W, 4, at(acc, 2));
  c.rect(x0, base - 4, W, 1, at(acc, 3));
  // Puerta y dos ventanas con marco del color.
  c.rect(x0 + 12, base - 11, 6, 11, at(acc, 2));
  c.rect(x0 + 13, base - 10, 4, 10, at(acc, 3));
  c.set(x0 + 16, base - 5, at(C.gold, 4));
  for (const wx of [x0 + 3, x0 + 22]) {
    c.rect(wx - 1, top + 3, 7, 7, at(acc, 2));
    c.rect(wx, top + 4, 5, 5, lit ? at(C.gold, 4) : at(C.blue, 2));
    c.rect(wx + 2, top + 4, 1, 5, at(acc, 1));
    if (lit) {
      lights.rect(wx, top + 4, 2, 5, at(C.gold, 5));
      lights.rect(wx + 3, top + 4, 2, 5, at(C.gold, 4));
      lights.glow(wx + 2.5, top + 6.5, 8, 6, at(C.gold, 4), mood.phase === "noche" ? 0.32 : 0.16, 2);
    }
    // Materas con flores en el alféizar (menos en invierno).
    if (mood.season !== "invierno") for (let k = 0; k < 3; k++) c.set(wx + k * 2, top + 10, k % 2 ? at(C.rose, 4) : at(C.leaf, 4));
  }
  // El techo de tejas con alero.
  for (let y = 0; y < 8; y++) {
    const inset = Math.round((8 - y) * 0.9);
    for (let x = x0 - 3 + inset; x < x0 + W + 3 - inset; x++) {
      const band = y % 3;
      c.set(x, top - 8 + y, at(C.roof, y === 7 ? 1 : band === 0 ? 4 : (x + y) % 4 === 0 ? 2 : 3));
    }
  }
  if (mood.season === "invierno") for (let x = x0 + 4; x < x0 + W - 4; x++) c.set(x, top - 8, at(C.white, 4));
}

function drawMiddle(mood: TripMood): TripStrip {
  const W = 384;
  const c = new PixelCanvas(W, TRIP_H);
  const lights = new PixelCanvas(W, TRIP_H);
  const { season, phase } = mood;
  const grass = grassRamp(season);
  const base = 92;
  const lit = phase === "noche" || phase === "atardecer";
  for (let y = 86; y < TRIP_H; y++) for (let x = 0; x < W; x++) c.set(x, y, at(grass, y === 86 ? 4 : noise(x, y, 41) > 0.88 ? 2 : 3));
  // Pinos y guaduales al fondo del medio, casitas delante.
  wrap(W, 160, (x) => pine(c, x, base - 2, 30, season));
  for (const [x0, seed] of [
    [30, 1],
    [218, 2],
    [338, 3],
  ] as const)
    wrap(W, x0, (x) => guadual(c, x, base, seed, season));
  for (const [x0, color] of [
    [84, 0],
    [262, 1],
  ] as const)
    wrap(W, x0, (x) => casita(c, lights, Math.round(x), base, color, mood));
  // Postes de la luz cada 64 (el ancho es múltiplo: los cables empalman), con su lámpara y los cables.
  const SPAN = 64;
  const poleTop = 38;
  const concrete = C.cream;
  for (let i = 0; i < W / SPAN; i++)
    wrap(W, 12 + i * SPAN, (x) => {
      c.rect(x - 1, poleTop, 3, base - poleTop, at(concrete, 2));
      c.rect(x - 1, poleTop, 1, base - poleTop, at(concrete, 3));
      c.rect(x - 6, poleTop + 3, 13, 1, at(C.woodDark, 2));
      // La lámpara: brazo hacia la calle y la cabeza.
      c.line(x + 1, poleTop + 12, x + 6, poleTop + 10, at(concrete, 1));
      c.rect(x + 5, poleTop + 10, 4, 2, at(C.stone, 1));
      c.rect(x + 6, poleTop + 12, 2, 1, lit ? at(C.gold, 5) : at(C.stone, 3));
      if (lit) {
        lights.rect(x + 6, poleTop + 12, 2, 1, at(C.gold, 5));
        lights.glow(x + 7, poleTop + 13, 7, 5, at(C.gold, 4), phase === "noche" ? 0.38 : 0.2, 3);
        lights.glow(x + 7, base + 2, 14, 3, at(C.gold, 4), phase === "noche" ? 0.25 : 0.12, 2);
      }
    });
  // Los cables, con su comba entre poste y poste.
  for (let x = 0; x < W; x++) {
    const t = (((x - 12) % SPAN) + SPAN) % SPAN / SPAN;
    const sag = Math.sin(Math.PI * t) * 4;
    c.set(x, Math.round(poleTop + 3 + sag), alpha(at(C.night, 0), 0.85));
    c.set(x, Math.round(poleTop + 6 + sag * 1.2), alpha(at(C.night, 0), 0.6));
  }
  return { src: url(tone(c, mood, 0.6, lights)), w: W, secs: 16 };
}

// ---------- Adelante: la baranda del carril y el pasto ----------

function drawNear(mood: TripMood): TripStrip {
  const W = 192;
  const c = new PixelCanvas(W, TRIP_H);
  const { season } = mood;
  const grass = grassRamp(season);
  const winter = season === "invierno";
  for (let y = 96; y < TRIP_H; y++) for (let x = 0; x < W; x++) c.set(x, y, at(grass, y === 96 ? 4 : noise(x >> 1, y, 51) > 0.86 ? 2 : 3));
  // La baranda: postes cada 24 y la lámina ondulada (gris tibio, con el brillo arriba).
  const rail: RGBA[] = [hex("#56544f"), hex("#8b8881"), hex("#aaa79f"), hex("#cfccc4")];
  for (let i = 0; i < W / 24; i++)
    wrap(W, 6 + i * 24, (x) => {
      c.rect(x, 99, 3, 14, rail[0]!);
      c.rect(x, 99, 1, 14, rail[1]!);
    });
  for (let x = 0; x < W; x++) {
    c.set(x, 100, winter ? at(C.white, 4) : rail[3]!);
    c.set(x, 101, rail[2]!);
    c.set(x, 102, x % 6 < 3 ? rail[1]! : rail[2]!);
    c.set(x, 103, rail[1]!);
    c.set(x, 104, rail[0]!);
  }
  // Las reflectivas de la baranda (amarillas, cada dos postes).
  for (let i = 0; i < W / 48; i++) wrap(W, 18 + i * 48, (x) => c.rect(x, 101, 2, 2, at(C.gold, 4)));
  // Matas de pasto alto delante.
  for (let i = 0; i < 18; i++)
    wrap(W, i * 11 + noise(i, 3, 61) * 6, (x) => {
      const h = 5 + Math.round(noise(i, 4, 61) * 7);
      for (let k = -2; k <= 2; k++) c.line(x, TRIP_H, x + k, TRIP_H - h + Math.abs(k), at(grass, 2 + (k & 1) * 2));
      if (winter) c.set(x, TRIP_H - h, at(C.white, 4));
    });
  if (!winter)
    for (let i = 0; i < 6; i++)
      wrap(W, i * 32 + 14, (x) => {
        c.set(x, 110, at(i % 2 ? C.rose : C.gold, 5));
        c.set(x + 1, 111, at(C.leaf, 3));
      });
  return { src: url(tone(c, mood, 0.25)), w: W, secs: 3.2 };
}

// ---------- Lo que pasa por el vidrio ----------

/** Gotas quietas pegadas al vidrio: un mosaico de `size`. */
function glassDrops(size: number): string {
  const c = new PixelCanvas(size, size);
  const body = hex("#dce8f2", 90);
  const lite = hex("#ffffff", 190);
  const dark = hex("#5d7088", 110);
  for (let i = 0; i < 11; i++) {
    const x = Math.floor(noise(i, 1, 71) * (size - 3));
    const y = Math.floor(noise(i, 2, 71) * (size - 4));
    const big = noise(i, 3, 71) > 0.6;
    c.rect(x, y, 2, big ? 3 : 2, body);
    c.set(x, y, lite);
    c.set(x + 1, y + (big ? 2 : 1), dark);
    if (big) c.set(x + 2, y + 1, body);
  }
  return url(c);
}

/** Hilos de agua que bajan por el vidrio (el mosaico se corre hacia abajo). */
function glassTrails(size: number): string {
  const c = new PixelCanvas(size, size);
  for (let i = 0; i < 4; i++) {
    let x = Math.floor(noise(i, 5, 73) * (size - 2));
    const y0 = Math.floor(noise(i, 6, 73) * size);
    const len = 14 + Math.floor(noise(i, 7, 73) * 22);
    for (let k = 0; k < len; k++) {
      if (noise(i, k, 74) > 0.86) x += noise(k, i, 75) > 0.5 ? 1 : -1;
      c.set(x, (y0 + k) % size, hex("#d8e6f0", 60 + Math.round((k / len) * 80)));
    }
    const y = (y0 + len) % size;
    c.rect(x, y, 2, 2, hex("#e8f2fa", 170));
    c.set(x, y, hex("#ffffff", 220));
  }
  return url(c);
}

function rainTile(heavy: boolean): TripFall {
  const size = 48;
  const c = new PixelCanvas(size, size);
  const n = heavy ? 16 : 10;
  for (let i = 0; i < n; i++) {
    const d = raindrop(heavy ? 8 : 6, heavy);
    const x = Math.floor(noise(i, 1, 81) * size);
    const y = Math.floor(noise(i, 2, 81) * size);
    // Envuelto en los cuatro lados para que el mosaico empalme.
    for (const ox of [0, -size]) for (const oy of [0, -size]) blit(c, d, x + ox, y + oy);
  }
  return { kind: "rain", src: url(c), size, secs: heavy ? 0.35 : 0.5 };
}

function snowTile(): TripFall {
  const size = 96;
  const c = new PixelCanvas(size, size);
  for (let i = 0; i < 18; i++) {
    const f = snowflake(noise(i, 3, 91) > 0.55 ? 1 : 0);
    const x = Math.floor(noise(i, 1, 91) * size);
    const y = Math.floor(noise(i, 2, 91) * size);
    for (const ox of [0, -size]) for (const oy of [0, -size]) blit(c, f, x + ox, y + oy);
  }
  return { kind: "snow", src: url(c), size, secs: 5 };
}

/** Todo lo de la ventana para un momento, una estación y un clima. */
export function drawTripScenery(mood: TripMood): TripScenery {
  const wet = isWet(mood.weather);
  const snowing = mood.weather === "nieve" || (mood.season === "invierno" && !wet);
  const night = mood.phase === "noche" || mood.phase === "amanecer";
  return {
    clouds: drawClouds(mood),
    mountains: drawMountains(mood),
    cafetal: drawCafetal(mood),
    middle: drawMiddle(mood),
    near: drawNear(mood),
    // Con el cielo tapado no se ven estrellas.
    stars: night && !wet && mood.weather !== "nublado" ? drawStars() : null,
    sun: drawSun(mood.phase),
    fall: wet ? rainTile(mood.weather === "tormenta") : snowing ? snowTile() : null,
    glass: wet ? { drops: glassDrops(64), trails: glassTrails(64), size: 64 } : null,
  };
}
