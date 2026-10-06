// Las novenas en la sala (ver novenas.ts de @hyvento/shared): el pesebre del recibidor, que gana una figura
// por día (la pone el primero que llega con E, con su cinemática para todos), y la novena de las 20:00 del
// juego: a los que están junto al pesebre les sale la cinemática de esa noche y ganan unos puntos (una vez
// por día de la novena). La figura de hoy se guarda en una fila de WorldLayout (como el reloj), así un
// reinicio no la pierde. Este módulo no conoce Colyseus: la sala le da lo que necesita.
import {
  atNovena,
  figuraDelDia,
  figurasVisibles,
  horaDeNovena,
  nearPesebre,
  NOVENA,
  NOVENA_MSG,
  novenaCineId,
  PESEBRE_CINE,
  PesebreGuardado,
  STAT_KEYS,
  type GameTime,
  type NovenaAviso,
  type NovenaCineEvent,
  type PesebreEstado,
} from "@hyvento/shared";

export interface NovenaPlayer {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
}

export interface NovenasDeps {
  /** Día de la novena que corre hoy (1..9), o 0 si no hay novena. */
  dia(): number;
  /** Hora del juego. */
  time(): GameTime;
  players(): Iterable<[string, NovenaPlayer]>;
  tileSize: number;
  broadcast(type: string, msg: unknown): void;
  send(sessionId: string, type: string, msg: unknown): void;
  /** Puntos de la novena (LEISURE), una sola vez por `refId`: true si se pagaron ahora (no repetidos). */
  awardOnce(userId: string, amount: number, refId: string): Promise<boolean>;
  /** Puntos de ocio (LEISURE, con su tope). */
  award(userId: string, amount: number): Promise<number>;
  bump(userId: string, key: string): void;
  /** La fila guardada del pesebre (JSON crudo) y guardarla. */
  load(): Promise<unknown>;
  save(data: PesebreGuardado, userId: string): Promise<void>;
}

export class Novenas {
  /** Quién puso la figura del día del juego `day` (solo cuenta la de hoy). */
  private puesta: PesebreGuardado | null = null;
  /** El último día del juego en que se avisó la novena, y quiénes ya rezaron ese día. */
  private rezoDay = -1;
  private rezaron = new Set<string>();
  /** Lo último que se mandó del pesebre (para mandarlo solo cuando cambia). */
  private shown = "";

  constructor(private readonly deps: NovenasDeps) {}

  async load() {
    const raw = await this.deps.load().catch((err) => {
      console.error("loadPesebre", err);
      return null;
    });
    const parsed = PesebreGuardado.safeParse(raw);
    if (parsed.success) this.puesta = parsed.data;
  }

  /** Cómo está el pesebre ahora (día 0 = no hay novena). */
  estado(): PesebreEstado {
    const dia = this.deps.dia();
    if (!dia) return { dia: 0, figuras: 0, por: "" };
    const hoy = this.puestaHoy();
    return { dia, figuras: figurasVisibles(dia, Boolean(hoy)), por: hoy?.name ?? "" };
  }

  private puestaHoy(): PesebreGuardado | null {
    return this.puesta && this.puesta.day === this.deps.time().day ? this.puesta : null;
  }

  /** Quien entra ve cómo está el pesebre. */
  welcome(sessionId: string) {
    this.deps.send(sessionId, NOVENA_MSG.estado, this.estado());
  }

  /** Cada tanto: el pesebre cambió de día (o empezó o terminó la novena) y la novena de las 20:00. */
  tick() {
    const estado = this.estado();
    const key = `${estado.dia}:${estado.figuras}:${estado.por}`;
    if (key !== this.shown) {
      this.shown = key;
      this.deps.broadcast(NOVENA_MSG.estado, estado);
    }
    const t = this.deps.time();
    if (!estado.dia || !horaDeNovena(t.minuteOfDay)) return;
    if (this.rezoDay !== t.day) {
      this.rezoDay = t.day;
      this.rezaron.clear();
      this.deps.broadcast(NOVENA_MSG.aviso, { code: "rezo" } satisfies NovenaAviso);
    }
    for (const [sessionId, p] of this.deps.players()) {
      if (this.rezaron.has(p.userId) || !atNovena(p, this.deps.tileSize)) continue;
      this.rezaron.add(p.userId);
      this.deps.send(sessionId, NOVENA_MSG.cine, { id: novenaCineId(estado.dia) } satisfies NovenaCineEvent);
      void this.rezar(p.userId, t.day);
    }
  }

  /** Reza la novena: puntos una vez por día del juego (aunque se reinicie la sala) y el contador del logro. */
  private async rezar(userId: string, day: number) {
    const fresh = await this.deps.awardOnce(userId, NOVENA.puntos, `${NOVENA.refPrefix}${day}`).catch((err) => {
      console.error("novena", err);
      return false;
    });
    if (fresh) this.deps.bump(userId, STAT_KEYS.novenasRezadas);
  }

  /** E junto al pesebre: el primero del día pone la figura (y todos ven su cinemática). */
  async figura(p: NovenaPlayer): Promise<NovenaAviso | null> {
    const dia = this.deps.dia();
    if (!dia) return { code: "noNovena" };
    if (!nearPesebre(p, this.deps.tileSize)) return { code: "lejos" };
    const hoy = this.puestaHoy();
    if (hoy) return { code: "yaPuesta", por: hoy.name };
    const day = this.deps.time().day;
    this.puesta = { day, by: p.userId, name: p.name };
    void this.deps.save(this.puesta, p.userId).catch((err) => console.error("savePesebre", err));
    this.tick();
    const figura = figuraDelDia(dia);
    this.deps.broadcast(NOVENA_MSG.cine, { id: PESEBRE_CINE, vars: { figura: figura.name, nombre: p.name, dia } } satisfies NovenaCineEvent);
    this.deps.bump(p.userId, STAT_KEYS.pesebreFiguras);
    await this.deps.award(p.userId, NOVENA.puntosFigura);
    return null;
  }
}
