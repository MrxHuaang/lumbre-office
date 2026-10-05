import { prisma, teamFishAlbum } from "@hyvento/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

/**
 * El álbum de pesca de todo el equipo (para el acuario de la sala): por especie, con quién la sacó. Con
 * `?user=<id>`, solo lo de esa persona (el acuario de su casa).
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const only = new URL(req.url).searchParams.get("user")?.slice(0, 64) || undefined;
  const entries = await teamFishAlbum(prisma, only);
  return NextResponse.json({ entries }, { headers: { "Cache-Control": "no-store" } });
}
