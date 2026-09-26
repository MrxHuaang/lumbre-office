"use client";

// Fase 3b: la tienda (mostrador de la planta baja) y la mochila (HUD). Provisorio: lo completa la fase 3b.
import { PanelShell } from "./PointsPanels";

export function ShopPanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  return (
    <PanelShell title="Tienda" icon="home" onClose={onClose} wide>
      <p className="text-[14px] text-cozy-ink-soft">{atObject ? "La tienda abre pronto." : "Acércate al mostrador de la tienda."}</p>
    </PanelShell>
  );
}

export function BackpackPanel({ onClose }: { onClose: () => void }) {
  return (
    <PanelShell title="Mochila" icon="home" onClose={onClose}>
      <p className="text-[14px] text-cozy-ink-soft">Tu mochila está vacía.</p>
    </PanelShell>
  );
}
