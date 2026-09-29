// Fondos de pantalla del celular, pintados píxel a píxel en un canvas chico (90x69, se ve al doble).
// `frame` los anima de a poco: la llama titila, la lluvia cae, sale humo de la chimenea.
import { llamaPixeles } from "@/components/lumbre/marca";
import type { PhoneWallpaper } from "./state";

export const WALL_W = 90;
export const WALL_H = 69;

type G = CanvasRenderingContext2D;
const rect = (g: G, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

/** Azar con semilla: las estrellas y los árboles quedan siempre en el mismo lugar. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Pino de pixel: triángulo escalonado con tronco. */
function pine(g: G, x: number, base: number, h: number, dark: string, light: string) {
  for (let i = 0; i < h; i++) {
    const w = 1 + Math.floor((i * 2) / 3) * 2;
    rect(g, x - Math.floor(w / 2), base - h + i, w, 1, i % 3 === 0 ? light : dark);
  }
  rect(g, x, base, 1, 2, "#3a2418");
}

function cabana(g: G, frame: number) {
  // Cielo de atardecer en franjas (como los degradados de los celulares con 256 colores).
  const sky = ["#3b2a5a", "#553472", "#7a3f7a", "#a84d78", "#d0607a", "#ee7f6a", "#f7a35e", "#ffc76e"];
  sky.forEach((c, i) => rect(g, 0, i * 6, WALL_W, 6, c));
  // Sol que se esconde detrás de las montañas.
  for (let dy = -9; dy <= 0; dy++) {
    const w = Math.round(Math.sqrt(81 - dy * dy)) * 2;
    rect(g, 58 - w / 2, 44 + dy, w, 1, dy > -3 ? "#ffe9a8" : "#fff3c8");
  }
  // Montañas lejanas y cerros.
  for (let x = 0; x < WALL_W; x++) {
    const far = 36 + Math.round(4 * Math.sin(x / 7) + 3 * Math.sin(x / 3.1));
    rect(g, x, far, 1, WALL_H - far, "#6a3f72");
    const near = 46 + Math.round(3 * Math.sin(x / 9 + 1) + Math.sin(x / 2.3));
    rect(g, x, near, 1, WALL_H - near, "#2e5a40");
  }
  const r = seeded(7);
  for (let i = 0; i < 9; i++) pine(g, Math.floor(r() * WALL_W), 50 + Math.floor(r() * 4), 8 + Math.floor(r() * 5), "#1e3f2e", "#2b5a3c");
  // Pasto y camino.
  rect(g, 0, 56, WALL_W, WALL_H - 56, "#3f7a36");
  for (let x = 0; x < WALL_W; x += 3) rect(g, x + (x % 2), 56 + ((x * 7) % 5), 1, 1, "#5ea247");
  for (let y = 60; y < WALL_H; y++) rect(g, 30 + Math.floor((y - 60) * 0.9), y, 6 + Math.floor((y - 60) / 2), 1, "#d9a766");
  // La cabaña: techo, paredes de madera, ventana encendida y puerta.
  const cx = 16;
  const cy = 44;
  for (let i = 0; i < 7; i++) rect(g, cx - 2 + i, cy - 7 + i, 26 - i * 2, 1, i % 2 ? "#7a3514" : "#5b2b0e");
  rect(g, cx, cy, 22, 13, "#b3571a");
  for (let y = cy + 2; y < cy + 13; y += 3) rect(g, cx, y, 22, 1, "#8a4b1c");
  rect(g, cx + 3, cy + 3, 6, 5, "#5b2b0e");
  rect(g, cx + 4, cy + 4, 4, 3, frame % 8 === 0 ? "#ffe07a" : "#ffcf4a");
  rect(g, cx + 14, cy + 5, 5, 8, "#5b2b0e");
  rect(g, cx + 17, cy + 9, 1, 1, "#ffcf4a");
  // Chimenea con humo que sube.
  rect(g, cx + 17, cy - 9, 3, 5, "#6e3514");
  for (let i = 0; i < 3; i++) {
    const t = (frame + i * 3) % 9;
    rect(g, cx + 18 + (t % 3 === 0 ? 1 : 0) + i, cy - 11 - t * 2, 2, 2, t < 5 ? "#e8d8e8" : "#c8b8d0");
  }
}

function lumbre(g: G, frame: number) {
  rect(g, 0, 0, WALL_W, WALL_H, "#1a1426");
  const r = seeded(11);
  for (let i = 0; i < 38; i++) {
    const x = Math.floor(r() * WALL_W);
    const y = Math.floor(r() * 44);
    const twinkle = (i + frame) % 7 === 0;
    rect(g, x, y, 1, 1, twinkle ? "#fff4c8" : i % 3 ? "#8a7fa8" : "#d8d0f0");
  }
  // Luna creciente.
  for (let dy = -5; dy <= 5; dy++) {
    const w = Math.round(Math.sqrt(25 - dy * dy));
    rect(g, 66 - w, 12 + dy, w * 2, 1, "#fdf0c8");
  }
  for (let dy = -5; dy <= 5; dy++) {
    const w = Math.round(Math.sqrt(25 - dy * dy));
    rect(g, 69 - w, 11 + dy, w * 2, 1, "#1a1426");
  }
  // Bosque oscuro y suelo.
  for (let x = 0; x < WALL_W; x += 7) pine(g, x + 3, 52, 10 + ((x * 5) % 6), "#121a22", "#1a2630");
  rect(g, 0, 52, WALL_W, WALL_H - 52, "#241a1e");
  // El brillo de la fogata en anillos (como los degradados en pasos del juego).
  const glow = ["#3a2230", "#4f2a2c", "#6a3428"];
  glow.forEach((c, i) => {
    const rad = 22 - i * 6;
    for (let dy = -rad; dy <= rad / 2; dy++) {
      const w = Math.round(Math.sqrt(rad * rad - dy * dy));
      rect(g, 42 - w, 60 + dy, w * 2, 1, c);
    }
  });
  // La llamita de Lumbre, titilando entre sus dos cuadros.
  const { w, h, pixeles } = llamaPixeles(frame % 2 === 0 ? 0 : 1);
  const ox = 42 - Math.floor(w / 2);
  const oy = 66 - h;
  for (const p of pixeles) rect(g, ox + p.x, oy + p.y, 1, 1, p.color);
  // Chispas que suben.
  for (let i = 0; i < 4; i++) {
    const t = (frame + i * 5) % 14;
    rect(g, 38 + ((i * 7) % 10), 46 - t * 2, 1, 1, t < 7 ? "#ffcf4a" : "#f08a2c");
  }
}

function lluvia(g: G, frame: number) {
  const sky = ["#141c30", "#18223a", "#1d2a44", "#22324e"];
  sky.forEach((c, i) => rect(g, 0, i * 12, WALL_W, 12, c));
  rect(g, 0, 48, WALL_W, WALL_H - 48, "#22324e");
  // Nubes gordas arriba.
  for (let i = 0; i < 6; i++) rect(g, i * 15 - 4, 2 + (i % 2) * 3, 22, 6, "#2c3a58");
  // Casas con ventanas encendidas.
  const houses = [
    [4, 30, 18],
    [24, 36, 14],
    [40, 26, 20],
    [62, 34, 18],
  ] as const;
  houses.forEach(([x, top, w], i) => {
    rect(g, x, top, w, 58 - top, "#2a2033");
    for (let wy = top + 4; wy < 54; wy += 6)
      for (let wx = x + 3; wx < x + w - 3; wx += 5) rect(g, wx, wy, 2, 3, (wx + wy + i) % 3 === 0 ? "#ffcf4a" : "#3a3048");
  });
  // Calle mojada con reflejos.
  rect(g, 0, 58, WALL_W, WALL_H - 58, "#1a2236");
  for (let x = 2; x < WALL_W; x += 9) rect(g, x, 62 + ((x * 3) % 7), 4, 1, "#5d6f9a");
  // Lluvia en diagonal: cada gota baja con el cuadro.
  const r = seeded(23);
  for (let i = 0; i < 40; i++) {
    const x0 = Math.floor(r() * (WALL_W + 20));
    const y0 = Math.floor(r() * WALL_H);
    const y = (y0 + frame * 5) % WALL_H;
    const x = (x0 - Math.floor(y / 3) + WALL_W) % WALL_W;
    rect(g, x, y, 1, 3, i % 4 === 0 ? "#bfe3ff" : "#7c93c0");
  }
}

const DRAW: Record<PhoneWallpaper, (g: G, frame: number) => void> = { cabana, lumbre, lluvia };

export function drawWallpaper(g: G, id: PhoneWallpaper, frame: number) {
  g.imageSmoothingEnabled = false;
  DRAW[id](g, frame);
}
