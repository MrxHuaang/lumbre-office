// Los festivales en la sala (ver festivales.ts de @hyvento/shared): cuál corre según el calendario del juego
// (o el que se prendió con /festival en desarrollo) y en qué fase va. Lo publica en el estado (`festival`,
// `festivalFase`) para que el navegador lo dibuje, y al abrir y al cerrar cada día manda a todos la
// cinemática del festival; quien entra con la fiesta andando ve la de "llegaste en plena fiesta".
import { FESTIVAL_MSG, estacionDelDia, festivalById, festivalCineId, festivalEn, festivalFase, fechaDelJuego, type FestivalCineEvent, type FestivalDef, type FestivalFase, type FestivalId, type GameTime } from "@hyvento/shared";

export interface FestivalesParts {
  /** Donde se publica (el estado de la sala, que existe recién en onCreate: por eso se pide cada vez). */
  state(): { festival: string; festivalFase: string };
  /** Hora del juego ahora (no corre con la sala vacía). */
  time(): GameTime;
  broadcast(type: string, msg: unknown): void;
}

export class Festivales {
  /** El que se prendió a mano (solo desarrollo): manda sobre el calendario. */
  private override: FestivalId | null = null;

  constructor(private readonly parts: FestivalesParts) {}

  /** El festival de hoy (o null) y en qué fase va. */
  current(): { festival: FestivalDef | null; fase: FestivalFase } {
    const t = this.parts.time();
    const f = fechaDelJuego(t.day);
    const festival = this.override ? festivalById(this.override)! : festivalEn(estacionDelDia(t.day), f.diaDeEstacion);
    return { festival, fase: festivalFase(t.minuteOfDay) };
  }

  /** Ya pasó el primer tick: lo que ya estaba andando al arrancar la sala no se anuncia como "empezó". */
  private started = false;

  /**
   * Revisa el calendario (cada tanto): si cambió el festival o la fase, lo publica; al abrir (las 9:00, o al
   * prenderlo a mano en plena fiesta) y al cerrar (las 22:00) manda la cinemática a todos.
   */
  tick() {
    const { festival, fase } = this.current();
    const id = festival?.id ?? "";
    const shown = festival ? fase : "";
    const st = this.parts.state();
    if (st.festival === id && st.festivalFase === shown) return;
    const was = { id: st.festival, fase: st.festivalFase };
    st.festival = id;
    st.festivalFase = shown;
    if (!festival || !this.started) return;
    if (shown === "fiesta" && (was.id !== id || was.fase !== "fiesta")) this.cine(festivalCineId(festival.id, "apertura"));
    else if (shown === "fin" && was.id === id && was.fase === "fiesta") this.cine(festivalCineId(festival.id, "cierre"));
  }

  start() {
    this.tick();
    this.started = true;
  }

  /** Quien entra con la fiesta andando ve la cinemática corta de llegada. */
  welcome(send: (type: string, msg: unknown) => void) {
    const { festival, fase } = this.current();
    if (festival && fase === "fiesta") send(FESTIVAL_MSG.cine, { id: festivalCineId(festival.id, "llegada") } satisfies FestivalCineEvent);
  }

  /** Solo desarrollo: prende un festival ya (o vuelve al calendario con null). */
  force(id: FestivalId | null) {
    this.override = id;
    this.tick();
  }

  private cine(id: string) {
    this.parts.broadcast(FESTIVAL_MSG.cine, { id } satisfies FestivalCineEvent);
  }
}
