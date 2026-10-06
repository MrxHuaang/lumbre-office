"use client";

// La paleta de comandos (Ctrl+K / ⌘K, o la lupa del HUD): se escribe y aparece lo que coincide, por grupos
// (personas, lugares, abrir, estado, emotes, ajustes). Flechas para elegir, Enter para usar, Esc para
// cerrar. Los comandos vienen del registro (lib/commands.ts): cada parte suma los suyos.
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { listCommands, rankCommands, subscribeCommands, type Command } from "@/lib/commands";
import { paletteKey } from "@/lib/shortcuts";
import { sfx } from "@/game/sfx";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";

/** Cuántos se muestran como mucho (la lista entera es larga: todos los lugares y las personas). */
const MAX_RESULTS = 60;
/** Sin escribir nada, cuántos por grupo (lo demás aparece al buscar). */
const PER_GROUP_IDLE = 6;

let version = 0;
const subscribe = (fn: () => void) =>
  subscribeCommands(() => {
    version++;
    fn();
  });

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  // Se vuelve a armar si alguien registra o saca comandos con la paleta abierta, o cambia quién está.
  const regVersion = useSyncExternalStore(subscribe, () => version, () => 0);
  const players = useOfficeStore((s) => s.players);
  const offices = useOfficeStore((s) => s.offices);

  const all = useMemo(() => listCommands(), [regVersion, players, offices]);
  const results = useMemo(() => {
    if (query.trim()) return rankCommands(query, all, MAX_RESULTS);
    const count = new Map<string, number>();
    return all.filter((c) => {
      const n = (count.get(c.group) ?? 0) + 1;
      count.set(c.group, n);
      return n <= PER_GROUP_IDLE;
    });
  }, [all, query]);
  const selected = Math.min(active, Math.max(0, results.length - 1));

  // Abierta, el teclado es de la paleta (no mueve al personaje ni dispara atajos del juego).
  useEffect(() => {
    const { setTyping } = useOfficeStore.getState();
    setTyping(true);
    sfx.uiOpen();
    requestAnimationFrame(() => input.current?.focus());
    return () => {
      setTyping(false);
    };
  }, []);

  useEffect(() => {
    list.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const run = (c: Command | undefined) => {
    if (!c || c.disabled) {
      if (c?.disabled) useOfficeStore.getState().notify(c.disabled, "warning");
      return;
    }
    sfx.click();
    if (!c.keepOpen) onClose();
    // Después de cerrar: el comando puede abrir otra ventana o darle el foco al juego.
    requestAnimationFrame(() => c.run());
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((selected + 1) % Math.max(1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((selected - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(Math.max(0, results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(results[selected]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      // Tab no sale de la paleta (ni cambia la fila de la barra de abajo).
      e.preventDefault();
    }
  };

  const activeId = results[selected] ? `${listId}-${selected}` : undefined;
  // Por grupos, en el orden en que vienen (cada grupo es un role="group" del listbox).
  const groups: { name: string; items: { c: Command; i: number }[] }[] = [];
  results.forEach((c, i) => {
    const last = groups[groups.length - 1];
    if (last && last.name === c.group) last.items.push({ c, i });
    else groups.push({ name: String(c.group), items: [{ c, i }] });
  });

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-[rgb(42_32_51/0.55)] px-3 pt-[12vh]" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal aria-label="Buscar en la cabaña" className="cozy-panel palette-in flex max-h-[70vh] w-full max-w-lg flex-col p-1.5">
        <div className="flex items-center gap-2 bg-cozy-wood px-3 py-2 text-cozy-paper-light">
          <PixelIcon name="search" size={16} />
          <input
            ref={input}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Buscar personas, lugares y acciones"
            placeholder="Busca a alguien, un lugar o algo…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            className="min-w-0 flex-1 bg-transparent text-[16px] text-cozy-paper-light placeholder:text-cozy-paper-light/60 focus:outline-none"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="cozy-kbd shrink-0 text-[11px] text-cozy-ink max-sm:hidden">Esc</kbd>
        </div>
        <div ref={list} id={listId} role="listbox" aria-label="Resultados" className="cozy-scroll min-h-0 flex-1 overflow-y-auto py-1">
          {results.length === 0 && (
            <p className="px-3 py-4 text-center text-[14px] text-cozy-ink-soft">No encontramos nada con «{query}». Prueba con otra palabra.</p>
          )}
          {groups.map((g) => (
            <div key={`${g.name}-${g.items[0]!.i}`} role="group" aria-label={g.name}>
              <p aria-hidden className="px-3 pt-2 pb-1 text-[12px] text-cozy-ink-soft">
                {g.name}
              </p>
              {g.items.map(({ c, i }) => {
                const on = i === selected;
                return (
                  <div
                    key={c.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={on}
                    aria-disabled={c.disabled ? true : undefined}
                    data-index={i}
                    onPointerMove={() => active !== i && setActive(i)}
                    onClick={() => run(c)}
                    className={`mx-1 flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5 text-[14px] ${on ? "bg-cozy-paper-dark outline-2 -outline-offset-2 outline-cozy-red" : ""} ${c.disabled ? "opacity-55" : ""}`}
                  >
                    <PixelIcon name={c.icon ?? "chevron"} size={14} color="var(--color-cozy-wood)" className={c.icon ? "" : "-rotate-90"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.title}</span>
                      {(c.disabled || c.subtitle) && <span className="block truncate text-[12px] text-cozy-ink-soft">{c.disabled ?? c.subtitle}</span>}
                    </span>
                    {c.hint && <kbd className="cozy-kbd shrink-0 text-[11px] max-sm:hidden">{c.hint}</kbd>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t-2 border-cozy-paper-dark px-3 pt-1.5 pb-0.5 text-[11px] text-cozy-ink-soft max-sm:hidden">
          <span>
            <kbd className="cozy-kbd">↑</kbd> <kbd className="cozy-kbd">↓</kbd> elegir
          </span>
          <span>
            <kbd className="cozy-kbd">Enter</kbd> usar
          </span>
          <span>
            <kbd className="cozy-kbd">{paletteKey()}</kbd> abrir y cerrar
          </span>
        </p>
      </section>
    </div>
  );
}
