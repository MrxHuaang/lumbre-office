"use client";

// "Dar permiso…": un admin marca qué puede hacer una persona (lo mismo que la sección Permisos de /admin).
// Se guarda al marcar y el servidor de juego lo aplica al instante, sin que esa persona reconecte.
import { PERMISOS, type Permiso, type PermisosPersonaDTO } from "@hyvento/shared";
import { useCallback, useEffect, useState } from "react";
import { usePermisosStore } from "@/game/permisos";
import { useOfficeStore } from "@/game/store";
import { api, PanelShell } from "./PointsPanels";

export function PermisosPanel() {
  const editing = usePermisosStore((s) => s.editing);
  const close = useCallback(() => usePermisosStore.getState().openEditor(null), []);
  if (!editing) return null;
  return (
    <PanelShell title={`Permisos de ${editing.name}`} icon="unlock" onClose={close}>
      <PermisosDe key={editing.userId} userId={editing.userId} name={editing.name} />
    </PanelShell>
  );
}

function PermisosDe({ userId, name }: { userId: string; name: string }) {
  const [data, setData] = useState<PermisosPersonaDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Permiso | null>(null);
  const notify = useOfficeStore((s) => s.notify);
  const url = `/api/permisos/${encodeURIComponent(userId)}`;

  useEffect(() => {
    api<PermisosPersonaDTO>(url).then(setData, (e: Error) => setError(e.message));
  }, [url]);

  const toggle = async (permiso: Permiso, on: boolean) => {
    setBusy(permiso);
    setError(null);
    try {
      setData(await api<PermisosPersonaDTO>(url, { method: "PUT", body: JSON.stringify({ permiso, on }) }));
      const nombre = PERMISOS.find((p) => p.id === permiso)!.nombre;
      notify(on ? `${name} ya puede: ${nombre}.` : `${name} ya no puede: ${nombre}.`, "success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (error && !data) return <p className="text-[14px] font-semibold text-cozy-red-deep">{error}</p>;
  if (!data) return <p className="text-[14px] text-cozy-ink-soft">Cargando…</p>;
  if (data.admin) return <p className="text-[15px]">{name} es admin: tiene todos los permisos siempre.</p>;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {PERMISOS.map((p) => {
          const open = data.everyone.includes(p.id);
          const on = open || data.granted.includes(p.id);
          return (
            <li key={p.id}>
              <label className={`flex items-start gap-3 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2.5 ${open ? "" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={open || busy !== null}
                  onChange={(e) => void toggle(p.id, e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-cozy-green)] disabled:opacity-60"
                />
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">{p.nombre}</span>
                  <span className="text-[13px] text-cozy-ink-soft">{open ? "Abierto a todos (se cambia en Administrar equipo)." : p.descripcion}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-[13px] font-semibold text-cozy-red-deep">{error}</p>}
    </div>
  );
}
