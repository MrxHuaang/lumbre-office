// Mundo lleno en el navegador: lo que llega del servidor para los muebles nuevos (los avisos de la
// impresora, la ducha y la casita del perro; lo que sale en el tragamonedas, la garra y la rueda) y cómo
// pedirlo. Aquí no hay reglas: el servidor cobra, tira los rodillos, decide si la garra agarra y qué sector
// de la rueda sale; esto solo lo guarda para los paneles.
import {
  CLAW_ERROR_TEXT,
  FORTUNE_ERROR_TEXT,
  FORTUNE_MSG,
  GARRA_MSG,
  MUNDO_MSG,
  mundoNoticeText,
  SLOT_ERROR_TEXT,
  SLOTS_MSG,
  type ClawEvent,
  type FortuneResult,
  type MundoNotice,
  type SlotResult,
} from "@hyvento/shared";
import { create } from "zustand";
import { getRoom, onInteract, onRoom } from "./network";
import { sfx } from "./sfx";
import { useOfficeStore } from "./store";

interface MundoStore {
  /** Lo último del tragamonedas (con un número que cambia en cada respuesta). */
  slot: (SlotResult & { seq: number }) | null;
  /** Lo último de la garra. */
  claw: (ClawEvent & { seq: number }) | null;
  /** La rueda: si ya giré hoy (null = no se sabe todavía) y la última vuelta. */
  fortune: { spun: boolean | null; last: (Extract<FortuneResult, { kind: "spin" }> & { seq: number }) | null };
  /** El asiento de al lado o en el que estoy (su tipo), para la ayuda del bote ("subirte al bote", "Pescar"). */
  seat: { type: string; seated: boolean } | null;
}

let seq = 0;

export const useMundoStore = create<MundoStore>(() => ({ slot: null, claw: null, fortune: { spun: null, last: null }, seat: null }));

/** La escena avisa qué asiento hay al lado (o en cuál estoy sentado). */
export function syncSeat(type: string | null, seated: boolean) {
  const cur = useMundoStore.getState().seat;
  if ((cur?.type ?? null) === type && (cur?.seated ?? false) === seated) return;
  useMundoStore.setState({ seat: type ? { type, seated } : null });
}

const notify = (text: string, tone: "info" | "success" | "warning" = "info") => useOfficeStore.getState().notify(text, tone);

export function sendSlotSpin(bet: number) {
  getRoom()?.send(SLOTS_MSG.spin, { bet });
}
export function sendClawStart() {
  getRoom()?.send(GARRA_MSG.start);
}
export function sendClawDrop(token: string, x: number) {
  getRoom()?.send(GARRA_MSG.drop, { token, x });
}
export function askFortune() {
  useMundoStore.setState((s) => ({ fortune: { ...s.fortune, spun: null } }));
  getRoom()?.send(FORTUNE_MSG.status);
}
export function sendFortuneSpin() {
  getRoom()?.send(FORTUNE_MSG.spin);
}

function onNotice(n: MundoNotice) {
  const good = n.code === "printed" || n.code === "petRest" || n.code === "petEat" || n.code === "dry";
  notify(mundoNoticeText(n), good ? "success" : n.code === "full" ? "warning" : "info");
}

function onSlot(r: SlotResult) {
  if (!r.ok) notify(SLOT_ERROR_TEXT[r.error], "warning");
  useMundoStore.setState({ slot: { ...r, seq: ++seq } });
}

function onClaw(e: ClawEvent) {
  if (e.kind === "error") notify(CLAW_ERROR_TEXT[e.error], "warning");
  useMundoStore.setState({ claw: { ...e, seq: ++seq } });
}

function onFortune(r: FortuneResult) {
  if (r.kind === "error") {
    if (r.error !== "loading") notify(FORTUNE_ERROR_TEXT[r.error], "info");
    if (r.error === "spun") useMundoStore.setState((s) => ({ fortune: { ...s.fortune, spun: true } }));
    return;
  }
  if (r.kind === "status") return useMundoStore.setState((s) => ({ fortune: { ...s.fortune, spun: r.spun } }));
  useMundoStore.setState({ fortune: { spun: true, last: { ...r, seq: ++seq } } });
}

if (typeof window !== "undefined") {
  // Doña Gloria no abre un panel de la escena: la ventana "¿A quién busca?".
  onInteract("reception", () => {
    sfx.uiOpen();
    useOfficeStore.getState().openPanel("reception", true);
  });
  onRoom((room) => {
    useMundoStore.setState({ slot: null, claw: null, fortune: { spun: null, last: null } });
    room.onMessage(MUNDO_MSG.notice, onNotice);
    room.onMessage(SLOTS_MSG.result, onSlot);
    room.onMessage(GARRA_MSG.event, onClaw);
    room.onMessage(FORTUNE_MSG.result, onFortune);
  });
}
