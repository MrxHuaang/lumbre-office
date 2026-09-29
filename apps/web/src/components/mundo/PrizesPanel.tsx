"use client";

// El estante de premios del arcade: los peluches que se pueden sacar de la máquina de garra, qué tan raros
// son y cuáles ya tienes en la mochila.
import { drawHeldItem } from "@hyvento/map/art";
import { GARRA, PLUSH_RARITY_TEXT, PLUSHES } from "@hyvento/shared";
import { PanelShell } from "../PointsPanels";
import { PixelImg, useBagCount } from "./kit";

export function PrizesPanel({ onClose }: { onClose: () => void }) {
  const count = useBagCount();
  const mine = PLUSHES.filter((p) => count(p.id) > 0).length;
  return (
    <PanelShell title="Estante de premios" icon="gift" onClose={onClose}>
      <p className="text-[14px] text-cozy-ink-soft">
        Los peluches de la máquina de garra ({GARRA.price} puntos el intento). Tienes {mine} de {PLUSHES.length}: se pueden regalar como lo demás de la mochila.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 max-sm:grid-cols-1">
        {PLUSHES.map((p) => {
          const have = count(p.id);
          return (
            <li key={p.id} className={`flex items-center gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2 ${have ? "" : "opacity-70"}`}>
              <span className="grid h-12 w-12 shrink-0 place-items-center border-2 border-cozy-paper-dark bg-cozy-paper">
                <PixelImg id={`obj-${p.id}`} draw={() => drawHeldItem(p.id)} size={40} className={have ? "" : "grayscale"} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] leading-tight font-semibold">{p.name}</p>
                <p className={`text-[12px] ${p.rarity === "especial" ? "text-cozy-red-deep" : p.rarity === "raro" ? "text-cozy-sky" : "text-cozy-ink-soft"}`}>{PLUSH_RARITY_TEXT[p.rarity]}</p>
                <p className="text-[12px] leading-snug text-cozy-ink-soft">{have ? `Tienes ${have}.` : p.blurb}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </PanelShell>
  );
}
