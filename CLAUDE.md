# Hyvento Office — guía para Claude Code

Oficina virtual 2D (pixel-art) para el equipo Hyvento: mapa multijugador, chat y video por proximidad, oficinas personales, sillas, personajes personalizables y un PC con "Hyvento OS" (notas estilo Notion). Ver `README.md` para el estado y el despliegue, y `ONBOARDING.md` para preparar el entorno.

## Idioma y estilo

- Todo en **español**: UI, comentarios, mensajes de error, commits y PRs. Comentarios cortos que explican el *porqué*, como el código que ya existe.
- Commits en formato convencional en español: `feat: …`, `fix: …`, `chore: …`, `refactor: …`, con un cuerpo breve si hace falta.
- **Nunca** agregar `Co-Authored-By` ni atribución a Claude/IA en commits o PRs.
- No agregar funciones que dependan de APIs de IA de pago: se retiraron a propósito (el código viejo está en la rama `archivo/agentes-ia`).

## Flujo de trabajo

- `main` se despliega solo a producción (Vercel y Render). El dueño del repo (Juan José, `poethy`) hace push directo a `main`; **las demás personas trabajan en una rama y abren un PR**.
- Antes de subir: `pnpm typecheck` y `pnpm test` (el CI corre lo mismo en cada PR).
- Si el cambio se ve en el navegador, probarlo con el servidor de desarrollo (`.claude/launch.json` → `hyvento-dev`). Las pantallas de la oficina piden sesión: para revisar solo la UI sirve una página temporal en `apps/web/src/app/zz-*` con datos falsos, que **se borra antes del commit** (y también `apps/web/.next/types`).

## Migraciones de base de datos (importante)

- Ni Vercel ni Render corren migraciones. Si un cambio agrega o cambia columnas, la migración se aplica a Neon **antes** de que el código llegue a `main`; si no, la app falla al leer usuarios. Solo el dueño la aplica en producción: en el PR, avisar que trae migración.
- Crear migraciones con `pnpm --filter @hyvento/db migrate --name <nombre>` (base local en Docker).
- **Orden de las carpetas**: Prisma las aplica por nombre. Algunas migraciones existentes tienen hora "adelantada" (`20260926180000`, `…190000`, `…200000`). Una migración nueva debe quedar **después** de la última carpeta de `packages/db/prisma/migrations`; si Prisma genera una con fecha anterior, renombrar la carpeta (y revisar que no quede un duplicado).
- Cambios que borran columnas: primero dejar de usarlas y borrarlas en una migración posterior (conviven versiones mientras se despliega).

## Mapa del código

| Carpeta | Qué hay |
|---|---|
| `apps/web` | Next.js 15 + Phaser 3 + React (Tailwind 4, zustand). Login, perfil, oficina, `/admin`, API (`src/app/api`). |
| `apps/web/src/game` | Escena de Phaser (`OfficeScene.ts`), avatares, red (Colyseus), medios (LiveKit), store (zustand). |
| `apps/web/src/components/pc` | Hyvento OS: monitor, escritorio, ventanas, apps (Notas, Papelera, Calendario) y el editor TipTap (`editor/`). Se carga recién al prender el PC. |
| `apps/server` | Servidor de juego Colyseus: estado autoritativo, valida movimiento, asientos, oficinas cerradas y toques de puerta. |
| `packages/shared` | Protocolo (zod), token de juego, `Look` (personaje) y reglas de proximidad. |
| `packages/map` | Mapa Tiled, zonas, colisión, A*, asientos; dibujo de tiles y personajes por código. |
| `packages/db` | Prisma + Postgres (Neon en producción). |

## Cosas a saber

- **Mapa y assets**: `packages/map/assets/office.json` y los PNG se generan con `pnpm map:generate` (desde `scripts/generate.ts` y `scripts/tiles.ts`). Regenerar **sobrescribe** `office.json`. Propiedades de tiles: `collides` (bloquea el paso), `seat` (`up`/`down`, se puede sentar) y `computer` (escritorio con PC). La web copia los assets a `public/assets` al arrancar `pnpm dev`: después de regenerar, reiniciar el dev.
- **Personajes**: se dibujan en `packages/map/src/character.ts`, que corre en Node (los seis personajes fijos) y en el navegador (los personalizados). Los seis fijos deben seguir **idénticos píxel a píxel**: después de cambiar el dibujo, `pnpm map:generate` no debería modificar sus PNG.
- **Estilo RISO**: tokens `--color-riso-*` y clases `riso-panel`, `riso-chip`, `riso-pill`, `riso-press`, `riso-input`, `riso-cta`, `riso-grain` en `apps/web/src/app/globals.css`. Fuentes Archivo (titulares, `font-display`) e IBM Plex Mono (`font-plex`) con next/font. Sombras sólidas, nunca difuminadas. Los colores para Phaser salen de `src/lib/riso.ts`.
- **Validación en el servidor**: toda regla de juego (moverse, sentarse, entrar a una oficina) se valida en `apps/server`; el cliente solo la anticipa. Si se agrega una regla, va en los dos lados y con test en `apps/server/test`.
- **Notas**: privadas por persona (API en `apps/web/src/app/api/notes`, siempre filtrando por `userId`). El documento del editor va en `Note.content` (JSON de TipTap) y el texto plano en `body` para buscar.
- **Login local sin Google**: `pnpm --filter @hyvento/web dev:session "Nombre" [--office office-2] [--admin]` crea un usuario de prueba y da la cookie de sesión (solo contra la base local).

## Comandos

```bash
pnpm dev                          # web :3000 + servidor de juego :2567
pnpm typecheck && pnpm test       # lo mismo que corre el CI
pnpm infra:up                     # Postgres y LiveKit en Docker
pnpm --filter @hyvento/db migrate # aplicar/crear migraciones en la base local
pnpm map:generate                 # regenerar mapa, tileset y personajes
pnpm --filter @hyvento/web build  # build de producción (como Vercel)
```
