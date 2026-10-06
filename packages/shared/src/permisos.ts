// Permisos por persona: acciones que antes eran solo de admins y que un admin puede dar a quien quiera,
// o abrir a todo el equipo con "todos pueden". Un admin siempre las tiene todas. Los ids se guardan en la
// base (`UserPermission`, `PermissionSetting`): no cambiarlos; si uno se retira, la base lo ignora.
// El servidor valida cada acción con `puede`; el cliente solo lo anticipa (oculta botones).
import { z } from "zod";

export const PERMISOS = [
  { id: "anunciar", nombre: "Anunciar", descripcion: "Anuncio de texto y de voz a toda la cabaña." },
  { id: "editar-casa", nombre: "Editar la casa", descripcion: "Mover, girar, agregar y quitar muebles en cualquier nivel." },
  { id: "director", nombre: "Panel del director", descripcion: "Prender festivales, cambiar el clima, la hora y el día, y disparar momentos." },
] as const;

export type Permiso = (typeof PERMISOS)[number]["id"];
export const PERMISO_IDS = PERMISOS.map((p) => p.id) as [Permiso, ...Permiso[]];
export const PermisoId = z.enum(PERMISO_IDS);

export function isPermiso(value: unknown): value is Permiso {
  return typeof value === "string" && (PERMISO_IDS as readonly string[]).includes(value);
}

export function permisoInfo(id: Permiso) {
  return PERMISOS.find((p) => p.id === id)!;
}

/**
 * Lo que puede hacer alguien: todo si es admin; si no, lo que le dieron más lo abierto a todos. Descarta
 * ids que ya no están en el catálogo y devuelve en el orden del catálogo.
 */
export function permisosEfectivos(input: { admin: boolean; granted: readonly string[]; everyone: readonly string[] }): Permiso[] {
  if (input.admin) return [...PERMISO_IDS];
  const has = new Set([...input.granted, ...input.everyone]);
  return PERMISO_IDS.filter((p) => has.has(p));
}

/** ¿Puede hacerlo? `permisos` son los efectivos (ver `permisosEfectivos`); el admin pasa siempre. */
export function puede(who: { admin?: boolean; permisos?: readonly string[] } | null | undefined, permiso: Permiso): boolean {
  return Boolean(who && (who.admin || who.permisos?.includes(permiso)));
}

/** Lo que el servidor le manda a cada cliente al entrar y cada vez que cambian sus permisos. */
export const PermisosView = z.object({ admin: z.boolean(), permisos: z.array(PermisoId) });
export type PermisosView = z.infer<typeof PermisosView>;

export const PERMISOS_MSG = {
  /** Servidor → cliente: `PermisosView`. */
  state: "permisos:state",
} as const;

/** Web: dar o quitar un permiso a una persona (solo admins). */
export const SetPermisoBody = z.object({ userId: z.string().min(1), permiso: PermisoId, on: z.boolean() });
export type SetPermisoBody = z.infer<typeof SetPermisoBody>;

/** Web: abrir o cerrar un permiso para todo el equipo (solo admins). */
export const SetPermisoTodosBody = z.object({ permiso: PermisoId, on: z.boolean() });
export type SetPermisoTodosBody = z.infer<typeof SetPermisoTodosBody>;

/** Los permisos de una persona para el panel "Dar permiso…": los que le dieron y los abiertos a todos. */
export interface PermisosPersonaDTO {
  userId: string;
  admin: boolean;
  granted: Permiso[];
  everyone: Permiso[];
}
