import { prisma, teamFishAlbum } from "@hyvento/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

/** El álbum de pesca de todo el equipo (para el acuario de la sala): por especie, con quién la sacó. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const entries = await teamFishAlbum(prisma);
  return NextResponse.json({ entries }, { headers: { "Cache-Control": "no-store" } });
}
