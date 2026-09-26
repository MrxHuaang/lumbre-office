"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Profile } from "@/game/store";
import { RISO } from "@/lib/riso";
import { CharacterSprite } from "../CharacterSprite";
import { CalendarApp, NotesApp, TrashApp, useNow, type Confirm } from "./apps";
import {
  BrowserIcon,
  CalendarIcon,
  MailIcon,
  MusicIcon,
  NotesIcon,
  PowerIcon,
  TrashIcon,
  WhiteboardIcon,
} from "./icons";
import type { NotesStore } from "./useNotes";
import { Window, type WindowBox } from "./Window";

type AppId = "notes" | "trash" | "calendar";

interface AppInfo {
  title: string;
  ink: string;
  inkText?: string;
  size: { w: number; h: number };
}

const APPS: Record<AppId, AppInfo> = {
  notes: { title: "Notas", ink: RISO.yellow, size: { w: 780, h: 500 } },
  trash: { title: "Papelera", ink: RISO.blue, inkText: RISO.paper, size: { w: 560, h: 360 } },
  calendar: { title: "Calendario", ink: RISO.green, size: { w: 340, h: 420 } },
};

/** Apps que aún no existen: se ven en el escritorio para mostrar hacia dónde va el PC. */
const FUTURE = [
  { id: "browser", label: "Navegador", Icon: BrowserIcon },
  { id: "music", label: "Música", Icon: MusicIcon },
  { id: "board", label: "Pizarra", Icon: WhiteboardIcon },
  { id: "mail", label: "Mensajes", Icon: MailIcon },
];

interface OpenWindow {
  app: AppId;
  box: WindowBox;
  z: number;
  minimized: boolean;
  maximized: boolean;
}

interface DialogState {
  title: string;
  message: string;
  confirmLabel?: string;
  resolve: (ok: boolean) => void;
}

const timeFmt = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" });

export function Desktop({
  profile,
  notes,
  onLogOff,
  onShutdown,
}: {
  profile: Profile;
  notes: NotesStore;
  onLogOff: () => void;
  onShutdown: () => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ w: 800, h: 500 });
  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  /** Menú contextual (clic derecho) de un ícono del escritorio, en coordenadas del escritorio. */
  const [iconMenu, setIconMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const zTop = useRef(1);
  const now = useNow();

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setBounds({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Con el menú Inicio abierto, cualquier clic fuera lo cierra.
  useEffect(() => {
    if (!startOpen) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-start]")) setStartOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [startOpen]);

  // El menú contextual se cierra con un clic fuera o con Esc, como en Windows.
  useEffect(() => {
    if (!iconMenu) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-ctx]")) setIconMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIconMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [iconMenu]);

  const top = windows.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]?.app ?? null;

  const focus = (app: AppId) =>
    setWindows((ws) => ws.map((w) => (w.app === app ? { ...w, z: ++zTop.current, minimized: false } : w)));

  const open = (app: AppId) => {
    setStartOpen(false);
    setWindows((ws) => {
      if (ws.some((w) => w.app === app)) return ws.map((w) => (w.app === app ? { ...w, z: ++zTop.current, minimized: false } : w));
      const n = ws.length;
      const w = Math.min(APPS[app].size.w, bounds.w - 24);
      const h = Math.min(APPS[app].size.h, bounds.h - 24);
      const box = {
        w,
        h,
        x: Math.max(8, Math.min(120 + n * 28, bounds.w - w - 12)),
        y: Math.max(8, Math.min(24 + n * 24, bounds.h - h - 12)),
      };
      // En pantallas chicas (celular) las ventanas abren maximizadas.
      const maximized = bounds.w < 560;
      return [...ws, { app, box, z: ++zTop.current, minimized: false, maximized }];
    });
  };

  const update = (app: AppId, patch: Partial<OpenWindow>) =>
    setWindows((ws) => ws.map((w) => (w.app === app ? { ...w, ...patch } : w)));

  const confirm: Confirm = (opts) => new Promise((resolve) => setDialog({ ...opts, resolve }));
  const soon = (label: string) =>
    setDialog({ title: label, message: `${label} llegará en una próxima versión del PC.`, resolve: () => undefined });

  const emptyTrash = async () => {
    setIconMenu(null);
    const n = notes.trashed.length;
    const ok = await confirm({
      title: "Vaciar la papelera",
      message: `Se borrarán para siempre ${n} ${n === 1 ? "página" : "páginas"}. No se puede deshacer.`,
      confirmLabel: "Vaciar",
    });
    if (ok) await notes.emptyTrash();
  };

  const trashProperties = () => {
    setIconMenu(null);
    const trashedIds = new Set(notes.trashed.map((n) => n.id));
    const items = notes.trashed.filter((n) => !n.parentId || !trashedIds.has(n.parentId)).length;
    const total = notes.trashed.length;
    setDialog({
      title: "Propiedades de la papelera",
      message:
        total === 0
          ? "La papelera está vacía."
          : `Contiene ${items} ${items === 1 ? "elemento" : "elementos"} (${total} ${total === 1 ? "página" : "páginas"} contando subpáginas). Las notas se quedan aquí hasta que vacíes la papelera.`,
      resolve: () => undefined,
    });
  };

  /** Abrir el menú contextual de un ícono en (clientX, clientY), sin salirse del escritorio. */
  const openIconMenu = (id: string, clientX: number, clientY: number) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedIcon(id);
    setStartOpen(false);
    const MENU_W = 208;
    const MENU_H = 150;
    setIconMenu({
      id,
      x: Math.max(4, Math.min(clientX - rect.left, rect.width - MENU_W - 4)),
      y: Math.max(4, Math.min(clientY - rect.top, rect.height - MENU_H - 4)),
    });
  };

  const icons: { id: string; label: string; icon: React.ReactNode; onOpen: () => void; disabled?: boolean }[] = [
    { id: "notes", label: "Notas", icon: <NotesIcon />, onOpen: () => open("notes") },
    { id: "trash", label: "Papelera", icon: <TrashIcon full={notes.trashed.length > 0} />, onOpen: () => open("trash") },
    { id: "calendar", label: "Calendario", icon: <CalendarIcon />, onOpen: () => open("calendar") },
    ...FUTURE.map((f) => ({ id: f.id, label: f.label, icon: <f.Icon />, onOpen: () => soon(f.label), disabled: true })),
  ];

  const iconFor = (app: AppId, size = 18) =>
    app === "notes" ? (
      <NotesIcon size={size} />
    ) : app === "trash" ? (
      <TrashIcon size={size} full={notes.trashed.length > 0} />
    ) : (
      <CalendarIcon size={size} />
    );

  return (
    <div className="flex h-full flex-col font-plex text-riso-navy">
      {/* Escritorio: fondo de papel con las formas de tinta del login. */}
      <div
        ref={areaRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-riso-paper"
        onPointerDown={(e) => e.target === e.currentTarget && setSelectedIcon(null)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute right-[6%] bottom-[-18%] aspect-square w-[46%] rounded-full opacity-80 mix-blend-multiply"
            style={{ background: `radial-gradient(circle, ${RISO.pink} 2.2px, transparent 2.6px) 0 0 / 11px 11px` }}
          />
          <div className="absolute right-[-6%] bottom-[-30%] aspect-square w-[40%] rounded-full bg-riso-blue opacity-70 mix-blend-multiply" />
          <div className="absolute right-[30%] bottom-[8%] aspect-square w-[12%] rotate-12 bg-riso-yellow mix-blend-multiply" />
          <p className="font-display absolute right-6 top-4 text-sm opacity-50">Hyvento OS</p>
        </div>

        <div className="absolute top-3 left-3 flex max-h-[calc(100%-1.5rem)] flex-col flex-wrap content-start gap-1">
          {icons.map((ic) => (
            <button
              key={ic.id}
              type="button"
              onClick={(e) => {
                setSelectedIcon(ic.id);
                // En pantallas táctiles un toque abre; con mouse, doble clic (como en XP).
                if ((e.nativeEvent as PointerEvent).pointerType === "touch") ic.onOpen();
              }}
              onDoubleClick={ic.onOpen}
              onContextMenu={(e) => {
                e.preventDefault();
                openIconMenu(ic.id, e.clientX, e.clientY);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") ic.onOpen();
                // Tecla de menú o Shift+F10: el menú contextual desde el teclado.
                if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  openIconMenu(ic.id, r.left + r.width / 2, r.top + r.height / 2);
                }
              }}
              title={ic.disabled ? "Próximamente" : `Abrir ${ic.label}`}
              className={`flex w-[96px] flex-col items-center gap-1 p-1.5 ${ic.disabled ? "opacity-45" : ""}`}
            >
              {ic.icon}
              <span
                className={`max-w-full truncate px-1 text-[11px] font-semibold ${
                  selectedIcon === ic.id ? "bg-riso-navy text-riso-paper" : "bg-riso-paper/80"
                }`}
              >
                {ic.label}
              </span>
            </button>
          ))}
        </div>

        {iconMenu &&
          (() => {
            const ic = icons.find((i) => i.id === iconMenu.id);
            if (!ic) return null;
            const run = (fn: () => void) => () => {
              setIconMenu(null);
              fn();
            };
            return (
              <div
                data-ctx
                role="menu"
                aria-label={`Opciones de ${ic.label}`}
                className="riso-panel absolute z-[1500] w-52 py-1 text-[13px]"
                style={{ left: iconMenu.x, top: iconMenu.y }}
              >
                <CtxItem onClick={run(ic.onOpen)} bold disabled={ic.disabled}>
                  Abrir
                </CtxItem>
                {ic.disabled && <p className="px-3 py-1 text-[11px] text-riso-muted">Próximamente</p>}
                {ic.id === "trash" && (
                  <>
                    <CtxItem onClick={() => void emptyTrash()} disabled={notes.trashed.length === 0} icon={<TrashIcon size={16} full={false} />}>
                      Vaciar papelera
                    </CtxItem>
                    <hr className="my-1 border-t border-dashed border-riso-navy/35" />
                    <CtxItem onClick={trashProperties}>Propiedades</CtxItem>
                  </>
                )}
              </div>
            );
          })()}

        {windows.map((w) => {
          const info = APPS[w.app];
          if (w.minimized) return null;
          return (
            <Window
              key={w.app}
              title={info.title}
              icon={iconFor(w.app)}
              ink={info.ink}
              inkText={info.inkText}
              box={w.box}
              z={w.z}
              active={top === w.app}
              maximized={w.maximized}
              bounds={bounds}
              onFocus={() => top !== w.app && focus(w.app)}
              onMove={(x, y) => update(w.app, { box: { ...w.box, x, y } })}
              onMinimize={() => update(w.app, { minimized: true })}
              onToggleMaximize={() => update(w.app, { maximized: !w.maximized })}
              onClose={() => setWindows((ws) => ws.filter((x) => x.app !== w.app))}
            >
              {w.app === "notes" && <NotesApp notes={notes} />}
              {w.app === "trash" && <TrashApp notes={notes} confirm={confirm} />}
              {w.app === "calendar" && <CalendarApp />}
            </Window>
          );
        })}

        {dialog && (
          <div className="absolute inset-0 z-[1000] grid place-items-center bg-riso-navy/25 p-4">
            <div role="alertdialog" aria-label={dialog.title} className="riso-panel w-full max-w-sm">
              <p className="font-display border-b-2 border-riso-navy bg-riso-yellow px-3 py-1.5 text-[13px]">{dialog.title}</p>
              <p className="px-4 py-4 text-[13px] leading-relaxed">{dialog.message}</p>
              <div className="flex justify-end gap-2 px-4 pb-4">
                {dialog.confirmLabel && (
                  <button
                    type="button"
                    onClick={() => {
                      dialog.resolve(true);
                      setDialog(null);
                    }}
                    className="riso-pill riso-press bg-riso-pink px-4 py-1.5 text-xs"
                  >
                    {dialog.confirmLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    dialog.resolve(false);
                    setDialog(null);
                  }}
                  className="riso-pill px-4 py-1.5 text-xs"
                >
                  {dialog.confirmLabel ? "Cancelar" : "Aceptar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barra de tareas estilo XP: Inicio, ventanas abiertas y reloj. */}
      <div className="relative flex h-10 shrink-0 items-stretch border-t-2 border-riso-navy bg-riso-navy">
        <button
          type="button"
          data-start
          onClick={() => setStartOpen((v) => !v)}
          aria-expanded={startOpen}
          className="flex items-center gap-2 rounded-r-full border-2 border-l-0 border-riso-navy bg-riso-pink pr-5 pl-3 italic"
        >
          <span className="h-3.5 w-3.5 rounded-full bg-riso-yellow mix-blend-multiply" />
          <span className="font-display text-[15px] lowercase">inicio</span>
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2">
          {windows.map((w) => (
            <button
              key={w.app}
              type="button"
              onClick={() => (top === w.app ? update(w.app, { minimized: true }) : focus(w.app))}
              className={`flex h-7 max-w-40 min-w-0 items-center gap-1.5 border-[1.5px] border-riso-navy px-2 text-xs font-semibold ${
                top === w.app ? "bg-riso-yellow" : "bg-riso-cream"
              }`}
            >
              {iconFor(w.app, 14)}
              <span className="truncate">{APPS[w.app].title}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => open("calendar")}
          title="Calendario"
          className="border-l-2 border-riso-navy bg-riso-blue px-4 text-[13px] font-semibold text-riso-paper"
        >
          {timeFmt.format(now)}
        </button>

        {startOpen && (
          <div data-start className="riso-panel absolute bottom-full left-0 z-[1001] mb-0.5 w-[min(330px,100%)]">
            <div className="flex items-center gap-3 border-b-2 border-riso-navy bg-riso-blue px-3 py-2.5 text-riso-paper">
              <span className="border-2 border-riso-paper bg-riso-cream">
                <CharacterSprite avatar={profile.avatar} look={profile.look} className="w-10" />
              </span>
              <span className="font-display truncate text-base">{profile.name}</span>
            </div>
            <div className="grid grid-cols-2">
              <ul className="border-r-2 border-riso-navy bg-riso-cream py-1">
                {(Object.keys(APPS) as AppId[]).map((app) => (
                  <li key={app}>
                    <button
                      type="button"
                      onClick={() => open(app)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] font-semibold hover:bg-riso-yellow"
                    >
                      {iconFor(app, 22)}
                      {APPS[app].title}
                    </button>
                  </li>
                ))}
              </ul>
              <ul className="bg-riso-paper py-1">
                <li className="px-3 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.12em] text-riso-muted uppercase">Próximamente</li>
                {FUTURE.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 px-3 py-1 text-xs text-riso-muted opacity-70">
                    <f.Icon size={18} />
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-2 border-t-2 border-riso-navy bg-riso-navy px-2 py-2">
              <button
                type="button"
                onClick={onLogOff}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-riso-paper hover:underline"
              >
                Cerrar sesión
              </button>
              <button
                type="button"
                onClick={onShutdown}
                className="flex items-center gap-1.5 border-[1.5px] border-riso-paper bg-riso-pink px-2.5 py-1 text-xs font-semibold text-riso-navy"
              >
                <PowerIcon size={13} />
                Apagar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CtxItem({
  onClick,
  disabled = false,
  bold = false,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  bold?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-riso-yellow disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent ${
        bold ? "font-semibold" : ""
      }`}
    >
      <span className="grid w-4 shrink-0 place-items-center">{icon}</span>
      {children}
    </button>
  );
}
