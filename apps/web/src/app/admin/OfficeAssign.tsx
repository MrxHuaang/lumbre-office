"use client";

import { useEffect, useState, useTransition } from "react";
import { assignOfficeAction } from "./actions";

interface Props {
  zoneId: string;
  ownerId: string | null;
  users: { id: string; name: string; email: string }[];
}

/** Selector de dueño (controlado) que guarda al cambiar. */
export function OfficeAssign({ zoneId, ownerId, users }: Props) {
  const [value, setValue] = useState(ownerId ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Si el servidor cambia el dueño (p. ej. se reasignó esta persona a otra oficina), reflejarlo.
  useEffect(() => setValue(ownerId ?? ""), [ownerId]);

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const previous = value;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const res = await assignOfficeAction(zoneId, next || null);
            if (res.error) {
              setValue(previous);
              setError(res.error);
            }
          });
        }}
        aria-label={`Dueño de ${zoneId}`}
        className="w-full rounded-lg border border-line bg-ink px-3 py-1.5 text-sm disabled:opacity-60 sm:w-56"
      >
        <option value="">Sin asignar</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name || u.email}
          </option>
        ))}
      </select>
      {pending && <span className="text-xs text-muted">Guardando…</span>}
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
