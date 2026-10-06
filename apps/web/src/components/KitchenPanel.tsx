"use client";

// La cocina de la planta baja (E frente a una estufa): las recetas con lo del huerto y la miel que tienes
// en la mochila (tu despensa). El plato va a la mochila (y a la mano) y da puntos o, al primer bocado, un
// rato de energía. El servidor valida que estés junto a la estufa y que alcancen los ingredientes; aquí
// solo se muestra.
import { drawHeldItem } from "@hyvento/map/art";
import { COCINA, INGREDIENTS, RECIPES, STORY_RECIPES, canCook, ingredientName, recipeInSeason, unlockText, unlocked, type Recipe } from "@hyvento/shared";
import { useOfficeStore } from "@/game/store";
import { useEncargos } from "@/game/encargos";
import { storyStepOpen } from "@/game/historia";
import { useMyLevels } from "@/game/oficios";
import { useEffect, useMemo } from "react";
import { requestPantry, sendCook, useCocinaStore } from "@/game/cocina";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { PixelIcon } from "./Cozy";
import { PanelShell } from "./PointsPanels";

export function ItemArt({ id, size = 8 }: { id: string; size?: 6 | 8 }) {
  const src = useMemo(() => (typeof document === "undefined" ? "" : toHtmlCanvas(drawHeldItem(id)).toDataURL()), [id]);
  const box = size === 6 ? "h-6 w-6" : "h-8 w-8";
  return src ? <img src={src} alt="" className={`${box} shrink-0 object-contain [image-rendering:pixelated]`} /> : <span className={`${box} shrink-0`} />;
}

function effectText(r: Recipe): string {
  if (r.effect.kind === "points") return `+${r.effect.amount} pts`;
  if (r.effect.kind === "story") return "Receta de E. (historia)";
  const min = r.effect.ms / 60_000;
  return `Energía ${Math.round((r.effect.mul - 1) * 100)} % · ${min >= 1 ? `${Math.round(min * 10) / 10} min` : `${Math.round(r.effect.ms / 1000)} s`}`;
}

export function KitchenPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const levels = useMyLevels();
  const pantry = useCocinaStore((s) => s.pantry);
  const pointsToday = useCocinaStore((s) => s.pointsToday);
  // Las de temporada (la natilla y los buñuelos de las novenas) solo se ven mientras corre su festival.
  const festival = useOfficeStore((s) => s.festival.id);
  useEffect(() => requestPantry(), []);
  const available = pantry ?? {};
  // Las recetas de la historia (la carnada de E.) solo aparecen con su paso abierto (lo valida el servidor).
  const quests = useEncargos((s) => s.quests);
  const recipes = [
    ...STORY_RECIPES.filter((r) => r.story?.some((q) => storyStepOpen(quests, q))),
    ...RECIPES.filter((r) => recipeInSeason(r, festival)),
  ];

  return (
    <PanelShell title="Cocina" icon="pot" onClose={onClose} wide>
      <div className="flex flex-col gap-3 text-[14px]">
        <p className="text-cozy-ink-soft">
          Cocina con lo que cosechas en el huerto y la miel de las colmenas. Lo salado da puntos (hasta {COCINA.pointsDailyCap} al día); lo dulce da energía
          para caminar más rápido un rato, desde el primer bocado.
        </p>

        <section aria-label="Tu despensa" className="flex flex-col gap-2">
          <p className="flex items-baseline justify-between font-semibold">
            Tu despensa (lo de tu mochila)
            <span className="text-[12px] font-normal text-cozy-ink-soft">
              Hoy: {pointsToday}/{COCINA.pointsDailyCap} pts
            </span>
          </p>
          {!pantry ? (
            <p className="text-[12px] text-cozy-ink-soft">Mirando la despensa…</p>
          ) : (
            <ul className="grid grid-cols-7 gap-1.5 max-sm:grid-cols-4">
              {INGREDIENTS.map((id) => {
                const n = pantry[id] ?? 0;
                return (
                  <li key={id} title={ingredientName(id)} className={`cozy-chip flex flex-col items-center gap-0.5 px-1 py-1 ${n ? "" : "opacity-45"}`}>
                    <ItemArt id={id} size={6} />
                    <span className="text-[12px] tabular-nums">×{n}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Recetas" className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          {recipes.map((r) => {
            // La receta de un oficio se ve, pero se cocina desde su nivel (lo valida el servidor).
            const lockedBy = r.requires && !unlocked(r.requires, levels) ? unlockText(r.requires) : null;
            const ok = canCook(r, available) && !lockedBy;
            return (
              <div key={r.id} className="cozy-chip flex flex-col gap-1.5 px-2 py-2">
                <div className="flex items-center gap-2">
                  <ItemArt id={r.id} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.name}</span>
                    {r.festival && <span className="block text-[11px] text-cozy-ink-soft">De temporada: solo en las novenas</span>}
                    <span className="flex items-center gap-1 text-[12px] text-cozy-ink-soft">
                      <PixelIcon name={r.effect.kind === "points" ? "coin" : r.effect.kind === "story" ? "fish" : "bolt"} size={11} color="var(--color-cozy-gold)" />
                      {effectText(r)}
                    </span>
                  </span>
                </div>
                <ul aria-label="Ingredientes" className="flex flex-wrap gap-1">
                  {Object.entries(r.needs).map(([item, n]) => {
                    const have = available[item] ?? 0;
                    return (
                      <li key={item} className={`flex items-center gap-0.5 text-[12px] ${have >= n ? "" : "text-cozy-red"}`} title={ingredientName(item)}>
                        <ItemArt id={item} size={6} />
                        {Math.min(have, n)}/{n}
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  disabled={!atObject || !ok}
                  onClick={() => sendCook(r.id)}
                  className={`cozy-btn px-3 py-1 text-[13px] ${ok && atObject ? "cozy-btn-primary" : ""}`}
                >
                  {lockedBy ? `Con ${lockedBy}` : "Cocinar"}
                </button>
              </div>
            );
          })}
        </section>
        {!atObject && <p className="text-center text-[12px] text-cozy-ink-soft">Las estufas están en la cocina, detrás de la barra de la cafetería.</p>}
      </div>
    </PanelShell>
  );
}
