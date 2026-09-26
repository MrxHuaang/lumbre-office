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
| Casino | Ruleta y blackjack (5 asientos, crupier automático), caja con saldo y **límite diario configurable en `/admin`**, ranking semanal. |
| Arcade | Minijuegos entre amigos (dardos, ajedrez, pong) con apuestas amistosas de puntos. |
| Sala de cine | Sofás frente a una pantalla grande (misma tecnología de pantalla compartida, en plan casual). |

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
   - 3a ✅ **Cafetería**: menú en la barra (tinto, café con leche, aromática, chocolate con queso, pandebono, buñuelo, torta de tres leches; 3 a 12 puntos). Lo pedido se lleva en la mano 30 min y todos lo ven. Solo decorativo. Gastar puntos (`PURCHASE`) nunca deja el saldo en negativo.
   - 3b **Tienda, probador e inventario**: sala nueva en la mitad sur de la cafetería; ropa nueva de pago (lo actual sigue gratis); muebles nuevos; mochila en el HUD.
   - 3c **Editor de oficina**: poner, mover, rotar y quitar muebles de la mochila en tu oficina, y cambiar piso y papel tapiz; lo valida el servidor y se ve en vivo.
4. **Casino**: ruleta, blackjack, caja, límite en `/admin`.
5. **Social y ocio**: regalos, intercambios, huerto, pesca, arcade, sala de cine.

Las fases 2 a 5 traen migraciones de base de datos: se avisan en cada PR y el dueño las aplica en Neon antes de mezclar.
