// Las carrozas del Carnaval por piezas (VIR-173): como en Pasto, cada figura se arma con partes que se
// mueven con mecanismos sencillos (resortes, piolas, bandas de caucho): la cabeza que gira de lado a lado,
// los párpados que parpadean, las manos que suben y bajan, las alas que aletean, los engranajes que dan
// vueltas, todo el cuerpo con vaivén, el humo que sube y el agua que cae. Cada parte es un lienzo que se
// genera una vez (por carroza y de día o de noche) con su pivote; el navegador solo la gira y la corre con
// curvas suaves. Aquí la pose de cada parte a cada momento: pura, igual para todos y con tests.
import type { PixelCanvas } from "../pixel";

/** Cómo se mueve una parte (todo con seno: ida y vuelta suave, nunca a saltos). Tiempos en ms. */
export interface Movimiento {
  /** Gira de un lado al otro alrededor del pivote (radianes de amplitud): cabezas, brazos, alas, péndulos. */
  gira?: { amp: number; periodo: number; fase?: number; centro?: number };
  /** Da vueltas enteras (engranajes, soles, ruedas). */
  rueda?: { periodo: number; sentido?: 1 | -1 };
  /** Se corre de ida y vuelta (px de pantalla): manos que suben y bajan, cuerpos que se mecen, olas. */
  vaiven?: { dx?: number; dy?: number; periodo: number; fase?: number };
  /** Se estira y se encoge (alas que aletean, bocas que se abren): 1 + s · seno. */
  escala?: { sx?: number; sy?: number; periodo: number; fase?: number };
  /** Se ve solo un ratito cada tanto (los párpados al parpadear). */
  parpadeo?: { cada: number; dura: number; fase?: number };
  /** Sube (o cae) en línea y vuelve a empezar, apareciendo y desvaneciéndose: humo, vapor, gotas. */
  sube?: { dx: number; dy: number; periodo: number; fase?: number; crece?: number };
}

export interface Parte {
  id: string;
  canvas: PixelCanvas;
  /** El pivote dentro del lienzo (px). */
  px: number;
  py: number;
  /** Dónde queda el pivote, en px de pantalla desde el origen de la carroza. */
  x: number;
  y: number;
  /** Se mueve con otra parte (la cabeza con el cuerpo, el párpado con la cabeza). */
  padre?: string;
  mov?: Movimiento;
}

/** Una luz de la carroza de noche (px de pantalla desde el origen, radio y color). */
export interface LuzCarroza {
  x: number;
  y: number;
  r: number;
  color: string;
}

export interface CarrozaArte {
  /** Lo largo de la plataforma (unidades de arte, a lo largo de la calle). */
  largo: number;
  /** De atrás hacia adelante (en ese orden se dibujan). */
  partes: Parte[];
  luces: LuzCarroza[];
  /** Hasta dónde puede llegar lo que se mueve (px de pantalla desde el origen): la plataforma y su aire. */
  marco: { x0: number; x1: number };
}

export interface Pose {
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  alpha: number;
  visible: boolean;
}

const TAU = Math.PI * 2;
const seno = (ms: number, periodo: number, fase = 0) => Math.sin((ms / periodo + fase) * TAU);

/** El movimiento propio de una parte (sin el de su padre). `calma` < 1 lo apaga casi entero. */
function propio(m: Movimiento | undefined, ms: number, calma: number): Pose {
  const p: Pose = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1, visible: true };
  if (!m) return p;
  if (m.gira) p.rot += (m.gira.centro ?? 0) + m.gira.amp * calma * seno(ms, m.gira.periodo, m.gira.fase);
  if (m.rueda) p.rot += (((ms * calma) / m.rueda.periodo) % 1) * TAU * (m.rueda.sentido ?? 1);
  if (m.vaiven) {
    const k = seno(ms, m.vaiven.periodo, m.vaiven.fase) * calma;
    p.x += (m.vaiven.dx ?? 0) * k;
    p.y += (m.vaiven.dy ?? 0) * k;
  }
  if (m.escala) {
    const k = seno(ms, m.escala.periodo, m.escala.fase) * calma;
    p.sx *= 1 + (m.escala.sx ?? 0) * k;
    p.sy *= 1 + (m.escala.sy ?? 0) * k;
  }
  if (m.parpadeo) {
    // Con "menos movimiento" no parpadea: los ojos quedan abiertos.
    const t = (((ms / m.parpadeo.cada + (m.parpadeo.fase ?? 0)) % 1) + 1) % 1;
    p.visible = calma >= 1 && t * m.parpadeo.cada > m.parpadeo.cada - m.parpadeo.dura;
  }
  if (m.sube) {
    // Con "menos movimiento", quieto a mitad de camino.
    const t = calma >= 1 ? (((ms / m.sube.periodo + (m.sube.fase ?? 0)) % 1) + 1) % 1 : 0.35 + (m.sube.fase ?? 0) * 0.3;
    p.x += m.sube.dx * t;
    p.y += m.sube.dy * t;
    const s = 1 + (m.sube.crece ?? 0) * t;
    p.sx *= s;
    p.sy *= s;
    p.alpha = Math.min(1, t / 0.15) * Math.min(1, (1 - t) / 0.35);
  }
  return p;
}

/**
 * La pose de cada parte a `ms` (la hora del servidor, así todos la ven igual): su movimiento sumado al de
 * su padre (girando alrededor del pivote del padre). `calma` = 1 normal, menos para "menos movimiento".
 */
/** Lo que hace falta de cada parte para moverla (sin el dibujo: el navegador puede traerlo del atlas). */
export type ParteMovil = Pick<Parte, "id" | "x" | "y" | "padre" | "mov">;

export function posesCarroza(arte: { partes: readonly ParteMovil[] }, ms: number, calma = 1): Pose[] {
  const idx = new Map(arte.partes.map((p, i) => [p.id, i]));
  const out: (Pose | undefined)[] = [];
  const resolver = (i: number, pila = 0): Pose => {
    const hecho = out[i];
    if (hecho) return hecho;
    const parte = arte.partes[i]!;
    const own = propio(parte.mov, ms, calma);
    let x = parte.x + own.x;
    let y = parte.y + own.y;
    let rot = own.rot;
    let alpha = own.alpha;
    let visible = own.visible;
    const pi = parte.padre !== undefined ? idx.get(parte.padre) : undefined;
    if (pi !== undefined && pila < 8) {
      const padre = arte.partes[pi]!;
      const pp = resolver(pi, pila + 1);
      // El pivote propio, girado alrededor del pivote del padre y corrido con él.
      const rx = x - padre.x;
      const ry = y - padre.y;
      const co = Math.cos(pp.rot);
      const si = Math.sin(pp.rot);
      x = pp.x + rx * co * pp.sx - ry * si * pp.sy;
      y = pp.y + rx * si * pp.sx + ry * co * pp.sy;
      rot += pp.rot;
      alpha *= pp.alpha;
      visible &&= pp.visible;
    }
    return (out[i] = { x, y, rot, sx: own.sx, sy: own.sy, alpha, visible });
  };
  return arte.partes.map((_, i) => resolver(i));
}

/** La caja (px de pantalla desde el origen) que ocupa una parte en esa pose. */
export function cajaDeParte(parte: Parte, pose: Pose) {
  const co = Math.cos(pose.rot);
  const si = Math.sin(pose.rot);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [u, v] of [
    [0, 0],
    [parte.canvas.width, 0],
    [0, parte.canvas.height],
    [parte.canvas.width, parte.canvas.height],
  ] as const) {
    const dx = (u - parte.px) * pose.sx;
    const dy = (v - parte.py) * pose.sy;
    xs.push(pose.x + dx * co - dy * si);
    ys.push(pose.y + dx * si + dy * co);
  }
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
