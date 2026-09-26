"use client";

import { useState } from "react";
import { COZY } from "@/lib/cozy";
import { PixelIcon } from "../Cozy";
import {
  DEFAULT_FAVORITES,
  FAVORITES_MAX,
  FAVORITE_TITLE_MAX,
  loadFavorites,
  resolveAddress,
  saveFavorites,
  suggestTitle,
  type BrowseTarget,
  type Favorite,
} from "./browser";
import { BrowserIcon } from "./icons";

type Page = Exclude<BrowseTarget, { kind: "invalid" }>;

/** Color de la ficha de cada sitio conocido (una letra sobre color: nada de logos). */
const SITE_BADGE: Record<string, { bg: string; fg: string; letter: string }> = {
  YouTube: { bg: COZY.red, fg: COZY.paperLight, letter: "Y" },
  Spotify: { bg: COZY.green, fg: COZY.paperLight, letter: "S" },
  Figma: { bg: "#8a4bb0", fg: COZY.paperLight, letter: "F" },
  "Google Docs": { bg: COZY.sky, fg: COZY.paperLight, letter: "D" },
  Excalidraw: { bg: "#6b5bd6", fg: COZY.paperLight, letter: "E" },
  Wikipedia: { bg: COZY.paperLight, fg: COZY.ink, letter: "W" },
};

/** La misma dirección escrita de dos formas (con o sin https, con o sin "/") cuenta como una. */
const normalized = (url: string) => {
  const t = resolveAddress(url);
  return t.kind === "invalid" ? url : t.url;
};

const hostLabel = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** En la barra se lee "Café" y no "Caf%C3%A9" (al volver a enviarla, URL la codifica de nuevo). */
const readableUrl = (url: string) => {
  try {
    const decoded = decodeURI(url);
    // Con espacios ya no se podría volver a enviar tal cual: mejor dejarla codificada.
    return /\s/.test(decoded) ? url : decoded;
  } catch {
    return url;
  }
};

/** Abrir fuera del PC, sin darle a la otra página acceso a esta pestaña. */
const openOutside = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

export function BrowserApp({ active }: { active: boolean }) {
  const [address, setAddress] = useState("");
  /** Lo que se está viendo; null = la página de inicio con los favoritos. */
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [own, setOwn] = useState<Favorite[]>(loadFavorites);
  /** Nombre del favorito que se está guardando (null = no se está guardando). */
  const [naming, setNaming] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const all = [...DEFAULT_FAVORITES, ...own];
  const current = page ? all.find((f) => normalized(f.url) === page.url) : undefined;
  const isDefault = current ? DEFAULT_FAVORITES.some((f) => f.id === current.id) : false;

  const go = (raw: string) => {
    const t = resolveAddress(raw);
    if (t.kind === "invalid") {
      setError(t.reason);
      return;
    }
    setError(null);
    setNaming(null);
    setAddress(readableUrl(t.url));
    setPage(t);
    setLoading(t.kind === "embed");
  };

  const goHome = () => {
    setPage(null);
    setAddress("");
    setError(null);
    setNaming(null);
  };

  const updateOwn = (next: Favorite[]) => {
    setOwn(next);
    saveFavorites(next);
  };

  const saveCurrent = () => {
    if (!page || naming === null) return;
    const title = naming.trim().slice(0, FAVORITE_TITLE_MAX) || suggestTitle(page);
    updateOwn([...own, { id: `f-${Date.now().toString(36)}`, title, url: page.url }]);
    setNaming(null);
  };

  const onStar = () => {
    if (!page) return;
    if (current && !isDefault) updateOwn(own.filter((f) => f.id !== current.id));
    else if (!current) setNaming(naming === null ? suggestTitle(page) : null);
  };

  const full = own.length >= FAVORITES_MAX;
  const starLabel = !page
    ? "Abre un sitio para guardarlo en favoritos"
    : isDefault
      ? "Este favorito viene con el PC"
      : current
        ? "Quitar de favoritos"
        : full
          ? `Ya tienes ${FAVORITES_MAX} favoritos: quita alguno para agregar otro`
          : "Agregar a favoritos";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-cozy-paper-light">
      {/* Barra de direcciones. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(address);
        }}
        className="flex shrink-0 items-center gap-1.5 border-b-2 border-cozy-frame bg-cozy-paper px-2 py-1.5"
      >
        <button type="button" onClick={goHome} title="Inicio" aria-label="Inicio" className="cozy-btn h-8 w-8 shrink-0 p-0">
          <PixelIcon name="home" size={14} />
        </button>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Pega un enlace de YouTube, Spotify, Figma…"
          aria-label="Dirección"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          className="cozy-input h-8 min-w-0 flex-1 px-2 text-[13px]"
        />
        <button type="submit" className="cozy-btn cozy-btn-primary h-8 shrink-0 px-3 text-[13px]">
          Ir
        </button>
        <button
          type="button"
          onClick={onStar}
          disabled={!page || isDefault || (!current && full)}
          aria-pressed={!!current}
          aria-label={starLabel}
          title={starLabel}
          className="cozy-btn h-8 w-8 shrink-0 p-0"
        >
          <PixelIcon name="star" size={14} color={current ? COZY.gold : COZY.inkSoft} />
        </button>
        <button
          type="button"
          onClick={() => page && openOutside(page.url)}
          disabled={!page}
          aria-label="Abrir en otra pestaña"
          title="Abrir en otra pestaña"
          className="cozy-btn h-8 w-8 shrink-0 p-0"
        >
          <ExternalGlyph />
        </button>
      </form>

      {naming !== null && page && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveCurrent();
          }}
          className="flex shrink-0 items-center gap-1.5 border-b-2 border-dashed border-cozy-frame/40 bg-cozy-paper-dark px-2 py-1.5 text-[12px]"
        >
          <PixelIcon name="star" size={12} color={COZY.gold} />
          <label htmlFor="fav-name" className="font-semibold">
            Nombre
          </label>
          <input
            id="fav-name"
            value={naming}
            onChange={(e) => setNaming(e.target.value)}
            maxLength={FAVORITE_TITLE_MAX}
            autoFocus
            className="cozy-input h-7 min-w-0 flex-1 px-2 text-[12px]"
          />
          <button type="submit" className="cozy-btn cozy-btn-primary px-2.5 py-1 text-[12px]">
            Guardar
          </button>
          <button type="button" onClick={() => setNaming(null)} className="cozy-btn px-2.5 py-1 text-[12px]">
            Cancelar
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="shrink-0 border-b-2 border-cozy-frame bg-cozy-paper-dark px-3 py-1 text-[12px] font-semibold text-cozy-red-deep">
          {error}
        </p>
      )}

      {/* Barra de favoritos mientras se navega (en el inicio ya se ven grandes). */}
      {page && (
        <nav aria-label="Favoritos" className="cozy-scroll flex shrink-0 gap-1.5 overflow-x-auto border-b-2 border-cozy-frame bg-cozy-paper-light px-2 py-1">
          {all.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => go(f.url)}
              aria-current={current?.id === f.id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 border-[1.5px] border-cozy-frame px-1.5 py-0.5 text-[12px] font-semibold ${
                current?.id === f.id ? "bg-cozy-paper-dark" : "bg-cozy-paper hover:bg-cozy-paper-dark"
              }`}
            >
              <SiteBadge url={f.url} size={14} />
              <span className="max-w-36 truncate">{f.title}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        {!page && <Home own={own} onOpen={go} onRemove={(id) => updateOwn(own.filter((f) => f.id !== id))} />}

        {page?.kind === "embed" && (
          <>
            <iframe
              key={page.src}
              src={page.src}
              title={`${page.site} dentro del PC`}
              className="absolute inset-0 h-full w-full border-0 bg-cozy-paper-light"
              // Solo sitios de la lista blanca (siempre de otro origen): pueden correr scripts y abrir ventanas propias.
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
              allowFullScreen
              // YouTube pide saber desde qué sitio se incrusta (sin "referer" el video no carga).
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setLoading(false)}
            />
            {loading && (
              <p className="pointer-events-none absolute inset-0 grid place-items-center text-[13px] text-cozy-ink-soft">Cargando {page.site}…</p>
            )}
            {/* Con la ventana de atrás, el iframe se tragaría el clic: esta capa lo usa para traerla al frente. */}
            {!active && <div aria-hidden className="absolute inset-0" />}
          </>
        )}

        {page?.kind === "external" && (
          <div className="cozy-scroll grid min-h-0 flex-1 place-items-center overflow-y-auto p-6">
            <div className="flex max-w-sm flex-col items-center gap-3 text-center">
              <BrowserIcon size={52} />
              <p className="text-[16px] font-semibold">Este sitio no se deja abrir aquí</p>
              <p className="text-[13px] leading-relaxed text-cozy-ink-soft">
                {page.hint ??
                  `${hostLabel(page.url)} no permite que otras páginas lo muestren dentro de una ventana, así que se abre en otra pestaña del navegador.`}
              </p>
              <button type="button" onClick={() => openOutside(page.url)} className="cozy-btn cozy-btn-primary px-4 py-1.5 text-[14px]">
                <ExternalGlyph />
                Abrir en otra pestaña
              </button>
              <p className="max-w-full truncate text-[11px] text-cozy-ink-soft" title={page.url}>
                {page.url}
              </p>
            </div>
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t-2 border-cozy-frame bg-cozy-paper px-3 py-1 text-[11px] text-cozy-ink-soft">
        <span className="truncate">
          {page?.kind === "embed" ? `${page.site} · abierto dentro del PC` : page ? "Se abre en otra pestaña" : "Inicio"}
        </span>
        <span className="shrink-0">
          {own.length} {own.length === 1 ? "favorito tuyo" : "favoritos tuyos"}
        </span>
      </footer>
    </div>
  );
}

/** Página de inicio: los favoritos grandes y qué sitios se abren dentro del PC. */
function Home({ own, onOpen, onRemove }: { own: Favorite[]; onOpen: (url: string) => void; onRemove: (id: string) => void }) {
  return (
    <div className="cozy-scroll min-h-0 flex-1 overflow-y-auto p-4">
      <HomeLabel>Para empezar</HomeLabel>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
        {DEFAULT_FAVORITES.map((f) => (
          <FavoriteCard key={f.id} fav={f} onOpen={onOpen} />
        ))}
      </ul>

      <HomeLabel>Tus favoritos</HomeLabel>
      {own.length === 0 ? (
        <p className="text-[12.5px] text-cozy-ink-soft">
          Abre un sitio y toca la <PixelIcon name="star" size={11} color={COZY.gold} className="inline align-[-1px]" /> para guardarlo aquí. Se
          guardan en este navegador.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
          {own.map((f) => (
            <FavoriteCard key={f.id} fav={f} onOpen={onOpen} onRemove={() => onRemove(f.id)} />
          ))}
        </ul>
      )}

      <p className="mt-5 border-t border-dashed border-cozy-frame/30 pt-3 text-[12px] leading-relaxed text-cozy-ink-soft">
        Dentro del PC se abren YouTube, Spotify, Figma, Excalidraw, Wikipedia y los Google Docs publicados en la web. Casi todos los demás
        sitios no se dejan mostrar dentro de otra página: esos se abren en otra pestaña.
      </p>
    </div>
  );
}

function HomeLabel({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 mb-1.5 text-[10px] font-semibold tracking-[0.12em] text-cozy-ink-soft uppercase first:mt-0">{children}</p>;
}

function FavoriteCard({ fav, onOpen, onRemove }: { fav: Favorite; onOpen: (url: string) => void; onRemove?: () => void }) {
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => onOpen(fav.url)}
        className="flex w-full items-center gap-2.5 border-2 border-cozy-frame bg-cozy-paper p-2 pr-7 text-left shadow-[2px_2px_0_rgb(20_10_24/0.3)] hover:bg-cozy-paper-dark"
      >
        <SiteBadge url={fav.url} size={26} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold">{fav.title}</span>
          <span className="block truncate text-[11px] text-cozy-ink-soft">{hostLabel(fav.url)}</span>
        </span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${fav.title} de favoritos`}
          title="Quitar de favoritos"
          className="absolute top-1 right-1 grid h-5 w-5 place-items-center text-cozy-ink-soft opacity-0 group-hover:opacity-100 hover:text-cozy-red-deep focus-visible:opacity-100"
        >
          <PixelIcon name="close" size={10} />
        </button>
      )}
    </li>
  );
}

/** Ficha del sitio: una letra sobre su color (los desconocidos, la inicial del dominio). */
function SiteBadge({ url, size }: { url: string; size: number }) {
  const t = resolveAddress(url);
  const site = t.kind === "invalid" ? null : t.site;
  const badge = (site && SITE_BADGE[site]) || { bg: COZY.paperDark, fg: COZY.ink, letter: hostLabel(url).charAt(0).toUpperCase() || "?" };
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center border-[1.5px] border-cozy-frame leading-none font-semibold"
      style={{ width: size, height: size, background: badge.bg, color: badge.fg, fontSize: Math.round(size * 0.55) }}
    >
      {badge.letter}
    </span>
  );
}

/** Flecha de "abrir afuera" en pixel. */
function ExternalGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" shapeRendering="crispEdges" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M7 3H3v10h10V9" />
      <path d="M9 2h5v5M14 2L7 9" />
    </svg>
  );
}
