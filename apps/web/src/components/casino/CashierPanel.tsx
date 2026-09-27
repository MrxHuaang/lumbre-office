"use client";

// Fase 4: la caja del casino. Cómo vas hoy, tu límite de pérdidas y el ranking semanal del casino. Es
// una ventanilla con el estilo de las mesas: marco de caoba, reja de bronce, paño verde y los números
// pixel del paño.
import type { HumanAvatar, Look } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { CharacterSprite } from "../CharacterSprite";
import { PixelIcon } from "../Cozy";
import { api, PanelShell } from "../PointsPanels";
import { PixelNumber } from "./PixelArt";

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

/** Colores de la mesa (los mismos del arte del casino). */
const T = {
  felt: "#2e5a40",
  feltLight: "#437a55",
  wood: "#5a331d",
  woodDark: "#3f2416",
  bronze: "#b98424",
  bronzeLight: "#f3d672",
  cream: "#fffaf0",
  good: "#8cc653",
  bad: "#f1b98a",
};

export function CashierPanel({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<CasinoState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<CasinoState>("/api/casino").then(setData, (e: Error) => setError(e.message));
  }, []);

  return (
    <PanelShell title="Caja del casino" icon="coin" onClose={onClose} wide>
      {/* Marco de caoba con la reja de bronce arriba: la ventanilla. */}
      <div className="border-4 p-1.5" style={{ background: T.wood, borderColor: T.woodDark, boxShadow: `inset 0 0 0 2px ${T.bronze}` }}>
        <div
          aria-hidden
          className="h-5 border-2"
          style={{
            borderColor: T.bronze,
            background: `repeating-linear-gradient(90deg, ${T.bronzeLight} 0 3px, ${T.bronze} 3px 5px, ${T.woodDark} 5px 14px)`,
          }}
        />
        <div className="mt-1.5 flex flex-col gap-4 border-2 px-3 py-3" style={{ background: T.felt, borderColor: T.bronze, color: T.cream }}>
          {!data ? (
            <p className="text-[14px]">{error ?? "Contando fichas…"}</p>
          ) : (
            <>
              {!data.enabled && (
                <p className="border-2 px-3 py-2 text-[14px]" style={{ borderColor: T.bad, color: T.bad }}>
                  El casino está cerrado por ahora (lo decide un admin).
                </p>
              )}
              <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Tu saldo" value={String(data.balance)} coin />
                <Stat label="Hoy en el casino" value={signed(data.todayNet)} tone={data.todayNet > 0 ? "good" : data.todayNet < 0 ? "bad" : undefined} />
                <Stat label="Límite al día" value={String(data.limit)} />
                <Stat label="Te queda para apostar" value={String(data.remaining)} tone={data.remaining === 0 ? "bad" : undefined} />
              </section>
              <p className="text-[13px] leading-snug opacity-85">
                Se apuesta con puntos y no se canjean por nada: es para divertirse. El límite cuenta lo que llevas perdido hoy (con las apuestas abiertas) y se reinicia a medianoche.
              </p>

              <section className="flex flex-col gap-2">
                <p className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: T.bronzeLight }}>
                  <PixelIcon name="trophy" size={14} color={T.bronzeLight} />
                  Ganancia neta en el casino (últimos {data.days} días)
                </p>
                {data.ranking.length === 0 ? (
                  <p className="text-[14px] opacity-85">Nadie ha jugado esta semana todavía.</p>
                ) : (
                  <ol className="border-2" style={{ borderColor: T.bronze }}>
                    {data.ranking.map((r, i) => (
                      <li
                        key={r.userId}
                        className="flex items-center gap-3 border-b-2 px-2 py-1.5 text-[15px] last:border-b-0"
                        style={{ borderColor: T.feltLight, background: r.userId === data.me ? T.feltLight : undefined }}
                      >
                        <span className="grid w-7 place-items-center">
                          <PixelNumber value={i + 1} scale={2} color={i === 0 ? T.bronzeLight : T.cream} outline={T.woodDark} />
                        </span>
                        <CharacterSprite avatar={r.avatar} look={r.look} dir="right" className="w-8 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">
                          {r.name}
                          {r.userId === data.me && " (tú)"}
                        </span>
                        <PixelNumber value={signed(r.net)} scale={2} color={r.net > 0 ? T.good : r.net < 0 ? T.bad : T.cream} outline={T.woodDark} />
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

/** Placa de bronce sobre el paño, con el valor en números pixel. */
function Stat({ label, value, coin, tone }: { label: string; value: string; coin?: boolean; tone?: "good" | "bad" }) {
  return (
    <div className="flex flex-col gap-1.5 border-2 px-2.5 py-2" style={{ borderColor: T.bronze, background: T.woodDark, boxShadow: `inset 0 0 0 1px ${T.wood}` }}>
      <span className="text-[12px] leading-tight" style={{ color: T.bronzeLight }}>
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        {coin && <PixelIcon name="coin" size={14} color={T.bronzeLight} />}
        <PixelNumber value={value} scale={3} color={tone === "good" ? T.good : tone === "bad" ? T.bad : T.cream} outline="#140f18" />
      </span>
    </div>
  );
}
