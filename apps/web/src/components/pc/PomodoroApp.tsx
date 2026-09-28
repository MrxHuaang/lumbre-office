"use client";

import { FOCUS, type PresenceStatus } from "@hyvento/shared";
import { useState } from "react";
import { useOfficeStore } from "@/game/store";
import { COZY, STATUS_HEX } from "@/lib/cozy";
import { TomatoIcon } from "./icons";
import {
  ALERT_TEXT,
  PHASE_LABEL,
  POMODORO_PRESETS,
  askNotificationPermission,
  formatClock,
  notificationsSupported,
  startFocus,
  stopFocus,
  usePomodoro,
  usePomodoroClock,
  type PomodoroPhase,
  type PomodoroPresetId,
} from "./pomodoro";

const STATUS_LABEL: Record<PresenceStatus, string> = {
  available: "Disponible",
  busy: "Ocupado",
  dnd: "No molestar",
  away: "Ausente",
};

/** Tinta de cada fase: rojo tomate para enfocarse, verde para descansar. */
export const PHASE_INK: Record<PomodoroPhase, string> = { work: COZY.red, break: COZY.green };

const BLOCKS = 20;

type Permission = NotificationPermission | "unsupported";
const readPermission = (): Permission => (notificationsSupported() ? Notification.permission : "unsupported");

export function PomodoroApp() {
  const { phase, preset, running, leftMs, totalMs } = usePomodoroClock();
  const { completed, alert, setPreset, dismissAlert } = usePomodoro();
  const myStatus = useOfficeStore((s) => (s.sessionId ? s.players[s.sessionId]?.status : undefined));
  const [permission, setPermission] = useState<Permission>(readPermission);

  const filled = Math.round((1 - leftMs / totalMs) * BLOCKS);
  const ink = PHASE_INK[phase];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-cozy-paper-light">
      {alert && (
        <div role="alert" className="flex shrink-0 items-start gap-2 border-b-2 border-cozy-frame bg-cozy-paper-dark px-3 py-2">
          <TomatoIcon size={22} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">{ALERT_TEXT[alert].title}</p>
            <p className="text-[12px] leading-snug text-cozy-ink-soft">{ALERT_TEXT[alert].body}</p>
          </div>
          <button type="button" onClick={dismissAlert} className="cozy-btn px-2 py-1 text-[12px]">
            Entendido
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-4">
        <span
          className="border-2 border-cozy-frame px-2.5 py-0.5 text-[13px] font-semibold text-cozy-paper-light"
          style={{ background: ink }}
        >
          {PHASE_LABEL[phase]}
          {!running && " · listo para empezar"}
        </span>

        <p className="text-[64px] leading-none font-semibold tabular-nums" aria-live="off" style={{ textShadow: `3px 3px 0 ${COZY.paperDark}` }}>
          {formatClock(leftMs)}
        </p>

        {/* Barra de bloques (como la del arranque del PC): cuánto va del bloque. */}
        <div
          role="progressbar"
          aria-label={`Avance del bloque de ${PHASE_LABEL[phase].toLowerCase()}`}
          aria-valuemin={0}
          aria-valuemax={BLOCKS}
          aria-valuenow={filled}
          className="flex h-5 w-full max-w-[260px] gap-[2px] border-2 border-cozy-frame bg-cozy-paper p-[2px]"
        >
          {Array.from({ length: BLOCKS }, (_, i) => (
            <span key={i} className="h-full flex-1" style={{ background: i < filled ? ink : "transparent" }} />
          ))}
        </div>

        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {!running || phase === "break" ? (
            <button type="button" onClick={startFocus} className="cozy-btn cozy-btn-primary min-w-24 px-4 py-1.5 text-[14px]">
              {phase === "break" ? "Otro bloque" : "Iniciar"}
            </button>
          ) : null}
          {running && (
            <button
              type="button"
              onClick={stopFocus}
              title={phase === "work" ? "Dejar el bloque (no da puntos)" : "Terminar el descanso"}
              className="cozy-btn px-3 py-1.5 text-[13px]"
            >
              {phase === "work" ? "Dejar" : "Saltar descanso"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-[12px]" role="group" aria-label="Duración">
          <span className="text-cozy-ink-soft">Duración</span>
          {(Object.keys(POMODORO_PRESETS) as PomodoroPresetId[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={preset === id}
              disabled={running && phase === "work"}
              title={`${POMODORO_PRESETS[id].workMin} min de enfoque y ${POMODORO_PRESETS[id].breakMin} de descanso`}
              onClick={() => setPreset(id)}
              className="cozy-btn px-2.5 py-1 text-[12px]"
            >
              {POMODORO_PRESETS[id].label}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 space-y-1 border-t-2 border-dashed border-cozy-frame/30 px-3 py-2 text-[11.5px] leading-snug text-cozy-ink-soft">
        {myStatus && (
          <p className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 border-[1.5px] border-cozy-frame" style={{ background: STATUS_HEX[myStatus] }} />
            Tu estado: <b className="font-semibold text-cozy-ink">{STATUS_LABEL[myStatus]}</b>
          </p>
        )}
        <p>
          Mientras te enfocas quedas en &quot;No molestar&quot;, el chat no suena y, en tu oficina, la puerta se cierra. Cada bloque completo da{" "}
          {FOCUS.points} puntos (hasta {FOCUS.dailyCap} por día). Si sales de tu oficina, el bloque se cancela.
        </p>
        {permission === "default" && (
          <button
            type="button"
            onClick={() => void askNotificationPermission().then(() => setPermission(readPermission()))}
            className="underline decoration-dotted underline-offset-2 hover:text-cozy-ink"
          >
            Avisarme también con notificaciones del navegador
          </button>
        )}
        {permission === "granted" && <p>Al terminar cada bloque te aviso con una notificación.</p>}
        {(permission === "denied" || permission === "unsupported") && <p>Al terminar cada bloque suena una campanita y te aviso aquí.</p>}
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t-2 border-cozy-frame bg-cozy-paper px-3 py-1 text-[11px] text-cozy-ink-soft">
        <span>
          {completed} {completed === 1 ? "bloque terminado" : "bloques terminados"}
        </span>
        <span className="flex items-center" aria-hidden>
          {Array.from({ length: Math.min(completed, 8) }, (_, i) => (
            <TomatoIcon key={i} size={14} />
          ))}
          {completed > 8 && <span className="ml-0.5">+{completed - 8}</span>}
        </span>
      </footer>
    </div>
  );
}

/** Reloj de la barra de tareas: aparece mientras hay un bloque (o su descanso) en curso. */
export function PomodoroTaskbarClock({ onOpen }: { onOpen: () => void }) {
  const { phase, running, leftMs } = usePomodoroClock();
  if (!running) return null;
  const label = `${PHASE_LABEL[phase]}: quedan ${formatClock(leftMs)}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={label}
      aria-label={label}
      className="cozy-chip flex h-8 shrink-0 items-center gap-1.5 px-2 text-[13px] tabular-nums"
      style={{ boxShadow: `inset 0 -3px 0 ${PHASE_INK[phase]}, 2px 2px 0 rgb(20 10 24 / 0.4)` }}
    >
      <TomatoIcon size={16} />
      <span>{formatClock(leftMs)}</span>
    </button>
  );
}
