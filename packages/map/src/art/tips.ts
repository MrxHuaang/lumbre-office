// Billetes de las propinas del tubo: uno por denominación (1 verde, 5 azul, 10 violeta y 25 dorado), con
// tres frames para que den vueltas en el aire (plano, inclinado y de canto) y el contorno café de siempre.
// Vuelan desde quien tira hasta la tarima y quedan apilados en el piso un rato.
import { C, OUT } from "./palette";
import { PixelCanvas, type Ramp } from "./pixel";

/** Lienzo de cada frame (el billete es de 9x5, más el contorno). */
export const BILL_W = 11;
export const BILL_H = 7;
/** Frames de la vuelta en el aire: 0 = plano, 1 = inclinado, 2 = de canto. */
export const BILL_FRAMES = 3;

/** Denominaciones de los billetes (las mismas de TIP_AMOUNTS) y su color. */
const BILL_RAMPS: Record<number, Ramp> = { 1: C.leaf, 5: C.blue, 10: C.violet, 25: C.gold };
export const BILL_DENOMINATIONS = [1, 5, 10, 25] as const;

/** Cuántos billetes vuelan por propina: más plata, más papel. */
export const billsFor = (amount: number) => (amount >= 25 ? 5 : amount >= 10 ? 3 : amount >= 5 ? 2 : 1);

export function drawBill(amount: number, frame = 0): PixelCanvas {
  const r = BILL_RAMPS[amount] ?? C.leaf;
  const c = new PixelCanvas(BILL_W, BILL_H);
  const dark = r[1]!;
  const mid = r[3]!;
  const light = r[4]!;
  const shine = r[5] ?? r[4]!;
  if (frame >= 2) {
    // De canto: una raya con un brillo.
    c.rect(1, 3, 9, 1, mid);
    c.set(3, 3, shine);
  } else if (frame === 1) {
    // Inclinado: se ve más bajito, con el borde de arriba iluminado.
    c.rect(1, 2, 9, 3, mid);
    c.rect(1, 2, 9, 1, light);
    c.rect(4, 3, 3, 1, light);
    c.set(1, 4, dark);
    c.set(9, 4, dark);
  } else {
    // Plano: el papel, el marco oscuro, el óvalo claro del medio y las esquinas marcadas.
    c.rect(1, 1, 9, 5, mid);
    c.rect(1, 1, 9, 1, light);
    c.rect(4, 2, 3, 3, light);
    c.set(5, 3, dark);
    c.set(2, 2, dark);
    c.set(8, 4, dark);
    c.rect(1, 5, 9, 1, dark);
  }
  c.outline(OUT);
  return c;
}
