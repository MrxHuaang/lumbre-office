import { fishAlbum, prisma } from "@hyvento/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

/** El álbum de pesca: las capturas de quien pregunta, agrupadas por especie. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const entries = await fishAlbum(prisma, user.id);
  return NextResponse.json({ entries }, { headers: { "Cache-Control": "no-store" } });
}
