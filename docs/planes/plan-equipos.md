# Plan: Lumbre para cualquier equipo

> Estado: **idea documentada, no se desarrolla todavía.** Hoy Lumbre es la cabaña de Hyvento (un solo
> mundo); este documento plantea cómo abrirla para que cualquier equipo cree el suyo.

## La idea en una frase

Un equipo entra a Lumbre, **crea su mundo** (su cabaña), le pone el nombre del equipo (que sale en el
letrero de la casa y en el HUD) e invita a su gente. Cada equipo tiene su mundo aislado: sus personas,
sus puntos, su chat, su decoración.

## Flujo de un equipo nuevo

1. **Registro**: alguien entra con Google (Supabase Auth, como hoy) y elige "Crear un equipo".
2. **Nombre del equipo** (y un subdominio o slug: `lumbre.app/mi-equipo`). El nombre sale:
   - en el **letrero de la cabaña** del jardín (hoy dice "Hyvento" en el arte);
   - en el **HUD** (hoy el menú dice "Hyvento");
   - en la estación del bus ("Estación <equipo>"), en el título de la pestaña y en los correos.
3. **Invitar**: enlace de invitación o por correo (ya existen las invitaciones y `ADMIN_EMAILS`; pasarían a
   ser por equipo). Quien crea el equipo es su admin.
4. **Entrar**: cada persona entra a la cabaña de su equipo. Alguien puede estar en varios equipos y elegir
   a cuál entra.

## Qué cambia por dentro

| Hoy (un mundo) | Con equipos |
|---|---|
| Un `OfficeRoom` de Colyseus para todos | Una sala por equipo (`roomId` = id del equipo) |
| `User` pertenece a Hyvento | Tabla `Team` + `TeamMember` (rol: admin, miembro, invitado) |
| Puntos, logros, fotos, notas, casino, mochila globales | Filtrados por equipo (`teamId` en las tablas que lo necesitan) |
| `WorldLayout` (editor de la casa) único | Uno por equipo |
| Oficinas fijas (`office-1`…`office-5`) | Se asignan por equipo; si el equipo crece, más oficinas |
| Letrero y HUD con "Hyvento" en el código | Nombre del equipo desde la base (el letrero se dibuja con el texto, como los neones: letras 3x5 de `art/room.ts`) |
| Admins por `ADMIN_EMAILS` | Admins por equipo en la base |
| LiveKit: una sala `hyvento-office` | Una sala por equipo |

**Migraciones**: grandes (agregar `teamId` a muchas tablas). Plan seguro: crear `Team` y `TeamMember`,
crear el equipo "Hyvento" y asignarle todo lo existente, y recién después hacer obligatorio el `teamId`
(columnas nuevas primero, borrar lo viejo en una migración posterior, como pide CLAUDE.md).

## Lo que hay que decidir antes

- **Negocio**: ¿gratis, freemium o pago? Vercel Hobby no permite uso comercial (hay que pasar a Pro), y
  LiveKit y Render tienen límites que un producto público supera rápido (ver `docs/despliegue.md`).
  Recomendación: un plan gratis con tope de personas (p. ej. 10) y uno pago para equipos más grandes.
- **Qué se personaliza**: nombre y logo pixel (¿subido o elegido de una lista?; CLAUDE.md pide arte por
  código, así que mejor un "escudo" armado con colores e íconos), colores del letrero, y quizá qué
  estructuras tiene el jardín (activar o apagar el casino, el Man del Sombrero, etc.).
- **Contenido "de adultos"**: el casino, el bar, la borrachera y la mercancía del Man del Sombrero son
  bromas internas de Hyvento. Para equipos externos conviene que sean **opcionales**, apagados por
  defecto y activables por el admin del equipo.
- **Privacidad y datos**: cada equipo ve solo lo suyo; política de privacidad y términos (ya hay una
  página de privacidad por el login de Google); borrar un equipo borra sus datos.
- **Idioma**: hoy todo está en español colombiano. ¿Se abre solo a hispanohablantes o se prepara i18n?

## Orden sugerido

1. `Team` + `TeamMember` y migrar Hyvento como primer equipo (sin cambio visible).
2. Nombre del equipo en letrero, HUD, estación y títulos (lee de la base).
3. Sala de Colyseus y de LiveKit por equipo; aislar puntos, chat y datos por `teamId`.
4. Crear equipo e invitar desde la web (onboarding).
5. Opciones del admin (qué estructuras se ven, contenido opcional).
6. Planes y límites (si se cobra).
