// Modo foco en el navegador: el reloj lo lleva el servidor (Player.focus y focusEndsAt); aquí solo se
// elige la duración, se muestra lo que falta y se avisa al terminar (campanita y notificación del
// navegador). Lo usan el HUD (el botón del tomate) y la app "Enfoque" del PC.
import { focusMs, FOCUS_PRESETS, type FocusPresetId } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { useCasinoStore } from "./casino";
import { onFocusEvent, sendFocusStart, sendFocusStop } from "./network";
import { useOfficeStore } from "./store";

export type FocusUiPhase = "work" | "break";

export const PHASE_LABEL: Record<FocusUiPhase, string> = { work: "Enfoque", break: "Descanso" };

export const ALERT_TEXT: Record<FocusUiPhase, { title: string; body: string }> = {
  work: { title: "¡Bloque de enfoque terminado!", body: "Buen trabajo. Tómate un descanso: el reloj ya está corriendo." },
  break: { title: "Se acabó el descanso", body: "Cuando quieras, empieza otro bloque de enfoque." },
};

const PRESET_KEY = "hyvento:foco-duracion";

function loadPreset(): FocusPresetId {
  try {
    const v = localStorage.getItem(PRESET_KEY);
    return v && v in FOCUS_PRESETS ? (v as FocusPresetId) : "25-5";
  } catch {
    return "25-5";
  }
}

interface FocusStore {
  /** Duración elegida para el próximo bloque (se recuerda en el navegador). */
  preset: FocusPresetId;
  /** Bloques completados en esta visita. */
  completed: number;
  /** Aviso pendiente en la ventana del PC (si el navegador no deja mostrar notificaciones). */
  alert: FocusUiPhase | null;
  setPreset: (p: FocusPresetId) => void;
  dismissAlert: () => void;
}

export const useFocusStore = create<FocusStore>((set) => ({
  preset: typeof window === "undefined" ? "25-5" : loadPreset(),
  completed: 0,
  alert: null,
  setPreset: (preset) => {
    set({ preset });
    try {
      localStorage.setItem(PRESET_KEY, preset);
    } catch {
      // sin almacenamiento: vale solo para esta visita
    }
  },
  dismissAlert: () => set({ alert: null }),
}));

/** Empezar un bloque con la duración elegida (el servidor pone "No molestar" y cierra la puerta). */
export function startFocus() {
  unlockAudio();
  sendFocusStart(useFocusStore.getState().preset);
}

/** Dejar el bloque (sin puntos) o saltarse el descanso. */
export function stopFocus() {
  sendFocusStop();
}

// ---------- Sonido y aviso ----------

let audioCtx: AudioContext | null = null;

/** El navegador solo deja sonar audio si el contexto se crea/reanuda con un clic: se llama al iniciar. */
function unlockAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    audioCtx ??= new AC();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

/** "Ding" de campanita generado con WebAudio: la nota y dos parciales que se apagan solos. */
export function ding(times = 2) {
  const ac = unlockAudio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.03;
  for (let i = 0; i < times; i++) {
    const t = t0 + i * 0.32;
    for (const [freq, peak] of [
      [988, 0.2],
      [1976, 0.06],
      [2964, 0.025],
    ] as const) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 1.15);
    }
  }
}

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

/** Pedir permiso para las notificaciones del navegador (tiene que ser desde un clic). */
export async function askNotificationPermission(): Promise<NotificationPermission | null> {
  if (!notificationsSupported()) return null;
  try {
    return await Notification.requestPermission();
  } catch {
    return null;
  }
}

function announce(ended: FocusUiPhase) {
  ding(ended === "work" ? 3 : 2);
  let shown = false;
  try {
    if (notificationsSupported() && Notification.permission === "granted") {
      new Notification(ALERT_TEXT[ended].title, { body: ALERT_TEXT[ended].body, tag: "hyvento-enfoque" });
      shown = true;
    }
  } catch {
    // Chrome en Android no deja crear notificaciones desde la página (pide un service worker).
  }
  if (!shown) useFocusStore.setState({ alert: ended });
}

// Lo que avisa el servidor: el bloque completo suma uno y suena; al terminar el descanso, también.
if (typeof window !== "undefined") {
  onFocusEvent((e) => {
    if (e.kind === "done") {
      useFocusStore.setState((s) => ({ completed: s.completed + 1 }));
      announce("work");
    } else if (e.kind === "break-over") announce("break");
  });
}

// ---------- Reloj ----------

/** Lo que muestra la interfaz: fase, lo que falta (con la hora del servidor) y si hay un bloque en curso. */
export function useFocusClock() {
  const me = useOfficeStore((s) => (s.sessionId ? s.players[s.sessionId] : undefined));
  const chosen = useFocusStore((s) => s.preset);
  const offset = useCasinoStore((s) => s.offset);
  const active = Boolean(me?.focus);
  const phase: FocusUiPhase = me?.focus === "break" ? "break" : "work";
  const preset: FocusPresetId = active && me?.focusPreset ? me.focusPreset : chosen;
  const endsAt = active ? (me?.focusEndsAt ?? 0) : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  const totalMs = focusMs(preset, phase);
  const leftMs = endsAt ? Math.min(totalMs, Math.max(0, endsAt - (now + offset))) : totalMs;
  return { phase, preset, running: active, leftMs, totalMs };
}

/** mm:ss redondeando hacia arriba: arranca en 25:00 y llega a 00:00 justo al terminar. */
export function formatClock(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
