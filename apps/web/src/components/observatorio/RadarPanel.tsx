"use client";

// El radar de señales del observatorio: se gira el plato (flechas, la rueda o el control) y se oye más
// fuerte lo que suena en esa dirección del mapa: las radios prendidas, el club del sótano cuando hay
// música, alguien tocando un instrumento y la gente. Una flechita apunta a lo que más suena. Todo sale del
// estado de la sala: el radar no da nada, solo ayuda a encontrar a los demás.
import { getWorld, radarPosition, type World } from "@hyvento/map";
import { furnitureKey, isPlaying, RADAR, radarSignals, type Signal, type SignalKind, type SignalSource } from "@hyvento/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClubStore } from "@/game/club/store";
import { getRoom } from "@/game/network";
import { useObservatorio } from "@/game/observatorio";
import { audioOut } from "@/game/sound";
import { useOfficeStore } from "@/game/store";
import { PanelShell } from "../PointsPanels";
import { PixelIcon } from "../Cozy";

const KIND_TEXT: Record<SignalKind, string> = { radio: "Radio", club: "Música del club", piano: "Instrumento", persona: "Persona" };
const KIND_COLOR: Record<SignalKind, string> = { radio: "#e9c65a", club: "#ff5fd2", piano: "#8ef0f0", persona: "#8cc653" };
/** Tono con que suena cada cosa en los audífonos. */
const KIND_TONE: Record<SignalKind, number> = { radio: 523, club: 131, piano: 659, persona: 330 };
const AREA_NAME: Record<string, string> = {
  jardin: "el jardín",
  "planta-baja": "la planta baja",
  "piso-2": "el piso 2",
  "piso-3": "el piso 3",
  sotano: "el sótano",
  garaje: "el garaje",
  observatorio: "el observatorio",
};
const INSTRUMENT: Record<string, string> = { piano: "Piano", guitar: "Guitarra" };

/** Lo que suena ahora en toda la cabaña, en tiles del jardín. */
function soundSources(world: World, me: string | null): SignalSource[] {
  const room = getRoom();
  const out: SignalSource[] = [];
  const at = (area: string, x: number, y: number) => radarPosition(world, area, x, y);
  if (room) {
    room.state.players.forEach((p, id) => {
      if (id === me) return;
      const pos = at(p.area, p.x, p.y);
      if (pos) out.push({ id: `persona:${id}`, label: `${p.name} (${AREA_NAME[p.area] ?? p.area})`, kind: "persona", ...pos, loudness: p.status === "away" ? 0.25 : 0.6 });
    });
    for (const [areaId, map] of world.areas)
      for (const f of map.furniture) {
        if (f.type !== "radio" || room.state.switches.get(furnitureKey(areaId, f.type, f.x, f.y)) !== true) continue;
        const pos = at(areaId, (f.x + 0.5) * map.tileSize, (f.y + 0.5) * map.tileSize);
        if (pos) out.push({ id: `radio:${areaId}:${f.x},${f.y}`, label: `Radio de ${AREA_NAME[areaId] ?? areaId}`, kind: "radio", ...pos, loudness: 0.85 });
      }
  }
  if (isPlaying(useClubStore.getState())) {
    const sotano = world.areas.get("sotano");
    const booth = sotano?.furniture.find((f) => f.type === "dj-booth");
    const pos = booth && sotano && at("sotano", booth.x * sotano.tileSize, booth.y * sotano.tileSize);
    if (pos) out.push({ id: "club", label: "El club del sótano", kind: "club", ...pos, loudness: 1 });
  }
  const now = performance.now();
  for (const ping of useObservatorio.getState().pings) {
    if (now - ping.at > RADAR.pingMs) continue;
    const map = world.areas.get(ping.area);
    const pos = map && at(ping.area, (ping.x + 0.5) * map.tileSize, (ping.y + 0.5) * map.tileSize);
    if (pos) out.push({ id: `piano:${ping.area}:${ping.x},${ping.y}`, label: `${INSTRUMENT[ping.type] ?? "Instrumento"} en ${AREA_NAME[ping.area] ?? ping.area}`, kind: "piano", ...pos, loudness: 0.9 * (1 - (now - ping.at) / RADAR.pingMs) + 0.1 });
  }
  return out;
}

/** El ruido y el tono de los audífonos, que suben y bajan con la señal. */
function useRadarSound() {
  const nodes = useRef<{ noise: GainNode; tone: GainNode; osc: OscillatorNode; stop: () => void } | null>(null);
  useEffect(() => {
    const a = audioOut();
    if (!a) return;
    const { ctx, out } = a;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1800;
    band.Q.value = 0.7;
    const noise = ctx.createGain();
    noise.gain.value = 0;
    src.connect(band).connect(noise).connect(out);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    const tone = ctx.createGain();
    tone.gain.value = 0;
    osc.connect(tone).connect(out);
    src.start();
    osc.start();
    nodes.current = {
      noise,
      tone,
      osc,
      stop: () => {
        noise.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        tone.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        src.stop(ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
      },
    };
    return () => {
      nodes.current?.stop();
      nodes.current = null;
    };
  }, []);
  return useCallback((top: Signal | undefined, t: number) => {
    const n = nodes.current;
    const a = audioOut();
    if (!n || !a) return;
    const s = top?.strength ?? 0;
    n.noise.gain.setTargetAtTime(0.05 * (1 - s) + 0.01, a.ctx.currentTime, 0.1);
    // Cada cosa suena distinto: la radio ondula, el club late, el instrumento salta de nota y la gente zumba.
    const kind = top?.source.kind;
    const base = kind ? KIND_TONE[kind] : 220;
    const f = kind === "radio" ? base * (1 + 0.03 * Math.sin(t / 120)) : kind === "piano" ? base * [1, 1.25, 1.5][Math.floor(t / 300) % 3]! : base;
    const pulse = kind === "club" ? 0.5 + 0.5 * Math.max(0, Math.sin(t / 130)) : 1;
    n.osc.frequency.setTargetAtTime(f, a.ctx.currentTime, 0.03);
    n.tone.gain.setTargetAtTime(0.12 * s * pulse, a.ctx.currentTime, 0.06);
  }, []);
}

const D = 220;

export function RadarPanel({ onClose }: { onClose: () => void }) {
  const world = useMemo(() => getWorld(), []);
  const me = useOfficeStore((s) => s.sessionId);
  const [aim, setAim] = useState(300);
  const [signals, setSignals] = useState<Signal[]>([]);
  const ref = useRef<HTMLCanvasElement>(null);
  const sound = useRadarSound();
  const origin = useMemo(() => {
    const obs = world.areas.get("observatorio");
    const p = obs?.points.find((q) => q.type === "signal_radar");
    return (obs && p && radarPosition(world, "observatorio", p.x, p.y)) || { x: 0, y: 0 };
  }, [world]);
  // Flechas del teclado para girar el plato (el panel deja el teclado para la UI).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") setAim((v) => (v + 356) % 360);
      if (e.key === "ArrowRight" || e.key === "d") setAim((v) => (v + 4) % 360);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    let id = 0;
    let last = 0;
    const loop = () => {
      const t = performance.now();
      const sources = soundSources(world, me);
      const heard = radarSignals(origin, aim, sources);
      sound(heard[0], t);
      if (t - last > 150) {
        last = t;
        setSignals(heard);
      }
      const c = ref.current?.getContext("2d");
      if (c) {
        c.imageSmoothingEnabled = false;
        c.fillStyle = "#0f2238";
        c.fillRect(0, 0, D, D);
        const cx = D / 2;
        const cy = D / 2;
        const R = D / 2 - 8;
        // Anillos y el haz hacia donde apunta el plato.
        c.strokeStyle = "rgba(95, 196, 191, 0.35)";
        for (const r of [R, R * 0.66, R * 0.33]) {
          c.beginPath();
          c.arc(cx, cy, r, 0, Math.PI * 2);
          c.stroke();
        }
        const rad = (aim * Math.PI) / 180;
        const beam = (RADAR.beamDeg * Math.PI) / 180;
        c.fillStyle = "rgba(142, 240, 240, 0.16)";
        c.beginPath();
        c.moveTo(cx, cy);
        c.arc(cx, cy, R, rad - beam, rad + beam);
        c.closePath();
        c.fill();
        // Cada cosa que suena es un puntito en su dirección (más cerca del centro si está cerca).
        for (const s of radarSignals(origin, aim, sources.map((x) => ({ ...x, loudness: 1 })))) {
          const k = Math.min(1, s.dist / 70);
          const b = (s.bearing * Math.PI) / 180;
          c.fillStyle = KIND_COLOR[s.source.kind];
          c.globalAlpha = 0.35 + 0.65 * Math.min(1, s.strength * 1.5);
          c.fillRect(Math.round(cx + Math.cos(b) * R * (0.2 + 0.8 * k)) - 1, Math.round(cy + Math.sin(b) * R * (0.2 + 0.8 * k)) - 1, 3, 3);
        }
        c.globalAlpha = 1;
        // La flechita hacia lo que más suena.
        const top = heard[0];
        if (top) {
          const b = (top.bearing * Math.PI) / 180;
          const tip = { x: cx + Math.cos(b) * (R - 4), y: cy + Math.sin(b) * (R - 4) };
          c.strokeStyle = "#fde38a";
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(cx, cy);
          c.lineTo(tip.x, tip.y);
          c.stroke();
          c.fillStyle = "#fde38a";
          c.beginPath();
          c.moveTo(tip.x + Math.cos(b) * 6, tip.y + Math.sin(b) * 6);
          c.lineTo(tip.x + Math.cos(b + 2.4) * 7, tip.y + Math.sin(b + 2.4) * 7);
          c.lineTo(tip.x + Math.cos(b - 2.4) * 7, tip.y + Math.sin(b - 2.4) * 7);
          c.closePath();
          c.fill();
          c.lineWidth = 1;
        }
        c.fillStyle = "#dcae3f";
        c.fillRect(cx - 2, cy - 2, 5, 5);
      }
      id = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(id);
  }, [aim, me, origin, sound, world]);

  const top = signals[0];
  return (
    <PanelShell title="Radar de señales" icon="sound" onClose={onClose} wide>
      <div className="flex gap-4 max-sm:flex-col">
        <div className="flex flex-col items-center gap-2">
          <canvas
            ref={ref}
            width={D}
            height={D}
            className="h-56 w-56 border-4 border-cozy-wood [image-rendering:pixelated]"
            aria-label="Dial del radar"
            onWheel={(e) => setAim((v) => (v + (e.deltaY > 0 ? 6 : -6) + 360) % 360)}
          />
          <div className="flex items-center gap-2">
            <button type="button" className="cozy-btn px-2 py-1" onClick={() => setAim((v) => (v + 345) % 360)} aria-label="Girar a la izquierda">
              <PixelIcon name="back" size={11} />
            </button>
            <input type="range" min={0} max={359} value={aim} onChange={(e) => setAim(Number(e.target.value))} aria-label="Hacia dónde apunta el plato" />
            <button type="button" className="cozy-btn px-2 py-1" onClick={() => setAim((v) => (v + 15) % 360)} aria-label="Girar a la derecha">
              <PixelIcon name="play" size={11} />
            </button>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 text-[14px]">
          <p className="text-cozy-ink-soft">
            Gira el plato con las flechas o la rueda. Lo que suena en esa dirección se oye más fuerte en los audífonos; la flechita dorada apunta a lo que más
            suena.
          </p>
          <p className="font-semibold" aria-live="polite">
            {top ? `Lo más fuerte: ${top.source.label}` : "Solo estática. Prueba hacia otro lado."}
          </p>
          <ul className="flex flex-col gap-1.5">
            {signals.slice(0, 5).map((s) => (
              <li key={s.source.id} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0" style={{ background: KIND_COLOR[s.source.kind] }} />
                <span className="min-w-0 flex-1 truncate">
                  {s.source.label} <span className="text-cozy-ink-soft">· {KIND_TEXT[s.source.kind]}</span>
                </span>
                <span className="h-2.5 w-20 shrink-0 border-2 border-cozy-wood bg-cozy-paper-dark">
                  <span className="block h-full bg-cozy-green" style={{ width: `${Math.round(s.strength * 100)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PanelShell>
  );
}
