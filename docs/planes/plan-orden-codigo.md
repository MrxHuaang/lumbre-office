# Plan: ordenar el código por carpetas

Estado: **pendiente, no se ha movido nada.** Este documento es solo el plan para hacerlo después, con calma.

## Problema

Varias carpetas de código tienen cientos de archivos sueltos, uno por feature, y cuesta ubicarse:

| Carpeta | Archivos sueltos |
|---|---|
| `packages/shared/src` | ~186 (reglas de cada sistema + tests) |
| `packages/map/src/art` | ~137 (dibujos por feature, `*-tanda3`, tests) |
| `apps/web/src/game` | ~131 (lógica de cada sistema + sonidos + tests) |
| `apps/server/src/rooms` | ~76 (un módulo por sistema; ya algunos son carpetas: `casino/`, `OfficeRoom/`) |
| `packages/map/src/world` | 31 (catálogos `catalog-*.ts`) |
| `apps/web/src/components` | 64 sueltos más 31 carpetas |

El patrón ya existe en parte (`game/carnaval/`, `game/fishing/`, `rooms/casino/`, `world/areas/`, `world/festivales/`, `art/carrozas/`). Falta aplicarlo a todo.

## Idea: una carpeta por sistema, igual en los cuatro paquetes

El mismo sistema usa el mismo nombre en `shared`, `map`, `server` y `web`. Ejemplo `festivales/` agrupa carnaval, cometas, velitas, novenas, brujas, cosecha, feria de las flores, amor y amistad, año viejo y la gente de la fiesta.

Agrupaciones propuestas (coinciden con `docs/referencia/`):

- **festivales/**: `carnaval*`, `cometa*`, `velitas`, `novenas`, `aguinaldos`, `brujas`, `noche-brujas`, `cosecha`, `ahuyama`, `feria-flores`, `silleta`, `amor-amistad`, `ano-viejo`, `gente-fiesta`, `festivales`.
- **historia/**: `historia`, `capitulo2`, `capitulo3`, `encargos`, `oficios`.
- **casas/**: `casa`, `casa-propia`, `casa-arbol`, `casa-fiesta`, `casaPropia`, `casaVisitas`, `casaViva`.
- **lugares/**: `agua` (piscina), `tina`, `taller`, `garaje`, `observatorio`, `podcast`, `escenario`, `club`, `cinema`, `bus`, `granja`, `parrilla`, `pesca*`.
- **casino-y-juegos/**: `casino`, `chess`, `checkers`, `boardgames`, `arcade*`, `pinball-sim`, `hockey`, `tragamonedas`, `garra`, `fortuna`, `chair-race`.
- **personaje/**: `look`, `costumes`, `emotes`, `chibi*`, `mascotas`, `insignias`.
- **comunicacion/**: `comunicacion`, `phone`, `presence`, `proximity`, `voice-link`, `anuncio`, `director`, `permisos`.
- **mundo/** (núcleo): `clock`, `calendario`, `weather`, `estaciones`, `protocol`, `correcciones`, `limite-mensajes`, `reconexion`.

En `packages/map/src/art`, los archivos `*-tanda3`, `jardin-*`, `exterior-*` y `salas-*` se reparten por sistema y los tests viajan con su archivo.

## Cómo hacerlo sin romper nada

1. **Un paquete por PR, una agrupación por commit** (primero `shared`, luego `map`, `server`, `web`). Nunca todo a la vez.
2. **Solo mover, no cambiar lógica.** Con `git mv` para que el historial siga.
3. **Mantener los imports públicos con `index.ts` por carpeta** y re-exportar en el `index.ts` del paquete, así `@hyvento/shared` no cambia para quien lo importa de afuera.
4. Reescribir imports relativos con un script (o `ts-morph`) y correr `pnpm typecheck && pnpm test` después de **cada** agrupación.
5. Hacerlo **con las demás ramas mezcladas y sin PRs abiertos** (los movimientos chocan con cualquier rama que toque esos archivos).
6. Actualizar en el mismo PR las rutas de `CLAUDE.md`, `docs/referencia/`, `docs/planes/` y los comentarios que citan archivos (`git grep` por nombre).
7. Revisar los scripts que apuntan a rutas: `packages/map/scripts` (render, hoja, carrozas), `apps/web/scripts/prerender.ts`, `.github/workflows` y `turbo.json`.

## Riesgos

- Miles de imports que cambian: conflictos con cualquier PR abierto.
- Las rutas de `CLAUDE.md` y `docs/referencia/` (cientos de menciones) quedan viejas si no se actualizan.
- El arte se pre-dibuja en el build (`prerender`): comprobar `pnpm --filter @hyvento/web build` al final.

## Cuándo

Después de una tanda grande de features, con la cola de PRs vacía. Un issue por paquete en Linear, en el proyecto Mantenimiento.
