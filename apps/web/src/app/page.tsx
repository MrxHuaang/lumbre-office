import type { Metadata } from "next";
import { OfficeAppLazy as OfficeApp } from "@/components/OfficeAppLazy";
import { Landing } from "@/components/lumbre/Landing";
import { ESLOGAN, MARCA } from "@/components/lumbre/marca";
import { asAvatar, asLook, getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// La portada presenta Lumbre para cualquier equipo (crear el mundo propio llega pronto).
const DESCRIPCION_PORTADA =
  "Lumbre es la oficina virtual cozy en pixel-art para tu equipo: audio y video por cercanía, oficinas propias y un mundo con día y noche, clima, huerto y pesca. Pronto, con el nombre de tu equipo en el letrero.";

export const metadata: Metadata = {
  title: { absolute: `${MARCA} · ${ESLOGAN}` },
  description: DESCRIPCION_PORTADA,
  keywords: ["oficina virtual", "trabajo remoto", "pixel-art", "equipos", "video por proximidad", "cozy"],
  openGraph: { type: "website", siteName: MARCA, title: `${MARCA} · ${ESLOGAN}`, description: DESCRIPCION_PORTADA, locale: "es_CO", url: "/" },
  twitter: { card: "summary_large_image", title: `${MARCA} · ${ESLOGAN}`, description: DESCRIPCION_PORTADA },
};

export default async function Home() {
  // Sin sesión (o si el usuario ya no existe en la base) se ve la portada pública de Lumbre.
  const user = await getCurrentUser();
  if (!user) return <Landing />;
  return (
    <OfficeApp
      user={{
        name: user.name,
        avatar: asAvatar(user.avatar),
        look: asLook(user.look),
        isAdmin: user.role === "ADMIN",
        onboarded: Boolean(user.onboardedAt),
      }}
    />
  );
}
