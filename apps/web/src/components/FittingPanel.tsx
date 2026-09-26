"use client";

// Fase 3b: el probador (planta baja). Provisorio: lo completa la fase 3b.
import type { Profile } from "@/game/store";
import { PanelShell } from "./PointsPanels";

export function FittingPanel({
  onClose,
}: {
  profile: Profile;
  atObject: boolean;
  onClose: () => void;
  onSaved: (p: Profile) => void;
}) {
  return (
    <PanelShell title="Probador" icon="home" onClose={onClose} wide>
      <p className="text-[14px] text-cozy-ink-soft">El probador abre pronto.</p>
    </PanelShell>
  );
}
