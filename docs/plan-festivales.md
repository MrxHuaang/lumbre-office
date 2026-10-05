# Plan: el calendario del juego y sus festivales

La cabaña tiene su propio calendario, como un juego de granja: el año del juego tiene cuatro estaciones y cada
estación es un "mes" de **21 días del juego** (tres semanas de lunes a domingo). Como un día del juego dura una
hora real (`clock.ts`), una estación dura 21 horas reales y el año unos 3 días y medio: la gente que se conecta
en su jornada ve pasar las estaciones y le toca algún festival casi todos los días, en vez de esperar un
diciembre de verdad en el que estaría ocupada.

Un festival dura un día del juego (una hora real): cambia la cabaña (decoración, NPC que dicen otras cosas, una
tienda con lo de la fecha, un minijuego, encargos propios) y abre y cierra con una cinemática. Son fiestas
colombianas puestas en el calendario del juego, a nuestra manera.

## El calendario (VIR-163)

- `packages/shared/src/calendario.ts`: `DIAS_POR_ESTACION = 21`, `fechaDelJuego(dia)` → año, estación, día de
  la estación (1..21) y día de la semana; sale del día del reloj del juego (`gameTime(...).day`), así que todos
  ven la misma fecha y un `/time` la mueve igual que la hora.
- **El reloj solo corre con gente adentro**: cuando se va el último, el servidor congela la hora y la fecha del
  juego (las guarda en la fila `__reloj__` de `WorldLayout`, como `/time`) y al entrar el primero sigue desde
  ahí. Así una noche o un fin de semana sin nadie no se come días ni festivales. Mientras corre se guarda cada
  tanto, por si el servidor se reinicia (un deploy) sin avisar.
- La estación deja de salir del mes de Bogotá: el clima (solo nieva en invierno), el huerto
  (`seasonGrowth`), la decoración de `game/seasons.ts`, los encargos de temporada (`when.seasons`), el
  espantapájaros, el paisaje del bus, la pantalla de carga y el fondo "La estación" del PC usan la estación
  del juego. Lo que es de la vida real (los días de puntos, rachas, cumpleaños) sigue en Bogotá.
- En el HUD, la placa del reloj dice también la fecha ("Lun 3 de Otoño, año 2") y abre el calendario: la
  estación con sus días, los festivales marcados y los cumpleaños del equipo.
- Cumpleaños: el día del cumpleaños real de cada persona cae también en un día del calendario del juego
  (su "día de la cabaña"), para festejarlo dentro.

## Reglas comunes

- **Sin migraciones**: lo que se gana va a la mochila (`InventoryItem`), los avances a `UserStat`
  (`festival:<id>:<año>:…`) y lo del equipo, en memoria del servidor con respaldo en `UserStat`/`WorldLayout`.
- **Puntos con su tope**: lo del festival paga `LEISURE` (o su propio tope chico); la tienda cobra con
  `spendPoints` (`PURCHASE`). Lo exclusivo del festival vuelve el año siguiente.
- **Lo decorado no estorba**: la decoración temporal no bloquea caminos ni puntos (un test lo revisa por nivel).
- **Todo se puede probar ya**: `/festival <id>` (solo en desarrollo) lo prende sin esperar la fecha.
- **Quien llega tarde no se lo pierde**: si entra con el festival andando, ve una cinemática corta de "llegó
  en plena fiesta" y la de cierre le toca igual.

## El motor (VIR-156)

- `FESTIVALES` en `packages/shared/src/festivales.ts`: id, nombre, estación y día del calendario del juego, decoración por
  nivel (muebles temporales con su catálogo y dibujo, y capas como niebla o faroles), NPC y frases, tienda,
  encargos (`when.festival`) y cinemáticas.
- El servidor sabe cuál corre (`festivalDelDia(dia)`, `state.festival`), con la apertura a las 9:00 del juego
  y el cierre a las 22:00, y avisa al empezar y al terminar; el
  mundo suma la decoración como los cambios del editor de la casa (`worldEdits`), sin tocar el plano.
- En el navegador: el letrero del festival en el HUD, la tienda (panel), el minijuego y las cinemáticas.

## Los festivales

| Estación | Día | Festival | Lo central |
| --- | --- | --- | --- |
| Primavera | 7 | Amor y amistad (VIR-162) | Amigo secreto de la semana: dulces anónimos al buzón; la revelación el día 14 |
| Primavera | 15 | Feria de las flores (VIR-161) | Silletas con flores del huerto, votación y desfile de silleteros |
| Verano | 9 | Festival de cometas | Cometas que se arman y se elevan en el jardín; concurso de la que más sube con el viento |
| Verano | 18 | Carnaval (VIR-160) | Máscaras, desfile de comparsa por el jardín, maicena y serpentinas, concurso de disfraces |
| Otoño | 10 | Feria de la cosecha | Lo mejor del huerto, la granja y el lago en exhibición; premios por categoría |
| Otoño | 21 | Noche de brujas (VIR-157) | Calabazas, niebla, disfraces, dulce o truco por las puertas, laberinto de maíz, la leyenda del sótano |
| Invierno | 7 | Noche de velitas (VIR-158) | Velitas y faroles por todas partes, faroles de deseos en el lago, la medianoche con todos los faroles |
| Invierno | 12–20 | Novenas (VIR-159) | Nueve noches del juego: pesebre que se arma entre todos, villancicos, natilla y buñuelos, aguinaldos |
| Invierno | 21 | Año viejo | Quema del muñeco de año viejo, uvas y maletas a la medianoche, cinemática de año nuevo |

## Novenas (VIR-159)

Hecho: el pesebre del recibidor (una figura por día, la pone el primero con E; capa propia, no decoración),
la novena de las 20:00 del juego con su cinemática por noche, la natilla y los buñuelos de temporada en la
cocina y dos aguinaldos entre dos personas (pajita en boca y sí y no). La decoración navideña (árbol, arco de
luces y corona) quedó como datos (`NOVENAS_DECOR`) para cuando esté la decoración temporal de los festivales.

## Las cinemáticas (VIR-155)

Los festivales las usan para abrir y cerrar (la luna de brujas, los faroles de velitas, el desfile). Es el mismo
motor que la historia (`docs/plan-historia.md`).

## Orden

VIR-155 (cinemáticas) → VIR-163 (calendario) → VIR-156 (motor de festivales) → VIR-157 (Noche de brujas) → el
resto.
