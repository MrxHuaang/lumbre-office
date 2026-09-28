// La portada pública de Lumbre ("/" sin sesión). Es del servidor; las ilustraciones (que dibujan con
// <canvas>) son islas del cliente. Todo el arte sale del motor del juego o de la llamita pixel.
import Link from "next/link";
import type { ReactNode } from "react";
import { CozyTitle, PixelIcon, type PixelIconName } from "../Cozy";
import { EscenaViva } from "./EscenaViva";
import { Llama, LumbreLogo } from "./Logo";
import { ESLOGAN } from "./marca";
import { Diorama, Objetos, Personajes, Proximidad } from "./Vinetas";

const PISOS: { nombre: string; icono: PixelIconName; que: string }[] = [
  { nombre: "Jardín", icono: "sun", que: "Buzón con recompensa diaria, tablón de misiones, huerto, fogata y un lago con muelle para pescar." },
  { nombre: "Planta baja", icono: "cup", que: "Recibidor, cafetería con barra y la tienda de muebles con su vestidor." },
  { nombre: "Piso 2", icono: "lock", que: "Las oficinas de cada persona, la sala de reuniones y las cabinas para llamadas." },
  { nombre: "Piso 3", icono: "moon", que: "Biblioteca, chimenea y una terraza con vista al lago, para bajar el ritmo." },
  { nombre: "Sótano", icono: "spade", que: "Casino con ruleta y blackjack, el club, el cine y el arcade." },
  { nombre: "Observatorio", icono: "star", que: "En la lomita del jardín: una torre de piedra con cúpula que se abre de noche, un telescopio, estrellas fugaces y malvaviscos en la fogata." },
  { nombre: "Garaje", icono: "home", que: "Al lado de la casa: un taller con llantas y herramientas, y una oficina descuidada con su computador viejo." },
];

export function Landing() {
  return (
    <div className="lumbre-portada cozy-void min-h-full overflow-x-clip font-pixel text-cozy-paper-light">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-6">
        <Link href="/" aria-label="Lumbre, inicio" className="outline-offset-4">
          <LumbreLogo size={30} />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-5" aria-label="Secciones">
          <a href="#que-es" className="hidden px-1 text-[16px] text-cozy-paper-dark hover:text-cozy-paper-light md:inline">
            Qué es
          </a>
          <a href="#funciones" className="hidden px-1 text-[16px] text-cozy-paper-dark hover:text-cozy-paper-light md:inline">
            Funciones
          </a>
          <a href="#empezar" className="hidden px-1 text-[16px] text-cozy-paper-dark hover:text-cozy-paper-light md:inline">
            Cómo empezar
          </a>
          <Link href="/login" className="cozy-btn cozy-btn-primary px-4 py-2 text-[16px]">
            Entrar
          </Link>
        </nav>
      </header>

      <main>
        {/* ---------- Portada ---------- */}
        <section className="mx-auto grid max-w-7xl items-center gap-6 px-4 pt-4 pb-16 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] lg:gap-2 lg:pt-6 lg:pb-24">
          <div className="relative z-[2] flex flex-col items-start gap-6">
            <span className="cozy-chip flex items-center gap-2 px-3 py-1.5 text-[14px] leading-none">
              <PixelIcon name="cabin" size={14} color="var(--color-cozy-wood)" />
              Oficina virtual en pixel-art
            </span>
            <CozyTitle className="text-[clamp(36px,4.1vw,58px)] leading-[1.04] text-balance">{ESLOGAN}</CozyTitle>
            <p className="max-w-[38ch] text-[18px] leading-snug text-cozy-paper-dark sm:text-[19px]">
              Una cabaña para trabajar juntos a distancia. Caminas con tu personaje, te acercas a alguien y ya están hablando, como alrededor del fuego.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/login" className="cozy-btn cozy-btn-primary gap-2.5 px-6 py-3.5 text-[19px]">
                <Llama size={20} viva={false} />
                Entrar a Lumbre
              </Link>
              <a href="#que-es" className="cozy-btn px-5 py-3.5 text-[17px]">
                Ver cómo es
              </a>
            </div>
            <p className="text-[14px] text-cozy-paper-dark/80">Funciona en el navegador. No hay nada que instalar.</p>
          </div>
          <div className="relative -mx-4 sm:mx-0 lg:-mr-16">
            <EscenaViva className="w-full max-sm:ml-[-17%] max-sm:w-[140%]" />
          </div>
        </section>

        {/* ---------- Qué es ---------- */}
        <section id="que-es" className="lumbre-papel scroll-mt-4 text-cozy-ink">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:py-20">
            <div className="flex flex-col gap-5">
              <Eyebrow>Qué es Lumbre</Eyebrow>
              <h2 className="text-[clamp(30px,3.6vw,46px)] leading-[1.05] font-semibold text-balance">Una casa entera para tu equipo, en vez de otra ventana de videollamada</h2>
              <p className="max-w-[46ch] text-[18px] leading-relaxed text-cozy-ink-soft">
                En Lumbre el equipo se ve la cara sin agendar nada: cada quien está en su oficina, se cruza con los demás en la cafetería y, si quiere conversar, camina hasta donde está la otra persona.
              </p>
              <p className="max-w-[46ch] text-[18px] leading-relaxed text-cozy-ink-soft">
                Es la cabaña donde trabaja el equipo de Hyvento: tres pisos, un sótano, un jardín grande y el garaje de al lado, todo dibujado a mano en código, píxel por píxel.
              </p>
            </div>
            {/* El directorio de la casa, como el letrero del recibidor. */}
            <div className="cozy-panel self-start px-5 py-5 sm:px-7 sm:py-6">
              <p className="mb-3 flex items-center gap-2 text-[15px] font-semibold tracking-wide uppercase">
                <PixelIcon name="board" size={16} color="var(--color-cozy-wood)" />
                Directorio de la casa
              </p>
              <ul className="flex flex-col">
                {PISOS.map((p) => (
                  <li key={p.nombre} className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 border-t-2 border-dashed border-cozy-wood/35 py-3 first:border-t-0">
                    <PixelIcon name={p.icono} size={20} color="var(--color-cozy-wood)" className="mt-0.5" />
                    <div>
                      <p className="text-[17px] leading-tight font-semibold">{p.nombre}</p>
                      <p className="mt-0.5 text-[15px] leading-snug text-cozy-ink-soft">{p.que}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- Funciones ---------- */}
        <section id="funciones" className="mx-auto flex max-w-6xl scroll-mt-4 flex-col gap-20 px-4 py-20 sm:px-8 md:gap-28 md:py-28">
          <Funcion
            n="01"
            titulo="Audio y video por proximidad"
            texto="Acércate a alguien y empiezan a oírse y a verse. Aléjate y la conversación se apaga sola, sin colgar ni pedir permiso. En las salas de reunión se juntan todos los de adentro, y se puede compartir pantalla."
            chips={[
              ["mic", "Micrófono"],
              ["cam", "Cámara"],
              ["screen", "Pantalla compartida"],
              ["chat", "Chat cerca y general"],
            ]}
          >
            <Proximidad className="w-full shadow-[6px_6px_0_rgb(20_10_24/0.5)]" />
          </Funcion>

          <Funcion
            n="02"
            titulo="Una oficina propia para cada persona"
            texto="Cada quien tiene su oficina en el piso 2, con su nombre en la puerta. Ciérrala con llave cuando necesites concentrarte: quien quiera entrar toca la puerta. En el escritorio hay un PC con tus notas privadas, y la decoras con muebles de la tienda."
            chips={[
              ["lock", "Cerrar con llave"],
              ["home", "Decorar"],
              ["screen", "PC con notas"],
            ]}
            invertida
          >
            <Diorama sala="oficina" className="mx-auto w-[min(100%,460px)]" />
          </Funcion>

          <Funcion
            n="03"
            titulo="Cafetería, casino y juegos"
            texto="Pide un tinto en la barra, cobra la recompensa del buzón y gana puntos por estar presente y por las reuniones. En el sótano hay ruleta, blackjack, arcade y cine, y en el muelle del lago se pesca. Todo se juega con puntos, nunca con plata."
            chips={[
              ["cup", "Cafetería"],
              ["coin", "Puntos"],
              ["spade", "Casino"],
              ["fish", "Pesca"],
            ]}
          >
            <div className="flex flex-col gap-5">
              <Diorama sala="juegos" className="mx-auto w-[min(100%,420px)]" />
              <Objetos className="text-cozy-ink" />
            </div>
          </Funcion>

          <Funcion
            n="04"
            titulo="Personajes a tu medida"
            texto="Peinado, ojos, barba, ropa, sombreros y accesorios: arma a tu personaje como quieras. La ropa es toda gratis y te la cambias cuando quieras en el vestidor de la tienda."
            chips={[
              ["smile", "Cara y peinado"],
              ["bag", "Ropa gratis"],
              ["star", "Accesorios"],
            ]}
            invertida
          >
            <div className="lumbre-pasto border-4 border-cozy-frame px-4 pt-8 pb-5 shadow-[6px_6px_0_rgb(20_10_24/0.5)]">
              <Personajes />
            </div>
          </Funcion>
        </section>

        {/* ---------- Cómo empezar ---------- */}
        <section id="empezar" className="lumbre-papel scroll-mt-4 text-cozy-ink">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 md:py-20">
            <Eyebrow>Cómo empezar</Eyebrow>
            <h2 className="mt-4 max-w-[22ch] text-[clamp(30px,3.6vw,46px)] leading-[1.05] font-semibold">Tres pasos y ya estás adentro</h2>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              <Paso n={1} titulo="Te invitan">
                Alguien de tu equipo con permisos de administrador agrega tu correo. Lumbre es solo por invitación.
              </Paso>
              <Paso n={2} titulo="Entras con Google">
                Sin contraseñas nuevas: usas la cuenta de Google con la que te invitaron.
              </Paso>
              <Paso n={3} titulo="Armas tu personaje y caminas">
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
                  Clic para caminar, o <kbd className="cozy-kbd">W</kbd>
                  <kbd className="cozy-kbd">A</kbd>
                  <kbd className="cozy-kbd">S</kbd>
                  <kbd className="cozy-kbd">D</kbd>. Con <kbd className="cozy-kbd">E</kbd> te sientas o usas algo, y con <kbd className="cozy-kbd">Enter</kbd> escribes en el chat.
                </span>
              </Paso>
            </ol>
          </div>
        </section>

        {/* ---------- Llamado final ---------- */}
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center sm:py-28">
          <div className="lumbre-hoguera grid place-items-center">
            <Llama size={112} />
          </div>
          <CozyTitle as="h2" className="text-[clamp(38px,6vw,64px)] leading-none">
            Acércate a la lumbre
          </CozyTitle>
          <p className="max-w-[34ch] text-[18px] leading-snug text-cozy-paper-dark">Tu equipo te espera adentro. Entra con la cuenta de Google con la que te invitaron.</p>
          <Link href="/login" className="cozy-btn cozy-btn-primary gap-2.5 px-7 py-4 text-[20px]">
            <Llama size={22} viva={false} />
            Entrar a Lumbre
          </Link>
        </section>
      </main>

      <footer className="border-t-4 border-cozy-frame bg-[#221a2a]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-6 text-[14px] text-cozy-paper-dark sm:flex-row sm:items-center sm:px-8">
          <LumbreLogo size={20} viva={false} />
          <p>La cabaña del equipo Hyvento. Todo el arte está hecho con código.</p>
        </div>
      </footer>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[15px] font-semibold tracking-wide text-cozy-wood uppercase">
      <span className="h-[3px] w-6 bg-cozy-wood" aria-hidden />
      {children}
    </p>
  );
}

function Funcion({
  n,
  titulo,
  texto,
  chips,
  invertida = false,
  children,
}: {
  n: string;
  titulo: string;
  texto: string;
  chips: [PixelIconName, string][];
  invertida?: boolean;
  children: ReactNode;
}) {
  return (
    <article className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
      <div className={`flex flex-col gap-4 ${invertida ? "md:order-2" : ""}`}>
        <span className="text-[15px] font-semibold text-cozy-wood-light">{n}</span>
        <h3 className="text-[clamp(28px,3.2vw,40px)] leading-[1.05] font-semibold text-balance" style={{ textShadow: "2px 2px 0 var(--color-cozy-frame)" }}>
          {titulo}
        </h3>
        <p className="max-w-[44ch] text-[17px] leading-relaxed text-cozy-paper-dark">{texto}</p>
        <ul className="mt-1 flex flex-wrap gap-2">
          {chips.map(([icono, texto]) => (
            <li key={texto} className="cozy-chip flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] leading-none">
              <PixelIcon name={icono} size={13} color="var(--color-cozy-wood)" />
              {texto}
            </li>
          ))}
        </ul>
      </div>
      <div className={invertida ? "md:order-1" : ""}>{children}</div>
    </article>
  );
}

function Paso({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <li className="cozy-panel flex flex-col gap-3 px-5 pt-5 pb-6">
      <span className="grid h-10 w-10 place-items-center border-2 border-cozy-frame bg-cozy-wood text-[20px] font-semibold text-cozy-paper-light shadow-[2px_2px_0_var(--color-cozy-frame)]">
        {n}
      </span>
      <p className="text-[20px] leading-tight font-semibold">{titulo}</p>
      <div className="text-[16px] leading-relaxed text-cozy-ink-soft">{children}</div>
    </li>
  );
}
