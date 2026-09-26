"use client";

import { useActionState } from "react";
import { createInvite, type InviteState } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvite, {});

  return (
    <form action={action}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <input
          name="email"
          type="email"
          required
          placeholder="correo@gmail.com"
          aria-label="Correo"
          className="cozy-input min-w-0 flex-1 px-3.5 py-2.5 text-[15px]"
        />
        <select name="role" defaultValue="MEMBER" aria-label="Rol" className="cozy-input cursor-pointer px-3 py-2.5 text-[15px]">
          <option value="MEMBER">Miembro</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button disabled={pending} className="cozy-btn cozy-btn-primary px-5 text-[15px]">
          {pending ? "Invitando…" : "Invitar"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="mt-3 text-[14px] font-semibold text-cozy-red-deep">
          {state.error}
        </p>
      )}
      {state.ok && <p className="mt-3 text-[14px] font-semibold text-cozy-green">{state.ok}</p>}
    </form>
  );
}
