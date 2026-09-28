// El Man del Sombrero: la sala decide si anda por ahí (sus horas del reloj del juego o la tormenta) y en
// qué escondite (uno por día del juego, distinto al de ayer). Lo pone en `state.sombrero` y lo ve todo el
// mundo. Las reglas puras están en @hyvento/shared/sombrero.
import { nextHideout, SOMBRERO, SOMBRERO_HIDEOUTS, sombreroOut, type GameTime, type Hideout, type Weather } from "@hyvento/shared";
import type { SombreroState } from "../state";

export interface SombreroDeps {
  state: SombreroState;
  /** Hora del juego ahora (el reloj de la sala). */
  time: () => GameTime;
  weather: () => Weather;
  /** Entero en [0, n) (los tests lo fijan). */
  random: (n: number) => number;
  /** Llegó o se fue (para el humito en el cliente, que lo ve por el estado). */
  onChange?: (present: boolean, hideout: Hideout) => void;
}

export class ManDelSombrero {
  private day = -1;
  private index = -1;

  constructor(private readonly deps: SombreroDeps) {}

  /** Escondite de hoy (null hasta el primer `refresh`). */
  get hideout(): Hideout | null {
    return SOMBRERO_HIDEOUTS[this.index] ?? null;
  }

  get present() {
    return this.deps.state.present;
  }

  /** Revisa la hora y el clima: cambia de escondite al empezar un día nuevo y aparece o se va. */
  refresh() {
    const t = this.deps.time();
    const st = this.deps.state;
    if (t.day !== this.day) {
      this.day = t.day;
      this.index = nextHideout(this.index, this.deps.random);
      const h = SOMBRERO_HIDEOUTS[this.index]!;
      // Se muda de noche (o de día): si estaba en un lado, se va de ahí y aparece en el otro.
      if (st.present && st.hideout !== this.index) {
        st.present = false;
        this.deps.onChange?.(false, SOMBRERO_HIDEOUTS[st.hideout] ?? h);
      }
      st.hideout = this.index;
      st.area = h.area;
      st.x = h.x;
      st.y = h.y;
      st.facing = h.facing;
    }
    const out = sombreroOut(t.minuteOfDay, this.deps.weather());
    if (out !== st.present) {
      st.present = out;
      this.deps.onChange?.(out, SOMBRERO_HIDEOUTS[this.index]!);
    }
  }

  /** ¿Esa persona (nivel y pies en px) está lo bastante cerca para hablarle? */
  near(area: string, x: number, y: number, tileSize: number): boolean {
    const h = this.hideout;
    if (!this.present || !h || h.area !== area) return false;
    const cx = (h.x + 0.5) * tileSize;
    const cy = (h.y + 0.5) * tileSize;
    return Math.hypot(cx - x, cy - y) <= SOMBRERO.reachTiles * tileSize;
  }
}
