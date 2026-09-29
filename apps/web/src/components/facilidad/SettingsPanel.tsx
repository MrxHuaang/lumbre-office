"use client";

// Ajustes (menú y paleta): el sonido por tipo, "menos movimiento", el modo trabajo, los avisos del
// navegador, los dispositivos, las paredes y los nombres. Todo se guarda en este navegador.
import { useFacilidadStore } from "@/game/facilidad";
import { notificationsSupported, selectNotifyOn, setNotificationsEnabled, useNotifyStore } from "@/game/notify";
import { NAME_TAG_LABEL, NAME_TAG_MODES, useOfficeStore } from "@/game/store";
import { usePrefsStore, type MotionPref } from "@/lib/prefs";
import { PixelIcon, type PixelIconName } from "../Cozy";
import { OfficeDialog } from "../OfficeDialog";
import { MixerSliders } from "../SoundControl";

const MOTION_OPTIONS: { id: MotionPref; label: string }[] = [
  { id: "system", label: "Como el sistema" },
  { id: "reduce", label: "Menos movimiento" },
  { id: "full", label: "Todo el movimiento" },
];

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const motion = usePrefsStore((s) => s.motion);
  const workMode = usePrefsStore((s) => s.workMode);
  const walls = useOfficeStore((s) => s.privateWalls);
  const nameTags = useOfficeStore((s) => s.nameTags);
  const setDevices = useFacilidadStore((s) => s.setDevices);
  const systemReduces = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <OfficeDialog
      title="Ajustes"
      onClose={onClose}
      className="max-w-lg"
      footer={
        <>
          <p className="mr-auto text-[12px] text-cozy-ink-soft">Se guarda en este navegador.</p>
          <button type="button" onClick={onClose} className="cozy-btn cozy-btn-primary px-4 py-1.5 text-[14px]">
            Listo
          </button>
        </>
      }
    >
      <div className="cozy-scroll flex min-h-0 flex-col gap-5 overflow-y-auto px-4 py-4 text-[14px]">
        <Section icon="sound" title="Sonido">
          <MixerSliders />
        </Section>

        <Section icon="leaf" title="Movimiento">
          <p className="text-[13px] text-cozy-ink-soft">
            Con menos movimiento: sin temblores ni destellos, menos lluvia, hojas, nieve y bichos, y el zoom sin animación.
            {motion === "system" && ` Tu sistema ahora pide ${systemReduces ? "menos movimiento" : "todo el movimiento"}.`}
          </p>
          <div role="radiogroup" aria-label="Movimiento" className="grid grid-cols-3 gap-1">
            {MOTION_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={motion === o.id}
                aria-pressed={motion === o.id}
                onClick={() => usePrefsStore.getState().setMotion(o.id)}
                className="cozy-btn px-2 py-1.5 text-[13px]"
              >
                {o.label}
              </button>
            ))}
          </div>
        </Section>

        <Section icon="briefcase" title="Modo trabajo">
          <Toggle on={workMode} onClick={() => usePrefsStore.getState().setWorkMode(!workMode)}>
            Esconder lo de juego
          </Toggle>
          <p className="text-[13px] text-cozy-ink-soft">
            Sin el contador de puntos, los avisos de logros ni las tarjetas de juego. Quedan las llamadas, tu estado, el chat, las reuniones, la pantalla
            compartida, el mapa y la mochila. Solo cambia lo que ves tú.
          </p>
        </Section>

        <Section icon="bell" title="Avisos y dispositivos">
          <NotifyToggle />
          <button
            type="button"
            onClick={() => {
              onClose();
              setDevices(true);
            }}
            className="cozy-btn justify-start gap-2 px-3 py-1.5 text-[14px]">
            <PixelIcon name="mic" size={14} />
            Micrófono, cámara y parlantes…
          </button>
        </Section>

        <Section icon="home" title="La casa">
          <Toggle on={walls} onClick={() => useOfficeStore.getState().setPrivateWalls(!walls)}>
            Paredes altas adentro
          </Toggle>
          <div className="flex flex-col gap-1">
            <span className="text-[13px]">Nombres sobre los personajes</span>
            <div role="radiogroup" aria-label="Nombres sobre los personajes" className="grid grid-cols-3 gap-1">
              {NAME_TAG_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={nameTags === m}
                  aria-pressed={nameTags === m}
                  onClick={() => useOfficeStore.getState().setNameTags(m)}
                  className="cozy-btn px-2 py-1.5 text-[13px]"
                >
                  {NAME_TAG_LABEL[m].replace("Nombres ", "")}
                </button>
              ))}
            </div>
          </div>
        </Section>
      </div>
    </OfficeDialog>
  );
}

function Section({ icon, title, children }: { icon: PixelIconName; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold">
        <PixelIcon name={icon} size={16} color="var(--color-cozy-wood)" />
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Un interruptor (el mismo dibujo que los del menú). */
function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className="flex w-full items-center gap-2.5 py-1 text-left text-[14px]">
      <span className="flex-1">{children}</span>
      <span aria-hidden className={`relative h-4 w-7 shrink-0 border-2 border-cozy-frame ${on ? "bg-cozy-green" : "bg-cozy-paper-dark"}`}>
        <span className={`absolute top-0 h-full w-2.5 bg-cozy-paper-light ${on ? "right-0" : "left-0"}`} />
      </span>
    </button>
  );
}

/** Avisos del navegador con la cabaña en segundo plano (ver game/notify.ts). El clic pide el permiso. */
function NotifyToggle() {
  const on = useNotifyStore(selectNotifyOn);
  const denied = useNotifyStore((s) => s.permission === "denied");
  if (!notificationsSupported()) return <p className="text-[13px] text-cozy-ink-soft">Este navegador no muestra avisos.</p>;
  return (
    <>
      <Toggle
        on={on}
        onClick={() => {
          if (denied) {
            useOfficeStore.getState().notify("El navegador bloqueó los avisos: actívalos desde el candado de la barra de direcciones.", "warning");
            return;
          }
          void setNotificationsEnabled(!on).then((ok) => {
            if (!on && !ok) useOfficeStore.getState().notify("Sin permiso del navegador no podemos avisarte.", "warning");
          });
        }}
      >
        Avisos del navegador en segundo plano
      </Toggle>
      {denied && <p className="text-[12px] text-cozy-ink-soft">El navegador los tiene bloqueados para esta página.</p>}
    </>
  );
}
