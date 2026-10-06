// Lo puro del panel del director (components/director/): el mini calendario del año del juego con los
// festivales marcados y los comandos de la paleta Ctrl+K. Sin React ni red, con tests.
import { DIAS_POR_ESTACION, FESTIVALES, SEASONS, festivalesDe, type FestivalDef, type Season } from "@hyvento/shared";
import type { Command } from "./commands";

export interface DiaDelCalendario {
  dia: number;
  /** El festival que cae ese día (o null). */
  festival: FestivalDef | null;
}

/** Las cuatro estaciones con sus 21 días y el festival de cada día. */
export function calendarioDelAño(): { estacion: Season; dias: DiaDelCalendario[] }[] {
  return SEASONS.map((estacion) => {
    const fiestas = festivalesDe(estacion);
    const dias = Array.from({ length: DIAS_POR_ESTACION }, (_, i) => {
      const dia = i + 1;
      return { dia, festival: fiestas.find((f) => dia >= f.dia && dia < f.dia + f.dias) ?? null };
    });
    return { estacion, dias };
  });
}

/** "12 al 20 de invierno" o "7 de invierno": cuándo cae un festival. */
export function fechaDelFestival(f: FestivalDef, estacionTexto: string): string {
  return f.dias > 1 ? `${f.dia} al ${f.dia + f.dias - 1} de ${estacionTexto}` : `${f.dia} de ${estacionTexto}`;
}

export interface DirectorCommandActions {
  open: () => void;
  festival: (id: FestivalDef["id"] | null) => void;
}

/** La paleta: abrir el panel y prender cada festival ya (solo con el permiso `director`). */
export function directorCommands(canDirect: boolean, festivalNow: string, a: DirectorCommandActions): Command[] {
  if (!canDirect) return [];
  const out: Command[] = [
    { id: "director:abrir", group: "Abrir", title: "Panel del director", keywords: ["director", "festival", "clima", "hora", "estacion", "dia"], icon: "clapper", run: () => a.open() },
  ];
  for (const f of FESTIVALES)
    if (f.id !== festivalNow)
      out.push({ id: `director:festival:${f.id}`, group: "Director", title: `Prender ${f.nombre}`, keywords: ["director", "festival", "fiesta"], icon: "party", run: () => a.festival(f.id) });
  if (festivalNow)
    out.push({ id: "director:calendario", group: "Director", title: "Festivales según el calendario", keywords: ["director", "festival", "apagar"], icon: "party", run: () => a.festival(null) });
  return out;
}
