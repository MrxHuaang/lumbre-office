"use client";

// Los aguinaldos de las novenas: las invitaciones a jugar (aceptar o no) y la tira del juego en curso
// arriba al centro: en "pajita en boca", cuánto falta sin hablar; en "sí y no", la pregunta, de quién es
// el turno y la cajita para contestar (sin decir sí ni no). Lo decide todo el servidor (rooms/aguinaldos.ts).
import { AGUINALDO, AGUINALDO_NOMBRE } from "@hyvento/shared";
import { useEffect, useState, type FormEvent } from "react";
import { aguinaldoTotalMs, contestarAguinaldo, rendirseAguinaldo, responderAguinaldo, useNovenas } from "@/game/novenas";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";

export function AguinaldoOverlays() {
  return (
    <>
      <Invitaciones />
      <JuegoEnCurso />
    </>
  );
}

const REGLA = {
  pajita: "Ni chat ni gestos: el primero que hable pierde y paga el aguinaldo.",
  "si-no": "Contesta cada pregunta sin decir sí ni no. Quedarse callado también pierde.",
} as const;

function Invitaciones() {
  const invitaciones = useNovenas((s) => s.invitaciones);
  if (invitaciones.length === 0) return null;
  return (
    <div className="absolute top-1/4 left-1/2 z-50 flex w-[min(360px,calc(100%-1.5rem))] -translate-x-1/2 flex-col gap-3">
      {invitaciones.map((inv) => (
        <div key={inv.id} role="alert" className="cozy-panel px-5 py-4">
          <p className="flex items-center gap-2 text-[15px]">
            <PixelIcon name="gift" size={14} color="var(--color-cozy-red)" />
            <span>
              <strong>{inv.fromName}</strong> te reta a <strong>{AGUINALDO_NOMBRE[inv.juego]}</strong>
            </span>
          </p>
          <p className="mt-1 text-[13px] text-cozy-ink-soft">
            {REGLA[inv.juego]} Quien pierde le da {AGUINALDO.puntos} puntos al otro.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={() => responderAguinaldo(inv.id, true)} className="cozy-btn cozy-btn-primary">
              ¡Juguemos!
            </button>
            <button type="button" onClick={() => responderAguinaldo(inv.id, false)} className="cozy-btn">
              Ahora no
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Segundos que le quedan a lo que corre (se refresca solo mientras hay juego). */
function useLeft(until: number | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, until - now) : 0;
}

function JuegoEnCurso() {
  const juego = useNovenas((s) => s.juego);
  const me = useOfficeStore((s) => s.sessionId);
  const left = useLeft(juego?.until);
  const [text, setText] = useState("");
  // Cada pregunta nueva empieza con la cajita vacía.
  useEffect(() => setText(""), [juego?.numero]);
  if (!juego) return null;
  const otro = juego.a.sessionId === me ? juego.b.name : juego.a.name;
  const miTurno = juego.turno === me;
  const total = aguinaldoTotalMs(juego.juego);
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) contestarAguinaldo(text.trim());
  };
  return (
    <section aria-label={AGUINALDO_NOMBRE[juego.juego]} className="cozy-panel absolute top-3 left-1/2 z-40 flex w-[min(420px,calc(100%-1.5rem))] -translate-x-1/2 flex-col gap-2 px-4 py-3 text-[14px]">
      <p className="flex items-center gap-2 font-semibold">
        <PixelIcon name="gift" size={13} color="var(--color-cozy-red)" />
        <span className="min-w-0 flex-1 truncate">
          {AGUINALDO_NOMBRE[juego.juego]} con {otro}
        </span>
        <span className="tabular-nums text-cozy-ink-soft">{Math.ceil(left / 1000)} s</span>
      </p>
      <div className="h-1.5 w-full bg-cozy-paper-dark" aria-hidden>
        <div className="h-full bg-cozy-red" style={{ width: `${Math.min(100, (left / total) * 100)}%` }} />
      </div>
      {juego.juego === "pajita" ? (
        <p className="text-cozy-ink-soft">Pajita en boca: no escribas en el chat ni hagas gestos hasta que se acabe el tiempo.</p>
      ) : (
        <>
          {juego.ultima && (
            <p className="text-[13px] text-cozy-ink-soft">
              {juego.ultima.name}: “{juego.ultima.text}”
            </p>
          )}
          <p>
            <span className="text-cozy-ink-soft">
              Pregunta {juego.numero} de {AGUINALDO.rondas * 2} · {miTurno ? "te toca" : `le toca a ${otro}`}
            </span>
            <br />
            <strong>{juego.pregunta}</strong>
          </p>
          {miTurno && (
            <form onSubmit={send} className="flex gap-2">
              <input
                autoFocus
                value={text}
                maxLength={AGUINALDO.maxRespuesta}
                onChange={(e) => setText(e.target.value)}
                placeholder="Contesta sin decir sí ni no…"
                aria-label="Tu respuesta"
                className="cozy-input min-w-0 flex-1 px-2 py-1"
              />
              <button type="submit" className="cozy-btn cozy-btn-primary px-3 py-1" disabled={!text.trim()}>
                Contestar
              </button>
            </form>
          )}
        </>
      )}
      <button type="button" onClick={rendirseAguinaldo} className="cozy-btn self-end px-3 py-1 text-[13px]">
        Rendirme
      </button>
    </section>
  );
}
