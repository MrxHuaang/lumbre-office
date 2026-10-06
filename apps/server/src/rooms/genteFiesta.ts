// La gente de la fiesta en la sala (VIR-167, ver gente-fiesta.ts de @hyvento/shared y @hyvento/map): la sala
// no guarda dónde está nadie; con el minuto del juego calcula la pose de cada NPC con la misma función que el
// navegador y así valida la cercanía. Aquí los pedidos de la fiesta (que tenga los objetos, que quepa lo que
// se da, una vez por persona por pedido por festival, marcado en `UserStat` antes de dar) y si alguien está
// junto a un vendedor (para comprar en el puesto del festival desde él). Este módulo no conoce Colyseus.
import { genteDelNivel, type GenteNivel, type OfficeMap } from "@hyvento/map";
import {
  diaDelFestival,
  EntregarMessage,
  fechaDelJuego,
  festivalById,
  GENTE_FIESTA,
  GENTE_REGLAS,
  objItemId,
  pedidoStatKey,
  pedidosDe,
  puntosPedidosKey,
  type EntregarResult,
  type GenteHechos,
  type Weather,
} from "@hyvento/shared";
import type { AchievementTracker } from "./achievements";
import type { Bag } from "./bag";

/** Quien habla o entrega: dónde está (px del nivel). */
export interface GenteWho {
  userId: string;
  area: string;
  x: number;
  y: number;
}

export interface GenteFiestaDeps {
  /** El festival de ahora, su fase, el día y el minuto del juego (con decimales) y el clima. */
  festival(): { id: string; fase: string; day: number; año: number; minuto: number; clima: Weather };
  mapOf(area: string): OfficeMap;
  held: Pick<Bag, "count" | "fits" | "add" | "take">;
  stats: Pick<AchievementTracker, "stat" | "max" | "isLoaded">;
  /** Puntos LEISURE (con su tope diario): devuelve lo sumado. */
  award(userId: string, amount: number): Promise<number>;
  now(): number;
}

export class GenteFiesta {
  private lastAt = new Map<string, number>();

  constructor(private readonly deps: GenteFiestaDeps) {}

  /** La gente de la fiesta de un nivel ahora (null sin festival abierto o sin gente ahí). */
  nivel(area: string): GenteNivel | null {
    const f = this.deps.festival();
    if (!f.id || f.fase !== "fiesta") return null;
    return genteDelNivel(this.deps.mapOf(area), f.id, f.day, f.clima);
  }

  /** ¿Está al alcance de ese NPC de la fiesta? (con la holgura de la red). */
  near(who: GenteWho, npcId: string): boolean {
    const nivel = this.nivel(who.area);
    if (!nivel?.npc(npcId)) return false;
    return nivel.near(npcId, this.deps.festival().minuto, who.x, who.y, GENTE_REGLAS.alcanceTiles + GENTE_REGLAS.holguraTiles);
  }

  /**
   * ¿Está junto a alguien de la fiesta que atiende el puesto del festival? (comprar desde él). Con `puesto`,
   * solo quien atiende ese (el mercado de la cosecha tiene varios).
   */
  nearVendor(who: GenteWho, puesto?: string): boolean {
    const nivel = this.nivel(who.area);
    return Boolean(nivel?.npcs.some((n) => n.accion?.tipo === "puesto" && (puesto === undefined || n.accion.puesto === puesto) && this.near(who, n.id)));
  }

  /** Pausa entre dos entregas de la misma persona. */
  private busy(userId: string): boolean {
    const now = this.deps.now();
    if (now - (this.lastAt.get(userId) ?? -Infinity) < GENTE_REGLAS.pausaMs) return true;
    this.lastAt.set(userId, now);
    return false;
  }

  /** Entregar el pedido de alguien de la fiesta. Null si el mensaje no sirve. */
  async entregar(who: GenteWho, raw: unknown): Promise<EntregarResult | null> {
    const parsed = EntregarMessage.safeParse(raw);
    if (!parsed.success) return null;
    const { npc: npcId, pedido: pedidoId } = parsed.data;
    const fail = (error: Extract<EntregarResult, { ok: false }>["error"]): EntregarResult => ({ ok: false, npc: npcId, error });
    const f = this.deps.festival();
    if (!f.id || f.fase !== "fiesta") return fail("off");
    const nivel = this.nivel(who.area);
    const npc = nivel?.npc(npcId);
    const pedido = npc?.pedido?.id === pedidoId ? npc.pedido : undefined;
    if (!nivel || !npc || !pedido) return fail("unknown");
    if (!this.near(who, npcId)) return fail("far");
    // Sin los contadores leídos no se sabe si ya lo entregó.
    if (!this.deps.stats.isLoaded(who.userId) || this.busy(who.userId)) return fail("busy");
    const key = pedidoStatKey(f.id, f.año, pedido.id);
    if ((this.deps.stats.stat(who.userId, key) ?? 0) >= 1) return fail("hecho");
    const held = this.deps.held;
    if (pedido.pide.some((p) => held.count(who.userId, objItemId(p.item)) < p.n)) return fail("faltan");
    const gives = pedido.da.item ? objItemId(pedido.da.item) : null;
    if (gives && held.fits(who.userId, [[gives, pedido.da.n ?? 1]]) !== "ok") return fail("full");
    // La marca va antes de dar (dos mensajes seguidos no dan dos veces); lo pedido sale todo o nada.
    this.deps.stats.max(who.userId, key, 1);
    const taken: { item: string; n: number }[] = [];
    for (const p of pedido.pide) {
      if (!(await held.take(who.userId, objItemId(p.item), p.n))) {
        for (const t of taken) await held.add(who.userId, objItemId(t.item), t.n);
        return fail("faltan");
      }
      taken.push(p);
    }
    if (gives) await held.add(who.userId, gives, pedido.da.n ?? 1);
    // Los puntos, con el tope por festival (lo ya dado va en otro contador de máximo).
    let puntos = 0;
    let capped = false;
    if (pedido.da.puntos) {
      const pkey = puntosPedidosKey(f.id, f.año);
      const ya = this.deps.stats.stat(who.userId, pkey) ?? 0;
      const quiere = Math.max(0, Math.min(pedido.da.puntos, GENTE_REGLAS.topePuntos - ya));
      capped = quiere < pedido.da.puntos;
      if (quiere > 0) {
        this.deps.stats.max(who.userId, pkey, ya + quiere);
        puntos = await this.deps.award(who.userId, quiere);
      }
    }
    return { ok: true, npc: npcId, pedido: pedido.id, ...(gives ? { item: gives, n: pedido.da.n ?? 1 } : {}), puntos, capped };
  }

  /** Los pedidos del festival de ahora que esa persona ya entregó. */
  hechos(userId: string): GenteHechos {
    const f = this.deps.festival();
    const fest = f.id ? festivalById(f.id) : undefined;
    const gente = fest && GENTE_FIESTA[fest.id];
    if (!fest || !gente) return { festival: f.id, pedidos: [] };
    // Todos los pedidos del festival (sin mirar la lluvia: un pedido entregado sigue entregado).
    const todos = gente(diaDelFestival(fest, fechaDelJuego(f.day).diaDeEstacion), "despejado");
    const ids = pedidosDe(todos)
      .map(({ pedido }) => pedido.id)
      .filter((id) => (this.deps.stats.stat(userId, pedidoStatKey(f.id, f.año, id)) ?? 0) >= 1);
    return { festival: f.id, pedidos: ids };
  }

  /** Se fue de la sala. */
  forget(userId: string) {
    this.lastAt.delete(userId);
  }
}
