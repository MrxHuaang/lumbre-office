import { prisma } from "@hyvento/db";
import Link from "next/link";
import { requireAdmin } from "@/lib/current-user";
import { revokeInvite } from "./actions";
import { InviteForm } from "./InviteForm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const [users, invites] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true, onboardedAt: true } }),
    prisma.invite.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <Link href="/" className="text-sm text-muted hover:text-text">
        ← Volver a la oficina
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Equipo</h1>
      <p className="mt-1 text-sm text-muted">Solo las personas invitadas pueden entrar con su cuenta de Google.</p>

      <section className="mt-6 rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-semibold">Invitar</h2>
        <InviteForm />
      </section>

      {invites.length > 0 && (
        <section className="mt-6 rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-semibold">Invitaciones pendientes</h2>
          <ul className="mt-3 divide-y divide-line">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1 truncate">{i.email}</span>
                <RoleBadge role={i.role} />
                <form action={revokeInvite}>
                  <input type="hidden" name="email" value={i.email} />
                  <button className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-panel-2 hover:text-red-300">
                    Revocar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-semibold">Miembros ({users.length})</h2>
        <ul className="mt-3 divide-y divide-line">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="flex-1 truncate">
                {u.name || "—"} <span className="text-muted">· {u.email}</span>
              </span>
              {!u.onboardedAt && <span className="text-xs text-muted">sin perfil</span>}
              <RoleBadge role={u.role} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${role === "ADMIN" ? "bg-accent/15 text-accent" : "bg-panel-2 text-muted"}`}>
      {role === "ADMIN" ? "Admin" : "Miembro"}
    </span>
  );
}
