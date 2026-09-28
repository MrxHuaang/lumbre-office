// Hockey de mesa del arcade: la física del disco y los mazos, el rival automático ("la máquina") y los
// mensajes. La simulación la corre el servidor con el reloj de la sala (pasos fijos) y reparte cuadros;
// el navegador solo los interpola y dibuja sobre la mesa. Todo determinista: sumas, productos y raíces.
import { z } from "zod";

/**
 * Medidas de la cancha en unidades de arte (16 por tile), medidas desde su esquina: `x` a lo ancho e `y`
 * a lo largo. El lado 0 defiende el arco de y = 0 (el norte, al fondo) y el lado 1 el de y = largo.
 */
export const HOCKEY = {
  width: 26,
  length: 42,
  /** Boca de cada arco (centrada). */
  goalWidth: 11,
  puckR: 1.6,
  malletR: 2.6,
  /** Velocidad máxima del mazo de una persona y del de la máquina (u/s). */
  malletSpeed: 95,
  botSpeed: 52,
  /** La máquina vuelve a pensar a dónde ir cada tanto (no en cada paso): tiene reflejos, no es perfecta. */
  botReactMs: 150,
  /** Velocidad máxima del disco (u/s). */
  puckMax: 115,
  /** Parte de la velocidad que el disco pierde por segundo (la mesa sopla aire: casi nada). */
  friction: 0.22,
  /** Cuánto rebota contra las bandas y contra un mazo. */
  wallBounce: 0.86,
  hitBounce: 0.9,
  /** Paso fijo de la física y cada cuánto avanza y reparte la sala (3 pasos por vez). */
  stepMs: 1000 / 60,
  tickMs: 50,
  /** Goles para ganar. */
  toWin: 7,
  countdownMs: 3000,
  goalPauseMs: 1400,
  overMs: 5000,
  /** Cuánto se espera a un rival antes de devolver la moneda. */
  waitMs: 90_000,
  /** Sin mover el mazo este tiempo en pleno partido, se pierde por abandono. */
  idleMs: 30_000,
  /** Un partido no dura más que esto: gana el que va arriba (empate = se devuelve todo). */
  maxMs: 6 * 60_000,
} as const;

export type HockeySide = 0 | 1;
export const HOCKEY_MID = HOCKEY.length / 2;
/** Boca del arco: de `goalX0` a `goalX1`. */
export const HOCKEY_GOAL_X0 = (HOCKEY.width - HOCKEY.goalWidth) / 2;
export const HOCKEY_GOAL_X1 = HOCKEY_GOAL_X0 + HOCKEY.goalWidth;

export interface HockeyBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface HockeyMallet extends HockeyBody {
  /** A dónde quiere ir (lo que manda la persona, ya limitado a su mitad). */
  tx: number;
  ty: number;
}

export interface HockeyWorld {
  puck: HockeyBody;
  mallets: [HockeyMallet, HockeyMallet];
}

export type HockeyEvent = "hit" | "wall" | { goal: HockeySide };

/** Dónde espera cada mazo: frente a su arco. */
export function malletHome(side: HockeySide): { x: number; y: number } {
  return { x: HOCKEY.width / 2, y: side === 0 ? 6 : HOCKEY.length - 6 };
}

/** Dónde se pone el disco para sacar: en la mitad del lado que saca, quieto. */
export function serveSpot(side: HockeySide): { x: number; y: number } {
  return { x: HOCKEY.width / 2, y: side === 0 ? HOCKEY.length / 4 : (HOCKEY.length * 3) / 4 };
}

export function newHockeyWorld(serve: HockeySide): HockeyWorld {
  const mallet = (side: HockeySide): HockeyMallet => {
    const h = malletHome(side);
    return { x: h.x, y: h.y, vx: 0, vy: 0, tx: h.x, ty: h.y };
  };
  const s = serveSpot(serve);
  return { puck: { x: s.x, y: s.y, vx: 0, vy: 0 }, mallets: [mallet(0), mallet(1)] };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Limita un punto a la mitad de ese lado (el mazo entero adentro de la cancha y sin cruzar el medio). */
export function clampToHalf(side: HockeySide, x: number, y: number): { x: number; y: number } {
  const r = HOCKEY.malletR;
  const y0 = side === 0 ? r : HOCKEY_MID + r;
  const y1 = side === 0 ? HOCKEY_MID - r : HOCKEY.length - r;
  return { x: clamp(x, r, HOCKEY.width - r), y: clamp(y, y0, y1) };
}

/** Pone el destino del mazo (limitado a su mitad). Números raros (NaN) no lo mueven. */
export function aimMallet(w: HockeyWorld, side: HockeySide, x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const p = clampToHalf(side, x, y);
  w.mallets[side].tx = p.x;
  w.mallets[side].ty = p.y;
}

/** Avanza un mazo hacia su destino sin pasar de `speed`; su velocidad queda para el golpe. */
function moveMallet(m: HockeyMallet, speed: number, dt: number) {
  const dx = m.tx - m.x;
  const dy = m.ty - m.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const max = speed * dt;
  const k = len <= max || len === 0 ? 1 : max / len;
  m.vx = (dx * k) / dt;
  m.vy = (dy * k) / dt;
  m.x += dx * k;
  m.y += dy * k;
}

const inMouth = (x: number) => x > HOCKEY_GOAL_X0 && x < HOCKEY_GOAL_X1;

/** Choque del disco con un mazo: lo saca de encima y, si se acercaban, rebota con la velocidad del mazo. */
function collide(p: HockeyBody, m: HockeyMallet, side: HockeySide): boolean {
  const R = HOCKEY.puckR + HOCKEY.malletR;
  let dx = p.x - m.x;
  let dy = p.y - m.y;
  let d2 = dx * dx + dy * dy;
  if (d2 >= R * R) return false;
  if (d2 === 0) {
    // Justo encima: sale hacia la cancha del rival.
    dx = 0;
    dy = side === 0 ? 1 : -1;
    d2 = 1;
  }
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  p.x = m.x + nx * R;
  p.y = m.y + ny * R;
  const rel = (p.vx - m.vx) * nx + (p.vy - m.vy) * ny;
  if (rel < 0) {
    p.vx -= (1 + HOCKEY.hitBounce) * rel * nx;
    p.vy -= (1 + HOCKEY.hitBounce) * rel * ny;
  }
  const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  if (sp > HOCKEY.puckMax) {
    p.vx = (p.vx / sp) * HOCKEY.puckMax;
    p.vy = (p.vy / sp) * HOCKEY.puckMax;
  }
  return true;
}

/** Bandas: las de los costados siempre; las de las puntas, salvo en la boca del arco. */
function walls(p: HockeyBody): boolean {
  const r = HOCKEY.puckR;
  const b = HOCKEY.wallBounce;
  let hit = false;
  if (p.x < r) {
    p.x = r;
    p.vx = Math.abs(p.vx) * b;
    hit = true;
  } else if (p.x > HOCKEY.width - r) {
    p.x = HOCKEY.width - r;
    p.vx = -Math.abs(p.vx) * b;
    hit = true;
  }
  if (!inMouth(p.x)) {
    if (p.y < r) {
      p.y = r;
      p.vy = Math.abs(p.vy) * b;
      hit = true;
    } else if (p.y > HOCKEY.length - r) {
      p.y = HOCKEY.length - r;
      p.vy = -Math.abs(p.vy) * b;
      hit = true;
    }
  }
  return hit;
}

/**
 * Un paso fijo (HOCKEY.stepMs). `puck` = el disco está en juego (en la pausa del gol solo se mueven los
 * mazos). `speeds` = velocidad máxima de cada mazo (el de la máquina es más lento). Devuelve lo que pasó:
 * golpes, rebotes y el gol (`goal` = lado que lo hizo).
 */
export function stepHockey(w: HockeyWorld, puck: boolean, speeds: readonly [number, number] = [HOCKEY.malletSpeed, HOCKEY.malletSpeed]): HockeyEvent[] {
  const events: HockeyEvent[] = [];
  // Dos subpasos: a toda velocidad el disco no atraviesa un mazo.
  const dt = HOCKEY.stepMs / 1000 / 2;
  for (let sub = 0; sub < 2; sub++) {
    moveMallet(w.mallets[0], speeds[0], dt);
    moveMallet(w.mallets[1], speeds[1], dt);
    if (!puck) continue;
    const p = w.puck;
    const keep = 1 - HOCKEY.friction * dt;
    p.vx *= keep;
    p.vy *= keep;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (walls(p) && !events.includes("wall")) events.push("wall");
    for (const side of [0, 1] as const) if (collide(p, w.mallets[side], side) && !events.includes("hit")) events.push("hit");
    // Un mazo pudo empujar el disco contra la banda.
    walls(p);
    if (p.y < 0 && inMouth(p.x)) {
      events.push({ goal: 1 });
      return events;
    }
    if (p.y > HOCKEY.length && inMouth(p.x)) {
      events.push({ goal: 0 });
      return events;
    }
  }
  return events;
}

/**
 * El rival automático: a dónde lleva su mazo. Si el disco está en su mitad (y no se le escapa hacia el
 * arco propio muy rápido) va a pegarle desde atrás, apuntando al arco de enfrente; si no, cuida su arco
 * siguiendo el disco de costado. Lento a propósito (HOCKEY.botSpeed): se le puede ganar.
 */
export function botAim(w: HockeyWorld, side: HockeySide): { x: number; y: number } {
  const L = HOCKEY.length;
  // Todo se piensa como si la máquina fuera el lado 0 (su arco en y = 0).
  const flip = (y: number) => (side === 0 ? y : L - y);
  const p = { x: w.puck.x, y: flip(w.puck.y), vy: side === 0 ? w.puck.vy : -w.puck.vy };
  const m = w.mallets[side];
  const me = { x: m.x, y: flip(m.y) };
  const R = HOCKEY.puckR + HOCKEY.malletR;
  let target: { x: number; y: number };
  if (p.y < HOCKEY_MID && p.vy > -60) {
    if (me.y > p.y - 1) {
      // Quedó delante del disco: primero vuelve por detrás, por el costado.
      const off = me.x < p.x ? -R - 1 : R + 1;
      target = { x: p.x + off, y: p.y - R };
    } else {
      // Detrás del disco, apuntando al palo del arco de enfrente que el rival deja más libre: lo atraviesa
      // para pegarle (al medio siempre, el rival la para siempre).
      const rival = w.mallets[side === 0 ? 1 : 0].x;
      const aimX = rival < HOCKEY.width / 2 ? HOCKEY_GOAL_X1 - 1 : HOCKEY_GOAL_X0 + 1;
      const ax = aimX - p.x;
      const ay = L - p.y;
      const len = Math.sqrt(ax * ax + ay * ay) || 1;
      target = { x: p.x + (ax / len) * R, y: p.y + (ay / len) * R };
    }
  } else {
    // Cuida el arco a medias: se corre hacia el disco pero sin llegar al palo (un tiro cruzado entra).
    const home = malletHome(0);
    target = { x: clamp((HOCKEY.width / 2 + p.x) / 2, HOCKEY_GOAL_X0 + 1.5, HOCKEY_GOAL_X1 - 1.5), y: home.y };
  }
  return clampToHalf(side, target.x, flip(target.y));
}

// ---------- Mensajes ----------

/** Cliente → servidor (`MSG.hockeyJoin`): jugar en la punta de la mesa donde estoy (`bot` = contra la máquina). */
export const HockeyJoinMessage = z.object({ bot: z.boolean().optional() });
export type HockeyJoinMessage = z.infer<typeof HockeyJoinMessage>;

/** Cliente → servidor (`MSG.hockeyMove`): a dónde quiero llevar mi mazo (coordenadas de la cancha). */
export const HockeyMoveMessage = z.object({ x: z.number().finite(), y: z.number().finite() });
export type HockeyMoveMessage = z.infer<typeof HockeyMoveMessage>;

export type HockeyPhase = "idle" | "waiting" | "countdown" | "playing" | "goal" | "over";

export type HockeyError = "far" | "busy" | "funds" | "failed" | "closed";

/** Servidor → cliente (`MSG.hockeyResult`): respuesta a sumarse (y el saldo después de pagar). */
export type HockeyResult = { ok: true; balance: number } | { ok: false; error: HockeyError };

export const HOCKEY_ERROR_TEXT: Record<HockeyError, string> = {
  far: "Párate en una punta de la mesa de hockey para jugar.",
  busy: "La mesa está ocupada: espera a que termine el partido.",
  funds: "No te alcanzan las monedas para jugar.",
  failed: "No se pudo cobrar la partida. Intenta de nuevo.",
  closed: "Ya no se puede sumar a ese partido.",
};

/**
 * Servidor → los del sótano (`MSG.hockeyFrame`), cada HOCKEY.tickMs mientras hay partido: hora del
 * servidor, el disco (x, y, vx, vy), los dos mazos (x, y) y lo que sonó desde el cuadro anterior.
 */
export interface HockeyFrame {
  t: number;
  p: [number, number, number, number];
  m: [number, number, number, number];
  ev?: ("hit" | "wall" | "goal")[];
}

/** Servidor → los dos jugadores (`MSG.hockeySettled`): cómo terminó el partido para esa persona. */
export interface HockeySettled {
  match: number;
  outcome: "win" | "lose" | "tie" | "refund";
  /** Lo que volvió a su saldo (el pozo, la moneda devuelta o nada). */
  won: number;
  /** Premio de ocio por ganarle a la máquina (0 si no, o si ya llegó al tope del día). */
  bonus: number;
  /** Terminó porque alguien se fue o dejó de jugar. */
  forfeit: boolean;
}

/** Redondea para mandar (centésimas de unidad de arte: más que suficiente para dibujar). */
export const hockeyRound = (v: number) => Math.round(v * 100) / 100;
