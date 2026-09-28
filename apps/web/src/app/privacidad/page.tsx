import type { Metadata } from "next";
import Link from "next/link";
import { CozyTitle } from "@/components/Cozy";
import { LumbreLogo } from "@/components/lumbre/Logo";

export const metadata: Metadata = { title: "Privacidad" };

// Pública: Google la exige (URL de política de privacidad) para publicar el login con Google.
export default function PrivacidadPage() {
  return (
    <main className="cozy-void min-h-full px-4 py-8 font-pixel text-cozy-ink sm:px-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Link href="/" aria-label="Lumbre, volver al inicio">
          <LumbreLogo size={30} />
        </Link>
        <CozyTitle className="text-[clamp(36px,5vw,56px)] leading-none">Privacidad</CozyTitle>
        <section className="cozy-panel flex flex-col gap-4 px-6 py-5 text-[16px] leading-relaxed">
          <p>Lumbre es la cabaña virtual de un equipo. Solo entran personas invitadas.</p>
          <h2 className="text-[18px] font-semibold">Qué guardamos</h2>
          <p>
            Al entrar con Google recibimos tu correo, tu nombre y tu foto de perfil. Además guardamos lo que haces
            dentro: tu personaje, tus notas (privadas), tus puntos, la decoración de tu oficina, los mensajes del chat
            y las fotos que se sacan en la cabaña.
          </p>
          <h2 className="text-[18px] font-semibold">Para qué</h2>
          <p>
            Solo para que la cabaña funcione: identificarte, mostrarte a tu equipo y guardar tu progreso. No vendemos
            ni compartimos tus datos, no hay publicidad y no usamos tu información para nada más.
          </p>
          <h2 className="text-[18px] font-semibold">Audio y video</h2>
          <p>La voz y la cámara van en vivo entre las personas cercanas y no se graban.</p>
          <h2 className="text-[18px] font-semibold">Borrar tu cuenta</h2>
          <p>Pídele a un administrador del equipo que te elimine y se borran tus datos.</p>
        </section>
      </div>
    </main>
  );
}
