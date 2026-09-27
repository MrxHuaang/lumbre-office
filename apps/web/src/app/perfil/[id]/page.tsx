import Link from "next/link";
import { notFound } from "next/navigation";
import { PixelIcon } from "@/components/Cozy";
import { ProfileView } from "@/components/profile/ProfileView";
import { requireUser } from "@/lib/current-user";
import { loadPlayerProfile } from "@/lib/player-profile";

export const dynamic = "force-dynamic";

/** El perfil de alguien del equipo fuera de la cabaña (para compartir el enlace). "me" = el propio. */
export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const profile = await loadPlayerProfile(id === "me" ? user.id : id, user.id);
  if (!profile) notFound();
  return (
    <main className="cozy-void min-h-full px-4 py-6 font-pixel text-cozy-ink sm:py-10">
      <section className="cozy-panel mx-auto flex w-full max-w-4xl flex-col p-1.5">
        <header className="flex items-center justify-between gap-3 bg-cozy-wood px-4 py-2.5 text-cozy-paper-light">
          <h1 className="text-[18px] font-semibold">{profile.isMe ? "Tu perfil" : `Perfil de ${profile.name}`}</h1>
          <Link href="/" className="flex items-center gap-1.5 text-[14px] hover:underline">
            <PixelIcon name="cabin" size={14} />
            Volver a la cabaña
          </Link>
        </header>
        <div className="px-4 py-4">
          <ProfileView profile={profile} />
        </div>
      </section>
    </main>
  );
}
