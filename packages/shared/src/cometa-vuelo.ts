// El minijuego de volar la cometa (Festival de cometas): mantener la tensión del hilo con las ráfagas que
// cambian. Apretado se jala (la tensión sube), suelto se da hilo (baja); las ráfagas la empujan para arriba
// y las calmas para abajo. Con la tensión en su punto la cometa sube; con muy poca se viene al suelo y con
// demasiada se revienta el hilo. Arriba el viento pega más duro: subir mucho es arriesgarse.
//
// Es determinista (semilla + botón por cuadro, a 30 por segundo, solo sumas, restas y productos): el
// navegador lo juega y la sala lo repite igual a medida que llegan los botones, así la altura que ven
// todos y el récord son los que de verdad se lograron (como la pesca valida su reto).
import { COLA_VUELO, cometaPartes, FORMA_VUELO } from "./cometa";
import { fishSimRandom } from "./fishing-sim";
import type { Weather } from "./weather";

export const VUELO_HZ = 30;
export const VUELO_FRAME_MS = 1000 / VUELO_HZ;

export const VUELO = {
  /** Un vuelo dura como mucho 90 s: al final la cometa se recoge sola con lo que subió. */
  maxFrames: 90 * VUELO_HZ,
  /** Altura (m) con la que arranca, recién soltada. */
  arranque: 3,
  /** Tensión al soltarla. */
  tensionInicial: 0.5,
  /** Con menos tensión que esto pierde altura; desde `alta` el hilo cruje; en `rompe` se revienta. */
  baja: 0.28,
  alta: 0.8,
  rompe: 1,
  /** La tensión en su punto: ahí es donde más sube. */
  punto: 0.62,
  /** Lo que cambia la tensión por segundo jalando y dando hilo. */
  jalar: 0.6,
  soltar: 0.66,
  /** Cuánto le pegan las ráfagas al hilo. */
  rafaga: 0.4,
  /** Lo que baja por segundo sin tensión. */
  caida: 7,
  /** Hasta dónde se puede subir (la subida se va frenando antes). */
  techo: 220,
  /** Con la altura, el viento pega más duro (a `aloft` metros, el doble). */
  aloft: 160,
} as const;

/** Qué tan fuerte sopla con ese clima (0 = no se puede volar): más con nubes o niebla, poco despejado. */
export function vientoDelClima(w: Weather): number {
  switch (w) {
    case "nublado":
      return 0.85;
    case "niebla":
      return 0.7;
    case "despejado":
      return 0.4;
    default:
      // Con lluvia, tormenta o nieve no se vuela.
      return 0;
  }
}

/** ¿Se puede volar con ese clima? */
export const sePuedeVolar = (w: Weather) => vientoDelClima(w) > 0;

/**
 * Hacia dónde sopla (radianes en el plano del jardín: 0 = hacia +x) a esa hora de ese día del juego: cambia
 * despacito durante el día, igual para todos (la manga de viento y para dónde se van las cometas).
 */
export function vientoRumbo(day: number, minuteOfDay: number): number {
  const base = ((day * 2654435761) >>> 0) / 4294967296;
  return base * Math.PI * 2 + Math.sin(minuteOfDay / 97) * 0.9;
}

export interface VueloSetup {
  seed: number;
  /** Fuerza del viento (0..1), del clima al soltarla. */
  viento: number;
  /** El código de la cometa (forma y cola cambian cómo vuela). */
  code: string;
}

export type VueloFin = "rota" | "caida" | "tiempo";

export class CometaSim {
  frame = 0;
  tension: number = VUELO.tensionInicial;
  altura: number = VUELO.arranque;
  /** La ráfaga de ahora (0..~1.6 por el viento) y hacia la que va. */
  rafaga: number;
  private meta: number;
  private proxima = 0;
  done = false;
  fin: VueloFin | null = null;
  private readonly rand: () => number;
  private readonly sube: number;
  private readonly golpe: number;

  constructor(readonly setup: VueloSetup) {
    this.rand = fishSimRandom(setup.seed);
    const p = cometaPartes(setup.code);
    const f = p ? FORMA_VUELO[p.forma] : FORMA_VUELO.rombo;
    const c = p ? COLA_VUELO[p.cola] : COLA_VUELO[2];
    this.sube = f.sube * c.sube;
    this.golpe = f.rafaga * c.rafaga;
    this.rafaga = this.meta = setup.viento * 0.75;
  }

  /** ¿La tensión está en peligro (el hilo cruje)? */
  get tenso() {
    return this.tension >= VUELO.alta;
  }

  /** Un cuadro jalando (`hold`) o dando hilo. */
  step(hold: boolean) {
    if (this.done) return;
    this.frame++;
    const w = this.setup.viento;
    const dt = 1 / VUELO_HZ;
    // Cada tanto llega otra ráfaga (o una calma): la de ahora se le va acercando.
    if (this.frame >= this.proxima) {
      this.meta = w * (0.35 + this.rand() * 1.25);
      this.proxima = this.frame + 20 + Math.floor(this.rand() * 70);
    }
    this.rafaga += (this.meta - this.rafaga) * 0.08;
    const arriba = 1 + this.altura / VUELO.aloft;
    const empuje = VUELO.rafaga * this.golpe * (this.rafaga * arriba - w * 0.75);
    this.tension = Math.max(0, this.tension + dt * ((hold ? VUELO.jalar : -VUELO.soltar) + empuje));
    if (this.tension >= VUELO.rompe) return this.end("rota");
    if (this.tension >= VUELO.baja) {
      // Sube más con la tensión en su punto (`punto`); pegada a los bordes casi no gana altura.
      const enSuPunto = Math.max(0.15, 1 - Math.abs(this.tension - VUELO.punto) / 0.4);
      const ganas = (0.6 + 3.2 * this.rafaga) * this.sube * enSuPunto;
      this.altura = Math.min(VUELO.techo, this.altura + dt * ganas * Math.max(0, 1 - this.altura / VUELO.techo));
    } else {
      this.altura -= dt * VUELO.caida * (1.3 - this.tension / VUELO.baja);
      if (this.altura <= 0) {
        this.altura = 0;
        return this.end("caida");
      }
    }
    if (this.frame >= VUELO.maxFrames) this.end("tiempo");
  }

  private end(fin: VueloFin) {
    this.done = true;
    this.fin = fin;
  }
}

/**
 * Sigue un vuelo hasta `frames` con los cuadros en que cambió el botón (`toggles`, en orden y desde el
 * cuadro donde va). Devuelve false si los datos no tienen sentido (desordenados, hacia atrás o más allá del
 * tope); el botón con que siguió queda en `hold` (empieza suelto).
 */
export function advanceVuelo(sim: CometaSim, state: { hold: boolean }, toggles: readonly number[], frames: number): boolean {
  if (!Number.isInteger(frames) || frames < sim.frame || frames > VUELO.maxFrames) return false;
  for (let i = 0; i < toggles.length; i++) {
    const f = toggles[i]!;
    if (!Number.isInteger(f) || f < sim.frame || f >= frames || (i > 0 && f <= toggles[i - 1]!)) return false;
  }
  let next = 0;
  while (sim.frame < frames && !sim.done) {
    while (next < toggles.length && toggles[next] === sim.frame) {
      state.hold = !state.hold;
      next++;
    }
    sim.step(state.hold);
  }
  return true;
}

/** La altura que cuenta (metros enteros). */
export const alturaDe = (sim: CometaSim) => Math.floor(sim.altura);

/**
 * Juega solo (para los tests y para revisar que se pueda subir): jala cuando la tensión baja de `meta` y
 * da hilo cuando pasa. `hasta`: se detiene ahí (cuadros).
 */
export function autoVuelo(setup: VueloSetup, opts: { meta?: number; hasta?: number } = {}) {
  const sim = new CometaSim(setup);
  const toggles: number[] = [];
  let hold = false;
  const meta = opts.meta ?? 0.55;
  const hasta = Math.min(VUELO.maxFrames, opts.hasta ?? VUELO.maxFrames);
  while (!sim.done && sim.frame < hasta) {
    const want = sim.tension < meta;
    if (want !== hold) {
      toggles.push(sim.frame);
      hold = want;
    }
    sim.step(hold);
  }
  return { toggles, frames: sim.frame, sim };
}
