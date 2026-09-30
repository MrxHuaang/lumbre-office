// El taller del garaje en uso (ver taller.ts de @hyvento/shared): el carro destapado (un convertible
// verde con la lona recogida atrás, con o sin alguien al volante), la llanta que infla el compresor y las
// cositas que saltan de la caja de herramientas. Son capas que el navegador pone encima de los muebles
// (game/taller.ts): el carro usa el mismo cuadro que el carro tapado (art/garaje.ts), así calza encima.
import { Escena, type Tinte } from "./exterior-escena";
import { C } from "./palette";
import { at, noise, ramp, smoothNoise, type Ramp, type RGBA, type Sprite } from "./pixel";
import { CARDBOARD, RUBBER } from "./garaje";

const T = (c: RGBA): Tinte => () => c;

/** Verde botella del carro, con el brillo de la cera vieja. */
const CARPAINT: Ramp = ramp("#10261f", "#1a3d31", "#265744", "#357259", "#4f9173", "#7db597");
/** Cuero color vino de las sillas. */
const SEAT: Ramp = ramp("#2a1014", "#45191e", "#62242a", "#7e3137", "#98444a", "#b3625f");
/** Cromo de los parachoques y las farolas. */
const CHROME: Ramp = ramp("#3c4148", "#5d646d", "#838b95", "#aab2bb", "#cfd5db", "#f0f3f5");
/** Lona de algodón crudo (la misma del carro tapado). */
const TARP: Ramp = ramp("#4a3a28", "#6b5439", "#8a6f4d", "#a88c63", "#c2a77c", "#d8c29a");
/** Quien maneja: piel, pelo y camisa genéricos (se ve de lejos y por encima del parabrisas). */
const SKIN: Ramp = ramp("#5a3524", "#7c4a32", "#9d6444", "#bb8059", "#d19c74", "#e6bc98");
const HAIR: Ramp = ramp("#140d0a", "#23160f", "#342116", "#46301f");
const SHIRT: Ramp = ramp("#1b2a44", "#253a5c", "#324d77", "#436393", "#5a7eae");

/**
 * El carro destapado, mirando a +x como el tapado: largo en y (el frente en +y, 45) y ancho en x (2..30).
 * `driver`: con alguien sentado al volante (la silla del lado de x chico, mirando al frente).
 */
export function tallerCar(driver: boolean): Sprite {
  const s = new Escena({ x0: -4, y0: -4, z0: -2, x1: 36, y1: 52, z1: 40 }, 2);
  s.shadow(1, 1, 31, 47, 0.34);
  // Las cuatro ruedas, con el rin cromado, asomando a los dos lados.
  for (const x of [2.5, 29.5])
    for (const y of [9, 37])
      for (let a = 0; a < Math.PI * 2; a += 0.08)
        for (let r = 0; r < 5; r += 0.4) s.plot(x, y + Math.cos(a) * r, 5 + Math.sin(a) * r, r < 1.8 ? at(CHROME, 4) : at(RUBBER, r > 3.8 ? 2 : 3));
  // Carrocería: una tina redondeada, más alta en el capó y en la cola; adentro, el hueco de la cabina.
  const shell = (x: number, y: number) => {
    const ex = Math.min(x - 3, 29 - x);
    const ey = Math.min(y - 2, 45 - y);
    if (ex < 0 || ey < 0) return -1;
    const round = Math.min(1, ex / 3) * Math.min(1, ey / 4);
    return 4 + 9 * Math.sqrt(round);
  };
  const cabin = (x: number, y: number) => x > 6 && x < 26 && y > 12 && y < 31;
  for (let x = 3; x < 29.2; x += 0.3)
    for (let y = 2; y < 45.2; y += 0.3) {
      const h = shell(x, y);
      if (h < 0) continue;
      if (cabin(x, y)) {
        // Piso de la cabina: alfombra oscura.
        s.plot(x, y, 6, at(C.night, 2));
        continue;
      }
      const dx = shell(x + 0.6, y) - shell(x - 0.6, y);
      const dy = shell(x, y + 0.6) - shell(x, y - 0.6);
      const luz = dx < -0.3 || dy < -0.3 ? 1 : dx > 0.8 || dy > 0.8 ? -1 : 0;
      // Una raya crema a lo largo y el polvo de años de garaje.
      const stripe = Math.abs(x - 16) < 1.2 && !cabin(x, y);
      const dust = smoothNoise(x, y, 5, 41) > 0.74;
      s.plot(x, y, h, stripe ? at(C.cream, 4 + luz) : at(CARPAINT, 3 + luz - (dust ? 1 : 0)));
    }
  // Los costados de la tina hasta el piso de la cabina (se ven por dentro).
  for (let y = 12; y < 31; y += 0.3)
    for (let z = 6; z < 12.5; z += 0.35) {
      s.plot(6.5, y, z, at(CARPAINT, 2));
      s.plot(25.5, y, z, at(CARPAINT, 1));
    }
  // Parachoques y farolas adelante (+y), parachoques atrás.
  s.box(4, 45.5, 4, 24, 1.8, 3, T(at(CHROME, 4)), T(at(CHROME, 3)), T(at(CHROME, 5)));
  s.box(4, 0.5, 4, 24, 1.6, 3, T(at(CHROME, 4)), T(at(CHROME, 3)), T(at(CHROME, 4)));
  for (const x of [5.5, 23.5]) s.box(x, 45, 8, 3, 1, 2.5, T(at(CHROME, 4)), T(at(CHROME, 3)), T(at(C.gold, 5)));
  // Parabrisas bajo: el marco cromado y el vidrio, inclinado hacia atrás.
  for (let x = 7; x < 25.2; x += 0.3)
    for (let k = 0; k < 6; k += 0.3) {
      // Del vidrio solo se ven el marco y un par de reflejos: así se ve quien maneja.
      const edge = x < 7.8 || x > 24.2 || k > 5.4;
      const glint = Math.abs(x - 20 - k * 0.6) < 0.5 || Math.abs(x - 22 - k * 0.6) < 0.3;
      if (edge || glint) s.plot(x, 31.5 - k * 0.45, 12.5 + k, edge ? at(CHROME, 4) : at(C.sky, 5));
    }
  // Sillas: dos adelante (espaldar alto) y la banca de atrás.
  const seat = (x0: number, x1: number, y0: number, back: number) => {
    s.box(x0, y0, 6, x1 - x0, 6, 3.5, T(at(SEAT, 4)), T(at(SEAT, 2)), T(at(SEAT, 3)));
    s.box(x0, y0 - 1.6, 6, x1 - x0, 1.6, back, T(at(SEAT, 3)), T(at(SEAT, 2)), T(at(SEAT, 3)));
  };
  seat(8, 15, 22, 11);
  seat(17, 24, 22, 11);
  seat(8, 24, 14.5, 9);
  // Volante frente a la silla de x chico.
  for (let a = 0; a < Math.PI * 2; a += 0.12) s.plot(11.5 + Math.cos(a) * 2.6, 29.5, 13 + Math.sin(a) * 2.6, at(C.night, 2));
  s.plot(11.5, 29.5, 13, at(CHROME, 3));
  // La lona recogida atrás, hecha un rollo arrugado sobre la cola.
  for (let x = 4; x < 28.2; x += 0.3)
    for (let a = 0; a < Math.PI; a += 0.12) {
      const r = 3.2 + smoothNoise(x, a * 3, 2.5, 43) * 1.4;
      const k = 3 + (a < 1 ? 1 : a > 2.2 ? -1 : 0) + (noise(Math.floor(x), Math.floor(a * 4), 45) > 0.8 ? -1 : 0);
      s.plot(x, 6 - Math.cos(a) * r, 13 + Math.sin(a) * r, at(TARP, k));
    }
  if (driver) {
    // Torso (camisa), cuello y la cabeza redonda con el pelo; los brazos al volante.
    s.box(9.5, 23.5, 9.5, 4, 3, 7, T(at(SHIRT, 3)), T(at(SHIRT, 2)), T(at(SHIRT, 3)));
    for (const x of [9.2, 13.8])
      for (let t = 0; t < 1; t += 0.05) s.plot(x + (11.5 - x) * t * 0.6, 25 + t * 4, 15 - t * 1.5, at(t > 0.85 ? SKIN : SHIRT, t > 0.85 ? 4 : 3));
    for (let dz = 0; dz < 3.2; dz += 0.25)
      for (let a = 0; a < Math.PI * 2; a += 0.1)
        for (let r = 0; r < 3; r += 0.4) {
          const z = 18.5 + dz;
          const top = dz > 2 || (a > Math.PI * 1.1 && a < Math.PI * 1.9);
          const face = Math.sin(a) > 0.2 && dz < 2.2;
          s.plot(11.5 + Math.cos(a) * r, 25 + Math.sin(a) * r, z, top && !face ? at(HAIR, 2 + (r > 2 ? 0 : 1)) : at(SKIN, face ? 4 : 3));
        }
    s.solid(11, 24.5, 17, 1, 1, 1.5, at(SKIN, 3), at(SKIN, 2), at(SKIN, 3));
  }
  return s.sprite();
}

/**
 * La llanta que infla el compresor, parada sobre la banda. `t` va de 0 (desinflada, aplastada) a 1
 * (inflada y redonda). Cuadro chico, anclado abajo al centro.
 */
export function tallerTire(t: number): Sprite {
  const k = Math.max(0, Math.min(1, t));
  const s = new Escena({ x0: -9, y0: -4, z0: -2, x1: 9, y1: 4, z1: 18 }, 2);
  const r = 4.5 + k * 2.5;
  const squash = 0.55 + k * 0.45;
  for (let a = 0; a < Math.PI * 2; a += 0.05)
    for (let rr = r * 0.45; rr < r; rr += 0.35) {
      const tread = rr > r - 1 && Math.floor(a * 9) % 2 === 0;
      s.plot(Math.cos(a) * rr, 0, r * squash + Math.sin(a) * rr * squash, at(RUBBER, tread ? 2 : rr > r * 0.7 ? 3 : 4));
    }
  // El rin, que se ve más a medida que se infla.
  for (let a = 0; a < Math.PI * 2; a += 0.1)
    for (let rr = 0; rr < r * 0.45; rr += 0.4) s.plot(Math.cos(a) * rr, -0.5, r * squash + Math.sin(a) * rr * squash, at(C.metal, rr < 1 ? 5 : 3 + k));
  return s.sprite();
}

/** Lo que salta de la caja de herramientas: 0 llave, 1 tornillo, 2 tuerca, 3 un trapo de cartón. */
export function tallerBit(kind: number): Sprite {
  const s = new Escena({ x0: -5, y0: -3, z0: -1, x1: 5, y1: 3, z1: 8 }, 2);
  switch (kind % 4) {
    case 0:
      // Llave de boca: el mango y las dos bocas abiertas.
      for (let x = -3.5; x < 3.6; x += 0.25) s.plot(x, 0, 3 + x * 0.35, at(C.metal, 4));
      for (const [cx, cz] of [
        [-3.8, 1.7],
        [3.9, 4.4],
      ] as const)
        for (let a = 0.8; a < Math.PI * 2 - 0.8; a += 0.2) s.plot(cx + Math.cos(a) * 1.3, 0, cz + Math.sin(a) * 1.3, at(C.metal, 5));
      break;
    case 1:
      for (let z = 1; z < 5.5; z += 0.25) s.plot(0, 0, z, at(C.metal, z > 4.6 ? 5 : Math.floor(z * 3) % 2 ? 3 : 4));
      s.solid(-1, -1, 5.3, 2, 2, 0.8, at(C.metal, 5), at(C.metal, 3), at(C.metal, 4));
      break;
    case 2:
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 3)
        for (let rr = 0.9; rr < 2; rr += 0.3) s.plot(Math.cos(a) * rr, 0, 3 + Math.sin(a) * rr, at(C.gold, 3));
      for (let a = 0; a < Math.PI * 2; a += 0.15) s.plot(Math.cos(a) * 2, 0, 3 + Math.sin(a) * 2, at(C.gold, 4));
      break;
    default:
      s.box(-2.5, -1, 1, 5, 2, 3, T(at(CARDBOARD, 4)), T(at(CARDBOARD, 2)), T(at(CARDBOARD, 3)));
  }
  return s.sprite();
}
