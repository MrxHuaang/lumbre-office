"use client";

// Jardín vivo: el cobertizo del huerto (E junto a su puerta). Se saca la regadera (vacía: se llena en el
// barril de agua o en el pozo) o una bolsa de semillas; va a la mochila, se elige en la barra y el huerto
// la usa con E sobre cada parcela. El servidor valida que estés junto al cobertizo y que te quepa.
import { drawHeldItem } from "@hyvento/map/art";
import { CROPS, EMPTY_CAN, HUERTO, durationText, seedsOf } from "@hyvento/shared";
import { useMemo } from "react";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { sendShedTake } from "@/game/network";
import { PanelShell } from "./PointsPanels";

function ItemArt({ id }: { id: string }) {
  const src = useMemo(() => (typeof document === "undefined" ? "" : toHtmlCanvas(drawHeldItem(id)).toDataURL()), [id]);
  return src ? <img src={src} alt="" className="h-8 w-8 shrink-0 object-contain [image-rendering:pixelated]" /> : <span className="h-8 w-8 shrink-0" />;
}

export function ShedPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const take = (item: string) => {
    sendShedTake(item);
    onClose();
  };
  return (
    <PanelShell title="Cobertizo" icon="bag" onClose={onClose}>
      <div className="flex flex-col gap-3 text-[14px]">
        <p className="text-cozy-ink-soft">
          Lo que saques va a tu mochila: elígelo en la barra de abajo. Siembra con E sobre una parcela vacía llevando semillas; riega con la regadera
          llena (crece cuatro veces más rápido) y cosecha cuando brille. Cada bolsa siembra {HUERTO.seedUses} parcelas.
        </p>
        <button type="button" disabled={!atObject} onClick={() => take(EMPTY_CAN)} className="cozy-btn flex items-center gap-3 px-3 py-2 text-left">
          <ItemArt id="regadera" />
          <span className="flex-1">
            <span className="block font-semibold">Regadera</span>
            <span className="block text-[12px] text-cozy-ink-soft">Sale vacía: llénala en el barril de agua o en el pozo ({HUERTO.canUses} riegos). Una por persona.</span>
          </span>
        </button>
        {(
          [
            ["Semillas para el huerto", CROPS.filter((c) => !c.indoor), ""],
            ["Para el invernadero", CROPS.filter((c) => c.indoor), "Tierra caliente: van en los bancales de adentro y crecen sin regar."],
          ] as const
        ).map(([title, crops, hint]) => (
          <section key={title} aria-label={title} className="flex flex-col gap-1.5">
            <h3 className="text-[13px] font-semibold text-cozy-ink-soft">{title}</h3>
            {hint && <p className="text-[12px] text-cozy-ink-soft">{hint}</p>}
            <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
              {crops.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={!atObject}
                  onClick={() => take(seedsOf(c.id))}
                  className="cozy-btn flex items-center gap-2 px-2 py-1.5 text-left"
                >
                  <ItemArt id={seedsOf(c.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.name}</span>
                    <span className="block text-[12px] text-cozy-ink-soft">
                      {durationText(c.growMs)}
                      {c.indoor ? "" : " regado"} · {c.points} pts
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {!atObject && <p className="text-center text-[12px] text-cozy-ink-soft">El cobertizo está en la esquina del huerto, al noroeste del jardín.</p>}
      </div>
    </PanelShell>
  );
}
