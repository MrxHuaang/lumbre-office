"use client";

// La barra de arriba de la portada: fija y compacta, con el logo, las anclas a las secciones, "Entrar"
// y el botón de crear mundo (que por ahora abre el aviso de "Próximamente"). En celular las anclas van
// en un menú desplegable.
import Link from "next/link";
import { useEffect, useState } from "react";
import { PixelIcon } from "../Cozy";
import { LumbreLogo } from "./Logo";
import { CrearMundo } from "./Proximamente";
import { SECCIONES } from "./secciones";

export function Nav() {
  const [abierto, setAbierto] = useState(false);

  // Con el menú abierto, Esc lo cierra; al pasar a pantalla ancha se cierra solo.
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    const ancho = window.matchMedia("(min-width: 1024px)");
    const cambio = () => ancho.matches && setAbierto(false);
    window.addEventListener("keydown", tecla);
    ancho.addEventListener("change", cambio);
    return () => {
      window.removeEventListener("keydown", tecla);
      ancho.removeEventListener("change", cambio);
    };
  }, [abierto]);

  return (
    <header className="lumbre-nav sticky top-0 z-30">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" aria-label="Lumbre, inicio" className="lumbre-foco shrink-0">
          <LumbreLogo size={26} />
        </Link>
        <nav aria-label="Secciones" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {SECCIONES.map((s) => (
              <li key={s.href}>
                <a href={s.href} className="lumbre-foco lumbre-enlace px-3 py-2 text-[16px]">
                  {s.texto}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="cozy-btn px-3.5 py-2 text-[15px] max-sm:hidden">
            Entrar
          </Link>
          <CrearMundo className="cozy-btn cozy-btn-primary gap-2 px-3.5 py-2 text-[15px] whitespace-nowrap max-[400px]:px-2.5">
            Crea tu mundo
            <span className="bg-[#2e5a40] px-1.5 py-0.5 text-[11px] leading-none text-cozy-paper-light max-[400px]:hidden">pronto</span>
          </CrearMundo>
          <button
            type="button"
            className="cozy-btn h-10 w-10 p-0 lg:hidden"
            aria-expanded={abierto}
            aria-controls="lumbre-menu"
            aria-label={abierto ? "Cerrar el menú" : "Abrir el menú"}
            onClick={() => setAbierto((a) => !a)}
          >
            <PixelIcon name={abierto ? "close" : "menu"} size={16} />
          </button>
        </div>
      </div>
      <nav id="lumbre-menu" aria-label="Secciones" hidden={!abierto} className="lumbre-nav-panel lg:hidden">
        <ul className="mx-auto flex max-w-7xl flex-col px-4 pt-2 pb-4 sm:px-8">
          {SECCIONES.map((s) => (
            <li key={s.href}>
              <a href={s.href} onClick={() => setAbierto(false)} className="lumbre-foco flex items-center justify-between border-b-2 border-dashed border-cozy-wood/40 py-3.5 text-[18px] text-cozy-paper-light">
                {s.texto}
                <PixelIcon name="chevron" size={14} className="-rotate-90 text-cozy-wood-light" />
              </a>
            </li>
          ))}
          <li className="pt-4 sm:hidden">
            <Link href="/login" className="cozy-btn w-full px-4 py-3 text-[17px]">
              Entrar
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
