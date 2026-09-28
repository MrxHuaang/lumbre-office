"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createDevSession, DEV_SESSION_COOKIE, DEV_SESSION_MAX_AGE, devLoginEnabled } from "@/lib/dev-login";
import { supabaseServer } from "@/lib/supabase";

/** Origen público del sitio (detrás del proxy de Vercel el host viene en las cabeceras). */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export async function loginWithGoogle() {
  const supabase = await supabaseServer();
  if (!supabase) redirect("/login?error=Configuration");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    // Esta URL tiene que estar en Supabase → Authentication → URL Configuration → Redirect URLs.
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=Configuration");
  redirect(data.url);
}

/**
 * SOLO DESARROLLO LOCAL: entrar con un usuario de prueba, sin Google. Además de `devLoginEnabled`
 * (next dev + base local), exige que la página se esté viendo desde localhost.
 */
export async function loginDev(formData: FormData) {
  const host = (await headers()).get("host") ?? "";
  if (!devLoginEnabled() || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) redirect("/login");
  const name = String(formData.get("name") ?? "").trim().slice(0, 24) || "Tester";
  const { token } = await createDevSession(name, { admin: formData.get("admin") === "on" });
  (await cookies()).set(DEV_SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: DEV_SESSION_MAX_AGE });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(DEV_SESSION_COOKIE);
  await (await supabaseServer())?.auth.signOut();
  redirect("/login");
}
