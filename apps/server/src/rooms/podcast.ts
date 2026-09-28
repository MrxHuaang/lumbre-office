// El estudio de grabación (nivel `podcast`): el estado ("pidiendo permiso", "grabando") y el permiso de
// cada uno de los de adentro. El audio no pasa por aquí: lo graba el navegador de quien pidió grabar.
// Cualquier cambio que rompa el acuerdo (alguien dice que no, lo retira, entra alguien nuevo, sale quien
// graba) deja de grabar al instante; mientras se pide permiso o se graba la puerta no deja entrar.
import { PODCAST, podcastBlock, type PodcastBlock, type PodcastNotice, type PodcastPhase } from "@hyvento/shared";
import type { PodcastState } from "../state";

/** Alguien que está adentro del estudio. */
export interface Inside {
  sessionId: string;
  userId: string;
  name: string;
}

/** Avisos que manda la sala: a quiénes (sessionIds) y cuál. */
export type PodcastNotices = { to: string[]; notice: PodcastNotice }[];

export class Podcast {
  /** Cuándo pidió grabar cada persona (pausa entre pedidos). */
  private askAt = new Map<string, number>();

  constructor(private readonly state: PodcastState) {}

  get phase(): PodcastPhase {
    return this.state.phase as PodcastPhase;
  }

  /** ¿Puede entrar `userId` por la puerta? Al estudio no se entra lleno ni mientras se pide permiso o se graba. */
  canEnter(userId: string, inside: Inside[]): PodcastBlock | null {
    return podcastBlock(inside.filter((p) => p.userId !== userId).length, this.phase);
  }

  /** "E · Grabar": pide permiso a todos los de adentro (quien lo pide ya aceptó). */
  start(who: Inside, inside: Inside[], now: number): PodcastNotices {
    const me = [who.sessionId];
    if (!inside.some((p) => p.userId === who.userId)) return [{ to: me, notice: { code: "outside" } }];
    if (this.phase !== "idle") return [{ to: me, notice: { code: "busy" } }];
    if (now - (this.askAt.get(who.userId) ?? -Infinity) < PODCAST.askCooldownMs) return [{ to: me, notice: { code: "wait" } }];
    this.askAt.set(who.userId, now);
    this.state.phase = "asking";
    this.state.host = who.userId;
    this.state.hostName = who.name;
    this.state.askedAt = now;
    this.state.startedAt = 0;
    this.state.consents.clear();
    for (const p of inside) this.state.consents.set(p.userId, p.userId === who.userId);
    return this.sync(inside, now);
  }

  /** Aceptar o no que se grabe la voz propia. Decir que no (también grabando) no deja grabar. */
  consent(who: Inside, accept: boolean, inside: Inside[], now: number): PodcastNotices {
    if (this.phase === "idle" || !this.state.consents.has(who.userId) || !inside.some((p) => p.userId === who.userId)) return [];
    if (!accept) {
      const out = [{ to: inside.map((p) => p.sessionId), notice: { code: this.phase === "recording" ? "stopped" : "declined", name: who.name } satisfies PodcastNotice }];
      this.reset();
      return out;
    }
    this.state.consents.set(who.userId, true);
    return this.sync(inside, now);
  }

  /** Detener (cualquiera de adentro: es retirar el permiso). */
  stop(who: Inside, inside: Inside[]): PodcastNotices {
    if (this.phase === "idle" || !inside.some((p) => p.userId === who.userId)) return [];
    this.reset();
    return [{ to: inside.map((p) => p.sessionId), notice: { code: "stopped", name: who.name } }];
  }

  /**
   * Revisa el acuerdo con los que están adentro ahora (cada medio segundo y después de cada cambio):
   * si todos aceptaron, se graba; si entró alguien sin permiso o salió quien graba, se detiene; y los
   * plazos (esperar respuestas, la hora máxima de grabación).
   */
  sync(inside: Inside[], now: number): PodcastNotices {
    if (this.phase === "idle") return [];
    const all = inside.map((p) => p.sessionId);
    const stop = (notice: PodcastNotice): PodcastNotices => {
      this.reset();
      return all.length ? [{ to: all, notice }] : [];
    };
    if (!inside.length) return stop({ code: "stopped" });
    if (!inside.some((p) => p.userId === this.state.host)) return stop({ code: "hostLeft", name: this.state.hostName });
    const stranger = inside.find((p) => !this.state.consents.has(p.userId));
    if (stranger) return stop({ code: "joined", name: stranger.name });
    // Quien salió ya no cuenta (si vuelve a entrar, es alguien nuevo).
    for (const userId of [...this.state.consents.keys()]) if (!inside.some((p) => p.userId === userId)) this.state.consents.delete(userId);
    if (this.phase === "asking") {
      if ([...this.state.consents.values()].every(Boolean)) {
        this.state.phase = "recording";
        this.state.startedAt = now;
        return [{ to: all, notice: { code: "started" } }];
      }
      if (now - this.state.askedAt >= PODCAST.askTimeoutMs) return stop({ code: "timeout" });
      return [];
    }
    if (now - this.state.startedAt >= PODCAST.maxRecordMs) return stop({ code: "tooLong" });
    return [];
  }

  private reset() {
    this.state.phase = "idle";
    this.state.host = "";
    this.state.hostName = "";
    this.state.askedAt = 0;
    this.state.startedAt = 0;
    this.state.consents.clear();
  }

  forget(userId: string) {
    this.askAt.delete(userId);
  }
}
