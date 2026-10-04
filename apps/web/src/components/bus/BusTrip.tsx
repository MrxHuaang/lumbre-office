"use client";

// La pantalla del viaje en Megabús: mientras el bus va en camino, los de adentro no ven el mundo sino la
// vista por la ventana, a pantalla completa y en pixel: el paisaje pasa en capas (la cordillera, los
// cafetales, guaduales, postes y casitas, la baranda del carril) con el momento del día del reloj del
// juego, el clima y la estación; adelante, el marco del bus (la ventana, las barandas verde lima) y la
// pantallita con la próxima parada y lo que falta. Al llegar, el paisaje frena, suena el timbre, la
// pantallita dice la parada y se funde con el bus ya parado. El paisaje se mueve solo con CSS (transform):
// anda aunque Phaser ocupe el hilo; la velocidad se le pasa con `playbackRate`. Con "menos movimiento",
// quieto y solo el fundido. El audio de proximidad sigue entre los pasajeros.
import { BUS_COLORS } from "@hyvento/map/art";
import { BUS, busStopName, busTraveling } from "@hyvento/shared";
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { playBusStopBell } from "@/game/busSonidos";
import { useBusStore } from "@/game/busStore";
import { tripInfo, tripView, type TripView } from "@/game/busTrip";
import { serverNow } from "@/game/club/store";
import { currentGameTime } from "@/game/gameClock";
import { useOfficeStore } from "@/game/store";
import { entryMood, skyArc } from "@/lib/entry";
import { lessMotion } from "@/lib/prefs";
import { SKY_COLORS } from "@/lib/sky";
import { skyBands } from "../entry/scenery";
import { drawTripScenery, TRIP_H, type TripMood, type TripScenery, type TripStrip } from "./scenery";
import { useBusTick } from "./BusPromptLabel";

const { LIME, TINT, BLACK, LED } = BUS_COLORS;
const css = (c: readonly number[]) => `rgb(${c[0]} ${c[1]} ${c[2]})`;

/** Lo que dura el fundido al llegar (ms; igual en globals.css). */
const FADE_MS = 700;

const localMinute = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

/** Los que van a bordo contigo (sin ti), por nombre: un texto para que el selector no cambie de más. */
const ridersOf = (s: { sessionId: string | null; players: Record<string, { sessionId: string; area: string; name: string }> }) =>
  Object.values(s.players)
    .filter((p) => p.area === BUS.area && p.sessionId !== s.sessionId)
    .map((p) => p.name)
    .sort((a, b) => a.localeCompare(b, "es"))
    .join("\n");

/**
 * Solo se arma adentro del bus en camino (el reloj de 200 ms y el dibujo del paisaje no corren si no se ve).
 * Al llegar se queda montada lo que dura el fundido.
 */
export function BusTrip() {
  const inBus = useOfficeStore((s) => s.area === BUS.area);
  const traveling = useBusStore((s) => busTraveling(s.phase));
  const show = inBus && traveling;
  const [fading, setFading] = useState(false);
  const shown = useRef(false);
  useEffect(() => {
    if (show) {
      shown.current = true;
      setFading(false);
      return;
    }
    if (!shown.current) return;
    shown.current = false;
    setFading(true);
    const id = setTimeout(() => setFading(false), FADE_MS + 60);
    return () => clearTimeout(id);
  }, [show]);
  // `shown` cubre el render en que deja de verse, antes de que el efecto prenda el fundido.
  return show || fading || shown.current ? <BusTripScreen leaving={!show} /> : null;
}

function BusTripScreen({ leaving }: { leaving: boolean }) {
  useBusTick(200);
  const phase = useBusStore((s) => s.phase);
  const since = useBusStore((s) => s.since);
  const nextAt = useBusStore((s) => s.nextAt);
  const run = useBusStore((s) => s.run);
  const bus = { phase, since, nextAt };
  const info = tripInfo(bus);
  const view = tripView(bus, serverNow(), info);

  // El momento del día del reloj del juego (o la hora local mientras no llega), la estación y el clima.
  const gameClock = useOfficeStore((s) => s.gameClock);
  const weather = useOfficeStore((s) => s.weather);
  const [minute, setMinute] = useState(() => entryMood(Date.now(), currentGameTime()?.minuteOfDay ?? null, localMinute()));
  useEffect(() => {
    const next = entryMood(Date.now(), currentGameTime()?.minuteOfDay ?? null, localMinute());
    setMinute((m) => (m.phase === next.phase && m.season === next.season && m.minuteOfDay === next.minuteOfDay ? m : next));
  }, [gameClock]);
  const mood = useMemo<TripMood>(() => ({ phase: minute.phase, season: minute.season, weather }), [minute.phase, minute.season, weather]);

  const ridersText = useOfficeStore(ridersOf);
  const riders = useMemo(() => (ridersText ? ridersText.split("\n") : []), [ridersText]);

  // El timbre, una vez por viaje, cuando se pide la parada.
  const rang = useRef<number | null>(null);
  const ring = view.bell && !view.arrived && view.etaMs > 300;
  useEffect(() => {
    if (!ring || rang.current === run) return;
    rang.current = run;
    playBusStopBell(0.8);
  }, [ring, run]);

  return <BusTripView view={view} stopName={busStopName(info.stop)} mood={mood} minuteOfDay={minute.minuteOfDay} riders={riders} leaving={leaving} />;
}

// ---------- La vista (sin stores: también la usan las vistas previas) ----------

interface BusTripViewProps {
  view: TripView;
  stopName: string;
  mood: TripMood;
  minuteOfDay: number;
  riders: readonly string[];
  /** Se está fundiendo (el bus ya llegó). */
  leaving?: boolean;
  /** Para vistas previas: forzar "menos movimiento". */
  still?: boolean;
}

/** El tamaño: píxeles de pantalla por píxel de arte, el alto del techo y el de la pared de abajo. */
function useTripLayout() {
  const [layout, setLayout] = useState({ px: 4, ceil: 110, wall: 140 });
  useEffect(() => {
    const pick = () => {
      const h = window.innerHeight;
      const ceil = Math.round(Math.max(84, Math.min(140, h * 0.15)));
      const wall = Math.round(Math.max(96, Math.min(180, h * 0.2)));
      // Que el paisaje llene la ventana, sin agrandarlo de más en una pantalla angosta (el celular).
      const px = Math.max(2, Math.min(Math.round((h - ceil - wall) / TRIP_H), Math.ceil(window.innerWidth / 160)));
      setLayout({ px, ceil, wall });
    };
    pick();
    window.addEventListener("resize", pick);
    return () => window.removeEventListener("resize", pick);
  }, []);
  return layout;
}

export function BusTripView({ view, stopName, mood, minuteOfDay, riders, leaving = false, still: forceStill = false }: BusTripViewProps) {
  const { px, ceil, wall } = useTripLayout();
  const root = useRef<HTMLDivElement>(null);
  const [still, setStill] = useState(forceStill);
  useEffect(() => setStill(forceStill || lessMotion()), [forceStill]);
  const [scenery, setScenery] = useState<TripScenery | null>(null);
  // El paisaje se dibuja una vez por momento del día, estación y clima (unos milisegundos).
  useEffect(() => {
    try {
      setScenery(drawTripScenery(mood));
    } catch (err) {
      // Sin paisaje queda el cielo y el marco: el viaje sigue igual.
      console.error("No se pudo dibujar la vista del Megabús", err);
    }
  }, [mood]);

  // La velocidad del paisaje: la misma animación de CSS, más rápida o más lenta (sin saltos).
  const speed = still ? 0 : Math.round(view.speed * 20) / 20;
  useEffect(() => {
    const el = root.current;
    if (!el || typeof el.getAnimations !== "function") return;
    for (const a of el.getAnimations({ subtree: true })) {
      if ((a as CSSAnimation).animationName !== "bus-trip-pan") continue;
      if (Math.abs(a.playbackRate - speed) > 0.01) a.updatePlaybackRate(speed);
    }
  }, [speed, scenery, px]);

  const sky = SKY_COLORS[mood.phase];
  const grey = mood.weather !== "despejado" && mood.weather !== "nieve";
  const bands = useMemo(() => {
    const dull = (h: string) => (grey ? mixHex(h, mood.phase === "noche" ? "#2a2d3a" : "#9aa1a8", 0.45) : h);
    return skyBands(dull(sky.top), dull(sky.bottom), 70);
  }, [sky.top, sky.bottom, grey, mood.phase]);
  const arc = skyArc(minuteOfDay);
  const moving = !still && speed > 0.02 && !view.arrived;

  return (
    <div
      ref={root}
      className="bus-trip pointer-events-auto absolute inset-0 z-[5] overflow-hidden font-pixel select-none"
      data-leaving={leaving}
      data-moving={moving}
      style={{ background: css(BLACK[1]!) }}
    >
      {/* La ventana: el cielo, el paisaje en capas y lo que pasa por el vidrio. */}
      <div className="bus-trip-rumble absolute inset-x-0" style={{ top: ceil, bottom: wall, ["--rumble" as string]: `${px}px` }} aria-hidden>
        <div className="absolute inset-0 overflow-hidden" style={{ background: bands }}>
          {scenery && <Landscape scenery={scenery} px={px} arc={arc} mood={mood} />}
          <WindowFrame px={px} />
        </div>
      </div>
      <Interior px={px} ceil={ceil} wall={wall} />
      <StopScreen view={view} stopName={stopName} riders={riders} top={Math.round(ceil * 0.2)} />
    </div>
  );
}

const layerStyle = (s: TripStrip, px: number): CSSProperties =>
  ({
    backgroundImage: `url(${s.src})`,
    backgroundSize: `${s.w * px}px ${TRIP_H * px}px`,
    width: `calc(100% + ${s.w * px}px)`,
    height: TRIP_H * px,
    "--shift": `-${s.w * px}px`,
    "--steps": s.w,
    animationDuration: `${s.secs}s`,
  }) as CSSProperties;

const Landscape = memo(function Landscape({ scenery, px, arc, mood }: { scenery: TripScenery; px: number; arc: { t: number }; mood: TripMood }) {
  const fall = scenery.fall;
  // La lluvia cae casi derecha (como el dibujo de la gota); la nieve se va en diagonal con el viento del bus.
  const fx = fall ? -fall.size * px : 0;
  const fy = fall ? fall.size * px * (fall.kind === "rain" ? 3 : 1) : 0;
  // De noche el reflejo casi no se ve (si no, parece un haz de luz).
  const glare = mood.phase === "noche" ? 0.025 : 0.05;
  return (
    <>
      {scenery.stars && (
        <div
          className="pixelated absolute inset-x-0 top-0"
          style={{ bottom: (TRIP_H - 64) * px, backgroundImage: `url(${scenery.stars})`, backgroundSize: `${160 * px}px ${60 * px}px`, backgroundRepeat: "repeat" }}
        />
      )}
      {mood.weather !== "lluvia" && mood.weather !== "tormenta" && (
        <div
          className="pixelated absolute"
          style={{
            width: 14 * px,
            height: 14 * px,
            left: `calc(${8 + arc.t * 84}% - ${7 * px}px)`,
            bottom: Math.round(TRIP_H - 40 + Math.sin(Math.PI * arc.t) * 28) * px,
            backgroundImage: `url(${scenery.sun})`,
            backgroundSize: "100% 100%",
            opacity: mood.weather === "nublado" || mood.weather === "niebla" ? 0.45 : 1,
          }}
        />
      )}
      <div className="bus-trip-layer pixelated" style={layerStyle(scenery.clouds, px)} />
      <div className="bus-trip-layer pixelated" style={layerStyle(scenery.mountains, px)} />
      <div className="bus-trip-layer pixelated" style={layerStyle(scenery.cafetal, px)} />
      {mood.weather === "niebla" && (
        <div className="absolute inset-x-0 bottom-0" style={{ height: TRIP_H * px * 0.55, background: "linear-gradient(to bottom, transparent 0 20%, rgb(226 230 234 / 0.35) 20% 60%, rgb(226 230 234 / 0.2) 60% 100%)" }} />
      )}
      <div className="bus-trip-layer pixelated" style={layerStyle(scenery.middle, px)} />
      <div className="bus-trip-layer pixelated" style={layerStyle(scenery.near, px)} />
      {fall && (
        <div
          className="bus-trip-fall pixelated"
          style={
            {
              top: -fy,
              width: `calc(100% + ${-fx}px)`,
              height: `calc(100% + ${fy}px)`,
              backgroundImage: `url(${fall.src})`,
              backgroundSize: `${fall.size * px}px ${fall.size * px}px`,
              animationDuration: `${fall.secs * (fall.kind === "rain" ? 3 : 1)}s`,
              "--fx": `${fx}px`,
              "--fy": `${fy}px`,
            } as CSSProperties
          }
        />
      )}
      {mood.weather === "tormenta" && <div className="bus-trip-flash absolute inset-0" />}
      {scenery.glass && (
        <>
          <div
            className="pixelated absolute inset-0"
            style={{ backgroundImage: `url(${scenery.glass.drops})`, backgroundSize: `${scenery.glass.size * px}px ${scenery.glass.size * px}px` }}
          />
          <div
            className="bus-trip-fall pixelated"
            style={
              {
                top: -scenery.glass.size * px,
                width: "100%",
                height: `calc(100% + ${scenery.glass.size * px}px)`,
                backgroundImage: `url(${scenery.glass.trails})`,
                backgroundSize: `${scenery.glass.size * px}px ${scenery.glass.size * px}px`,
                animationDuration: "7s",
                "--fx": "0px",
                "--fy": `${scenery.glass.size * px}px`,
              } as CSSProperties
            }
          />
        </>
      )}
      {/* El reflejo del vidrio: dos franjas en diagonal, quietas. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(115deg, transparent 0 18%, rgb(255 255 255 / ${glare}) 18% 24%, transparent 24% 27%, rgb(255 255 255 / ${glare * 0.7}) 27% 29%, transparent 29% 100%)`,
        }}
      />
    </>
  );
});

/** El borde de la ventana (caucho negro con el filo lima) y los parales entre vidrio y vidrio. */
function WindowFrame({ px }: { px: number }) {
  const rubber = css(TINT[1]!);
  const edge = css(LIME[2]!);
  const shine = css(TINT[3]!);
  return (
    <>
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: `inset 0 0 0 ${3 * px}px ${rubber}, inset 0 0 0 ${4 * px}px ${shine}` }} />
      {[33.3, 66.6].map((x) => (
        <div
          key={x}
          className="pointer-events-none absolute inset-y-0"
          style={{
            left: `calc(${x}% - ${3 * px}px)`,
            width: 6 * px,
            background: `linear-gradient(to right, ${rubber} 0 ${px}px, ${edge} ${px}px ${2 * px}px, ${css(BLACK[2]!)} ${2 * px}px ${5 * px}px, ${shine} ${5 * px}px 100%)`,
          }}
        />
      ))}
    </>
  );
}

/** Un tubo lima con luz a la izquierda (o arriba) y sombra al otro lado, en franjas duras. */
const tube = (dir: "right" | "bottom", px: number) =>
  `linear-gradient(to ${dir}, ${css(LIME[1]!)} 0 ${px}px, ${css(LIME[6]!)} ${px}px ${2 * px}px, ${css(LIME[4]!)} ${2 * px}px ${4 * px}px, ${css(LIME[2]!)} ${4 * px}px ${5 * px}px, ${css(LIME[0]!)} ${5 * px}px 100%)`;

/** El techo, la pared de abajo con los espaldares y las barandas verde lima. */
function Interior({ px, ceil, wall }: { px: number; ceil: number; wall: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* Techo: panel oscuro con la franja de luz y el filo lima de la ventana. */}
      <div className="absolute inset-x-0 top-0" style={{ height: ceil, background: css(BLACK[2]!) }}>
        <div className="absolute inset-x-[6%]" style={{ top: Math.round(ceil * 0.08), height: 2 * px, background: "#fff4d6", opacity: 0.55 }} />
        <div className="absolute inset-x-0 bottom-0" style={{ height: 3 * px, background: `linear-gradient(to bottom, ${css(LIME[5]!)} 0 ${px}px, ${css(LIME[3]!)} ${px}px 100%)` }} />
      </div>
      {/* El pasamanos de arriba, colgado del techo. */}
      <div className="absolute inset-x-0" style={{ top: ceil + 4 * px, height: 6 * px, background: tube("bottom", px) }} />
      {[12, 37, 63, 88].map((x) => (
        <div key={x} className="absolute" style={{ left: `${x}%`, top: ceil - 2 * px, width: 2 * px, height: 7 * px, background: css(LIME[1]!) }} />
      ))}
      {/* La pared de abajo: el alféizar lima, el panel y los espaldares de las sillas. */}
      <div className="absolute inset-x-0 bottom-0" style={{ height: wall, background: css(BLACK[2]!) }}>
        <div className="absolute inset-x-0 top-0" style={{ height: 4 * px, background: `linear-gradient(to bottom, ${css(LIME[6]!)} 0 ${px}px, ${css(LIME[4]!)} ${px}px ${3 * px}px, ${css(LIME[1]!)} ${3 * px}px 100%)` }} />
        <div className="absolute inset-x-0" style={{ top: 4 * px, height: px, background: css(BLACK[0]!) }} />
        {[18, 50, 82].map((x) => (
          <div
            key={x}
            className="absolute"
            style={{
              left: `calc(${x}% - ${Math.round(wall * 0.55)}px)`,
              width: Math.round(wall * 1.1),
              top: Math.round(wall * 0.28),
              bottom: 0,
              background: `linear-gradient(to bottom, ${css(LIME[3]!)} 0 ${px}px, #24364a ${px}px ${3 * px}px, #1b2a3b ${3 * px}px 100%)`,
              boxShadow: `inset ${px}px 0 0 #2f4660, inset -${px}px 0 0 #142030`,
            }}
          />
        ))}
      </div>
      {/* Las barras de agarre, de piso a techo, delante de todo. */}
      {[9, 91].map((x) => (
        <div key={x} className="absolute inset-y-0" style={{ left: `calc(${x}% - ${3 * px}px)`, width: 6 * px, background: tube("right", px) }} />
      ))}
    </div>
  );
}

/** La pantallita de adentro: la próxima parada, la barra de lo que falta y quiénes van a bordo. */
function StopScreen({ view, stopName, riders, top }: { view: TripView; stopName: string; riders: readonly string[]; top: number }) {
  const led = css(LED[3]!);
  const ledSoft = css(LED[2]!);
  const secs = Math.ceil(view.etaMs / 1000);
  return (
    <div className="absolute left-1/2 flex w-[min(560px,calc(100%-2rem))] -translate-x-1/2 flex-col items-center gap-2" style={{ top }}>
      <div
        className="w-full border-4 px-4 py-2.5 shadow-[4px_4px_0_rgb(0_0_0_/_0.45)]"
        style={{ background: css(TINT[0]!), borderColor: css(BLACK[3]!), color: led, textShadow: `0 0 6px ${css(LED[1]!)}` }}
      >
        <div className="flex items-baseline justify-between gap-3 text-[12px] uppercase tracking-wider" style={{ color: ledSoft }}>
          <span className={view.bell && !view.arrived ? "bus-trip-blink" : undefined}>Megabús · {view.status}</span>
          <span>Pasaje gratis</span>
        </div>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 leading-tight" role="status" aria-live="polite">
          <span className="text-[14px]" style={{ color: ledSoft }}>
            {view.arrived ? "Parada:" : "Próxima parada:"}
          </span>
          <strong className={`text-[24px] font-semibold ${view.arrived ? "bus-trip-blink" : ""}`}>{stopName}</strong>
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div
            className="relative h-3.5 flex-1 border-2"
            style={{ borderColor: ledSoft, background: css(TINT[2]!) }}
            role="progressbar"
            aria-label="Lo que falta del viaje"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(view.progress * 100)}
          >
            <div className="bus-trip-bar h-full w-full origin-left" style={{ background: led, transform: `scaleX(${view.progress})` }} />
            <div className="pointer-events-none absolute inset-0" style={{ background: `repeating-linear-gradient(to right, transparent 0 8px, ${css(TINT[0]!)} 8px 10px)` }} />
          </div>
          <span className="w-12 text-right text-[13px] tabular-nums">{view.arrived ? "¡Ya!" : `${secs} s`}</span>
        </div>
      </div>
      {riders.length > 0 && (
        <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 text-[12px]">
          <span className="cozy-chip px-2 py-0.5 text-cozy-ink-soft">A bordo contigo</span>
          {riders.map((name, i) => (
            <span key={`${name}-${i}`} className="cozy-chip max-w-[12rem] truncate px-2 py-0.5">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Mezcla dos colores "#rrggbb" (para lavar el cielo con el clima). */
function mixHex(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((x >> sh) & 255) + ((((y >> sh) & 255) - ((x >> sh) & 255)) * t));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}
