import type { Profile } from "@/game/store";

/** Guarda nombre y personaje del usuario actual (PATCH /api/profile). */
export async function saveProfile(p: Profile): Promise<void> {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "No se pudo guardar");
}
