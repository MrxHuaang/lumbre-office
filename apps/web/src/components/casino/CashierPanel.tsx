"use client";

// Fase 4: la caja del casino. Cómo vas hoy, tu límite de pérdidas y el ranking semanal del casino.
import type { HumanAvatar, Look } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { CharacterSprite } from "../CharacterSprite";
import { PixelIcon } from "../Cozy";
import { api, PanelShell } from "../PointsPanels";

interface CasinoState {
  balance: number;
  enabled: boolean;
  limit: number;
  todayNet: number;
  remaining: number;
  days: number;
  ranking: { userId: string; name: string; avatar: HumanAvatar; look: Look | null; net: number }[];
  me: string;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function CashierPanel({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<CasinoState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<CasinoState>("/api/casino").then(setData, (e: Error) => setError(e.message));
  }, []);

  return (
    <PanelShell title="Caja del casino" icon="coin" onClose={onClose} wide>
      {!data ? (
        <p className="text-[14px] text-cozy-ink-soft">{error ?? "Contando fichas…"}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {!data.enabled && (
            <p className="border-2 border-cozy-red-deep bg-cozy-paper-light px-3 py-2 text-[14px] text-cozy-red-deep">
              El casino está cerrado por ahora (lo decide un admin).
            </p>
          )}
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Tu saldo" value={String(data.balance)} coin />
            <Stat label="Hoy en el casino" value={signed(data.todayNet)} tone={data.todayNet > 0 ? "good" : data.todayNet < 0 ? "bad" : undefined} />
            <Stat label="Límite de pérdidas" value={`${data.limit} al día`} />
            <Stat label="Te queda para apostar" value={String(data.remaining)} tone={data.remaining === 0 ? "bad" : undefined} />
          </section>
          <p className="text-[13px] text-cozy-ink-soft">
            Se apuesta con puntos y no se canjean por nada: es para divertirse. El límite cuenta lo que llevas perdido hoy (con las apuestas abiertas) y se reinicia a medianoche.
          </p>

          <section className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              <PixelIcon name="trophy" size={14} color="var(--color-cozy-gold)" />
              Ganancia neta en el casino (últimos {data.days} días)
            </p>
            {data.ranking.length === 0 ? (
              <p className="text-[14px] text-cozy-ink-soft">Nadie ha jugado esta semana todavía.</p>
            ) : (
              <ol>
                {data.ranking.map((r, i) => (
                  <li
                    key={r.userId}
                    className={`flex items-center gap-3 border-b-2 border-cozy-paper-dark px-2 py-1.5 text-[15px] last:border-b-0 ${r.userId === data.me ? "bg-cozy-paper-dark" : ""}`}
                  >
                    <span className={`w-6 text-center font-semibold ${i === 0 ? "text-cozy-gold" : "text-cozy-ink-soft"}`}>{i + 1}</span>
                    <CharacterSprite avatar={r.avatar} look={r.look} dir="right" className="w-8 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      {r.name}
                      {r.userId === data.me && " (tú)"}
                    </span>
                    <span className={`font-semibold ${r.net > 0 ? "text-cozy-green" : r.net < 0 ? "text-cozy-red-deep" : ""}`}>{signed(r.net)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </PanelShell>
  );
}

function Stat({ label, value, coin, tone }: { label: string; value: string; coin?: boolean; tone?: "good" | "bad" }) {
  return (
    <div className="flex flex-col gap-1 border-2 border-cozy-paper-dark bg-cozy-paper-light px-3 py-2">
      <span className="text-[12px] text-cozy-ink-soft">{label}</span>
      <span className={`flex items-center gap-1 text-[17px] font-semibold ${tone === "good" ? "text-cozy-green" : tone === "bad" ? "text-cozy-red-deep" : ""}`}>
        {coin && <PixelIcon name="coin" size={14} color="var(--color-cozy-gold)" />}
        {value}
      </span>
    </div>
  );
}
