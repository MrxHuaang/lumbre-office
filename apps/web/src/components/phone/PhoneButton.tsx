"use client";

// El botón del celular en el HUD (y las teclas C y Enter). Vive siempre en la cabaña, así que también
// vigila la alarma, cuenta los mensajes sin leer y hace vibrar el ícono aunque el celular esté guardado.
import { useEffect, useState } from "react";
import { playRingtone, stopRingtone } from "@/game/phone/audio";
import { alarmDue, bogotaTime, hhmm } from "@/game/phone/hora";
import { selectChatMuted, usePhoneStore, useUnread } from "@/game/phone/state";
import { RINGTONES, ringtoneById } from "@/game/phone/tonos";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";

function stopAlarm() {
  stopRingtone();
  usePhoneStore.getState().setRinging(false);
}

/** Suena la alarma: el tono elegido (o Para Elisa) tres veces, el celular vibra y queda un aviso. */
function ringAlarm() {
  const s = usePhoneStore.getState();
  const now = bogotaTime();
  s.setPrefs({ alarm: { ...s.alarm, firedOn: now.dayKey } });
  s.setRinging(true);
  s.buzz();
  const tone = ringtoneById(s.tone) ?? RINGTONES[0]!;
  const secs = playRingtone(tone, { repeat: 3 });
  setTimeout(() => usePhoneStore.getState().ringing && stopAlarm(), Math.max(4, secs) * 1000);
  useOfficeStore.getState().notify(`Suena la alarma del celular (${hhmm(s.alarm)})`, "info", { label: "Apagar", run: stopAlarm });
}

export function PhoneButton() {
  const open = usePhoneStore((s) => s.open);
  const ringing = usePhoneStore((s) => s.ringing);
  const buzzAt = usePhoneStore((s) => s.buzzAt);
  const unread = useUnread();
  const [buzzing, setBuzzing] = useState(false);

  // La tecla C lo saca (no mientras se escribe, con el PC prendido o un panel abierto). Para guardarlo,
  // el celular mismo escucha la C, el Esc y la tecla roja.
  // Enter (lo que antes abría el chat) lo saca directo en Mensajes, listo para escribir.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const chat = e.key === "Enter";
      if ((!chat && e.key.toLowerCase() !== "c") || e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.defaultPrevented) return;
      const { typing, pcOn, panel } = useOfficeStore.getState();
      if (typing || pcOn || panel || usePhoneStore.getState().mounted) return;
      const active = document.activeElement as HTMLElement | null;
      const tag = (active?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || active?.isContentEditable) return;
      e.preventDefault();
      usePhoneStore.getState().show(chat ? { app: "mensajes", quick: true } : null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // La alarma se revisa cada pocos segundos (con la hora de Bogotá).
  useEffect(() => {
    const check = () => {
      if (alarmDue(usePhoneStore.getState().alarm, bogotaTime())) ringAlarm();
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  // Un mensaje nuevo de otra persona hace vibrar el celular.
  useEffect(
    () =>
      useOfficeStore.subscribe((s, prev) => {
        if (s.messages.length <= prev.messages.length) return;
        const m = s.messages.at(-1);
        if (m && m.fromId !== s.sessionId && Date.now() - m.ts < 10_000 && !selectChatMuted(s)) usePhoneStore.getState().buzz();
      }),
    [],
  );
  useEffect(() => {
    if (!buzzAt) return;
    setBuzzing(true);
    const t = setTimeout(() => setBuzzing(false), 650);
    return () => clearTimeout(t);
  }, [buzzAt]);

  return (
    <button
      onClick={() => (ringing ? stopAlarm() : usePhoneStore.getState().toggle())}
      aria-pressed={open}
      title={ringing ? "Apagar la alarma" : open ? "Guardar el celular (C)" : unread ? `${unread} sin leer · Sacar el celular (C, o Enter para el chat)` : "Sacar el celular (C, o Enter para el chat)"}
      aria-label={open ? "Guardar el celular" : unread ? `Sacar el celular, ${unread} mensajes sin leer` : "Sacar el celular"}
      className="cozy-btn relative h-[34px] w-[34px] p-0"
    >
      <PixelIcon name="celular" size={16} color={ringing ? "var(--color-cozy-red)" : "#6b1426"} className={buzzing || ringing ? "phone-buzz" : undefined} />
      {unread > 0 && !open && (
        <span className="absolute -top-2 -right-2 grid h-[18px] min-w-[18px] place-items-center border-2 border-cozy-red-deep bg-cozy-red px-0.5 text-[10px] leading-none text-cozy-paper-light">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
