"use client";

// El celular de tapa: sale desde abajo a la derecha, abre la tapa (con su "clac") y se maneja con la
// cruceta, el teclado numérico y las teclas de función, a clic o con el teclado de verdad (flechas,
// Enter, números, Esc, Borrar). Abierto, el teclado es del celular: el personaje no camina. Se descarga
// recién al sacarlo, como el PC.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { phoneSounds, stopRingtone } from "@/game/phone/audio";
import { bogotaTime, hhmm } from "@/game/phone/hora";
import { takeTypeAhead, usePhoneStore, useUnread, type PhoneSkin, type PhoneTarget } from "@/game/phone/state";
import { T9_LABELS } from "@/game/phone/t9";
import { useOfficeStore, type Profile } from "@/game/store";
import { llamaPixeles } from "../lumbre/marca";
import { PhoneContext, type KeyHandler, type PhoneCtx, type PhoneKey, type PhoneScreen, type SoftLabels } from "./kit";
import { StatusBar } from "./StatusBar";
import { EstadoApp, TemasApp, TonosApp } from "./screens/Ajustes";
import { ContactosApp } from "./screens/Contactos";
import { CulebritaApp } from "./screens/Culebrita";
import { HomeScreen, MenuScreen, useNow } from "./screens/Home";
import { MensajesApp } from "./screens/Mensajes";
import { CalculadoraApp, CamaraApp, RelojApp } from "./screens/Utiles";

// ---------- Medidas y colores de la carcasa ----------

const W = 216;
/** Alto de cada mitad (la tapa cerrada tapa justo el teclado). */
const HALF = 250;
const RISE_MS = 240;
const FLIP_MS = 380;

interface Skin {
  body: string;
  light: string;
  dark: string;
  gloss: number;
  key: string;
  keyLight: string;
  keyDark: string;
  keyInk: string;
  brand: string;
}

const SKIN: Record<PhoneSkin, Skin> = {
  negro: { body: "#242028", light: "#3b3542", dark: "#121014", gloss: 0.06, key: "#c9917a", keyLight: "#f1c8b0", keyDark: "#93604d", keyInk: "#2a1614", brand: "#e0ad95" },
  vino: { body: "#6b1426", light: "#992a3e", dark: "#3a0812", gloss: 0.16, key: "#d9a582", keyLight: "#f7d6ba", keyDark: "#9c6446", keyInk: "#3a0c14", brand: "#f0c6a4" },
  plata: { body: "#a9b0ba", light: "#e3e8ee", dark: "#666d78", gloss: 0.3, key: "#3d4a60", keyLight: "#6b7c98", keyDark: "#232c3c", keyInk: "#e8eef6", brand: "#3d4a60" },
};

/**
 * Esquinas en escalera (pixel) para clip-path: cada esquina baja con escalones chicos cerca del borde y
 * grandes hacia adentro, así se ve redondeada pero en píxeles. `top`/`bottom` son los escalones.
 */
function pixelCorners(top: number[], bottom: number[]): string {
  // La escalera de una esquina, de (0, r) a (r, 0): cerca del borde de al lado los escalones son altos
  // y angostos, cerca del de arriba son anchos y bajos.
  const stair = (dy: number[]) => {
    const dx = [...dy].reverse();
    let x = 0;
    let y = dy.reduce((a, b) => a + b, 0);
    const pts: [number, number][] = [[x, y]];
    dy.forEach((d, i) => {
      x += dx[i]!;
      pts.push([x, y]);
      y -= d;
      pts.push([x, y]);
    });
    return pts;
  };
  const t = stair(top);
  const b = stair(bottom);
  const L = (n: number) => `${n}px`;
  const R = (n: number) => `calc(100% - ${n}px)`;
  const pts = [
    ...t.map(([x, y]) => `${L(x)} ${L(y)}`),
    ...[...t].reverse().map(([x, y]) => `${R(x)} ${L(y)}`),
    ...b.map(([x, y]) => `${R(x)} ${R(y)}`),
    ...[...b].reverse().map(([x, y]) => `${L(x)} ${R(y)}`),
  ];
  return `polygon(${pts.join(", ")})`;
}

const LID_CLIP = pixelCorners([10, 4, 2, 2], [2, 2]);
const BASE_CLIP = pixelCorners([2, 2], [12, 5, 3, 2]);
const BEZEL_CLIP = pixelCorners([4, 2], [4, 2]);

/** Carcasa brillante: bordes con luz y sombra y una franja de brillo en diagonal (más en el vino). */
const shellStyle = (s: Skin, clip: string): CSSProperties => ({
  clipPath: clip,
  background: `linear-gradient(105deg, transparent 0 16%, rgb(255 255 255 / ${s.gloss}) 16% 22%, transparent 22% 70%, rgb(255 255 255 / ${s.gloss / 2}) 70% 73%, transparent 73%), ${s.body}`,
  boxShadow: `inset 3px 0 0 ${s.light}, inset -3px 0 0 ${s.dark}, inset 0 3px 0 ${s.light}, inset 0 -3px 0 ${s.dark}`,
});

const keyStyle = (s: Skin, pressed: boolean): CSSProperties => ({
  background: pressed
    ? `linear-gradient(${s.keyDark} 0 30%, ${s.key} 30%)`
    : `linear-gradient(${s.keyLight} 0 30%, ${s.key} 30% 78%, ${s.keyDark} 78%)`,
  color: s.keyInk,
  border: `1px solid ${s.dark}`,
  transform: pressed ? "translateY(1px)" : undefined,
});

// ---------- Teclado de verdad → teclas del celular ----------

const PHYSICAL: Record<string, PhoneKey> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "ok",
  Escape: "esc",
  Backspace: "back",
  Delete: "back",
  PageUp: "softL",
  PageDown: "softR",
  Home: "call",
  End: "end",
};
/** Teclas que se pueden dejar apretadas (las demás cuentan una vez: el multi-toque las necesita así). */
const REPEATS = new Set<PhoneKey>(["up", "down", "left", "right", "back"]);

const isField = (el: EventTarget | null) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el instanceof HTMLElement && el.isContentEditable);

function physicalKey(e: KeyboardEvent): PhoneKey | null {
  const mapped = PHYSICAL[e.key];
  if (mapped) return mapped;
  if (/^[0-9*#]$/.test(e.key)) return e.key as PhoneKey;
  if (e.key.length === 1) return `char:${e.key}`;
  return null;
}

// ---------- El celular ----------

type Phase = "down" | "rising" | "opening" | "open" | "closing" | "sinking";

/** El logo al prender la primera vez en la visita (después abre directo, como al levantar la tapa). */
let bootedOnce = false;

/** La pantalla que corresponde a un pedido (Enter en la cabaña, el botón de Chat, un aviso). */
function screenFor(t: PhoneTarget): PhoneScreen {
  if (!t) return { kind: "home" };
  return { kind: "app", id: "mensajes", params: { compose: { scope: t.scope, text: t.text }, quick: t.quick } };
}

export function Phone({ profile }: { profile: Profile }) {
  const open = usePhoneStore((s) => s.open);
  const skinId = usePhoneStore((s) => s.skin);
  const ringing = usePhoneStore((s) => s.ringing);
  const buzzAt = usePhoneStore((s) => s.buzzAt);
  const skin = SKIN[skinId];
  const [phase, setPhase] = useState<Phase>("down");
  const request = usePhoneStore((s) => s.request);
  const [screen, setScreen] = useState<PhoneScreen>(() => screenFor(request.target));
  const [soft, setSoft] = useState<SoftLabels>({});
  const [pressed, setPressed] = useState<string | null>(null);
  // Para chatear rápido (Enter) no se muestra el logo: se abre directo.
  const [booting, setBooting] = useState(() => !bootedOnce && !request.target);
  const [buzzing, setBuzzing] = useState(false);
  const keys = useRef<KeyHandler | null>(null);
  /** Lo que se tecleó mientras la tapa se abría: se entrega apenas está lista (no se pierden letras). */
  const queued = useRef<[PhoneKey, boolean][]>([]);
  const firstRequest = useRef(request.nonce);

  // Un pedido nuevo con el celular ya afuera (p. ej. el botón de Chat): se va a esa pantalla.
  useEffect(() => {
    if (request.nonce === firstRequest.current) return;
    firstRequest.current = request.nonce;
    if (request.target) setScreen(screenFor(request.target));
  }, [request]);
  const scale = usePhoneScale();

  // Mientras está afuera, el teclado es del celular: lo marca `show` y lo suelta `closed` (state.ts).

  // Sale: sube cerrado, abre la tapa. Se guarda: cierra la tapa (clac) y baja.
  // Con un temporizador y no con requestAnimationFrame: ese se congela con la pestaña detrás de otra
  // ventana, y lo tecleado quedaría esperando a que la tapa abra.
  useEffect(() => {
    const t = setTimeout(() => setPhase("rising"), 30);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    };
    if (phase === "rising")
      return later(() => {
        setPhase("opening");
        phoneSounds.flipOpen();
      }, RISE_MS);
    if (phase === "opening") return later(() => setPhase("open"), FLIP_MS);
    if (phase === "closing")
      return later(() => {
        phoneSounds.flipClose();
        setPhase("sinking");
      }, FLIP_MS);
    if (phase === "sinking") return later(() => usePhoneStore.getState().closed(), RISE_MS);
  }, [phase]);
  useEffect(() => {
    if (!open && phase !== "closing" && phase !== "sinking") setPhase("closing");
    if (open && (phase === "closing" || phase === "sinking")) setPhase("opening");
    // Solo reacciona a abrir/guardar (la fase la mueve el efecto de arriba).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!booting || phase !== "open") return;
    const t = setTimeout(() => {
      bootedOnce = true;
      setBooting(false);
    }, 1100);
    return () => clearTimeout(t);
  }, [booting, phase]);

  // Si se prende el PC o se abre un panel encima, el celular se guarda (si no, le robaría las teclas).
  const covered = useOfficeStore((s) => s.pcOn || Boolean(s.panel));
  useEffect(() => {
    if (covered) usePhoneStore.getState().hide();
  }, [covered]);

  // Vibra con un mensaje nuevo o la alarma.
  useEffect(() => {
    if (!buzzAt) return;
    setBuzzing(true);
    const t = setTimeout(() => setBuzzing(false), 650);
    return () => clearTimeout(t);
  }, [buzzAt]);

  const ctx = useMemo<PhoneCtx>(
    () => ({
      keys,
      setSoft,
      go: (s) => setScreen(s),
      back: () =>
        setScreen((s) => {
          if (s.kind === "app") return { kind: "menu" };
          if (s.kind === "menu") return { kind: "home" };
          usePhoneStore.getState().hide();
          return s;
        }),
      home: () => setScreen({ kind: "home" }),
      close: (after) => usePhoneStore.getState().hide(after),
    }),
    [],
  );

  const flashKey = useCallback((id: string) => {
    setPressed(id);
    setTimeout(() => setPressed((p) => (p === id ? null : p)), 120);
  }, []);

  const ready = phase === "open" && !booting;
  /** Atiende una tecla con el celular listo. */
  const handle = useCallback(
    (k: PhoneKey, physical: boolean) => {
      if (k.length === 1) phoneSounds.key(k);
      else if (!k.startsWith("char:")) phoneSounds.nav();
      if (!k.startsWith("char:")) flashKey(k);
      // Sonando la alarma, cualquier tecla la apaga.
      if (usePhoneStore.getState().ringing) {
        stopRingtone();
        usePhoneStore.getState().setRinging(false);
        return;
      }
      const h = keys.current;
      if (h?.(k, physical)) return;
      if (k === "softL" && h?.("ok", physical)) return;
      if (k === "esc" && h?.("softR", physical)) return;
      if (k === "softR" || k === "back" || k === "esc") return ctx.back();
      if (k === "end") return screen.kind === "home" ? ctx.close() : ctx.home();
      if (k === "char:c" || k === "char:C") return ctx.close();
    },
    [screen.kind, ctx, flashKey],
  );
  /**
   * Una tecla: si la tapa todavía se abre (o quedan teclas en fila), va a la fila, para que lo tecleado
   * rápido después de Enter llegue completo y en orden.
   */
  const dispatch = useCallback(
    (k: PhoneKey, physical = false) => {
      if (!ready || queued.current.length > 0) {
        if (physical && phase !== "closing" && phase !== "sinking" && queued.current.length < 80) queued.current.push([k, physical]);
        return;
      }
      handle(k, physical);
    },
    [ready, phase, handle],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = physicalKey(e);
      if (!k) return;
      e.preventDefault();
      if (e.repeat && !REPEATS.has(k)) return;
      dispatch(k, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);
  // Lo que se tecleó mientras se descargaba el celular entra primero en la fila.
  useEffect(() => {
    for (const e of takeTypeAhead()) {
      const k = physicalKey(e);
      if (k) queued.current.push([k, true]);
    }
  }, []);
  // Ya abierta y con la pantalla puesta: lo tecleado antes llega en orden.
  useEffect(() => {
    if (!ready || queued.current.length === 0) return;
    const pending = queued.current;
    queued.current = [];
    for (const [k, physical] of pending) handle(k, physical);
  }, [ready, handle]);

  const lidClosed = phase === "down" || phase === "rising" || phase === "closing" || phase === "sinking";
  const lowered = phase === "down" || phase === "sinking";

  return (
    <div className="pointer-events-none absolute right-3 bottom-3 z-20 max-sm:right-1/2 max-sm:translate-x-1/2">
      <div style={{ transform: `scale(${scale})`, transformOrigin: "bottom right" }} className="max-sm:origin-bottom!">
        <div
          className={buzzing ? "phone-buzz" : undefined}
          style={{
            width: W,
            height: HALF * 2,
            transform: lowered ? `translateY(${HALF + 40}px)` : "translateY(0)",
            opacity: lowered ? 0 : 1,
            transition: `transform ${RISE_MS}ms ${lowered ? "ease-in" : "ease-out"}, opacity ${RISE_MS}ms`,
            perspective: 900,
            perspectiveOrigin: `50% ${HALF}px`,
            position: "relative",
          }}
          role="application"
          aria-label="Celular"
        >
          <PhoneContext.Provider value={ctx}>
            <Base skin={skin} pressed={pressed} onKey={dispatch} />
            {/* La tapa gira sobre la bisagra: de frente la pantalla, de espaldas la tapa de afuera. */}
            <div
              className="pointer-events-auto"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: W,
                height: HALF,
                transformOrigin: "50% 100%",
                transform: `rotateX(${lidClosed ? -180 : 0}deg)`,
                transition: `transform ${FLIP_MS}ms cubic-bezier(.3,.1,.3,1.2)`,
                transformStyle: "preserve-3d",
              }}
            >
              <Face>
                <LidInside skin={skin}>
                  {booting ? (
                    <BootScreen />
                  ) : ringing ? (
                    <AlarmScreen />
                  ) : (
                    <>
                      <StatusBar />
                      <div className="relative flex min-h-0 flex-1 flex-col">
                        <ScreenRouter screen={screen} profile={profile} />
                      </div>
                      <SoftBar soft={soft} onKey={dispatch} />
                    </>
                  )}
                </LidInside>
              </Face>
              <Face back>
                <LidOutside skin={skin} />
              </Face>
            </div>
          </PhoneContext.Provider>
        </div>
      </div>
    </div>
  );
}

/** Achica el celular si la ventana es baja o angosta (nunca lo agranda). */
function usePhoneScale(): number {
  const calc = () => (typeof window === "undefined" ? 1 : Math.min(1, (window.innerHeight - 24) / (HALF * 2), (window.innerWidth - 24) / W));
  const [s, setS] = useState(calc);
  useEffect(() => {
    const on = () => setS(calc());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return Math.max(0.55, s);
}

function Face({ back = false, children }: { back?: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: back ? "rotateX(180deg)" : undefined,
        filter: "drop-shadow(5px 5px 0 rgb(20 10 24 / 0.45))",
      }}
    >
      {children}
    </div>
  );
}

function ScreenRouter({ screen, profile }: { screen: PhoneScreen; profile: Profile }) {
  if (screen.kind === "home") return <HomeScreen />;
  if (screen.kind === "menu") return <MenuScreen />;
  switch (screen.id) {
    case "mensajes":
      return <MensajesApp params={screen.params} />;
    case "contactos":
      return <ContactosApp />;
    case "camara":
      return <CamaraApp />;
    case "culebrita":
      return <CulebritaApp />;
    case "tonos":
      return <TonosApp />;
    case "temas":
      return <TemasApp />;
    case "reloj":
      return <RelojApp />;
    case "calculadora":
      return <CalculadoraApp />;
    case "info":
      return <EstadoApp profile={profile} />;
  }
}

function SoftBar({ soft, onKey }: { soft: SoftLabels; onKey: (k: PhoneKey) => void }) {
  return (
    <div className="flex h-[14px] shrink-0 items-center justify-between bg-[#0e1422] px-1 text-[10px] leading-none text-cozy-paper-light">
      <button type="button" className="min-w-8 text-left" onClick={() => onKey("softL")}>
        {soft.left ?? ""}
      </button>
      <span className="text-[#8a9ac0]">{soft.center ?? ""}</span>
      <button type="button" className="min-w-8 text-right" onClick={() => onKey("softR")}>
        {soft.right ?? ""}
      </button>
    </div>
  );
}

function BootScreen() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), 220);
    return () => clearInterval(id);
  }, []);
  const { w, h, pixeles } = llamaPixeles(frame % 2 === 0 ? 0 : 1);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-[#2a2033] text-cozy-paper-light">
      <svg width={w * 3} height={h * 3} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden>
        {pixeles.map((p) => (
          <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width={1} height={1} fill={p.color} />
        ))}
      </svg>
      <span className="text-[13px] tracking-[0.3em]">HYVENTO</span>
    </div>
  );
}

function AlarmScreen() {
  const now = bogotaTime(useNow(500));
  const shake = Math.floor(Date.now() / 150) % 2 === 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 bg-cozy-gold text-cozy-ink">
      <svg width="40" height="40" viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden style={{ transform: `rotate(${shake ? -8 : 8}deg)` }}>
        <path d="M3 0h2v1h1v1h1v4h1v1H0V6h1V2h1V1h1z M3 7h2v1H3z" fill="#5b2b0e" />
      </svg>
      <span className="text-[26px] leading-none font-semibold">{hhmm(now)}</span>
      <span className="text-[12px]">¡Alarma!</span>
      <span className="text-[10px]">Cualquier tecla la apaga</span>
    </div>
  );
}

// ---------- Las partes de la carcasa ----------

function LidInside({ skin, children }: { skin: Skin; children: ReactNode }) {
  return (
    <div className="absolute inset-0" style={shellStyle(skin, LID_CLIP)}>
      {/* Parlante: la ranura de arriba. */}
      <div className="absolute top-[9px] left-1/2 flex h-[6px] w-[46px] -translate-x-1/2 items-center justify-center gap-[3px]" style={{ background: skin.dark }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="h-[2px] w-[6px]" style={{ background: skin.light }} />
        ))}
      </div>
      {/* Marco negro con la pantalla adentro. */}
      <div className="absolute top-[20px] left-[10px] h-[190px] w-[196px] bg-[#0b090d]" style={{ clipPath: BEZEL_CLIP }}>
        <div className="absolute top-[8px] left-[8px] flex h-[166px] w-[180px] flex-col overflow-hidden bg-cozy-paper font-pixel">{children}</div>
        <span className="absolute bottom-[3px] left-1/2 -translate-x-1/2 text-[9px] leading-none tracking-[0.35em] text-[#5a5460]">HYVENTO</span>
      </div>
      <span className="absolute top-[220px] left-1/2 -translate-x-1/2 font-pixel text-[11px] leading-none tracking-[0.3em]" style={{ color: skin.brand }}>
        H-200
      </span>
      {/* Los nudillos de la bisagra, abajo a los costados. */}
      <span className="absolute bottom-0 left-[8px] h-[10px] w-[22px]" style={{ background: `linear-gradient(${skin.keyDark} 0 25%, ${skin.key} 25% 55%, ${skin.keyLight} 55% 75%, ${skin.keyDark} 75%)` }} />
      <span className="absolute right-[8px] bottom-0 h-[10px] w-[22px]" style={{ background: `linear-gradient(${skin.keyDark} 0 25%, ${skin.key} 25% 55%, ${skin.keyLight} 55% 75%, ${skin.keyDark} 75%)` }} />
    </div>
  );
}

/** La tapa por fuera (se ve con el celular cerrado): cámara, pantallita con la hora y el nombre. */
function LidOutside({ skin }: { skin: Skin }) {
  const now = bogotaTime(useNow(5000));
  const unread = useUnread();
  return (
    <div className="absolute inset-0" style={shellStyle(skin, pixelCorners([2, 2], [12, 5, 3, 2]))}>
      {/* Lente de la cámara con aro cobrizo. */}
      <div className="absolute top-[26px] left-1/2 grid h-[26px] w-[26px] -translate-x-1/2 place-items-center" style={{ background: skin.key, clipPath: BEZEL_CLIP }}>
        <div className="relative h-[18px] w-[18px] bg-[#0b0a12]" style={{ clipPath: BEZEL_CLIP }}>
          <span className="absolute top-[4px] left-[4px] h-[3px] w-[3px] bg-[#7fa8d8]" />
        </div>
      </div>
      {/* Pantallita externa. */}
      <div className="absolute top-[76px] left-1/2 flex h-[34px] w-[76px] -translate-x-1/2 flex-col items-center justify-center border-2 bg-[#081624] font-pixel" style={{ borderColor: skin.dark }}>
        <span className="text-[18px] leading-none text-[#7fc8ff]" style={{ textShadow: "0 0 4px #3f88c8" }}>
          {hhmm(now)}
        </span>
        {unread > 0 && <span className="text-[8px] leading-none text-[#ffcf4a]">{unread} nuevo{unread === 1 ? "" : "s"}</span>}
      </div>
      <div className="absolute top-[160px] right-[24px] left-[24px] h-[3px]" style={{ background: skin.key }} />
      <span className="absolute top-[178px] left-1/2 -translate-x-1/2 font-pixel text-[14px] leading-none tracking-[0.35em]" style={{ color: skin.brand }}>
        HYVENTO
      </span>
    </div>
  );
}

/** Lo que va impreso junto al número (en mayúsculas, como en los teclados de antes). */
const keyLetters = (k: string) => (k === "0" ? "␣" : k === "*" ? "Aa" : (T9_LABELS[k] ?? "").toUpperCase());

// Auricular (llamar) y auricular colgado (terminar), en píxeles.
const HANDSET = ["##.....", "###....", "##.....", ".##....", "..##.##", "...####", ".....##"];
const HANGUP = [".......", "..###..", ".#####.", "##...##", "##...##", ".......", "......."];

function Glyph({ rows }: { rows: string[] }) {
  return (
    <svg width="14" height="14" viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((r, y) => [...r].map((c, x) => (c === "#" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null)))}
    </svg>
  );
}

/** La mitad de abajo: bisagra, teclas de función, cruceta, llamar/colgar y el teclado de 12 teclas. */
function Base({ skin, pressed, onKey }: { skin: Skin; pressed: string | null; onKey: (k: PhoneKey) => void }) {
  const btn = (id: PhoneKey, cls: string, style: CSSProperties, children: ReactNode, label: string) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onKey(id)}
      className={`pointer-events-auto absolute grid place-items-center font-pixel ${cls}`}
      style={{ ...keyStyle(skin, pressed === id), ...style }}
    >
      {children}
    </button>
  );
  const keysGrid: PhoneKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  return (
    <div className="absolute left-0" style={{ top: HALF, width: W, height: HALF, filter: "drop-shadow(5px 5px 0 rgb(20 10 24 / 0.45))" }}>
      <div className="pointer-events-auto absolute inset-0" style={shellStyle(skin, BASE_CLIP)} />
      {/* Bisagra: el cilindro entre las dos mitades. */}
      <div
        className="absolute top-0 left-[40px] h-[12px] w-[136px]"
        style={{ background: `linear-gradient(${skin.keyDark} 0 20%, ${skin.key} 20% 45%, ${skin.keyLight} 45% 65%, ${skin.key} 65% 85%, ${skin.keyDark} 85%)` }}
      />
      {btn("softL", "top-[24px] left-[14px] h-[12px] w-[40px]", {}, <span className="h-[2px] w-[14px]" style={{ background: skin.keyInk }} />, "Tecla izquierda")}
      {btn("softR", "top-[24px] right-[14px] h-[12px] w-[40px]", {}, <span className="h-[2px] w-[14px]" style={{ background: skin.keyInk }} />, "Tecla derecha")}
      {btn(
        "call",
        "top-[46px] left-[14px] h-[20px] w-[40px]",
        { background: pressed === "call" ? "#2f6e2a" : "linear-gradient(#7fd06a 0 30%, #4f9a3c 30% 78%, #2f6e2a 78%)", color: "#fdf0c8" },
        <Glyph rows={HANDSET} />,
        "Llamar (mensajes)",
      )}
      {btn(
        "end",
        "top-[46px] right-[14px] h-[20px] w-[40px]",
        { background: pressed === "end" ? "#8a1f1f" : "linear-gradient(#f07060 0 30%, #d93a2b 30% 78%, #8a1f1f 78%)", color: "#fdf0c8" },
        <Glyph rows={HANGUP} />,
        "Colgar (inicio o guardar)",
      )}
      {/* Cruceta cuadrada con OK al medio. */}
      <div className="absolute top-[20px] left-[75px] h-[66px] w-[66px]" style={{ background: skin.dark, clipPath: BEZEL_CLIP }}>
        {btn("up", "top-[3px] left-[21px] h-[18px] w-[24px]", {}, <Arrow dir="up" />, "Arriba")}
        {btn("down", "bottom-[3px] left-[21px] h-[18px] w-[24px]", {}, <Arrow dir="down" />, "Abajo")}
        {btn("left", "top-[21px] left-[3px] h-[24px] w-[18px]", {}, <Arrow dir="left" />, "Izquierda")}
        {btn("right", "top-[21px] right-[3px] h-[24px] w-[18px]", {}, <Arrow dir="right" />, "Derecha")}
        {btn("ok", "top-[21px] left-[21px] h-[24px] w-[24px] text-[10px] font-semibold", { background: pressed === "ok" ? skin.keyDark : skin.keyLight }, "OK", "OK")}
      </div>
      {/* Teclado de 12 teclas con sus letras. */}
      <div className="absolute top-[98px] left-[21px] grid grid-cols-3 gap-x-[6px] gap-y-[5px]">
        {keysGrid.map((k) => (
          <button
            key={k}
            type="button"
            aria-label={`Tecla ${k}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onKey(k)}
            className="pointer-events-auto flex h-[28px] w-[54px] items-center justify-center gap-1 font-pixel"
            style={keyStyle(skin, pressed === k)}
          >
            <span className="text-[14px] leading-none font-semibold">{k}</span>
            <span className="max-w-[26px] truncate text-[8px] leading-none opacity-80">{keyLetters(k)}</span>
          </button>
        ))}
      </div>
      {/* Micrófono. */}
      <span className="absolute bottom-[10px] left-1/2 h-[3px] w-[8px] -translate-x-1/2" style={{ background: skin.dark }} />
    </div>
  );
}

function Arrow({ dir }: { dir: "up" | "down" | "left" | "right" }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg width="8" height="8" viewBox="0 0 5 5" shapeRendering="crispEdges" aria-hidden style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M2 1h1v1h1v1h1v1H0V3h1V2h1z" fill="currentColor" />
    </svg>
  );
}
