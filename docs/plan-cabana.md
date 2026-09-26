# Plan: la cabaña Hyvento (isométrica, estilo cozy)

La oficina pasa de un mapa cenital único a una **cabaña isométrica pixel-art estilo Stardew** con varios niveles. Todo el arte se sigue generando por código (sin assets comprados). Regla de diseño: **cada sala existe porque sostiene una función**; si la función aún no está hecha, la sala tampoco se construye.

## Niveles y salas

Se cambia de nivel por puertas y escaleras con un fundido a negro (como Stardew). Cada nivel es su propio mapa.

### Exterior · jardín
| Sala | Función |
|---|---|
| Camino y porche | Punto de aparición. La puerta lleva a la planta baja. |
| Buzón | Llegan regalos y pedidos de la tienda. Recompensa diaria por racha de días. |
| Tablón | Anuncios del equipo y misiones (tareas que dan puntos al cumplirlas). Reemplaza el tablero decorativo actual. |
| Huerto compartido | Plantas que crecen con las horas de presencia del equipo; se cosechan por puntos. |
| Estanque de pesca | Minijuego de pesca; los peces se venden por puntos. Se puede pescar mientras hablas. |

### Planta baja · vida social
| Sala | Función |
|---|---|
| Recibidor | Solo de paso: escaleras y tablero de quién está y en qué estado. |
| Cafetería | Barra con menú (se compra con puntos) y mesas: **cada mesa es una burbuja de audio privada**. Reemplaza la "zona común". |
| Sala de reuniones | La actual: aislada, pantalla compartida en la pared, sillas. |
| Tienda y probador | Catálogo de muebles y ropa; el probador reemplaza el diálogo de editar personaje. |

### Piso 2 · trabajo
| Sala | Función |
|---|---|
| 4 oficinas personales | Las de hoy (`office-1..4`, se conservan los ids), ahora de 8x9 tiles, dos a cada lado del pasillo: escritorio con PC, estantería, zona de estar para visitas y espacio libre para decorar. Puerta con cerradura y tocar la puerta. Decorables con el editor. |
| Pasillo | Llega la escalera; placas con el nombre de cada dueño junto a cada puerta. |

### Sótano · ocio
| Sala | Función |
|---|---|
| Casino | Ruleta y blackjack (5 asientos, crupier automático), caja con saldo y **límite diario configurable en `/admin`**, ranking semanal. Tragamonedas bajo letreros de neón, mesa de póker, fuente de monedas, rueda de la fortuna y un rincón de sofás. |
| Club | Pista de baile de colores, barra con estante de botellas, cabina de DJ con parlantes, sofás de terciopelo y la tarima con el tubo (E para bailar). Audio aislado. |
| Sala de cine | Pantalla con telón en la pared oeste, 16 butacas, proyector y crispetas. Audio aislado. En la fase 5, video sincronizado en la pantalla. |
| Arcade | Minijuegos entre amigos (dardos, ajedrez, pong) con apuestas amistosas de puntos. |

Se elimina el **coworking**.

## Economía de puntos

- **Se ganan**: presencia activa (con detección de AFK y tope diario), misiones del tablón, asistencia a reuniones, racha diaria, cosecha y pesca.
- **Se gastan**: cafetería, tienda (muebles y ropa), casino, arcade.
- **Se comparten**: regalos (llegan al buzón) e intercambios con confirmación de ambos lados.
- Los puntos no se compran ni se canjean por dinero.
- Todo movimiento de puntos lo decide el servidor y queda en un libro (`PointTransaction`); el saldo es la suma (con caché en `User.points`).

Valores de la fase 2 (en `packages/shared/src/points.ts`; el día se corta a medianoche de Bogotá):

| Cómo | Cuánto | Tope diario |
|---|---|---|
| Presencia activa (hubo actividad en los últimos 5 min y no estás "Ausente") | 1 cada 5 min | 96 (8 horas) |
| Estar en una reunión con al menos otra persona | +1 cada 5 min | 24 (2 horas) |
| Buzón (recompensa diaria) | 10 + 5 por día de racha (máx. 7 días → 40) | una vez |
| Misión aprobada | La recompensa que puso quien la publicó (5 a 50; admins hasta 500) | — |

Misiones: cualquiera publica; otra persona la toma, la entrega y quien la publicó (o un admin) la aprueba y se pagan los puntos. Por ahora la recompensa sale "del banco" (no se descuenta a quien publica).

## Arquitectura

- **Motor pixel propio** (`packages/map`): rampas de color, rasterizador isométrico de cajas con shaders por cara, contornos, tramado y luces. Cada mueble es una función.
- **Áreas**: cada nivel es un mapa generado por código. Una sola sala de Colyseus; cada jugador tiene `area`. El chat global y la lista de conectados no cambian; la proximidad solo cuenta dentro de la misma área.
- **Muebles como objetos** (`tipo, x, y, rotación`) en vez de tiles: es el mismo formato que guardará el editor de oficina.
- **El servidor casi no cambia**: grilla, A*, zonas y proximidad son iguales; isométrico es solo cómo se dibuja.
- **Personajes chibi** por capas (piel, pelo, ropa, accesorios) en 4 direcciones diagonales. Reemplazan a los seis personajes fijos (hay que acordarlo: hoy `CLAUDE.md` pide que sigan idénticos).

## Fases

1. ✅ **Migración**: motor a `packages/map`, render isométrico, áreas con transiciones, exterior básico, planta baja (recibidor, cafetería con mesas privadas, reuniones), piso 2 con 4 oficinas grandes, HUD cozy, chibis. Todo lo que ya funciona sigue funcionando (sillas, puertas, PC, video, pantalla compartida).
2. ✅ **Economía base**: puntos por presencia y reuniones, tablón de misiones, buzón con racha, ranking semanal.
3. **Compras y decoración**, en tres partes:
   - 3a ✅ **Cafetería**: menú en la barra (tinto, café con leche, aromática, chocolate con queso, Coca-Cola, pandebono, buñuelo, torta de tres leches, cigarro y los combos "Desayuno": tinto o Coca-Cola con cigarro; 3 a 12 puntos). Lo pedido se lleva en la mano 30 min (los combos, uno en cada mano) y todos lo ven. Solo decorativo. Gastar puntos (`PURCHASE`) nunca deja el saldo en negativo.
   - 3b ✅ **Tienda, vestidor e inventario**: la planta baja queda con la cafetería al norte y la tienda al sur (mostrador, estantes, percheros y probador). La tienda vende 27 muebles (18 nuevos; con los de la tienda son 22 dibujos nuevos, todos por código); lo comprado va a la mochila (HUD). La ropa es **toda gratis**: peinados, accesorios y conjuntos nuevos, y el probador es un vestidor.
   - 3c **Editor de oficina**: poner, mover, rotar y quitar muebles de la mochila en tu oficina, y cambiar piso y papel tapiz; lo valida el servidor y se ve en vivo.
4. ✅ **Casino** (sótano, se baja por la escalera del recibidor):
   - **Ruleta europea** con rondas compartidas (20 s para apostar, gira y paga); plenos, columnas, docenas, rojo/negro, par/impar y mitades.
   - **Blackjack** de 5 asientos (las banquetas de la mesa), sabot de 6 mazos, crupier automático que se planta en 17, blackjack 3:2, doblar; sin seguro ni división.
   - **Caja**: saldo, cómo vas hoy, el límite y el ranking semanal por ganancia neta. **Límite diario de pérdidas** configurable en `/admin` (150 por defecto; cuenta las apuestas abiertas), y se puede cerrar el casino.
   - El sótano tiene tres salas: el **casino** (tragamonedas de adorno, póker, fuente, rueda de la fortuna), el **club** (barra, DJ y el escenario con tubo, E para bailar) y el **cine** (pantalla con telón y butacas).
5. **Social y ocio**: regalos, intercambios, huerto, pesca, arcade y el video del cine.

Las fases 2 a 5 traen migraciones de base de datos: se avisan en cada PR y el dueño las aplica en Neon antes de mezclar.

## Extras (se suman entre fases)

Cosas chicas que le dan vida a la cabaña. Se hacen cuando no chocan con la fase en curso.

| Extra | Qué es | Estado |
|---|---|---|
| Creador de personajes | Mucho más personalizable, estilo Terraria / Guilty Gear: color por parte (piel, ojos, pelo, camisa, pantalón, zapatos, accesorios), muchos peinados, ojos, vello facial, prendas por capas y accesorios por lugar (cabeza, cara, cuello). Todo gratis. | Pendiente (sigue después de la 3b) |
| Emotes | T (o el botón de la barra) abre el selector; 1–7 manda saludo, corazón, jaja, ¡bien!, idea, ¿qué? o bailar. Globo sobre la cabeza; lo ven los del mismo nivel. | ✅ |
| Apps del PC | Enfoque (pomodoro que te pone "Ocupado"), Buscaminas y un navegador de favoritos (abre adentro lo que se deja incrustar: YouTube, Figma, Excalidraw, Wikipedia…; lo demás en otra pestaña). | En curso |
| Pintura | App del PC para dibujar pixel art de 16x16 que se guarda como un cuadro para colgar en tu oficina (usa el editor de la fase 3c). | Pendiente |
| Tocadiscos compartido | Pones un video o una playlist y todos en tu oficina lo escuchan sincronizado (con el tocadiscos de la tienda). | Pendiente |
| Pizarra | Excalidraw en tiempo real, también en la pared de la sala de reuniones. | Pendiente |
| Sonidos cozy | Pasos, puertas, caja registradora y música ambiente generados por código (WebAudio), sin archivos. | Pendiente |
| Clima y estaciones | Lluvia, otoño, nieve en diciembre, y la noche según la hora de Bogotá. | Pendiente |
| Mascota | Un gato o un perro que te sigue (se compra en la tienda). | Pendiente |
| Standup diario | En el tablón, cada persona escribe qué hará hoy; da un bono pequeño de puntos. | Pendiente |
| Logros | Insignias que se ven en tu placa (primera misión, racha de 30 días…). | Pendiente |
| Avisos de GitHub | Un webhook anuncia en el tablón o el chat cuando se mezcla un PR. | Pendiente |

## A futuro: Hyvento para cualquier equipo (fase 6)

Por ahora la cabaña es solo para el equipo Hyvento. Más adelante la idea es abrirla: que cualquiera cree su equipo y tenga su propia cabaña. Lo que hay que cambiar, porque hoy todo asume un solo equipo:

1. **Equipos en la base**: `Team` (nombre, slug, color, límite del casino…) y `Membership` (persona, equipo, rol dueño/admin/miembro). Todo lo que es "del equipo" lleva `teamId`: oficinas (`Office.zoneId` deja de ser único global), puntos (un saldo por equipo), misiones, chat, inventario, casino. Hoy los admins salen de `ADMIN_EMAILS`: pasan a ser un rol de la membresía.
2. **Registro abierto**: "Crear mi equipo" → nombre y cuántas oficinas → invitar con un link. URL por equipo (`/t/<equipo>`).
3. **Una sala de juego por equipo**: el token del juego lleva `teamId`; Colyseus abre una sala por equipo (hoy hay una sola, `ROOM_NAME`), y tests de aislamiento para que ningún equipo vea nada de otro.
4. **Cabaña a la medida**: el piso de oficinas se genera según cuántos son (un piso por cada 4 oficinas).
5. **Costos y límites**: lo caro es el video (LiveKit cobra por minuto conectado); el resto cabe en planes gratis al principio. Límite de minutos o personas por equipo en el plan gratis.
6. **Lo de un producto público**: página de inicio, términos y privacidad, borrar cuenta y equipo.

Recomendación: cuando se cierre la fase 3, agregar `teamId` a la base aunque siga habiendo un solo equipo (cada fase nueva suma tablas y migrarlas todas después cuesta más). Abrir el registro puede esperar.
