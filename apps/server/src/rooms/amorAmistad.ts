// Amor y amistad en la sala (reglas en amor-amistad.ts de @hyvento/shared): el amigo secreto (anotarse en
// el cofre, el sorteo de las 10:00 y el de los tardíos sin romper parejas, los detalles anónimos de la
// mochila con su notita y la revelación al cierre), las cartas anónimas del buzón que Cupido entrega en
// persona, la serenata del trío (una a la vez, con propina) y el puesto de chocolates y flores. Todo vive
// en memoria; la marca de quien se anotó va en `UserStat` (si la sala se reinicia, vuelve a entrar al
// sorteo). Este módulo no conoce Colyseus: la sala le presta lo que necesita (una línea en OfficeRoom).
import { nearPointOfType, type OfficeMap } from "@hyvento/map";
import {
  AMOR,
  AMOR_MSG,
  AmorBuyMessage,
  CartaMessage,
  RegaloMessage,
  SERENATA,
  STAT_KEYS,
  SerenataMessage,
  amigoPremioRef,
  amigosDe,
  amorActivo,
  amorRefId,
  amorShopItem,
  anotadoKey,
  bagItemInfo,
  limpiarTexto,
  objItemId,
  regalable,
  serenataRefId,
  sortearAmigos,
  type AmorAccion,
  type AmorError,
  type AmorEstado,
  type AmorResultado,
  type CartaLlega,
  type Pareja,
  type RegaloLlego,
  type Revelacion,
  type SerenataEvento,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";
import type { AchievementTracker } from "./achievements";
import type { Bag } from "./bag";

/** Lo que el módulo necesita de quien juega (el `Player` de la sala). */
export interface AmorPlayer {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
  status: string;
}

export interface AmorParts {
  /** El festival, su fase, el año y el día del juego y el minuto del día. */
  festival(): { id: string; fase: string; año: number; day: number; minute: number };
  /** Quienes están conectados (sessionId → jugador). */
  players(): Iterable<[string, AmorPlayer]>;
  mapOf(area: string): OfficeMap;
  held: Pick<Bag, "count" | "fits" | "add" | "take">;
  stats: Pick<AchievementTracker, "stat" | "max" | "bump" | "isLoaded">;
  repo(): Pick<GameRepository, "spendPoints" | "awardPointsOnce">;
  /** ¿Junto al puesto del festival? (su punto o la vendedora: lo mide la sala). */
  nearShop(p: AmorPlayer): boolean;
  send(sessionId: string, type: string, msg: unknown): void;
  broadcast(type: string, msg: unknown): void;
  /** Cambió el saldo (compra, propina o premio): la sala lo pone en el jugador y avisa el "+N". */
  balance(userId: string, balance: number, awarded?: number): void;
}

/** El reloj, el azar y la espera de la revelación (los tests los fijan). */
export const AMOR_RELOJ = {
  now: () => Date.now(),
  random: () => Math.random(),
  revelacionMs: AMOR.revelacionDelayMs as number,
};

type Room = { onMessage(type: string, cb: (client: { sessionId: string }, raw: unknown) => void): unknown };

interface Anotado {
  name: string;
  at: number;
}

export class AmorAmistad {
  /** El año y el día del juego de lo que hay en memoria (al cambiar, se vacía). */
  private dia = "";
  private anotados = new Map<string, Anotado>();
  private parejas: Pareja[] = [];
  private sorteado = false;
  private regalos = new Map<string, number>();
  private recibidos = new Map<string, { item: string; nota: string }[]>();
  private cartas = new Map<string, number>();
  private cola = new Map<string, CartaLlega[]>();
  private ultimaCarta = new Map<string, number>();
  private cartaId = 0;
  /** Hasta cuándo el trío está tocando o descansando. */
  private serenataHasta = 0;
  private closedAt: number | null = null;
  private revelado = false;
  private lastAt = new Map<string, number>();

  constructor(private readonly parts: AmorParts) {}

  open(): boolean {
    const f = this.parts.festival();
    return amorActivo(f.id, f.fase);
  }

  private now() {
    return AMOR_RELOJ.now();
  }

  private reset() {
    this.anotados.clear();
    this.parejas = [];
    this.sorteado = false;
    this.regalos.clear();
    this.recibidos.clear();
    this.cartas.clear();
    this.cola.clear();
    this.ultimaCarta.clear();
    this.serenataHasta = 0;
    this.closedAt = null;
    this.revelado = false;
  }

  private busy(userId: string): boolean {
    const now = this.now();
    if (now - (this.lastAt.get(userId) ?? -Infinity) < AMOR.pausaMs) return true;
    this.lastAt.set(userId, now);
    return false;
  }

  /** Las sesiones de alguien conectado. */
  private sesiones(userId: string): [string, AmorPlayer][] {
    return [...this.parts.players()].filter(([, p]) => p.userId === userId);
  }

  private online(userId: string): AmorPlayer | undefined {
    return this.sesiones(userId)[0]?.[1];
  }

  private nameOf(userId: string): string {
    return this.anotados.get(userId)?.name ?? this.online(userId)?.name ?? "Alguien";
  }

  /** Lo mío, como lo ve el panel. */
  estado(userId: string): AmorEstado {
    const f = this.parts.festival();
    return {
      festival: amorActivo(f.id, f.fase),
      anotado: this.anotados.has(userId),
      sorteado: this.sorteado,
      anotados: this.anotados.size,
      amigos: amigosDe(this.parejas, userId).map((u) => ({ userId: u, name: this.nameOf(u), online: Boolean(this.online(u)) })),
      regalosDados: this.regalos.get(userId) ?? 0,
      cartasEnviadas: this.cartas.get(userId) ?? 0,
      recibidos: this.recibidos.get(userId) ?? [],
      serenataHasta: this.serenataHasta > this.now() ? this.serenataHasta : 0,
    };
  }

  private enviarEstado(userId: string) {
    const e = this.estado(userId);
    for (const [sid] of this.sesiones(userId)) this.parts.send(sid, AMOR_MSG.estado, e);
  }

  /** Cada tanto (con el reloj de la sala): el día, el sorteo, Cupido y la revelación al cierre. */
  tick() {
    const f = this.parts.festival();
    if (f.id !== AMOR.id) {
      if (this.dia) {
        this.reset();
        this.dia = "";
      }
      return;
    }
    const dia = `${f.año}:${f.day}`;
    if (this.dia !== dia) {
      if (this.dia) this.reset();
      this.dia = dia;
    }
    if (f.fase === "fiesta") {
      this.sortear(f.minute);
      this.repartirCartas();
    }
    if (f.fase === "fin" && !this.revelado) {
      if (this.closedAt === null) this.closedAt = this.now();
      if (this.now() - this.closedAt >= AMOR_RELOJ.revelacionMs) {
        this.revelado = true;
        void this.revelar(f.año);
      }
    }
  }

  /** El sorteo: el grande a las 10:00 del juego y, después, los tardíos (sin romper ninguna pareja). */
  private sortear(minute: number) {
    if (!this.sorteado) {
      if (minute < AMOR.sorteoMinuto) return;
      this.sorteado = true;
      for (const u of this.anotados.keys()) this.enviarEstado(u);
    }
    const anotados = [...this.anotados.keys()];
    const enPareja = new Set(this.parejas.flatMap((p) => [p.de, p.para]));
    const libres = anotados.filter((u) => !enPareja.has(u));
    if (!libres.length) return;
    // Uno solo espera un ratico por si llega otro con quien hacer ronda aparte.
    const solo = libres.length === 1 && this.now() - this.anotados.get(libres[0]!)!.at >= AMOR.tardioEsperaMs;
    const nuevas = sortearAmigos(anotados, this.parejas, AMOR_RELOJ.random, { solo });
    if (!nuevas.length) return;
    this.parejas.push(...nuevas);
    for (const u of new Set(nuevas.flatMap((p) => [p.de, p.para]))) this.enviarEstado(u);
  }

  /** Cupido entrega una carta a la vez a cada quien conectado (y no en "No molestar"). */
  private repartirCartas() {
    const now = this.now();
    for (const [userId, cola] of this.cola) {
      if (!cola.length) continue;
      const ses = this.sesiones(userId);
      const p = ses[0];
      if (!p || p[1].status === "dnd") continue;
      if (now - (this.ultimaCarta.get(userId) ?? -Infinity) < AMOR.cupidoPausaMs) continue;
      this.ultimaCarta.set(userId, now);
      const carta = cola.shift()!;
      this.parts.send(p[0], AMOR_MSG.cupido, carta satisfies CartaLlega);
    }
  }

  /** La revelación: todas las parejas, con nombres, para todos; y el premio a quien dio algún detalle. */
  async revelar(año: number): Promise<Revelacion | null> {
    if (!this.parejas.length) return null;
    const pares = this.parejas.map((p) => ({ de: this.nameOf(p.de), para: this.nameOf(p.para), deId: p.de, paraId: p.para }));
    const r: Revelacion = { pares };
    this.parts.broadcast(AMOR_MSG.revelacion, r);
    const ref = amigoPremioRef(año);
    for (const [userId, n] of this.regalos) {
      if (n < 1) continue;
      try {
        const res = await this.parts.repo().awardPointsOnce({ userId, amount: AMOR.premio, reason: "LEISURE", refId: ref, refPrefix: ref, maxPerDay: 1 });
        if (res.status === "ok") this.parts.balance(userId, res.balance, res.awarded);
      } catch (err) {
        console.error("amor awardPointsOnce", err);
      }
    }
    return r;
  }

  /** Entró (con los contadores ya leídos): si se había anotado este año y la sala lo olvidó, vuelve a entrar. */
  joined(userId: string, name: string) {
    const f = this.parts.festival();
    if (f.id === AMOR.id && !this.anotados.has(userId) && (this.parts.stats.stat(userId, anotadoKey(f.año)) ?? 0) >= 1) this.anotados.set(userId, { name, at: this.now() });
    this.enviarEstado(userId);
  }

  forget(userId: string) {
    this.lastAt.delete(userId);
  }

  // ---------- Lo que se pide ----------

  private cerca(p: AmorPlayer, punto: "amigo_secreto" | "mailbox" | "amor_serenata"): boolean {
    return nearPointOfType(this.parts.mapOf(p.area), punto, p.x, p.y);
  }

  anotar(p: AmorPlayer): AmorResultado {
    const fail = (error: AmorError): AmorResultado => ({ accion: "anotar", ok: false, error });
    if (!this.open()) return fail("off");
    if (!this.cerca(p, "amigo_secreto")) return fail("lejos");
    if (this.anotados.has(p.userId)) return fail("anotado");
    if (this.busy(p.userId)) return fail("busy");
    this.anotados.set(p.userId, { name: p.name, at: this.now() });
    this.parts.stats.max(p.userId, anotadoKey(this.parts.festival().año), 1);
    this.enviarEstado(p.userId);
    // Un tardío se sortea de una vez si ya hay con quién (el tick lo revisa también).
    if (this.sorteado) this.sortear(this.parts.festival().minute);
    return { accion: "anotar", ok: true };
  }

  async regalo(p: AmorPlayer, raw: unknown): Promise<AmorResultado | null> {
    const msg = RegaloMessage.safeParse(raw);
    if (!msg.success) return null;
    const fail = (error: AmorError): AmorResultado => ({ accion: "regalo", ok: false, error });
    if (!this.open()) return fail("off");
    if (!this.anotados.has(p.userId)) return fail("noAnotado");
    if (!this.sorteado) return fail("sinSorteo");
    const { para, item } = msg.data;
    if (!amigosDe(this.parejas, p.userId).includes(para)) return fail("noAmigo");
    if (!this.cerca(p, "amigo_secreto")) return fail("lejos");
    if (!regalable(item, bagItemInfo(item)) || this.parts.held.count(p.userId, item) < 1) return fail("item");
    const nota = limpiarTexto(msg.data.nota, AMOR.notaMax, { vacio: true });
    if (!nota.ok) return fail(nota.error);
    if ((this.regalos.get(p.userId) ?? 0) >= AMOR.regalosMax) return fail("tope");
    if (!this.online(para)) return fail("ausente");
    if (this.parts.held.fits(para, [[item, 1]]) !== "ok") return fail("llena");
    if (this.busy(p.userId)) return fail("busy");
    if (!(await this.parts.held.take(p.userId, item, 1))) return fail("item");
    // Se va a su mochila (si en ese ratico se llenó, vuelve a la de quien lo dio).
    if ((await this.parts.held.add(para, item, 1)) !== "ok") {
      await this.parts.held.add(p.userId, item, 1);
      return fail("llena");
    }
    this.regalos.set(p.userId, (this.regalos.get(p.userId) ?? 0) + 1);
    const lista = this.recibidos.get(para) ?? [];
    lista.push({ item, nota: nota.text });
    this.recibidos.set(para, lista);
    this.parts.stats.bump(p.userId, STAT_KEYS.amigoSecretoRegalos);
    for (const [sid] of this.sesiones(para)) this.parts.send(sid, AMOR_MSG.regaloLlego, { item, nota: nota.text } satisfies RegaloLlego);
    this.enviarEstado(p.userId);
    this.enviarEstado(para);
    return { accion: "regalo", ok: true, item };
  }

  carta(p: AmorPlayer, raw: unknown): AmorResultado | null {
    const msg = CartaMessage.safeParse(raw);
    if (!msg.success) return null;
    const fail = (error: AmorError): AmorResultado => ({ accion: "carta", ok: false, error });
    if (!this.open()) return fail("off");
    if (!this.cerca(p, "mailbox")) return fail("lejos");
    const { para } = msg.data;
    if (para === p.userId) return fail("self");
    if (!this.online(para)) return fail("nadie");
    const texto = limpiarTexto(msg.data.texto, AMOR.cartaMax);
    if (!texto.ok) return fail(texto.error);
    if ((this.cartas.get(p.userId) ?? 0) >= AMOR.cartasMax) return fail("tope");
    const cola = this.cola.get(para) ?? [];
    if (cola.length >= AMOR.cartasEnEsperaMax) return fail("tope");
    if (this.busy(p.userId)) return fail("busy");
    cola.push({ id: `c${++this.cartaId}`, texto: texto.text });
    this.cola.set(para, cola);
    this.cartas.set(p.userId, (this.cartas.get(p.userId) ?? 0) + 1);
    this.repartirCartas();
    this.enviarEstado(p.userId);
    return { accion: "carta", ok: true };
  }

  async serenata(p: AmorPlayer, raw: unknown): Promise<AmorResultado | null> {
    const msg = SerenataMessage.safeParse(raw);
    if (!msg.success) return null;
    const fail = (error: AmorError): AmorResultado => ({ accion: "serenata", ok: false, error });
    if (!this.open()) return fail("off");
    if (!this.cerca(p, "amor_serenata")) return fail("lejos");
    const { para, propina, anonima } = msg.data;
    if (para === p.userId) return fail("self");
    const quien = this.online(para);
    if (!quien) return fail("nadie");
    if (quien.status === "dnd") return fail("dnd");
    if (this.serenataHasta > this.now()) return fail("ocupada");
    if (this.busy(p.userId)) return fail("busy");
    // Se aparta el trío antes de cobrar: dos pedidos a la vez no salen los dos.
    const at = this.now();
    this.serenataHasta = at + SERENATA.duracionMs + SERENATA.pausaMs;
    let paid: { ok: boolean; balance: number };
    try {
      paid = await this.parts.repo().spendPoints({ userId: p.userId, amount: propina, reason: "PURCHASE", refId: serenataRefId() });
    } catch (err) {
      console.error("amor serenata spendPoints", err);
      this.serenataHasta = 0;
      return fail("failed");
    }
    if (!paid.ok) {
      this.serenataHasta = 0;
      return fail("fondos");
    }
    this.parts.balance(p.userId, paid.balance);
    this.parts.stats.bump(p.userId, STAT_KEYS.serenatasDadas);
    // Donde esté quien la recibe ahora (en tiles de su nivel).
    const ts = this.parts.mapOf(quien.area).tileSize;
    const ev: SerenataEvento = { area: quien.area, x: Math.floor(quien.x / ts), y: Math.floor(quien.y / ts), paraId: para, para: quien.name, de: anonima ? "" : p.name, at, ms: SERENATA.duracionMs };
    this.parts.broadcast(AMOR_MSG.serenataEvento, ev);
    return { accion: "serenata", ok: true, balance: paid.balance };
  }

  async comprar(p: AmorPlayer, raw: unknown): Promise<AmorResultado | null> {
    const msg = AmorBuyMessage.safeParse(raw);
    if (!msg.success) return null;
    const item = amorShopItem(msg.data.item)!;
    const fail = (error: AmorError): AmorResultado => ({ accion: "comprar", ok: false, error });
    if (!this.open()) return fail("off");
    if (!this.parts.nearShop(p)) return fail("lejos");
    const itemId = objItemId(item.id);
    const fits = this.parts.held.fits(p.userId, [[itemId, 1]]);
    if (fits !== "ok") return fail(fits);
    if (this.busy(p.userId)) return fail("busy");
    let paid: { ok: boolean; balance: number };
    try {
      paid = await this.parts.repo().spendPoints({ userId: p.userId, amount: item.price, reason: "PURCHASE", refId: amorRefId(item.id) });
    } catch (err) {
      console.error("amor spendPoints", err);
      return fail("failed");
    }
    if (!paid.ok) return fail("fondos");
    await this.parts.held.add(p.userId, itemId, 1, { pick: true });
    this.parts.balance(p.userId, paid.balance);
    return { accion: "comprar", ok: true, item: item.id, balance: paid.balance };
  }
}

/** Engancha los mensajes de Amor y amistad en la sala (una línea en OfficeRoom). */
export function registerAmorAmistad(
  room: Room,
  parts: AmorParts & { player(sessionId: string): AmorPlayer | undefined },
  markActive: (client: { sessionId: string }) => void,
): AmorAmistad {
  const amor = new AmorAmistad(parts);
  const reply = (sid: string, r: AmorResultado | null) => r && parts.send(sid, AMOR_MSG.resultado, r);
  const on = (type: string, fn: (p: AmorPlayer, raw: unknown) => AmorResultado | null | Promise<AmorResultado | null>) =>
    room.onMessage(type, (client, raw) => {
      const p = parts.player(client.sessionId);
      if (!p) return;
      markActive(client);
      void Promise.resolve(fn(p, raw)).then((r) => reply(client.sessionId, r));
    });
  on(AMOR_MSG.anotar, (p) => amor.anotar(p));
  on(AMOR_MSG.regalo, (p, raw) => amor.regalo(p, raw));
  on(AMOR_MSG.carta, (p, raw) => amor.carta(p, raw));
  on(AMOR_MSG.serenata, (p, raw) => amor.serenata(p, raw));
  on(AMOR_MSG.comprar, (p, raw) => amor.comprar(p, raw));
  room.onMessage(AMOR_MSG.pedirEstado, (client) => {
    const p = parts.player(client.sessionId);
    if (p) parts.send(client.sessionId, AMOR_MSG.estado, amor.estado(p.userId));
  });
  return amor;
}

export type { AmorAccion };
