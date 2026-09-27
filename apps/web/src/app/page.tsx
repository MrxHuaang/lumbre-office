import { OfficeAppLazy as OfficeApp } from "@/components/OfficeAppLazy";
import { Landing } from "@/components/lumbre/Landing";
import { asAvatar, asLook, getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

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
