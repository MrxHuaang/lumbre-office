import { getCasinoSettings, permisosDados, permisosDeTodos, prisma } from "@hyvento/db";
import { requireAdmin } from "@/lib/current-user";
import { AdminView } from "./AdminView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administración" };

/** `?embed=1`: dentro de la ventana "Administrar equipo" de la oficina (sin cabecera ni enlace de vuelta). */
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ embed?: string }> }) {
  await requireAdmin();
  const { embed } = await searchParams;
  const [users, invites, offices, casino, everyone, byUser] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, avatar: true, look: true, onboardedAt: true },
    }),
    prisma.invite.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.office.findMany({ orderBy: { zoneId: "asc" }, select: { zoneId: true, name: true, ownerId: true, isLocked: true } }),
    getCasinoSettings(prisma),
    permisosDeTodos(prisma),
    // Pocas personas: se leen los permisos de todas (los ids se filtran contra el catálogo).
    prisma.user.findMany({ select: { id: true } }).then((us) => permisosDados(prisma, us.map((u) => u.id))),
  ]);
  return (
    <AdminView
      users={users}
      invites={invites}
      offices={offices}
      casino={casino}
      permisos={{ everyone, byUser }}
      embedded={embed === "1"}
    />
  );
}
