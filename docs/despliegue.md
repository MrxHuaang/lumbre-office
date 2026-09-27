# Desplegar Lumbre gratis

Lumbre tiene cuatro piezas, y cada una tiene un plan gratis que alcanza para un equipo chico:

| Pieza | Dónde | Plan gratis | Qué hay que saber |
|---|---|---|---|
| Web (Next.js, `apps/web`) | **Vercel** | Hobby | Es gratis para uso personal o no comercial. Si Lumbre se vende, hay que pasar a Pro. |
| Servidor de juego (Colyseus, `apps/server`) | **Render** | Free web service | Se duerme a los ~15 min sin uso y el primero que entra espera ~1 min. Se puede evitar (ver el paso 5). |
| Base de datos (Postgres) | **Neon** | Free | 0,5 GB: sobra para usuarios, notas, puntos y decoración. |
| Audio y video | **LiveKit Cloud** | Build (gratis) | Trae minutos de participante al mes. Sin LiveKit la cabaña funciona igual, sin voz ni cámara. |

El login con Google (Google Cloud) también es gratis. No hace falta tarjeta en Vercel, Render ni Neon.

## 0. Antes de empezar

- El código está en GitHub (el repo privado `MrxHuaang/lumbre`). Vercel y Render se conectan a GitHub y despliegan solos con cada push a `main`.
- Genera dos secretos largos. Guárdalos: se usan en varios lugares.
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```
  - El primero es **`AUTH_SECRET`** (sesiones de la web).
  - El segundo es **`GAME_TOKEN_SECRET`**. Tiene que ser **el mismo** en Vercel y en Render.

## 1. Base de datos: Neon

1. Entra a [neon.tech](https://neon.tech) con GitHub y crea un proyecto (región: `us-east-1`, cerca de Render Virginia).
2. En **Connection details** copia dos URLs:
   - **Pooled** (la que dice `-pooler` en el host): para Vercel.
   - **Direct** (sin `-pooler`): para Render y para las migraciones.
3. Aplica las migraciones desde tu computador, con la URL **directa**:
   ```bash
   DATABASE_URL="postgresql://…(directa)…?sslmode=require" pnpm --filter @hyvento/db exec prisma migrate deploy
   ```
   Repite este paso **cada vez** que llegue una migración nueva y **antes** de que el código llegue a `main`. Ni Vercel ni Render corren migraciones.

## 2. Login con Google

1. En [console.cloud.google.com](https://console.cloud.google.com), crea un proyecto y entra a **APIs y servicios → Pantalla de consentimiento OAuth**. Elige tipo *Externo*, pon el nombre "Lumbre" y agrega tu correo.
2. En **Credenciales → Crear credenciales → ID de cliente OAuth**, elige *Aplicación web*:
   - **Orígenes autorizados**: `https://<tu-proyecto>.vercel.app`
   - **URI de redirección**: `https://<tu-proyecto>.vercel.app/api/auth/callback/google`
3. Guarda el **ID de cliente** (`AUTH_GOOGLE_ID`) y el **secreto** (`AUTH_GOOGLE_SECRET`).

Hasta que publiques la app en la pantalla de consentimiento, solo entran los correos que agregues como usuarios de prueba. Para un equipo alcanza así.

## 3. Audio y video: LiveKit Cloud (opcional)

1. Entra a [cloud.livekit.io](https://cloud.livekit.io) y crea un proyecto.
2. En **Settings → Keys** crea una llave. Guarda la **URL** del proyecto (`wss://<algo>.livekit.cloud`), la **API Key** y el **API Secret**.

## 4. Servidor de juego: Render

1. Entra a [render.com](https://render.com) con GitHub → **New → Blueprint** → elige el repo. Render lee `render.yaml` y crea el servicio `hyvento-game` en el plan gratis.
2. Te va a pedir estas variables:
   - `DATABASE_URL`: la URL **directa** de Neon.
   - `GAME_TOKEN_SECRET`: el segundo secreto del paso 0.
3. Cuando termine, anota la dirección del servicio, por ejemplo `https://hyvento-game.onrender.com`. Entra a `https://hyvento-game.onrender.com/health`: tiene que responder.

## 5. (Opcional) Que el servidor de juego no se duerma

El plan gratis de Render trae 750 horas al mes: alcanza para tener **un** servicio prendido todo el mes. Para que no se duerma:

1. Crea una cuenta gratis en [uptimerobot.com](https://uptimerobot.com).
2. Agrega un monitor **HTTP(s)** a `https://hyvento-game.onrender.com/health` cada **5 minutos**.

Otra opción gratis y siempre prendida es una máquina virtual *Always Free* de **Oracle Cloud**: más potente, pero hay que instalar Node y un proxy con HTTPS a mano. Conviene si el equipo crece.

## 6. Web: Vercel

1. Entra a [vercel.com](https://vercel.com) con GitHub → **Add New → Project** → elige el repo.
2. **Root Directory**: `apps/web`. Vercel detecta Next.js y pnpm solo.
3. Agrega las variables de entorno:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | La URL **pooled** de Neon |
   | `AUTH_SECRET` | El primer secreto del paso 0 |
   | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Las del paso 2 |
   | `ADMIN_EMAILS` | Tu correo (y el de otros admins, separados por coma) |
   | `GAME_TOKEN_SECRET` | El mismo que en Render |
   | `NEXT_PUBLIC_GAME_SERVER_URL` | `wss://hyvento-game.onrender.com` |
   | `GAME_SERVER_HTTP_URL` | `https://hyvento-game.onrender.com` |
   | `LIVEKIT_URL` / `LIVEKIT_PUBLIC_URL` | La URL de LiveKit Cloud (`wss://…livekit.cloud`) |
   | `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Los del paso 3 |

4. **Deploy**. Con la URL final (`https://<tu-proyecto>.vercel.app`), vuelve a Google Cloud y confirma que el origen y la redirección del paso 2 son esa URL exacta.

**No pongas** `HYVENTO_DEV_TOOLS` en producción: es solo para desarrollo, y de todos modos se apaga fuera de desarrollo.

## 7. Probar

1. Abre la URL de Vercel y entra con Google, con el correo que pusiste en `ADMIN_EMAILS`.
2. La primera vez, el servidor de juego puede tardar ~1 min en despertar si no usaste el paso 5.
3. Desde el menú → **Administrar equipo**, invita al resto por correo.

## Cada vez que cambies algo

- **Push a `main`**: Vercel y Render despliegan solos.
- **Si el cambio trae una migración** (una carpeta nueva en `packages/db/prisma/migrations`), primero aplícala en Neon con el comando del paso 1 y después sube el código.
- Si algo falla, los logs están en Vercel (**Deployments → Functions**) y en Render (**Logs**).

## Dominio propio (opcional)

Vercel conecta un dominio propio gratis (tú pagas solo el dominio, unos USD 10 al año). Si lo cambias, actualiza el origen y la redirección de Google.
