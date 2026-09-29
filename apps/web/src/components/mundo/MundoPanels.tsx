"use client";

// Los paneles de mundo lleno: los abre el mueble (el tragamonedas, la garra, el estante de premios y la
// rueda del sótano) o Doña Gloria en la recepción. Office.tsx solo monta esto.
import { useOfficeStore } from "@/game/store";
import { ClawPanel } from "./ClawPanel";
import { FortunePanel } from "./FortunePanel";
import { PrizesPanel } from "./PrizesPanel";
import { ReceptionPanel } from "./ReceptionPanel";
import { SlotsPanel } from "./SlotsPanel";

export function MundoPanels() {
  const kind = useOfficeStore((s) => s.panel?.kind);
  const close = useOfficeStore((s) => s.closePanel);
  if (kind === "slots") return <SlotsPanel onClose={close} />;
  if (kind === "claw") return <ClawPanel onClose={close} />;
  if (kind === "prizes") return <PrizesPanel onClose={close} />;
  if (kind === "fortune") return <FortunePanel onClose={close} />;
  if (kind === "reception") return <ReceptionPanel onClose={close} />;
  return null;
}
