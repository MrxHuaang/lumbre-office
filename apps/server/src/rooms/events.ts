// Eventos del calendario (ver events.ts de @hyvento/shared): quién cumple hoy (se lee de la base una vez
// por día, y otra vez cuando alguien cambia su cumpleaños) y si el club está en modo karaoke. Todo queda en
// `state.events`; las felicitaciones se validan aquí (una por persona, por cumpleañero y por día).
import { eventDay, isBirthdayOn, isKaraokeTime, type CongratsError } from "@hyvento/shared";
import type { GameRepository } from "../repo/types";
import type { EventsState } from "../state";

export interface EventsDeps {
  state: EventsState;
  now: () => number;
  repo: () => GameRepository;
}

export class CabinEvents {
  /** Felicitaciones de hoy: `${desde}>${para}`. */
  private congratulated = new Set<string>();
  private loadedDay = -1;
  private pending: Promise<void> | null = null;

  constructor(private readonly deps: EventsDeps) {}

  /**
   * Al día y a la hora de ahora: el karaoke se prende y se apaga solo; la lista de cumpleaños se relee al
   * cambiar el día (o con `force`, cuando alguien cambió el suyo).
   */
  refresh(force = false): Promise<void> {
    const now = this.deps.now();
    const s = this.deps.state;
    const karaoke = isKaraokeTime(now);
    if (s.karaoke !== karaoke) s.karaoke = karaoke;
    const day = eventDay(now);
    if (!force && day === this.loadedDay) return Promise.resolve();
    if (this.pending && !force) return this.pending;
    const run = this.load(day, now).finally(() => {
      if (this.pending === run) this.pending = null;
    });
    this.pending = run;
    return run;
  }

  private async load(day: number, now: number) {
    const all = await this.deps.repo().listBirthdays().catch((err) => {
      console.error("listBirthdays", err);
      return null;
    });
    if (!all) return;
    const s = this.deps.state;
    if (day !== this.loadedDay) this.congratulated.clear();
    this.loadedDay = day;
    s.day = day;
    const today = new Map(all.filter((b) => isBirthdayOn(b.birthday, now)).map((b) => [b.userId, b.name]));
    for (const id of [...s.birthdays.keys()]) if (!today.has(id)) s.birthdays.delete(id);
    for (const [id, name] of today) if (s.birthdays.get(id) !== name) s.birthdays.set(id, name);
  }

  isBirthday(userId: string) {
    return this.deps.state.birthdays.has(userId);
  }

  /** ¿Puede `from` felicitar a `to` ahora? null = sí (y queda anotado: un doble clic no cuenta dos veces). */
  congratulate(from: string, to: string): CongratsError | null {
    if (from === to) return "self";
    if (!this.isBirthday(to)) return "not-birthday";
    const key = `${from}>${to}`;
    if (this.congratulated.has(key)) return "already";
    this.congratulated.add(key);
    return null;
  }

  /** No se pudo guardar: se puede volver a intentar. */
  undo(from: string, to: string) {
    this.congratulated.delete(`${from}>${to}`);
  }
}
