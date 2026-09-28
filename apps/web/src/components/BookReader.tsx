"use client";

// El libro abierto en pantalla (al leer en una estantería): tapa dura que gira al abrirse y hojas que
// se pasan en 3D, con CSS. Las páginas salen de `bookOf(seed)` (packages/shared/src/libros.ts): la
// portadilla, las del libro y "Fin". Flechas (o A/D, o clic en la página) para pasar, Esc para cerrar.
import { bookOf, type Book } from "@hyvento/shared";
import { useCallback, useEffect, useMemo, useRef, useState, type AnimationEvent, type ReactNode } from "react";
import { playPage } from "@/game/casaSonidos";
import { useBookStore } from "@/game/libros";
import { useOfficeStore } from "@/game/store";

/** Tapas de cuero viejo (tonos apagados de los del libro chiquito de la escena, `openBook`). */
const COVERS = ["#5e2320", "#27334d", "#2f4a30", "#43263f", "#6b4a22"];
// Lento a propósito: se disfruta ver la tapa y las hojas.
const FLIP_MS = 1100;
const OPEN_MS = 1400;

type Page = { kind: "title" } | { kind: "text"; text: string; n: number } | { kind: "end" } | { kind: "blank" };

/** Las páginas en orden: la portadilla a la derecha del primer par, el texto y el cierre (par completo). */
function pagesOf(book: Book): Page[] {
  const pages: Page[] = [{ kind: "title" }, ...book.pages.map((text, i) => ({ kind: "text" as const, text, n: i + 1 })), { kind: "end" }];
  // El par k muestra a la izquierda pages[2k-1] (en el 0, el forro de la tapa) y a la derecha pages[2k].
  if (pages.length % 2 === 0) pages.push({ kind: "blank" });
  return pages;
}

export function BookReader() {
  const seed = useBookStore((s) => s.seed);
  if (seed === null) return null;
  return <Reader key={seed} seed={seed} />;
}

function Reader({ seed }: { seed: number }) {
  const book = useMemo(() => bookOf(seed), [seed]);
  const pages = useMemo(() => pagesOf(book), [book]);
  const cover = COVERS[Math.abs(Math.floor(seed)) % COVERS.length]!;
  const spreads = (pages.length + 1) / 2;
  const [spread, setSpread] = useState(0);
  const [flip, setFlip] = useState<null | 1 | -1>(null);
  // closed → opening → open; closing al salir (la tapa vuelve a cerrarse antes de irse).
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const timer = useRef<number | undefined>(undefined);

  const close = useCallback(() => {
    if (phase === "closing") return;
    setFlip(null);
    setSpread(0);
    setPhase("closing");
    playPage(0.6);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => useBookStore.getState().close(), OPEN_MS);
  }, [phase]);

  const turn = useCallback(
    (dir: 1 | -1) => {
      if (flip || phase !== "open") return;
      const next = spread + dir;
      if (next < 0 || next >= spreads) return;
      playPage(0.7);
      setFlip(dir);
    },
    [flip, phase, spread, spreads],
  );
  // La hoja llegó al otro lado: el par nuevo queda debajo, igual a lo que se ve (sin salto).
  const landed = (e: AnimationEvent) => {
    if (e.target !== e.currentTarget || !flip) return;
    setSpread((k) => k + flip);
    setFlip(null);
  };

  // Se abre al montar (un momento después, para que la transición corra).
  useEffect(() => {
    playPage(0.6);
    const r = window.setTimeout(() => setPhase("open"), 40);
    return () => {
      window.clearTimeout(r);
      window.clearTimeout(timer.current);
    };
  }, []);

  // Mientras está abierto, el teclado es del libro (no mueve al personaje).
  useEffect(() => {
    const { setTyping } = useOfficeStore.getState();
    setTyping(true);
    return () => setTyping(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "escape") close();
      else if (k === "arrowright" || k === "d" || k === " ") turn(1);
      else if (k === "arrowleft" || k === "a") turn(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, turn]);

  const left = (k: number): Page | "lining" => (k === 0 ? "lining" : pages[2 * k - 1]!);
  const right = (k: number): Page => pages[2 * k]!;
  // Debajo de la hoja que gira ya se ve lo que viene.
  const baseLeft = flip === -1 ? left(spread - 1) : left(spread);
  const baseRight = flip === 1 ? right(spread + 1) : right(spread);
  const open = phase === "open";

  return (
    <div className="libro-fondo font-pixel fixed inset-0 z-50 grid place-items-center" data-phase={phase} onPointerDown={close} role="dialog" aria-modal aria-label={`«${book.title}»`}>
      <style>{CSS}</style>
      <div className="flex flex-col items-center gap-4" onPointerDown={(e) => e.stopPropagation()}>
        <div className="libro-escena">
          <div className="libro" data-open={open} style={{ ["--tapa" as string]: cover }}>
            {/* La contratapa, debajo de las hojas (a la izquierda hace de tabla la tapa abierta). */}
            <div className="libro-tabla libro-tabla-der" />

            {baseLeft !== "lining" && <PageFace side="left" page={baseLeft} book={book} total={pages.length} onClick={() => turn(-1)} />}
            <PageFace side="right" page={baseRight} book={book} total={pages.length} onClick={() => turn(1)} />

            {/* La hoja que gira: adelante lo que se va, atrás lo que llega. */}
            {flip === 1 && (
              <div className="libro-hoja libro-hoja-adelante" onAnimationEnd={landed}>
                <PageFace side="right" page={right(spread)} book={book} total={pages.length} face="front" />
                <PageFace side="left" page={left(spread + 1)} book={book} total={pages.length} face="back" />
              </div>
            )}
            {flip === -1 && (
              <div className="libro-hoja libro-hoja-atras" onAnimationEnd={landed}>
                <PageFace side="left" page={left(spread)} book={book} total={pages.length} face="front" />
                <PageFace side="right" page={right(spread - 1)} book={book} total={pages.length} face="back" />
              </div>
            )}

            {/* La tapa: cerrada tapa la derecha; abierta queda de forro a la izquierda. */}
            <div className="libro-tapa">
              <div className="libro-cara libro-tapa-frente">
                <Cover book={book} />
              </div>
              <div className="libro-cara libro-tapa-dorso">
                <Lining />
              </div>
            </div>
          </div>
        </div>

        <div className="libro-controles cozy-panel flex items-center gap-2 px-2 py-1.5 text-[13px]" data-show={open}>
          <button type="button" onClick={() => turn(-1)} disabled={spread === 0 || Boolean(flip)} className="cozy-btn px-2.5 py-1" aria-label="Página anterior">
            ‹
          </button>
          <span className="min-w-[88px] text-center tabular-nums text-cozy-ink-soft">
            {spread === 0 ? "Portada" : `Pág. ${2 * spread - 1}-${Math.min(2 * spread, pages.length - 1)}`}
          </span>
          <button type="button" onClick={() => turn(1)} disabled={spread >= spreads - 1 || Boolean(flip)} className="cozy-btn px-2.5 py-1" aria-label="Página siguiente">
            ›
          </button>
          <span className="mx-1 h-5 w-[2px] bg-cozy-paper-dark" />
          <button type="button" onClick={close} className="cozy-btn px-2.5 py-1">
            Cerrar <span className="cozy-kbd ml-1">Esc</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PageFace({
  side,
  page,
  book,
  total,
  face,
  onClick,
}: {
  side: "left" | "right";
  page: Page | "lining";
  book: Book;
  total: number;
  face?: "front" | "back";
  onClick?: () => void;
}) {
  const cls = `libro-pagina libro-pagina-${side}${face ? ` libro-cara libro-cara-${face}` : ""}`;
  if (page === "lining") return <div className={cls}><Lining /></div>;
  let body: ReactNode = null;
  if (page.kind === "title") body = <TitlePage book={book} />;
  else if (page.kind === "end") body = <EndPage />;
  else if (page.kind === "text") body = <TextPage text={page.text} n={page.n} side={side} total={total} prose={book.kind === "carta"} />;
  return (
    <div className={cls} onClick={onClick}>
      <div className="libro-papel">{body}</div>
    </div>
  );
}

/** Tapa de cuero gastado: nervios en el lomo, esquineras de bronce y el título en una cartela dorada. */
function Cover({ book }: { book: Book }) {
  return (
    <div className="libro-portada">
      <span className="libro-nervios" aria-hidden />
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <span key={c} className={`libro-esquinera libro-esquinera-${c}`} aria-hidden />
      ))}
      <div className="libro-filete">
        <Ornament />
        <div className="libro-cartela">
          <p className="libro-portada-titulo">{book.title}</p>
        </div>
        <Ornament />
        <p className="libro-portada-autor">{book.author}</p>
      </div>
    </div>
  );
}

/** El forro de adentro de la tapa: papel viejo con un grabado fino y el ex libris de la casa. */
function Lining() {
  return (
    <div className="libro-forro">
      <div className="libro-exlibris">
        <span className="libro-exlibris-ex">Ex libris</span>
        <Ornament ink />
        <span>Biblioteca de la cabaña</span>
      </div>
    </div>
  );
}

function TitlePage({ book }: { book: Book }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[0.8em] text-center">
      <span className="libro-tipo">{book.kind}</span>
      <p className="libro-titulo libro-titulo-grande">{book.title}</p>
      <Ornament ink />
      <p className="libro-autor">{book.author}</p>
      <p className="libro-blurb">{book.blurb}</p>
    </div>
  );
}

function EndPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[0.8em] text-center">
      <Ornament ink />
      <p className="libro-titulo">Fin</p>
      <p className="libro-blurb">Devuélvelo a su estante cuando quieras. Hay más en la biblioteca.</p>
    </div>
  );
}

/** Página de texto: si el primer bloque es corto y de una línea, es su encabezado (en una carta, no). */
function TextPage({ text, n, side, total, prose }: { text: string; n: number; side: "left" | "right"; total: number; prose: boolean }) {
  const blocks = text.split("\n\n");
  const head = !prose && blocks.length > 1 && blocks[0]!.length <= 36 && !blocks[0]!.includes("\n") ? blocks.shift()! : null;
  const verse = blocks.some((b) => b.includes("\n"));
  return (
    <div className="flex h-full flex-col">
      {head && <p className="libro-encabezado">{head}</p>}
      {/* Capitular iluminada al empezar el libro o cada capítulo. */}
      <div className={`libro-texto flex-1 ${verse ? "libro-verso" : ""} ${n === 1 || head ? "libro-capitular" : ""}`}>
        {blocks.map((b, i) => (
          <p key={i}>{b}</p>
        ))}
      </div>
      <p className={`libro-numero ${side === "left" ? "text-left" : "text-right"}`} aria-label={`página ${n} de ${total - 2}`}>
        · {n} ·
      </p>
    </div>
  );
}

/** Adorno de tres rombos de píxeles (sin depender de glifos de la fuente). */
function Ornament({ ink = false }: { ink?: boolean }) {
  return (
    <span className="libro-adorno" data-ink={ink} aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

const CSS = `
.libro-fondo { background: rgba(42, 32, 51, 0); transition: background 300ms; }
.libro-fondo[data-phase="open"] { background: rgba(42, 32, 51, 0.62); }
.libro-escena {
  --pw: min(300px, 44vw, 46vh);
  --ph: calc(var(--pw) * 1.4);
  perspective: calc(var(--pw) * 7);
  font-size: calc(var(--pw) * 0.049);
}
.libro {
  position: relative; width: calc(var(--pw) * 2); height: var(--ph);
  transform-style: preserve-3d;
  transform: translateX(calc(var(--pw) * -0.5)) rotateX(8deg) scale(0.9);
  transition: transform ${OPEN_MS}ms cubic-bezier(.3,.7,.3,1);
}
.libro[data-open="true"] { transform: translateX(0) rotateX(6deg) scale(1); }
.libro-tabla {
  position: absolute; top: -6px; bottom: -6px; width: calc(var(--pw) + 6px); background: var(--tapa);
  box-shadow: inset 0 0 0 2px rgba(0,0,0,.35), inset 0 0 18px rgba(0,0,0,.45), 6px 6px 0 rgba(20,12,8,.55);
  transform: translateZ(-1px);
}
.libro-tabla-der { left: var(--pw); }
/* Pergamino envejecido: manchas de humedad, bordes tostados y la sombra del lomo. */
.libro-pagina {
  position: absolute; top: 0; width: var(--pw); height: var(--ph); overflow: hidden;
  background-color: #eedcb0; color: #3b2414; cursor: pointer;
  transform: translateZ(1px);
  box-shadow: inset 0 0 calc(var(--pw) * .12) rgba(122,72,24,.38);
}
.libro-pagina-left { left: 0;
  background-image: linear-gradient(to left, rgba(60,30,10,.38), rgba(60,30,10,0) 16%),
    radial-gradient(ellipse at 22% 82%, rgba(150,95,35,.16), transparent 32%),
    radial-gradient(circle at 70% 18%, rgba(150,95,35,.10), transparent 22%),
    radial-gradient(ellipse at 50% 50%, #f4e6c0, #e6cf9c 120%); }
.libro-pagina-right { left: var(--pw);
  background-image: linear-gradient(to right, rgba(60,30,10,.38), rgba(60,30,10,0) 16%),
    radial-gradient(ellipse at 78% 20%, rgba(150,95,35,.15), transparent 30%),
    radial-gradient(circle at 30% 88%, rgba(150,95,35,.10), transparent 20%),
    radial-gradient(ellipse at 50% 50%, #f4e6c0, #e6cf9c 120%); }
/* Canto de las hojas de abajo (se ve grosor, amarillento). */
.libro-pagina-right::after, .libro-pagina-left::after { content: ""; position: absolute; top: 0; bottom: 0; width: 4px; background: repeating-linear-gradient(to bottom, #c9a86a 0 1px, #ead3a0 1px 3px); }
.libro-pagina-right::after { right: 0; }
.libro-pagina-left::after { left: 0; }
.libro-papel { position: absolute; inset: 9% 11% 6%; }
.libro-hoja { position: absolute; top: 0; width: var(--pw); height: var(--ph); transform-style: preserve-3d; z-index: 5; }
.libro-hoja .libro-pagina { left: 0; transform: translateZ(2px); }
.libro-hoja .libro-cara-back { transform: translateZ(2px) rotateY(180deg); }
.libro-hoja-adelante { left: var(--pw); transform-origin: left center; animation: libro-pasa-adelante ${FLIP_MS}ms cubic-bezier(.45,.05,.4,1) forwards; }
.libro-hoja-atras { left: 0; transform-origin: right center; animation: libro-pasa-atras ${FLIP_MS}ms cubic-bezier(.45,.05,.4,1) forwards; }
@keyframes libro-pasa-adelante { from { transform: translateZ(1px) rotateY(0deg); } to { transform: translateZ(1px) rotateY(-180deg); } }
@keyframes libro-pasa-atras { from { transform: translateZ(1px) rotateY(0deg); } to { transform: translateZ(1px) rotateY(180deg); } }
.libro-cara { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.libro-cara-back { transform: rotateY(180deg); }
/* Sombra que cruza la hoja mientras gira. */
.libro-hoja .libro-pagina::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to right, rgba(74,42,28,.35), rgba(74,42,28,0)); opacity: 0; animation: libro-sombra ${FLIP_MS}ms ease-in-out; z-index: 2; }
@keyframes libro-sombra { 50% { opacity: 1; } }
.libro-tapa {
  position: absolute; left: var(--pw); top: -6px; width: calc(var(--pw) + 6px); height: calc(var(--ph) + 12px);
  transform-origin: left center; transform-style: preserve-3d; transform: translateZ(3px) rotateY(0deg); z-index: 8;
  transition: transform ${OPEN_MS}ms cubic-bezier(.5,.1,.3,1);
}
.libro[data-open="true"] .libro-tapa { transform: translateZ(0) rotateY(-180deg); z-index: 1; }
.libro-tapa .libro-cara { position: absolute; inset: 0; }
.libro-tapa-dorso { transform: rotateY(180deg); padding: 6px 6px 6px 0; background: var(--tapa); }
/* Cuero: vetas y manchas encima del color, bordes rozados más oscuros. */
.libro-portada {
  position: absolute; inset: 0; padding: 9% 9% 9% 14%; overflow: hidden;
  background-color: var(--tapa);
  background-image:
    radial-gradient(ellipse at 30% 25%, rgba(255,230,190,.10), transparent 40%),
    radial-gradient(ellipse at 75% 70%, rgba(0,0,0,.28), transparent 45%),
    radial-gradient(circle at 60% 35%, rgba(0,0,0,.16), transparent 18%),
    radial-gradient(circle at 20% 80%, rgba(255,230,190,.07), transparent 22%),
    repeating-radial-gradient(circle at 40% 60%, rgba(0,0,0,.05) 0 2px, transparent 2px 5px);
  box-shadow: inset 0 0 0 2px rgba(0,0,0,.45), inset 0 0 26px rgba(0,0,0,.55), inset 10px 0 0 rgba(0,0,0,.25);
}
/* Nervios del lomo: las bandas en relieve de la encuadernación. */
.libro-nervios { position: absolute; left: 3%; top: 0; bottom: 0; width: 5%;
  background: repeating-linear-gradient(to bottom, transparent 0 18%, rgba(0,0,0,.45) 18% 19%, rgba(201,164,74,.55) 19% 21%, rgba(0,0,0,.45) 21% 22%, transparent 22% 25%); }
/* Esquineras de bronce, con su clavito. */
.libro-esquinera { position: absolute; width: 16%; aspect-ratio: 1; background: linear-gradient(135deg, #e3c26a, #a57a2c 55%, #6d4c17); }
.libro-esquinera::after { content: ""; position: absolute; width: 16%; height: 16%; background: #5a3d10; box-shadow: 1px 1px 0 rgba(255,230,160,.5); }
.libro-esquinera-tl { top: 0; left: 8%; clip-path: polygon(0 0, 100% 0, 0 100%); }
.libro-esquinera-tl::after { top: 18%; left: 18%; }
.libro-esquinera-tr { top: 0; right: 0; clip-path: polygon(0 0, 100% 0, 100% 100%); }
.libro-esquinera-tr::after { top: 18%; right: 18%; }
.libro-esquinera-bl { bottom: 0; left: 8%; clip-path: polygon(0 0, 0 100%, 100% 100%); }
.libro-esquinera-bl::after { bottom: 18%; left: 18%; }
.libro-esquinera-br { bottom: 0; right: 0; clip-path: polygon(100% 0, 0 100%, 100% 100%); }
.libro-esquinera-br::after { bottom: 18%; right: 18%; }
.libro-filete {
  position: relative; height: 100%; border: 2px solid rgba(201,164,74,.75); outline: 1px solid rgba(201,164,74,.45); outline-offset: -7px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1em; padding: 8%; text-align: center;
}
/* La cartela: cuero más oscuro con doble filete dorado, como las etiquetas del lomo. */
.libro-cartela { background: rgba(0,0,0,.28); border: 3px double #c9a44a; padding: .7em .8em; box-shadow: inset 0 0 10px rgba(0,0,0,.4); }
.libro-portada-titulo { color: #e3c26a; font-size: 1.55em; line-height: 1.15; text-shadow: 0 1px 0 rgba(255,240,190,.25), 0 -1px 0 rgba(0,0,0,.6); }
.libro-portada-autor { color: #c9a44a; font-size: 0.9em; margin-top: 1em; letter-spacing: .06em; text-shadow: 0 -1px 0 rgba(0,0,0,.6); }
/* Guardas: papel tostado con un rombo grabado muy tenue y el borde gastado. */
.libro-forro {
  width: 100%; height: 100%; display: grid; place-items: center;
  background-color: #e4cf9f;
  background-image:
    repeating-linear-gradient(45deg, rgba(110,70,30,.07) 0 1px, transparent 1px 10px),
    repeating-linear-gradient(-45deg, rgba(110,70,30,.07) 0 1px, transparent 1px 10px),
    radial-gradient(ellipse at 50% 50%, rgba(255,245,220,.35), transparent 70%);
  box-shadow: inset -16px 0 16px -8px rgba(40,20,5,.45), inset 0 0 calc(var(--pw) * .1) rgba(122,72,24,.35);
}
.libro-exlibris {
  display: flex; flex-direction: column; align-items: center; gap: .5em; padding: .9em 1.2em; text-align: center;
  font-size: .8em; color: #6b3a1c; background: rgba(244,230,192,.85); border: 3px double #8a5a2a;
}
.libro-exlibris-ex { font-size: 1.3em; color: #8e2a1c; letter-spacing: .08em; }
.libro-adorno { display: inline-flex; gap: 0.45em; align-items: center; color: #c9a44a; }
.libro-adorno::before, .libro-adorno::after { content: ""; width: 2.2em; height: 2px; background: currentColor; opacity: .7; }
.libro-adorno[data-ink="true"] { color: #8e2a1c; }
.libro-adorno i { display: block; width: 0.4em; height: 0.4em; background: currentColor; transform: rotate(45deg); }
.libro-adorno i:nth-child(2) { width: 0.6em; height: 0.6em; }
.libro-tipo { font-size: 0.75em; text-transform: uppercase; letter-spacing: .2em; color: #8e2a1c; }
.libro-titulo { font-size: 1.5em; line-height: 1.2; color: #3b2414; }
.libro-titulo-grande { border-top: 3px double #8a5a2a; border-bottom: 3px double #8a5a2a; padding: .5em .2em; }
.libro-autor { font-size: 1em; color: #6b3a1c; }
.libro-blurb { font-size: .85em; color: #6b4a2c; font-style: italic; max-width: 90%; margin-top: .6em; }
.libro-encabezado { font-size: 1.15em; color: #8e2a1c; margin-bottom: .7em; letter-spacing: .04em; }
.libro-texto { font-size: 1em; line-height: 1.45; text-shadow: 0 0 1px rgba(59,36,20,.25); }
.libro-texto p + p { margin-top: .8em; }
.libro-verso p { white-space: pre-line; }
/* Capitular: la primera letra grande, en rojo con recuadro dorado, como en los manuscritos. */
.libro-capitular p:first-child::first-letter {
  float: left; font-size: 2.6em; line-height: 1; margin: .05em .2em 0 0; padding: .08em .18em;
  color: #8e2a1c; background: rgba(201,164,74,.25); border: 2px solid #b08a3a; box-shadow: 2px 2px 0 rgba(90,50,20,.3);
}
.libro-numero { font-size: .8em; color: #8a5a2a; text-align: center !important; }
.libro-controles { opacity: 0; transform: translateY(6px); transition: opacity 250ms 300ms, transform 250ms 300ms; }
.libro-controles[data-show="true"] { opacity: 1; transform: none; }
`;
