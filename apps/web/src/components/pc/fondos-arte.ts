// El dibujo de los fondos del escritorio: pixel en un canvas chico (192x112) que se estira con
// `pixelated`, como el cielo de la placa del reloj. Se pinta una sola vez por fondo (ver `FondosApp.tsx`):
// nada se anima, así el escritorio no gasta cuadros mientras se trabaja.
import type { Season } from "@hyvento/shared";
import type { FondoId } from "./fondos";

export const FONDO_W = 192;
export const FONDO_H = 112;

type G = CanvasRenderingContext2D;

const rect = (g: G, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** Azar con semilla: estrellas, gotas y hojas quedan siempre en el mismo lugar. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Cielo en franjas (los degradados en pasos del juego). */
function bands(g: G, colors: string[], from: number, to: number) {
  const h = (to - from) / colors.length;
  colors.forEach((c, i) => rect(g, 0, from + i * h, FONDO_W, Math.ceil(h), c));
}

/** Disco relleno fila por fila (sol, luna, copas de árbol). */
function disc(g: G, cx: number, cy: number, r: number, c: string) {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    rect(g, cx - w, cy + dy, w * 2 + 1, 1, c);
  }
}

/** Disco tramado (un pixel sí, uno no): resplandores suaves sin salir de la paleta. */
function ditherDisc(g: G, cx: number, cy: number, r: number, c: string) {
  g.fillStyle = c;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    const y = Math.round(cy + dy);
    for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) if ((x + y) % 2 === 0) g.fillRect(x, y, 1, 1);
  }
}

/** Una franja de cerros: el borde sale de dos senos, de ahí para abajo se rellena. */
function hills(g: G, base: number, amp: number, phase: number, c: string) {
  for (let x = 0; x < FONDO_W; x++) {
    const top = base + Math.round(amp * Math.sin(x / 11 + phase) + (amp / 2) * Math.sin(x / 4.3 + phase * 2));
    rect(g, x, top, 1, FONDO_H - top, c);
  }
}

function pine(g: G, x: number, base: number, h: number, dark: string, light: string) {
  for (let i = 0; i < h; i++) {
    const w = 1 + Math.floor((i * 2) / 3) * 2;
    rect(g, x - Math.floor(w / 2), base - h + i, w, 1, i % 3 === 0 ? light : dark);
  }
  rect(g, x, base, 1, 2, "#3a2418");
}

/** Árbol de copa redonda: tronco, copa en dos tonos y un brillo arriba a la izquierda. */
function tree(g: G, x: number, base: number, r: number, dark: string, light: string, trunk = "#5b2b0e") {
  rect(g, x - 1, base - r, 3, r + 1, trunk);
  disc(g, x, base - r - r / 2, r, dark);
  disc(g, x - Math.ceil(r / 3), base - r - r / 2 - Math.ceil(r / 3), Math.ceil(r / 2), light);
}

interface CabanaColores {
  roof: [string, string];
  wall: string;
  plank: string;
  glass: string;
  snow?: boolean;
}

/** La cabaña de troncos (la de la entrada, en chiquito): techo, tablas, dos ventanas, puerta y chimenea. */
function cabana(g: G, x0: number, y0: number, c: CabanaColores) {
  const w = 44;
  const h = 22;
  rect(g, x0 + w - 12, y0 - 18, 5, 10, "#6e3514");
  for (let i = 0; i < 13; i++) {
    const rw = Math.round(10 + ((w + 10 - 10) * (i + 1)) / 13);
    rect(g, x0 + w / 2 - rw / 2, y0 - 13 + i, rw, 1, c.roof[i % 2]!);
  }
  if (c.snow) {
    for (let i = 0; i < 4; i++) {
      const rw = Math.round(10 + (w * (i + 1)) / 13);
      rect(g, x0 + w / 2 - rw / 2, y0 - 13 + i, rw, 1, i === 3 ? "#cfdcea" : "#f4f8fc");
    }
    rect(g, x0 + w - 12, y0 - 19, 5, 2, "#f4f8fc");
  }
  rect(g, x0, y0, w, h, c.wall);
  for (let y = y0 + 2; y < y0 + h; y += 3) rect(g, x0, y, w, 1, c.plank);
  const win = (wx: number) => {
    rect(g, wx, y0 + 5, 9, 8, "#5b2b0e");
    rect(g, wx + 1, y0 + 6, 7, 6, c.glass);
    rect(g, wx + 4, y0 + 6, 1, 6, "#5b2b0e");
    rect(g, wx + 1, y0 + 8, 7, 1, "#5b2b0e");
  };
  win(x0 + 4);
  win(x0 + w - 13);
  rect(g, x0 + w / 2 - 4, y0 + h - 13, 9, 13, "#5b2b0e");
  rect(g, x0 + w / 2 - 3, y0 + h - 12, 7, 12, "#8a4b1c");
  rect(g, x0 + w / 2 + 2, y0 + h - 6, 1, 1, "#ffcf4a");
  rect(g, x0 - 2, y0 + h, w + 4, 2, "#7a6a5a");
}

// ---------- Cada fondo ----------

/** Solo para la miniatura: en el escritorio el "cielo" es la ilustración de verdad (CabinShowcase). */
function cielo(g: G) {
  rect(g, 0, 0, FONDO_W, FONDO_H, "#5d93cf");
  for (let y = 4; y < FONDO_H; y += 8) for (let x = 4; x < FONDO_W; x += 8) rect(g, x, y, 1, 1, "#7ba8d9");
  hills(g, 86, 2, 0.4, "#5ea247");
  cabana(g, 110, 66, { roof: ["#8a3a1a", "#6e2e14"], wall: "#b3571a", plank: "#8a4b1c", glass: "#9ecbe8" });
  tree(g, 170, 94, 7, "#3f7a36", "#5ea247");
  pine(g, 96, 90, 14, "#2e5a40", "#3f7a36");
}

function noche(g: G) {
  bands(g, ["#15112a", "#1a1532", "#201b3c", "#272246", "#2e2a52"], 0, 70);
  const r = seeded(3);
  for (let i = 0; i < 80; i++) {
    const x = Math.floor(r() * FONDO_W);
    const y = Math.floor(r() * 62);
    const big = i % 11 === 0;
    rect(g, x, y, 1, 1, i % 3 ? "#8a7fa8" : "#e8e0ff");
    if (big) {
      rect(g, x - 1, y, 3, 1, "#fff4c8");
      rect(g, x, y - 1, 1, 3, "#fff4c8");
    }
  }
  disc(g, 156, 20, 8, "#fdf0c8");
  rect(g, 152, 16, 3, 2, "#e6d6a4");
  rect(g, 158, 23, 2, 2, "#e6d6a4");
  hills(g, 66, 4, 1.2, "#27304a");
  for (let x = 4; x < FONDO_W; x += 9) pine(g, x, 80 + ((x * 7) % 5), 12 + ((x * 5) % 8), "#141c26", "#1b2632");
  rect(g, 0, 84, FONDO_W, FONDO_H - 84, "#1c2a26");
  const r2 = seeded(9);
  for (let i = 0; i < 60; i++) rect(g, Math.floor(r2() * FONDO_W), 86 + Math.floor(r2() * 26), 1, 1, "#2a3e36");
  // La luz de las ventanas se derrama sobre el pasto.
  rect(g, 72, 88, 18, 4, "#3a3a2a");
  rect(g, 101, 88, 18, 4, "#3a3a2a");
  cabana(g, 74, 64, { roof: ["#3a1a0a", "#2e1408"], wall: "#6e3514", plank: "#552a10", glass: "#ffcf4a" });
  for (let y = 88; y < FONDO_H; y++) rect(g, 92 + Math.floor((y - 88) * 0.3), y, 8 + Math.floor((y - 88) / 3), 1, "#3a3024");
  // Luciérnagas.
  [
    [24, 78],
    [108, 74],
    [130, 92],
    [170, 80],
    [14, 96],
  ].forEach(([x, y]) => rect(g, x!, y!, 1, 1, "#e8f080"));
}

/**
 * Fogata en el espacio: un planetita abajo a la derecha (el resto queda libre para los íconos) con pinos
 * que salen hacia afuera, la fogata y su columna de humo, alguien sentado al lado y una nave de patas.
 */
function espacio(g: G) {
  rect(g, 0, 0, FONDO_W, FONDO_H, "#0b0a14");
  // Nebulosa tenue y el resplandor verdeazul detrás del borde del planeta.
  ditherDisc(g, 150, 142, 90, "#0c1620");
  ditherDisc(g, 150, 142, 80, "#10262a");
  disc(g, 150, 142, 72, "#0c1a20");
  ditherDisc(g, 150, 142, 72, "#123034");
  const r = seeded(41);
  for (let i = 0; i < 110; i++) {
    const x = Math.floor(r() * FONDO_W);
    const y = Math.floor(r() * FONDO_H);
    rect(g, x, y, 1, 1, i % 4 === 0 ? "#9fb4ff" : i % 3 ? "#5a5a7a" : "#e8e0ff");
    if (i % 17 === 0) {
      rect(g, x - 1, y, 3, 1, "#fdf0c8");
      rect(g, x, y - 1, 1, 3, "#fdf0c8");
    }
  }

  // El planeta: sombra a la izquierda, borde prendido a la derecha.
  const PX = 150;
  const PY = 142;
  const PR = 64;
  disc(g, PX, PY, PR + 1, "#3fa8a0");
  disc(g, PX, PY, PR, "#2e3a2a");
  disc(g, PX + 4, PY + 2, PR - 4, "#3a4a32");
  disc(g, PX + 8, PY + 6, PR - 12, "#44573a");
  disc(g, PX - 58, PY - 30, 30, "#26302a");
  const surf = (deg: number, lift = 0) => {
    const a = (deg * Math.PI) / 180;
    return { x: PX + Math.cos(a) * (PR + lift), y: PY + Math.sin(a) * (PR + lift), nx: Math.cos(a), ny: Math.sin(a) };
  };

  // Pino que sale del planeta hacia afuera (en la dirección del radio).
  const pinoRadial = (deg: number, h: number, dark: string, light: string) => {
    const { x, y, nx, ny } = surf(deg, -1);
    const tx = -ny;
    const ty = nx;
    for (let i = 0; i < h; i++) {
      const cx = x + nx * i;
      const cy = y + ny * i;
      rect(g, cx, cy, 1, 1, "#1a1410");
      if (i < 3) continue;
      const half = Math.max(0, Math.round((h - i) / 3));
      for (let k = -half; k <= half; k++) rect(g, cx + tx * k, cy + ty * k, 1, 1, (i + k) % 4 === 0 ? light : dark);
    }
  };
  pinoRadial(-158, 26, "#141c1a", "#1e2c28");
  pinoRadial(-146, 22, "#141c1a", "#1e2c28");
  pinoRadial(-104, 30, "#16201c", "#24403a");
  pinoRadial(-92, 24, "#16201c", "#24403a");
  pinoRadial(-66, 20, "#18302c", "#2e5a54");

  // La fogata: su luz sobre el suelo, el humo que sube inclinado con chispas, y la llama.
  const fire = surf(-124, 1);
  ditherDisc(g, fire.x, fire.y, 16, "#4a4a2a");
  disc(g, fire.x, fire.y, 10, "#4a4a2a");
  ditherDisc(g, fire.x, fire.y, 10, "#6a5a2a");
  disc(g, fire.x, fire.y, 5, "#6a5a2a");
  ditherDisc(g, fire.x, fire.y, 5, "#8a6a2a");
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = fire.x - 3 - t * 24 + Math.round(Math.sin(i * 1.3) * 2);
    const y = fire.y - 8 - t * 62;
    disc(g, x, y, 2 + Math.round(t * 5), i < 2 ? "#4a3a36" : "#26303a");
    disc(g, x - 1, y - 1, 1 + Math.round(t * 3), i < 2 ? "#5a4640" : "#2e3a44");
  }
  [
    [-3, -10],
    [-7, -16],
    [-5, -22],
    [-11, -26],
    [-9, -33],
  ].forEach(([dx, dy], i) => rect(g, fire.x + dx!, fire.y + dy!, 1, 1, i % 2 ? "#f08a2c" : "#ffcf4a"));
  rect(g, fire.x - 3, fire.y, 7, 1, "#5b2b0e");
  rect(g, fire.x - 2, fire.y - 1, 5, 1, "#8a4b1c");
  rect(g, fire.x - 2, fire.y - 4, 5, 3, "#d93a2b");
  rect(g, fire.x - 1, fire.y - 6, 3, 5, "#f08a2c");
  rect(g, fire.x, fire.y - 8, 1, 6, "#ffcf4a");
  rect(g, fire.x, fire.y - 3, 1, 2, "#fff3c8");

  // Alguien sentado junto al fuego, con el lado de la fogata iluminado.
  const who = surf(-114, 0);
  rect(g, who.x - 2, who.y - 7, 5, 6, "#1a1a22");
  rect(g, who.x + 3, who.y - 3, 3, 2, "#1a1a22");
  disc(g, who.x, who.y - 10, 2, "#1a1a22");
  rect(g, who.x - 2, who.y - 11, 1, 3, "#e0923e");
  rect(g, who.x - 2, who.y - 7, 1, 5, "#c9651c");
  rect(g, who.x - 3, who.y - 5, 1, 1, "#e0923e");
  // Banderita clavada al lado.
  rect(g, who.x + 6, who.y - 12, 1, 11, "#8a7a6a");
  rect(g, who.x + 7, who.y - 12, 4, 3, "#d93a2b");

  // La nave: casco de madera con remaches, ventanita, antena y tres patas sobre el borde.
  const ship = surf(-66, 8);
  const sx = Math.round(ship.x);
  const sy = Math.round(ship.y);
  rect(g, sx - 8, sy - 1, 1, 10, "#5a5a6a");
  rect(g, sx + 7, sy - 1, 1, 10, "#5a5a6a");
  rect(g, sx - 1, sy, 1, 8, "#5a5a6a");
  rect(g, sx - 10, sy + 8, 3, 1, "#5a5a6a");
  rect(g, sx + 7, sy + 8, 3, 1, "#5a5a6a");
  // Casco redondo, fila por fila: el borde de arriba recibe la luz de la fogata.
  const hull = [8, 14, 18, 20, 20, 18, 14];
  hull.forEach((w, i) => {
    const y = sy - 7 + i;
    rect(g, sx - w / 2, y, w, 1, "#2a2224");
    rect(g, sx - w / 2, y, 1, 1, i < 4 ? "#e0923e" : "#8a4b1c");
    if (i === 0) rect(g, sx - w / 2, y, w, 1, "#e0923e");
  });
  rect(g, sx + 10, sy - 4, 3, 4, "#3a2e2a");
  rect(g, sx + 10, sy - 4, 3, 1, "#c9651c");
  rect(g, sx - 4, sy - 5, 5, 3, "#3fa8a0");
  rect(g, sx - 4, sy - 5, 2, 1, "#9fe0d8");
  for (let x = sx - 7; x < sx + 8; x += 4) rect(g, x, sy - 2, 1, 1, "#8a4b1c");
  rect(g, sx + 3, sy - 11, 1, 4, "#5a5a6a");
  rect(g, sx + 1, sy - 12, 5, 1, "#c9651c");
}

function lago(g: G) {
  bands(g, ["#8cc0e6", "#9ccaea", "#aed4ee", "#c2def2"], 0, 52);
  disc(g, 112, 16, 7, "#fff3c8");
  const nube = (x: number, y: number) => {
    rect(g, x, y, 22, 4, "#f6fbff");
    rect(g, x + 4, y - 3, 12, 3, "#f6fbff");
    rect(g, x + 2, y + 4, 18, 1, "#d8e8f4");
  };
  nube(58, 12);
  nube(130, 24);
  hills(g, 44, 5, 0.2, "#8aa6c2");
  hills(g, 54, 3, 2.1, "#4f8a3c");
  for (let x = 2; x < FONDO_W; x += 7) pine(g, x, 58 + ((x * 3) % 3), 8 + ((x * 7) % 6), "#2e5a40", "#3f7a36");
  rect(g, 0, 60, FONDO_W, 38, "#5d93cf");
  // El reflejo de los cerros y las ondas del agua.
  for (let x = 0; x < FONDO_W; x++) rect(g, x, 60, 1, 3 + Math.round(2 * Math.sin(x / 6)), "#3e6f9e");
  const r = seeded(5);
  for (let i = 0; i < 36; i++) rect(g, Math.floor(r() * FONDO_W), 66 + Math.floor(r() * 30), 3 + Math.floor(r() * 6), 1, "#8fbde6");
  rect(g, 106, 70, 14, 1, "#fff3c8");
  rect(g, 108, 74, 10, 1, "#f2e6b8");
  // Orilla: arena y pasto.
  rect(g, 0, 96, FONDO_W, 4, "#d9b57a");
  rect(g, 0, 100, FONDO_W, FONDO_H - 100, "#5ea247");
  for (let x = 1; x < FONDO_W; x += 4) rect(g, x, 100 + ((x * 5) % 9), 1, 1, "#7cc05a");
  // El muelle entra al agua.
  for (let y = 74; y < 98; y += 3) rect(g, 128, y, 16, 2, "#b3571a");
  for (let y = 76; y < 98; y += 3) rect(g, 128, y, 16, 1, "#8a4b1c");
  rect(g, 128, 74, 1, 26, "#5b2b0e");
  rect(g, 143, 74, 1, 26, "#5b2b0e");
  // Juncos.
  [150, 153, 157, 170, 173, 177, 181].forEach((x, i) => {
    rect(g, x, 88 - (i % 3) * 2, 1, 10 + (i % 3) * 2, "#4f8a3c");
    rect(g, x, 88 - (i % 3) * 2, 1, 3, "#8a4b1c");
  });
}

const HOJAS = ["#d9622b", "#e0923e", "#c9851c", "#b3471a", "#e8b04a"];

function otono(g: G) {
  bands(g, ["#f6d49a", "#f3c48a", "#eeb27a", "#e79f6c"], 0, 64);
  disc(g, 150, 30, 10, "#fbe1a4");
  hills(g, 56, 4, 0.8, "#c98a5a");
  for (let x = 0; x < FONDO_W; x += 8) tree(g, x + 4, 70 + ((x * 3) % 4), 5, "#b8663a", "#c97a48", "#6e3514");
  rect(g, 0, 80, FONDO_W, FONDO_H - 80, "#9a7a34");
  const r = seeded(13);
  for (let i = 0; i < 140; i++) rect(g, Math.floor(r() * FONDO_W), 80 + Math.floor(r() * 32), 2, 1, HOJAS[i % HOJAS.length]!);
  for (let y = 80; y < FONDO_H; y++) rect(g, 88 - Math.floor((y - 80) * 0.5), y, 10 + Math.floor((y - 80) * 0.8), 1, "#c8a064");
  [
    [60, 98, 10],
    [112, 92, 8],
    [140, 94, 12],
    [172, 88, 9],
    [128, 84, 6],
  ].forEach(([x, b, rr], i) => tree(g, x!, b!, rr!, HOJAS[i % HOJAS.length]!, HOJAS[(i + 2) % HOJAS.length]!));
  // Hojas que caen.
  const r2 = seeded(21);
  for (let i = 0; i < 34; i++) {
    const x = Math.floor(r2() * FONDO_W);
    const y = Math.floor(r2() * 80);
    rect(g, x, y, 2, 1, HOJAS[i % HOJAS.length]!);
    rect(g, x + 1, y + 1, 1, 1, HOJAS[(i + 1) % HOJAS.length]!);
  }
}

function lluvia(g: G) {
  // Afuera: el jardín gris de lluvia.
  bands(g, ["#6c7d95", "#75879e", "#7f91a8", "#8a9cb2"], 0, 62);
  for (let i = 0; i < 5; i++) rect(g, i * 44 - 6, 8 + (i % 2) * 6, 34, 7, "#5f7088");
  hills(g, 58, 3, 1.6, "#566f68");
  for (let x = 3; x < FONDO_W; x += 11) pine(g, x, 70, 10 + ((x * 3) % 6), "#3a5448", "#46604f");
  rect(g, 0, 72, FONDO_W, FONDO_H - 72, "#4a6a52");
  tree(g, 130, 88, 9, "#3f5f46", "#4e7055");
  // Las rayas de la lluvia afuera, finitas.
  const r = seeded(31);
  for (let i = 0; i < 90; i++) rect(g, Math.floor(r() * FONDO_W), Math.floor(r() * 100), 1, 3, "#9aaec4");
  // El vidrio: un velo frío y las gotas pegadas con su brillo y su chorrito.
  g.fillStyle = "rgb(190 215 240 / 0.14)";
  g.fillRect(0, 0, FONDO_W, FONDO_H);
  const r2 = seeded(47);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(r2() * FONDO_W);
    const y = Math.floor(r2() * 96);
    const big = i % 4 === 0;
    if (i % 5 === 0) rect(g, x + 1, y + 3, 1, 4 + Math.floor(r2() * 8), "#8aa2bc");
    rect(g, x, y, big ? 3 : 2, big ? 3 : 2, "#c9deef");
    rect(g, x, y, 1, 1, "#f4faff");
    rect(g, x + (big ? 2 : 1), y + (big ? 2 : 1), 1, 1, "#6f87a2");
  }
  // El marco de la ventana: madera con cruz, y el alféizar con una matera.
  const frame = "#8a4b1c";
  const light = "#b3571a";
  rect(g, 0, 0, FONDO_W, 5, frame);
  rect(g, 0, 0, 5, FONDO_H, frame);
  rect(g, FONDO_W - 5, 0, 5, FONDO_H, frame);
  rect(g, FONDO_W / 2 - 2, 0, 4, FONDO_H, frame);
  rect(g, 0, 48, FONDO_W, 4, frame);
  rect(g, 5, 5, FONDO_W - 10, 1, light);
  rect(g, FONDO_W / 2 - 2, 5, 1, FONDO_H, light);
  rect(g, 5, 52, FONDO_W - 10, 1, "#6e3514");
  rect(g, 0, 100, FONDO_W, 12, "#b3571a");
  rect(g, 0, 100, FONDO_W, 2, "#e0923e");
  rect(g, 0, 110, FONDO_W, 2, "#5b2b0e");
  rect(g, 160, 91, 12, 9, "#c65a2e");
  rect(g, 159, 91, 14, 2, "#d9622b");
  [
    [163, 84, 2, 7],
    [166, 81, 2, 10],
    [169, 85, 2, 6],
  ].forEach(([x, y, w, h]) => rect(g, x!, y!, w!, h!, "#4f8a3c"));
  rect(g, 165, 81, 2, 2, "#6fb04a");
  // Una vela prendida junto a la matera.
  rect(g, 146, 92, 4, 8, "#fdf0c8");
  rect(g, 147, 89, 2, 3, "#ffcf4a");
  rect(g, 147, 90, 1, 1, "#fff3c8");
}

function madera(g: G) {
  const tones = ["#b3571a", "#a8511a", "#bb5f22", "#ad541b"];
  const r = seeded(17);
  for (let row = 0; row < FONDO_H / 14; row++) {
    const y = row * 14;
    const shift = (row * 37) % 64;
    for (let x = -shift; x < FONDO_W; x += 64) {
      rect(g, x, y, 64, 14, tones[(row + Math.floor((x + shift) / 64)) % tones.length]!);
      // Vetas largas.
      for (let k = 0; k < 3; k++) rect(g, x + 4 + Math.floor(r() * 20), y + 3 + k * 4, 18 + Math.floor(r() * 24), 1, "#9a4a16");
      rect(g, x, y, 1, 14, "#5b2b0e");
      if (r() < 0.4) {
        const kx = x + 10 + Math.floor(r() * 40);
        rect(g, kx, y + 5, 4, 3, "#8a4b1c");
        rect(g, kx + 1, y + 6, 2, 1, "#6e3514");
      }
      // Clavitos en las puntas.
      rect(g, x + 3, y + 3, 1, 1, "#e0923e");
      rect(g, x + 3, y + 10, 1, 1, "#e0923e");
    }
    rect(g, 0, y, FONDO_W, 1, "#e0923e");
    rect(g, 0, y + 13, FONDO_W, 1, "#5b2b0e");
  }
}

/** Solo para la miniatura: en el escritorio el liso es CSS (los puntitos quedan nítidos a cualquier tamaño). */
function liso(g: G) {
  rect(g, 0, 0, FONDO_W, FONDO_H, LISO_COLOR);
  for (let y = 4; y < FONDO_H; y += 8) for (let x = 4; x < FONDO_W; x += 8) rect(g, x, y, 1, 1, "#a7c197");
}

export const LISO_COLOR = "#86a877";

interface Paleta {
  sky: string[];
  ground: string;
  grass: string;
  canopy: [string, string] | null;
  sprinkle: string[];
  falling: string[];
}

const ESTACIONES: Record<Season, Paleta> = {
  primavera: {
    sky: ["#9fd2ee", "#acd8f0", "#bbdff2", "#cae6f4"],
    ground: "#6fb04a",
    grass: "#8ccc5e",
    canopy: ["#f2a7c3", "#f8c8da"],
    sprinkle: ["#f8c8da", "#ffe07a", "#fdf0c8"],
    falling: ["#f8c8da", "#f2a7c3"],
  },
  verano: {
    sky: ["#6bb6ea", "#7cc0ec", "#8ecaee", "#a2d4f0"],
    ground: "#5ea247",
    grass: "#7cc05a",
    canopy: ["#3f8a3c", "#5ea247"],
    sprinkle: ["#ffcf4a", "#fdf0c8", "#d93a2b"],
    falling: [],
  },
  otono: {
    sky: ["#f3c98a", "#f0b87a", "#eaa56c", "#e0925e"],
    ground: "#a88a3a",
    grass: "#c09a44",
    canopy: ["#d9622b", "#e0923e"],
    sprinkle: HOJAS,
    falling: HOJAS,
  },
  invierno: {
    sky: ["#a8b8d0", "#b4c3d8", "#c0cde0", "#ccd8e8"],
    ground: "#eef4fa",
    grass: "#cfdcea",
    canopy: null,
    sprinkle: ["#ffffff", "#cfdcea"],
    falling: ["#ffffff", "#f4f8fc"],
  },
};

function estacion(g: G, season: Season) {
  const p = ESTACIONES[season];
  bands(g, p.sky, 0, 72);
  if (season === "verano") {
    disc(g, 34, 20, 11, "#ffe9a8");
    disc(g, 34, 20, 8, "#fff3c8");
  }
  hills(g, 62, 4, 0.5, season === "invierno" ? "#dfe8f2" : season === "otono" ? "#c98a5a" : "#4f8a3c");
  for (let x = 2; x < FONDO_W; x += 8)
    pine(g, x, 74 + ((x * 3) % 3), 9 + ((x * 7) % 6), season === "invierno" ? "#5a7a70" : "#2e5a40", season === "invierno" ? "#f4f8fc" : "#3f7a36");
  rect(g, 0, 76, FONDO_W, FONDO_H - 76, p.ground);
  const r = seeded(29);
  for (let i = 0; i < 90; i++) rect(g, Math.floor(r() * FONDO_W), 78 + Math.floor(r() * 34), 1, 1, p.grass);
  for (let i = 0; i < 40; i++) rect(g, Math.floor(r() * FONDO_W), 84 + Math.floor(r() * 28), 2, 1, p.sprinkle[i % p.sprinkle.length]!);
  cabana(g, 116, 58, {
    roof: ["#8a3a1a", "#6e2e14"],
    wall: "#b3571a",
    plank: "#8a4b1c",
    glass: season === "invierno" ? "#ffcf4a" : "#9ecbe8",
    snow: season === "invierno",
  });
  // El árbol grande de la izquierda: con flores, verde, naranja o pelado con nieve.
  if (p.canopy) tree(g, 76, 100, 14, p.canopy[0], p.canopy[1]);
  else {
    rect(g, 75, 76, 3, 25, "#5b2b0e");
    [
      [66, 80, 10],
      [77, 84, 10],
      [69, 72, 8],
      [77, 76, 8],
    ].forEach(([x, y, w]) => {
      rect(g, x!, y!, w!, 1, "#5b2b0e");
      rect(g, x!, y! - 1, w!, 1, "#f4f8fc");
    });
  }
  const r2 = seeded(37);
  for (let i = 0; p.falling.length && i < 44; i++) {
    const x = Math.floor(r2() * FONDO_W);
    const y = Math.floor(r2() * 100);
    rect(g, x, y, season === "invierno" ? 1 : 2, 1, p.falling[i % p.falling.length]!);
    if (season === "invierno" && i % 4 === 0) rect(g, x, y + 1, 1, 1, "#ffffff");
  }
}

/** Pinta el fondo `id` en `g` (de FONDO_W x FONDO_H); `season` solo lo usa "La estación". */
export function dibujarFondo(g: G, id: FondoId, season: Season) {
  g.imageSmoothingEnabled = false;
  switch (id) {
    case "cielo":
      return cielo(g);
    case "noche":
      return noche(g);
    case "espacio":
      return espacio(g);
    case "lago":
      return lago(g);
    case "otono":
      return otono(g);
    case "lluvia":
      return lluvia(g);
    case "madera":
      return madera(g);
    case "liso":
      return liso(g);
    case "estacion":
      return estacion(g, season);
  }
}
