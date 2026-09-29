// Mis permisos en el cliente (los manda el servidor al entrar y cuando un admin los cambia) y el panel
// "Dar permiso…" que abre un admin desde el menú de una persona. El cliente solo oculta botones: el
// servidor valida cada acción.
import { PERMISOS_MSG, PermisosView, puede, type Permiso } from "@hyvento/shared";
import type { Room } from "colyseus.js";
import { create } from "zustand";
import { useOfficeStore } from "./store";

interface PermisosStore extends PermisosView {
  /** Persona a la que un admin le está dando permisos (panel abierto), o null. */
  editing: { userId: string; name: string } | null;
  set: (v: PermisosView) => void;
  openEditor: (person: { userId: string; name: string } | null) => void;
}

export const usePermisosStore = create<PermisosStore>((set) => ({
  admin: false,
  permisos: [],
  editing: null,
  set: (v) => set(v),
  openEditor: (editing) => set({ editing }),
}));

/** ¿Puedo hacerlo? (para mostrar u ocultar un botón). */
export const usePuedo = (permiso: Permiso) => usePermisosStore((s) => puede(s, permiso));

export function bindPermisos(room: Room) {
  room.onMessage(PERMISOS_MSG.state, (raw: unknown) => {
    const parsed = PermisosView.safeParse(raw);
    if (!parsed.success) return;
    const before = usePermisosStore.getState();
    usePermisosStore.getState().set(parsed.data);
    // Me quitaron el editor de la casa mientras lo tenía abierto: se cierra (el servidor ya lo soltó).
    const office = useOfficeStore.getState();
    if (office.worldEditing && !puede(parsed.data, "editar-casa")) {
      office.setWorldEditing(false);
      office.notify("Ya no tienes permiso para editar la casa.", "warning");
    } else if (!before.admin && !parsed.data.admin) {
      const nuevos = parsed.data.permisos.filter((p) => !before.permisos.includes(p));
      if (nuevos.includes("editar-casa")) office.notify("Ahora puedes editar la casa (menú → Editar la casa).", "success");
    }
  });
}
