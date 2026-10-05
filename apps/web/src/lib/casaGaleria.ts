// La galería de la casa propia (VIR-88): la vitrina, el corcho y el acuario del pasillo muestran lo del
// dueño de la casa (sus trofeos, las fotos en las que sale o que sacó y los peces que pescó), no lo de todo
// el equipo como en la cabaña. Puro, con tests.
import { parseCasaArea, type PhotoDTO } from "@hyvento/shared";

/** El dueño de la casa de ese nivel (null si no es una casa). */
export function casaOwnerOf(area: string): string | null {
  return parseCasaArea(area)?.owner ?? null;
}

/** Las fotos de una persona: las que sacó y en las que sale (en el orden de la lista: lo más nuevo primero). */
export function photosOfPerson(photos: readonly PhotoDTO[], userId: string): PhotoDTO[] {
  return photos.filter((p) => p.takenBy.id === userId || p.people.some((x) => x.id === userId));
}
