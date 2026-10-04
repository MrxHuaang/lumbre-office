"use client";

// Pantalla de carga al entrar a la cabaña: tu personaje camina por el sendero del jardín hacia la cabaña
// (parallax de nubes, colinas, árboles y cerca, con el momento del día del reloj del juego y la estación),
// una barra que sigue las etapas de verdad de la carga (lib/entry.ts) y consejos que van rotando. Al
// terminar, la cabaña llega, se abre la puerta, entras y la pantalla se funde con el juego ya dibujado.
// Todo se mueve con CSS (transform/opacity): mientras Phaser arma el nivel el hilo está ocupado y las
// animaciones siguen igual.
import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useEntryStore } from "@/game/entryStore";
import { currentGameTime } from "@/game/gameClock";
import { useOfficeStore, type Profile } from "@/game/store";
import { currentStage, ENTRY_TIPS, entryDone, entryMood, entryPercent, nextShown, skyArc, stageSlowMs, TIP_MS, tipOrder, type EntryMood } from "@/lib/entry";
import { SKY_COLORS } from "@/lib/sky";
import { CharacterSprite } from "./CharacterSprite";
import { CozyTitle } from "./Cozy";
import { drawScenery, FEET_Y, MEADOW_Y, SCENE_H, skyBands, type Scenery, type Strip } from "./entry/scenery";
import { LumbreLogo } from "./lumbre/Logo";
import { lessMotion } from "@/lib/prefs";

/** Qué está haciendo la pantalla: cargando, llegando a la cabaña (la puerta se abre) o fundiéndose. */
type Exit = "loading" | "arrive" | "leave";

/** Cuánto dura cada paso de la salida (ms). */
const ARRIVE_MS = 900;
const LEAVE_MS = 450;
const REDUCED_LEAVE_MS = 200;

const reducedMotion = () => typeof window !== "undefined" && lessMotion();
const localMinute = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

interface EntryLoaderProps {
  profile: Profile | null;
  /** Con error, la escena se queda quieta y aparece el mensaje con "Reintentar". */
  error?: string | null;
  onRetry?: () => void;
  onExit?: () => void;
  /** Terminó de irse (la cabaña ya está detrás). */
  onGone?: () => void;
  /** Solo para vistas previas: un momento y una estación fijos. */
  previewMood?: EntryMood;
}

export function EntryLoader({ profile, error = null, onRetry, onExit, onGone, previewMood }: EntryLoaderProps) {
  const [shown, setShown] = useState(0);
  const [label, setLabel] = useState<string>("Buscando tu llave");
  const [slow, setSlow] = useState(false);
  const [exit, setExit] = useState<Exit>("loading");
  const done = exit !== "loading";

  // La barra: se recalcula a menudo (las etapas sin medida avanzan solas un poco) y nunca vuelve atrás.
  // Lo lento se cuenta solo con la pestaña a la vista (en segundo plano el juego espera a propósito).
  useEffect(() => {
    if (error) return;
    let stage: string | null = null;
    let stuck = 0;
    let last = Date.now();
    let finished = false;
    const tick = () => {
      const now = Date.now();
      const stages = useEntryStore.getState().stages;
      const cur = currentStage(stages);
      if (cur?.id !== stage) {
        stage = cur?.id ?? null;
        stuck = 0;
        setSlow(false);
      } else if (document.visibilityState === "visible") {
        stuck += now - last;
        if (stuck >= stageSlowMs(cur)) setSlow(true);
      }
      last = now;
      setShown((p) => nextShown(p, entryPercent(stages, now)));
      if (cur) setLabel(cur.label);
      if (!finished && entryDone(stages)) {
        finished = true;
        setShown(100);
        setSlow(false);
        // Un respiro para que la barra se vea llena antes de que llegue la cabaña.
        setTimeout(() => setExit("arrive"), reducedMotion() ? 0 : 250);
      }
    };
    tick();
    const id = setInterval(tick, 150);
    return () => clearInterval(id);
  }, [error]);

  // La salida: la puerta se abre y entras (sin movimiento reducido), y después el fundido.
  useEffect(() => {
    if (exit === "loading" || error) return;
    const reduce = reducedMotion();
    if (exit === "arrive") {
      const id = setTimeout(() => setExit("leave"), reduce ? 0 : ARRIVE_MS);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => onGone?.(), reduce ? REDUCED_LEAVE_MS : LEAVE_MS);
    return () => clearTimeout(id);
  }, [exit, error, onGone]);

  // El momento del día: la hora local mientras no llegue el reloj del juego; al llegar, la del juego.
  const gameClock = useOfficeStore((s) => s.gameClock);
  const [mood, setMood] = useState<EntryMood>(() => previewMood ?? entryMood(Date.now(), null, 12 * 60));
  useEffect(() => {
    const next = previewMood ?? entryMood(Date.now(), currentGameTime()?.minuteOfDay ?? null, localMinute());
    setMood((m) => (m.phase === next.phase && m.season === next.season && m.minuteOfDay === next.minuteOfDay ? m : next));
  }, [gameClock, previewMood]);

  const avatar = profile?.avatar ?? "carla";
  const look = useMemo(() => profile?.look ?? null, [profile?.look]);
  const arrive = Math.max(0, Math.min(1, (shown - 8) / 92));

  return (
    <div
      className="entry-loader cozy-void absolute inset-0 z-40 flex flex-col items-center justify-center overflow-y-auto px-4 py-6"
      data-exit={exit}
      aria-busy={!done && !error}
    >
      <div className="flex w-full flex-col items-center">
        <LumbreLogo size={20} className="mb-4 opacity-90" />
        <CozyTitle className="text-4xl sm:text-6xl">
          {error ? (
            "Uy."
          ) : done ? (
            "¡Llegaste!"
          ) : (
            <>
              Entrando<span className="cozy-dots" aria-hidden />
            </>
          )}
        </CozyTitle>

        <EntryScene mood={mood} avatar={avatar} look={look} arrive={done ? 1 : arrive} exit={exit} frozen={Boolean(error)} />

        {error ? (
          <div className="cozy-panel mt-6 flex w-[min(100%,440px)] flex-col items-center px-6 py-5 text-center" role="alert">
            <p className="text-[15px] leading-relaxed">{error}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button onClick={onRetry} className="cozy-btn cozy-btn-primary px-5 py-2.5 text-[15px]">
                Reintentar
              </button>
              <button onClick={onExit} className="cozy-btn px-5 py-2.5 text-[15px]">
                Cerrar sesión
              </button>
            </div>
          </div>
        ) : (
          <>
            <EntryBar shown={shown} label={done ? "¡Adentro!" : `${label}…`} />
            <div className="mt-2 min-h-[36px]" aria-live="polite">
              {slow && !done && (
                <div className="entry-slow flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-[14px] text-cozy-paper-light">
                  <span>Esto está tardando más de lo normal.</span>
                  <button onClick={onRetry} className="cozy-btn px-3.5 py-1.5 text-[14px]">
                    Reintentar
                  </button>
                </div>
              )}
            </div>
            <EntryTips />
          </>
        )}
      </div>
    </div>
  );
}

/** La barra pixel con el nombre de la etapa y el porcentaje. */
function EntryBar({ shown, label }: { shown: number; label: string }) {
  return (
    <div className="mt-5 w-[min(100%,540px)]">
      <div className="flex items-baseline justify-between gap-3 text-[15px] text-cozy-paper-light">
        <span className="truncate">{label}</span>
        <span className="shrink-0 tabular-nums">{shown}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Cargando la cabaña"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown}
        aria-valuetext={`${label} ${shown}%`}
        className="relative mt-1.5 h-6 border-4 border-cozy-frame bg-cozy-paper-dark p-[2px] shadow-[4px_4px_0_rgb(20_10_24_/_0.55)]"
      >
        <div className="entry-fill h-full w-full origin-left" style={{ transform: `scaleX(${shown / 100})` }} />
        <div className="entry-notches pointer-events-none absolute inset-[2px]" aria-hidden />
      </div>
    </div>
  );
}

/** Los consejos: uno cada TIP_MS, con fundido. El primero es fijo (igual en el servidor y el navegador). */
function EntryTips() {
  const [order, setOrder] = useState<number[]>(() => ENTRY_TIPS.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setOrder(tipOrder(Date.now()));
    let fade: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      setVisible(false);
      fade = setTimeout(() => {
        setPos((p) => p + 1);
        setVisible(true);
      }, 320);
    }, TIP_MS);
    return () => {
      clearInterval(id);
      clearTimeout(fade);
    };
  }, []);
  const tip = ENTRY_TIPS[order[pos % order.length]!]!;
  return (
    <div className="cozy-chip mt-2 flex w-[min(100%,540px)] items-start gap-2.5 px-3.5 py-2.5">
      <span className="cozy-kbd mt-[1px] shrink-0 text-[12px]">Consejo</span>
      <p className="entry-tip min-h-[2.6em] text-[14px] leading-snug" data-show={visible}>
        {tip}
      </p>
    </div>
  );
}

// ---------- La escena ----------

/** Los tamaños: a 2 píxeles de pantalla por píxel de arte; a 3 en pantallas grandes. */
function usePixelScale() {
  const [px, setPx] = useState(2);
  useEffect(() => {
    const pick = () => setPx(window.innerWidth >= 1200 && window.innerHeight >= 860 ? 3 : 2);
    pick();
    window.addEventListener("resize", pick);
    return () => window.removeEventListener("resize", pick);
  }, []);
  return px;
}

const layerStyle = (s: Strip, px: number): CSSProperties =>
  ({
    backgroundImage: `url(${s.src})`,
    backgroundSize: `${s.w * px}px ${SCENE_H * px}px`,
    width: `calc(100% + ${s.w * px}px)`,
    height: SCENE_H * px,
    "--shift": `-${s.w * px}px`,
    "--steps": s.w,
    animationDuration: `${s.secs}s`,
  }) as CSSProperties;

// Dónde van las hojas que caen (o las luciérnagas): repartidas a mano, con su ritmo.
const PARTICLES = [
  { left: 8, delay: 0, dur: 7 },
  { left: 22, delay: -3.2, dur: 8.5 },
  { left: 37, delay: -5.1, dur: 6.8 },
  { left: 51, delay: -1.4, dur: 9.2 },
  { left: 66, delay: -6.3, dur: 7.6 },
  { left: 79, delay: -2.2, dur: 8.1 },
  { left: 91, delay: -4.4, dur: 7.2 },
];

const EntryScene = memo(function EntryScene({
  mood,
  avatar,
  look,
  arrive,
  exit,
  frozen,
}: {
  mood: EntryMood;
  avatar: string;
  look: Profile["look"] | null;
  arrive: number;
  exit: Exit;
  frozen: boolean;
}) {
  const px = usePixelScale();
  const [scenery, setScenery] = useState<Scenery | null>(null);
  // El arte se dibuja una vez por momento del día y estación (unos milisegundos, en el navegador).
  useEffect(() => {
    try {
      setScenery(drawScenery({ phase: mood.phase, season: mood.season }));
    } catch (err) {
      // Sin paisaje queda el cielo y el personaje: la carga sigue igual.
      console.error("No se pudo dibujar el camino de la carga", err);
    }
  }, [mood.phase, mood.season]);

  const sky = SKY_COLORS[mood.phase];
  // El cielo llega hasta el pasto de atrás; abajo el paisaje lo tapa.
  const bands = useMemo(() => skyBands(sky.top, sky.bottom, (MEADOW_Y / SCENE_H) * 100), [sky.top, sky.bottom]);
  const arc = skyArc(mood.minuteOfDay);
  const stopped = frozen || exit !== "loading";
  const maxW = px === 3 ? 1000 : 680;

  return (
    <div
      className="entry-scene relative mt-6 overflow-hidden border-4 border-cozy-frame shadow-[5px_5px_0_rgb(20_10_24_/_0.55)]"
      data-stopped={stopped}
      data-exit={exit}
      data-night={mood.phase === "noche"}
      style={{ width: `min(100%, ${maxW}px)`, height: SCENE_H * px + 8, background: bands } as CSSProperties}
      aria-hidden
    >
      {scenery && (
        <>
          {scenery.stars && (
            <div
              className="entry-stars pixelated absolute inset-x-0 top-0"
              style={{ height: 60 * px, backgroundImage: `url(${scenery.stars})`, backgroundSize: `${160 * px}px ${60 * px}px` }}
            />
          )}
          <div
            className="pixelated absolute"
            style={{
              width: 14 * px,
              height: 14 * px,
              left: `calc(${8 + arc.t * 84}% - ${7 * px}px)`,
              top: Math.round(30 - Math.sin(Math.PI * arc.t) * 24) * px,
              backgroundImage: `url(${scenery.sun})`,
              backgroundSize: "100% 100%",
            }}
          />
          <div className="entry-layer pixelated" style={layerStyle(scenery.clouds, px)} />
          <div className="entry-layer pixelated" style={layerStyle(scenery.hills, px)} />
          <div className="entry-layer pixelated" style={layerStyle(scenery.trees, px)} />
          <Cabin cabin={scenery.cabin} px={px} arrive={arrive} open={exit !== "loading"} night={mood.phase === "noche"} />
          <div className="entry-layer pixelated" style={layerStyle(scenery.path, px)} />
        </>
      )}
      {/* Tú, caminando. Al llegar, subes al escalón y entras por la puerta (te achicas un poco: te alejas). */}
      <div
        className="entry-walker absolute"
        style={
          {
            left: "30%",
            bottom: (SCENE_H - FEET_Y - 3) * px,
            width: 40 * px,
            marginLeft: -20 * px,
            "--in-y": `-${(FEET_Y - (MEADOW_Y - 7)) * px}px`,
          } as CSSProperties
        }
      >
        <CharacterSprite avatar={avatar} look={look} dir="right" walking={!frozen} className={`w-full ${mood.phase === "noche" ? "brightness-[0.8]" : ""}`} />
      </div>
      {scenery && (
        <>
          <div className="entry-layer pixelated" style={layerStyle(scenery.front, px)} />
          {scenery.particles.srcs.length > 0 && (
            <div className="entry-particles pointer-events-none absolute inset-0" data-kind={scenery.particles.kind}>
              {PARTICLES.map((p, i) => (
                <span
                  key={i}
                  className="entry-particle pixelated absolute top-0"
                  style={{
                    left: `${p.left}%`,
                    width: 6 * px,
                    height: 6 * px,
                    backgroundImage: `url(${scenery.particles.srcs[i % scenery.particles.srcs.length]})`,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    animationDelay: `${p.delay}s`,
                    animationDuration: `${scenery.particles.kind === "firefly" ? p.dur * 0.6 : p.dur}s`,
                    ["--fall" as string]: `${SCENE_H * px}px`,
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
});

/** La cabaña: se arrima a medida que avanza la carga (arrive de 0 a 1) y al final abre la puerta. */
function Cabin({ cabin, px, arrive, open, night }: { cabin: Scenery["cabin"]; px: number; arrive: number; open: boolean; night: boolean }) {
  const doorCenter = cabin.doorX + cabin.doorW / 2;
  return (
    <div
      className="entry-cabin pixelated absolute"
      data-open={open}
      style={
        {
          left: "64%",
          marginLeft: -doorCenter * px,
          bottom: (SCENE_H - MEADOW_Y) * px,
          width: cabin.w * px,
          height: cabin.h * px,
          backgroundImage: `url(${cabin.src})`,
          backgroundSize: "100% 100%",
          "--arrive": arrive,
          "--away": `${cabin.w * px}px`,
        } as CSSProperties
      }
    >
      {/* Humo de la chimenea: tres bocanadas que suben y se deshacen. */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="entry-smoke absolute"
          style={{
            left: cabin.chimneyX * px - 3 * px,
            top: -4 * px,
            width: 6 * px,
            height: 4 * px,
            background: night ? "rgb(170 170 200 / 0.55)" : "rgb(245 240 235 / 0.8)",
            animationDelay: `${-i * 1.1}s`,
          }}
        />
      ))}
      <div
        className="entry-door pixelated absolute"
        style={{
          left: cabin.doorX * px,
          top: cabin.doorY * px,
          width: cabin.doorW * px,
          height: cabin.doorH * px,
          backgroundImage: `url(${cabin.door})`,
          backgroundSize: "100% 100%",
        }}
      />
    </div>
  );
}
