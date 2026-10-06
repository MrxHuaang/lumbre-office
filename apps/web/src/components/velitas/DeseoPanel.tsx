"use client";

// El farol de deseos de la Noche de velitas: en el muelle, con el farol en la mano, se escribe un deseo
// cortito y se suelta (lo valida el servidor: largo, sin enlaces, uno por persona). El farol sube para todos.
import { cleanDeseo, velitasNoticeText, VELITAS } from "@hyvento/shared";
import { useState } from "react";
import { sendDeseo } from "@/game/velitas";
import { PanelShell } from "../PointsPanels";

export function DeseoPanel({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const check = cleanDeseo(text);
  const error = text.trim() && !check.ok ? velitasNoticeText({ code: check.error }) : null;
  const send = () => {
    if (!check.ok) return;
    sendDeseo(check.text);
    onClose();
  };

  return (
    <PanelShell title="Farol de deseos" icon="star" onClose={onClose}>
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <p className="text-[14px] leading-snug text-cozy-ink-soft">Escribe un deseo cortito y suelta el farol: sube sobre el lago y todos lo ven pasar. Uno por noche.</p>
        <input
          autoFocus
          value={text}
          maxLength={VELITAS.deseoMax + 20}
          onChange={(e) => setText(e.target.value)}
          placeholder="Que el año que viene sigamos todos juntos…"
          aria-label="Tu deseo"
          className="cozy-input"
        />
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className={`tabular-nums ${[...text.trim()].length > VELITAS.deseoMax ? "text-cozy-red" : "text-cozy-ink-soft"}`}>
            {[...text.trim()].length}/{VELITAS.deseoMax}
          </span>
          {error && (
            <span role="alert" className="flex-1 text-right text-cozy-red">
              {error}
            </span>
          )}
        </div>
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="cozy-btn">
            Todavía no
          </button>
          <button type="submit" disabled={!check.ok} className="cozy-btn cozy-btn-primary">
            Soltar el farol
          </button>
        </div>
      </form>
    </PanelShell>
  );
}
