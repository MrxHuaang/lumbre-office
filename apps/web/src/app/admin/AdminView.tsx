import type { CasinoSettingsDTO } from "@hyvento/shared";
import Link from "next/link";
import { CharacterSprite } from "@/components/CharacterSprite";
import { CozyTitle, PixelIcon } from "@/components/Cozy";
import { asAvatar, asLook } from "@/lib/current-user";
import { revokeInvite, saveCasinoSettingsAction } from "./actions";
import { InviteForm } from "./InviteForm";
import { OfficeAssign } from "./OfficeAssign";

export interface AdminData {
  users: { id: string; name: string; email: string; role: string; avatar: string; look: unknown; onboardedAt: Date | null }[];
  invites: { id: string; email: string; role: string }[];
  offices: { zoneId: string; name: string; ownerId: string | null; isLocked: boolean }[];
  casino: CasinoSettingsDTO;
}

/** Vista de administración del equipo (los datos los carga la página). */
export function AdminView({ users, invites, offices, casino, embedded = false }: AdminData & { embedded?: boolean }) {
  return (
    <main className={`cozy-void min-h-full font-pixel text-cozy-ink ${embedded ? "px-5 py-6 sm:px-8" : "px-6 py-8 sm:px-10 md:px-14 md:py-10"}`}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        {/* Dentro de la cabaña la ventana ya tiene su barra: sin logo ni "Volver a la cabaña". */}
        {!embedded && (
          <header className="flex items-center justify-between gap-4">
            <div className="cozy-panel flex items-center gap-2 px-3.5 py-2">
              <PixelIcon name="cabin" size={18} color="var(--color-cozy-wood)" />
              <span className="text-[18px] leading-none font-semibold">Hyvento</span>
            </div>
            <Link href="/" className="cozy-btn">
              Volver a la cabaña
            </Link>
          </header>
        )}

        <div className="flex flex-col gap-3">
          <CozyTitle className="text-[clamp(48px,7vw,84px)] leading-[0.95]">Equipo</CozyTitle>
          <p className="text-[16px] text-cozy-paper-dark">Solo las personas invitadas pueden entrar con su cuenta de Google.</p>
        </div>

        <Section title="Invitar">
          <InviteForm />
        </Section>

        {invites.length > 0 && (
          <Section title="Invitaciones pendientes" count={invites.length}>
            <ul>
              {invites.map((i) => (
                <Row key={i.id}>
                  <span className="min-w-0 flex-1 truncate">{i.email}</span>
                  <RoleBadge role={i.role} />
                  <form action={revokeInvite}>
                    <input type="hidden" name="email" value={i.email} />
                    <button className="cozy-btn px-2.5 py-1 text-[13px]">Revocar</button>
                  </form>
                </Row>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Casino">
          <form action={saveCasinoSettingsAction} className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" name="enabled" defaultChecked={casino.enabled} className="h-4 w-4 accent-[var(--color-cozy-green)]" />
              Casino abierto
            </label>
            <button type="submit" className="cozy-btn cozy-btn-primary px-4 py-2">
              Guardar
            </button>
          </form>
          <p className="mt-3 text-[13px] text-cozy-ink-soft">
            No hay límite diario: cada quien apuesta mientras le alcancen los puntos. Cerrarlo llega a las mesas al instante.
          </p>
        </Section>

        <Section title="Oficinas" count={offices.length}>
          <p className="text-[13px] text-cozy-ink-soft">
            Se asignan solas al primer ingreso (la primera libre). Los cambios se ven en la cabaña al instante.
          </p>
          {offices.length === 0 ? (
            <p className="mt-3 text-[14px] text-cozy-ink-soft">Las oficinas se crean cuando arranca el servidor de juego.</p>
          ) : (
            <ul className="mt-2">
              {offices.map((o) => (
                <Row key={o.zoneId} className="flex-col items-stretch sm:flex-row sm:items-center">
                  <span className="flex flex-1 items-center gap-2 font-semibold">
                    {o.name}
                    {o.isLocked && (
                      <span className="flex items-center gap-1 border-2 border-cozy-red-deep bg-cozy-red px-1.5 text-[12px] text-cozy-paper-light">
                        <PixelIcon name="lock" size={10} />
                        cerrada
                      </span>
                    )}
                  </span>
                  <OfficeAssign zoneId={o.zoneId} ownerId={o.ownerId} users={users} />
                </Row>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Miembros" count={users.length}>
          <ul>
            {users.map((u) => (
              <Row key={u.id}>
                <CharacterSprite avatar={asAvatar(u.avatar)} look={asLook(u.look)} dir="right" className="w-9 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">{u.name || "—"}</span> <span className="text-cozy-ink-soft">· {u.email}</span>
                </span>
                {!u.onboardedAt && <span className="text-[13px] text-cozy-ink-soft">sin perfil</span>}
                <RoleBadge role={u.role} />
              </Row>
            ))}
          </ul>
        </Section>
      </div>
    </main>
  );
}

/** Panel de madera con el título en la franja de arriba. */
function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="cozy-panel p-1.5">
      <h2 className="flex items-center justify-between gap-3 bg-cozy-wood px-4 py-2 text-cozy-paper-light">
        <span className="text-[18px] font-semibold">{title}</span>
        {count !== undefined && <span className="text-[15px]">{count}</span>}
      </h2>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function Row({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <li className={`flex items-center gap-3 border-b-2 border-cozy-paper-dark py-2.5 text-[15px] last:border-b-0 ${className}`}>
      {children}
    </li>
  );
}

function RoleBadge({ role }: { role: string }) {
  const admin = role === "ADMIN";
  return (
    <span
      className={`shrink-0 border-2 px-2 py-0.5 text-[12px] ${
        admin ? "border-cozy-frame bg-cozy-wood text-cozy-paper-light" : "border-cozy-wood bg-cozy-paper-light"
      }`}
    >
      {admin ? "Admin" : "Miembro"}
    </span>
  );
}
