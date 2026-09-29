"use client";

import { PERMISOS, type Permiso } from "@hyvento/shared";
import { useEffect, useState, useTransition } from "react";
import { setPermisoAction, setPermisoTodosAction } from "./actions";

interface Props {
  users: { id: string; name: string; email: string; role: string }[];
  everyone: Permiso[];
  byUser: Record<string, Permiso[]>;
}

/**
 * Permisos por persona: una columna por permiso del catálogo. "Todos pueden" lo abre a todo el equipo;
 * los admins los tienen todos siempre (no se pueden quitar). Guarda al marcar y llega a la cabaña al instante.
 */
export function PermisosAdmin({ users, everyone, byUser }: Props) {
  const members = users.filter((u) => u.role !== "ADMIN");
  const admins = users.filter((u) => u.role === "ADMIN");
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1.5 text-[13px] text-cozy-ink-soft">
        {PERMISOS.map((p) => (
          <li key={p.id}>
            <span className="font-semibold text-cozy-ink">{p.nombre}:</span> {p.descripcion}
          </li>
        ))}
      </ul>

      <div className="cozy-scroll overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-[15px]">
          <thead>
            <tr className="border-b-2 border-cozy-wood text-left">
              <th className="py-2 pr-3 font-semibold">Persona</th>
              {PERMISOS.map((p) => (
                <th key={p.id} className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                  {p.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b-2 border-cozy-paper-dark bg-cozy-paper-light">
              <td className="py-2.5 pr-3 font-semibold">Todos pueden</td>
              {PERMISOS.map((p) => (
                <td key={p.id} className="px-2 py-2.5 text-center">
                  <Toggle
                    label={`${p.nombre}: todos pueden`}
                    on={everyone.includes(p.id)}
                    save={(on) => setPermisoTodosAction(p.id, on)}
                  />
                </td>
              ))}
            </tr>
            {members.map((u) => (
              <tr key={u.id} className="border-b-2 border-cozy-paper-dark last:border-b-0">
                <td className="max-w-[14rem] truncate py-2.5 pr-3">
                  {u.name || "—"} <span className="text-[13px] text-cozy-ink-soft">· {u.email}</span>
                </td>
                {PERMISOS.map((p) => {
                  const open = everyone.includes(p.id);
                  return (
                    <td key={p.id} className="px-2 py-2.5 text-center">
                      <Toggle
                        label={`${p.nombre} para ${u.name || u.email}`}
                        on={open || (byUser[u.id] ?? []).includes(p.id)}
                        // Abierto a todos: la casilla individual no cambia nada, se ve marcada y quieta.
                        disabled={open}
                        title={open ? "Abierto a todos" : undefined}
                        save={(on) => setPermisoAction(u.id, p.id, on)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {members.length === 0 && <p className="text-[14px] text-cozy-ink-soft">Todavía no hay miembros sin rol de admin.</p>}
      {admins.length > 0 && (
        <p className="text-[13px] text-cozy-ink-soft">
          Los admins ({admins.map((a) => a.name || a.email).join(", ")}) tienen todos los permisos siempre.
        </p>
      )}
    </div>
  );
}

/** Casilla que guarda al cambiar; si falla, vuelve a como estaba y muestra el error. */
function Toggle({
  label,
  on,
  save,
  disabled = false,
  title,
}: {
  label: string;
  on: boolean;
  save: (on: boolean) => Promise<{ error?: string }>;
  disabled?: boolean;
  title?: string;
}) {
  const [value, setValue] = useState(on);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setValue(on), [on]);
  return (
    <span className="inline-flex flex-col items-center gap-0.5" title={error ?? title}>
      <input
        type="checkbox"
        aria-label={label}
        checked={value}
        disabled={disabled || pending}
        onChange={(e) => {
          const next = e.target.checked;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const res = await save(next);
            if (res.error) {
              setValue(!next);
              setError(res.error);
            }
          });
        }}
        className="h-4 w-4 cursor-pointer accent-[var(--color-cozy-green)] disabled:cursor-default disabled:opacity-60"
      />
      {error && <span className="text-[11px] font-semibold text-cozy-red-deep">{error}</span>}
    </span>
  );
}
