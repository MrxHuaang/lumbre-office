// La portada pública de Lumbre ("/" sin sesión). Presenta Lumbre como la base para cualquier equipo
// (docs/plan-equipos.md), aunque eso todavía no funciona: "Crea tu mundo" abre un aviso de
// "Próximamente". El acceso de Hyvento (Entrar) sigue igual. Es del servidor; lo interactivo son islas
// del cliente. Todo el arte sale del juego: la escena y las viñetas del build (scripts/prerender.ts) y
// las capturas de los niveles en public/landing (pnpm --filter @hyvento/map render, recortadas).
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CozyTitle, PixelIcon, type PixelIconName } from "../Cozy";
import { EscenaViva } from "./EscenaViva";
import { Letrero } from "./Letrero";
import { Llama, LumbreLogo } from "./Logo";
import { ESLOGAN, MARCA, textoPixeles } from "./marca";
import { Nav } from "./Nav";
import { Personaje } from "./Personaje";
import { CrearMundo, Proximamente } from "./Proximamente";
import { Reloj } from "./Reloj";
import { SECCIONES } from "./secciones";
import { Diorama, Objetos, Personajes, Proximidad } from "./Vinetas";

/** Lo que pasa por la cinta de abajo de la portada. */
const CINTA: [PixelIconName, string][] = [
  ["mic", "Audio y video por cercanía"],
  ["lock", "Oficinas propias"],
  ["phone", "Teléfono entre oficinas"],
  ["bell", "Avisos del navegador"],
  ["sun", "Día y noche"],
  ["rain", "Clima y estaciones"],
  ["fish", "Pesca"],
  ["leaf", "Huerto y granja"],
  ["pot", "Cocina"],
  ["star", "Observatorio"],
  ["clap", "Escenario"],
  ["bag", "Mochila"],
  ["camera", "Fotos"],
  ["trophy", "Logros"],
];

/** Las capturas de los niveles (en píxeles de arte: se agrandan sin suavizar). */
const CAPTURAS = {
  lago: { src: "/landing/lago.webp", w: 1172, h: 578 },
  granja: { src: "/landing/granja.webp", w: 822, h: 335 },
  cocina: { src: "/landing/cocina.webp", w: 482, h: 362 },
  piscina: { src: "/landing/piscina.webp", w: 548, h: 305 },
  torre: { src: "/landing/torre-noche.webp", w: 578, h: 426 },
  escenario: { src: "/landing/escenario.webp", w: 518, h: 356 },
  casino: { src: "/landing/casino.webp", w: 535, h: 284 },
  oficinas: { src: "/landing/oficinas.webp", w: 1058, h: 589 },
} as const;

export function Landing() {
  return (
    <div className="lumbre-portada cozy-void min-h-full overflow-x-clip font-pixel text-cozy-paper-light">
      <a href="#contenido" className="lumbre-saltar cozy-btn cozy-btn-primary px-4 py-2 text-[15px]">
        Saltar al contenido
      </a>
      <Nav />

      <main id="contenido">
        <Portada />
        <Cinta />
        <Cercania />
        <TuRincon />
        <MundoVivo />
        <Pausas />
        <ComoFunciona />
        <TuEquipo />
        <Citas />
        <Preguntas />
        <Llamado />
      </main>

      <Pie />
      <Proximamente />
    </div>
  );
}

/* ---------------------------------------------------------------- Portada */

function Portada() {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-6 px-4 pt-8 pb-12 sm:px-8 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)] lg:gap-2 lg:pt-6 lg:pb-16">
      <div className="lumbre-entra relative z-[2] flex flex-col items-start gap-6">
        <span className="cozy-chip flex items-center gap-2 px-3 py-1.5 text-[14px] leading-none">
          <PixelIcon name="cabin" size={14} color="var(--color-cozy-wood)" />
          Oficina virtual en pixel-art
        </span>
        <CozyTitle className="text-[clamp(36px,4.3vw,62px)] leading-[1.04] text-balance">{ESLOGAN}</CozyTitle>
        <p className="max-w-[40ch] text-[18px] leading-snug text-cozy-paper-dark sm:text-[20px]">
          Crea el mundo de tu equipo, ponle su nombre e invita a tu gente. Se acercan y ya están hablando.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <CrearMundo className="cozy-btn cozy-btn-primary gap-2.5 px-6 py-3.5 text-[19px]">
            <Llama size={20} viva={false} />
            Crea tu mundo
            <span className="bg-[#2e5a40] px-1.5 py-0.5 text-[12px] leading-none">pronto</span>
          </CrearMundo>
          <Link href="/login" className="cozy-btn px-5 py-3.5 text-[17px]">
            Entrar
          </Link>
        </div>
      </div>
      <div className="lumbre-entra-tarde relative -mx-4 sm:mx-0 lg:-mr-16">
        <EscenaViva className="w-full max-sm:ml-[-17%] max-sm:w-[140%]" />
      </div>
    </section>
  );
}

/** La cinta de madera con todo lo que hay adentro (la única marquesina de la página). */
function Cinta() {
  const fila = (oculta: boolean) => (
    <ul className="lumbre-cinta-fila flex shrink-0 items-center gap-3 pr-3" aria-hidden={oculta || undefined}>
      {CINTA.map(([icono, texto]) => (
        <li key={texto} className="cozy-chip flex items-center gap-2 px-3 py-2 text-[15px] leading-none whitespace-nowrap">
          <PixelIcon name={icono} size={14} color="var(--color-cozy-wood)" />
          {texto}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="lumbre-cinta border-y-4 border-cozy-frame bg-cozy-wood py-3" role="region" aria-label="Lo que hay en Lumbre">
      <div className="lumbre-cinta-pista flex w-max">
        {fila(false)}
        {fila(true)}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Cercanía */

function Cercania() {
  return (
    <section id="funciones" className="scroll-mt-20">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-8 md:py-28 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-16">
        <div className="lumbre-revela">
          <Proximidad className="w-full shadow-[6px_6px_0_rgb(20_10_24/0.5)]" />
        </div>
        <div className="flex flex-col gap-6">
          <h2 className="lumbre-h2 text-[clamp(32px,3.8vw,52px)]">Te acercas y ya están hablando</h2>
          <p className="max-w-[46ch] text-[18px] leading-relaxed text-cozy-paper-dark">
            El audio y el video siguen a tu personaje: cerca se oyen y se ven, lejos la conversación se apaga sola. Sin enlaces, sin agendar, sin colgar.
          </p>
          <dl className="mt-2 flex flex-col gap-5">
            <Punto icono="clap" titulo="Sala de reuniones y escenario">
              En la sala se oyen todos los de adentro. En el escenario del jardín, quien tiene la palabra llega a todo el anfiteatro, con mano levantada y aplausos.
            </Punto>
            <Punto icono="phone" titulo="Teléfono entre oficinas">
              Llama a otra oficina sin salir de la tuya. Si la otra persona está en No molestar, la llamada no entra.
            </Punto>
            <Punto icono="screen" titulo="Pantalla compartida y chat">
              Comparte pantalla con quien está cerca y escribe en el chat del lugar o en el general.
            </Punto>
          </dl>
        </div>
      </div>
    </section>
  );
}

function Punto({ icono, titulo, children }: { icono: PixelIconName; titulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-4">
      <span className="grid h-10 w-10 place-items-center border-2 border-cozy-frame bg-cozy-paper-dark shadow-[2px_2px_0_rgb(20_10_24/0.45)]" aria-hidden>
        <PixelIcon name={icono} size={18} color="var(--color-cozy-frame)" />
      </span>
      <div>
        <dt className="text-[19px] leading-tight font-semibold">{titulo}</dt>
        <dd className="mt-1 max-w-[44ch] text-[16px] leading-relaxed text-cozy-paper-dark">{children}</dd>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Tu rincón (bento) */

const ESTADOS: { nombre: string; color: string }[] = [
  { nombre: "Disponible", color: "#5ea247" },
  { nombre: "Ocupado", color: "#c9851c" },
  { nombre: "No molestar", color: "#d93a2b" },
  { nombre: "En reunión", color: "#5d93cf" },
  { nombre: "Ausente", color: "#8a7a6a" },
];

function TuRincon() {
  return (
    <section className="lumbre-papel text-cozy-ink" aria-labelledby="rincon-titulo">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 md:py-24">
        <h2 id="rincon-titulo" className="max-w-[20ch] text-[clamp(32px,3.8vw,52px)] leading-[1.04] font-semibold text-balance">
          Tu rincón en la casa, a tu ritmo
        </h2>
        <p className="mt-4 max-w-[52ch] text-[18px] leading-relaxed text-cozy-ink-soft">
          Cada persona tiene su oficina, y la casa sabe cuándo estás, cuándo no y cuándo no quieres que te interrumpan.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-6">
          {/* Oficinas: la celda grande. */}
          <article className="lumbre-revela cozy-panel flex flex-col overflow-hidden md:col-span-2 lg:col-span-4 lg:row-span-2">
            <div className="border-b-4 border-cozy-frame bg-cozy-void">
              <Image
                src={CAPTURAS.oficinas.src}
                alt="El piso 2 de la cabaña visto desde arriba: oficinas con escritorios, bibliotecas y sillones, y la sala de reuniones azul"
                width={CAPTURAS.oficinas.w}
                height={CAPTURAS.oficinas.h}
                unoptimized
                sizes="(min-width: 1024px) 800px, 100vw"
                className="pixelated block h-auto w-full"
              />
            </div>
            <div className="flex flex-col gap-2 px-6 py-5">
              <h3 className="text-[24px] leading-tight font-semibold">Una oficina propia, decorada a tu gusto</h3>
              <p className="max-w-[60ch] text-[16px] leading-relaxed text-cozy-ink-soft">
                Con tu nombre en la puerta. Ciérrala con llave cuando necesites concentrarte: quien quiera entrar toca. La decoras con muebles de la tienda y tus trofeos van a la vitrina.
              </p>
            </div>
          </article>

          <article className="lumbre-revela cozy-panel flex flex-col gap-4 px-6 py-5 lg:col-span-2">
            <h3 className="text-[21px] leading-tight font-semibold">Estados que se ponen solos</h3>
            <ul className="flex flex-wrap gap-2">
              {ESTADOS.map((e) => (
                <li key={e.nombre} className="cozy-chip flex items-center gap-2 px-2.5 py-1.5 text-[14px] leading-none">
                  <span className="h-2.5 w-2.5 border border-cozy-frame" style={{ background: e.color }} aria-hidden />
                  {e.nombre}
                </li>
              ))}
            </ul>
            <p className="text-[15px] leading-relaxed text-cozy-ink-soft">
              Si te alejas del teclado pasas a Ausente, y con alguien en la sala de reuniones, a En reunión. Lo que eliges a mano manda.
            </p>
          </article>

          <article className="lumbre-revela cozy-panel flex flex-col gap-4 px-6 py-5 lg:col-span-2">
            <h3 className="text-[21px] leading-tight font-semibold">Avisos del navegador</h3>
            {/* Cómo se ve un aviso adentro (con las mismas piezas del HUD). */}
            <div className="flex items-center gap-3 border-2 border-cozy-frame bg-cozy-void px-3 py-2.5 text-cozy-paper-light shadow-[3px_3px_0_rgb(20_10_24/0.4)]" aria-hidden>
              <span className="grid h-9 w-9 shrink-0 place-items-center bg-cozy-paper-dark">
                <PixelIcon name="bell" size={16} color="var(--color-cozy-frame)" />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-[14px] font-semibold">Bruno toca tu puerta</span>
                <span className="truncate text-[13px] text-cozy-paper-dark">Oficina del piso 2</span>
              </span>
            </div>
            <p className="text-[15px] leading-relaxed text-cozy-ink-soft">Si te llaman o tocan tu puerta con la pestaña escondida, te avisa el navegador.</p>
          </article>

          <article className="lumbre-revela cozy-panel flex flex-col gap-3 px-6 py-5 lg:col-span-2 lg:col-start-1 lg:row-start-3">
            <h3 className="text-[21px] leading-tight font-semibold">Invita e «Ir hasta»</h3>
            <p className="text-[15px] leading-relaxed text-cozy-ink-soft">
              Invita a alguien con su correo. En la lista de conectados, con el minimapa, «Ir hasta» te lleva caminando a donde está.
            </p>
            <div className="mt-auto flex items-center gap-2 text-[14px]" aria-hidden>
              <span className="cozy-chip px-2 py-1 leading-none">Eva</span>
              <PixelIcon name="steps" size={16} color="var(--color-cozy-wood)" />
              <span className="cozy-btn cozy-btn-primary px-2.5 py-1 text-[13px]">Ir hasta</span>
            </div>
          </article>

          <article className="lumbre-revela lumbre-pasto flex flex-col gap-4 border-4 border-cozy-frame px-5 pt-6 pb-5 text-cozy-paper-light shadow-[3px_3px_0_rgb(20_10_24/0.45)] md:col-span-2 lg:col-span-4 lg:col-start-3 lg:row-span-2 lg:row-start-3">
            <h3 className="text-[24px] leading-tight font-semibold" style={{ textShadow: "2px 2px 0 var(--color-cozy-frame)" }}>
              Personajes a tu medida
            </h3>
            <p className="max-w-[52ch] text-[16px] leading-relaxed" style={{ textShadow: "1px 1px 0 var(--color-cozy-frame)" }}>
              Peinado, ojos, barba, ropa, sombreros y accesorios. La ropa es toda gratis y te la cambias en el vestidor de la tienda.
            </p>
            <Personajes className="my-auto py-4" tam="w-[16%] max-w-40" />
          </article>

          <article className="lumbre-revela cozy-panel flex flex-col overflow-hidden lg:col-span-2 lg:col-start-1 lg:row-start-4">
            <div className="grid place-items-center border-b-4 border-cozy-frame bg-cozy-void px-4 py-4">
              <Diorama sala="oficina" className="w-[min(100%,240px)]" />
            </div>
            <div className="flex flex-col gap-2 px-6 py-5">
              <h3 className="text-[21px] leading-tight font-semibold">Hyvento OS en tu escritorio</h3>
              <p className="text-[15px] leading-relaxed text-cozy-ink-soft">Prende el PC de tu oficina: notas privadas estilo Notion, papelera y calendario, todo en pixel.</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Mundo vivo */

const CLIMA: [PixelIconName, string][] = [
  ["sun", "Despejado"],
  ["cloud", "Nublado"],
  ["rain", "Lluvia"],
  ["fog", "Niebla"],
  ["storm", "Tormenta"],
  ["snow", "Nieve en invierno"],
];

function MundoVivo() {
  return (
    <section id="mundo" className="scroll-mt-20">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-8 md:py-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-16">
        <div className="flex flex-col gap-6">
          <h2 className="lumbre-h2 text-[clamp(32px,3.8vw,52px)]">Un mundo que vive aunque no estés mirando</h2>
          <p className="max-w-[46ch] text-[18px] leading-relaxed text-cozy-paper-dark">
            Un día del juego dura una hora real: amanece, cae la tarde y de noche se prenden las ventanas. El clima cambia solo y la estación sale del mes, así que el huerto crece distinto en invierno.
          </p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CLIMA.map(([icono, texto]) => (
              <li key={texto} className="flex items-center gap-2 border-2 border-cozy-wood/60 bg-[#221a2a] px-3 py-2 text-[15px] leading-tight">
                <PixelIcon name={icono} size={16} color="var(--color-cozy-paper-dark)" />
                {texto}
              </li>
            ))}
          </ul>
        </div>
        <div className="lumbre-revela">
          <Reloj />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Pausas (galería) */

function Pausas() {
  return (
    <section className="border-t-4 border-cozy-frame bg-[#241c2c]" aria-labelledby="pausas-titulo">
      <div className="mx-auto max-w-7xl px-4 pt-20 sm:px-8 md:pt-24">
        <h2 id="pausas-titulo" className="lumbre-h2 max-w-[22ch] text-[clamp(32px,3.8vw,52px)]">
          Cosas para hacer entre reunión y reunión
        </h2>
        <p className="mt-4 max-w-[52ch] text-[18px] leading-relaxed text-cozy-paper-dark">
          El jardín, la casa y el sótano están llenos de rincones. Todo se gana y se gasta con puntos del juego.
        </p>
      </div>
      <div className="lumbre-galeria cozy-scroll mt-10 pb-20 md:pb-24" role="region" aria-label="Actividades de Lumbre, se desliza de lado" tabIndex={0}>
        <ul className="flex w-max gap-5 px-4 sm:px-8 lg:px-[max(2rem,calc((100vw_-_80rem)/2_+_2rem))]">
          <Tarjeta img={CAPTURAS.lago} alt="El lago con el muelle, el puesto de pesca de Don Evelio y la tina caliente junto a la sauna" titulo="Pesca en el lago">
            Don Evelio vende cañas y carnada en su puesto junto al muelle. Según la hora pican peces distintos.
          </Tarjeta>
          <Tarjeta img={CAPTURAS.granja} alt="El huerto con sus canteros, el invernadero, las colmenas y el gallinero con su patio" titulo="Huerto y granja">
            Siembra según la estación, riega y cosecha. Dale de comer a las gallinas y a la cabra, y muele maíz en el molino.
          </Tarjeta>
          <Tarjeta img={CAPTURAS.cocina} alt="La cafetería de la planta baja con sus mesitas, la barra y la cocina con estufas y mesón" titulo="Cocina y cafetería">
            Cocina con lo que cosechaste, pide un tinto en la barra o prende la parrilla con el equipo.
          </Tarjeta>
          <Tarjeta img={CAPTURAS.piscina} alt="La piscina con su trampolín, reposeras y sombrillas" titulo="Piscina">
            Clavados desde el trampolín y reposeras al sol. Si llueve, se tapa con la lona y todos salen.
          </Tarjeta>
          <Tarjeta img={CAPTURAS.torre} alt="La torre del observatorio en la lomita, con su cúpula de cobre y la fogata de malvaviscos al lado" titulo="Observatorio">
            La astrónoma cuenta del cielo y de noche la cúpula se abre para ver estrellas fugaces. Afuera, malvaviscos en la fogata.
          </Tarjeta>
          <Tarjeta img={CAPTURAS.escenario} alt="El escenario del jardín con su concha de madera, la pantalla y las gradas en semicírculo" titulo="Escenario">
            Charlas para todo el equipo, con la pantalla compartida sobre la concha y turnos para hablar.
          </Tarjeta>
          <li className="flex w-[min(82vw,380px)] shrink-0 flex-col overflow-hidden border-4 border-cozy-frame bg-cozy-paper text-cozy-ink shadow-[5px_5px_0_rgb(20_10_24/0.5)]">
            <div className="grid flex-1 place-items-center border-b-4 border-cozy-frame bg-[#3a2d44] px-4 py-6">
              <Objetos className="w-full" />
            </div>
            <div className="flex flex-col gap-2 px-5 py-4">
              <h3 className="text-[21px] leading-tight font-semibold">Mochila estilo Stardew</h3>
              <p className="text-[15px] leading-relaxed text-cozy-ink-soft">Lo que agarras va a tus casillas: comida, semillas, lo que pescas. Lo de la mano se usa con F.</p>
            </div>
          </li>
          <li className="flex w-[min(82vw,380px)] shrink-0 flex-col overflow-hidden border-4 border-cozy-frame bg-cozy-paper text-cozy-ink shadow-[5px_5px_0_rgb(20_10_24/0.5)]">
            <div className="grid flex-1 grid-cols-3 place-items-center gap-4 border-b-4 border-cozy-frame bg-[#3a2d44] px-6 py-8">
              {(["camera", "trophy", "star"] as const).map((i) => (
                <span key={i} className="grid aspect-square w-full place-items-center border-2 border-cozy-frame bg-cozy-paper-dark shadow-[3px_3px_0_rgb(20_10_24/0.45)]" aria-hidden>
                  <PixelIcon name={i} size={36} color="var(--color-cozy-frame)" />
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2 px-5 py-4">
              <h3 className="text-[21px] leading-tight font-semibold">Fotos, logros e insignias</h3>
              <p className="text-[15px] leading-relaxed text-cozy-ink-soft">Saca una foto grupal con P y cuélgala en el tablón. Junta logros y lleva tu insignia junto al nombre.</p>
            </div>
          </li>
          <Tarjeta img={CAPTURAS.casino} alt="El casino del sótano con la ruleta, las mesas de blackjack y los letreros de neón" titulo="Casino y club" opcional>
            Ruleta, blackjack y el club del sótano, siempre con puntos y nunca con plata. Serán opcionales: cada equipo decide si los prende.
          </Tarjeta>
        </ul>
      </div>
    </section>
  );
}

function Tarjeta({
  img,
  alt,
  titulo,
  opcional = false,
  children,
}: {
  img: { src: string; w: number; h: number };
  alt: string;
  titulo: string;
  opcional?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex w-[min(82vw,380px)] shrink-0 flex-col overflow-hidden border-4 border-cozy-frame bg-cozy-paper text-cozy-ink shadow-[5px_5px_0_rgb(20_10_24/0.5)]">
      <div className="relative aspect-[4/3] overflow-hidden border-b-4 border-cozy-frame bg-cozy-void">
        <Image src={img.src} alt={alt} width={img.w} height={img.h} unoptimized sizes="380px" className="pixelated absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="flex flex-col gap-2 px-5 py-4">
        <h3 className="flex flex-wrap items-center gap-2 text-[21px] leading-tight font-semibold">
          {titulo}
          {opcional && <span className="border-2 border-cozy-wood bg-cozy-paper-light px-1.5 py-0.5 text-[12px] leading-none font-medium">opcional</span>}
        </h3>
        <p className="text-[15px] leading-relaxed text-cozy-ink-soft">{children}</p>
      </div>
    </li>
  );
}

/* ---------------------------------------------------------------- Cómo funciona */

function ComoFunciona() {
  const pasos: { titulo: string; texto: ReactNode; icono: PixelIconName; pronto?: boolean }[] = [
    { titulo: "Crea tu mundo", icono: "cabin", pronto: true, texto: "Entras con Google y creas la cabaña de tu equipo. Es solo de ustedes: su gente, su chat, sus puntos." },
    { titulo: "Invita a tu equipo", icono: "mail", pronto: true, texto: "Mandas un enlace o agregas los correos. Cada quien arma su personaje y recibe su oficina." },
    {
      titulo: "Trabajen juntos",
      icono: "chat",
      texto: (
        <span className="leading-[2]">
          Clic para caminar, o <kbd className="cozy-kbd">W</kbd> <kbd className="cozy-kbd">A</kbd> <kbd className="cozy-kbd">S</kbd>{" "}
          <kbd className="cozy-kbd">D</kbd>. Con <kbd className="cozy-kbd">E</kbd> te sientas o usas algo; acércate a alguien y a conversar.
        </span>
      ),
    },
  ];
  return (
    <section id="como-funciona" className="lumbre-papel scroll-mt-20 text-cozy-ink">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 md:py-24">
        <h2 className="max-w-[20ch] text-[clamp(32px,3.8vw,52px)] leading-[1.04] font-semibold text-balance">Del letrero a la primera charla, en tres pasos</h2>
        <ol className="lumbre-pasos mt-12 grid gap-6 md:grid-cols-3 md:gap-8">
          {pasos.map((p, i) => (
            <li key={p.titulo} className="relative flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center border-2 border-cozy-frame bg-cozy-wood text-[22px] font-semibold text-cozy-paper-light shadow-[3px_3px_0_var(--color-cozy-frame)]">
                  {i + 1}
                </span>
                <span className="lumbre-paso-camino h-[4px] flex-1 max-md:hidden" aria-hidden />
              </div>
              <div className="cozy-panel flex flex-1 flex-col gap-3 px-5 pt-5 pb-6">
                <p className="flex flex-wrap items-center gap-2 text-[22px] leading-tight font-semibold">
                  <PixelIcon name={p.icono} size={18} color="var(--color-cozy-wood)" />
                  {p.titulo}
                  {p.pronto && <span className="border-2 border-cozy-wood bg-cozy-paper-light px-1.5 py-0.5 text-[12px] leading-none font-medium">pronto</span>}
                </p>
                <div className="text-[16px] leading-relaxed text-cozy-ink-soft">{p.texto}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Tu equipo, tu nombre */

function TuEquipo() {
  return (
    <section id="tu-equipo" className="scroll-mt-20 bg-cozy-paper-light text-cozy-ink" aria-labelledby="equipo-titulo">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 md:py-24">
        <h2 id="equipo-titulo" className="max-w-[18ch] text-[clamp(32px,3.8vw,52px)] leading-[1.04] font-semibold text-balance">
          Tu equipo, tu nombre en el letrero
        </h2>
        <p className="mt-4 mb-12 max-w-[52ch] text-[18px] leading-relaxed text-cozy-ink-soft">
          Cada mundo lleva el nombre de su equipo, pintado en dorado sobre la madera como el de Hyvento. Pruébalo:
        </p>
        <Letrero />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Citas */

const CITAS: { avatar: string; nombre: string; papel: string; texto: string }[] = [
  { avatar: "ada", nombre: "Ada", papel: "vive en su oficina del piso 2", texto: "Antes agendaba una llamada para preguntar una bobada. Ahora camino hasta la oficina de al lado." },
  { avatar: "bruno", nombre: "Bruno", papel: "pescador de las cuatro", texto: "Me puse en No molestar toda la mañana y nadie me tocó la puerta. Después bajé al lago." },
  { avatar: "eva", nombre: "Eva", papel: "no se pierde una fogata", texto: "Los viernes subimos al observatorio con malvaviscos. Es la mejor reunión de la semana." },
];

function Citas() {
  return (
    <section className="border-t-4 border-cozy-frame" aria-labelledby="citas-titulo">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 md:py-28">
        <h2 id="citas-titulo" className="lumbre-h2 max-w-[20ch] text-[clamp(32px,3.8vw,52px)]">
          Lo que cuentan los de la casa
        </h2>
        <p className="mt-3 text-[15px] text-cozy-paper-dark">Son personajes del juego; las frases, de la vida de todos los días en la cabaña.</p>
        <ul className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {CITAS.map((c, i) => (
            <li key={c.nombre} className={`flex flex-col gap-5 ${i === 1 ? "md:mt-12" : ""}`}>
              <figure className="flex flex-col gap-4">
                <blockquote className="lumbre-globo-cita cozy-panel relative px-5 py-4 text-[18px] leading-snug">
                  <p>“{c.texto}”</p>
                </blockquote>
                <figcaption className="flex items-center gap-3 pl-3">
                  <span className="lumbre-pasto grid h-16 w-16 shrink-0 place-items-end justify-center overflow-hidden border-4 border-cozy-frame">
                    <Personaje avatar={c.avatar} dir="down" className="w-12" />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[18px] font-semibold">{c.nombre}</span>
                    <span className="text-[14px] text-cozy-paper-dark">{c.papel}</span>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Preguntas */

const PREGUNTAS: { p: string; r: ReactNode }[] = [
  {
    p: "¿Qué es Lumbre?",
    r: "Una oficina virtual en pixel-art. Tu equipo camina por una cabaña con jardín, conversa con audio y video por cercanía y cada quien tiene su oficina. Es para trabajar juntos a distancia sin vivir en videollamadas.",
  },
  {
    p: "¿Ya puedo crear el mundo de mi equipo?",
    r: "Todavía no. Hoy Lumbre es la cabaña del equipo Hyvento y estamos preparando todo para que cualquier equipo tenga la suya, con su nombre en el letrero. Cuando abra, lo vas a ver aquí mismo.",
  },
  {
    p: "¿Hay que instalar algo?",
    r: "No. Funciona en el navegador del computador. El micrófono y la cámara se piden solo cuando los prendes.",
  },
  {
    p: "¿Cuánto va a costar?",
    r: "Todavía no está definido. Cuando lo esté, lo contamos primero en esta página.",
  },
  {
    p: "¿El casino es con plata?",
    r: "No. En Lumbre todo se juega con puntos del juego, que se ganan estando presente, en reuniones y con las actividades. Además, el casino y el club serán opcionales para cada equipo.",
  },
  {
    p: "¿Qué pasa con mis datos?",
    r: (
      <>
        Cada equipo va a ver solo lo suyo. Las notas del PC son privadas de cada persona. Los detalles están en la{" "}
        <Link href="/privacidad" className="lumbre-foco font-semibold text-cozy-frame underline underline-offset-4">
          política de privacidad
        </Link>
        .
      </>
    ),
  },
  {
    p: "Soy de Hyvento, ¿cómo entro?",
    r: (
      <>
        Con{" "}
        <Link href="/login" className="lumbre-foco font-semibold text-cozy-frame underline underline-offset-4">
          Entrar
        </Link>{" "}
        y la cuenta de Google con la que te invitaron. Tu oficina te espera.
      </>
    ),
  },
];

function Preguntas() {
  return (
    <section id="preguntas" className="lumbre-papel scroll-mt-20 text-cozy-ink">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 md:py-24 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
        <div className="flex flex-col gap-5">
          <h2 className="text-[clamp(32px,3.8vw,52px)] leading-[1.04] font-semibold text-balance">Preguntas frecuentes</h2>
          <div className="max-lg:hidden">
            <Diorama sala="juegos" className="w-[min(100%,320px)]" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {PREGUNTAS.map((q) => (
            <details key={q.p} className="lumbre-pregunta group cozy-panel">
              <summary className="lumbre-foco flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[19px] leading-snug font-semibold">
                {q.p}
                <PixelIcon name="chevron" size={16} className="shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-5 pb-5 text-[16px] leading-relaxed text-cozy-ink-soft">{q.r}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Llamado final */

function Llamado() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center sm:py-32">
        <div className="lumbre-hoguera grid place-items-center">
          <Llama size={112} />
        </div>
        <CozyTitle as="h2" className="text-[clamp(38px,6vw,68px)] leading-none text-balance">
          Acércate a la lumbre
        </CozyTitle>
        <p className="max-w-[36ch] text-[19px] leading-snug text-cozy-paper-dark">Pronto tu equipo va a tener su propia cabaña, con su nombre en el letrero y una silla junto al fuego.</p>
        <CrearMundo className="cozy-btn cozy-btn-primary gap-2.5 px-7 py-4 text-[20px]">
          <Llama size={22} viva={false} />
          Crea tu mundo
          <span className="bg-[#2e5a40] px-1.5 py-0.5 text-[12px] leading-none">pronto</span>
        </CrearMundo>
        <p className="text-[16px] text-cozy-paper-dark">
          ¿Eres de Hyvento?{" "}
          <Link href="/login" className="lumbre-foco text-cozy-paper-light underline underline-offset-4 hover:text-cozy-wood-light">
            Entrar
          </Link>
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Pie */

/** "LUMBRE" grande en letras pixel (las del banner), con la sombra de madera: la marca del pie. */
function MarcaGrande() {
  const t = textoPixeles(MARCA);
  // Cada píxel de la letra es de 4x4; la sombra se corre 1 y 2 (un cuarto y media letra), como CozyTitle.
  const S = 4;
  const w = t.w * S + 2;
  const h = t.h * S + 2;
  const capa = (d: number, fill: string) =>
    t.pixeles.map((p) => <rect key={`${d}-${p.x}-${p.y}`} x={p.x * S + d} y={p.y * S + d} width={S} height={S} fill={fill} />);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" className="block h-auto w-full" aria-hidden>
      {capa(2, "var(--color-cozy-frame)")}
      {capa(1, "var(--color-cozy-wood)")}
      {capa(0, "var(--color-cozy-paper-light)")}
    </svg>
  );
}

function Pie() {
  const anio = new Date().getFullYear();
  const columnas: { titulo: string; enlaces: ReactNode[] }[] = [
    {
      titulo: "Producto",
      enlaces: SECCIONES.slice(0, 4).map((s) => (
        <a key={s.href} href={s.href} className="lumbre-foco lumbre-enlace-pie">
          {s.texto}
        </a>
      )),
    },
    {
      titulo: "Lumbre",
      enlaces: [
        <Link key="entrar" href="/login" className="lumbre-foco lumbre-enlace-pie">
          Entrar
        </Link>,
        <CrearMundo key="crear" className="lumbre-foco lumbre-enlace-pie text-left">
          Crea tu mundo (pronto)
        </CrearMundo>,
        <a key="faq" href="#preguntas" className="lumbre-foco lumbre-enlace-pie">
          Preguntas frecuentes
        </a>,
      ],
    },
    {
      titulo: "Legal",
      enlaces: [
        <Link key="privacidad" href="/privacidad" className="lumbre-foco lumbre-enlace-pie">
          Política de privacidad
        </Link>,
      ],
    },
  ];
  return (
    <footer className="border-t-4 border-cozy-frame bg-[#1d1624] text-cozy-paper-dark">
      <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
          <div className="flex flex-col items-start gap-4">
            <LumbreLogo size={34} viva={false} />
            <p className="max-w-[34ch] text-[16px] leading-relaxed">{ESLOGAN}. Hecha en Colombia por el equipo Hyvento, con todo el arte dibujado en código.</p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {columnas.map((c) => (
              <nav key={c.titulo} aria-label={c.titulo} className="flex flex-col gap-3">
                <p className="text-[15px] font-semibold text-cozy-paper-light">{c.titulo}</p>
                <ul className="flex flex-col gap-2.5">
                  {c.enlaces.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-16 opacity-90" aria-hidden>
          <MarcaGrande />
        </div>
      </div>
      <div className="border-t-2 border-[#3a2d44]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-[14px] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {anio} {MARCA}. Todos los derechos reservados.
          </p>
          <Link href="/privacidad" className="lumbre-foco lumbre-enlace-pie w-fit">
            Privacidad
          </Link>
        </div>
      </div>
    </footer>
  );
}
