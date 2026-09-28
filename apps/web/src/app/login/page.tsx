import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CozyTitle, PixelIcon } from "@/components/Cozy";
import { EscenaViva } from "@/components/lumbre/EscenaViva";
import { LumbreLogo } from "@/components/lumbre/Logo";
import { getCurrentUser } from "@/lib/current-user";
import { devLoginEnabled } from "@/lib/dev-login";
import { loginDev, loginWithGoogle } from "../actions";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  AccessDenied: "Tu correo no tiene invitación a la cabaña. Pídele a un administrador que te invite.",
  Configuration: "El login con Google no está configurado todavía (faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY).",
  Callback: "Google no devolvió la sesión. Intenta de nuevo.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // Ojo: no basta con que exista la cookie de sesión; el usuario debe existir en la base.
  // Si se borró (p. ej. un admin lo eliminó), mostrar el login en vez de rebotar a "/" en bucle.
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? "No se pudo iniciar sesión. Intenta de nuevo.") : null;

  return (
    <main className="cozy-void relative grid min-h-full overflow-x-clip font-pixel text-cozy-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <div className="relative z-[2] flex flex-col justify-between gap-10 px-4 py-6 sm:px-10 md:px-14 lg:py-10">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" aria-label="Lumbre, volver al inicio">
            <LumbreLogo size={30} />
          </Link>
          <Link href="/" className="text-[15px] text-cozy-paper-dark underline-offset-4 hover:text-cozy-paper-light hover:underline">
            Volver al inicio
          </Link>
        </div>

        <div className="flex flex-col items-start gap-6">
          <span className="cozy-chip flex items-center gap-2 px-3 py-1.5 text-[14px] leading-none">
            <PixelIcon name="cabin" size={14} color="var(--color-cozy-wood)" />
            La cabaña de Hyvento
          </span>
          <CozyTitle className="text-[clamp(48px,6.4vw,96px)] leading-[0.95]">
            Entra a
            <br />
            la cabaña
          </CozyTitle>
          <p className="max-w-[34ch] text-[18px] leading-snug text-cozy-paper-light">
            Usa la cuenta de Google con la que te invitaron. Adentro te espera tu oficina y el resto del equipo.
          </p>

          {message && (
            <p role="alert" className="cozy-panel max-w-md px-5 py-3 text-[15px] leading-relaxed text-cozy-red-deep">
              {message}
            </p>
          )}

          <form action={loginWithGoogle} className="flex">
            <button type="submit" className="cozy-btn cozy-btn-primary gap-3 px-6 py-3.5 text-[18px]">
              <span className="grid h-7 w-7 place-items-center border-2 border-[#2e5a40] bg-cozy-paper-light text-[16px] font-semibold text-cozy-green">
                G
              </span>
              Continuar con Google
            </button>
          </form>

          {devLoginEnabled() && <DevLogin />}

          <p className="max-w-[40ch] text-[15px] leading-snug text-cozy-paper-dark">
            ¿Tu equipo todavía no tiene cabaña? Pronto va a poder crear la suya.{" "}
            <Link href="/#tu-equipo" className="text-cozy-paper-light underline underline-offset-4 hover:text-cozy-wood-light">
              Ver cómo será
            </Link>
          </p>
        </div>

        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-[14px] text-cozy-paper-dark">
          Adentro: clic para caminar, <kbd className="cozy-kbd">W</kbd>
          <kbd className="cozy-kbd">A</kbd>
          <kbd className="cozy-kbd">S</kbd>
          <kbd className="cozy-kbd">D</kbd> o flechas, <kbd className="cozy-kbd">E</kbd> para sentarte.
        </p>
      </div>

      <div className="relative order-first grid place-items-center px-2 pt-4 lg:order-none lg:min-h-screen lg:pt-0 lg:pr-8 lg:pl-0">
        <EscenaViva className="w-[min(100%,1040px)]" saludo="¡llegaste!" />
      </div>
    </main>
  );
}

/** SOLO DESARROLLO LOCAL (no aparece en producción): entrar sin Google con un usuario de prueba. */
function DevLogin() {
  return (
    <form action={loginDev} className="cozy-panel flex max-w-md flex-col gap-3 px-5 py-4">
      <p className="text-[15px] font-semibold">Entrar de prueba (solo en tu máquina)</p>
      <label className="flex flex-col gap-1.5 text-[14px]">
        Nombre
        <input name="name" defaultValue="Juan" maxLength={24} required className="cozy-input px-3 py-2 text-[16px]" />
      </label>
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" name="admin" defaultChecked className="h-4 w-4 accent-[var(--color-cozy-green)]" />
        Con permisos de administrador
      </label>
      <button type="submit" className="cozy-btn cozy-btn-primary px-5 py-2.5 text-[16px]">
        Entrar de prueba
      </button>
      <p className="text-[13px] text-cozy-ink-soft">
        Crea o reutiliza <code>nombre@hyvento.test</code>. Para probar con varias personas, abre otra ventana en incógnito con otro nombre.
      </p>
    </form>
  );
}
