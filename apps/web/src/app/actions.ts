"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

export async function loginWithGoogle() {
  if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    redirect("/login?error=Configuration");
  }
  await signIn("google", { redirectTo: "/" });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
