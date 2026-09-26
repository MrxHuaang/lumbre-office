"use client";

import { RISO } from "@/lib/riso";
import { OfficeDialog } from "./OfficeDialog";

/**
 * "Administrar equipo" sin salir de la oficina: la página /admin dentro de una ventana. Los cambios
 * (invitar, asignar oficinas) llegan a la sala al instante, como desde la página suelta.
 */
export function AdminDialog({ onClose }: { onClose: () => void }) {
  return (
    <OfficeDialog title="Administrar equipo" onClose={onClose} shadow={RISO.blue} className="h-full max-w-4xl">
      <iframe src="/admin?embed=1" title="Administrar equipo" className="min-h-0 w-full flex-1 bg-riso-paper" />
    </OfficeDialog>
  );
}
