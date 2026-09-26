"use client";

import { useRef } from "react";
import { assignOfficeAction } from "./actions";

interface Props {
  zoneId: string;
  ownerId: string | null;
  users: { id: string; name: string; email: string }[];
}

/** Selector de dueño que guarda al cambiar. */
export function OfficeAssign({ zoneId, ownerId, users }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={assignOfficeAction}>
      <input type="hidden" name="zoneId" value={zoneId} />
      <select
        name="userId"
        defaultValue={ownerId ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label={`Dueño de ${zoneId}`}
        className="w-full rounded-lg border border-line bg-ink px-3 py-1.5 text-sm sm:w-56"
      >
        <option value="">Sin asignar</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name || u.email}
          </option>
        ))}
      </select>
    </form>
  );
}
