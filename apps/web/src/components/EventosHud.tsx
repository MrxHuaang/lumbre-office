"use client";

// Lo de los eventos en el HUD: el botón del modo foco (con su contador), el aviso "Hoy cumple X" con el
// botón para felicitar y el confeti (al entrar el día de un cumpleaños o cuando te felicitan).
import { focusTomato, partyHat } from "@hyvento/map/art";
import { BIRTHDAY, FOCUS_PRESETS, FOCUS_PRESET_IDS } from "@hyvento/shared";
import { useEffect, useRef, useState } from "react";
import { formatClock, PHASE_LABEL, startFocus, stopFocus, useFocusClock, useFocusStore } from "@/game/focus";
import { sendCongrats } from "@/game/network";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { ArtImage } from "./casino/PixelArt";

/** El tomate del HUD: sin foco abre las duraciones; con foco, el contador discreto y "Dejar". */
export function FocusChip() {
  const { phase, running, leftMs } = useFocusClock();
  const preset = useFocusStore((s) => s.preset);
  const setPreset = useFocusStore((s) => s.setPreset);
  const connected = useOfficeStore((s) => Boolean(s.sessionId && s.players[s.sessionId]));
  const [open, setOpen] = useState(false);
  if (!connected) return null;

  const label = running ? `${PHASE_LABEL[phase]}: quedan ${formatClock(leftMs)}` : "Modo foco (pomodoro)";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        title={label}
        data-on={running && phase === "work" ? "" : undefined}
        className={`cozy-btn h-[34px] gap-1.5 px-2 tabular-nums ${running ? "" : "w-[34px] p-0"}`}
      >
        <ArtImage id="hud-tomate" make={focusTomato} scale={2} alt="" />
        {running && <span className={`text-[13px] ${phase === "break" ? "text-cozy-green" : ""}`}>{formatClock(leftMs)}</span>}
      </button>
      {open && (
        <div className="cozy-panel absolute top-full left-0 z-30 mt-3 w-60 space-y-2 p-3 text-[13px]">
          {running ? (
            <>
              <p className="font-semibold">{phase === "work" ? "Estás en foco" : "Descanso"}</p>
              <p className="text-[12px] leading-snug text-cozy-ink-soft">
                {phase === "work" ? "No molestar, chat en silencio y tu puerta cerrada. Si sales de tu oficina, se cancela." : "Estírate, toma agua. Después, otro bloque."}
              </p>
              <div className="flex gap-2">
                {phase === "break" && (
                  <button type="button" className="cozy-btn cozy-btn-primary px-3 py-1 text-[13px]" onClick={() => (startFocus(), setOpen(false))}>
                    Otro bloque
                  </button>
                )}
                <button type="button" className="cozy-btn px-3 py-1 text-[13px]" onClick={() => (stopFocus(), setOpen(false))}>
                  {phase === "work" ? "Dejar (sin puntos)" : "Terminar descanso"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold">Modo foco</p>
              <p className="text-[12px] leading-snug text-cozy-ink-soft">
                Pomodoro: te pone en &quot;No molestar&quot;, silencia el chat y, si estás en tu oficina, cierra la puerta. Completarlo da puntos.
              </p>
              <div className="flex gap-2" role="group" aria-label="Duración">
                {FOCUS_PRESET_IDS.map((id) => (
                  <button key={id} type="button" aria-pressed={preset === id} onClick={() => setPreset(id)} className="cozy-btn px-2.5 py-1 text-[12px]">
                    {FOCUS_PRESETS[id].label}
                  </button>
                ))}
              </div>
              <button type="button" className="cozy-btn cozy-btn-primary w-full py-1.5 text-[13px]" onClick={() => (startFocus(), setOpen(false))}>
                Empezar {FOCUS_PRESETS[preset].workMin} min
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** "Hoy cumple X": con el botón para felicitar (una vez por persona; a uno mismo no). */
export function BirthdayChip() {
  const birthdays = useOfficeStore((s) => s.birthdays);
  const me = useOfficeStore(selectMyUserId);
  const congratulated = useOfficeStore((s) => s.congratulated);
  const people = Object.entries(birthdays);
  if (people.length === 0) return null;
  const names = people.map(([id, name]) => (id === me ? "tú" : name));
  const text = names.length === 1 ? (people[0]![0] === me ? "¡Hoy es tu cumpleaños!" : `Hoy cumple ${names[0]}`) : `Hoy cumplen ${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
  const toCongratulate = people.filter(([id]) => id !== me && !congratulated[id]);
  return (
    <div className="cozy-chip flex items-center gap-2 px-2.5 py-1" role="status">
      <ArtImage id="hud-gorrito" make={partyHat} scale={2} alt="" />
      <span>{text}</span>
      {toCongratulate.map(([id, name]) => (
        <button
          key={id}
          type="button"
          className="cozy-btn cozy-btn-primary px-2 py-0.5 text-[12px]"
          title={`Desearle feliz cumpleaños a ${name} (le da ${BIRTHDAY.congratsPoints} puntos)`}
          onClick={() => {
            sendCongrats(id);
            useOfficeStore.getState().markCongratulated(id);
          }}
        >
          {toCongratulate.length > 1 ? `Felicitar a ${name}` : "Felicitar"}
        </button>
      ))}
    </div>
  );
}

const CONFETTI = ["#ff5fd2", "#f3d672", "#86b8e6", "#8cc653", "#9459ba", "#dd8a62"];

/** Lluvia de papelitos cuadrados sobre la pantalla (sin bloquear clics); nada si se prefiere menos movimiento. */
export function Confetti() {
  const at = useOfficeStore((s) => s.confetti);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!at || !root) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const bits: HTMLSpanElement[] = [];
    for (let i = 0; i < 70; i++) {
      const el = document.createElement("span");
      const size = 4 + (i % 3) * 2;
      el.style.cssText = `position:absolute;top:-12px;left:${Math.random() * 100}%;width:${size}px;height:${size * (i % 2 ? 1 : 0.6)}px;background:${CONFETTI[i % CONFETTI.length]};box-shadow:1px 1px 0 rgb(20 10 24 / .35)`;
      root.appendChild(el);
      bits.push(el);
      const drift = (Math.random() - 0.5) * 160;
      el.animate(
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${drift}px, ${window.innerHeight * (0.7 + Math.random() * 0.4)}px) rotate(${Math.random() * 720}deg)`, opacity: 0.2 },
        ],
        { duration: BIRTHDAY.confettiMs * (0.55 + Math.random() * 0.45), delay: Math.random() * 900, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" },
      );
    }
    const t = setTimeout(() => bits.forEach((b) => b.remove()), BIRTHDAY.confettiMs + 1000);
    return () => {
      clearTimeout(t);
      bits.forEach((b) => b.remove());
    };
  }, [at]);
  return <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden" />;
}
