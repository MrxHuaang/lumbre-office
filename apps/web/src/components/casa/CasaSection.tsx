"use client";

// La casa en el panel lateral (VIR-81/82): en la propia, quién entra (abierta, solo invitados o cerrada)
// y quiénes están de visita, con "Pedir que se vaya"; de visita, de quién es. A la gente se la invita
// desde Conectados ("Invitar") estando en la casa: aceptar la trae hasta acá.
import { CASA_MODO_DEFAULT, CASA_MODO_TEXT, CASA_MODOS, casaOwnerOf, type CasaModo } from "@hyvento/shared";
import { sendCasaKick, sendCasaModo, useCasasStore } from "@/game/casaVisitas";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";

/** ¿Estoy en una casa? El panel lateral la muestra si sí. */
export function useCasaHere(): { ownerId: string; mine: boolean } | null {
  const area = useOfficeStore((s) => s.area);
  const me = useOfficeStore(selectMyUserId);
  const ownerId = casaOwnerOf(area);
  return ownerId ? { ownerId, mine: ownerId === me } : null;
}

/** "Tu casa" o "Casa de Ana". */
export function useCasaTitle(): string {
  const here = useCasaHere();
  const ownerName = useCasasStore((s) => (here ? s.casas[here.ownerId]?.ownerName : undefined));
  const players = useOfficeStore((s) => s.players);
  if (!here) return "";
  if (here.mine) return "Tu casa";
  const name = ownerName || Object.values(players).find((p) => p.userId === here.ownerId)?.name;
  return name ? `Casa de ${name}` : "De visita";
}

export function CasaSection() {
  const here = useCasaHere();
  const modo = useCasasStore((s) => (here ? (s.casas[here.ownerId]?.modo ?? CASA_MODO_DEFAULT) : CASA_MODO_DEFAULT));
  const players = useOfficeStore((s) => s.players);
  if (!here) return null;
  const visits = Object.values(players).filter((p) => p.userId !== here.ownerId && casaOwnerOf(p.area) === here.ownerId);

  if (!here.mine) {
    return (
      <p className="text-[13px] text-cozy-ink-soft">
        Estás de visita. Para volver, espera el Megabús en el refugio de la parada.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div role="radiogroup" aria-label="Quién entra a tu casa" className="flex gap-1.5">
        {CASA_MODOS.map((m: CasaModo) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={modo === m}
            data-on={modo === m}
            onClick={() => modo !== m && sendCasaModo(m)}
            title={CASA_MODO_TEXT[m].hint}
            className="cozy-btn h-[30px] flex-1 px-1.5 text-[12px]"
          >
            <PixelIcon name={m === "cerrada" ? "lock" : "unlock"} size={12} />
            {CASA_MODO_TEXT[m].label}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-cozy-ink-soft">{CASA_MODO_TEXT[modo].hint} Para invitar a alguien: Conectados → Invitar.</p>
      {visits.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="De visita">
          {visits.map((p) => (
            <li key={p.sessionId} className="flex items-center gap-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <button type="button" onClick={() => sendCasaKick(p.userId)} className="cozy-btn px-2 py-0.5 text-[12px]">
                Pedir que se vaya
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
