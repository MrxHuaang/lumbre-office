import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
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
    <main className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 text-center shadow-2xl sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-panel-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/characters/ada.png" alt="" className="pixelated h-auto w-auto" style={{ objectFit: "none", objectPosition: "0 0", width: 32, height: 32, transform: "scale(1.5)" }} />
        </div>
        <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-accent uppercase">Hyvento</p>
        <h1 className="mt-1 text-2xl font-bold">Oficina virtual</h1>
        <p className="mt-2 text-sm text-muted">Entra con la cuenta de Google con la que te invitaron.</p>

        {message && (
          <p role="alert" className="mt-5 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-left text-sm text-red-200">
            {message}
          </p>
        )}

        <form action={loginWithGoogle} className="mt-6">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#1f1f1f] transition hover:bg-white/90"
          >
            <GoogleIcon />
            Continuar con Google
          </button>
        </form>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
