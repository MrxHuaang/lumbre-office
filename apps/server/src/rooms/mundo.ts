// Mundo lleno: lo que pasa después de usar uno de los muebles que antes eran de adorno (ver mundo.ts de
// @hyvento/shared). FurnitureUses ya validó el alcance y la pausa; aquí van las reglas de cada uno: la
// impresora saca tu última nota como una hoja para la mochila, la ducha te seca, la casita del perro hace
// descansar a tu mascota, y el reloj de sol, las barandas y los paneles (tragamonedas, garra, telescopios,
// pizarra) solo avisan a los del nivel para que cada navegador haga lo suyo. Este módulo no conoce Colyseus.
import { usablesOf, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import {
  FORTUNE_MSG,
  GARRA_MSG,
  MSG,
  MUNDO,
  MUNDO_MSG,
  objItemId,
  PRINTED_SHEET,
  SLOTS_MSG,
  STAT_KEYS,
  type CasinoSettingsDTO,
  type FurnitureEvent,
  type MundoNotice,
} from "@hyvento/shared";
import type { Client } from "colyseus";
import { randomInt, randomUUID } from "node:crypto";
import type { GameRepository } from "../repo/types";
import type { Bag } from "./bag";
import type { AchievementTracker } from "./achievements";
import { SlotMachines } from "./casino/slots";
import type { Drunkenness } from "./drunk";
import { FortuneWheel } from "./fortuna";
import { ClawMachines } from "./garra";
import type { Pets } from "./mascotas";
import type { Piscina } from "./piscina";
import { canUse } from "./usables";

export interface MundoPlayer {
  userId: string;
  area: string;
  x: number;
  y: number;
}

export interface MundoDeps {
  now(): number;
  player(sessionId: string): MundoPlayer | undefined;
  map(area: string): OfficeMap;
  toArea(area: string, type: string, message: unknown): void;
  toSession(sessionId: string, type: string, message: unknown): void;
  later(ms: number, fn: () => void): { clear(): void };
  /** El título de la nota más reciente de esa persona (null si no tiene). */
  noteTitle(userId: string): Promise<string | null>;
  bag: {
    fits(userId: string, items: readonly (readonly [string, number])[]): "ok" | "full" | "stack";
    add(userId: string, itemId: string, quantity: number, opts?: { pick?: boolean }): Promise<"ok" | "full" | "stack">;
  };
  /** Deja de estar mojado (devuelve si lo estaba). */
  dry(userId: string): boolean;
  /** Que su mascota descanse en la casita (ver `Pets.restAt`). */
  restPet(userId: string, house: PlacedFurniture & { area: string }, now: number): { ok: true; name: string; gained: boolean } | { ok: false; error: "noPet" | "far" };
  bump(userId: string, key: string, by?: number): void;
}

/** ¿Hay un mueble de ese tipo al alcance de (x, y), del mismo lado de la pared? (lo que valida cada panel). */
export function nearUsable(map: OfficeMap, types: string | readonly string[], x: number, y: number): PlacedFurniture | undefined {
  const list = typeof types === "string" ? [types] : types;
  return usablesOf(map).find((f) => list.includes(f.type) && canUse(map, f, x, y));
}

export class MundoVivo {
  /** Hasta cuándo espera cada persona para volver a imprimir. */
  private printAt = new Map<string, number>();
  private showers = new Map<string, { clear(): void }>();

  constructor(private readonly deps: MundoDeps) {}

  private notice(sessionId: string, n: MundoNotice) {
    this.deps.toSession(sessionId, MUNDO_MSG.notice, n);
  }

  private broadcast(area: string, sessionId: string, e: Omit<FurnitureEvent, "sessionId">) {
    this.deps.toArea(area, MSG.furnitureEvent, { sessionId, ...e } satisfies FurnitureEvent);
  }

  /** Después de un uso válido (alcance y pausa ya revisados por FurnitureUses). */
  async use(sessionId: string, e: Omit<FurnitureEvent, "sessionId">): Promise<void> {
    const p = this.deps.player(sessionId);
    if (!p) return;
    if (e.action === "print") return this.print(sessionId, p, e);
    if (e.action === "shower") return this.shower(sessionId, p, e);
    if (e.action === "doghouse") return this.doghouse(sessionId, p, e);
    // El reloj de sol, las barandas y los paneles: cada navegador hace lo suyo (el panel, solo el propio).
    this.broadcast(p.area, sessionId, e);
  }

  /** La impresora: tu nota más reciente sale como una hoja (a la mochila, si cabe). */
  private async print(sessionId: string, p: MundoPlayer, e: Omit<FurnitureEvent, "sessionId">) {
    const now = this.deps.now();
    if (now < (this.printAt.get(p.userId) ?? 0)) return this.notice(sessionId, { code: "printBusy" });
    const sheet = objItemId(PRINTED_SHEET);
    if (this.deps.bag.fits(p.userId, [[sheet, 1]]) !== "ok") return this.notice(sessionId, { code: "full" });
    this.printAt.set(p.userId, now + MUNDO.printCooldownMs);
    const title = await this.deps.noteTitle(p.userId).catch((err) => {
      console.error("latestNoteTitle", err);
      return undefined;
    });
    if (title === undefined) {
      this.printAt.delete(p.userId);
      return;
    }
    if (title === null) {
      this.printAt.delete(p.userId);
      return this.notice(sessionId, { code: "noNote" });
    }
    // El papel sale para todos (el sonido de la impresora); la hoja, a la mochila de quien imprimió.
    this.broadcast(p.area, sessionId, e);
    const added = await this.deps.bag.add(p.userId, sheet, 1);
    if (added !== "ok") return this.notice(sessionId, { code: "full" });
    this.deps.bump(p.userId, STAT_KEYS.notesPrinted);
    this.notice(sessionId, { code: "printed", text: title.slice(0, 60) });
  }

  /** La ducha del jardín: gotas un rato y, al terminar, seco. */
  private shower(sessionId: string, p: MundoPlayer, e: Omit<FurnitureEvent, "sessionId">) {
    const area = p.area;
    const shower = usablesOf(this.deps.map(area)).find((f) => f.type === e.type && f.x === e.x && f.y === e.y);
    if (!shower) return;
    this.broadcast(area, sessionId, e);
    this.showers.get(p.userId)?.clear();
    this.showers.set(
      p.userId,
      this.deps.later(MUNDO.showerMs, () => {
        this.showers.delete(p.userId);
        // Si se fue antes de terminar (o cambió de nivel), no se seca.
        const now = this.deps.player(sessionId);
        if (!now || now.area !== area || !canUse(this.deps.map(area), shower, now.x, now.y)) return;
        this.deps.dry(p.userId);
        this.notice(sessionId, { code: "dry" });
      }),
    );
  }

  /** La casita del perro: tu mascota se echa ahí un rato (y te quiere un poquito más). */
  private doghouse(sessionId: string, p: MundoPlayer, e: Omit<FurnitureEvent, "sessionId">) {
    const map = this.deps.map(p.area);
    const house = map.furniture.find((f) => f.type === e.type && f.x === e.x && f.y === e.y);
    if (!house) return;
    const r = this.deps.restPet(p.userId, { ...house, area: p.area }, this.deps.now());
    if (!r.ok) return this.notice(sessionId, { code: r.error === "noPet" ? "noPet" : "petFar" });
    this.broadcast(p.area, sessionId, e);
    this.deps.bump(p.userId, STAT_KEYS.petCares);
    this.notice(sessionId, { code: r.gained ? "petRest" : "petTired", text: r.name });
  }

  /** Se fue de la sala: se olvida la ducha a medio terminar. */
  forget(userId: string) {
    this.showers.get(userId)?.clear();
    this.showers.delete(userId);
  }
}

// ---------- En la sala ----------

/** El azar y el reloj de lo nuevo del sótano (tragamonedas, garra y rueda) y de la impresora: los tests los fijan. */
export const MUNDO_CLOCK = {
  random: (n: number) => randomInt(n),
  now: () => Date.now(),
};

/**
 * Lo de la sala (OfficeRoom) que usa el mundo lleno. La sala se pasa entera con un solo enganche
 * (`registerMundo(this)`): así su código no crece con cada mueble nuevo.
 */
export interface MundoRoom {
  state: { players: { get(sessionId: string): (MundoPlayer & { points: number; name: string }) | undefined; values(): Iterable<{ userId: string; points: number }> } };
  clients: { getById(sessionId: string): { send(type: string, message: unknown): void } | undefined };
  clock: { setTimeout(fn: () => void, ms: number): { clear(): void } };
  repo: GameRepository;
  casinoSettings: CasinoSettingsDTO;
  held: Bag;
  achievements: AchievementTracker;
  pets: Pets;
  piscina?: Piscina;
  drunk: Drunkenness;
  onMessage(type: string, fn: (client: Client, raw: unknown) => void): unknown;
  mapOf(area: string): OfficeMap;
  sendToArea(area: string, type: string, message: unknown): void;
  casinoSettled(userId: string, staked: number, won: number): void;
  awardLeisure(userId: string, amount: number): Promise<number>;
  markActive(client: Client): void;
  acceptCasino(client: Client): boolean;
}

/** Lo que la sala le pide después: el uso de un mueble nuevo y olvidar a quien se fue. */
export interface MundoHandle {
  use(sessionId: string, e: Omit<FurnitureEvent, "sessionId">): Promise<void>;
  forget(userId: string): void;
}

/** Arma lo del mundo lleno en la sala: la impresora, la ducha y la casita, el tragamonedas, la garra y la rueda. */
export function registerMundo(room: MundoRoom): MundoHandle {
  const setPoints = (userId: string, balance: number) => {
    for (const p of room.state.players.values()) if (p.userId === userId) p.points = balance;
  };
  const bag = { fits: room.held.fits.bind(room.held), add: room.held.add.bind(room.held) };
  const mundo = new MundoVivo({
    now: () => MUNDO_CLOCK.now(),
    player: (sessionId) => room.state.players.get(sessionId),
    map: (area) => room.mapOf(area),
    toArea: (area, type, message) => room.sendToArea(area, type, message),
    toSession: (sessionId, type, message) => room.clients.getById(sessionId)?.send(type, message),
    later: (ms, fn) => room.clock.setTimeout(fn, ms),
    noteTitle: (userId) => room.repo.latestNoteTitle(userId),
    bag,
    dry: (userId) => room.piscina?.dry(userId) ?? false,
    restPet: (userId, house, now) => room.pets.restAt(userId, house, now, { love: MUNDO.doghouseLove, reachTiles: MUNDO.doghouseReachTiles }),
    bump: (userId, key, by) => room.achievements.bump(userId, key, by),
  });
  const slots = new SlotMachines({
    repo: () => room.repo,
    settings: () => room.casinoSettings,
    random: (n) => MUNDO_CLOCK.random(n),
    now: () => MUNDO_CLOCK.now(),
    setPoints,
    settled: (userId, staked, won, jackpot) => {
      room.casinoSettled(userId, staked, won);
      room.achievements.bump(userId, STAT_KEYS.slotSpins);
      if (jackpot) room.achievements.bump(userId, STAT_KEYS.slotJackpots);
    },
  });
  const claw = new ClawMachines({
    repo: () => room.repo,
    now: () => MUNDO_CLOCK.now(),
    random: (n) => MUNDO_CLOCK.random(n),
    token: () => randomUUID(),
    setPoints,
    bag,
    bump: (userId, key) => room.achievements.bump(userId, key),
  });
  const fortune = new FortuneWheel({
    now: () => MUNDO_CLOCK.now(),
    random: (n) => MUNDO_CLOCK.random(n),
    stats: room.achievements,
    award: (userId, amount) => room.awardLeisure(userId, amount),
    give: (userId, id) => room.held.give(userId, id),
  });
  /** ¿Está junto a un mueble de ese tipo (y despierto)? */
  const near = (client: Client, type: string) => {
    const p = room.state.players.get(client.sessionId);
    return Boolean(p && !room.drunk.fainted(p.userId) && nearUsable(room.mapOf(p.area), type, p.x, p.y));
  };
  const who = (client: Client) => {
    room.markActive(client);
    return room.state.players.get(client.sessionId);
  };
  room.onMessage(SLOTS_MSG.spin, async (client, raw) => {
    const p = who(client);
    if (!p || !room.acceptCasino(client)) return;
    const result = await slots.spin(p, raw, near(client, "slot-machine"));
    if (result) client.send(SLOTS_MSG.result, result);
  });
  room.onMessage(GARRA_MSG.start, async (client) => {
    const p = who(client);
    if (p) client.send(GARRA_MSG.event, await claw.start(p.userId, near(client, "claw-machine")));
  });
  room.onMessage(GARRA_MSG.drop, async (client, raw) => {
    const p = who(client);
    const e = p ? await claw.drop(p.userId, raw, near(client, "claw-machine")) : null;
    if (e) client.send(GARRA_MSG.event, e);
  });
  room.onMessage(FORTUNE_MSG.status, (client) => {
    const p = who(client);
    if (p) client.send(FORTUNE_MSG.result, fortune.status(p.userId));
  });
  room.onMessage(FORTUNE_MSG.spin, async (client) => {
    const p = who(client);
    if (p) client.send(FORTUNE_MSG.result, await fortune.spin(p.userId, near(client, "fortune-wheel")));
  });
  return {
    use: (sessionId, e) => mundo.use(sessionId, e),
    forget: (userId) => {
      mundo.forget(userId);
      slots.forget(userId);
      claw.forget(userId);
    },
  };
}
