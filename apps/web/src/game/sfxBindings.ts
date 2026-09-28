// Sonidos de la interfaz que salen del estado (paneles, chat, avisos, toques de puerta) y el clic de los
// botones cozy. OfficeScene lo engancha al crearse y lo suelta al destruirse.
import { sfx } from "./sfx";
import { selectFocusing, useOfficeStore } from "./store";

export function bindUiSounds(): () => void {
  const unsub = useOfficeStore.subscribe((s, prev) => {
    // Paneles de los objetos (café, bar, tienda, buzón, tablón, casino, mochila…).
    if (s.panel?.kind !== prev.panel?.kind) {
      if (s.panel) sfx.uiOpen();
      else sfx.uiClose();
    }
    if (s.chatOpen !== prev.chatOpen) {
      if (s.chatOpen) sfx.uiOpen();
      else sfx.uiClose();
    }
    // Un aviso nuevo (los que se van no suenan).
    const notice = s.notices.at(-1);
    if (notice && !prev.notices.some((n) => n.id === notice.id)) sfx.notice(notice.tone);
    // Mensaje nuevo de otra persona (el historial al conectar llega viejo, y los avisos del sistema: no
    // suenan). En modo foco, silencio.
    if (s.messages.length > prev.messages.length && !selectFocusing(s)) {
      const m = s.messages.at(-1);
      if (m && m.fromId && m.fromId !== s.sessionId && Date.now() - m.ts < 10_000) sfx.chat();
    }
    // Toqué la puerta de una oficina, o alguien toca la mía.
    if (s.pendingKnock && s.pendingKnock !== prev.pendingKnock) sfx.knock();
    if (s.knockRequests.length > prev.knockRequests.length) sfx.knock(0.8);
  });

  // Clic en un botón cozy: después de que React lo atienda, por si abrió o cerró algo (eso ya suena).
  const onClick = (e: MouseEvent) => {
    const el = e.target instanceof Element ? e.target.closest("button.cozy-btn") : null;
    if (!el || (el as HTMLButtonElement).disabled) return;
    setTimeout(() => sfx.click(), 0);
  };
  document.addEventListener("click", onClick, true);

  return () => {
    unsub();
    document.removeEventListener("click", onClick, true);
  };
}
