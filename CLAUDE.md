# Hyvento Office — guía para Claude Code

La cabaña virtual del equipo Hyvento: isométrica, pixel-art estilo Stardew, multijugador, con chat y video por proximidad, oficinas personales, sillas, personajes personalizables y un PC con "Hyvento OS" (notas estilo Notion). Ver `README.md` para el estado y el despliegue, `ONBOARDING.md` para preparar el entorno y `docs/planes/plan-cabana.md` para el plan de salas y fases.

## Idioma y estilo

- Todo en **español**: UI, comentarios, mensajes de error, commits y PRs. Comentarios cortos que explican el *porqué*, como el código que ya existe.
- Commits en formato convencional en español: `feat: …`, `fix: …`, `chore: …`, `refactor: …`, con un cuerpo breve si hace falta.
- **Nunca** agregar `Co-Authored-By` ni atribución a Claude/IA en commits o PRs.
- No agregar funciones que dependan de APIs de IA de pago: se retiraron a propósito (el código viejo está en la rama `archivo/agentes-ia`).
- Todo el arte se genera **por código** (no se compran ni se agregan assets de imagen).
- **Estándar de calidad del arte** (`docs/arte/estandar-arte.md`): todo sprite tiene que ser entendible, bonito y llamativo. Volumen isométrico en 3/4 con luz de arriba a la izquierda, al menos tres tonos por material, contorno cálido, detalle con intención, tamaño que llene su lugar y movimiento donde lo real se mueve. Antes del PR se revisa en una hoja PNG junto a un chibi. Lo plano, chico o de pocos píxeles se rehace.
- **Nunca emojis** en nada que se vea: textos, diálogos, cinemáticas, avisos, botones, reacciones, chat del sistema ni logs. Tampoco símbolos de la fuente que cada sistema dibuja a su manera (★ ♪ ✓ ✕ ▶ ❚…). En su lugar, siempre **emojis pixel art propios**: `PixelIcon` (`components/Cozy.tsx`, íconos de 8x8; uno nuevo se agrega a `ICONS`), los emotes con su arte (`art/emotes.ts`) o un dibujo nuevo por código. El test `components/sin-emojis.test.ts` lo revisa en todo el código (los comentarios no cuentan).
- **Textos en español de Colombia** (o neutro que entienda todo el país): nada de españolismos (vale, coger, móvil, zumo, patata…), mexicanismos ni palabras regionales que confundan (ej. 'chupeta': mejor 'colombina' o 'bombón'); claros, cálidos y cortos; usted/tú coherente: la interfaz le habla de tú al jugador y los NPC mayores (Doña Aurora, Doña Gloria, Don Evelio, el Man del Sombrero) tratan de usted.

## Flujo de trabajo

- `main` se despliega solo a producción (Vercel y Render). El dueño del repo (Juan José, `poethy`) hace push directo a `main`; **las demás personas trabajan en una rama y abren un PR**.
- Antes de subir: `pnpm typecheck` y `pnpm test` (el CI corre lo mismo en cada PR).
- Si el cambio se ve en el navegador, probarlo con el servidor de desarrollo (`.claude/launch.json` → `hyvento-dev`). Las pantallas de la cabaña piden sesión: para revisar solo la UI sirve una página temporal en `apps/web/src/app/zz-*` con datos falsos, que **se borra antes del commit** (y también `apps/web/.next/types`).
- El arte es pixel art **dibujado a mano** en grillas de letras (`docs/arte/estandar-arte.md`, piezas comunes en `art/grilla.ts`), nunca armado con primitivas. Para revisar piezas sueltas: `pnpm --filter @hyvento/map hoja <carpeta> [filtro] [escala]` (hojas de contacto con un chibi al lado; la auditoría está en `docs/arte/auditoria-arte.md`).
- Para revisar el arte de un nivel sin abrir el juego: `pnpm --filter @hyvento/map render <nivel> salida.png [noche]` (niveles: `jardin`, `planta-baja`, `piso-2`, `piso-3`, `sotano`, `garaje`, `casa-arbol`, `megabus`, `observatorio`, `podcast`, y la plantilla de la casa: `casa-afuera`, `casa-abajo`, `casa-arriba`).

## Migraciones de base de datos (importante)

- Ni Vercel ni Render corren migraciones. Si un cambio agrega o cambia columnas, la migración se aplica a Neon **antes** de que el código llegue a `main`; si no, la app falla al leer usuarios. Solo el dueño la aplica en producción: en el PR, avisar que trae migración.
- Crear migraciones con `pnpm --filter @hyvento/db migrate --name <nombre>` (base local en Docker).
- **Orden de las carpetas**: Prisma las aplica por nombre. Algunas migraciones existentes tienen hora "adelantada" (`20260926180000`, `…190000`, `…200000`). Una migración nueva debe quedar **después** de la última carpeta de `packages/db/prisma/migrations`; si Prisma genera una con fecha anterior, renombrar la carpeta (y revisar que no quede un duplicado).
- Cambios que borran columnas: primero dejar de usarlas y borrarlas en una migración posterior (conviven versiones mientras se despliega).

## Subir cambios al repo

El repo principal es `MrxHuaang/lumbre-office` (fork de `poethy/hyvento-office`). Quien no es dueño trabaja siempre así:

1. **Antes de tocar código**, buscar el issue en Linear (ver abajo). Si no existe, crearlo.
2. Rama nueva desde `main` actualizado, con el id del issue: `feat/vir-123-lo-que-hagas` (o `fix/…`, `chore/…`, `docs/…`). Nunca push directo a `main`.
3. Commits chicos en español (`feat: …`); el id del issue puede ir en el cuerpo, no en el título. Sin `Co-Authored-By`.
4. Antes de subir: `pnpm typecheck && pnpm test`; si cambia algo visible, probarlo en el navegador; si agrega arte o niveles, también `pnpm --filter @hyvento/web build`.
5. PR hacia `main` de `MrxHuaang/lumbre-office`, título en estilo de commit y en la descripción: qué cambia, cómo se probó, `VIR-123` y, si trae migración, **"⚠️ Trae migración"** en la primera línea.
6. Si el cambio vuelve viejo algo de `CLAUDE.md`, `README.md` o `docs/`, actualizarlo en el mismo PR.
7. No mezclar el PR: lo revisa y lo mezcla el dueño.

## Linear (team Virtual-Office)

Linear es donde se lleva el trabajo: workspace **Hyvento**, team **Virtual-Office** (ids `VIR-…`). Cada cambio del repo tiene su issue.

**Cómo está organizado**

- **Proyectos**: Fundación, Cabaña Lumbre y Estructuras del jardín (cerrados, lo ya hecho); Extras de la cabaña, Casa de cada persona y Lumbre para cualquier equipo (pendientes, cada uno con su plan en `docs/`); Mantenimiento (bugs, deuda y docs).
- **Labels**: una del grupo **Área** (Mundo y niveles, Servidor y multijugador, Voz y video, Economía y puntos, Juegos, Vida en la cabaña, HUD e interfaz, Hyvento OS, Personajes, Marca y portada, Infra y despliegue, Rendimiento) y una de tipo (Feature, Improvement o Bug).
- **Estados**: Backlog → Todo → In Progress → In Review → Done (o Canceled / Duplicate). "In Review" quiere decir que el PR ya está abierto y espera que lo revisen.

**Qué hacer en Linear en cada paso**

| Momento | Cambio en Linear |
|---|---|
| Se va a empezar algo | Buscar el issue (por título o palabras clave). Si no hay, crearlo en el proyecto que corresponde, con su label de Área y de tipo y una descripción corta del objetivo. |
| Se crea la rama | Pasar el issue a **In Progress** y asignarlo a quien trabaja. |
| Se abre el PR | Pasar el issue a **In Review**, adjuntar el link del PR y dejar un comentario corto (qué se hizo, cómo se probó, si trae migración). |
| El revisor pide cambios | Volver el issue a **In Progress** mientras se corrigen; al subir los cambios, otra vez a **In Review**. |
| El PR se mezcla | Recién ahí pasar el issue a **Done** (comprobar el merge con `gh pr view`). |
| El PR se cierra sin mezclar | Volver el issue a **Todo** con un comentario del porqué. |
| Aparece un bug u otra idea fuera del alcance | Crear un issue nuevo (bugs en Mantenimiento con label Bug) y no arreglarlo en el mismo PR salvo que sea trivial. |
| Un issue depende de otro | Marcarlo con "blocked by", no mezclar los dos en un PR. |
| Se completa todo un proyecto | Avisar al dueño; él cierra el proyecto. |

**Reglas**

- No borrar issues ni proyectos, ni cambiar los de otra persona más allá del estado y los links: si algo sobra, **Canceled** o **Duplicate** con comentario.
- No pasar a Done algo que no está en `main`.
- Si una decisión es del dueño (precios, contenido, lo marcado "decidir"), dejar la pregunta en el issue y no inventar la respuesta.
- Títulos en español y en positivo, como los commits ("La radio re-bufferea con videos en vivo", "Standup diario en el tablón"), sin prefijos de grupo ni números de paso ("Equipos 2:", "Fase 3:"): el orden se marca con "blocked by". No hay equipos repartiéndose el trabajo: cada issue lo toma una persona, que se lo asigna al empezar.

## Mapa del código

| Carpeta | Qué hay |
|---|---|
| `apps/web` | Next.js 15 + Phaser 3 + React (Tailwind 4, zustand). Login, perfil, cabaña, `/admin`, API (`src/app/api`). |
| `apps/web/src/game` | Escena de Phaser (`OfficeScene.ts`), render de niveles (`iso/view.ts`), avatares chibi, red (Colyseus), medios (LiveKit), store (zustand). |
| `apps/web/src/components` | HUD cozy (`Hud`, `MediaControls`…), primitivas (`Cozy.tsx`: `PixelIcon`, `CozyTitle`) y el editor de personaje. |
| `apps/web/src/components/phone` | El celular de tapa: chat (Mensajes), contactos y conectados, estado, puntos, lugar y clima, más juegos y ajustes. Se carga recién al sacarlo (C o Enter); la lógica pura está en `src/game/phone`. |
| `apps/web/src/components/pc` | Hyvento OS: monitor, escritorio, ventanas, apps (Notas, Papelera, Calendario) y el editor TipTap (`editor/`). Se carga recién al prender el PC. |
| `apps/server` | Servidor de juego Colyseus: estado autoritativo, valida movimiento, paredes, asientos, portales, oficinas cerradas y toques de puerta. |
| `packages/shared` | Protocolo (zod), token de juego, `Look` (personaje), reglas de proximidad y de puntos (`points.ts`). |
| `packages/map` | El mundo (`src/world`: niveles, catálogo de muebles, constructor), colisión, A* y el motor pixel (`src/art`, solo lo usa el navegador). |
| `packages/db` | Prisma + Postgres (Neon en producción) y `awardPoints` (movimientos de puntos). |

## Cosas a saber

El detalle de cada sistema vive en `docs/referencia/`. Antes de tocar un sistema, leer su entrada (buscar por el título en negrita). Lo que cambie, se actualiza ahí en el mismo PR.

- [`docs/referencia/mundo-y-motor.md`](docs/referencia/mundo-y-motor.md) — **Mundo y motor**: El mundo está definido en código; Afuera sin bordes; Editor de la casa; Decoración de oficinas; Rendimiento del juego; Reconexión y deploys; Pantalla de carga; Coordenadas; Paredes; Luces de noche; Muebles orientados; Niveles y portales; Personajes; Estilo cozy; Validación en el servidor; Límite de mensajes; Reloj del juego.
- [`docs/referencia/progreso.md`](docs/referencia/progreso.md) — **Progreso y economía**: Puntos; Encargos; Historia: el motor de capítulos; Historia, capítulo 1 "La llegada"; Historia, capítulo 2 "El reloj de pie"; Historia, capítulo 3 "La llavecita del lago"; Oficios; Tienda e inventario; Mochila (inventario estilo Stardew); Cafetería y bar; Arte de lo que se lleva en la mano.
- [`docs/referencia/social-y-ui.md`](docs/referencia/social-y-ui.md) — **Social, interfaz y herramientas**: Permisos por persona; Panel del director; Estados de presencia; Comunicación rápida; Diálogos: la tira y el murmullo; Cinemáticas; Objetos interactivos; Standup del tablón; Fotos; Logros a la vista; Celular; Fondos del escritorio; Notas; Pintura; Facilidad de uso; Avisos de GitHub; Login local sin Google.
- [`docs/referencia/lugares.md`](docs/referencia/lugares.md) — **Lugares y sistemas del jardín**: Piscina; Tina caliente y sauna; Sótano; Propinas del tubo; Escenario; Estudio de grabación; Garaje; Taller del garaje; Casa del árbol; Megabús; Casa de cada persona; Dormir; Observatorio; Casino; Ajedrez y damas; NPC del casino; El Man del Sombrero; Puesto de pesca; La granja del jardín; Estaciones y cocina; Mascotas; Mundo lleno.
- [`docs/referencia/festivales.md`](docs/referencia/festivales.md) — **Festivales y gente de la fiesta**: Festivales; La gente de la fiesta; Novenas de aguinaldo; Noche de brujas; Noche de brujas jugable; Carnaval de Negros y Blancos; Noche de velitas; Feria de las flores jugable; Feria de la cosecha jugable; Festival de cometas jugable; Amor y amistad jugable; Año viejo.

## Comandos

```bash
pnpm dev                                   # web :3000 + servidor de juego :2567
pnpm typecheck && pnpm test                # lo mismo que corre el CI
pnpm infra:up                              # Postgres y LiveKit en Docker
pnpm --filter @hyvento/db migrate          # aplicar/crear migraciones en la base local
pnpm --filter @hyvento/map render jardin   # dibujar un nivel a PNG para revisar el arte
pnpm --filter @hyvento/web build           # build de producción (como Vercel)
```
