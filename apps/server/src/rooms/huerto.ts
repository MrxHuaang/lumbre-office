// Jardín vivo en el servidor: el huerto compartido (sembrar, regar, cosechar), el cobertizo, llenar la
// regadera y la miel de las colmenas. El alcance a cada mueble ya lo validó FurnitureUses (`canUse`);
// aquí van las reglas de cada cosa. Las parcelas sembradas viven en `OfficeState.garden` (las ven todos)
// y se guardan en la tabla GardenPlot. Este módulo no conoce Colyseus: la sala le da el estado, la mano,
// los puntos y el reloj, y manda los avisos y eventos que devuelve. Las semillas y la regadera se eligen
// en la barra (la mochila); lo cosechado, la miel y lo del cobertizo van a la mochila.
import { nearPointOfType, pointsOfType, type OfficeMap } from "@hyvento/map";
import {
  EMPTY_CAN,
  HONEY,
  objItemId,
  HUERTO,
  ShedTakeMessage,
  WATERING_CAN,
  canHarvest,
  canWater,
  cropById,
  cropOfSeeds,
  GREENHOUSE_PLOT_BASE,
  isGreenhousePlot,
  plantPlot,
  plotReadyAt,
  plotReady,
  plotUnderRoof,
  reseasonPlot,
  waterPlot,
  type FurnitureEvent,
  type HuertoNotice,
  type PlotState,
  type Season,
} from "@hyvento/shared";
import type { GameRepository, GardenPlotRecord } from "../repo/types";

/** Las parcelas sembradas: un MapSchema<GardenPlotState> en la sala, un Map en los tests. */
export interface GardenPlots<T extends PlotState> {
  get(key: string): T | undefined;
  set(key: string, plot: T): unknown;
  delete(key: string): unknown;
  values(): IterableIterator<T>;
  keys(): IterableIterator<string>;
  clear(): void;
}

export interface HuertoDeps<T extends PlotState> {
  plots: GardenPlots<T>;
  /** Una parcela nueva para el estado (GardenPlotState). */
  create(): T;
  repo(): Pick<GameRepository, "loadGarden" | "saveGardenPlot">;
  /** Lo que lleva en la mano (la casilla elegida de la mochila): mirar, gastar un uso de la herramienta y llenar la regadera. */
  held: {
    get(userId: string): { item: string; left: readonly number[] } | undefined;
    /** Gasta un uso de la herramienta; `done` = se acabó (la bolsa de semillas sale de la mochila; la regadera queda vacía). */
    spend(userId: string, now: number): { done: boolean } | null;
    /** Llena la regadera de la mano. */
    fill(userId: string): boolean;
  };
  /** La mochila: si cabe algo y sumarlo (queda en la mano si estaban libres). */
  bag: {
    fits(userId: string, itemId: string): "ok" | "full" | "stack";
    add(userId: string, itemId: string): Promise<unknown>;
  };
  /** Premio de ocio (LEISURE, con el tope diario): devuelve lo sumado. */
  award(userId: string, amount: number): Promise<number>;
  /** La estación del calendario del juego (sin ella las parcelas crecen a ritmo 1). */
  season?(): Season;
}

export interface HuertoWho {
  userId: string;
  name: string;
  x: number;
  y: number;
}

/** Lo que pasó: un evento para los del nivel, un aviso para quien lo intentó, o nada (se ignora). */
export type HuertoResult = { ok: true; event: Omit<FurnitureEvent, "sessionId"> } | { ok: false; notice: HuertoNotice } | null;

const ACTIONS = new Set(["plot", "fill", "honey"]);
/** ¿Es algo del huerto (lo resuelve este módulo en vez de la sala)? */
export const isHuertoAction = (action: string) => ACTIONS.has(action);

export class Huerto<T extends PlotState> {
  /** Cuándo puede volver a sacar miel cada persona. */
  private honeyAt = new Map<string, number>();
  /** Los guardados van de a uno (el de una parcela no se adelanta al anterior). */
  private saving: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: HuertoDeps<T>) {}

  /** Al abrir la sala: las parcelas sembradas que quedaron guardadas. */
  async load() {
    const rows = await this.deps.repo().loadGarden();
    this.deps.plots.clear();
    // La estación no se guarda: es la de ahora, que es la del tramo porque el reloj del juego no corre
    // con la sala cerrada.
    const season = this.deps.season?.() ?? "";
    for (const r of rows) {
      if (!cropById(r.crop)) continue;
      this.deps.plots.set(String(r.id), this.toState({ ...r, season }));
    }
  }

  /**
   * Cambió la estación del juego: cada parcela que crece guarda lo de la estación anterior y sigue con la
   * nueva (ver `reseasonPlot`). Devuelve cuántas cambió.
   */
  reseason(now: number): number {
    const season = this.deps.season?.();
    if (!season) return 0;
    let n = 0;
    for (const key of [...this.deps.plots.keys()]) {
      const p = this.deps.plots.get(key);
      const next = p && reseasonPlot(p, now, season);
      if (!next) continue;
      this.set(Number(key), next);
      n++;
    }
    return n;
  }

  /**
   * La parcela de ese tipo con esquina en (x, y): una del huerto es el índice de su punto `garden_plot`;
   * un bancal del invernadero, GREENHOUSE_PLOT_BASE + el de su punto `greenhouse_plot` (-1 si no hay).
   */
  static plotIndex(map: OfficeMap, type: string, x: number, y: number): number {
    const bed = type === "greenhouse-bed";
    const i = pointsOfType(map, bed ? "greenhouse_plot" : "garden_plot").findIndex((p) => p.tileX === x && p.tileY === y);
    return i < 0 ? -1 : bed ? GREENHOUSE_PLOT_BASE + i : i;
  }

  /** ¿Están los pies en (px, py) dentro de algún invernadero del nivel? */
  static insideGreenhouse(map: OfficeMap, px: number, py: number): boolean {
    const ts = map.tileSize;
    return map.furniture.some((f) => f.type === "greenhouse" && px >= f.x * ts && px < (f.x + f.w) * ts && py >= f.y * ts && py < (f.y + f.d) * ts);
  }

  /** Estado de una parcela (o undefined si está vacía). */
  plot(id: number): T | undefined {
    return this.deps.plots.get(String(id));
  }

  /** Un uso válido (al alcance) de una parcela, un barril o el pozo, o una colmena. */
  async use(map: OfficeMap, who: HuertoWho, e: { type: string; x: number; y: number; action: string; seed: number }, now: number): Promise<HuertoResult> {
    const base = { type: e.type, x: e.x, y: e.y, seed: e.seed };
    if (e.action === "fill") return this.fill(who, base);
    if (e.action === "honey") return await this.honey(who, base, now);
    if (e.action !== "plot") return null;
    const id = Huerto.plotIndex(map, e.type, e.x, e.y);
    if (id < 0) return null;
    // A los bancales se llega desde adentro: a través del vidrio no se siembra ni se cosecha.
    if (isGreenhousePlot(id) && !Huerto.insideGreenhouse(map, who.x, who.y)) return { ok: false, notice: { code: "inside" } };
    const held = this.deps.held.get(who.userId);
    const plot = this.plot(id);
    const event = (garden: "plant" | "water" | "harvest", item: string): HuertoResult => ({ ok: true, event: { ...base, action: "plot", garden, item } });

    if (!plot) {
      const crop = held ? cropOfSeeds(held.item) : undefined;
      if (!crop) return { ok: false, notice: { code: "seeds" } };
      // Lo de tierra caliente va en los bancales del invernadero, y lo del huerto, afuera.
      if (crop.indoor && !isGreenhousePlot(id)) return { ok: false, notice: { code: "indoor", crop: crop.id } };
      if (!crop.indoor && isGreenhousePlot(id)) return { ok: false, notice: { code: "outdoor", crop: crop.id } };
      const mine = [...this.deps.plots.values()].filter((p) => p.plantedBy === who.userId).length;
      if (mine >= HUERTO.maxPlotsPerPerson) return { ok: false, notice: { code: "tooMany" } };
      if (!this.deps.held.spend(who.userId, now)) return null;
      this.set(id, plantPlot(crop.id, who, now, this.deps.season?.()));
      return event("plant", crop.id);
    }

    if (plotReady(plot, now)) {
      if (!canHarvest(plot, who.userId, now))
        return { ok: false, notice: { code: "notYours", name: plot.plantedByName, waitMs: plotReadyAt(plot) + HUERTO.ownerHarvestMs - now } };
      // Lo cosechado va a la mochila (si cabe: si no, la mata espera).
      const crop = cropById(plot.crop)!;
      if (this.deps.bag.fits(who.userId, objItemId(crop.product)) !== "ok") return { ok: false, notice: { code: "full" } };
      this.set(id, null);
      await this.deps.bag.add(who.userId, objItemId(crop.product));
      // Los puntos llegan aparte (el "+N" lo manda la sala al sumarlos).
      await this.deps.award(who.userId, crop.points);
      return event("harvest", crop.product);
    }

    if ((held?.item === WATERING_CAN || held?.item === EMPTY_CAN) && cropById(plot.crop)?.indoor) return { ok: false, notice: { code: "noWater" } };
    if (held?.item === WATERING_CAN) {
      if (!canWater(plot, now)) return { ok: false, notice: { code: "wet" } };
      const spent = this.deps.held.spend(who.userId, now);
      // Con el último riego queda la regadera vacía en la mano (para volver a llenarla).
      if (!spent) return null;
      this.set(id, waterPlot(plot, now, this.deps.season?.()));
      return event("water", plot.crop);
    }
    if (held?.item === EMPTY_CAN) return { ok: false, notice: { code: "emptyCan" } };
    return { ok: false, notice: { code: "growing", crop: plot.crop, waitMs: plotReadyAt(plot) - now } };
  }

  /** Llenar la regadera en un barril de agua o en el pozo. */
  private fill(who: HuertoWho, base: { type: string; x: number; y: number; seed: number }): HuertoResult {
    const held = this.deps.held.get(who.userId);
    if (held?.item !== WATERING_CAN && held?.item !== EMPTY_CAN) return { ok: false, notice: { code: "noCan" } };
    if (!this.deps.held.fill(who.userId)) return null;
    return { ok: true, event: { ...base, action: "fill", item: WATERING_CAN } };
  }

  /** Miel: una vez cada tanto por persona, a la mochila (si cabe). */
  private async honey(who: HuertoWho, base: { type: string; x: number; y: number; seed: number }, now: number): Promise<HuertoResult> {
    const next = this.honeyAt.get(who.userId) ?? 0;
    if (now < next) return { ok: false, notice: { code: "honeyWait", waitMs: next - now } };
    if (this.deps.bag.fits(who.userId, objItemId(HONEY)) !== "ok") return { ok: false, notice: { code: "full" } };
    this.honeyAt.set(who.userId, now + HUERTO.honeyCooldownMs);
    await this.deps.bag.add(who.userId, objItemId(HONEY));
    return { ok: true, event: { ...base, action: "honey", item: HONEY } };
  }

  /**
   * Sacar algo del cobertizo (hay que estar junto a él): la regadera (vacía; una por persona) o una bolsa
   * de semillas, a la mochila.
   */
  async shed(map: OfficeMap, who: HuertoWho, raw: unknown): Promise<{ ok: true; item: string } | { ok: false; notice: HuertoNotice } | null> {
    const parsed = ShedTakeMessage.safeParse(raw);
    if (!parsed.success) return null;
    if (!nearPointOfType(map, "tool_shed", who.x, who.y)) return { ok: false, notice: { code: "far" } };
    // La regadera del cobertizo es la misma regadera (sale sin agua).
    const can = parsed.data.item === EMPTY_CAN || parsed.data.item === WATERING_CAN;
    const item = objItemId(can ? WATERING_CAN : parsed.data.item);
    const fits = this.deps.bag.fits(who.userId, item);
    if (fits !== "ok") return { ok: false, notice: { code: can && fits === "stack" ? "haveCan" : "full" } };
    await this.deps.bag.add(who.userId, item);
    return { ok: true, item: parsed.data.item };
  }

  /**
   * Llueve: se riegan solas las parcelas que lo necesitan (las de afuera; el invernadero tiene techo).
   * Solo recorre las parcelas del huerto (ids 0.., según los puntos `garden_plot` del jardín): los bancales
   * (ids desde GREENHOUSE_PLOT_BASE) nunca se mojan, y por si acaso tampoco lo que está bajo techo. Devuelve
   * cuántas regó.
   */
  rain(map: OfficeMap, now: number): number {
    let n = 0;
    const count = pointsOfType(map, "garden_plot").length;
    for (let id = 0; id < count; id++) {
      const p = this.plot(id);
      if (!p || isGreenhousePlot(id) || plotUnderRoof(p) || !canWater(p, now)) continue;
      this.set(id, waterPlot(p, now, this.deps.season?.()));
      n++;
    }
    return n;
  }

  /** Pone o quita una parcela del estado y la guarda. */
  private set(id: number, plot: PlotState | null) {
    const key = String(id);
    if (plot) this.deps.plots.set(key, this.toState({ id, ...plot }));
    else this.deps.plots.delete(key);
    // La estación no va a la base (la tabla no la tiene).
    let record: Omit<PlotState, "season"> | null = null;
    if (plot) {
      const { season: _season, ...rest } = plot;
      record = rest;
    }
    this.saving = this.saving
      .then(() => this.deps.repo().saveGardenPlot(id, record))
      .catch((err) => console.error("saveGardenPlot", err));
  }

  /** Espera a que se guarde todo (tests). */
  flush() {
    return this.saving;
  }

  private toState(r: GardenPlotRecord & { season?: Season | "" }): T {
    const s = this.deps.create();
    s.crop = r.crop;
    s.plantedBy = r.plantedBy;
    s.plantedByName = r.plantedByName;
    s.plantedAt = r.plantedAt;
    s.growthMs = r.growthMs;
    s.growthAt = r.growthAt;
    s.wateredUntil = r.wateredUntil;
    s.season = r.season ?? "";
    return s;
  }
}
