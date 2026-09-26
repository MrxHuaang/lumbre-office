# Hyvento Office — guía para Claude Code

La cabaña virtual del equipo Hyvento: isométrica, pixel-art estilo Stardew, multijugador, con chat y video por proximidad, oficinas personales, sillas, personajes personalizables y un PC con "Hyvento OS" (notas estilo Notion). Ver `README.md` para el estado y el despliegue, `ONBOARDING.md` para preparar el entorno y `docs/plan-cabana.md` para el plan de salas y fases.

## Idioma y estilo

- Todo en **español**: UI, comentarios, mensajes de error, commits y PRs. Comentarios cortos que explican el *porqué*, como el código que ya existe.
- Commits en formato convencional en español: `feat: …`, `fix: …`, `chore: …`, `refactor: …`, con un cuerpo breve si hace falta.
- **Nunca** agregar `Co-Authored-By` ni atribución a Claude/IA en commits o PRs.
- No agregar funciones que dependan de APIs de IA de pago: se retiraron a propósito (el código viejo está en la rama `archivo/agentes-ia`).
- Todo el arte se genera **por código** (no se compran ni se agregan assets de imagen).

## Flujo de trabajo

- `main` se despliega solo a producción (Vercel y Render). El dueño del repo (Juan José, `poethy`) hace push directo a `main`; **las demás personas trabajan en una rama y abren un PR**.
- Antes de subir: `pnpm typecheck` y `pnpm test` (el CI corre lo mismo en cada PR).
- Si el cambio se ve en el navegador, probarlo con el servidor de desarrollo (`.claude/launch.json` → `hyvento-dev`). Las pantallas de la cabaña piden sesión: para revisar solo la UI sirve una página temporal en `apps/web/src/app/zz-*` con datos falsos, que **se borra antes del commit** (y también `apps/web/.next/types`).
- Para revisar el arte de un nivel sin abrir el juego: `pnpm --filter @hyvento/map render <nivel> salida.png [noche]` (niveles: `jardin`, `planta-baja`, `piso-2`).

## Migraciones de base de datos (importante)

- Ni Vercel ni Render corren migraciones. Si un cambio agrega o cambia columnas, la migración se aplica a Neon **antes** de que el código llegue a `main`; si no, la app falla al leer usuarios. Solo el dueño la aplica en producción: en el PR, avisar que trae migración.
- Crear migraciones con `pnpm --filter @hyvento/db migrate --name <nombre>` (base local en Docker).
- **Orden de las carpetas**: Prisma las aplica por nombre. Algunas migraciones existentes tienen hora "adelantada" (`20260926180000`, `…190000`, `…200000`). Una migración nueva debe quedar **después** de la última carpeta de `packages/db/prisma/migrations`; si Prisma genera una con fecha anterior, renombrar la carpeta (y revisar que no quede un duplicado).
- Cambios que borran columnas: primero dejar de usarlas y borrarlas en una migración posterior (conviven versiones mientras se despliega).

## Mapa del código

| Carpeta | Qué hay |
|---|---|
| `apps/web` | Next.js 15 + Phaser 3 + React (Tailwind 4, zustand). Login, perfil, cabaña, `/admin`, API (`src/app/api`). |
| `apps/web/src/game` | Escena de Phaser (`OfficeScene.ts`), render de niveles (`iso/view.ts`), avatares chibi, red (Colyseus), medios (LiveKit), store (zustand). |
| `apps/web/src/components` | HUD cozy (`Hud`, `ChatPanel`, `MediaControls`…), primitivas (`Cozy.tsx`: `PixelIcon`, `CozyTitle`) y el editor de personaje. |
| `apps/web/src/components/pc` | Hyvento OS: monitor, escritorio, ventanas, apps (Notas, Papelera, Calendario) y el editor TipTap (`editor/`). Se carga recién al prender el PC. |
| `apps/server` | Servidor de juego Colyseus: estado autoritativo, valida movimiento, paredes, asientos, portales, oficinas cerradas y toques de puerta. |
| `packages/shared` | Protocolo (zod), token de juego, `Look` (personaje), reglas de proximidad y de puntos (`points.ts`). |
| `packages/map` | El mundo (`src/world`: niveles, catálogo de muebles, constructor), colisión, A* y el motor pixel (`src/art`, solo lo usa el navegador). |
| `packages/db` | Prisma + Postgres (Neon en producción) y `awardPoints` (movimientos de puntos). |

## Cosas a saber

- **El mundo está definido en código**: los niveles en `packages/map/src/world/areas.ts` (habitaciones, puertas, zonas, muebles, portales, cosas colgadas en las paredes) y los muebles en `world/catalog.ts` (tamaño, colisión, asientos, PC, luz). `getWorld()` los construye; servidor y cliente usan lo mismo.
- **Coordenadas**: el juego usa píxeles de mundo con tiles de 32 (servidor, proximidad, velocidad). El arte usa tiles de 16 (`arte = mundo / 2`, `WORLD_TO_ART`). La vista isométrica es solo proyección en el cliente (`iso/view.ts`).
- **Paredes**: son bordes delgados entre tiles (`wallH`/`wallV`). Las del fondo del edificio (norte y oeste) son altas y llevan ventanas y cuadros; las interiores y las del frente son bajas, para ver todas las salas a la vez. La colisión (`canStandAt`) no deja que los pies crucen un borde con pared y el servidor valida el tramo con `canWalkBetween`.
- **Muebles orientados**: se dibujan mirando a `right` (+x) y, si hace falta, de espaldas (`left`). `down`/`up` son el espejo horizontal (truco isométrico). Un mueble nuevo necesita entrada en el catálogo y dibujo registrado en `DRAW` de `src/art/furniture.ts` (los de la tienda están en `art/decor.ts` y `art/shop.ts`, con piezas comunes en `art/kit.ts`; lo de afuera en `outdoor.ts`). Un test exige que todo tipo del catálogo tenga dibujo.
- **Niveles y portales**: cada jugador tiene `area`. La proximidad solo cuenta dentro del mismo nivel. Para cambiar de nivel el cliente pisa un portal y manda `MSG.travel`; el servidor valida que esté cerca y responde con una corrección que trae el `area` nuevo.
- **Personajes**: chibis dibujados en el navegador (`src/art/chibi.ts`) desde el `Look`; los seis personajes fijos son presets (`HUMANS`). Hoja de caminata 3x4 (`down`, `left`, `right`, `up`) y hoja de sentado de 4 frames.
- **Estilo cozy**: tokens `--color-cozy-*` y clases `cozy-panel`, `cozy-chip`, `cozy-btn` (`cozy-btn-primary`, `cozy-btn-danger`; con `data-on`/`aria-pressed` lleva el recuadro rojo de selección), `cozy-input`, `cozy-kbd`, `cozy-void`, `cozy-scroll` en `apps/web/src/app/globals.css`. Fuente Pixelify Sans (`font-pixel`). Sombras sólidas, esquinas rectas. Colores para Phaser en `src/lib/cozy.ts`. El PC (Hyvento OS) también es cozy.
- **Validación en el servidor**: toda regla de juego (moverse, sentarse, cambiar de nivel, entrar a una oficina) se valida en `apps/server`; el cliente solo la anticipa. Si se agrega una regla, va en los dos lados y con test en `apps/server/test` (los helpers calculan rutas con el A* del mundo).
- **Puntos**: las reglas (cuánto da cada cosa, topes diarios, racha, día de Bogotá) están en `packages/shared/src/points.ts`. El saldo solo cambia con `awardPoints`/`awardPointsTx` (ganar) y `spendPoints`/`spendPointsTx` (gastar, solo si alcanza) de `packages/db`: escriben el movimiento en `PointTransaction`, aplican el tope diario y actualizan `User.points` (caché del saldo). El servidor de juego da los de presencia y reuniones (cada 5 min, solo si hubo actividad y no estás "Ausente"); la web da los del buzón y las misiones y avisa al servidor con `publishPointsChanged` (ruta interna `points-changed`) para refrescar el contador.
- **Objetos interactivos**: el buzón y el tablón del jardín y la barra de la cafetería son puntos del mapa (`mailbox`, `task_board`, `cafe_counter`); al acercarse aparece "E" y se abre su panel (`components/PointsPanels.tsx`, `CafePanel.tsx`). Uno nuevo se agrega en `INTERACTABLES` de `OfficeScene.ts`; si el servidor valida la distancia, con `nearPointOfType`.
- **Tienda e inventario**: la tienda (planta baja, mitad sur) vende solo muebles; el catálogo y los precios están en `packages/shared/src/shop.ts`. La compra (`POST /api/shop/buy`) cobra con `spendPointsTx` y guarda en `InventoryItem` en la misma transacción (`packages/db/src/inventory.ts`). La ropa es toda gratis y se cambia en el vestidor (probador de la tienda) o en "Mi personaje".
- **Casino** (sótano): reglas en `packages/shared/src/casino.ts` (ruleta, blackjack, límite diario). Las mesas viven en el servidor (`apps/server/src/rooms/casino/`): rondas y turnos con el reloj de la sala, el azar con `crypto.randomInt` (los tests lo fijan con `OfficeRoom.rouletteSpin` / `blackjackShuffle`). Toda apuesta pasa por `casinoBetTx` (bloquea la fila del usuario y respeta el límite de pérdidas del día); los premios, por `awardPoints` con motivo `CASINO`. Los ajustes (`CasinoSettings`) se cambian en /admin y llegan al servidor por la ruta interna `casino-settings-changed`.
- **Cafetería**: el menú y los precios están en `packages/shared/src/cafe.ts`; el pedido lo valida y cobra el servidor (`MSG.cafeOrder`) y lo pedido queda en `Player.held` media hora. El arte de los productos está en `packages/map/src/art/items.ts`.
- **Notas**: privadas por persona (API en `apps/web/src/app/api/notes`, siempre filtrando por `userId`). El documento del editor va en `Note.content` (JSON de TipTap) y el texto plano en `body` para buscar.
- **Login local sin Google**: en `pnpm dev`, el login muestra "Entrar de prueba" (nombre y, si quieres, admin): crea o reutiliza `nombre@hyvento.test` y entra. Para varias personas, otra ventana en incógnito con otro nombre. También `pnpm --filter @hyvento/web dev:session "Nombre" [--office office-2] [--admin]` imprime la cookie. Solo funciona fuera de producción, contra la base local y desde localhost (`src/lib/dev-login.ts`).

## Comandos

```bash
pnpm dev                                   # web :3000 + servidor de juego :2567
pnpm typecheck && pnpm test                # lo mismo que corre el CI
pnpm infra:up                              # Postgres y LiveKit en Docker
pnpm --filter @hyvento/db migrate          # aplicar/crear migraciones en la base local
pnpm --filter @hyvento/map render jardin   # dibujar un nivel a PNG para revisar el arte
pnpm --filter @hyvento/web build           # build de producción (como Vercel)
```
