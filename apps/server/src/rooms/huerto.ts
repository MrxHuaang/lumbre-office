// Jardín vivo en el servidor: el huerto compartido (sembrar, regar, cosechar), el cobertizo, llenar la
// regadera y la miel de las colmenas. El alcance a cada mueble ya lo validó FurnitureUses (`canUse`);
// aquí van las reglas de cada cosa. Las parcelas sembradas viven en `OfficeState.garden` (las ven todos)
// y se guardan en la tabla GardenPlot. Este módulo no conoce Colyseus: la sala le da el estado, la mano,
// los puntos y el reloj, y manda los avisos y eventos que devuelve.
import { nearPointOfType, pointsOfType, type OfficeMap } from "@hyvento/map";
import {
  EMPTY_CAN,
  HONEY,
  HUERTO,
  ShedTakeMessage,
  WATERING_CAN,
  canHarvest,
  canWater,
  cropById,
  cropOfSeeds,
  GREENHOUSE_PLOT_BASE,
  isGreenhousePlot,
  isFreeHold,
  plantPlot,
  plotReadyAt,
  plotReady,
  waterPlot,
  type FurnitureEvent,
  type HuertoNotice,
  type PlotState,
} from "@hyvento/shared";
import type { GameRepository, GardenPlotRecord } from "../repo/types";

/** Las parcelas sembradas: un MapSchema<GardenPlotState> en la sala, un Map en los tests. */
export interface GardenPlots<T extends PlotState> {
  get(key: string): T | undefined;
  set(key: string, plot: T): unknown;
  delete(key: string): unknown;
  values(): IterableIterator<T>;
  clear(): void;
}

export interface HuertoDeps<T extends PlotState> {
  plots: GardenPlots<T>;
  /** Una parcela nueva para el estado (GardenPlotState). */
  create(): T;
  repo(): Pick<GameRepository, "loadGarden" | "saveGardenPlot">;
  /** Lo que lleva en la mano (HeldItems): mirar, dar y gastar un uso de una herramienta. */
  held: {
    get(userId: string): { item: string; left: readonly number[] } | undefined;
    give(userId: string, item: string): void;
    /** Gasta un uso de la herramienta; `done` = se acabó (la bolsa vacía se va de la mano). */
    spend(userId: string, now: number): { done: boolean } | null;
  };
  /** Premio de ocio (LEISURE, con el tope diario): devuelve lo sumado. */
  award(userId: string, amount: number): Promise<number>;
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
    for (const r of rows) {
      if (!cropById(r.crop)) continue;
      this.deps.plots.set(String(r.id), this.toState(r));
    }
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
    if (e.action === "honey") return this.honey(who, base, now);
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
      this.set(id, plantPlot(crop.id, who, now));
      return event("plant", crop.id);
    }

    if (plotReady(plot, now)) {
      if (!canHarvest(plot, who.userId, now))
        return { ok: false, notice: { code: "notYours", name: plot.plantedByName, waitMs: plotReadyAt(plot) + HUERTO.ownerHarvestMs - now } };
      // Lo cosechado va a la mano: no pisa lo que se pagó con puntos.
      if (held && !isFreeHold(held.item)) return { ok: false, notice: { code: "hands" } };
      const crop = cropById(plot.crop)!;
      this.set(id, null);
      this.deps.held.give(who.userId, crop.product);
      // Los puntos llegan aparte (el "+N" lo manda la sala al sumarlos).
      await this.deps.award(who.userId, crop.points);
      return event("harvest", crop.product);
    }

    if ((held?.item === WATERING_CAN || held?.item === EMPTY_CAN) && cropById(plot.crop)?.indoor) return { ok: false, notice: { code: "noWater" } };
    if (held?.item === WATERING_CAN) {
      if (!canWater(plot, now)) return { ok: false, notice: { code: "wet" } };
      const spent = this.deps.held.spend(who.userId, now);
      if (!spent) return null;
      // Con el último riego queda la regadera vacía en la mano (para volver a llenarla).
      if (spent.done) this.deps.held.give(who.userId, EMPTY_CAN);
      this.set(id, waterPlot(plot, now));
      return event("water", plot.crop);
    }
    if (held?.item === EMPTY_CAN) return { ok: false, notice: { code: "emptyCan" } };
    return { ok: false, notice: { code: "growing", crop: plot.crop, waitMs: plotReadyAt(plot) - now } };
  }

  /** Llenar la regadera en un barril de agua o en el pozo. */
  private fill(who: HuertoWho, base: { type: string; x: number; y: number; seed: number }): HuertoResult {
    const held = this.deps.held.get(who.userId);
    if (held?.item !== WATERING_CAN && held?.item !== EMPTY_CAN) return { ok: false, notice: { code: "noCan" } };
    this.deps.held.give(who.userId, WATERING_CAN);
    return { ok: true, event: { ...base, action: "fill", item: WATERING_CAN } };
  }

  /** Miel: una vez cada tanto por persona, a la mano (si no lleva algo pagado). */
  private honey(who: HuertoWho, base: { type: string; x: number; y: number; seed: number }, now: number): HuertoResult {
    const next = this.honeyAt.get(who.userId) ?? 0;
    if (now < next) return { ok: false, notice: { code: "honeyWait", waitMs: next - now } };
    const held = this.deps.held.get(who.userId);
    if (held && !isFreeHold(held.item)) return { ok: false, notice: { code: "hands" } };
    this.honeyAt.set(who.userId, now + HUERTO.honeyCooldownMs);
    this.deps.held.give(who.userId, HONEY);
    return { ok: true, event: { ...base, action: "honey", item: HONEY } };
  }

  /** Sacar algo del cobertizo: hay que estar junto a él y no llevar algo pagado en la mano. */
  shed(map: OfficeMap, who: HuertoWho, raw: unknown): { ok: true; item: string } | { ok: false; notice: HuertoNotice } | null {
    const parsed = ShedTakeMessage.safeParse(raw);
    if (!parsed.success) return null;
    if (!nearPointOfType(map, "tool_shed", who.x, who.y)) return { ok: false, notice: { code: "far" } };
    const held = this.deps.held.get(who.userId);
    if (held && !isFreeHold(held.item)) return { ok: false, notice: { code: "hands" } };
    this.deps.held.give(who.userId, parsed.data.item);
    return { ok: true, item: parsed.data.item };
  }

  /** Pone o quita una parcela del estado y la guarda. */
  private set(id: number, plot: PlotState | null) {
    const key = String(id);
    if (plot) this.deps.plots.set(key, this.toState({ id, ...plot }));
    else this.deps.plots.delete(key);
    const record = plot && { ...plot };
    this.saving = this.saving
      .then(() => this.deps.repo().saveGardenPlot(id, record))
      .catch((err) => console.error("saveGardenPlot", err));
  }

  /** Espera a que se guarde todo (tests). */
  flush() {
    return this.saving;
  }

  private toState(r: GardenPlotRecord): T {
    const s = this.deps.create();
    s.crop = r.crop;
    s.plantedBy = r.plantedBy;
    s.plantedByName = r.plantedByName;
    s.plantedAt = r.plantedAt;
    s.growthMs = r.growthMs;
    s.growthAt = r.growthAt;
    s.wateredUntil = r.wateredUntil;
    return s;
  }
}
