# Hyvento Office

Oficina virtual 2D (pixel-art top-down) para el equipo Hyvento: oficinas personales, chat y video por proximidad, y un equipo de agentes de IA que colaboran en tareas de forma visible dentro de la oficina.

## Estado

| Fase | Estado |
|---|---|
| 0. Base (monorepo, CI, esquema Prisma, docker-compose, login con Google por invitación) | ✅ — falta migrar la DB (requiere Docker) |
| 1. Oficina multijugador (mapa, movimiento, chat por proximidad y global) | ✅ |
| 2. Oficinas personales (asignación, tocar la puerta, estados persistidos) | ⏳ aislamiento de chat por zona ya funciona |
| 3. Video/voz por proximidad (LiveKit) | ⏳ |
| 4–6. Agentes de IA | ⏳ |
| 7. Despliegue | ⏳ |

## Stack
- **apps/web**: Next.js 15 + Phaser 3 (mapa, avatares) + UI React (Tailwind 4, zustand)
- **apps/server**: Colyseus 0.16 (estado multijugador autoritativo)
- **packages/map**: mapa Tiled, zonas, colisión y A* compartidos cliente/servidor
- **packages/shared**: protocolo (zod) y reglas de proximidad
- **packages/db**: Prisma + Postgres
- **apps/agents** (Fase 4): worker de agentes (Claude API + BullMQ)

## Requisitos
- Node 22+ y pnpm 10 (`npm i -g pnpm@10`)
- Docker Desktop — necesario desde la Fase 2 (Postgres, Redis, LiveKit)

## Desarrollo
```bash
pnpm install
pnpm dev            # web en http://localhost:3000 + servidor de juego en ws://localhost:2567
pnpm test           # tests de mapa, proximidad y sala
pnpm typecheck
```
Para probar multijugador abre dos pestañas (o una ventana privada) con nombres distintos.

### Mapa y assets
Los assets placeholder (tileset, mapa y personajes) se generan por código:
```bash
pnpm map:generate   # ⚠️ sobrescribe packages/map/assets/office.json
```
El mapa `packages/map/assets/office.json` es un mapa de [Tiled](https://www.mapeditor.org) editable. Capas:
- `floor`, `walls`, `furniture`: tiles; los tiles con la propiedad `collides` bloquean el paso (en `walls`/`furniture`).
- `zones`: rectángulos con `type` (`office`, `meeting`, `lab`, `lounge`) y propiedades `zoneId`, `isolated`, `slot`.
- `points`: `spawn`, `seat`, `agent_desk`, `visitor_spot`, `task_board`.

### Login con Google
1. [Google Cloud Console](https://console.cloud.google.com) → crea un proyecto (p. ej. "Hyvento Office").
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo *Externo* (o *Interno* si usan Google Workspace), nombre de la app y correo de soporte. Mientras esté en modo *Prueba*, agrega los correos del equipo como usuarios de prueba.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**:
   - Orígenes autorizados: `http://localhost:3000`
   - URI de redireccionamiento: `http://localhost:3000/api/auth/callback/google`
4. Copia el ID y el secreto a `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET` en `.env`, y pon tu correo en `ADMIN_EMAILS`.

El acceso es **solo por invitación**: entran los correos de `ADMIN_EMAILS` y los invitados desde `/admin`.
En el primer ingreso cada persona elige su nombre visible y avatar.

### Infraestructura (Fase 2+)
```bash
cp .env.example .env
pnpm infra:up       # Postgres, Redis y LiveKit (dev) con Docker
pnpm --filter @hyvento/db migrate
```
