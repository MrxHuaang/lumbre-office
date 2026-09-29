"use client";

// La ayuda de atajos (menú, paleta o la tecla ?): las teclas del juego y, en pantallas táctiles, los
// gestos. En el celular también se llega desde el menú (el "?" de la barra se esconde por falta de lugar).
import { isTouchScreen } from "@/game/touchInput";
import { useFacilidadStore } from "@/game/facilidad";
import { DECOR_CONTROLS, gameControls, TOUCH_CONTROLS } from "@/lib/shortcuts";
import { OfficeDialog } from "../OfficeDialog";

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const touch = isTouchScreen();
  return (
    <OfficeDialog
      title="Atajos y ayuda"
      onClose={onClose}
      className="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={() => useFacilidadStore.getState().show("palette")}
            className="cozy-btn mr-auto px-3 py-1.5 text-[14px]"
          >
            Abrir la búsqueda
          </button>
          <button type="button" onClick={onClose} className="cozy-btn cozy-btn-primary px-4 py-1.5 text-[14px]">
            Listo
          </button>
        </>
      }
    >
      <div className="cozy-scroll flex min-h-0 flex-col gap-5 overflow-y-auto px-4 py-4">
        {touch && <Table title="En la pantalla táctil" rows={TOUCH_CONTROLS} />}
        <Table title={touch ? "Con teclado" : "Teclado y mouse"} rows={gameControls()} />
        <Table title="Decorando tu oficina o la casa" rows={DECOR_CONTROLS} />
      </div>
    </OfficeDialog>
  );
}

function Table({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section>
      <h3 className="mb-2 text-[15px] font-semibold">{title}</h3>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-[14px]">
        {rows.map(([key, what]) => (
          <div key={key} className="contents">
            <dt>
              <kbd className="cozy-kbd inline-block min-w-[4.5rem] text-center">{key}</kbd>
            </dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
