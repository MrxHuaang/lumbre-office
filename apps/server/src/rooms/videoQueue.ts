// Una cola de videos de YouTube con su reloj: la del club y la del cine. El servidor guarda qué se ve y
// desde cuándo (su hora), lo que viene y lo que ya se vio; cada cliente pone su reproductor en ese segundo.
// Cualquiera agrega, reordena, quita o salta; el primer reproductor dice la duración y el servidor pasa
// solo al siguiente cuando termina (aunque nadie lo esté mirando).
import { CLUB_VIDEO, type ClubError } from "@hyvento/shared";
import type { ArraySchema } from "@colyseus/schema";
import { ClubVideo } from "../state";

/** Lo que la cola toca del estado (ClubState y CinemaState lo tienen). */
export interface VideoQueueState {
  video: ClubVideo;
  queue: ArraySchema<ClubVideo>;
  history: ArraySchema<ClubVideo>;
  startedAt: number;
  paused: boolean;
  pausedAt: number;
}

export type QueueOutcome = { ok: true } | { ok: false; error: ClubError };

const fail = (error: ClubError): QueueOutcome => ({ ok: false, error });
const OK: QueueOutcome = { ok: true };

function assignVideo(to: ClubVideo, from: Pick<ClubVideo, "id" | "videoId" | "title" | "by" | "byId" | "durationMs">): ClubVideo {
  to.id = from.id;
  to.videoId = from.videoId;
  to.title = from.title;
  to.by = from.by;
  to.byId = from.byId;
  to.durationMs = from.durationMs;
  return to;
}

/** Copia un video (una instancia de schema no puede estar en dos lugares del estado a la vez). */
export function copyVideo(v: ClubVideo): ClubVideo {
  return assignVideo(new ClubVideo(), v);
}

export function clearVideo(v: ClubVideo) {
  assignVideo(v, { id: "", videoId: "", title: "", by: "", byId: "", durationMs: 0 });
}

export class VideoQueue {
  /** Para los ids de las entradas de la cola. */
  private seq = 0;

  /** `onPlay`: empezó un video (o, con null, se acabó la cola y quedó en silencio). */
  constructor(
    private readonly s: VideoQueueState,
    private readonly onPlay: (v: ClubVideo | null) => void = () => {},
  ) {}

  /** ¿Se puede agregar este video? (antes de ir a averiguar su título) */
  canAdd(videoId: string): QueueOutcome {
    const s = this.s;
    if (s.queue.length >= CLUB_VIDEO.maxQueue) return fail("queue-full");
    if (s.video.videoId === videoId || s.queue.some((v) => v.videoId === videoId)) return fail("queued");
    return OK;
  }

  /**
   * Agrega un video al final de la cola; si no se está viendo ninguno, arranca ya. `byId` es el User.id de
   * quien lo puso (en el karaoke del club, quien canta).
   */
  enqueue(video: { videoId: string; title: string; durationMs?: number }, by: string, now: number, byId = ""): QueueOutcome {
    const check = this.canAdd(video.videoId);
    if (!check.ok) return check;
    const v = new ClubVideo();
    v.id = `v${now.toString(36)}${(this.seq++).toString(36)}`;
    v.videoId = video.videoId;
    v.title = video.title.slice(0, CLUB_VIDEO.maxTitle);
    v.by = by.slice(0, 40);
    v.byId = byId;
    v.durationMs = video.durationMs ?? 0;
    this.s.queue.push(v);
    if (!this.s.video.videoId) this.next(now);
    return OK;
  }

  /** Vuelve a poner uno de lo que ya se vio (al final de la cola). */
  replay(id: string, by: string, now: number, byId = ""): QueueOutcome {
    const old = this.s.history.find((v) => v.id === id);
    if (!old) return fail("invalid");
    return this.enqueue(old, by, now, byId);
  }

  /** Mueve una entrada de la cola a la posición `to` (se recorta al largo de la cola). */
  move(id: string, to: number): QueueOutcome {
    const q = this.s.queue;
    const from = q.findIndex((v) => v.id === id);
    if (from < 0) return fail("invalid");
    const target = Math.min(to, q.length - 1);
    if (target === from) return OK;
    const list = q.map(copyVideo);
    const [moved] = list.splice(from, 1);
    list.splice(target, 0, moved!);
    this.setQueue(list);
    return OK;
  }

  unqueue(id: string): QueueOutcome {
    const q = this.s.queue;
    const i = q.findIndex((v) => v.id === id);
    if (i < 0) return fail("invalid");
    q.splice(i, 1);
    return OK;
  }

  /** Salta el video actual (si todavía es `id`: dos saltos a la vez no se llevan dos). */
  skip(id: string, now: number): QueueOutcome {
    if (this.s.video.id !== id) return OK;
    this.next(now);
    return OK;
  }

  /**
   * Un reproductor avisó que terminó `id`. Se cree si ya es la hora (con la duración conocida) o si pasó
   * un rato (sin ella): un cliente adelantado no corta el video a los demás.
   */
  ended(id: string, now: number): QueueOutcome {
    const s = this.s;
    if (s.video.id !== id || s.paused) return OK;
    const elapsed = now - s.startedAt;
    const due = s.video.durationMs > 0 ? elapsed >= s.video.durationMs - CLUB_VIDEO.endSlackMs : elapsed >= CLUB_VIDEO.minPlayMs;
    if (due) this.next(now);
    return OK;
  }

  /** La duración que dio el primer reproductor del video `id` (las siguientes no cambian nada). */
  duration(id: string, ms: number): QueueOutcome {
    const v = this.s.video.id === id ? this.s.video : this.s.queue.find((q) => q.id === id);
    if (!v || v.durationMs > 0 || ms <= 0) return OK;
    v.durationMs = Math.min(CLUB_VIDEO.maxDurationMs, Math.max(CLUB_VIDEO.minDurationMs, ms));
    return OK;
  }

  /** Pausa el video actual en su punto (al seguir arranca desde ahí). */
  pause(now: number) {
    const s = this.s;
    if (!s.video.videoId || s.paused) return;
    s.pausedAt = Math.max(0, now - s.startedAt);
    s.paused = true;
  }

  resume(now: number) {
    const s = this.s;
    if (!s.video.videoId || !s.paused) return;
    s.startedAt = now - s.pausedAt;
    s.paused = false;
    s.pausedAt = 0;
  }

  /** Cada medio segundo: si el video ya terminó (según el reloj del servidor), pasa al siguiente. */
  tick(now: number) {
    const s = this.s;
    if (!s.video.videoId || s.paused) return;
    const limit = s.video.durationMs > 0 ? s.video.durationMs + CLUB_VIDEO.endGraceMs : CLUB_VIDEO.unknownMaxMs;
    if (now - s.startedAt >= limit) this.next(now);
  }

  /** Devuelve el video actual al frente de la cola, sin perderlo (el club lo corta con una pista). */
  shelve() {
    const s = this.s;
    if (!s.video.videoId) return;
    this.setQueue([copyVideo(s.video), ...s.queue.map(copyVideo)]);
    clearVideo(s.video);
  }

  /** Corta el video actual (va a "lo que se vio"), sin pasar al siguiente. */
  stop() {
    const s = this.s;
    if (s.video.videoId) this.remember(s.video);
    clearVideo(s.video);
  }

  /** Pasa al siguiente de la cola (el actual va a "lo que se vio"); sin cola, silencio. */
  private next(now: number) {
    const s = this.s;
    if (s.video.videoId) this.remember(s.video);
    const next = s.queue.shift();
    s.paused = false;
    s.pausedAt = 0;
    if (!next) {
      clearVideo(s.video);
      s.startedAt = 0;
      this.onPlay(null);
      return;
    }
    assignVideo(s.video, next);
    s.startedAt = now;
    this.onPlay(s.video);
  }

  /** Reemplaza la cola entera (ArraySchema no deja insertar en el medio con splice). */
  private setQueue(list: ClubVideo[]) {
    const q = this.s.queue;
    q.splice(0, q.length);
    for (const v of list) q.push(v);
  }

  /** Guarda un video en "lo que se vio" (lo último primero, sin repetir el mismo video). */
  private remember(v: ClubVideo) {
    const h = this.s.history;
    for (let i = h.length - 1; i >= 0; i--) if (h[i]!.videoId === v.videoId) h.splice(i, 1);
    const list = [copyVideo(v), ...h.map(copyVideo)].slice(0, CLUB_VIDEO.historySize);
    h.splice(0, h.length);
    for (const x of list) h.push(x);
  }
}
