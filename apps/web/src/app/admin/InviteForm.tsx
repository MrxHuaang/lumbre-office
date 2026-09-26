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
          className="riso-input min-w-0 flex-1 px-3.5 py-2.5 text-sm"
        />
        <select name="role" defaultValue="MEMBER" aria-label="Rol" className="riso-input cursor-pointer px-3 py-2.5 text-sm">
          <option value="MEMBER">Miembro</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button
          disabled={pending}
          className="riso-pill riso-press bg-riso-pink px-5 text-sm"
        >
          {pending ? "Invitando…" : "Invitar"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="mt-3 text-[13px] font-semibold text-riso-pink-deep">
          {state.error}
        </p>
      )}
      {state.ok && <p className="mt-3 text-[13px] font-semibold text-[#00824a]">{state.ok}</p>}
    </form>
  );
}
