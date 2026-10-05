# Plan: festivales de temporada

Un festival por temporada cambia la cabaña unos días: decoración, NPC que dicen otras cosas, una tienda con
lo de la fecha, un minijuego, encargos propios y una cinemática de apertura y cierre para todos. Son fechas
de Colombia, con el calendario de Bogotá, para que el equipo tenga algo que esperar durante todo el año.

## Reglas comunes

- **Sin migraciones**: lo que se gana va a la mochila (`InventoryItem`), los avances a `UserStat`
  (`festival:<id>:<año>:…`) y lo del equipo, en memoria del servidor con respaldo en `UserStat`/`WorldLayout`.
- **Puntos con su tope**: lo del festival paga `LEISURE` (o su propio tope chico); la tienda cobra con
  `spendPoints` (`PURCHASE`). Lo exclusivo del festival vuelve el año siguiente.
- **Lo decorado no estorba**: la decoración temporal no bloquea caminos ni puntos (un test lo revisa por nivel).
- **Todo se puede probar ya**: `/festival <id>` (solo en desarrollo) lo prende sin esperar la fecha.

## El motor (VIR-156)

- `FESTIVALES` en `packages/shared/src/festivales.ts`: id, nombre, fechas (con días de previa), decoración por
  nivel (muebles temporales con su catálogo y dibujo, y capas como niebla o faroles), NPC y frases, tienda,
  encargos (`when.festival`) y cinemáticas.
- El servidor sabe cuál corre (`festivalAt(fecha)`, `state.festival`) y avisa al empezar y al terminar; el
  mundo suma la decoración como los cambios del editor de la casa (`worldEdits`), sin tocar el plano.
- En el navegador: el letrero del festival en el HUD, la tienda (panel), el minijuego y las cinemáticas.

## Los festivales

| Festival | Fechas | Lo central |
| --- | --- | --- |
| Noche de brujas (VIR-157) | 24–31 oct | Calabazas, niebla, disfraces, dulce o truco por las puertas, laberinto de maíz con la calabaza dorada, la leyenda del sótano |
| Noche de velitas (VIR-158) | 7–8 dic | Velitas y faroles por todas partes, faroles de deseos en el lago, la medianoche con todos los faroles subiendo |
| Novenas (VIR-159) | 16–24 dic | Pesebre que se arma entre todos, villancicos, natilla y buñuelos, aguinaldos como minijuegos |
| Carnaval (VIR-160) | fin de feb | Máscaras, desfile de comparsa por el jardín, maicena y serpentinas, concurso de disfraces |
| Feria de las flores (VIR-161) | 1.ª semana de ago | Silletas con flores del huerto, votación y desfile de silleteros |
| Amor y amistad (VIR-162) | sept | Amigo secreto, dulces anónimos al buzón, la revelación |

## Las cinemáticas (VIR-155)

Los festivales las usan para abrir y cerrar (la luna de brujas, los faroles de velitas, el desfile). Es el mismo
motor que la historia (`docs/plan-historia.md`).

## Orden

VIR-155 (cinemáticas) → VIR-156 (motor) → VIR-157 (Noche de brujas, la que cae primero) → el resto según la fecha.
