"use client";

import { useActionState } from "react";
import { createInvite, type InviteState } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvite, {});

  return (
    <form action={action} className="mt-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="email"
          type="email"
          required
          placeholder="correo@gmail.com"
          className="flex-1 rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select name="role" defaultValue="MEMBER" className="rounded-lg border border-line bg-ink px-3 py-2 text-sm">
          <option value="MEMBER">Miembro</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          {pending ? "Invitando…" : "Invitar"}
        </button>
      </div>
      {state.error && <p className="mt-2 text-sm text-red-300">{state.error}</p>}
      {state.ok && <p className="mt-2 text-sm text-emerald-300">{state.ok}</p>}
    </form>
  );
}
