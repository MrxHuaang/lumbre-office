import { redirect } from "next/navigation";
import { CabinShowcase } from "@/components/CabinShowcase";
import { CozyTitle, PixelIcon } from "@/components/Cozy";
import { getCurrentUser } from "@/lib/current-user";
import { devLoginEnabled } from "@/lib/dev-login";
import { loginDev, loginWithGoogle } from "../actions";

const ERRORS: Record<string, string> = {
  AccessDenied: "Tu correo no tiene invitación a la cabaña. Pídele a un administrador que te invite.",
  Configuration: "El login con Google no está configurado todavía (faltan credenciales en el .env).",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // Ojo: no basta con que exista la cookie de sesión; el usuario debe existir en la base.
  // Si se borró (p. ej. un admin lo eliminó), mostrar el login en vez de rebotar a "/" en bucle.
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? "No se pudo iniciar sesión. Intenta de nuevo.") : null;

  return (
    <main className="cozy-void relative grid min-h-full overflow-hidden font-pixel text-cozy-ink md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="relative z-[2] flex flex-col justify-between gap-10 px-6 py-8 sm:px-10 md:px-14 md:py-12">
        <div className="cozy-panel flex w-max items-center gap-2 px-3.5 py-2">
          <PixelIcon name="cabin" size={18} color="var(--color-cozy-wood)" />
          <span className="text-[18px] leading-none font-semibold">Hyvento</span>
        </div>

        <div className="flex flex-col gap-7">
          <p className="text-[16px] text-cozy-paper-dark">La oficina virtual del equipo</p>
          <CozyTitle className="text-[clamp(56px,7.5vw,120px)] leading-[0.92]">
            La cabaña
            <br />
            Hyvento
          </CozyTitle>
          <p className="max-w-[32ch] text-[18px] leading-snug text-cozy-paper-light">
            Entra con la cuenta de Google con la que te invitaron.
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
        </div>

        <p className="text-[14px] text-cozy-paper-dark">Adentro: clic para caminar, WASD o flechas, E para sentarte.</p>
      </div>

      <div aria-hidden className="relative order-first grid h-[42vh] place-items-center md:order-none md:h-auto md:min-h-screen">
        <CabinShowcase className="w-[min(96%,980px)] max-md:h-full max-md:w-auto max-md:max-w-[96%] max-md:object-contain" />
        <div className="cozy-panel absolute top-[14%] right-[10%] rotate-[3deg] px-4 py-2 text-[16px]">¡hola equipo!</div>
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
