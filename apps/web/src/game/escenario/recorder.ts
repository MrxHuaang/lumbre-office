// El grabador del estudio: mezcla en el navegador de quien pidió grabar las voces de los de adentro (su
// micrófono y las pistas de LiveKit de los demás, que ya oye) y las graba con MediaRecorder. Al detenerse
// arma el archivo y lo descarga ahí mismo: el audio nunca sale del navegador ni pasa por el servidor.
import { podcastFileName } from "@hyvento/shared";
import { media } from "../media";

/** Formatos que se prueban en orden (Chrome y Firefox: webm/ogg con opus; Safari: mp4). */
const FORMATS = [
  { mime: "audio/webm;codecs=opus", ext: "webm" },
  { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  { mime: "audio/mp4", ext: "m4a" },
  { mime: "audio/webm", ext: "webm" },
];

export class PodcastRecorder {
  private ctx: AudioContext;
  private dest: MediaStreamAudioDestinationNode;
  private rec: MediaRecorder;
  private chunks: Blob[] = [];
  private ext: string;
  /** Voces conectadas a la mezcla, por id de la pista (si alguien prende o apaga el micrófono, cambia). */
  private sources = new Map<string, MediaStreamAudioSourceNode>();
  private stopped = false;

  private constructor(private readonly startedAt: number) {
    const format = FORMATS.find((f) => MediaRecorder.isTypeSupported(f.mime));
    this.ext = format?.ext ?? "webm";
    this.ctx = new AudioContext();
    // Quien graba ya tocó la página (E o el botón): el navegador deja arrancar el audio.
    void this.ctx.resume().catch(() => undefined);
    this.dest = this.ctx.createMediaStreamDestination();
    this.rec = new MediaRecorder(this.dest.stream, format ? { mimeType: format.mime } : undefined);
    this.rec.ondataavailable = (e) => e.data.size > 0 && this.chunks.push(e.data);
    this.rec.start(1000);
  }

  /** Arranca a grabar (null si este navegador no puede: sin MediaRecorder o sin audio). */
  static start(startedAt: number): PodcastRecorder | null {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || typeof AudioContext === "undefined") return null;
    try {
      return new PodcastRecorder(startedAt);
    } catch (err) {
      console.warn("No se pudo empezar a grabar", err);
      return null;
    }
  }

  /** Deja en la mezcla las voces de estas personas (null = la mía) y saca las de quien ya no está. */
  sync(identities: (string | null)[]) {
    if (this.stopped) return;
    const want = new Map<string, MediaStreamTrack>();
    for (const id of identities) {
      const track = media.audioTrack(id);
      if (track && track.readyState === "live") want.set(track.id, track);
    }
    for (const [id, source] of this.sources)
      if (!want.has(id)) {
        source.disconnect();
        this.sources.delete(id);
      }
    for (const [id, track] of want) {
      if (this.sources.has(id)) continue;
      const source = this.ctx.createMediaStreamSource(new MediaStream([track]));
      source.connect(this.dest);
      this.sources.set(id, source);
    }
  }

  /** Detiene la grabación y descarga el archivo (si se grabó algo). */
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    const finish = () => {
      for (const s of this.sources.values()) s.disconnect();
      this.sources.clear();
      void this.ctx.close().catch(() => undefined);
      if (!this.chunks.length) return;
      const blob = new Blob(this.chunks, { type: this.rec.mimeType || "audio/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = podcastFileName(this.startedAt, this.ext);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };
    if (this.rec.state === "inactive") return finish();
    this.rec.onstop = finish;
    this.rec.stop();
  }
}
