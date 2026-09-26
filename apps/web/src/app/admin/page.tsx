import { prisma } from "@hyvento/db";
import { requireAdmin } from "@/lib/current-user";
import { AdminView } from "./AdminView";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const [users, invites, offices] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, avatar: true, look: true, onboardedAt: true },
    }),
    prisma.invite.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.office.findMany({ orderBy: { zoneId: "asc" }, select: { zoneId: true, name: true, ownerId: true, isLocked: true } }),
  ]);
  return <AdminView users={users} invites={invites} offices={offices} />;
}
