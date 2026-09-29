"use client";

// La pestaña "Oficios" del menú de la mochila: los cinco oficios con su barra, lo que falta para el
// siguiente nivel, lo que ya ganó hoy con las acciones (el tope) y lo que da cada nivel.
import { OFICIO, OFICIO_INFO, OFICIOS, levelProgress, rewardsOf, type Oficio } from "@hyvento/shared";
import { useOficios } from "@/game/oficios";
import { PixelIcon } from "../Cozy";

const KIND_TEXT = { costume: "Traje", furniture: "Mueble", recipe: "Receta", perk: "Ventaja", title: "Título" } as const;

function OficioCard({ oficio, xp, today }: { oficio: Oficio; xp: number; today: number }) {
  const info = OFICIO_INFO[oficio];
  const p = levelProgress(xp);
  const pct = p.to === null ? 100 : Math.round((p.into / (p.to - p.from)) * 100);
  return (
    <article className="flex flex-col gap-2 border-2 border-cozy-paper-dark bg-cozy-paper p-3">
      <header className="flex items-baseline gap-2">
        <span className="h-3 w-3 shrink-0 border-2 border-cozy-frame" style={{ background: info.color }} />
        <h4 className="text-[15px] font-semibold">{info.name}</h4>
        <span className="ml-auto text-[14px] font-semibold tabular-nums">Nivel {p.level}</span>
      </header>
      <div className="flex items-center gap-2">
        <span
          role="progressbar"
          aria-label={`${info.name}: nivel ${p.level}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="relative block h-3 flex-1 overflow-hidden border-2 border-cozy-wood bg-cozy-paper-dark"
        >
          <span className="absolute inset-y-0 left-0 block" style={{ width: `${pct}%`, background: info.color }} />
        </span>
        <span className="shrink-0 text-[12px] tabular-nums text-cozy-ink-soft">{p.need === null ? "¡Al máximo!" : `faltan ${p.need}`}</span>
      </div>
      <p className="text-[12px] text-cozy-ink-soft">
        {xp} de experiencia · hoy con acciones {Math.min(today, OFICIO.dailyActionCap)}/{OFICIO.dailyActionCap}
      </p>
      <ol className="flex flex-col gap-1">
        {rewardsOf(oficio).map((r) => {
          const got = p.level >= r.level;
          return (
            <li key={r.level} className={`flex items-start gap-2 text-[12px] leading-snug ${got ? "text-cozy-ink" : "text-cozy-ink-soft"}`}>
              <span className={`mt-px w-9 shrink-0 text-center font-semibold tabular-nums ${got ? "text-cozy-green" : ""}`}>nv {r.level}</span>
              <PixelIcon name={got ? "star" : "lock"} size={11} color={got ? "var(--color-cozy-gold)" : "var(--color-cozy-ink-soft)"} />
              <span>
                <b>{KIND_TEXT[r.kind]}:</b> {r.label}. <span className="text-cozy-ink-soft">{r.text}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

export function OficiosTab() {
  const state = useOficios((s) => s.state);
  if (!state) return <p className="cozy-dots py-8 text-center text-[14px] text-cozy-ink-soft">Contando la experiencia</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-[13px] text-cozy-ink-soft">
        <span>Suben haciendo las cosas de cada oficio y entregando encargos. En el 5, una ventajita; en el 10, título, logro e insignia.</span>
        <span className="cozy-chip px-2 py-0.5 text-[13px] font-semibold text-cozy-ink">Nivel de vecino {state.neighbor}</span>
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {OFICIOS.map((o) => (
          <OficioCard key={o} oficio={o} xp={state.skills[o].xp} today={state.skills[o].today} />
        ))}
      </div>
    </div>
  );
}
