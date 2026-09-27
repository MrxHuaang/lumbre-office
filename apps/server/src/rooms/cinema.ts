// El cine del sótano: la cola de la función (la misma cola de videos que el club, con su propio estado en
// `OfficeState.cinema`). Se programa desde cualquier parte de la sala; pausar y seguir, desde la cabina
// del proyector. Cada cliente proyecta el video en la pantalla de la pared oeste al segundo del servidor.
import { nearPointOfType, zoneAt, type OfficeMap } from "@hyvento/map";
import { CINEMA, type CinemaError } from "@hyvento/shared";
import type { CinemaState } from "../state";
import { VideoQueue } from "./videoQueue";

/** Quien usa el cine: su nivel y dónde tiene los pies. */
export interface CinemaWho {
  userId: string;
  area: string;
  x: number;
  y: number;
}

export type CinemaOutcome = { ok: true } | { ok: false; error: CinemaError };

export class Cinema {
  readonly videos: VideoQueue;
  /** Cuándo puede volver a pausar o seguir cada persona. */
  private controlAt = new Map<string, number>();

  constructor(state: CinemaState) {
    this.videos = new VideoQueue(state);
  }

  /** ¿Está dentro de la sala del cine? (ahí se programa la función) */
  inCinema(map: OfficeMap, who: Pick<CinemaWho, "area" | "x" | "y">): boolean {
    return map.id === CINEMA.area && who.area === CINEMA.area && zoneAt(map, who.x, who.y)?.id === CINEMA.zone;
  }

  /** ¿Está en la cabina, junto al proyector? */
  atBooth(map: OfficeMap, who: Pick<CinemaWho, "area" | "x" | "y">): boolean {
    return this.inCinema(map, who) && nearPointOfType(map, CINEMA.boothPoint, who.x, who.y);
  }

  /** Pausar o seguir la función: desde la cabina, con una pausa corta entre dos cambios. */
  control(map: OfficeMap, who: CinemaWho, action: "pause" | "resume", now: number): CinemaOutcome {
    if (!this.inCinema(map, who)) return { ok: false, error: "far" };
    if (!this.atBooth(map, who)) return { ok: false, error: "booth" };
    if (now < (this.controlAt.get(who.userId) ?? 0)) return { ok: false, error: "busy" };
    this.controlAt.set(who.userId, now + CINEMA.controlCooldownMs);
    if (action === "pause") this.videos.pause(now);
    else this.videos.resume(now);
    return { ok: true };
  }

  /** Cada medio segundo: la película que terminó pasa a la siguiente aunque nadie esté en la sala. */
  tick(now: number) {
    this.videos.tick(now);
  }
}
