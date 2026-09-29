"use client";

// Pantalla de inicio (fondo, hora grande, dónde estás, clima, puntos, con quién y mensajes nuevos) y
// el menú en cuadrícula de 3x3. El lugar va arriba donde los celulares ponían el nombre del operador.
import { WEATHER_TEXT } from "@hyvento/shared";
import { useEffect, useRef, useState } from "react";
import { drawWallpaper, WALL_H, WALL_W } from "@/game/phone/fondos";
import { bogotaTime, hhmm } from "@/game/phone/hora";
import { APP_ICONS, type PhoneAppId } from "@/game/phone/iconos";
import { usePhoneStore, useUnread } from "@/game/phone/state";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "../../Cozy";
import { useMyPoints } from "../../PointsPanels";
import { PixelArt, useHearingText, usePhone, usePhoneKeys, usePlaceText, WeatherIcon } from "../kit";

export const APPS: { id: PhoneAppId; name: string }[] = [
  { id: "mensajes", name: "Mensajes" },
  { id: "contactos", name: "Contactos" },
  { id: "camara", name: "Cámara" },
  { id: "culebrita", name: "Culebrita" },
  { id: "tonos", name: "Tonos" },
  { id: "temas", name: "Temas" },
  { id: "reloj", name: "Reloj" },
  { id: "calculadora", name: "Calculadora" },
  { id: "info", name: "Mi estado" },
];

/** "Domingo 27 sep" (solo la primera letra en mayúscula). */
export const dateText = (t: { weekday: string; day: number; month: string }) => `${t.weekday[0]!.toUpperCase()}${t.weekday.slice(1)} ${t.day} ${t.month}`;

/** El reloj que se refresca solo (cada segundo). */
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/** El fondo de pantalla animado (se pinta chico y se estira con píxeles nítidos). */
export function Wallpaper({ className = "" }: { className?: string }) {
  const wallpaper = usePhoneStore((s) => s.wallpaper);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let frame = 0;
    const paint = () => {
      const g = canvas.current?.getContext("2d");
      if (g) drawWallpaper(g, wallpaper, frame++);
    };
    paint();
    const id = setInterval(paint, 450);
    return () => clearInterval(id);
  }, [wallpaper]);
  return <canvas ref={canvas} width={WALL_W} height={WALL_H} className={`pixelated absolute inset-0 h-full w-full ${className}`} />;
}

export function HomeScreen() {
  const { go, close } = usePhone();
  const now = bogotaTime(useNow());
  const unread = useUnread();
  const alarm = usePhoneStore((s) => s.alarm);
  const place = usePlaceText();
  const hearing = useHearingText();
  const points = useMyPoints();
  const weather = useOfficeStore((s) => s.weather);

  usePhoneKeys(
    (k) => {
      if (k === "ok" || k === "softL" || k === "up" || k === "down" || k === "left" || k === "right") return go({ kind: "menu" }), true;
      if (k === "softR") return go({ kind: "app", id: "contactos" }), true;
      if (k === "call") return go({ kind: "app", id: "mensajes" }), true;
      if (k === "end" || k === "back" || k === "esc") return close(), true;
      return false;
    },
    { left: "Menú", right: "Contactos" },
  );

  return (
    <div className="relative flex-1 overflow-hidden">
      <Wallpaper />
      <div className="relative flex h-full flex-col items-center pt-1 text-cozy-paper-light" style={{ textShadow: "1px 1px 0 #2a2033" }}>
        <div className="flex w-full items-center justify-between gap-1 px-1.5 text-[10px] leading-tight">
          <span className="min-w-0 truncate tracking-[0.12em] uppercase" title="Dónde estás">
            {place || "Hyvento"}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <span title={WEATHER_TEXT[weather]} className="flex">
              <WeatherIcon size={10} />
            </span>
            <PixelIcon name="coin" size={9} color="#ffcf4a" />
            {points}
          </span>
        </div>
        <span className="mt-0.5 text-[32px] leading-none font-semibold" style={{ textShadow: "2px 2px 0 #2a2033" }}>
          {hhmm(now)}
        </span>
        <span className="text-[11px]">{dateText(now)}</span>
        <div className="mt-auto mb-1 flex w-full flex-col items-center gap-0.5 px-1">
          {hearing && <span className="max-w-full truncate text-[10px]">{hearing}</span>}
          {unread > 0 && (
            <button
              type="button"
              onClick={() => go({ kind: "app", id: "mensajes" })}
              className="flex items-center gap-1 border border-cozy-frame bg-cozy-paper-light px-1.5 py-[1px] text-[10px] text-cozy-ink"
              style={{ textShadow: "none" }}
            >
              <PixelArt rows={APP_ICONS.mensajes} size={11} />
              {unread === 1 ? "1 mensaje nuevo" : `${unread} mensajes nuevos`}
            </button>
          )}
          {alarm.on && <span className="text-[10px]">Alarma {hhmm(alarm)}</span>}
        </div>
      </div>
    </div>
  );
}

let lastMenuIndex = 0;

export function MenuScreen() {
  const { go, back } = usePhone();
  const [i, setI] = useState(lastMenuIndex);
  lastMenuIndex = i;
  const open = (n: number) => go({ kind: "app", id: APPS[n]!.id });

  usePhoneKeys(
    (k) => {
      const move = { left: -1, right: 1, up: -3, down: 3 }[k as string];
      if (move !== undefined) return setI((v) => (v + move + APPS.length) % APPS.length), true;
      if (k >= "1" && k <= "9" && k.length === 1) return open(Number(k) - 1), true;
      if (k === "ok" || k === "softL") return open(i), true;
      if (k === "softR" || k === "back") return back(), true;
      return false;
    },
    { left: "Elegir", right: "Atrás" },
  );

  return (
    <div className="flex flex-1 flex-col bg-[#1d2a44]">
      <div className="flex h-[17px] items-center justify-center bg-cozy-wood text-[11px] font-semibold text-cozy-paper-light">{APPS[i]!.name}</div>
      <div className="grid flex-1 grid-cols-3 grid-rows-3 gap-[3px] p-[5px]">
        {APPS.map((a, n) => (
          <button
            key={a.id}
            type="button"
            aria-label={a.name}
            onClick={() => (n === i ? open(n) : setI(n))}
            className={`relative grid place-items-center border-2 ${n === i ? "border-cozy-gold bg-[#34507a] phone-bob" : "border-transparent bg-[#26344f]"}`}
          >
            <PixelArt rows={APP_ICONS[a.id]} size={24} />
            <span className="absolute top-0 left-[2px] text-[8px] leading-none text-[#8a9ac0]">{n + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
