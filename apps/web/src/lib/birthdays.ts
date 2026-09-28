// Cumpleaños del equipo (GET/PATCH /api/birthdays): el calendario del PC los muestra y en "Editar perfil"
// cada uno pone el suyo (día y mes, sin año).

export interface BirthdaysDTO {
  /** Mi cumpleaños ("MM-DD") o null. */
  me: string | null;
  /** Los cumpleaños del equipo (solo día y mes), para el calendario del PC. */
  people: { id: string; name: string; birthday: string }[];
}

export async function loadBirthdays(): Promise<BirthdaysDTO> {
  const res = await fetch("/api/birthdays", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudieron cargar los cumpleaños");
  return (await res.json()) as BirthdaysDTO;
}

/** Guarda mi cumpleaños ("MM-DD") o lo borra (null). */
export async function saveBirthday(birthday: string | null): Promise<void> {
  const res = await fetch("/api/birthdays", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ birthday }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "No se pudo guardar el cumpleaños");
}
