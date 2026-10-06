// La gente de la fiesta en un nivel (VIR-167, datos en @hyvento/shared gente-fiesta.ts): dónde está cada NPC
// y hacia dónde mira en cada minuto del juego. Es una función pura del minuto (con decimales) y de la semilla
// de cada uno: los recorridos se arman una vez por nivel (con el A* del mapa, ya con la decoración del
// festival) y después solo se muestrean. Así todos los navegadores ven lo mismo, el servidor valida la
// cercanía con la misma cuenta y la sala no guarda nada. Nadie se queda parado sobre un mueble, un portal, un
// punto o un NPC fijo (se corren al tile libre más cercano) y nadie atraviesa paredes: caminan por rutas del
// A*. No bloquean a los jugadores (no tocan la colisión).
import {
  corrilloDe,
  diaDelFestival,
  fechaDelJuego,
  festivalById,
  genteDelFestival,
  GENTE_REGLAS,
  horarioDe,
  lineSeed,
  REFUGIOS,
  type FiestaNpc,
  type Mira,
  type TileXY,
  type Weather,
} from "@hyvento/shared";
import { findPath } from "./pathfinding";
import type { OfficeMap, Seat } from "./world/build";

/** Cómo está un NPC de la fiesta en un momento. */
export interface PoseFiesta {
  /** Los pies, en px del nivel. */
  x: number;
  y: number;
  mira: Mira;
  /** Va caminando (o corriendo) en este momento. */
  camina: boolean;
  corre: boolean;
  /** Sentado en ese asiento (o null). */
  asiento: Seat | null;
  /** Está en su horario (si no, no se dibuja ni se le habla). */
  visible: boolean;
}

type Seg =
  | { kind: "walk"; t0: number; t1: number; pts: { x: number; y: number }[]; cum: number[]; run: boolean; d0: number }
  | { kind: "stay"; t0: number; t1: number; x: number; y: number; mira: Mira; asiento: Seat | null; d0: number };

/** El recorrido de un NPC: tramos en el tiempo; con `period`, se repite (rondas y paseos). */
interface Track {
  segs: Seg[];
  period: number | null;
  /** Desfase de la ronda (minutos), para que no arranquen todos juntos. */
  phase: number;
  /** Lo que camina en una vuelta (px). */
  dist: number;
  /** Un tile libre al lado de su sitio (para quien lo sigue, si no se mueve). */
  beside: { x: number; y: number };
}

interface Actor {
  npc: FiestaNpc;
  track: Track | null;
  /** Si sigue a otro: a quién y a cuántos px. */
  follow?: { leader: string; gap: number; run: boolean };
}

const key = (x: number, y: number) => `${x},${y}`;
const center = (ts: number, t: TileXY) => ({ x: (t.x + 0.5) * ts, y: (t.y + 0.5) * ts });
const DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Hacia dónde mirar para ver algo que está a (dx, dy). */
export function miraHacia(dx: number, dy: number, otherwise: Mira = "down"): Mira {
  if (dx === 0 && dy === 0) return otherwise;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

/** Azar con semilla (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lo que no se tapa: portales, puntos y los NPC fijos del nivel. */
function reservedOf(map: OfficeMap): Set<string> {
  const out = new Set<string>();
  for (const p of map.portals) for (const t of p.tiles) out.add(key(t.x, t.y));
  for (const p of map.points) out.add(key(p.tileX, p.tileY));
  for (const t of map.def.npcTiles ?? []) out.add(key(t.x, t.y));
  return out;
}

/** El nivel visto por la gente de la fiesta: dónde se puede parar alguien. */
class Ground {
  readonly reserved: Set<string>;
  /** Los sitios ya tomados por otro de la fiesta (para no pararse dos en el mismo). */
  readonly taken = new Set<string>();
  constructor(readonly map: OfficeMap) {
    this.reserved = reservedOf(map);
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.map.width && y < this.map.height;
  }

  /** ¿Se puede quedar parado ahí? (sin mueble, sin portal ni punto, dentro de lo jugable). */
  standable(x: number, y: number): boolean {
    if (!this.inside(x, y) || this.map.blocked[y * this.map.width + x] !== 0) return false;
    return !this.reserved.has(key(x, y));
  }

  /** El tile libre más cercano (BFS) que nadie de la fiesta haya tomado, o null. */
  nearest(from: TileXY, maxRadius = 10): TileXY | null {
    const seen = new Set<string>();
    let frontier: TileXY[] = [from];
    for (let r = 0; r <= maxRadius && frontier.length; r++) {
      const next: TileXY[] = [];
      for (const p of frontier) {
        const k = key(p.x, p.y);
        if (seen.has(k) || !this.inside(p.x, p.y)) continue;
        seen.add(k);
        if (this.standable(p.x, p.y) && !this.taken.has(k)) return p;
        for (const [dx, dy] of DIRS) next.push({ x: p.x + dx, y: p.y + dy });
      }
      frontier = next;
    }
    return null;
  }

  /** Toma un sitio (para que nadie más se pare ahí). */
  take(t: TileXY) {
    this.taken.add(key(t.x, t.y));
  }

  seatAt(t: TileXY): Seat | null {
    if (!this.inside(t.x, t.y)) return null;
    return this.map.seats.get(t.y * this.map.width + t.x) ?? null;
  }
}

/** Arma un tramo caminando por una ruta de tiles (px del centro de cada tile). */
function walkSeg(ts: number, from: TileXY, path: readonly TileXY[], t0: number, speed: number, run: boolean, d0: number): Seg {
  const pts = [center(ts, from), ...path.map((t) => center(ts, t))];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  const len = cum[cum.length - 1]!;
  return { kind: "walk", t0, t1: t0 + len / speed, pts, cum, run, d0 };
}

const segLen = (s: Seg) => (s.kind === "walk" ? s.cum[s.cum.length - 1]! : 0);

/** Un libre al lado de un tile (para quien lo sigue), o el mismo. */
function besideOf(g: Ground, t: TileXY): { x: number; y: number } {
  for (const [dx, dy] of DIRS) {
    const n = { x: t.x + dx, y: t.y + dy };
    if (g.standable(n.x, n.y) && !g.taken.has(key(n.x, n.y))) return center(g.map.tileSize, n);
  }
  return center(g.map.tileSize, t);
}

/** Un recorrido que pasa por esas paradas en orden y vuelve a la primera (se salta la que no tiene ruta). */
function loopTrack(g: Ground, npc: FiestaNpc, stops: { t: TileXY; mira?: Mira; pausa: number }[], run: boolean): Track | null {
  const ts = g.map.tileSize;
  const speed = (run ? GENTE_REGLAS.corridaTiles : GENTE_REGLAS.pasoTiles) * ts;
  // Solo las paradas a las que se llega desde la anterior.
  const ok: typeof stops = [];
  for (const s of stops) {
    const prev = ok[ok.length - 1];
    if (!prev || (prev.t.x === s.t.x && prev.t.y === s.t.y) || findPath(g.map, prev.t, s.t)) {
      if (!prev || prev.t.x !== s.t.x || prev.t.y !== s.t.y) ok.push(s);
    }
  }
  while (ok.length > 1 && !findPath(g.map, ok[ok.length - 1]!.t, ok[0]!.t)) ok.pop();
  if (ok.length < 2) return null;
  const segs: Seg[] = [];
  let t = 0;
  let d = 0;
  ok.forEach((s, i) => {
    const next = ok[(i + 1) % ok.length]!;
    const pause = Math.max(0.2, s.pausa);
    const c = center(ts, s.t);
    const path = findPath(g.map, s.t, next.t) ?? [];
    const walk = walkSeg(ts, s.t, path, t + pause, speed, run, d);
    const first = walk.kind === "walk" && walk.pts[1] ? walk.pts[1] : c;
    const mira = s.mira ?? miraHacia(first.x - c.x, first.y - c.y);
    segs.push({ kind: "stay", t0: t, t1: t + pause, x: c.x, y: c.y, mira, asiento: null, d0: d });
    segs.push(walk);
    t = walk.t1;
    d += segLen(walk);
  });
  return { segs, period: t, phase: ((lineSeed(`fase:${npc.id}`) % 1000) / 1000) * t, dist: d, beside: besideOf(g, ok[0]!.t) };
}

/** Quieto en un sitio de su horario; si `llega`, entra caminando desde ahí y se va por ahí mismo. */
function stayTrack(g: Ground, npc: FiestaNpc, spot: TileXY, mira: Mira, asiento: Seat | null): Track {
  const ts = g.map.tileSize;
  const { desde, hasta } = horarioDe(npc);
  const c = asiento ? { x: asiento.x, y: asiento.y } : center(ts, spot);
  const segs: Seg[] = [];
  const llega = npc.llega && !(npc.llega.x === spot.x && npc.llega.y === spot.y) ? npc.llega : null;
  // Al asiento se llega por un tile libre pegado a él (el asiento es parte del mueble).
  const door = asiento ? (g.nearest(spot, 2) ?? spot) : spot;
  const inPath = llega ? findPath(g.map, llega, door) : null;
  const speed = GENTE_REGLAS.pasoTiles * ts;
  let t = desde;
  if (llega && inPath) {
    const w = walkSeg(ts, llega, inPath, desde, speed, false, 0);
    segs.push(w);
    t = w.t1;
  }
  const outPath = llega && inPath ? findPath(g.map, door, llega) : null;
  const outLen = outPath ? walkSeg(ts, door, outPath, 0, speed, false, 0).t1 : 0;
  const stayEnd = Math.max(t, hasta - outLen);
  segs.push({ kind: "stay", t0: t, t1: stayEnd, x: c.x, y: c.y, mira, asiento, d0: 0 });
  if (outPath && llega) segs.push(walkSeg(ts, door, outPath, stayEnd, speed, false, 0));
  return { segs, period: null, phase: 0, dist: 0, beside: besideOf(g, spot) };
}

/** Las paradas sorteadas de un paseo dentro de su rectángulo (con la semilla del NPC y del día). */
function wanderStops(g: Ground, npc: FiestaNpc, zona: { x: number; y: number; w: number; h: number }, n: number, day: number): TileXY[] {
  const rand = rng(lineSeed(`deambula:${npc.id}:${day}`));
  const out: TileXY[] = [];
  for (let tries = 0; out.length < n && tries < n * 40; tries++) {
    const t = { x: zona.x + Math.floor(rand() * zona.w), y: zona.y + Math.floor(rand() * zona.h) };
    if (!g.standable(t.x, t.y) || g.taken.has(key(t.x, t.y))) continue;
    const prev = out[out.length - 1] ?? npc.tile;
    if (findPath(g.map, prev, t)) out.push(t);
  }
  return out;
}

/** El sitio de alguien que se queda quieto: su tile si está libre, si no el libre más cercano. */
function spotOf(g: Ground, t: TileXY): TileXY {
  const spot = g.nearest(t) ?? t;
  g.take(spot);
  return spot;
}

/** Arma los recorridos de la gente de un nivel (en el orden de la lista: los quietos reservan primero). */
function buildActors(map: OfficeMap, npcs: readonly FiestaNpc[], day: number): Map<string, Actor> {
  const g = new Ground(map);
  const ts = map.tileSize;
  const actors = new Map<string, Actor>();
  const moving = (n: FiestaNpc) => ["ronda", "deambula", "sigue"].includes(n.comportamiento.tipo);
  // Primero los que se quedan en un sitio (toman su tile), los de la lluvia con su techo.
  const refugios = REFUGIOS[map.id] ?? [];
  for (const npc of npcs.filter((n) => !moving(n))) {
    const c = npc.comportamiento;
    if (npc.refugio) {
      const from = refugios.length ? refugios[lineSeed(`refugio:${npc.id}`) % refugios.length]! : npc.tile;
      const spot = spotOf(g, from);
      actors.set(npc.id, { npc, track: stayTrack(g, npc, spot, "down", null) });
      continue;
    }
    if (c.tipo === "sentado") {
      const seat = g.seatAt(c.asiento);
      if (seat && !g.taken.has(key(c.asiento.x, c.asiento.y))) {
        g.take(c.asiento);
        actors.set(npc.id, { npc, track: stayTrack(g, npc, c.asiento, seat.facing, seat) });
        continue;
      }
    }
    const spot = spotOf(g, npc.tile);
    const mira: Mira =
      c.tipo === "grupo" ? miraHacia(c.centro.x - spot.x, c.centro.y - spot.y) : c.tipo === "quieto" || c.tipo === "baila" ? (c.mira ?? "down") : "down";
    actors.set(npc.id, { npc, track: stayTrack(g, npc, spot, mira, null) });
  }
  // Luego los que caminan (sus paradas no se quedan con el tile: solo pasan).
  for (const npc of npcs.filter((n) => n.comportamiento.tipo === "ronda" || n.comportamiento.tipo === "deambula")) {
    const c = npc.comportamiento;
    let track: Track | null = null;
    if (c.tipo === "ronda") {
      const stops = c.paradas.map((p) => ({ t: g.nearest(p) ?? p, mira: p.mira, pausa: p.pausa ?? c.pausa ?? 1.5 }));
      track = loopTrack(g, npc, stops, Boolean(c.corre));
    } else if (c.tipo === "deambula") {
      const stops = wanderStops(g, npc, c.zona, Math.max(2, c.paradas ?? 6), day).map((t) => ({ t, pausa: c.pausa ?? 2 }));
      track = loopTrack(g, npc, stops, false);
    }
    // Sin recorrido posible, se queda quieto en su sitio.
    actors.set(npc.id, { npc, track: track ?? stayTrack(g, npc, spotOf(g, npc.tile), "down", null) });
  }
  // Al final los que siguen a otro (por su mismo camino, a su distancia).
  for (const npc of npcs.filter((n) => n.comportamiento.tipo === "sigue")) {
    const c = npc.comportamiento;
    if (c.tipo !== "sigue") continue;
    if (actors.has(c.a) && actors.get(c.a)!.follow === undefined) actors.set(npc.id, { npc, track: null, follow: { leader: c.a, gap: (c.distancia ?? 1.5) * ts, run: Boolean(c.corre) } });
    else actors.set(npc.id, { npc, track: stayTrack(g, npc, spotOf(g, npc.tile), "down", null) });
  }
  return actors;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** El tramo de un recorrido en ese minuto (y el minuto dentro del recorrido), o null fuera de él. */
function segAt(track: Track, minuto: number): { seg: Seg; t: number } | null {
  const t = track.period ? mod(minuto + track.phase, track.period) : minuto;
  const segs = track.segs;
  if (!track.period && (t < segs[0]!.t0 || t >= segs[segs.length - 1]!.t1)) return null;
  // Búsqueda binaria por el comienzo del tramo.
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid]!.t0 <= t) lo = mid;
    else hi = mid - 1;
  }
  return { seg: segs[lo]!, t };
}

/** Dónde va a lo largo de un tramo caminando, a `d` px del comienzo. */
function alongWalk(seg: Extract<Seg, { kind: "walk" }>, d: number): { x: number; y: number; mira: Mira } {
  const { pts, cum } = seg;
  if (pts.length === 1) return { ...pts[0]!, mira: "down" };
  let i = 1;
  while (i < cum.length - 1 && cum[i]! < d) i++;
  const a = pts[i - 1]!;
  const b = pts[i]!;
  const span = cum[i]! - cum[i - 1]! || 1;
  const k = Math.min(1, Math.max(0, (d - cum[i - 1]!) / span));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, mira: miraHacia(b.x - a.x, b.y - a.y) };
}

/** La pose de un recorrido a ese minuto (y lo caminado en la vuelta, para quien lo sigue). */
function trackPose(track: Track, minuto: number): (Omit<PoseFiesta, "visible"> & { d: number }) | null {
  const at = segAt(track, minuto);
  if (!at) return null;
  const { seg, t } = at;
  if (seg.kind === "stay") return { x: seg.x, y: seg.y, mira: seg.mira, camina: false, corre: false, asiento: seg.asiento, d: seg.d0 };
  const len = segLen(seg);
  const dur = seg.t1 - seg.t0 || 1;
  const d = Math.min(len, ((t - seg.t0) / dur) * len);
  const p = alongWalk(seg, d);
  return { x: p.x, y: p.y, mira: p.mira, camina: true, corre: seg.run, asiento: null, d: seg.d0 + d };
}

/** Dónde estaba el recorrido cuando llevaba `d` px caminados en la vuelta. */
function atDistance(track: Track, d: number): { x: number; y: number; mira: Mira } {
  for (const seg of track.segs) {
    if (seg.kind !== "walk") continue;
    const len = segLen(seg);
    if (d >= seg.d0 && d <= seg.d0 + len) return alongWalk(seg, d - seg.d0);
  }
  const first = track.segs[0]!;
  return first.kind === "stay" ? { x: first.x, y: first.y, mira: first.mira } : alongWalk(first, 0);
}

const HIDDEN: PoseFiesta = { x: 0, y: 0, mira: "down", camina: false, corre: false, asiento: null, visible: false };

/** La gente de la fiesta de un nivel, con sus recorridos armados. */
export class GenteNivel {
  private readonly actors: Map<string, Actor>;
  readonly npcs: readonly FiestaNpc[];
  constructor(
    readonly map: OfficeMap,
    npcs: readonly FiestaNpc[],
    readonly day: number,
  ) {
    this.npcs = npcs.filter((n) => n.area === map.id);
    this.actors = buildActors(map, this.npcs, day);
  }

  npc(id: string): FiestaNpc | undefined {
    return this.actors.get(id)?.npc;
  }

  /** Dónde está y cómo, a ese minuto del día del juego (con decimales). */
  pose(id: string, minuto: number): PoseFiesta {
    const a = this.actors.get(id);
    if (!a) return HIDDEN;
    const { desde, hasta } = horarioDe(a.npc);
    if (minuto < desde || minuto >= hasta) return HIDDEN;
    if (a.follow) return this.followPose(a, minuto);
    const p = a.track && trackPose(a.track, minuto);
    if (!p) return HIDDEN;
    return { x: p.x, y: p.y, mira: p.mira, camina: p.camina, corre: p.corre, asiento: p.asiento, visible: true };
  }

  /**
   * Quien sigue a otro va por su mismo camino, `gap` px atrás (con un vaivén, como niños que corren): si el
   * otro no camina (o se detiene), se queda a su lado.
   */
  private followPose(a: Actor, minuto: number): PoseFiesta {
    const leader = this.actors.get(a.follow!.leader)!;
    const lead = this.pose(leader.npc.id, minuto);
    if (!lead.visible || !leader.track) return HIDDEN;
    const track = leader.track;
    if (!track.period || track.dist <= 0) {
      const b = track.beside;
      return { x: b.x, y: b.y, mira: miraHacia(lead.x - b.x, lead.y - b.y), camina: false, corre: false, asiento: null, visible: true };
    }
    const ts = this.map.tileSize;
    const sway = Math.sin(minuto * 4.3 + (lineSeed(a.npc.id) % 7)) * 0.35 * ts;
    const at = (m: number) => {
      const lp = trackPose(track, m);
      return atDistance(track, mod((lp?.d ?? 0) - a.follow!.gap - sway, track.dist));
    };
    const now = at(minuto);
    const before = at(minuto - 0.04);
    const moved = Math.hypot(now.x - before.x, now.y - before.y) > 0.5;
    const mira = moved ? miraHacia(now.x - before.x, now.y - before.y) : miraHacia(lead.x - now.x, lead.y - now.y);
    return { x: now.x, y: now.y, mira, camina: moved, corre: moved && a.follow!.run, asiento: null, visible: true };
  }

  /**
   * ¿Está (x, y) a menos de `tiles` de ese NPC a ese minuto? (con la demora de la red, mira un poco antes y
   * después). Con `atras`, también donde estuvo hasta esos minutos antes: mientras se habla con alguien, en
   * ese navegador se queda quieto y va atrasado.
   */
  near(id: string, minuto: number, x: number, y: number, tiles: number, atras = 0): boolean {
    const reach = tiles * this.map.tileSize;
    const cerca = (m: number) => {
      const p = this.pose(id, m);
      return p.visible && Math.hypot(p.x - x, p.y - y) <= reach;
    };
    for (const dm of [0, -0.25, -0.5, 0.25]) if (cerca(minuto + dm)) return true;
    for (let dm = 1; dm <= atras; dm += 0.5) if (cerca(minuto - dm)) return true;
    return false;
  }

  /** Los sitios donde se queda cada uno (paradas, asientos, su puesto): para los tests. */
  stops(id: string): { x: number; y: number; asiento: boolean }[] {
    const t = this.actors.get(id)?.track;
    return t ? t.segs.flatMap((s) => (s.kind === "stay" ? [{ x: s.x, y: s.y, asiento: Boolean(s.asiento) }] : [])) : [];
  }

  /** Los tramos caminando de cada uno (px): para los tests. */
  walks(id: string): { x: number; y: number }[][] {
    const t = this.actors.get(id)?.track;
    return t ? t.segs.flatMap((s) => (s.kind === "walk" ? [s.pts] : [])) : [];
  }

  /** ¿Va por un recorrido que se repite? */
  loops(id: string): boolean {
    return Boolean(this.actors.get(id)?.track?.period);
  }

  /** Los del mismo corrillo (que conversan por turnos), en orden. */
  corrillo(id: string): string[] {
    const c = this.actors.get(id) && corrilloDe(this.actors.get(id)!.npc);
    return c ? this.npcs.filter((n) => corrilloDe(n) === c).map((n) => n.id) : [];
  }
}

const cache = new WeakMap<OfficeMap, Map<string, GenteNivel>>();

/**
 * La gente del festival que corre en un nivel (`diaJuego` = el día del reloj del juego; el clima de afuera).
 * Se arma una vez por nivel y combinación (el mapa ya trae la decoración del festival y los cambios del
 * editor: si cambia, es otro mapa y se arma de nuevo).
 */
export function genteDelNivel(map: OfficeMap, festivalId: string | null | undefined, diaJuego: number, clima: Weather): GenteNivel | null {
  const f = festivalId ? festivalById(festivalId) : undefined;
  if (!f) return null;
  const k = `${f.id}:${diaJuego}:${clima}`;
  let byKey = cache.get(map);
  if (!byKey) cache.set(map, (byKey = new Map()));
  let nivel = byKey.get(k);
  if (!nivel) {
    const dia = diaDelFestival(f, fechaDelJuego(diaJuego).diaDeEstacion);
    nivel = new GenteNivel(map, genteDelFestival(f.id, dia, clima), diaJuego);
    // Una entrada por combinación (el clima cambia un par de veces por día).
    if (byKey.size > 8) byKey.clear();
    byKey.set(k, nivel);
  }
  return nivel.npcs.length ? nivel : null;
}
