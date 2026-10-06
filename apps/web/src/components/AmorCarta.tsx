"use client";

// La carta anónima de Amor y amistad en el buzón (la lleva Cupido) y lo que comparten los paneles de la fiesta:
// elegir a alguien conectado y el botón que espera la respuesta del servidor. Va aparte de AmorPanel.tsx
// porque el buzón (PointsPanels.tsx) la importa.
import { AMOR } from "@hyvento/shared";
import { useEffect, useMemo, useState } from "react";
import { amorAhora, genteConectada, sendCarta, useAmorStore } from "@/game/amorAmistad";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";

/** Si no llega respuesta del servidor en este tiempo, los botones vuelven a estar disponibles. */
const PENDING_MS = 3000;

/** Un botón que espera la respuesta del servidor: se suelta al llegar (o a los 3 s). */
export function usePending(accion: "anotar" | "regalo" | "carta" | "serenata" | "comprar") {
  const last = useAmorStore((s) => s.last);
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    if (last?.accion === accion) setPending(null);
  }, [last, accion]);
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(id);
  }, [pending]);
  return [pending, setPending] as const;
}

/** Elegir a alguien conectado. */
export function Persona({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const players = useOfficeStore((s) => s.players);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gente = useMemo(() => genteConectada(), [players]);
  return (
    <label className="flex flex-col gap-1 text-[14px] text-cozy-ink">
      Para quién
      <select className="cozy-input px-2 py-1 text-[15px]" value={value} onChange={(ev) => onChange(ev.target.value)}>
        <option value="">Elija a alguien</option>
        {gente.map((p) => (
          <option key={p.userId} value={p.userId}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** En el buzón, durante la fiesta: escribir una carta anónima que Cupido entrega en persona. */
export function AmorCartaSection({ atObject }: { atObject: boolean }) {
  const open = useOfficeStore((s) => s.festival.id === AMOR.id && s.festival.fase === "fiesta");
  const enviadas = useAmorStore((s) => s.estado.cartasEnviadas);
  const [para, setPara] = useState("");
  const [texto, setTexto] = useState("");
  const [pending, setPending] = usePending("carta");
  if (!open || !amorAhora()) return null;
  const why = !atObject ? "Acérquese al buzón" : !para ? "Elija a quién" : !texto.trim() ? "Escriba la carta" : enviadas >= AMOR.cartasMax ? "Ya mandó todas las cartas de hoy" : "";
  return (
    <section className="flex flex-col gap-2 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2">
      <p className="flex items-center gap-1.5 text-[15px] font-semibold text-cozy-ink">
        <PixelIcon name="heart" size={13} />
        Carta anónima de amor y amistad
      </p>
      <p className="text-[13px] text-cozy-ink-soft">Va sin firma y la entrega Cupido en persona. Con cariño y sin enlaces.</p>
      <Persona value={para} onChange={setPara} />
      <textarea className="cozy-input min-h-20 px-2 py-1 text-[15px]" value={texto} maxLength={AMOR.cartaMax} onChange={(ev) => setTexto(ev.target.value)} placeholder="Gracias por ayudarme siempre con..." />
      <button
        type="button"
        disabled={Boolean(why) || pending !== null}
        title={why || "Mandar la carta"}
        onClick={() => {
          setPending("carta");
          sendCarta(para, texto);
          setTexto("");
        }}
        className="cozy-btn cozy-btn-primary flex items-center gap-1.5 self-start px-3 py-1.5 text-[14px]"
      >
        <PixelIcon name="mail" size={12} />
        {why || "Mandarla con Cupido"}
      </button>
      <p className="text-[12px] text-cozy-ink-soft">
        Cartas de hoy: {enviadas} de {AMOR.cartasMax}.
      </p>
    </section>
  );
}
