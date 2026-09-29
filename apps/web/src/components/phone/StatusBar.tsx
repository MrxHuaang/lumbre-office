"use client";

// Barra de arriba de la pantalla: rayitas de señal (la conexión con la cabaña de verdad), el sobre
// de mensajes nuevos, la campanita de la alarma, la hora de Bogotá y la batería (la del computador
// si el navegador la cuenta; si no, llena).
import { useEffect, useState } from "react";
import { bogotaTime, hhmm } from "@/game/phone/hora";
import { usePhoneStore, useUnread } from "@/game/phone/state";
import { useOfficeStore } from "@/game/store";
import { useMediaStore } from "@/game/media";
import { STATUS_HEX } from "@/lib/cozy";
import { useNow } from "./screens/Home";

interface BatteryLike {
  level: number;
  charging: boolean;
  addEventListener: (e: string, fn: () => void) => void;
  removeEventListener: (e: string, fn: () => void) => void;
}

export function useBattery(): { level: number | null; charging: boolean } {
  const [state, setState] = useState<{ level: number | null; charging: boolean }>({ level: null, charging: false });
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    if (!nav.getBattery) return;
    let b: BatteryLike | null = null;
    let alive = true;
    const read = () => b && alive && setState({ level: Math.round(b.level * 100), charging: b.charging });
    nav
      .getBattery()
      .then((bat) => {
        b = bat;
        read();
        bat.addEventListener("levelchange", read);
        bat.addEventListener("chargingchange", read);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      b?.removeEventListener("levelchange", read);
      b?.removeEventListener("chargingchange", read);
    };
  }, []);
  return state;
}

/** 0 a 4 rayitas: conectado a la cabaña (y con audio), reconectando, o sin nada. */
export function useSignal(): number {
  const connection = useOfficeStore((s) => s.connection);
  const media = useMediaStore((s) => s.status);
  if (connection === "reconnecting") return 1;
  if (connection !== "connected") return 0;
  return media === "connected" ? 4 : 3;
}

export function StatusBar() {
  const now = bogotaTime(useNow());
  const unread = useUnread();
  const alarmOn = usePhoneStore((s) => s.alarm.on);
  const signal = useSignal();
  const battery = useBattery();
  const status = useOfficeStore((s) => (s.sessionId ? s.players[s.sessionId]?.status : undefined));
  const level = battery.level ?? 100;
  const bars = Math.max(1, Math.ceil(level / 25));
  return (
    <div className="flex h-[14px] shrink-0 items-center gap-1 bg-[#0e1422] px-1 text-[10px] leading-none text-cozy-paper-light">
      <span className="flex items-end gap-[1px]" aria-label={`Señal ${signal} de 4`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="w-[2px]" style={{ height: 3 + i * 2, background: i < signal ? "#fdf0c8" : "#3a4460" }} />
        ))}
      </span>
      {/* Mi estado de presencia (se cambia en Mi estado). */}
      {status && <span className="h-[7px] w-[7px] border border-[#0e1422] outline outline-cozy-paper-light" style={{ background: STATUS_HEX[status] }} />}
      {unread > 0 && (
        <svg width="11" height="8" viewBox="0 0 11 8" shapeRendering="crispEdges" aria-label="Mensajes nuevos">
          <rect width="11" height="8" fill="#fdf0c8" />
          <rect x="1" y="1" width="9" height="6" fill="#5d93cf" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={1 + i} y={1 + i} width="1" height="1" fill="#fdf0c8" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <rect key={`r${i}`} x={9 - i} y={1 + i} width="1" height="1" fill="#fdf0c8" />
          ))}
        </svg>
      )}
      {alarmOn && (
        <svg width="8" height="8" viewBox="0 0 8 8" shapeRendering="crispEdges" aria-label="Alarma prendida">
          <path d="M3 0h2v1h1v1h1v4h1v1H0V6h1V2h1V1h1z M3 7h2v1H3z" fill="#ffcf4a" />
        </svg>
      )}
      <span className="mx-auto">{hhmm(now)}</span>
      <span className="flex items-center" aria-label={battery.level === null ? "Batería" : `Batería ${battery.level}%`}>
        <span className="flex h-[8px] w-[16px] gap-[1px] border border-cozy-paper-light p-[1px]">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="flex-1" style={{ background: i < bars ? (bars === 1 ? "#d93a2b" : "#8cc653") : "transparent" }} />
          ))}
        </span>
        <span className="h-[4px] w-[2px] bg-cozy-paper-light" />
        {battery.charging && <span className="ml-[1px] text-[8px] text-cozy-gold">+</span>}
      </span>
    </div>
  );
}
