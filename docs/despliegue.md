# Desplegar Lumbre gratis

Lumbre tiene cinco piezas, y cada una tiene un plan gratis que alcanza para un equipo chico:

| Pieza | Dónde | Plan gratis | Qué hay que saber |
|---|---|---|---|
| Web (Next.js, `apps/web`) | **Vercel** | Hobby | Es gratis para uso personal o no comercial. Si Lumbre se vende, hay que pasar a Pro. |
| Servidor de juego (Colyseus, `apps/server`) | **Render** | Free web service | Se duerme a los ~15 min sin uso y el primero que entra espera ~1 min. Se puede evitar (ver el paso 5). |
| Login (identidad) | **Supabase Auth** | Free | Solo da la identidad (Google). Los usuarios, roles e invitaciones siguen en Neon. |
| Base de datos (Postgres) | **Neon** | Free | 0,5 GB: sobra para usuarios, notas, puntos y decoración. |
| Audio y video | **LiveKit Cloud** | Build (gratis) | Trae minutos de participante al mes. Sin LiveKit la cabaña funciona igual, sin voz ni cámara. |

El cliente OAuth de Google Cloud también es gratis. No hace falta tarjeta en Vercel, Render, Neon ni Supabase.

En estos pasos el dominio es `https://lumbre.hyvento.co`; cámbialo si usas otro.

## 0. Antes de empezar

- El código está en GitHub (el repo privado `MrxHuaang/lumbre`). Vercel y Render se conectan a GitHub y despliegan solos con cada push a `main`.
- Genera un secreto largo. Guárdalo: se usa en Vercel y en Render.
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```
  Es **`GAME_TOKEN_SECRET`**. Tiene que ser **el mismo** en Vercel y en Render. (Ya no hay `AUTH_SECRET`: la sesión la firma Supabase.)

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

## 2. Login: Supabase Auth + Google

Supabase solo da la identidad. Al volver de Google, la web (`/auth/callback`) revisa que el correo esté en `ADMIN_EMAILS`, tenga invitación o ya sea usuario, y crea o actualiza el usuario **en Neon** (se enlazan por correo).

### 2a. Supabase

1. En [supabase.com](https://supabase.com) crea un proyecto (región `us-east-1`). No uses su base de datos: con Auth basta.
2. **Project Settings → API**: copia la **Project URL** (`https://<ref>.supabase.co`) y la llave **anon** (pública). Son `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. La llave `service_role` **no** se usa: no la pongas en ningún lado.
3. **Authentication → URL Configuration**:
   - **Site URL**: `https://lumbre.hyvento.co`
   - **Redirect URLs**: `https://lumbre.hyvento.co/auth/callback` y `http://localhost:3000/auth/callback`. Si quieres probar las previews de Vercel, agrega también `https://*-<tu-equipo>.vercel.app/auth/callback`.
4. **Authentication → Sign In / Providers → Google**: actívalo y pega el Client ID y el secret del paso 2b. Copia la **Callback URL** que muestra ahí (`https://<ref>.supabase.co/auth/v1/callback`).
5. (Recomendado) **Authentication → Sign In / Providers → Email**: desactívalo, para que nadie cree cuentas con correo y contraseña. De todos modos la web solo deja entrar a invitados.

### 2b. Google Cloud

1. En [console.cloud.google.com](https://console.cloud.google.com), crea un proyecto y entra a **APIs y servicios → Pantalla de consentimiento OAuth**. Elige tipo *Externo*, pon el nombre "Lumbre" y agrega tu correo.
2. En **Credenciales → Crear credenciales → ID de cliente OAuth**, elige *Aplicación web*:
   - **Orígenes autorizados de JavaScript**: `https://lumbre.hyvento.co` (y `http://localhost:3000` para desarrollo).
   - **URI de redirección autorizados**: **solo** la de Supabase, `https://<ref>.supabase.co/auth/v1/callback`. Google vuelve a Supabase, y Supabase a la web.
3. Pega el **ID de cliente** y el **secreto** en Supabase (paso 2a.4). No van en Vercel.

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
   | `NEXT_PUBLIC_SUPABASE_URL` | La Project URL de Supabase (paso 2a) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La llave anon de Supabase (paso 2a) |
   | `NEXT_PUBLIC_SITE_URL` | `https://lumbre.hyvento.co` |
   | `ADMIN_EMAILS` | Tu correo (y el de otros admins, separados por coma) |
   | `GAME_TOKEN_SECRET` | El mismo que en Render |
   | `NEXT_PUBLIC_GAME_SERVER_URL` | `wss://hyvento-game.onrender.com` |
   | `GAME_SERVER_HTTP_URL` | `https://hyvento-game.onrender.com` |
   | `LIVEKIT_URL` / `LIVEKIT_PUBLIC_URL` | La URL de LiveKit Cloud (`wss://…livekit.cloud`) |
   | `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Los del paso 3 |

4. **Deploy**. En **Settings → Domains** conecta `lumbre.hyvento.co` y confirma que coincide con la Site URL y los Redirect URLs de Supabase (paso 2a.3).

Las variables `NEXT_PUBLIC_*` se meten en el build: si las cambias, vuelve a desplegar.

**No pongas** `HYVENTO_DEV_TOOLS` en producción: es solo para desarrollo, y de todos modos se apaga fuera de desarrollo.

## 7. Probar

1. Abre `https://lumbre.hyvento.co/login` y entra con Google, con el correo que pusiste en `ADMIN_EMAILS`.
2. La primera vez, el servidor de juego puede tardar ~1 min en despertar si no usaste el paso 5.
3. Desde el menú → **Administrar equipo**, invita al resto por correo.

## 8. (Opcional) Avisos de GitHub en el chat

Cuando se mezcla un PR, la cabaña lo anuncia en el chat global como aviso del sistema ("GitHub: juanjo mezcló el PR #42 «…» en lumbre a main."). Es un webhook de GitHub, gratis: no hace falta ninguna app ni servicio aparte.

1. Genera un secreto para el webhook (distinto de `GAME_TOKEN_SECRET`):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. En Vercel → **Settings → Environment Variables** agrega:

   | Variable | Valor |
   |---|---|
   | `GITHUB_WEBHOOK_SECRET` | El secreto del paso anterior |
   | `GITHUB_WEBHOOK_EVENTS` | (Opcional) `merged` (por defecto) o `opened,merged` para avisar también cuando se abre un PR (o sale de borrador) |

   Vuelve a desplegar para que la web las lea. El aviso llega al servidor de juego por la ruta interna `/internal/system-notice` con `GAME_TOKEN_SECRET`, así que Render no necesita nada nuevo.
3. En GitHub, en el repo → **Settings → Webhooks → Add webhook**:
   - **Payload URL**: `https://lumbre.hyvento.co/api/github/webhook`
   - **Content type**: `application/json`
   - **Secret**: el mismo `GITHUB_WEBHOOK_SECRET`
   - **Which events?** → *Let me select individual events* → marca solo **Pull requests**.
4. Al guardar, GitHub manda un *ping*: en **Recent Deliveries** tiene que aparecer con respuesta `200`. Si sale `401`, el secreto no coincide; si sale `503`, falta la variable en Vercel.

Los avisos no se guardan en la base: quedan en el historial del chat mientras el servidor de juego está prendido. Si el servidor está dormido (Render gratis), el aviso de ese momento se pierde.

## Cada vez que cambies algo

- **Push a `main`**: Vercel y Render despliegan solos.
- **Si el cambio trae una migración** (una carpeta nueva en `packages/db/prisma/migrations`), primero aplícala en Neon con el comando del paso 1 y después sube el código.
- Si algo falla, los logs están en Vercel (**Deployments → Functions**) y en Render (**Logs**).

## Dominio propio (opcional)

Vercel conecta un dominio propio gratis (tú pagas solo el dominio, unos USD 10 al año). Si lo cambias, actualiza la Site URL y los Redirect URLs de Supabase, el origen de Google y `NEXT_PUBLIC_SITE_URL`.

## Si el login falla

- Vuelve a `/login?error=AccessDenied`: el correo no está en `ADMIN_EMAILS` ni tiene invitación.
- `error=Configuration`: faltan `NEXT_PUBLIC_SUPABASE_*` en Vercel (o no se volvió a desplegar).
- Supabase muestra "redirect_to is not allowed" o te deja en la Site URL: falta `https://lumbre.hyvento.co/auth/callback` en Redirect URLs.
- Google dice `redirect_uri_mismatch`: la URI de redirección de Google tiene que ser la de Supabase (`…supabase.co/auth/v1/callback`), no la de la web.
