import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { loadPlayerProfile } from "@/lib/player-profile";

type Params = { params: Promise<{ id: string }> };

/**
 * El perfil público de alguien del equipo (personaje, oficina, puntos, estadísticas y logros). Solo con
 * sesión; "me" = el propio. No incluye el correo ni nada privado (notas, mochila, movimientos).
 */
export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const profile = await loadPlayerProfile(id === "me" ? user.id : id, user.id);
  if (!profile) return NextResponse.json({ error: "No encontramos a esa persona" }, { status: 404 });
  return NextResponse.json(profile, { headers: { "Cache-Control": "no-store" } });
}
