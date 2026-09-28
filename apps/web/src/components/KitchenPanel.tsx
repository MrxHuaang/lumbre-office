"use client";

// La cocina de la planta baja (E frente a una estufa): la despensa de cada persona y las recetas con lo
// del huerto y la miel. Lo cosechado se guarda en la despensa (aquí o en el cobertizo del huerto); el
// plato queda en la mano y da puntos o, al primer bocado, un rato de energía. El servidor valida que
// estés junto a la estufa y que alcancen los ingredientes; aquí solo se muestra.
import { drawHeldItem } from "@hyvento/map/art";
import { COCINA, INGREDIENTS, RECIPES, canCook, ingredientName, isIngredient, type Pantry, type Recipe } from "@hyvento/shared";
import { useEffect, useMemo } from "react";
import { requestPantry, sendCook, sendPantryStore, useCocinaStore } from "@/game/cocina";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";
import { PanelShell } from "./PointsPanels";

export function ItemArt({ id, size = 8 }: { id: string; size?: 6 | 8 }) {
  const src = useMemo(() => (typeof document === "undefined" ? "" : toHtmlCanvas(drawHeldItem(id)).toDataURL()), [id]);
  const box = size === 6 ? "h-6 w-6" : "h-8 w-8";
  return src ? <img src={src} alt="" className={`${box} shrink-0 object-contain [image-rendering:pixelated]`} /> : <span className={`${box} shrink-0`} />;
}

/** Lo que llevo en la mano ("" = nada). */
function useHeldItem() {
  return useOfficeStore((s) => (s.sessionId ? (s.players[s.sessionId]?.held ?? "") : ""));
}

function effectText(r: Recipe): string {
  if (r.effect.kind === "points") return `+${r.effect.amount} pts`;
  const min = r.effect.ms / 60_000;
  return `Energía ${Math.round((r.effect.mul - 1) * 100)} % · ${min >= 1 ? `${Math.round(min * 10) / 10} min` : `${Math.round(r.effect.ms / 1000)} s`}`;
}

/** Guardar lo que llevo en la mano en la despensa (en la cocina o en el cobertizo). */
export function PantryStoreButton({ atObject }: { atObject: boolean }) {
  const held = useHeldItem();
  const can = atObject && isIngredient(held);
  return (
    <button type="button" disabled={!can} onClick={sendPantryStore} className="cozy-btn flex items-center gap-3 px-3 py-2 text-left">
      {isIngredient(held) ? <ItemArt id={held} /> : <PixelIcon name="bag" size={16} color="var(--color-cozy-wood)" />}
      <span className="flex-1">
        <span className="block font-semibold">{isIngredient(held) ? `Guardar ${ingredientName(held).toLowerCase()} en la despensa` : "Guardar en la despensa"}</span>
        <span className="block text-[12px] text-cozy-ink-soft">Lo del huerto y la miel esperan en la cocina para cocinar (hasta {COCINA.pantryMax} de cada uno).</span>
      </span>
    </button>
  );
}

export function KitchenPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const pantry = useCocinaStore((s) => s.pantry);
  const pointsToday = useCocinaStore((s) => s.pointsToday);
  const held = useHeldItem();
  useEffect(() => requestPantry(), []);
  // Lo de la mano también cuenta al cocinar (el servidor lo guarda primero).
  const available: Pantry = useMemo(() => {
    const p: Record<string, number> = { ...(pantry ?? {}) };
    if (isIngredient(held)) p[held] = (p[held] ?? 0) + 1;
    return p;
  }, [pantry, held]);

  return (
    <PanelShell title="Cocina" icon="pot" onClose={onClose} wide>
      <div className="flex flex-col gap-3 text-[14px]">
        <p className="text-cozy-ink-soft">
          Cocina con lo que cosechas en el huerto y la miel de las colmenas. Lo salado da puntos (hasta {COCINA.pointsDailyCap} al día); lo dulce da energía
          para caminar más rápido un rato, desde el primer bocado.
        </p>

        <section aria-label="Tu despensa" className="flex flex-col gap-2">
          <p className="flex items-baseline justify-between font-semibold">
            Tu despensa
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
          <PantryStoreButton atObject={atObject} />
        </section>

        <section aria-label="Recetas" className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          {RECIPES.map((r) => {
            const ok = canCook(r, available);
            return (
              <div key={r.id} className="cozy-chip flex flex-col gap-1.5 px-2 py-2">
                <div className="flex items-center gap-2">
                  <ItemArt id={r.id} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.name}</span>
                    <span className="flex items-center gap-1 text-[12px] text-cozy-ink-soft">
                      <PixelIcon name={r.effect.kind === "points" ? "coin" : "bolt"} size={11} color="var(--color-cozy-gold)" />
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
                  Cocinar
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
