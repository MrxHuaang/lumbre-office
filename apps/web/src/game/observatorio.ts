// El observatorio en el navegador: la fogata de malvaviscos (E para meterlo, E para sacarlo) y el
// telescopio (el cielo de noche y la estrella fugaz). Aquí no hay reglas: el servidor mide los tiempos,
// decide la estrella y quién la vio primero; esto solo guarda lo que llega para los paneles y la escena.
import {
  DONENESS_TEXT,
  MARSHMALLOW_ERROR_TEXT,
  OBS_MSG,
  type MarshmallowEvent,
  type ShootingStar,
  type SignalPing,
  type SkyEvent,
} from "@hyvento/shared";
import { create } from "zustand";
import { getRoom, onInteract, onRoom } from "./network";
import { sfx } from "./sfx";
import { useOfficeStore } from "./store";

/** Un malvavisco en el fuego (el propio o el de alguien del nivel): desde cuándo (reloj local) y su calor. */
export interface RoastView {
  startedAt: number;
  heat: number;
}

interface ObservatorioStore {
  /** Malvaviscos al fuego por sessionId (para dibujar el palito en la mano). */
  roasts: Record<string, RoastView>;
  /** El cielo que se ve por el telescopio: null hasta que responde el servidor. */
  sky: { night: boolean } | null;
  /** La estrella que va pasando (con la hora local en que llegó, para animarla). */
  star: (ShootingStar & { seenAt: number }) | null;
  /** Lo último que pasó con la estrella (quién la vio, si llegué tarde). */
  starNote: { text: string; mine: boolean; first: boolean } | null;
  /** Instrumentos que sonaron hace poco en otros niveles (para el radar), con la hora local. */
  pings: (SignalPing & { at: number })[];
}

export const useObservatorio = create<ObservatorioStore>(() => ({ roasts: {}, sky: null, star: null, starNote: null, pings: [] }));

const mySession = () => useOfficeStore.getState().sessionId;

/** ¿Tengo un malvavisco en el fuego? */
export const isRoasting = () => {
  const id = mySession();
  return Boolean(id && useObservatorio.getState().roasts[id]);
};

/** E junto a la fogata: si no hay malvavisco, lo mete; si hay, lo saca. */
export function marshmallowAction() {
  getRoom()?.send(isRoasting() ? OBS_MSG.marshmallowPull : OBS_MSG.marshmallowStart);
}

export function telescopeLook() {
  useObservatorio.setState({ sky: null, star: null, starNote: null });
  getRoom()?.send(OBS_MSG.telescopeLook);
}
export function telescopeClose() {
  getRoom()?.send(OBS_MSG.telescopeClose);
  useObservatorio.setState({ sky: null, star: null, starNote: null });
}
export function spotStar(starId: string) {
  getRoom()?.send(OBS_MSG.starSpot, { starId });
}

function onMarshmallow(e: MarshmallowEvent) {
  const mine = e.sessionId === mySession();
  const notify = useOfficeStore.getState().notify;
  if (e.kind === "error") {
    if (mine) notify(MARSHMALLOW_ERROR_TEXT[e.reason], "info");
    return;
  }
  useObservatorio.setState((s) => {
    const roasts = { ...s.roasts };
    if (e.kind === "started") roasts[e.sessionId] = { startedAt: performance.now(), heat: e.heat };
    else delete roasts[e.sessionId];
    return { roasts };
  });
  if (!mine || e.kind !== "result") return;
  const extra = e.points > 0 ? ` · +${e.points} puntos` : "";
  const kept = e.kept ? " (queda en tu mano)" : "";
  notify(`${DONENESS_TEXT[e.doneness]}${extra}${kept}`, e.doneness === "dorado" ? "success" : "info");
  if (e.doneness === "dorado") sfx.uiOpen();
}

function onSky(e: SkyEvent) {
  if (e.kind === "sky") useObservatorio.setState({ sky: { night: e.night }, star: e.star ? { ...e.star, seenAt: performance.now() } : null });
  else if (e.kind === "star") useObservatorio.setState({ star: { ...e.star, seenAt: performance.now() }, starNote: null });
  else if (e.kind === "spotted")
    useObservatorio.setState({
      starNote: {
        mine: e.mine,
        first: e.first,
        text: e.mine ? (e.first ? "¡La viste primero! Pide un deseo." : "¡La viste! Alguien se te adelantó.") : `${e.name} la vio${e.first ? " primero" : ""}.`,
      },
    });
  else useObservatorio.setState({ starNote: { mine: true, first: false, text: "Se te escapó. Ya pasará otra." } });
}

if (typeof window !== "undefined") {
  onInteract("marshmallow", marshmallowAction);
  onRoom((room) => {
    useObservatorio.setState({ roasts: {}, sky: null, star: null, starNote: null });
    room.onMessage(OBS_MSG.marshmallowEvent, onMarshmallow);
    room.onMessage(OBS_MSG.sky, onSky);
    room.onMessage(OBS_MSG.signal, (e: SignalPing) =>
      useObservatorio.setState((st) => ({ pings: [...st.pings.filter((q) => performance.now() - q.at < 15_000).slice(-20), { ...e, at: performance.now() }] })),
    );
  });
}
