// La casa de cada persona (docs/plan-casas.md): cada casa es un nivel `casa:<userId>` que no está en el
// mundo. La sala las arma cuando alguien entra y las suelta cuando se vacían, así la memoria no crece con
// cada persona que alguna vez pasó por su casa. Quién puede entrar lo dice `casaPropiaBlock` de
// @hyvento/shared (por ahora solo el dueño; las visitas son VIR-81/82).
import { buildCasaPropia, type OfficeMap } from "@hyvento/map";
import { casaPropiaBlock, isCasaArea, type CasaPropiaBlock } from "@hyvento/shared";

export class CasasPropias {
  private readonly casas = new Map<string, OfficeMap>();

  /** `occupied` = el `area` de cada jugador de la sala (una casa con alguien adentro no se suelta). */
  constructor(private readonly occupied: () => Iterable<string>) {}

  /** El nivel de una casa (armado si hace falta); `undefined` si `area` no es la casa de alguien. */
  get(area: string): OfficeMap | undefined {
    const hit = this.casas.get(area);
    if (hit) return hit;
    const map = buildCasaPropia(area);
    if (!map) return undefined;
    // Antes de guardar otra se sueltan las vacías: quedan a lo sumo las ocupadas y la nueva.
    this.sweep();
    this.casas.set(area, map);
    return map;
  }

  /** Suelta las casas donde ya no hay nadie (se vuelven a armar desde la plantilla si alguien entra). */
  sweep() {
    const live = new Set<string>();
    for (const area of this.occupied()) if (isCasaArea(area)) live.add(area);
    for (const id of this.casas.keys()) if (!live.has(id)) this.casas.delete(id);
  }

  /** Cuántas casas hay armadas (para los tests). */
  get size() {
    return this.casas.size;
  }

  /** ¿Puede `userId` entrar a `area`? `null` si sí (o si no es una casa). */
  canEnter(area: string, userId: string): CasaPropiaBlock | null {
    return casaPropiaBlock(area, userId);
  }
}
