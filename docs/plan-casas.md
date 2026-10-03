# Plan: la casa de cada persona

> Estado: **03-10, la casa completa ya está (VIR-141)**: tres niveles por persona, más grande que lo
> planeado (sala de fiestas con barra, cuarto de juegos, cuarto de música, cuarto de los amigos), con la cocina
> y la barra funcionando. Sigue el Megabús con la parada "Casa" (VIR-142). Replanteado el 30-09 (VIR-80). La primera entrega (PR #100: calle del barrio con cuatro
> fachadas y una casa de un solo cuarto, a la que se llegaba con `/ir`) se retiró de `main` porque no era
> la idea. Este documento es la versión buena: la que hay que construir. Los sub-issues de Linear están
> reescritos con este orden.

## La idea en una frase

Cada persona tiene **su propia casa, completa y con jardín**, y se llega **en el Megabús**: el bus sale de
la Estación Hyvento, hace **una sola parada, "Casa"**, y ahí todos se bajan en el mismo lugar; pero cada uno
aparece en **su** casa, no en la de los demás.

## Qué estuvo mal en la primera entrega (para no repetirlo)

- **No se llegaba en bus.** Se entraba con `/ir barrio`, que es una herramienta de desarrollo. El viaje en
  el Megabús es el corazón de la idea, no un detalle para después.
- **Una calle con fachadas de mentira.** Cuatro casas dibujadas y una sola puerta que funcionaba: se siente
  como un decorado. No hace falta un barrio: la parada deja a cada quien frente a su casa.
- **Un solo cuarto con la cocina adentro.** Una casa es varias habitaciones separadas por paredes y
  puertas, con afuera (jardín, patio) y con cosas en cada lugar. Un cuarto con una cama, una estufa y el
  medio vacío no es una casa.
- **Calidad visual por debajo del resto de la cabaña.** Todo lo nuevo tiene que verse al nivel de la
  planta baja, el garaje o el observatorio: pisos y papeles propios, luz de noche, cosas colgadas en las
  paredes, nada vacío.

## Cómo se llega: el Megabús con la parada "Casa"

Hoy el bus da una vuelta de 30 s y vuelve a la misma estación, y la pantalla del viaje muestra paradas de
Pereira que no existen en el juego (`BUS_ROUTE_STOPS`). Eso cambia:

- **Dos paradas de verdad y nada más**: "Estación Hyvento" (la del jardín, la que ya existe) y **"Casa"**.
  Se quitan las paradas inventadas de `BUS_ROUTE_STOPS`.
- **Ida.** Desde la Estación Hyvento el bus sale con los que subieron, viaja (con la pantalla del viaje,
  ver abajo) y abre las puertas en la parada "Casa". Todos los que van a bordo se bajan ahí.
- **Todos se bajan en la misma parada, cada uno en su casa.** Al bajarse, el servidor manda a cada persona a
  su instancia: `area` = `casa:<userId>`, parada incluida. Los que viajaban juntos se oyen hasta la puerta
  del bus; al bajarse cada uno queda solo en su casa (la proximidad ya cuenta dentro del mismo `area`).
- **Vuelta.** En la parada de tu casa, E ("Esperar el bus") lo llama: si no viene uno pronto sale uno de
  refuerzo (como `maxWaitMs` de "Llegar en bus"). Se sube, viaja y abre en la Estación Hyvento.
- **Nadie se queda a mitad de camino**: si alguien se desconecta en ruta, al volver aparece en la parada a
  la que iba el bus. Si el servidor reinicia en un viaje, igual.
- **Tiempos**: el viaje de ida y de vuelta dura 15–20 s: lo bastante para que se vea el paisaje y se arme la
  casa, lo bastante corto para no aburrir (constantes en `BUS_TIMINGS`, que los tests acortan).
- **Llegar en bus** (la opción de "Mi personaje") sigue igual: aparece adentro del bus llegando a la Estación
  Hyvento.

## La pantalla del viaje (hoy se ve muy simple)

Hoy es un panel con una raya verde, puntos y un bus chiquito (`components/bus/BusTrip.tsx`). Tiene que
sentirse como ir en el bus:

- **La vista por la ventana**, a pantalla completa y en pixel: el paisaje pasa en capas con parallax
  (montañas y cafetales al fondo, guaduales, postes y casitas en el medio, la baranda del carril y el pasto
  adelante), igual que el camino de la pantalla de carga (`components/entry/scenery.ts`, solo `transform`
  por CSS, así anda aunque Phaser ocupe el hilo).
- **Con el momento del día, el clima y la estación del juego**: de noche las luces de las casitas y los
  postes, con lluvia gotas en el vidrio, en invierno nieve (`seasonOf`, el reloj del juego).
- **El marco del bus** adelante: el borde de la ventana, las barandas verdes y la pantallita de adentro con
  "Próxima parada: Casa" (o "Estación Hyvento" de vuelta) y la barra de lo que falta.
- **Al llegar**: el bus frena (el paisaje se detiene), suena el timbre de parada, la pantallita dice
  "Casa" y el fundido deja ver la parada de tu casa, ya dibujada (la casa se arma mientras dura el viaje, así
  al bajarse no hay espera ni negro).
- **Los que van a bordo**: nombres chiquitos de quienes viajan contigo, para que no se sienta solo.
- **Menos movimiento** (`lessMotion()`): el paisaje quieto y solo el fundido.

## La casa

Una sola casa para todos (la misma plantilla), pero **una instancia por persona**. Tiene que verse completa
y habitada desde el primer día; lo que la persona agregue es encima de eso. Estilo: el de la cabaña y el garaje
(troncos sobre piedra, tejas, madera, `art/exterior-casa.ts`): cálido, nada gris ni oxidado; una casa de
finca paisa.

### Afuera (nivel `casa:<userId>`)

- **La parada "Casa"** al sur: el refugio con banca y el letrero, la vereda y la calle por donde llega el bus
  (como la parada del jardín, `world/areas/parada.ts`, y su calle fuera de lo jugable).
- **Portón y cerca** de madera, con el **buzón con tu nombre**.
- **Antejardín**: sendero de piedra hasta la puerta, faroles, flores y matas.
- **Corredor** delante de la casa: mecedoras, matas colgadas, la puerta de entrada.
- **Jardín de un lado**: árboles frutales, una banca y un huertico (se riega más adelante, VIR-84).
- **Patio de atrás**: asador, mesa de afuera con sillas, hamaca entre dos árboles, tendedero, fogata.
- **Cobertizo** chico de herramientas.
- **Sin bordes**: `playable` y `surroundings: "forest"`, como el jardín, para que alrededor siga el bosque y
  no se vea el fin del mapa.

### Adentro, primer piso (nivel `casa:<userId>:abajo`)

Habitaciones separadas con paredes (`wallH`/`wallV`) y puertas, como la planta baja de la cabaña:

- **Recibidor**: perchero, zapatero, tapete, espejo.
- **Sala**: chimenea encendida, sofá y sillones, mesa de centro, radio, biblioteca, tapete, cuadros.
- **Comedor**: mesa de cuatro con sillas, aparador, lámpara colgada.
- **Cocina aparte**: estufa, nevera, alacena, mesón, lavaplatos, mesa auxiliar (la cocina propia de VIR-83
  la usa después).
- **Baño social**.
- **Escalera** al segundo piso y **puerta de atrás** al patio.

### Adentro, segundo piso (nivel `casa:<userId>:arriba`)

- **Alcoba**: cama doble (la de dormir y pasar la noche, VIR-144), mesitas de noche, armario (VIR-86),
  tocador, ventana.
- **Estudio**: escritorio con el PC de Hyvento OS (el mismo de las oficinas), estante, silla.
- **Cuarto de huéspedes**: cama sencilla y baúl (VIR-87); es a donde llegan las visitas más adelante.
- **Baño** con tina.
- **Balcón** a la vista del jardín.

### Reglas de calidad (para aceptar el PR)

- Ninguna habitación vacía: cada una con sus muebles, una luz y algo en las paredes.
- `pnpm --filter @hyvento/map render` de cada nivel de la casa, de día y de noche, con las imágenes en el
  PR; y capturas en el navegador llegando en el bus.
- Muebles nuevos con entrada en el catálogo y dibujo por código (un test pide que todo tipo tenga dibujo).
- Se prueba con dos personas: bajan juntas del bus, cada una en su casa; ninguna ve ni oye a la otra.

## Técnica

- **Instancia por persona**: `casa:<userId>` (afuera), `casa:<userId>:abajo` y `casa:<userId>:arriba`.
  Las casas no van en `AREAS`: se arman desde la plantilla (`world/areas/casa.ts`) cuando alguien llega,
  en el servidor y en el cliente, y el servidor suelta de la memoria las que quedan vacías.
- **Quién entra**: solo el dueño por ahora. La regla vive en shared (con tests) y la usan todos los caminos
  para cambiar de nivel: portales, bajarse del bus, el viaje rápido (Ctrl+K, también "junto a alguien" que
  está en su casa: ese hueco ya apareció en #100), seguir a alguien y `/ir`. Con las visitas (VIR-81/82) se
  suma el invitado.
- **El bus**: `state.bus` suma en qué parada está (`stop`: `estacion` o `casa`) y hacia dónde va, y cuánto
  dura el viaje, para que el cliente no use la constante. Bajarse en "Casa" lo resuelve el servidor por
  persona (`casa:<userId>`). Los tests fijan tiempos con `OfficeRoom.busTimings`.
- **Logros y diario**: todas las casas cuentan como un solo lugar (`casa-propia`), no una por persona; el
  "Turista" suma uno.
- **Decoración** (VIR-145): la casa viene amueblada; lo que la persona mueva o agregue se guarda como
  diferencia sobre la plantilla, igual que el editor de la casa (`worldEdits.ts`), por persona. Si se usa la
  tabla de las oficinas (`zoneId` = `casa:<userId>`) no hace falta migración.
- **Viaje rápido**: la casa no sale en la lista de destinos: a la casa se llega en bus.

## Orden de trabajo (sub-issues de VIR-80)

1. **VIR-141 — La casa completa** (afuera, abajo y arriba; instancia por persona, solo el dueño entra, arte
   de día y de noche). En desarrollo se llega con `/ir casa`.
2. **VIR-142 — El Megabús con la parada "Casa"** (ida y vuelta, todos se bajan en la misma parada y cada uno
   llega a su casa). Recién con este la casa llega a producción.
3. **VIR-146 — La pantalla del viaje en Megabús** (la vista por la ventana). Puede ir en paralelo con 2.
4. VIR-143 — Botones "Ir a la estación" e "Ir a la cabaña".
5. VIR-144 — Dormir en la cama hace amanecer.
6. VIR-145 — Decorar la casa, con el nombre en el buzón.

Después, las ideas que ya tienen issue: visitas y timbre (VIR-81), abierta o cerrada (VIR-82), cocina propia
(VIR-83), huertico (VIR-84), mascota (VIR-85), armario (VIR-86), baúl (VIR-87), vitrina y cuadros (VIR-88),
ventanas con la luz y el clima (VIR-90) y el bono "descansado" (VIR-91).

## Decisiones

- **30-09 (replanteo)**: se llega solo en Megabús, con una parada "Casa"; todos se bajan en la misma parada
  y cada uno aparece en su casa. No hay barrio con fachadas. La casa es completa desde el primer día (varias
  habitaciones separadas, dos pisos, jardín y patio), no un cuarto.
- **28-09 (siguen)**: visitas como las oficinas (abierta, solo invitados o cerrada; por defecto solo
  invitados); proximidad y video solo con quien esté de visita.
- **Por decidir (dueño)**: las ampliaciones con puntos (VIR-89) ya no son cuartos básicos, porque la casa
  viene completa. Quedarían para extras (invernadero, cuarto de juegos, piscina chica) o se cancelan.
