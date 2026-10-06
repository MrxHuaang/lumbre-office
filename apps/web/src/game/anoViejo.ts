// El Año viejo en el navegador (las reglas las decide el servidor, rooms/anoViejo.ts): el estado del muñeco,
// la quema, las campanadas y los testamentos (de `state.anoViejo`), lo mío (aportes, agüeros, la vuelta de
// la maleta, las uvas), los avisos, la F con una uva en la mano, la E junto a la paja o el aserrín, las
// campanadas que suenan a su hora y el resumen del año que sale después de la cuenta regresiva. El dibujo
// está en anoViejoLayer.ts y los paneles en components/AnoViejoPanel.tsx.
import {
  ANO_VIEJO_BUY_ERROR_TEXT,
  ANO_VIEJO_ID,
  ANO_VIEJO_MSG,
  UVA,
  anoViejoNoticeText,
  anoViejoShopItem,
  type AnoViejoBuyResult,
  type AnoViejoMine,
  type AnoViejoNotice,
  type Campanadas,
  type ResumenAno,
} from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import { create } from "zustand";
import { useCineStore } from "./cinematicas/store";
import { playCineSound } from "./cinematicas/sonidos";
import { serverNow } from "./club/store";
import { getRoom, onInteract, onRoom, type OfficeRoom } from "./network";
import { useOfficeStore } from "./store";

export interface TestamentoItem {
  userId: string;
  name: string;
  text: string;
  at: number;
}

interface AnoViejoStore {
  prendas: number;
  rellenos: number;
  etapa: number;
  /** Cuándo empezó la quema (ms del servidor; 0 = todavía no). */
  quemadoAt: number;
  campanadas: Campanadas | null;
  testamentos: TestamentoItem[];
  mine: AnoViejoMine;
  /** La última respuesta del puesto (suelta el botón del panel). */
  lastBuy: (AnoViejoBuyResult & { seq: number }) | null;
  /** El resumen del año que llegó (se muestra al terminar la cuenta regresiva). */
  resumen: ResumenAno | null;
}

const MINE_VACIO: AnoViejoMine = { aportes: 0, agueros: [], testamento: null, maleta: null, uvas: 0 };

export const useAnoViejoStore = create<AnoViejoStore>(() => ({
  prendas: 0,
  rellenos: 0,
  etapa: 0,
  quemadoAt: 0,
  campanadas: null,
  testamentos: [],
  mine: MINE_VACIO,
  lastBuy: null,
  resumen: null,
}));

/** ¿Está abierto el Año viejo? */
export function anoViejoAbierto(): boolean {
  const f = useOfficeStore.getState().festival;
  return f.id === ANO_VIEJO_ID && f.fase === "fiesta";
}

/** Lo que tengo en la mano (el dibujo, que para estos objetos es su id). */
function myHeld(): string {
  const s = useOfficeStore.getState();
  return (s.sessionId && s.players[s.sessionId]?.held) || "";
}

export const sendAnoViejoBuy = (item: string) => getRoom()?.send(ANO_VIEJO_MSG.buy, { item });
export const sendAporte = (item: string) => getRoom()?.send(ANO_VIEJO_MSG.aportar, { item });
export const sendTestamento = (text: string) => getRoom()?.send(ANO_VIEJO_MSG.testamento, { text });

/**
 * F con una uva en la mano en el Año viejo: se la come (el servidor dice si fue con su campanada). Las uvas
 * no se comen con la F de siempre: solo con las campanadas. Devuelve si la usó.
 */
export function anoViejoKey(key: "e" | "f"): boolean {
  if (key !== "f" || myHeld() !== UVA || useOfficeStore.getState().festival.id !== ANO_VIEJO_ID) return false;
  getRoom()?.send(ANO_VIEJO_MSG.uva, {});
  return true;
}

// ---------- Las campanadas ----------

let bellTimers: ReturnType<typeof setTimeout>[] = [];
let bellsFor = 0;

/** Programa las doce campanadas con la hora del servidor (y las quita si se acabaron o cambiaron). */
function scheduleBells(c: Campanadas | null) {
  if ((c?.inicio ?? 0) === bellsFor) return;
  bellTimers.forEach(clearTimeout);
  bellTimers = [];
  bellsFor = c?.inicio ?? 0;
  if (!c) return;
  const offset = serverNow() - Date.now();
  for (let k = 0; k < c.n; k++) {
    const wait = c.inicio + k * c.intervalo - offset - Date.now();
    if (wait < -200) continue;
    bellTimers.push(
      setTimeout(() => {
        // Solo suenan en el jardín (donde está el puesto y la gente).
        if (useOfficeStore.getState().area !== "jardin") return;
        playCineSound("campanada");
        useAnoViejoStore.setState({ campanadas: { ...c } });
      }, Math.max(0, wait)),
    );
  }
}

/** La campanada que va (1..12) o 0 si todavía no suena la primera; null si no hay campanadas. */
export function campanadaActual(c: Campanadas | null, now = serverNow()): number | null {
  if (!c) return null;
  if (now < c.inicio - 200) return 0;
  return Math.min(c.n, Math.floor((now - c.inicio) / c.intervalo) + 1);
}

// ---------- El estado y los mensajes ----------

interface AnoViejoStateView {
  prendas: number;
  rellenos: number;
  etapa: number;
  quemadoAt: number;
  campanadasInicio: number;
  campanadasIntervalo: number;
  campanadasN: number;
  testamentos: Map<string, { name: string; text: string; at: number }>;
}

const GOOD = new Set<AnoViejoNotice["code"]>(["aporte", "listo", "testamento", "relleno", "uva", "uvasListas", "maletaSalida", "maletaParada", "maletaLlegada", "aguero"]);
let seq = 0;

function bindAnoViejo(r: OfficeRoom) {
  const $ = getStateCallbacks(r);
  let queued = false;
  const sync = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      const a = (r.state as unknown as { anoViejo?: AnoViejoStateView }).anoViejo;
      if (!a) return;
      const testamentos: TestamentoItem[] = [];
      a.testamentos.forEach((t, userId) => testamentos.push({ userId, name: t.name, text: t.text, at: t.at }));
      testamentos.sort((x, y) => y.at - x.at);
      const campanadas = a.campanadasN ? { inicio: a.campanadasInicio, intervalo: a.campanadasIntervalo, n: a.campanadasN } : null;
      useAnoViejoStore.setState({ prendas: a.prendas, rellenos: a.rellenos, etapa: a.etapa, quemadoAt: a.quemadoAt, campanadas, testamentos });
      scheduleBells(campanadas);
    });
  };
  $(r.state as never).listen("anoViejo" as never, ((a: AnoViejoStateView | undefined) => {
    if (!a) return;
    const a$ = $(a as never) as unknown as {
      listen(k: string, cb: () => void): void;
      testamentos: { onAdd(cb: () => void): void; onRemove(cb: () => void): void };
    };
    for (const k of ["prendas", "rellenos", "etapa", "quemadoAt", "campanadasInicio", "campanadasN"]) a$.listen(k, sync);
    a$.testamentos.onAdd(sync);
    a$.testamentos.onRemove(sync);
    sync();
  }) as never);
  r.onMessage(ANO_VIEJO_MSG.notice, (n: AnoViejoNotice) => {
    // Las uvas una por una no llenan la pantalla de avisos: el contador lo dice.
    if (n.code === "uva" || n.code === "uvaEspera") return;
    useOfficeStore.getState().notify(anoViejoNoticeText(n), GOOD.has(n.code) ? "success" : "info");
  });
  r.onMessage(ANO_VIEJO_MSG.mine, (m: AnoViejoMine) => useAnoViejoStore.setState({ mine: m }));
  r.onMessage(ANO_VIEJO_MSG.buyResult, (res: AnoViejoBuyResult) => {
    useAnoViejoStore.setState({ lastBuy: { ...res, seq: ++seq } });
    const store = useOfficeStore.getState();
    if (!res.ok) return store.notify(ANO_VIEJO_BUY_ERROR_TEXT[res.error], "warning");
    store.notify(`${anoViejoShopItem(res.item)?.name ?? "Listo"}: a la mochila.`, "success");
  });
  // El resumen llega con el año nuevo: se abre cuando termina lo que se está viendo (la cuenta regresiva).
  r.onMessage(ANO_VIEJO_MSG.resumen, (res: ResumenAno) => {
    useAnoViejoStore.setState({ resumen: res });
    const open = () => useOfficeStore.getState().openPanel("anoViejoResumen", false);
    if (!useCineStore.getState().playing) return open();
    const unsub = useCineStore.subscribe((s) => {
      if (s.playing) return;
      unsub();
      open();
    });
  });
  r.send(ANO_VIEJO_MSG.mine, {});
}

if (typeof window !== "undefined") {
  onRoom((r) => bindAnoViejo(r));
  // Junto a la paja del gallinero o al costal de aserrín del taller: E saca relleno (sin panel).
  onInteract("anoViejoRelleno", () => void getRoom()?.send(ANO_VIEJO_MSG.recoger, {}));
  // Al cambiar de festival, lo mío se pide de nuevo.
  useOfficeStore.subscribe((s, prev) => {
    if (s.festival.id === prev.festival.id) return;
    useAnoViejoStore.setState({ mine: MINE_VACIO });
    if (s.festival.id === ANO_VIEJO_ID) getRoom()?.send(ANO_VIEJO_MSG.mine, {});
  });
}
