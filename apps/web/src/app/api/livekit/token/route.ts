import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

/** Sala única de LiveKit para toda la oficina; la proximidad se resuelve suscribiéndose selectivamente. */
const LIVEKIT_ROOM = "hyvento-office";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });

  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json({ error: "Audio/video no configurado" }, { status: 503 });
  }

  // La identidad es el User.id: así cada participante de video corresponde a un avatar del juego.
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: user.id,
    name: user.name || user.email,
    ttl: "6h",
  });
  at.addGrant({
    room: LIVEKIT_ROOM,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });

  return NextResponse.json(
    { token: await at.toJwt(), url: process.env.LIVEKIT_PUBLIC_URL ?? LIVEKIT_URL },
    { headers: { "Cache-Control": "no-store" } },
  );
}
