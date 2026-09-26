import { redirect } from "next/navigation";
import { Overprint, RisoLogo, Sprite } from "@/components/Riso";
import { getCurrentUser } from "@/lib/current-user";
import { RISO } from "@/lib/riso";
import { loginWithGoogle } from "../actions";

const ERRORS: Record<string, string> = {
  AccessDenied: "Tu correo no tiene invitación a la oficina. Pídele a un administrador que te invite.",
  Configuration: "El login con Google no está configurado todavía (faltan credenciales en el .env).",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // Ojo: no basta con que exista la cookie de sesión; el usuario debe existir en la base.
  // Si se borró (p. ej. un admin lo eliminó), mostrar el login en vez de rebotar a "/" en bucle.
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? "No se pudo iniciar sesión. Intenta de nuevo.") : null;

  return (
    <main className="riso-grain relative grid min-h-full overflow-hidden md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="relative z-[2] flex flex-col justify-between gap-10 px-6 py-8 sm:px-10 md:px-14 md:py-12">
        <RisoLogo />

        <div className="flex flex-col gap-7">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-riso-blue uppercase">
            Oficina virtual · Equipo Hyvento
          </p>
          <Overprint
            as="h1"
            lines={["Oficina", "virtual"]}
            back={RISO.blue}
            front={RISO.pink}
            offset={[5, 4]}
            className="text-[clamp(64px,9vw,148px)] leading-[0.86] tracking-[-0.035em]"
          />
          <p className="max-w-[30ch] text-[17px] leading-normal text-pretty">
            Entra con la cuenta de Google con la que te invitaron.
          </p>

          {message && (
            <p
              role="alert"
              className="riso-panel max-w-md px-4 py-3 text-sm leading-relaxed"
              style={{ "--riso-shadow": RISO.pink } as React.CSSProperties}
            >
              {message}
            </p>
          )}

          <form action={loginWithGoogle} className="flex">
            <button
              type="submit"
              className="riso-cta border-0 bg-riso-navy text-riso-paper"
              style={{ "--riso-shadow": RISO.pink } as React.CSSProperties}
            >
              <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-riso-paper text-[15px] font-black text-riso-navy [font-family:var(--riso-archivo)]">
                G
              </span>
              Continuar con Google
            </button>
          </form>
        </div>

        <p className="text-xs text-riso-muted">Usa las flechas o WASD para moverte dentro.</p>
      </div>

      {/* Ilustración: semitono rosa, disco azul, cuadrado amarillo y el personaje saludando. */}
      <div aria-hidden className="relative order-first grid h-[45vh] place-items-center md:order-none md:h-auto md:min-h-screen">
        <div
          className="absolute aspect-square w-[78%] max-w-[78vh] rounded-full opacity-90 mix-blend-multiply"
          style={{
            background: `radial-gradient(circle, ${RISO.pink} 2.2px, transparent 2.6px) 0 0 / 11px 11px`,
            transform: "translate(-6%, -4%)",
          }}
        />
        <div
          className="absolute aspect-square w-[62%] max-w-[62vh] rounded-full bg-riso-blue opacity-85 mix-blend-multiply"
          style={{ transform: "translate(12%, 10%)" }}
        />
        <div
          className="absolute aspect-square w-[30%] max-w-[30vh] bg-riso-yellow mix-blend-multiply"
          style={{ transform: "translate(-70%, 95%) rotate(12deg)" }}
        />
        <Sprite
          avatar="ada"
          className="relative w-[min(30vw,260px)] max-md:w-[min(40vw,28vh)]"
          style={{ filter: "drop-shadow(8px 8px 0 rgba(31,42,68,.35))" }}
        />
        <div className="absolute top-[22%] right-[12%] rotate-[4deg] border-2 border-riso-navy bg-riso-paper px-3.5 py-2 text-[13px] font-semibold shadow-[4px_4px_0_var(--color-riso-navy)]">
          ¡hola equipo!
        </div>
      </div>
    </main>
  );
}
