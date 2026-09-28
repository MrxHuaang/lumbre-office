"use client";

// Jardín vivo: el cobertizo del huerto (E junto a su puerta). Se saca la regadera (vacía: se llena en el
// barril de agua o en el pozo) o una bolsa de semillas; va en la mano y el huerto la usa con E sobre
// cada parcela. El servidor valida que estés junto al cobertizo y que no lleves algo pagado.
import { drawHeldItem } from "@hyvento/map/art";
import { CROPS, EMPTY_CAN, HUERTO, SEASON_TEXT, durationText, seasonGrowth, seasonGrowthText, seasonOf, seedsOf } from "@hyvento/shared";
import { useMemo } from "react";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { sendShedTake } from "@/game/network";
import { PantryStoreButton } from "./KitchenPanel";
import { PanelShell } from "./PointsPanels";

function ItemArt({ id }: { id: string }) {
  const src = useMemo(() => (typeof document === "undefined" ? "" : toHtmlCanvas(drawHeldItem(id)).toDataURL()), [id]);
  return src ? <img src={src} alt="" className="h-8 w-8 shrink-0 object-contain [image-rendering:pixelated]" /> : <span className="h-8 w-8 shrink-0" />;
}

export function ShedPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  // Cada cultivo tiene su temporada: lo que tarda y la ayuda cambian con la estación.
  const season = useMemo(() => seasonOf(Date.now()), []);
  const take = (item: string) => {
    sendShedTake(item);
    onClose();
  };
  return (
    <PanelShell title="Cobertizo" icon="bag" onClose={onClose}>
      <div className="flex flex-col gap-3 text-[14px]">
        <p className="text-cozy-ink-soft">
          Siembra con E sobre una parcela vacía llevando semillas; riega con la regadera llena (crece cuatro veces más rápido) y cosecha
          cuando brille. Cada bolsa siembra {HUERTO.seedUses} parcelas. En {SEASON_TEXT[season].toLowerCase()} unos cultivos crecen más rápido que otros, y
          la lluvia riega sola.
        </p>
        <PantryStoreButton atObject={atObject} />
        <button type="button" disabled={!atObject} onClick={() => take(EMPTY_CAN)} className="cozy-btn flex items-center gap-3 px-3 py-2 text-left">
          <ItemArt id="regadera" />
          <span className="flex-1">
            <span className="block font-semibold">Regadera</span>
            <span className="block text-[12px] text-cozy-ink-soft">Sale vacía: llénala en el barril de agua o en el pozo ({HUERTO.canUses} riegos).</span>
          </span>
        </button>
        <section aria-label="Semillas" className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          {CROPS.map((c) => (
            <button key={c.id} type="button" disabled={!atObject} onClick={() => take(seedsOf(c.id))} className="cozy-btn flex items-center gap-2 px-2 py-1.5 text-left">
              <ItemArt id={seedsOf(c.id)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.name}</span>
                <span className="block text-[12px] text-cozy-ink-soft">
                  {durationText(c.growMs / seasonGrowth(c.id, season))} regado · {c.points} pts · {seasonGrowthText(c.id, season)}
                </span>
              </span>
            </button>
          ))}
        </section>
        {!atObject && <p className="text-center text-[12px] text-cozy-ink-soft">El cobertizo está en la esquina del huerto, al noroeste del jardín.</p>}
      </div>
    </PanelShell>
  );
}
