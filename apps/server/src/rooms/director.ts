// El panel del director en la sala (VIR-175, reglas en @hyvento/shared/director): quien tiene el permiso
// `director` (los admins siempre) prende un festival, fija el clima, mueve la hora o salta de día, y dispara
// momentos. Cada acción la valida aquí (el permiso y que tenga sentido) y cada cambio sale en el chat global.
// Los momentos son un registro: cada módulo registra el manejador del suyo con `registrar` (el id va en
// `DIRECTOR_ACCIONES` de shared, que es lo que muestra el panel), así un festival nuevo suma los suyos sin
// tocar ni el panel ni este archivo.
import {
  addGameTime,
  climaPermitido,
  DirectorAction,
  directorAccion,
  directorAviso,
  DIRECTOR_HORA_FIESTA,
  festivalById,
  irAEstacion,
  irAlDia,
  irAlFestival,
  puede,
  relojTexto,
  SEASON_TEXT,
  setGameTime,
  WEATHER_TEXT,
  type DirectorResult,
  type FestivalId,
  type GameClockState,
  type Season,
  type Weather,
} from "@hyvento/shared";

/** Quien pide la acción (sus permisos son los de `client.userData`). */
export interface DirectorWho {
  userId: string;
  name: string;
  admin?: boolean;
  permisos?: readonly string[];
}

/** El manejador de un momento: null si salió, o el resultado del rechazo. */
export type MomentoFn = (who: DirectorWho) => DirectorResult | null;

export interface DirectorDeps {
  /** El festival de ahora ("" = ninguno) y su fase. */
  festival(): { id: string; fase: string };
  /** Prende un festival ya (o vuelve al calendario con null) y pone su decoración. */
  forceFestival(id: FestivalId | null): void;
  clock(): GameClockState;
  now(): number;
  /** Mueve el reloj (y lo guarda, re-estaciona el huerto y revisa el festival del día). */
  setClock(c: GameClockState, userId: string): void;
  season(): Season;
  /** Fija el clima (`holdMs` reales, o `Infinity` hasta volver al natural). */
  setWeather(w: Weather, holdMs: number): void;
  releaseWeather(): void;
  /** Aviso del sistema en el chat global. */
  notice(text: string): void;
}

const fallo = (error: NonNullable<DirectorResult["error"]>, texto: string, festival?: FestivalId): DirectorResult =>
  festival ? { ok: false, error, texto, festival } : { ok: false, error, texto };

export class Director {
  private momentos = new Map<string, MomentoFn>();

  constructor(private readonly d: DirectorDeps) {}

  /** Registra el manejador de un momento (su id va en `DIRECTOR_ACCIONES` de shared). */
  registrar(id: string, fn: MomentoFn) {
    this.momentos.set(id, fn);
  }

  /** Los ids con manejador (para los tests). */
  registrados(): string[] {
    return [...this.momentos.keys()];
  }

  /** Hace la acción si se puede. Null si el mensaje no sirve. */
  run(who: DirectorWho, raw: unknown): DirectorResult | null {
    const parsed = DirectorAction.safeParse(raw);
    if (!parsed.success) return null;
    if (!puede(who, "director")) return fallo("permiso", "Necesitas el permiso del director.");
    const a = parsed.data;
    const res = this.hacer(who, a);
    if (res.ok) {
      const f = festivalById(this.d.festival().id);
      this.d.notice(directorAviso(who.name, a, { reloj: relojTexto(this.d.clock(), this.d.now()), festival: f?.nombre }));
    }
    return res;
  }

  private hacer(who: DirectorWho, a: DirectorAction): DirectorResult {
    const now = this.d.now();
    const moverReloj = (c: GameClockState | null, nada: string): DirectorResult => {
      if (!c) return fallo("nada", nada);
      this.d.setClock(c, who.userId);
      return { ok: true, texto: `Listo: ${relojTexto(this.d.clock(), this.d.now())}.` };
    };
    switch (a.kind) {
      case "festival": {
        if (!a.id) {
          this.d.forceFestival(null);
          return { ok: true, texto: "Los festivales vuelven a ir según el calendario." };
        }
        // Prendido de noche no se vería nada: primero se prende y luego se lleva la hora a la fiesta (así
        // la apertura sale al abrir, como en el calendario).
        this.d.forceFestival(a.id);
        const fase = this.d.festival().fase;
        if (fase !== "fiesta") this.d.setClock(setGameTime(this.d.clock(), now, DIRECTOR_HORA_FIESTA), who.userId);
        return { ok: true, texto: `${festivalById(a.id)!.nombre} está prendido.` };
      }
      case "clima": {
        if (!a.weather) {
          this.d.releaseWeather();
          return { ok: true, texto: "El clima vuelve a cambiar solo." };
        }
        if (!climaPermitido(a.weather, this.d.season())) return fallo("nieve", "Solo nieva en invierno: salta al invierno primero.");
        this.d.setWeather(a.weather, a.minutes ? a.minutes * 60_000 : Infinity);
        return { ok: true, texto: `${WEATHER_TEXT[a.weather]}${a.minutes ? ` por ${a.minutes} minutos` : " hasta que lo sueltes"}.` };
      }
      case "hora":
        return moverReloj(setGameTime(this.d.clock(), now, a.minuteOfDay), "");
      case "adelantar":
        return moverReloj(addGameTime(this.d.clock(), now, a.minutes), "");
      case "dia":
        return moverReloj(irAlDia(this.d.clock(), now, a.estacion, a.dia), "Hoy ya es ese día.");
      case "estacion":
        return moverReloj(irAEstacion(this.d.clock(), now, a.estacion), `Ya es ${SEASON_TEXT[a.estacion].toLowerCase()}.`);
      case "irFestival": {
        const c = irAlFestival(this.d.clock(), now, a.id);
        // Ir al día del festival es volver al calendario: si había otro prendido a mano, se apaga.
        const otro = this.d.festival().id !== a.id;
        if (c) this.d.setClock(c, who.userId);
        if (otro) this.d.forceFestival(null);
        if (!c && !otro) return fallo("nada", `Ya es ${festivalById(a.id)!.nombre} y la fiesta está abierta.`);
        return { ok: true, texto: `Listo: ${relojTexto(this.d.clock(), this.d.now())}.` };
      }
      case "momento":
        return this.momento(who, a.id);
    }
  }

  private momento(who: DirectorWho, id: string): DirectorResult {
    const def = directorAccion(id);
    const fn = this.momentos.get(id);
    if (!def || !fn) return fallo("desconocido", "Ese momento no existe.");
    const f = this.d.festival();
    if (def.festival && f.id !== def.festival) return fallo("festival", `Primero prende ${festivalById(def.festival)!.nombre}.`, def.festival);
    if (def.conFestival && !f.id) return fallo("festival", "Primero prende un festival.");
    if ((def.festival || def.conFestival) && f.fase !== "fiesta") return fallo("cerrado", "La fiesta abre de 9:00 a 22:00: pon la hora primero.");
    return fn(who) ?? { ok: true, texto: `${def.nombre}: listo.` };
  }
}
