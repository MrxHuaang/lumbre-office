import { listInventory, prisma } from "@hyvento/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

/** La mochila: muebles guardados (sin poner). La ropa es gratis y no pasa por aquí. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const inventory = await listInventory(prisma, user.id);
  return NextResponse.json({ inventory }, { headers: { "Cache-Control": "no-store" } });
}
