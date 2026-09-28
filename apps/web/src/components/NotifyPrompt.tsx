"use client";

import { useEffect, useState } from "react";
import { notificationsSupported, setNotificationsEnabled, syncNotifyState, useNotifyStore } from "@/game/notify";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "./Cozy";

/** Lo que tarda en aparecer después de entrar (que primero se vea la cabaña). */
const DELAY_MS = 6000;

/**
 * La primera vez que se entra a la cabaña: un aviso suave para activar los avisos del navegador. El
 * permiso se pide recién con el clic (los navegadores castigan pedirlo al cargar). Si dice "Ahora no",
 * no vuelve a salir: queda la opción en el menú → Ajustes.
 */
export function NotifyPrompt() {
  const pref = useNotifyStore((s) => s.pref);
  const permission = useNotifyStore((s) => s.permission);
  const mapReady = useOfficeStore((s) => s.mapReady);
  const [ready, setReady] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    syncNotifyState();
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const t = setTimeout(() => setReady(true), DELAY_MS);
    return () => clearTimeout(t);
  }, [mapReady]);

  if (!ready || pref !== null || permission === "denied" || !notificationsSupported()) return null;

  const enable = async () => {
    setAsking(true);
    const ok = await setNotificationsEnabled(true);
    setAsking(false);
    useOfficeStore
      .getState()
      .notify(ok ? "Listo: te avisamos si te llaman o te buscan con Lumbre en segundo plano." : "Sin permiso del navegador no podemos avisarte. Puedes cambiarlo en el menú.", ok ? "success" : "info");
  };

  return (
    <div role="dialog" aria-label="Activar avisos" className="cozy-panel pointer-events-auto flex w-full flex-col gap-2.5 px-4 py-3 text-[14px]">
      <p className="flex items-start gap-2.5">
        <PixelIcon name="bell" size={16} color="var(--color-cozy-wood)" className="mt-0.5 shrink-0" />
        <span>¿Te avisamos si te llaman, tocan tu puerta o te mencionan mientras estás en otra pestaña?</span>
      </p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={enable} disabled={asking} className="cozy-btn cozy-btn-primary">
          Activar avisos
        </button>
        <button type="button" onClick={() => void setNotificationsEnabled(false)} disabled={asking} className="cozy-btn">
          Ahora no
        </button>
      </div>
    </div>
  );
}
