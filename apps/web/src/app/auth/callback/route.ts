import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail, syncUser } from "@/auth";
import { supabaseServer } from "@/lib/supabase";

/** Vuelta de Google (vía Supabase): canjea el código por la sesión y valida la invitación. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const fail = (error: string) => NextResponse.redirect(`${origin}/login?error=${error}`);
  const code = searchParams.get("code");
  const supabase = await supabaseServer();
  if (!supabase) return fail("Configuration");
  if (!code) return fail("Callback");

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const user = data?.user;
  const email = user?.email?.toLowerCase();
  if (error || !user || !email) return fail("Callback");
  // Google siempre verifica el correo; igual se exige para no aceptar otro proveedor sin verificar.
  if (!user.email_confirmed_at || !(await isAllowedEmail(email))) {
    await supabase.auth.signOut();
    return fail("AccessDenied");
  }

  const meta = user.user_metadata ?? {};
  await syncUser({ email, name: meta.full_name ?? meta.name, image: meta.avatar_url ?? meta.picture });
  return NextResponse.redirect(`${origin}/`);
}
