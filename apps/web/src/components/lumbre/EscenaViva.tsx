"use client";

// La ilustración viva de la portada: la casa del jardín dibujada con el motor del juego (con las
// ventanas encendidas), luces que titilan y gente: dos que caminan por el sendero y dos charlando en
// la fogata. Con "menos movimiento" todo queda quieto. Fuera de pantalla no se anima. La casa es una
// imagen del build (scripts/prerender.ts): la portada no carga el motor de arte.
import { randomLook, seededRandom, type Direction, type HumanAvatar, type Look } from "@hyvento/shared";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { prefiereQuieto, useEscena } from "./dibujo";
import { aLienzo, enRecorrido, ESCENA_PAD as PAD, LLEGADA, PASEO, RONDA, type Recorrido } from "./escena";
import { Personaje } from "./Personaje";

/** Con "menos movimiento" cada caminante queda parado a esta distancia de su punta de salida. */
const QUIETO_EN = 1.6;
/** Tiles por segundo (el juego camina un poco más rápido; aquí es un paseo). */
const VELOCIDAD = 1.15;

interface Caminante {
  avatar: HumanAvatar;
  look: Look | null;
  recorrido: Recorrido;
  /** Desfase en tiles, para que no arranquen juntos. */
  desde: number;
  pausa: number;
}

export function EscenaViva({ className = "", saludo = "¡hola equipo!" }: { className?: string; saludo?: string }) {
  // De noche, con las ventanas encendidas (la del día también sale del build).
  const escena = useEscena(true);
  const dibujo = escena?.dibujo ?? null;
  const caja = useRef<HTMLDivElement>(null);
  const cuerpos = useRef<(HTMLDivElement | null)[]>([]);
  const caminantes = useMemo<Caminante[]>(
    () => [
      { avatar: "carla", look: null, recorrido: PASEO, desde: 0, pausa: 2.4 },
      { avatar: "dario", look: randomLook(seededRandom(11)), recorrido: LLEGADA, desde: 3, pausa: 3 },
    ],
    [],
  );
  const ronda = useMemo(() => [{ avatar: "eva" as HumanAvatar, look: null }, { avatar: "bruno" as HumanAvatar, look: randomLook(seededRandom(5)) }], []);
  // Dirección y si camina, por caminante (cambia pocas veces: solo eso pasa por React).
  const [estado, setEstado] = useState(() => caminantes.map((c) => ({ dir: enRecorrido(c.recorrido, c.desde, c.pausa).dir as Direction, caminando: false })));

  useEffect(() => {
    if (!dibujo) return;
    const quieto = prefiereQuieto();
    let visible = true;
    let raf = 0;
    let t0 = performance.now();
    let recorrido = 0;
    const ubicar = (d: number) => {
      const nuevos = caminantes.map((c, i) => {
        const p = enRecorrido(c.recorrido, c.desde + d, c.pausa);
        const el = cuerpos.current[i];
        if (el) {
          const q = aLienzo(p.x, p.y, PAD);
          el.style.left = `${((q.x - dibujo.x0) / dibujo.w) * 100}%`;
          el.style.top = `${((q.y - dibujo.y0) / dibujo.h) * 100}%`;
          // Más adelante en la escena (más abajo en pantalla) va encima.
          el.style.zIndex = String(10 + Math.round(q.y));
        }
        return { dir: p.dir as Direction, caminando: !quieto && p.caminando };
      });
      setEstado((viejos) => (viejos.every((v, i) => v.dir === nuevos[i]!.dir && v.caminando === nuevos[i]!.caminando) ? viejos : nuevos));
    };
    // Quieto: cada uno a mitad de camino, parado.
    ubicar(quieto ? QUIETO_EN : 0);
    if (quieto) return;
    const paso = (ahora: number) => {
      recorrido += (Math.min(ahora - t0, 100) / 1000) * VELOCIDAD;
      t0 = ahora;
      ubicar(recorrido);
      raf = visible ? requestAnimationFrame(paso) : 0;
    };
    const obs = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
      if (visible && !raf) {
        t0 = performance.now();
        raf = requestAnimationFrame(paso);
      }
    });
    if (caja.current) obs.observe(caja.current);
    raf = requestAnimationFrame(paso);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [dibujo, caminantes]);

  // Dónde arranca cada caminante, ya en el primer cuadro (si no, se ve un instante en la esquina
  // hasta que corre el efecto). Es fijo: después los mueve el efecto directo en el DOM.
  const inicio = useMemo(() => {
    if (!dibujo) return [];
    const d0 = prefiereQuieto() ? QUIETO_EN : 0;
    return caminantes.map((c) => {
      const p = enRecorrido(c.recorrido, c.desde + d0, c.pausa);
      const q = aLienzo(p.x, p.y, PAD);
      return { left: `${((q.x - dibujo.x0) / dibujo.w) * 100}%`, top: `${((q.y - dibujo.y0) / dibujo.h) * 100}%`, zIndex: 10 + Math.round(q.y) };
    });
  }, [dibujo, caminantes]);

  // Sin la escena (cargando, o si ya no se pudo armar) queda el hueco: la portada y el login siguen.
  if (!escena || !dibujo) return <div className={`aspect-[1205/620] ${className}`} aria-hidden />;

  const pct = (tx: number, ty: number, z = 0) => {
    const q = aLienzo(tx, ty, PAD, z);
    return { left: `${((q.x - dibujo.x0) / dibujo.w) * 100}%`, top: `${((q.y - dibujo.y0) / dibujo.h) * 100}%` };
  };
  // El personaje ocupa un cuadro de 32 px del motor: su ancho en porcentaje del dibujo, pies en el punto.
  const cuerpo: CSSProperties = { width: `${(escena.frame / dibujo.w) * 100}%`, transform: `translate(-50%, -${(escena.feetY / escena.frame) * 100}%)` };
  const charla = RONDA[0]!;

  return (
    <div ref={caja} className={`relative isolate select-none ${className}`} style={{ aspectRatio: `${dibujo.w} / ${dibujo.h}` }} aria-hidden>
      <img src={dibujo.src} alt="" className="pixelated absolute inset-0 h-full w-full" draggable={false} />
      {/* El resplandor de cada luz, en pasos (como el juego de noche, pero suave para que se vea el día). */}
      {escena.luces.map((l, i) => {
        const r = ((l.radio * (l.fuego ? 1.5 : 1)) / dibujo.w) * 100;
        return (
          <span
            key={i}
            className={`lumbre-luz absolute rounded-full ${l.fuego ? "lumbre-luz-fuego" : ""}`}
            style={{
              ...pct(l.x, l.y, l.z),
              width: `${r * 2}%`,
              aspectRatio: "2 / 1.2",
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(closest-side, ${l.color}88, ${l.color}33 55%, transparent)`,
              animationDelay: `${-i * 0.37}s`,
            }}
          />
        );
      })}
      {RONDA.map((p, i) => {
        const q = aLienzo(p.x, p.y, PAD);
        return (
          <div key={`r${i}`} className="absolute" style={{ ...pct(p.x, p.y), zIndex: 10 + Math.round(q.y), ...cuerpo }}>
            <Personaje avatar={ronda[i]!.avatar} look={ronda[i]!.look} dir={p.dir} />
          </div>
        );
      })}
      {caminantes.map((c, i) => (
        <div
          key={`c${i}`}
          ref={(el) => {
            cuerpos.current[i] = el;
          }}
          className="absolute"
          style={{ ...inicio[i], ...cuerpo }}
        >
          <Personaje avatar={c.avatar} look={c.look} dir={estado[i]!.dir} walking={estado[i]!.caminando} />
        </div>
      ))}
      {/* Globito de charla sobre quien está en la fogata. */}
      <div
        className="lumbre-globo cozy-panel absolute z-[999] px-2.5 py-1 text-[clamp(11px,1.2vw,15px)] leading-none whitespace-nowrap max-sm:hidden"
        style={{ ...pct(charla.x, charla.y, 44), transform: "translate(-50%, -100%)" }}
      >
        {saludo}
      </div>
    </div>
  );
}
