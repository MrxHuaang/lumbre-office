"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { createDevSession, DEV_SESSION_COOKIE, DEV_SESSION_MAX_AGE, devLoginEnabled } from "@/lib/dev-login";

export async function loginWithGoogle() {
  if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    redirect("/login?error=Configuration");
  }
  await signIn("google", { redirectTo: "/" });
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
  await signOut({ redirectTo: "/login" });
}
