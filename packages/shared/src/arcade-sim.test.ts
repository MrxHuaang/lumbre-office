import { describe, expect, it } from "vitest";
import { ARCADE, ARCADE_MAX_STEPS, maxArcadeScore, plausibleScore, type ArcadeGame } from "./arcade";
import {
  ARCADE_STEP_MS,
  ArcadeRecorder,
  BLOQUES,
  bloquesCells,
  BloquesSim,
  BREAKOUT,
  BreakoutSim,
  createArcadeSim,
  decodeInput,
  encodeInput,
  FLAPPY,
  FlappySim,
  noKeys,
  replayArcade,
  seeded,
  SNAKE,
  SnakeSim,
  type ArcadeKey,
  type ArcadeSim,
} from "./arcade-sim";

type Sim = SnakeSim | BreakoutSim | FlappySim | BloquesSim;

/** Juega como lo haría el navegador (grabando las teclas) con un bot que decide en cada paso. */
function play(game: ArcadeGame, seed: number, bot: (sim: Sim, held: Record<ArcadeKey, boolean>) => { press?: ArcadeKey[]; hold?: Partial<Record<ArcadeKey, boolean>> }, maxSteps = 60 * 60 * 5) {
  const sim = createArcadeSim(game, seed);
  const held = noKeys();
  const rec = new ArcadeRecorder();
  while (!sim.over && rec.steps < maxSteps) {
    const d = bot(sim, held);
    for (const [k, v] of Object.entries(d.hold ?? {}) as [ArcadeKey, boolean][]) {
      if (held[k] === v) continue;
      held[k] = v;
      if (v) rec.hold(k);
      else rec.release(k);
    }
    for (const k of d.press ?? []) {
      sim.press(k);
      rec.press(k);
    }
    sim.step(held);
    rec.steps++;
  }
  return { sim, inputs: rec.inputs, steps: rec.steps };
}

/** Culebrita: va derecho a la manzana sin chocarse (si puede). */
function snakeBot() {
  let last = "";
  return (sim: Sim) => {
    const s = sim as SnakeSim;
    const head = s.body[0]!;
    const key = `${head.x},${head.y}`;
    if (key === last) return {};
    last = key;
    const options: [ArcadeKey, number, number][] = [
      ["right", 1, 0],
      ["left", -1, 0],
      ["down", 0, 1],
      ["up", 0, -1],
    ];
    const safe = options.filter(([, dx, dy]) => {
      if (dx === -s.dir.x && dy === -s.dir.y) return false;
      const x = head.x + dx;
      const y = head.y + dy;
      return x >= 0 && y >= 0 && x < SNAKE.cols && y < SNAKE.rows && !s.body.slice(0, -1).some((b) => b.x === x && b.y === y);
    });
    const dist = ([, dx, dy]: [ArcadeKey, number, number]) => Math.abs(head.x + dx - s.apple.x) + Math.abs(head.y + dy - s.apple.y);
    const best = safe.sort((a, b) => dist(a) - dist(b))[0];
    return best && (best[1] !== s.dir.x || best[2] !== s.dir.y) ? { press: [best[0]] } : {};
  };
}

/** Rompeladrillos: lanza y sigue la pelota con la paleta. */
const breakoutBot = (sim: Sim) => {
  const b = sim as BreakoutSim;
  if (b.stuck) return { press: ["action" as ArcadeKey], hold: { left: false, right: false } };
  const center = b.paddle + BREAKOUT.paddleW / 2;
  const target = b.ball.x + BREAKOUT.ball / 2;
  return { hold: { left: target < center - 3, right: target > center + 3 } };
};

/** Aleteo: aletea cuando cae por debajo del hueco del próximo tubo. */
const flappyBot = (sim: Sim) => {
  const f = sim as FlappySim;
  const next = f.pipes.find((p) => p.x + FLAPPY.pipeW >= FLAPPY.birdX);
  const target = next ? next.gap + FLAPPY.gap - 16 : FLAPPY.startY;
  return f.waiting || (f.y > target && f.vy > 0) ? { press: ["action" as ArcadeKey] } : {};
};

/**
 * Bloques: para cada pieza nueva prueba todos los giros y columnas, se queda con la jugada que borra
 * más filas y deja menos huecos y menos altura, y la hace de a una tecla por paso (girar, correr, soltar).
 */
function bloquesBot() {
  let plan: { rot: number; x: number } | null = null;
  return (sim: Sim) => {
    const b = sim as BloquesSim;
    const p = b.piece;
    if (!p) return {};
    if (!plan) {
      let best: { rot: number; x: number; score: number } | null = null;
      for (let rot = 0; rot < 4; rot++)
        for (let x = -2; x < BLOQUES.cols; x++) {
          const at = { kind: p.kind, rot, x, y: p.y };
          if (!b.fits(at)) continue;
          while (b.fits({ ...at, y: at.y + 1 })) at.y++;
          const board = [...b.board];
          let out = false;
          for (const c of bloquesCells(at.kind, at.rot)) {
            if (at.y + c.y < 0) out = true;
            else board[(at.y + c.y) * BLOQUES.cols + at.x + c.x] = 1;
          }
          if (out) continue;
          let lines = 0;
          let holes = 0;
          let height = 0;
          for (let y = 0; y < BLOQUES.rows; y++) if (board.slice(y * BLOQUES.cols, (y + 1) * BLOQUES.cols).every(Boolean)) lines++;
          for (let cx = 0; cx < BLOQUES.cols; cx++) {
            let top = -1;
            for (let y = 0; y < BLOQUES.rows; y++) {
              const on = board[y * BLOQUES.cols + cx];
              if (on && top < 0) top = y;
              if (!on && top >= 0) holes++;
            }
            if (top >= 0) height += BLOQUES.rows - top;
          }
          const score = lines * 8 - holes * 5 - height * 0.5;
          if (!best || score > best.score) best = { rot, x, score };
        }
      plan = best ?? { rot: 0, x: p.x };
    }
    if (p.rot !== plan.rot) return { press: ["up" as ArcadeKey] };
    if (p.x < plan.x) return { press: ["right" as ArcadeKey] };
    if (p.x > plan.x) return { press: ["left" as ArcadeKey] };
    plan = null;
    return { press: ["action" as ArcadeKey] };
  };
}

const BOTS: Record<ArcadeGame, () => Parameters<typeof play>[2]> = { snake: snakeBot, breakout: () => breakoutBot, flappy: () => flappyBot, bloques: bloquesBot };

describe("simulación del arcade", () => {
  it("la semilla da siempre el mismo azar", () => {
    const a = seeded(42);
    const b = seeded(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    expect(xs).not.toEqual(Array.from({ length: 5 }, seeded(43)));
  });

  it("las teclas se codifican y decodifican", () => {
    expect(decodeInput(encodeInput(1234, 2, "action"))).toEqual({ step: 1234, kind: 2, key: "action" });
    expect(decodeInput(encodeInput(0, 0, "left"))).toEqual({ step: 0, kind: 0, key: "left" });
    expect(decodeInput(15)).toBeNull();
    expect(decodeInput(-1)).toBeNull();
  });

  it.each(["snake", "breakout", "flappy", "bloques"] as const)("%s: la misma semilla y las mismas teclas dan la misma partida", (game) => {
    const run = play(game, 99, BOTS[game](), 60 * 90);
    expect(run.sim.score).toBeGreaterThan(0);
    expect(replayArcade(game, 99, run.inputs, run.steps)).toEqual({ valid: true, score: run.sim.score, over: run.sim.over });
    // Con otra semilla sale otra partida (las teclas ya no calzan).
    expect(replayArcade(game, 100, run.inputs, run.steps)).not.toEqual(replayArcade(game, 99, run.inputs, run.steps));
  });

  it("sin teclas cada juego termina solo y la culebrita cuenta manzanas", () => {
    const snake = replayArcade("snake", 5, [], 60 * 60);
    expect(snake.over).toBe(true);
    const flappy = new FlappySim(1);
    for (let i = 0; i < 600; i++) flappy.step();
    // Sin aletear, el pajarito espera.
    expect(flappy.over).toBe(false);
    flappy.press("action");
    for (let i = 0; i < 600 && !flappy.over; i++) flappy.step();
    expect(flappy.over).toBe(true);
    expect(flappy.score).toBe(0);
  });

  it("rechaza teclas fuera de orden o pasadas de la partida", () => {
    const later = encodeInput(10, 0, "up");
    const before = encodeInput(5, 0, "left");
    expect(replayArcade("snake", 1, [later, before], 100).valid).toBe(false);
    expect(replayArcade("snake", 1, [encodeInput(101, 0, "up")], 100).valid).toBe(false);
    expect(replayArcade("snake", 1, [15], 100).valid).toBe(false);
  });

  it.each(["snake", "breakout", "flappy", "bloques"] as const)("%s: un bot jugando lo mejor que puede queda dentro del tope del juego", (game) => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const run = play(game, seed, BOTS[game]());
      const ms = run.steps * ARCADE_STEP_MS;
      expect(run.sim.score, `semilla ${seed}`).toBeLessThanOrEqual(maxArcadeScore(game, ms));
      expect(plausibleScore(game, run.sim.score, ms)).toBe(true);
    }
  });

  it("aleteo: el tope sigue los tubos (el primero a los 2,3 s y después uno cada 1,6 s)", () => {
    expect(maxArcadeScore("flappy", 2000)).toBe(0);
    expect(maxArcadeScore("flappy", 2400)).toBe(1);
    expect(maxArcadeScore("flappy", 10_000)).toBe(5);
    // Un bot bueno pasa casi todos los tubos que salen.
    const run = play("flappy", 3, flappyBot, 60 * 60);
    expect(run.sim.score).toBeGreaterThanOrEqual(maxArcadeScore("flappy", run.steps * ARCADE_STEP_MS) - 2);
    // Lo que antes aceptaba el servidor (un tubo por segundo) ya no pasa.
    expect(plausibleScore("flappy", 60, 60_000)).toBe(false);
  });

  it("bloques: las piezas caen solas, una fila llena se borra y suma, y el tablero lleno termina la partida", () => {
    const b = new BloquesSim(7);
    const first = b.piece!;
    for (let i = 0; i < BLOQUES.gravityStart; i++) b.step(noKeys());
    expect(b.piece!.y).toBe(first.y + 1);
    // Una fila casi llena: con una pieza que la complete se borra.
    const g = new BloquesSim(3);
    for (let x = 0; x < BLOQUES.cols; x++) g.board[(BLOQUES.rows - 1) * BLOQUES.cols + x] = x < 4 ? 0 : 1;
    g.piece = { kind: 0, rot: 0, x: 0, y: 0 }; // la I acostada en las cuatro que faltan
    g.press("action");
    expect(g.score).toBe(1);
    expect(g.board.slice(-BLOQUES.cols).every((c) => c === 0)).toBe(true);
    // Sin tocar nada, las piezas se apilan hasta arriba.
    const idle = replayArcade("bloques", 11, [], 60 * 60 * 10);
    expect(idle).toMatchObject({ valid: true, over: true, score: 0 });
  });

  it("bloques: el tope sale de las piezas que caben (no alcanza para inventar filas)", () => {
    expect(maxArcadeScore("bloques", 0)).toBe(0);
    expect(maxArcadeScore("bloques", 60_000)).toBeLessThan(140);
    expect(plausibleScore("bloques", 200, 60_000)).toBe(false);
  });

  it("una partida entera cabe en el mensaje", () => {
    expect(ARCADE_MAX_STEPS * ARCADE_STEP_MS).toBeGreaterThanOrEqual(ARCADE.sessionMs);
    const sims: ArcadeSim[] = [new SnakeSim(1), new BreakoutSim(1), new FlappySim(1), new BloquesSim(1)];
    for (const s of sims) expect(s.score).toBe(0);
  });
});
