# Hyvento Office

La cabaña virtual del equipo Hyvento: isométrica, pixel-art estilo Stardew, con oficina propia para cada persona, chat y video por proximidad, salas privadas y pantalla compartida. Todo el arte se genera por código. El plan de salas y fases está en [`docs/plan-cabana.md`](docs/plan-cabana.md).

## Estado

| Fase | Estado |
|---|---|
| 0. Base (monorepo, CI, esquema Prisma, docker-compose, login con Google por invitación) | ✅ |
| 1. Oficina multijugador (mapa, movimiento, chat por proximidad y global) | ✅ |
| 2. Oficinas personales (asignación, placas, cerrar/tocar la puerta, notas, estado y chat persistidos) | ✅ |
| 3. Video/voz por proximidad (LiveKit): suscripción selectiva, permisos en el SFU, pantalla compartida | ✅ |
| Despliegue | ✅ |
| Cabaña 1. Isométrico: jardín, planta baja y piso 2 con portales, motor pixel propio, chibis, HUD cozy | ✅ |
| Cabaña 2. Economía: puntos por presencia y reuniones, buzón con racha diaria, tablón de misiones y ranking semanal | ✅ |
| Cabaña 3–5. Cafetería y tienda, decoración, casino, regalos e intercambios (ver el plan) | Pendiente |

> Las funciones de agentes de IA se retiraron del proyecto; su código quedó archivado en la rama `archivo/agentes-ia`.

## Stack
- **apps/web**: Next.js 15 + Phaser 3 (render isométrico, avatares) + UI React (Tailwind 4, zustand)
- **apps/server**: Colyseus 0.16 (estado multijugador autoritativo)
- **packages/map**: el mundo definido en código (niveles, muebles, zonas, portales), colisión, A* y el motor pixel que dibuja todo
- **packages/shared**: protocolo (zod) y reglas de proximidad
- **packages/db**: Prisma + Postgres

## Requisitos
- Node 22+ y pnpm 10 (`npm i -g pnpm@10`)
- Docker Desktop (Postgres y LiveKit para desarrollo)

## Desarrollo
```bash
pnpm install
pnpm dev            # web en http://localhost:3000 + servidor de juego en ws://localhost:2567
pnpm test           # tests de mapa, proximidad y sala
pnpm typecheck
```
Para probar con varias personas sin Google (solo contra la base local):
```bash
pnpm --filter @hyvento/web dev:session "Tester Uno" [--office office-2] [--admin]
```
Pega el valor impreso en la consola del navegador de otra ventana/perfil: `document.cookie = "authjs.session-token=<valor>; path=/"` y recarga.

### La cabaña y el arte
El mundo está definido en código en `packages/map/src/world` (no hay editor externo):
- `areas.ts`: los niveles (`jardin`, `planta-baja`, `piso-2`) con sus habitaciones, puertas, zonas, muebles, portales y lo que cuelga de las paredes.
- `catalog.ts`: cada mueble (tamaño, si bloquea, asientos, PC, luz de noche).
- `build.ts`: arma la grilla de colisión, las paredes de borde (altas al fondo, bajas adentro), los asientos y las zonas.

El arte lo dibuja el motor pixel de `packages/map/src/art` (rampas de color, cajas isométricas con shaders por cara, contornos y luces). Para ver un nivel sin abrir el juego:
```bash
pnpm --filter @hyvento/map render planta-baja salida.png        # o "noche" como tercer argumento
```

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
pnpm infra:up       # Postgres y LiveKit (dev) con Docker
pnpm --filter @hyvento/db migrate
```

## Despliegue

| Pieza | Servicio |
|---|---|
| Web (Next.js, `apps/web`) | Vercel |
| Servidor de juego (Colyseus, `apps/server`) | Render (`render.yaml`) |
| Base de datos | Neon (Postgres) |
| Audio/video | LiveKit Cloud |

1. Completa `.env.production` (no se sube a git) con Neon y LiveKit.
2. Migraciones: `DATABASE_URL=<cadena sin pooler> pnpm --filter @hyvento/db migrate:deploy`.
3. Render → **New → Blueprint** → este repo. Variables: `DATABASE_URL` (sin pooler) y `GAME_TOKEN_SECRET`.
4. Vercel → **Add New → Project** → este repo, **Root Directory `apps/web`**, y las variables de `.env.production` (con `DATABASE_URL` *pooled* y `NEXT_PUBLIC_GAME_SERVER_URL=wss://<servicio>.onrender.com`).
5. Google Cloud → credencial OAuth: agrega el origen `https://<dominio>.vercel.app` y el redirect `https://<dominio>.vercel.app/api/auth/callback/google`.

El servidor de juego en el plan gratis de Render se duerme tras ~15 min sin uso; el primero en entrar espera ~1 min mientras despierta.
