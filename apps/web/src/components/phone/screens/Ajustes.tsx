"use client";

// Tonos (el aviso de los mensajes del chat), Temas (carcasa y fondo) y Mi estado (presencia, lugar,
// puntos y los datos del aparato).
import { MANUAL_STATUSES, WEATHER_TEXT, type PresenceStatus } from "@hyvento/shared";
import { useEffect, useState, type ReactNode } from "react";
import { sendStatus } from "@/game/network";
import { playRingtone, stopRingtone } from "@/game/phone/audio";
import { SKINS, usePhoneStore, WALLPAPERS, type PhoneSkin, type PhoneWallpaper } from "@/game/phone/state";
import { CLASSIC_TONE, RINGTONES, ringtoneById, toneLength } from "@/game/phone/tonos";
import { sfx } from "@/game/sfx";
import { useOfficeStore } from "@/game/store";
import type { Profile } from "@/game/store";
import { STATUS_HEX } from "@/lib/cozy";
import { Flash, ScreenTitle, SelectList, useHearingText, usePhone, usePhoneKeys, usePlaceText, WeatherIcon } from "../kit";
import { useBattery, useSignal } from "../StatusBar";
import { PixelIcon } from "../../Cozy";

const TONES = [{ id: CLASSIC_TONE, name: "Bip de la cabaña" }, ...RINGTONES.map((r) => ({ id: r.id, name: r.name }))];

/** Barritas que saltan mientras suena la vista previa (el "ecualizador" de los celulares de antes). */
function Equalizer({ on }: { on: boolean }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setT((v) => v + 1), 120);
    return () => clearInterval(id);
  }, [on]);
  return (
    <div className="flex h-5 items-end justify-center gap-[2px]">
      {Array.from({ length: 11 }, (_, i) => {
        const h = on ? 2 + ((i * 7 + t * (3 + (i % 3))) % 16) : 2;
        return <span key={i} className="w-[5px] bg-cozy-green" style={{ height: h }} />;
      })}
    </div>
  );
}

export function TonosApp() {
  const { back } = usePhone();
  const tone = usePhoneStore((s) => s.tone);
  const [i, setI] = useState(() => Math.max(0, TONES.findIndex((t) => t.id === tone)));
  const [playingUntil, setPlayingUntil] = useState(0);
  const [saved, setSaved] = useState(false);
  const [, tick] = useState(0);

  // Al moverse por la lista suena la vista previa (con una pausita, para no encimar al pasar rápido).
  useEffect(() => {
    const id = setTimeout(() => {
      const t = TONES[i]!;
      const r = ringtoneById(t.id);
      if (r) {
        const secs = playRingtone(r, { maxSeconds: 5 });
        setPlayingUntil(Date.now() + secs * 1000);
      } else {
        stopRingtone();
        sfx.chat();
        setPlayingUntil(Date.now() + 300);
      }
    }, 260);
    return () => clearTimeout(id);
  }, [i]);
  useEffect(() => () => stopRingtone(), []);
  useEffect(() => {
    if (playingUntil <= Date.now()) return;
    const id = setTimeout(() => tick((n) => n + 1), playingUntil - Date.now() + 20);
    return () => clearTimeout(id);
  }, [playingUntil]);
  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 900);
    return () => clearTimeout(id);
  }, [saved]);

  const choose = (n: number) => {
    usePhoneStore.getState().setPrefs({ tone: TONES[n]!.id });
    setSaved(true);
  };
  usePhoneKeys(
    (k) => {
      if (k === "up") return setI((v) => (v - 1 + TONES.length) % TONES.length), true;
      if (k === "down") return setI((v) => (v + 1) % TONES.length), true;
      if (k === "ok" || k === "softL") return choose(i), true;
      if (k === "softR" || k === "back") return back(), true;
      return false;
    },
    { left: "Elegir", right: "Atrás" },
  );

  const r = ringtoneById(TONES[i]!.id);
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-cozy-paper">
      <ScreenTitle>Tono de mensajes</ScreenTitle>
      <SelectList
        items={TONES}
        index={i}
        onPick={(n) => (n === i ? choose(n) : setI(n))}
        render={(t) => (
          <span className="flex justify-between gap-1">
            <span className="truncate">{t.name}</span>
            {t.id === tone && <PixelIcon name="check" size={10} />}
          </span>
        )}
      />
      <div className="border-t-2 border-cozy-paper-dark px-1.5 pt-0.5">
        <Equalizer on={playingUntil > Date.now()} />
        <p className="text-center text-[9px] text-cozy-ink-soft">{r ? `Polifónico · ${toneLength(r).toFixed(1)} s` : "El sonido de siempre"}</p>
      </div>
      {saved && <Flash>Tono guardado</Flash>}
    </div>
  );
}

type ThemeRow = { kind: "head"; label: string } | { kind: "skin"; id: PhoneSkin; label: string } | { kind: "wall"; id: PhoneWallpaper; label: string };
const THEME_ROWS: ThemeRow[] = [
  { kind: "head", label: "Carcasa" },
  ...SKINS.map((s) => ({ kind: "skin" as const, id: s.id, label: s.name })),
  { kind: "head", label: "Fondo de pantalla" },
  ...WALLPAPERS.map((w) => ({ kind: "wall" as const, id: w.id, label: w.name })),
];
const pickable = THEME_ROWS.map((r, n) => (r.kind === "head" ? -1 : n)).filter((n) => n >= 0);

export function TemasApp() {
  const { back } = usePhone();
  const skin = usePhoneStore((s) => s.skin);
  const wallpaper = usePhoneStore((s) => s.wallpaper);
  const [p, setP] = useState(0);
  const row = THEME_ROWS[pickable[p]!]!;
  const apply = (r: ThemeRow) => {
    if (r.kind === "skin") usePhoneStore.getState().setPrefs({ skin: r.id });
    if (r.kind === "wall") usePhoneStore.getState().setPrefs({ wallpaper: r.id });
  };
  usePhoneKeys(
    (k) => {
      if (k === "up") return setP((v) => (v - 1 + pickable.length) % pickable.length), true;
      if (k === "down") return setP((v) => (v + 1) % pickable.length), true;
      if (k === "ok" || k === "softL") return apply(row), true;
      if (k === "softR" || k === "back") return back(), true;
      return false;
    },
    { left: "Poner", right: "Atrás" },
  );
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-cozy-paper">
      <ScreenTitle>Temas</ScreenTitle>
      <SelectList
        items={THEME_ROWS}
        index={pickable[p]!}
        onPick={(n) => {
          const q = pickable.indexOf(n);
          if (q < 0) return;
          if (q === p) apply(THEME_ROWS[n]!);
          else setP(q);
        }}
        render={(r) =>
          r.kind === "head" ? (
            <span className="block text-[10px] font-semibold text-cozy-ink-soft">{r.label}</span>
          ) : (
            <span className="flex justify-between gap-1 pl-1">
              <span className="truncate">{r.label}</span>
              {(r.kind === "skin" ? r.id === skin : r.id === wallpaper) && <span>●</span>}
            </span>
          )
        }
      />
    </div>
  );
}

/** Un número de mentira pero fijo para cada persona (con 555, como en las películas). */
function fakeNumber(id: string) {
  let h = 7;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const n = String(h % 10000).padStart(4, "0");
  return `310 555 ${n}`;
}

const STATUS_LABEL: Record<PresenceStatus, string> = {
  available: "Disponible",
  busy: "Ocupado",
  dnd: "No molestar",
  away: "Ausente",
  meeting: "En reunión",
};

/**
 * Mi estado: lo que antes estaba arriba en el HUD (estado de presencia, dónde estoy, con quién, clima
 * y puntos) y los datos del aparato. El estado se cambia aquí con la misma acción que el selector de antes.
 */
export function EstadoApp({ profile }: { profile: Profile }) {
  const { back, close } = usePhone();
  const me = useOfficeStore((s) => (s.sessionId ? s.players[s.sessionId] : undefined));
  const weather = useOfficeStore((s) => s.weather);
  const leisure = useOfficeStore((s) => s.leisure);
  const place = usePlaceText();
  const hearing = useHearingText();
  const battery = useBattery();
  const signal = useSignal();
  const [i, setI] = useState(0);
  const status = me?.status ?? "available";
  const cycle = (dir: 1 | -1) => {
    // "En reunión" lo pone el servidor: desde ahí se pasa al primero o al último de los manuales.
    const len = MANUAL_STATUSES.length;
    const n = (MANUAL_STATUSES as readonly string[]).indexOf(status);
    sendStatus(MANUAL_STATUSES[n < 0 ? (dir > 0 ? 0 : len - 1) : (n + dir + len) % len]!);
  };
  // Puntos: abre tus movimientos (el panel del buzón), como el contador que había en el HUD.
  const movements = () => close(() => useOfficeStore.getState().openPanel("mailbox", false));

  const rows: { k: string; v: ReactNode; run?: () => void; hint?: string }[] = [
    {
      k: "Estado",
      v: (
        <span className="flex items-center justify-end gap-1">
          <span className="h-2 w-2 border border-cozy-frame" style={{ background: STATUS_HEX[status] }} />
          {STATUS_LABEL[status]}
        </span>
      ),
      run: () => cycle(1),
      hint: "OK o las flechas cambian el estado",
    },
    { k: "Puntos", v: me ? String(me.points) : "—", run: movements, hint: "OK: ver tus movimientos" },
    { k: "Ocio hoy", v: leisure ? `${leisure.today}/${leisure.cap}` : "—", hint: "Tope diario de puntos por ocio" },
    { k: "Estás en", v: place || "La cabaña" },
    { k: "Con", v: hearing ?? "Nadie cerca" },
    {
      k: "Clima",
      v: (
        <span className="flex items-center justify-end gap-1">
          <WeatherIcon />
          {WEATHER_TEXT[weather]}
        </span>
      ),
    },
    { k: "Número", v: fakeNumber(me?.userId ?? profile.name) },
    { k: "Batería", v: battery.level === null ? "Llena" : `${battery.level}%${battery.charging ? " (cargando)" : ""}` },
    { k: "Señal", v: `${signal}/4 rayitas` },
    { k: "Modelo", v: "HYVENTO H-200" },
  ];
  const row = rows[i]!;
  usePhoneKeys(
    (k) => {
      if (k === "up") return setI((v) => Math.max(0, v - 1)), true;
      if (k === "down") return setI((v) => Math.min(rows.length - 1, v + 1)), true;
      if (i === 0 && (k === "left" || k === "right")) return cycle(k === "left" ? -1 : 1), true;
      if ((k === "ok" || k === "softL") && row.run) return row.run(), true;
      if (k === "softR" || k === "back") return back(), true;
      return false;
    },
    { left: row.run ? (i === 0 ? "Cambiar" : "Ver") : undefined, right: "Atrás" },
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-cozy-paper">
      <ScreenTitle>{profile.name}</ScreenTitle>
      <SelectList
        items={rows}
        index={i}
        onPick={(n) => (n === i ? rows[n]!.run?.() : setI(n))}
        render={(r) => (
          <span className="flex justify-between gap-2">
            <span className="shrink-0 opacity-75">{r.k}</span>
            <span className="min-w-0 truncate text-right">{r.v}</span>
          </span>
        )}
      />
      <p className="h-[11px] shrink-0 px-1.5 text-[9px] leading-none text-cozy-ink-soft">{row.hint ?? ""}</p>
    </div>
  );
}
