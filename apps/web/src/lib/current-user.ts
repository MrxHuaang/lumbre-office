import "server-only";
import { prisma } from "@hyvento/db";
import { HUMAN_AVATARS, type HumanAvatar } from "@hyvento/shared";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

export function asAvatar(value: string): HumanAvatar {
  return (HUMAN_AVATARS as readonly string[]).includes(value) ? (value as HumanAvatar) : "ada";
}
