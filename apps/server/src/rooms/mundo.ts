// Mundo lleno: lo que pasa después de usar uno de los muebles que antes eran de adorno (ver mundo.ts de
// @hyvento/shared). FurnitureUses ya validó el alcance y la pausa; aquí van las reglas de cada uno: la
// impresora saca tu última nota como una hoja para la mochila, la ducha te seca, la casita del perro hace
// descansar a tu mascota, y el reloj de sol, las barandas y los paneles (tragamonedas, garra, telescopios,
// pizarra) solo avisan a los del nivel para que cada navegador haga lo suyo. Este módulo no conoce Colyseus.
import { usablesOf, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import {
  MSG,
  MUNDO,
  MUNDO_MSG,
  objItemId,
  PRINTED_SHEET,
  STAT_KEYS,
  type FurnitureEvent,
  type MundoNotice,
} from "@hyvento/shared";
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
    this.broadcast(p.area, sessionId, e);
    this.showers.get(p.userId)?.clear();
    this.showers.set(
      p.userId,
      this.deps.later(MUNDO.showerMs, () => {
        this.showers.delete(p.userId);
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
