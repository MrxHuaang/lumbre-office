"use client";

// La granja del jardín: el panel de la parrilla (E frente al horno de barro o la parrilla: las recetas con
// lo de la mochila y lo que se trae de la cafetería) y el del letrero del gallinero (lo de hoy, la racha y
// la votación de los nombres). El servidor valida todo; aquí solo se muestra.
import {
  FARM_ANIMALS,
  GALLINERO,
  GRILL_RECIPES,
  granjaObjectName,
  grillMissing,
  PANTRY_SHOP,
  PARRILLA,
  type GrillRecipe,
} from "@hyvento/shared";
import { useEffect } from "react";
import { requestCoop, requestGrill, sendGrillBuy, sendGrillCook, sendVote, useGranjaStore } from "@/game/granjaNet";
import { PixelIcon } from "./Cozy";
import { ItemArt } from "./KitchenPanel";
import { PanelShell } from "./PointsPanels";

const secs = (ms: number) => `${Math.round(ms / 1000)} s`;

export function GrillPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const state = useGranjaStore((s) => s.grill);
  useEffect(() => void requestGrill(), []);
  const pantry = state?.pantry ?? {};
  const ingredients = [...new Set(GRILL_RECIPES.flatMap((r) => Object.keys(r.needs)))];

  const recipe = (r: GrillRecipe) => {
    const ok = Object.keys(grillMissing(r, pantry)).length === 0;
    const busy = Boolean(state?.cooking);
    return (
      <div key={r.id} className="cozy-chip flex flex-col gap-1.5 px-2 py-2">
        <div className="flex items-center gap-2">
          <ItemArt id={r.id} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{r.name}</span>
            <span className="flex items-center gap-1 text-[12px] text-cozy-ink-soft">
              <PixelIcon name="coin" size={11} color="var(--color-cozy-gold)" />+{r.points} pts · {r.station === "horno" ? "horno" : "parrilla"} · {secs(r.cookMs)} · {r.portions} porciones
            </span>
          </span>
        </div>
        <p className="text-[12px] text-cozy-ink-soft">{r.blurb}</p>
        <ul aria-label="Ingredientes" className="flex flex-wrap gap-1.5">
          {Object.entries(r.needs).map(([item, n]) => {
            const have = pantry[item] ?? 0;
            return (
              <li key={item} className={`flex items-center gap-0.5 text-[12px] ${have >= n ? "" : "text-cozy-red"}`} title={granjaObjectName(item)}>
                <ItemArt id={item} size={6} />
                {Math.min(have, n)}/{n}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          disabled={!atObject || !ok || busy}
          onClick={() => {
            sendGrillCook(r.id);
            onClose();
          }}
          className={`cozy-btn px-3 py-1 text-[13px] ${ok && atObject && !busy ? "cozy-btn-primary" : ""}`}
        >
          {state?.cooking === r.id ? "En el fuego…" : "Al fuego"}
        </button>
      </div>
    );
  };

  return (
    <PanelShell title="Horno de barro y parrilla" icon="flame" onClose={onClose} wide>
      <div className="flex flex-col gap-3 text-[14px]">
        <p className="text-cozy-ink-soft">
          Se cocina con lo de tu mochila: huevos del gallinero, harina del molino (maíz del huerto) y lo que se trae de la cafetería. Tarda un rato; con
          más gente cocinando a la vez sale más rápido para todos (y con bono de +{PARRILLA.togetherBonus}). Con el plato en la mano, quien esté cerca te
          puede pedir una porción con E.
        </p>

        <section aria-label="Tu despensa" className="flex flex-col gap-2">
          <p className="font-semibold">En tu mochila</p>
          {!state ? (
            <p className="text-[12px] text-cozy-ink-soft">Mirando la mochila…</p>
          ) : (
            <ul className="grid grid-cols-7 gap-1.5 max-sm:grid-cols-4">
              {ingredients.map((id) => {
                const n = pantry[id] ?? 0;
                return (
                  <li key={id} title={granjaObjectName(id)} className={`cozy-chip flex flex-col items-center gap-0.5 px-1 py-1 ${n ? "" : "opacity-45"}`}>
                    <ItemArt id={id} size={6} />
                    <span className="text-[12px] tabular-nums">×{n}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="De la cafetería" className="flex flex-col gap-1.5">
          <p className="font-semibold">Traer de la cafetería</p>
          <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
            {PANTRY_SHOP.map((p) => (
              <div key={p.id} className="cozy-chip flex items-center gap-2 px-2 py-1.5">
                <ItemArt id={p.id} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block text-[12px] text-cozy-ink-soft">{p.price} pts c/u</span>
                </span>
                {[1, 3].map((q) => (
                  <button key={q} type="button" disabled={!atObject} onClick={() => sendGrillBuy(p.id, q)} className="cozy-btn px-2 py-1 text-[12px]">
                    +{q}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Recetas" className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          {GRILL_RECIPES.map(recipe)}
        </section>
        {!atObject && <p className="text-center text-[12px] text-cozy-ink-soft">La parrilla está junto al patio de piedra, al este de la casa.</p>}
      </div>
    </PanelShell>
  );
}

export function CoopPanel({ onClose }: { onClose: () => void }) {
  const coop = useGranjaStore((s) => s.coop);
  useEffect(() => void requestCoop(), []);
  return (
    <PanelShell title="El gallinero" icon="egg" onClose={onClose} wide>
      <div className="flex flex-col gap-3 text-[14px]">
        <p className="text-cozy-ink-soft">
          Dales de comer una vez al día en el comedero (+{GALLINERO.feedPoints} pts y uno más por cada día seguido). Cada amanecer del juego ponen{" "}
          {GALLINERO.eggsPerDay} huevos en el nido: se los lleva quien llegue primero.
        </p>
        {!coop ? (
          <p className="text-[12px] text-cozy-ink-soft">Contando gallinas…</p>
        ) : (
          <>
            <section aria-label="Hoy" className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
              <div className="cozy-chip px-2 py-1.5">
                <span className="block text-[12px] text-cozy-ink-soft">Tu racha</span>
                <span className="block font-semibold">
                  {coop.streak} {coop.streak === 1 ? "día" : "días"} {coop.fedToday ? "· hoy ya comieron" : "· falta hoy"}
                </span>
                <span className="block text-[12px] text-cozy-ink-soft">La mejor: {coop.best}</span>
              </div>
              <div className="cozy-chip px-2 py-1.5">
                <span className="block text-[12px] text-cozy-ink-soft">Hoy les dieron de comer</span>
                <span className="block font-semibold">{coop.feeders.length ? coop.feeders.join(", ") : "Nadie todavía"}</span>
              </div>
              <div className="cozy-chip px-2 py-1.5">
                <span className="block text-[12px] text-cozy-ink-soft">En el nido</span>
                <span className="block font-semibold">{coop.eggsLeft ? `${coop.eggsLeft} huevos` : coop.eggsBy ? `Los recogió ${coop.eggsBy}` : "Vacío"}</span>
              </div>
            </section>
            <section aria-label="Los nombres" className="flex flex-col gap-2">
              <p className="font-semibold">¿Cómo se llaman? Vota (puedes cambiar tu voto)</p>
              <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                {coop.animals.map((a) => (
                  <div key={a.id} className="cozy-chip flex flex-col gap-1 px-2 py-1.5">
                    <span className="font-semibold">
                      {a.kind === "cabra" ? "La cabra" : `Gallina ${FARM_ANIMALS.find((d) => d.id === a.id)?.coat ?? ""}`}: {a.name}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {a.names.map((name, i) => (
                        <button
                          key={name}
                          type="button"
                          aria-pressed={a.mine === i}
                          data-on={a.mine === i || undefined}
                          onClick={() => sendVote(a.id, i)}
                          className="cozy-btn px-2 py-0.5 text-[12px]"
                        >
                          {name} · {a.votes[i] ?? 0}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </PanelShell>
  );
}
