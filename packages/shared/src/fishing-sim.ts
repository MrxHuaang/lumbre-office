// El minijuego de la pesca (el de Stardew Valley): una barra vertical con agua, el pez que sube y baja
// según su comportamiento y dificultad, la barra verde que sube mientras se mantiene apretado y cae con
// gravedad (con inercia y rebote), y el medidor de captura. Es determinista (semilla + botón por frame, a
// 60 por segundo y solo con sumas, restas y productos): el cliente lo juega y el servidor lo repite igual
// para validar el resultado. Las medidas son las de Stardew (la barra mide 568), un poco más exigente: la
// barra verde es más corta, el medidor se vacía más rápido y el pez se pone bravo cuando está por salir.
import type { FishBehavior } from "./fishing";
import { masteryBar } from "./pesca-maestria";

export const SIM_HZ = 60;
export const SIM_FRAME_MS = 1000 / SIM_HZ;
/** Tope de frames de una partida (2 minutos). */
export const SIM_MAX_FRAMES = 120 * SIM_HZ;

export const SIM = {
  /** Alto del agua (unidades de Stardew). */
  track: 568,
  /** Alto del pez: se mueve entre 0 y `track - fish`. */
  fish: 36,
  /** El medidor arranca en 30 %. */
  startMeter: 0.3,
  /** Lo que baja por frame con el pez fuera de la barra. */
  loss: 0.0038,
  /** Desde qué medidor el pez se pone bravo y cuánto sube su dificultad con el medidor lleno. */
  rageFrom: 0.6,
  rage: 0.12,
  /** Tope de la dificultad con que se mueve el pez (la de Stardew): más allá, solo se achica la barra. */
  maxMove: 110,
  /** El cofre: lo que sube por frame dentro de la barra y lo que baja fuera. */
  treasureGain: 0.0135,
  treasureLoss: 0.01,
  treasureSize: 30,
  gravity: 0.25,
} as const;

/**
 * Las cañas, de la más básica a la mejor: la de bambú es la de siempre (gratis); la de fibra de vidrio, la
 * de carbono y la dorada (la legendaria) se compran en el puesto de pesca.
 */
export const FISHING_RODS = ["bambu", "fibra", "carbono", "dorada"] as const;
export type FishingRod = (typeof FISHING_RODS)[number];

/**
 * Cuánto ayuda cada caña en el minijuego: la barra verde más larga (`bar`) y el pez más lento (`move`,
 * multiplica la dificultad con que se mueve). El medidor sube igual con todas: el tiempo mínimo de una
 * partida no cambia. La de bambú deja todo como estaba (multiplicar por 1 no cambia ninguna partida).
 */
export const ROD_TUNING: Record<FishingRod, { bar: number; move: number }> = {
  bambu: { bar: 1, move: 1 },
  fibra: { bar: 1.18, move: 0.9 },
  carbono: { bar: 1.36, move: 0.8 },
  dorada: { bar: 1.55, move: 0.7 },
};

export const isFishingRod = (id: unknown): id is FishingRod => typeof id === "string" && (FISHING_RODS as readonly string[]).includes(id);

/** La barra verde es más corta en los peces difíciles. */
export function barHeightFor(difficulty: number): number {
  return Math.max(100, Math.min(144, Math.round(150 - difficulty * 0.38)));
}

/** Cuánto sube el medidor por frame con el pez dentro: a más dificultad, más lento. */
export function gainFor(difficulty: number): number {
  return 0.0023 - difficulty * 0.0000055;
}

/**
 * Con qué dificultad se mueve el pez: igual que la suya hasta 60 y más suave después (en Stardew, pasado
 * ~95 el pez ya no se puede seguir). Lo que sigue subiendo en los difíciles es la barra y el medidor.
 */
export function moveDifficulty(difficulty: number): number {
  return difficulty <= 60 ? difficulty : 60 + (difficulty - 60) * 0.7;
}

/** Frames mínimos para llenar el medidor (el pez siempre dentro de la barra). */
export function minReelFrames(difficulty: number): number {
  return Math.ceil((1 - SIM.startMeter) / gainFor(difficulty));
}

/** Generador con semilla (mulberry32): da lo mismo en el navegador y en Node. */
export function fishSimRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimSetup {
  seed: number;
  difficulty: number;
  behavior: FishBehavior;
  treasure: boolean;
  /** Con qué caña se pesca (sin esto, la de bambú). */
  rod?: FishingRod;
  /** Nivel de maestría de esa caña (0 a 5, ver pesca-maestria.ts): alarga un poco más la barra. */
  mastery?: number;
  /** Barra más larga por el oficio (Pesca nivel 5: 1,05); se multiplica sobre la de la caña. */
  barBonus?: number;
}

export class FishingSim {
  readonly barHeight: number;
  readonly gain: number;
  frame = 0;
  /** Posición del pez (arriba del pez) y de la barra (arriba de la barra), de 0 (arriba) a `track`. */
  fishPos = 508;
  barPos: number;
  barSpeed = 0;
  meter: number = SIM.startMeter;
  fishInBar = true;
  /** Cofre: desde qué frame aparece, dónde, cuánto lleva y si se sacó. */
  readonly treasureAt: number;
  readonly treasurePos: number;
  treasureMeter = 0;
  treasureCaught = false;
  treasureInBar = false;
  done = false;
  caught = false;

  private target = -1;
  private speed = 0;
  private sinkFloat = 0;
  private readonly rand: () => number;
  /** Cuánto frena la caña al pez (1 = nada). */
  private readonly move: number;

  constructor(readonly setup: SimSetup) {
    const tuning = ROD_TUNING[isFishingRod(setup.rod) ? setup.rod : "bambu"];
    this.move = tuning.move;
    // El extra del oficio se acota: el reto lo manda el servidor, pero nunca más de un 20%.
    const bonus = Math.min(1.2, Math.max(1, setup.barBonus ?? 1));
    this.barHeight = Math.min(SIM.track - 40, Math.round(barHeightFor(setup.difficulty) * (tuning.bar + masteryBar(setup.mastery ?? 0)) * bonus));
    this.gain = gainFor(setup.difficulty);
    this.barPos = SIM.track - this.barHeight;
    this.rand = fishSimRandom(setup.seed);
    // El cofre usa otro generador: así su sorteo no cambia cómo se mueve el pez.
    const t = fishSimRandom(setup.seed ^ 0x9e3779b9);
    this.treasureAt = 60 + Math.floor(t() * 150);
    this.treasurePos = 20 + Math.floor(t() * (SIM.track - SIM.treasureSize - 40));
  }

  private int(min: number, max: number) {
    return min + Math.floor(this.rand() * (max - min));
  }

  get treasureVisible() {
    return this.setup.treasure && !this.treasureCaught && this.frame >= this.treasureAt;
  }

  /** Un frame con el botón apretado (`hold`) o suelto. */
  step(hold: boolean) {
    if (this.done) return;
    this.frame++;
    this.moveFish();
    this.moveBar(hold);
    this.updateMeters();
  }

  /** El pez: las mismas reglas que el BobberBar de Stardew. */
  private moveFish() {
    const { behavior } = this.setup;
    // Cerca de sacarlo, el pez pelea más (sube su dificultad hasta un 12 %).
    const rage = Math.max(0, this.meter - SIM.rageFrom) / (1 - SIM.rageFrom);
    // La caña buena frena al pez: su dificultad de movimiento baja (con la de bambú, `move` = 1).
    const d = Math.min(SIM.maxMove, moveDifficulty(this.setup.difficulty) * (1 + rage * SIM.rage)) * this.move;
    const top = SIM.track - SIM.fish;
    if (this.rand() < (d * (behavior === "smooth" ? 20 : 1)) / 4000 && (behavior !== "smooth" || this.target === -1)) {
      const below = SIM.track - this.fishPos;
      const above = this.fishPos;
      const percent = Math.min(99, d + this.int(10, 45)) / 100;
      this.target = this.fishPos + this.int(-Math.floor(above), Math.floor(below)) * percent;
    }
    if (behavior === "floater") this.sinkFloat = Math.max(this.sinkFloat - 0.01, -1.5);
    else if (behavior === "sinker") this.sinkFloat = Math.min(this.sinkFloat + 0.01, 1.5);

    if (Math.abs(this.fishPos - this.target) > 3 && this.target !== -1) {
      const accel = (this.target - this.fishPos) / (this.int(10, 30) + (100 - Math.min(100, d)));
      this.speed += (accel - this.speed) / 5;
    } else if (behavior !== "smooth" && this.rand() < d / 2000) {
      this.target = this.fishPos + (this.rand() < 0.5 ? this.int(-100, -51) : this.int(50, 101));
    } else {
      this.target = -1;
    }
    if (behavior === "dart" && this.rand() < d / 1000) {
      this.target = this.fishPos + (this.rand() < 0.5 ? this.int(-100 - d * 2, -51) : this.int(50, 101 + d * 2));
    }
    this.target = Math.max(-1, Math.min(this.target, SIM.track - 20));
    this.fishPos += this.speed + this.sinkFloat;
    if (this.fishPos > top) this.fishPos = top;
    else if (this.fishPos < 0) this.fishPos = 0;
  }

  /** La barra verde: sube apretando, cae con gravedad, conserva la inercia y rebota en los bordes. */
  private moveBar(hold: boolean) {
    const bottom = SIM.track - this.barHeight;
    const center = this.fishPos + SIM.fish / 2;
    this.fishInBar = center >= this.barPos && center <= this.barPos + this.barHeight;
    let g = hold ? -SIM.gravity : SIM.gravity;
    if (hold && (this.barPos === 0 || this.barPos === bottom)) this.barSpeed = 0;
    // Con el pez adentro la barra se mueve más lento (más fácil seguirlo).
    if (this.fishInBar) g *= 0.6;
    this.barSpeed += g;
    this.barPos += this.barSpeed;
    if (this.barPos > bottom) {
      this.barPos = bottom;
      this.barSpeed = (-this.barSpeed * 2) / 3;
    } else if (this.barPos < 0) {
      this.barPos = 0;
      this.barSpeed = (-this.barSpeed * 2) / 3;
    }
    const c = this.fishPos + SIM.fish / 2;
    this.fishInBar = c >= this.barPos && c <= this.barPos + this.barHeight;
  }

  private updateMeters() {
    this.treasureInBar = false;
    if (this.treasureVisible) {
      const c = this.treasurePos + SIM.treasureSize / 2;
      this.treasureInBar = c >= this.barPos && c <= this.barPos + this.barHeight;
      if (this.treasureInBar) this.treasureMeter += SIM.treasureGain;
      else this.treasureMeter = Math.max(0, this.treasureMeter - SIM.treasureLoss);
      if (this.treasureMeter >= 1) {
        this.treasureMeter = 1;
        this.treasureCaught = true;
      }
    }
    // Mientras se saca el cofre, el medidor del pez no baja.
    if (this.fishInBar) this.meter += this.gain;
    else if (!this.treasureInBar) this.meter -= SIM.loss;
    if (this.meter >= 1) {
      this.meter = 1;
      this.done = true;
      this.caught = true;
    } else if (this.meter <= 0) {
      this.meter = 0;
      this.done = true;
      this.caught = false;
    }
  }
}

/**
 * Repite una partida: `inputs` son los frames (en orden) en los que cambió el botón, empezando suelto.
 * Devuelve cómo terminó, o null si los datos no tienen sentido (desordenados o fuera de la partida).
 */
export function replayFishing(
  setup: SimSetup,
  inputs: readonly number[],
  frames: number,
): { done: boolean; caught: boolean; treasure: boolean; frame: number } | null {
  if (!Number.isInteger(frames) || frames < 1 || frames > SIM_MAX_FRAMES) return null;
  for (let i = 0; i < inputs.length; i++) {
    const f = inputs[i]!;
    if (!Number.isInteger(f) || f < 0 || f >= frames || (i > 0 && f <= inputs[i - 1]!)) return null;
  }
  const sim = new FishingSim(setup);
  let hold = false;
  let next = 0;
  for (let f = 0; f < frames && !sim.done; f++) {
    while (next < inputs.length && inputs[next] === f) {
      hold = !hold;
      next++;
    }
    sim.step(hold);
  }
  return { done: sim.done, caught: sim.caught, treasure: sim.treasureCaught, frame: sim.frame };
}

/**
 * Juega solo (para los tests y para revisar que todo pez se pueda sacar): lleva la barra hacia el pez (o
 * hacia el cofre, si todavía no lo sacó), adelantándose un poco a hacia dónde va.
 */
export function autoplay(setup: SimSetup, opts: { chaseTreasure?: boolean; maxFrames?: number } = {}) {
  const sim = new FishingSim(setup);
  const inputs: number[] = [];
  let hold = false;
  let prev = sim.fishPos;
  const max = opts.maxFrames ?? SIM_MAX_FRAMES;
  while (!sim.done && sim.frame < max) {
    const chase = opts.chaseTreasure && sim.treasureVisible && sim.meter > 0.35;
    const lead = (sim.fishPos - prev) * 6;
    prev = sim.fishPos;
    const goal = chase ? sim.treasurePos + SIM.treasureSize / 2 : sim.fishPos + SIM.fish / 2 + lead;
    // Velocidad que quisiera tener la barra para quedar centrada en el objetivo (control proporcional).
    const error = goal - (sim.barPos + sim.barHeight / 2);
    const wanted = Math.max(-10, Math.min(10, error * 0.06));
    const want = sim.barSpeed > wanted;
    if (want !== hold) {
      inputs.push(sim.frame);
      hold = want;
    }
    sim.step(hold);
  }
  return { inputs, frames: sim.frame, caught: sim.caught, treasure: sim.treasureCaught, done: sim.done };
}
