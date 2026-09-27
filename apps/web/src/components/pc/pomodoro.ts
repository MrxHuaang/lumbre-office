// Temporizador Pomodoro ("Enfoque") del PC. Vive en un store fuera de React para que siga corriendo
// aunque se cierre la ventana o se apague el PC: guarda cuándo termina el bloque (timestamp), no cuenta ticks.
import type { PresenceStatus } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { sendStatus } from "@/game/network";
import { useOfficeStore } from "@/game/store";

export type PomodoroPhase = "work" | "break";
export type PomodoroPresetId = "25-5" | "50-10";

export const POMODORO_PRESETS: Record<PomodoroPresetId, { label: string; workMin: number; breakMin: number }> = {
  "25-5": { label: "25 / 5", workMin: 25, breakMin: 5 },
  "50-10": { label: "50 / 10", workMin: 50, breakMin: 10 },
};

export const PHASE_LABEL: Record<PomodoroPhase, string> = { work: "Enfoque", break: "Descanso" };

export const phaseMs = (preset: PomodoroPresetId, phase: PomodoroPhase) =>
  (phase === "work" ? POMODORO_PRESETS[preset].workMin : POMODORO_PRESETS[preset].breakMin) * 60_000;

interface PomodoroState {
  preset: PomodoroPresetId;
  phase: PomodoroPhase;
  /** Corriendo: momento (ms) en que termina el bloque. En pausa o detenido: null. */
  endsAt: number | null;
  /** Lo que falta cuando no corre (en pausa o sin empezar). */
  remainingMs: number;
  /** Bloques de enfoque terminados en esta visita a la cabaña. */
  completed: number;
  /** Aviso pendiente en la ventana (cuando el navegador no deja mostrar notificaciones). */
  alert: PomodoroPhase | null;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  setPreset: (preset: PomodoroPresetId) => void;
  dismissAlert: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** Estado que tenía la persona antes de ponerla en "Ocupado" (null = no lo tocamos). */
let prevStatus: PresenceStatus | null = null;

function myStatus(): PresenceStatus | null {
  const s = useOfficeStore.getState();
  return s.sessionId ? (s.players[s.sessionId]?.status ?? null) : null;
}

/** Al empezar un bloque de enfoque: "Ocupado", recordando el estado de antes. */
function claimBusy() {
  if (prevStatus) return;
  const status = myStatus();
  // Sin conexión, o ya ocupado / no molestar: no hay nada que cambiar (ni que devolver después).
  if (!status || status === "busy" || status === "dnd") return;
  prevStatus = status;
  sendStatus("busy");
}

/** Al terminar o pausar: vuelve al estado de antes, salvo que la persona lo haya cambiado a mano. */
function releaseBusy() {
  if (!prevStatus) return;
  const status = myStatus();
  // Si todavía no llegó el eco de "busy", el estado sigue siendo el de antes: mandarlo igual no hace daño.
  if (status === "busy" || status === prevStatus) sendStatus(prevStatus);
  prevStatus = null;
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

export const ALERT_TEXT: Record<PomodoroPhase, { title: string; body: string }> = {
  work: { title: "¡Bloque de enfoque terminado!", body: "Buen trabajo. Tómate un descanso: el reloj ya está corriendo." },
  break: { title: "Se acabó el descanso", body: "Cuando quieras, empieza otro bloque de enfoque." },
};

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

function announce(ended: PomodoroPhase) {
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
  if (!shown) usePomodoro.setState({ alert: ended });
}

// ---------- Reloj ----------

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(settle, Math.max(0, ms));
}

function unschedule() {
  if (timer) clearTimeout(timer);
  timer = null;
}

/** Se llama cuando debería haber terminado el bloque: pasa a la fase siguiente y avisa. */
function settle() {
  timer = null;
  const { preset, phase, endsAt, completed } = usePomodoro.getState();
  if (endsAt === null) return;
  const now = Date.now();
  if (now < endsAt) return schedule(endsAt - now); // el navegador despertó antes de tiempo

  if (phase === "work") {
    releaseBusy();
    // El descanso cuenta desde que terminó el enfoque (si el navegador durmió, puede que ya haya pasado).
    const breakEnds = endsAt + phaseMs(preset, "break");
    if (now < breakEnds) {
      usePomodoro.setState({ phase: "break", endsAt: breakEnds, remainingMs: phaseMs(preset, "break"), completed: completed + 1 });
      schedule(breakEnds - now);
      announce("work");
      return;
    }
    usePomodoro.setState({ phase: "work", endsAt: null, remainingMs: phaseMs(preset, "work"), completed: completed + 1 });
    announce("break");
    return;
  }
  // Tras el descanso no arranca solo: el siguiente enfoque (y el "Ocupado") lo empieza la persona.
  usePomodoro.setState({ phase: "work", endsAt: null, remainingMs: phaseMs(preset, "work") });
  announce("break");
}

export const usePomodoro = create<PomodoroState>((set, get) => ({
  preset: "25-5",
  phase: "work",
  endsAt: null,
  remainingMs: phaseMs("25-5", "work"),
  completed: 0,
  alert: null,

  start: () => {
    const { endsAt, remainingMs, phase } = get();
    if (endsAt !== null) return;
    unlockAudio();
    if (phase === "work") claimBusy();
    const ends = Date.now() + remainingMs;
    set({ endsAt: ends, alert: null });
    schedule(remainingMs);
  },

  pause: () => {
    const { endsAt } = get();
    if (endsAt === null) return;
    unschedule();
    releaseBusy();
    set({ endsAt: null, remainingMs: Math.max(0, endsAt - Date.now()) });
  },

  reset: () => {
    unschedule();
    releaseBusy();
    set((s) => ({ phase: "work", endsAt: null, remainingMs: phaseMs(s.preset, "work"), alert: null }));
  },

  /** Pasar a la fase siguiente sin esperar; si estaba corriendo, la siguiente también corre. */
  skip: () => {
    const { phase, preset, endsAt } = get();
    const running = endsAt !== null;
    unschedule();
    const next: PomodoroPhase = phase === "work" ? "break" : "work";
    if (phase === "work") releaseBusy();
    set({ phase: next, endsAt: null, remainingMs: phaseMs(preset, next), alert: null });
    if (running) get().start();
  },

  setPreset: (preset) => {
    if (get().endsAt !== null) return; // no se cambia a mitad de un bloque corriendo
    releaseBusy();
    set({ preset, phase: "work", remainingMs: phaseMs(preset, "work") });
  },

  dismissAlert: () => set({ alert: null }),
}));

/** Pedir permiso para las notificaciones del navegador (tiene que ser desde un clic). */
export async function askNotificationPermission(): Promise<NotificationPermission | null> {
  if (!notificationsSupported()) return null;
  try {
    return await Notification.requestPermission();
  } catch {
    return null;
  }
}

/** Lo que muestra la interfaz: tiempo que falta, total del bloque y si corre. Se refresca solo mientras corre. */
export function usePomodoroClock() {
  const { preset, phase, endsAt, remainingMs } = usePomodoro();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt === null) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  const totalMs = phaseMs(preset, phase);
  const running = endsAt !== null;
  const left = running ? Math.min(totalMs, Math.max(0, endsAt - now)) : remainingMs;
  return { phase, preset, running, leftMs: left, totalMs, started: running || remainingMs < totalMs };
}

/** mm:ss redondeando hacia arriba: arranca en 25:00 y llega a 00:00 justo al terminar. */
export function formatClock(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
