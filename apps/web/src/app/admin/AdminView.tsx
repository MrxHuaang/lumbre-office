import Link from "next/link";
import { CharacterSprite } from "@/components/CharacterSprite";
import { Overprint, RisoLogo } from "@/components/Riso";
import { asAvatar, asLook } from "@/lib/current-user";
import { RISO } from "@/lib/riso";
import { revokeInvite } from "./actions";
import { InviteForm } from "./InviteForm";
import { OfficeAssign } from "./OfficeAssign";

export interface AdminData {
  users: { id: string; name: string; email: string; role: string; avatar: string; look: unknown; onboardedAt: Date | null }[];
  invites: { id: string; email: string; role: string }[];
  offices: { zoneId: string; name: string; ownerId: string | null; isLocked: boolean }[];
}

/** Vista de administración del equipo (los datos los carga la página). */
export function AdminView({ users, invites, offices, embedded = false }: AdminData & { embedded?: boolean }) {
  return (
    <main className={`riso-grain min-h-full ${embedded ? "px-5 py-6 sm:px-8" : "px-6 py-8 sm:px-10 md:px-14 md:py-10"}`}>
      <div className="mx-auto flex max-w-3xl flex-col gap-9">
        {/* Dentro de la oficina la ventana ya tiene su barra: sin logo ni "Volver a la oficina". */}
        {!embedded && (
          <header className="flex items-center justify-between gap-4">
            <RisoLogo />
            <Link href="/" className="text-[13px] font-semibold">
              ← Volver a la oficina
            </Link>
          </header>
        )}

        <div className="flex flex-col gap-4">
          <Overprint
            as="h1"
            lines={["Equipo"]}
            back={RISO.pink}
            front={RISO.blue}
            offset={[4, 3]}
            className="text-[clamp(48px,7vw,88px)] leading-[0.9] tracking-[-0.03em]"
          />
          <p className="text-[15px]">Solo las personas invitadas pueden entrar con su cuenta de Google.</p>
        </div>

        <Section title="Invitar" ink={RISO.pink}>
          <InviteForm />
        </Section>

        {invites.length > 0 && (
          <Section title="Invitaciones pendientes" ink={RISO.yellow} count={invites.length}>
            <ul>
              {invites.map((i) => (
                <Row key={i.id}>
                  <span className="min-w-0 flex-1 truncate">{i.email}</span>
                  <RoleBadge role={i.role} />
                  <form action={revokeInvite}>
                    <input type="hidden" name="email" value={i.email} />
                    <button className="text-xs underline underline-offset-2 hover:text-riso-pink-deep">Revocar</button>
                  </form>
                </Row>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Oficinas" ink={RISO.blue} count={offices.length}>
          <p className="text-xs text-riso-muted">
            Se asignan solas al primer ingreso (la primera libre). Los cambios se ven en la oficina al instante.
          </p>
          {offices.length === 0 ? (
            <p className="mt-3 text-[13px] text-riso-muted">Las oficinas se crean cuando arranca el servidor de juego.</p>
          ) : (
            <ul className="mt-2">
              {offices.map((o) => (
                <Row key={o.zoneId} className="flex-col items-stretch sm:flex-row sm:items-center">
                  <span className="flex flex-1 items-center gap-2 font-semibold">
                    {o.name}
                    {o.isLocked && (
                      <span className="border-[1.5px] border-riso-navy bg-riso-pink px-1.5 text-[11px]">cerrada</span>
                    )}
                  </span>
                  <OfficeAssign zoneId={o.zoneId} ownerId={o.ownerId} users={users} />
                </Row>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Miembros" ink={RISO.green} count={users.length}>
          <ul>
            {users.map((u) => (
              <Row key={u.id}>
                <CharacterSprite avatar={asAvatar(u.avatar)} look={asLook(u.look)} className="w-8 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">{u.name || "—"}</span>{" "}
                  <span className="text-riso-muted">· {u.email}</span>
                </span>
                {!u.onboardedAt && <span className="text-xs text-riso-muted">sin perfil</span>}
                <RoleBadge role={u.role} />
              </Row>
            ))}
          </ul>
        </Section>
      </div>
    </main>
  );
}

/** Tarjeta de papel con la sombra en la tinta de la sección. */
function Section({ title, ink, count, children }: { title: string; ink: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="riso-panel" style={{ "--riso-shadow": ink } as React.CSSProperties}>
      <h2 className="flex items-center justify-between gap-3 border-b-2 border-riso-navy px-5 py-3">
        <span className="font-display text-[17px]">{title}</span>
        {count !== undefined && <span className="text-[13px] font-semibold">{count}</span>}
      </h2>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Row({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <li
      className={`flex items-center gap-3 border-b border-dashed border-riso-navy/35 py-2.5 text-[13px] last:border-b-0 ${className}`}
    >
      {children}
    </li>
  );
}

function RoleBadge({ role }: { role: string }) {
  const admin = role === "ADMIN";
  return (
    <span
      className={`shrink-0 rounded-full border-[1.5px] border-riso-navy px-2.5 py-0.5 text-[11px] font-semibold ${
        admin ? "bg-riso-pink" : "bg-riso-cream"
      }`}
    >
      {admin ? "Admin" : "Miembro"}
    </span>
  );
}
