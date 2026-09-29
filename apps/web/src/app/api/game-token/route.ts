import { signGameToken } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { asAvatar, asLook, getCurrentUser } from "@/lib/current-user";

/**
 * ¿Puede editar la casa? Un admin; y si está puesta `HOUSE_EDITOR_EMAIL` (uno o varios correos separados
 * por comas), solo esa persona: así una sola persona decide dónde van los muebles.
 */
function canEditHouse(user: { role: string; email: string | null }): boolean {
  if (user.role !== "ADMIN") return false;
  const only = (process.env.HOUSE_EDITOR_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return only.length === 0 || only.includes((user.email ?? "").toLowerCase());
}

/** Emite el token corto con el que el cliente entra al servidor de juego. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!user.onboardedAt) return NextResponse.json({ error: "Completa tu perfil primero" }, { status: 409 });

  const secret = process.env.GAME_TOKEN_SECRET;
  if (!secret) return NextResponse.json({ error: "Falta GAME_TOKEN_SECRET en el servidor" }, { status: 500 });

  const token = await signGameToken(
    {
      sub: user.id,
      name: user.name || user.email,
      avatar: asAvatar(user.avatar),
      look: asLook(user.look) ?? undefined,
      role: user.role,
      houseEditor: canEditHouse(user),
      onboardedAt: user.onboardedAt?.getTime(),
    },
    secret,
  );
  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
}
