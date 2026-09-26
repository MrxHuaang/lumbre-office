# Bienvenida a Hyvento Office

Esta guía te deja trabajando en el repo en unos 20 minutos. Las convenciones del proyecto (idioma, commits, migraciones, estilo) están en `CLAUDE.md`: léelo una vez; Claude Code también lo lee solo en cada sesión.

## 1. Acceso

- Pídele a Juan José (`poethy`) que te agregue como colaborador en GitHub (`poethy/hyvento-office` es privado).
- Si además quieres entrar a la oficina de producción, pídele que te invite desde `/admin` con tu correo de Google.
- Los secretos de producción (`.env.production`) y las cuentas de Vercel, Render, Neon y LiveKit los maneja él. Para desarrollar no los necesitas.

## 2. Lo que necesitas instalado

- **Node 22 o más nuevo** y **pnpm 10**: `npm i -g pnpm@10`
- **Docker Desktop** (Postgres y LiveKit de desarrollo)
- **Git** con tu cuenta de GitHub
- Opcional: **Claude Code** (con tu propia suscripción) si quieres trabajar con IA como el resto del equipo

## 3. Levantar el proyecto

```bash
git clone https://github.com/poethy/hyvento-office.git
cd hyvento-office
pnpm install
cp .env.example .env
```

Completa tu `.env`:

- `AUTH_SECRET` y `GAME_TOKEN_SECRET`: genera cada uno con
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
- `ADMIN_EMAILS`: tu correo (así entras como admin en tu entorno local).
- `DATABASE_URL` y las variables de LiveKit ya apuntan a Docker: no hay que tocarlas.
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: opcionales, ver el paso 4.

Con Docker Desktop abierto:

```bash
pnpm infra:up
pnpm --filter @hyvento/db migrate
pnpm dev
```

La web queda en http://localhost:3000 y el servidor de juego en `ws://localhost:2567`.

## 4. Entrar a tu oficina local

**Sin Google (lo más rápido):**

```bash
pnpm --filter @hyvento/web dev:session "Tu Nombre" --admin
```

Imprime un valor de sesión. En el navegador, en http://localhost:3000, abre la consola (F12) y pega:

```js
document.cookie = "authjs.session-token=<valor>; path=/"
```

Recarga y entras. Para probar con varias personas, repite con otro nombre en otra ventana o perfil del navegador (sirve `http://127.0.0.1:3000` como segunda "persona").

**Con Google de verdad:** pídele a Juan José que agregue tu correo como usuario de prueba en el proyecto de Google Cloud y que te pase en privado el ID y el secreto del cliente de **desarrollo** para tu `.env`.

## 5. Cómo trabajamos

1. Crea una rama desde `main`: `git switch -c feat/lo-que-hagas`
2. Haz tus cambios. Antes de subir: `pnpm typecheck && pnpm test`
3. Commits en español, estilo `feat: …` / `fix: …`, **sin** `Co-Authored-By` ni atribución a IA.
4. Sube la rama y abre un PR hacia `main`. El CI corre typecheck y tests; Juan José lo revisa.
5. **`main` se despliega solo a producción**: nada llega a `main` sin PR.

**Si tu cambio toca la base de datos** (nueva migración en `packages/db/prisma/migrations`): dilo en el PR. La migración se aplica a producción *antes* de mezclar, y la aplica Juan José. Ojo con el orden de las carpetas de migración: está explicado en `CLAUDE.md`.

## 6. Dónde está cada cosa

- `apps/web`: la web (Next.js + Phaser + React). Pantallas, API y la escena del juego (`src/game`).
- `apps/web/src/components/pc`: el PC de la oficina (Hyvento OS, notas, papelera, calendario).
- `apps/server`: servidor de juego (Colyseus), que valida todo lo que pasa en la oficina.
- `packages/map`: el mundo (niveles, muebles, portales) en `src/world` y el motor pixel que dibuja la cabaña y los personajes en `src/art`.
- `packages/shared`: protocolo entre cliente y servidor.
- `packages/db`: esquema de Prisma y migraciones.

## 7. Problemas comunes

- **"Can't reach database server at localhost:5432"**: Docker Desktop está cerrado. Ábrelo y corre `pnpm infra:up`.
- **Cambié un nivel o un mueble y el servidor de juego se cayó**: `tsx` lo reinicia solo al guardar; si guardaste a medias, vuelve a guardar y recarga la página.
- **Te rebota al login**: la cookie de `dev:session` venció o se borró la base; genera otra.
- **Errores de tipos en `.next/types`** por páginas que ya no existen: borra la carpeta `apps/web/.next/types` y vuelve a correr `pnpm typecheck`.
