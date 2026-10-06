"use client";

// Carrera de sillas: el panel de la salida (E junto a la bandera del pasillo del piso 2) con los récords de
// la semana y el botón para largar, y el cronómetro mientras se corre (en la pila de avisos de abajo).
import { raceTimeText } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { pumpRace, raceBoost, requestRaceBoard, sendRaceCancel, sendRaceStart, useRaceStore } from "@/game/race";
import { PanelShell } from "./PointsPanels";

export function RacePanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const board = useRaceStore((s) => s.board);
  const last = useRaceStore((s) => s.last);
  useEffect(() => requestRaceBoard(), []);
  // El resultado se olvida al cerrar (no en la limpieza del efecto: en desarrollo React la corre al montar).
  const close = () => {
    useRaceStore.getState().setLast(null);
    onClose();
  };

  return (
    <PanelShell title="Carrera de sillas" icon="trophy" onClose={close}>
      <div className="flex flex-col gap-3 text-[14px]">
        {last ? (
          <p className="cozy-chip px-3 py-2 text-center text-[15px]">
            Llegaste en <strong>{raceTimeText(last.ms)}</strong>
            {last.best ? " · ¡tu mejor tiempo de la semana!" : ""}
          </p>
        ) : (
          <p className="text-cozy-ink-soft">
            Montado en una silla de oficina, de esta bandera a la meta a cuadros del otro lado del pasillo. La silla avanza sola: haz clic (o
            Espacio) muchas veces para darle impulso y cambia de carril con W/S o las flechas para esquivar. Si te sales del pasillo, se anula.
          </p>
        )}
        <section aria-label="Récords de la semana">
          <h3 className="mb-1 text-[13px] font-semibold text-cozy-ink-soft">Récords de la semana</h3>
          {board?.entries.length ? (
            <ol className="flex flex-col gap-0.5">
              {board.entries.map((e, i) => (
                <li key={`${e.name}-${i}`} className="flex items-center gap-2 border-b border-dashed border-cozy-ink-soft/30 py-0.5">
                  <span className="w-5 text-right text-cozy-ink-soft">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  <span className="font-semibold">{raceTimeText(e.ms)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-cozy-ink-soft">{board ? "Nadie corrió todavía esta semana." : "Cargando…"}</p>
          )}
          {board?.myBest != null && <p className="mt-1 text-[13px]">Tu mejor tiempo: {raceTimeText(board.myBest)}</p>}
        </section>
        <button
          type="button"
          disabled={!atObject}
          onClick={() => {
            sendRaceStart();
            close();
          }}
          className="cozy-btn cozy-btn-primary self-center px-5"
        >
          {last ? "¡Otra vez!" : "¡A correr!"}
        </button>
        {!atObject && <p className="text-center text-[12px] text-cozy-ink-soft">La salida es junto a la bandera del pasillo (piso 2, al oeste).</p>}
      </div>
    </PanelShell>
  );
}

/** Mientras corro: el cronómetro, la barra de impulso (clic o Espacio) y "Abandonar" (Esc). */
export function RaceTimer() {
  const since = useRaceStore((s) => s.since);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, [since]);
  if (since === null) return null;
  const boost = raceBoost();
  return (
    <div className="cozy-chip pointer-events-auto flex flex-wrap items-center justify-center gap-3 px-3 py-1.5 text-[14px]">
      <span>
        Carrera <strong className="tabular-nums">{raceTimeText(Math.max(0, now - since))}</strong>
      </span>
      <button type="button" onClick={() => pumpRace()} className="cozy-btn cozy-btn-primary px-2 py-0.5 text-[12px]" title="Cada clic (o Espacio) acelera la silla">
        ¡Impulso!
      </button>
      <span className="flex items-center gap-1.5 text-[12px] text-cozy-ink-soft">
        <span className="h-2.5 w-24 border-2 border-cozy-frame bg-cozy-paper-dark" aria-label={`Impulso ${Math.round(boost * 100)} %`}>
          <span className="block h-full bg-cozy-red" style={{ width: `${boost * 100}%` }} />
        </span>
        clic o Espacio · W/S carril
      </span>
      <button type="button" onClick={() => sendRaceCancel()} className="cozy-btn px-2 py-0.5 text-[12px]">
        <kbd className="cozy-kbd mr-1">Esc</kbd>
        Abandonar
      </button>
    </div>
  );
}
