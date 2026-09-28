// La app "Enfoque" del PC es el modo foco de la cabaña: el reloj lo lleva el servidor (ver game/focus.ts).
// Aquí quedan los nombres que usa el escritorio.
export {
  ALERT_TEXT,
  askNotificationPermission,
  formatClock,
  notificationsSupported,
  PHASE_LABEL,
  startFocus,
  stopFocus,
  useFocusClock as usePomodoroClock,
  useFocusStore as usePomodoro,
  type FocusUiPhase as PomodoroPhase,
} from "@/game/focus";
export { FOCUS_PRESETS as POMODORO_PRESETS, type FocusPresetId as PomodoroPresetId } from "@hyvento/shared";
