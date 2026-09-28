"use client";

import { useReconnectStore } from "@/game/reconexion";

/** Mientras se vuelve a la cabaña. Si el servidor avisó que se reinicia (un deploy), se dice. */
export function ReconnectChip() {
  const reason = useReconnectStore((s) => s.reason);
  return (
    <div role="status" className="cozy-chip px-3.5 py-1.5 text-[13px]">
      {reason === "restart" ? "Reiniciando la cabaña…" : "Reconectando…"}
    </div>
  );
}
