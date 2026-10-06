// La Noche de velitas en la sala (reglas en velitas.ts de @hyvento/shared y de @hyvento/map). Con el
// festival abierto: a cada quien le deja velitas y un farol de deseos en la mochila (al abrir y al entrar),
// valida dónde se prende cada velita (en el jardín, cerquita, en un tile libre, con su tope por persona y
// el total), avisa las metas del equipo con su cinemática y suelta los faroles desde el muelle con un deseo
// moderado (uno por persona). Todo vive en `state.velitas` (en memoria) y se borra al terminar el festival.
import { onWishDock, velitaBlock, velitaInReach, type OfficeMap } from "@hyvento/map";
import {
  cleanDeseo,
  DeseoMessage,
  FAROL_DESEOS,
  FAROL_ITEM,
  FESTIVAL_MSG,
  metaAlcanzada,
  VELITA_ITEM,
  VELITAS,
  VELITAS_CINE,
  VELITAS_MSG,
  VelitaPlace,
  type FarolEvent,
  type FestivalCineEvent,
  type VelitasNotice,
} from "@hyvento/shared";
import type { Bag } from "./bag";
import { DeseoState, VelitaState, type VelitasState } from "../state";

export const VELITAS_ID = "velitas";

/** Lo que el módulo necesita de quien juega (el `Player` de la sala). */
export interface VelitasPlayer {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
}

export interface VelitasParts {
  state(): VelitasState;
  /** El festival y la fase que publica la sala (`state.festival`, `state.festivalFase`). */
  festival(): { id: string; fase: string };
  player(sessionId: string): VelitasPlayer | undefined;
  /** Quienes están conectados (sessionId → jugador), para el regalo al abrir. */
  players(): Iterable<[string, VelitasPlayer]>;
  mapOf(area: string): OfficeMap;
  held: Pick<Bag, "count" | "add" | "take" | "hand" | "fits">;
  send(sessionId: string, type: string, msg: unknown): void;
  broadcast(type: string, msg: unknown): void;
  now(): number;
}

type Room = { onMessage(type: string, cb: (client: { sessionId: string }, raw: unknown) => void): unknown };

export class Velitas {
  /** Metas del equipo que ya salieron (no se repiten aunque alguien juegue con el contador). */
  private metas = new Set<number>();
  private lastPlace = new Map<string, number>();
  /** Lo que se está regalando ahora (dos avisos seguidos no regalan dos veces). */
  private giving = new Set<string>();
  /** El festival estaba prendido en la última revisión (para regalar al abrir y borrar al terminar). */
  private wasOpen = false;

  constructor(private readonly parts: VelitasParts) {}

  /** ¿Se pueden prender velitas y soltar faroles ahora? */
  open(): boolean {
    const f = this.parts.festival();
    return f.id === VELITAS_ID && f.fase === "fiesta";
  }

  /**
   * Cambió el festival o su fase: al abrir, regala a quienes ya están; cuando deja de ser la Noche de
   * velitas (otro día, o se apagó a mano), se borran las velitas y los deseos. Del cierre (22:00) a la
   * medianoche siguen prendidas, pero ya no se ponen más.
   */
  festivalChanged(id: string, fase: string) {
    if (id !== VELITAS_ID) this.reset();
    const isOpen = id === VELITAS_ID && fase === "fiesta";
    if (isOpen && !this.wasOpen) for (const [, p] of this.parts.players()) void this.gift(p.userId);
    this.wasOpen = isOpen;
  }

  /** Alguien entró (con la mochila ya leída): si la noche está andando, sus velitas. */
  joined(userId: string) {
    if (this.open()) void this.gift(userId);
  }

  private reset() {
    const st = this.parts.state();
    if (st.placed.size) st.placed.clear();
    if (st.wishes.size) st.wishes.clear();
    st.lit = 0;
    this.metas.clear();
    this.lastPlace.clear();
  }

  private placedBy(userId: string): number {
    let n = 0;
    for (const v of this.parts.state().placed.values()) if (v.by === userId) n++;
    return n;
  }

  /**
   * Completa las velitas de alguien hasta `VELITAS.regalo` (contando las que ya prendió) y le da un farol
   * si no tiene y no ha soltado el suyo. Contar en vez de recordar: entrar dos veces no da el doble.
   */
  async gift(userId: string): Promise<void> {
    if (this.giving.has(userId)) return;
    this.giving.add(userId);
    try {
      const { held } = this.parts;
      const velitas = Math.max(0, VELITAS.regalo - held.count(userId, VELITA_ITEM) - this.placedBy(userId));
      const farol = held.count(userId, FAROL_ITEM) === 0 && !this.parts.state().wishes.has(userId);
      if (!velitas && !farol) return;
      const items: [string, number][] = [];
      if (velitas) items.push([VELITA_ITEM, velitas]);
      if (farol) items.push([FAROL_ITEM, 1]);
      if (held.fits(userId, items) !== "ok") return this.notice(userId, { code: "llena" });
      for (const [item, n] of items) await held.add(userId, item, n);
      this.notice(userId, { code: "regalo", n: velitas, farol });
    } finally {
      this.giving.delete(userId);
    }
  }

  /** Prender una velita en un tile del jardín: valida todo y la deja en el estado para todos. */
  async place(sessionId: string, raw: unknown): Promise<void> {
    const p = this.parts.player(sessionId);
    const msg = VelitaPlace.safeParse(raw);
    if (!p || !msg.success) return;
    const say = (code: VelitasNotice["code"]) => this.parts.send(sessionId, VELITAS_MSG.notice, { code } satisfies VelitasNotice);
    if (!this.open()) return say("cerrado");
    const now = this.parts.now();
    if (now - (this.lastPlace.get(p.userId) ?? -Infinity) < VELITAS.pausaMs) return;
    const { x, y } = msg.data;
    if (p.area !== VELITAS.area) return say("lejos");
    const map = this.parts.mapOf(p.area);
    if (!velitaInReach(map, p.x, p.y, x, y)) return say("lejos");
    const st = this.parts.state();
    const key = `${x},${y}`;
    if (st.placed.has(key)) return say("ocupado");
    if (velitaBlock(map, x, y)) return say("bloqueado");
    if (this.placedBy(p.userId) >= VELITAS.porPersona) return say("tope");
    if (st.placed.size >= VELITAS.total) return say("lleno");
    if (this.parts.held.count(p.userId, VELITA_ITEM) < 1) return say("sinVelitas");
    // Se aparta el tile ya (dos clics seguidos no ponen dos en el mismo) y se gasta la velita después.
    this.lastPlace.set(p.userId, now);
    const v = new VelitaState();
    v.x = x;
    v.y = y;
    v.by = p.userId;
    st.placed.set(key, v);
    st.lit = st.placed.size;
    const taken = await this.parts.held.take(p.userId, VELITA_ITEM, 1).catch(() => false);
    if (!taken) {
      // No se pudo gastar (la mochila cambió por fuera): se apaga.
      if (st.placed.get(key) === v) st.placed.delete(key);
      st.lit = st.placed.size;
      return say("sinVelitas");
    }
    const meta = metaAlcanzada(st.lit);
    if (meta && !this.metas.has(meta)) {
      this.metas.add(meta);
      this.parts.broadcast(FESTIVAL_MSG.cine, { id: VELITAS_CINE.meta(meta) } satisfies FestivalCineEvent);
    }
  }

  /** Soltar el farol de deseos desde el muelle: el farol en la mano, un deseo limpio, uno por persona. */
  async wish(sessionId: string, raw: unknown): Promise<void> {
    const p = this.parts.player(sessionId);
    const msg = DeseoMessage.safeParse(raw);
    if (!p || !msg.success) return;
    const say = (code: VelitasNotice["code"]) => this.parts.send(sessionId, VELITAS_MSG.notice, { code } satisfies VelitasNotice);
    if (!this.open()) return say("cerrado");
    const st = this.parts.state();
    if (st.wishes.has(p.userId)) return say("yaDeseo");
    if (this.parts.held.hand(p.userId)?.id !== FAROL_DESEOS) return say("sinFarol");
    if (p.area !== VELITAS.area || !onWishDock(this.parts.mapOf(p.area), p.x, p.y)) return say("muelle");
    const clean = cleanDeseo(msg.data.text);
    if (!clean.ok) return say(clean.error);
    // Se anota antes de gastar el farol: dos envíos seguidos no sueltan dos.
    const w = new DeseoState();
    w.name = p.name;
    w.text = clean.text;
    st.wishes.set(p.userId, w);
    const taken = await this.parts.held.take(p.userId, FAROL_ITEM, 1).catch(() => false);
    if (!taken) {
      if (st.wishes.get(p.userId) === w) st.wishes.delete(p.userId);
      return say("sinFarol");
    }
    say("soltado");
    this.parts.broadcast(VELITAS_MSG.farol, { sessionId, name: p.name, text: clean.text, x: p.x, y: p.y } satisfies FarolEvent);
  }

  private notice(userId: string, n: VelitasNotice) {
    for (const [sessionId, p] of this.parts.players()) if (p.userId === userId) this.parts.send(sessionId, VELITAS_MSG.notice, n);
  }
}

/** Engancha los mensajes de la Noche de velitas en la sala (una línea en OfficeRoom). */
export function registerVelitas(room: Room, parts: VelitasParts, markActive: (client: { sessionId: string }) => void): Velitas {
  const velitas = new Velitas(parts);
  room.onMessage(VELITAS_MSG.place, (client, raw) => {
    markActive(client);
    void velitas.place(client.sessionId, raw);
  });
  room.onMessage(VELITAS_MSG.wish, (client, raw) => {
    markActive(client);
    void velitas.wish(client.sessionId, raw);
  });
  return velitas;
}
