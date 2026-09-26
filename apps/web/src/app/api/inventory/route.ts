import { listInventory, prisma } from "@hyvento/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

/** La mochila: muebles guardados (sin poner) y ropa comprada. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const inventory = await listInventory(prisma, user.id);
  return NextResponse.json({ inventory }, { headers: { "Cache-Control": "no-store" } });
}
