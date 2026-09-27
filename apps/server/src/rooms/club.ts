// El club del sótano: la cabina de DJ (qué suena y desde cuándo), el baile en la pista y el tubo. Todo
// queda en `OfficeState.club`, así lo ven igual todos; cada cliente genera la música y dibuja los pasos.
import { nearPointOfType, zoneAt, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import {
  CLUB,
  ClubDanceMessage,
  ClubDjMessage,
  ClubPoleMessage,
  clubTrack,
  isPlaying,
  loopMs,
  poleKey,
  type ClubError,
} from "@hyvento/shared";
import { ClubDancer, type ClubState } from "../state";
import { canUse } from "./usables";

/** Quien usa el club: su sesión, su nivel y dónde tiene los pies. */
export interface ClubWho {
  sessionId: string;
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
  seated: boolean;
}

export type ClubOutcome = { ok: true } | { ok: false; error: ClubError };

const fail = (error: ClubError): ClubOutcome => ({ ok: false, error });
const OK: ClubOutcome = { ok: true };

/**
 * ¿Están los pies sobre la pista de baile del club? Una pista que un admin ponga en otro lado (el editor
 * de la casa la deja mover) no cuenta: la música solo suena en el club.
 */
export function onDanceFloor(map: OfficeMap, x: number, y: number): boolean {
  const ts = map.tileSize;
  if (map.id !== CLUB.area || zoneAt(map, x, y)?.id !== CLUB.zone) return false;
  return map.furniture.some((f) => f.type === "dance-floor" && x >= f.x * ts && x < (f.x + f.w) * ts && y >= f.y * ts && y < (f.y + f.d) * ts);
}

/** El tubo al alcance de (x, y) sobre la tarima, o undefined. */
export function poleNear(map: OfficeMap, x: number, y: number): PlacedFurniture | undefined {
  if (!nearPointOfType(map, "pole_stage", x, y)) return undefined;
  const ts = map.tileSize;
  return map.furniture.find(
    (f) => f.type === "dance-pole" && Math.hypot((f.x + f.w / 2) * ts - x, (f.y + f.d / 2) * ts - y) <= CLUB.poleReachPx,
  );
}

export class Club {
  /** Dónde empezó a bailar cada sesión: si se aleja, deja de bailar. */
  private anchors = new Map<string, { area: string; x: number; y: number }>();
  /** Cuándo puede volver a usar la cabina o cambiar de paso cada persona. */
  private djAt = new Map<string, number>();
  private danceAt = new Map<string, number>();

  constructor(private readonly state: ClubState) {}

  /** La consola de la cabina: poner una pista, pausar, seguir o parar. Hay que estar junto a la cabina. */
  dj(map: OfficeMap, who: ClubWho, raw: unknown, now: number): ClubOutcome {
    const parsed = ClubDjMessage.safeParse(raw);
    if (!parsed.success) return fail("invalid");
    const booth = map.furniture.find((f) => f.type === "dj-booth" && canUse(map, f, who.x, who.y));
    if (!booth) return fail("far");
    if (now < (this.djAt.get(who.userId) ?? 0)) return fail("busy");
    this.djAt.set(who.userId, now + CLUB.djCooldownMs);
    const s = this.state;
    const msg = parsed.data;
    switch (msg.action) {
      case "play":
        s.track = msg.track;
        s.startedAt = now;
        s.paused = false;
        s.pausedAt = 0;
        s.dj = who.name;
        return OK;
      case "pause": {
        const t = clubTrack(s.track);
        if (!t || s.paused) return OK;
        // Se guarda el punto dentro del loop: al seguir, arranca desde ahí.
        s.pausedAt = (now - s.startedAt) % loopMs(t);
        s.paused = true;
        this.stopFloor();
        return OK;
      }
      case "resume":
        if (!s.track || !s.paused) return OK;
        s.startedAt = now - s.pausedAt;
        s.paused = false;
        s.pausedAt = 0;
        return OK;
      case "stop":
        s.track = "";
        s.paused = false;
        s.pausedAt = 0;
        s.startedAt = 0;
        s.dj = "";
        this.stopFloor();
        return OK;
    }
  }

  /** Bailar en la pista con un paso (o dejar de bailar con `null`): parado sobre la pista y con música. */
  dance(map: OfficeMap, who: ClubWho, raw: unknown, now: number): ClubOutcome {
    const parsed = ClubDanceMessage.safeParse(raw);
    if (!parsed.success) return fail("invalid");
    const current = this.state.dancers.get(who.sessionId);
    if (parsed.data.move === null) {
      if (current?.kind === "floor") this.remove(who.sessionId);
      return OK;
    }
    if (who.seated) return fail("seated");
    if (!onDanceFloor(map, who.x, who.y)) return fail("far");
    if (!isPlaying(this.state)) return fail("silence");
    if (now < (this.danceAt.get(who.userId) ?? 0)) return fail("busy");
    this.danceAt.set(who.userId, now + CLUB.danceCooldownMs);
    const d = current ?? new ClubDancer();
    d.kind = "floor";
    d.move = parsed.data.move;
    if (!current || current.kind !== "floor") d.since = now;
    if (!current) this.state.dancers.set(who.sessionId, d);
    this.anchors.set(who.sessionId, { area: who.area, x: who.x, y: who.y });
    return OK;
  }

  /** Engancharse al tubo (o soltarlo): una persona por tubo, parada en la tarima junto a él. */
  pole(map: OfficeMap, who: ClubWho, raw: unknown, now: number): ClubOutcome {
    const parsed = ClubPoleMessage.safeParse(raw);
    if (!parsed.success) return fail("invalid");
    const current = this.state.dancers.get(who.sessionId);
    if (!parsed.data.on) {
      if (current?.kind === "pole") this.remove(who.sessionId);
      return OK;
    }
    if (who.seated) return fail("seated");
    const pole = poleNear(map, who.x, who.y);
    if (!pole) return fail("far");
    const key = poleKey(pole.x, pole.y);
    if (current?.kind === "pole" && current.move === key) return OK;
    for (const [id, d] of this.state.dancers) if (id !== who.sessionId && d.kind === "pole" && d.move === key) return fail("taken");
    if (now < (this.danceAt.get(who.userId) ?? 0)) return fail("busy");
    this.danceAt.set(who.userId, now + CLUB.danceCooldownMs);
    const d = current ?? new ClubDancer();
    d.kind = "pole";
    d.move = key;
    d.since = now;
    if (!current) this.state.dancers.set(who.sessionId, d);
    this.anchors.set(who.sessionId, { area: who.area, x: who.x, y: who.y });
    return OK;
  }

  /** Se movió (o se sentó, o cambió de nivel): si se alejó de donde empezó a bailar, deja de bailar. */
  moved(who: Pick<ClubWho, "sessionId" | "area" | "x" | "y" | "seated">) {
    const a = this.anchors.get(who.sessionId);
    if (!a) return;
    if (who.seated || a.area !== who.area || Math.hypot(who.x - a.x, who.y - a.y) > CLUB.leavePx) this.remove(who.sessionId);
  }

  /** Revisa a todos los que bailan (los que se fueron de la sala, cambiaron de nivel o se alejaron). */
  sweep(players: { get(sessionId: string): Omit<ClubWho, "sessionId" | "userId" | "name"> | undefined }) {
    for (const id of [...this.state.dancers.keys()]) {
      const p = players.get(id);
      if (!p) this.remove(id);
      else this.moved({ sessionId: id, ...p });
    }
  }

  forget(sessionId: string) {
    this.remove(sessionId);
  }

  private remove(sessionId: string) {
    this.state.dancers.delete(sessionId);
    this.anchors.delete(sessionId);
  }

  /** Paró la música: en la pista se deja de bailar (el tubo sigue, no necesita música). */
  private stopFloor() {
    for (const [id, d] of [...this.state.dancers]) if (d.kind === "floor") this.remove(id);
  }
}
