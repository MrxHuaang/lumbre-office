# Plan de estructuras nuevas del jardín

Cuando el dueño diga **"crea las estructuras"**, se construyen **todas** las de este documento. Cada una lleva: dibujo por código, catálogo, ubicación, lo que hace, cómo se usa, qué valida el servidor y sus tests. Sin migraciones salvo que se diga lo contrario, y sin APIs de IA de pago.

## Reglas comunes (para todas)

- **Una rama por estructura** (`feat/estructura-<nombre>`) desde `feat/rediseno-integracion`, con commits en español y sin atribución (ver `CLAUDE.md`). Se pueden hacer en paralelo con agentes en worktrees aparte y unificarlas al final. Los choques van a estar en `jardin.ts`, `catalog*.ts`, el registro de `DRAW` y `INTERACTABLES`.
- **Estética**: la de la cabaña, rústica y cálida (madera, piedra, tejas rojizas, luz cálida de noche) y con apenas un toque de uso. Nada gris industrial ni muy abandonado: fue lo que se corrigió en el garaje. Revisar de día y de noche con `pnpm --filter @hyvento/map render jardin salida.png [noche]` y **mirar** el PNG antes de dar algo por listo.
- **Espacio**: el jardín jugable (64x56) está bastante lleno. Si no alcanza, agrandar `PW`/`PH` en `jardin.ts` hacia el sur o el oeste (y mover la cerca y el portón) antes que apretar. Lo que queda **detrás** de un edificio alto (al norte y al oeste en pantalla) se tapa: respetar el test de oclusión del jardín y no dejar lugares donde alguien quede escondido.
- **Interacción**: un objeto que se usa es un punto del mapa con "E" (`INTERACTABLES` en `OfficeScene.ts` + un panel en `components/`) o un usable de `packages/shared/src/casa.ts`. Si da algo o cambia estado, lo valida el servidor (`nearPointOfType`, regla en `apps/server` y test en `apps/server/test`). El cliente solo lo anticipa.
- **Puntos**: siempre con `awardPoints` y motivo `LEISURE`, que ya tiene tope diario (40). No agregar motivos nuevos al enum `PointReason`, porque eso sí sería una migración.
- **Salas de conversación**: una zona `isolated: true` (como la fogata y la glorieta del jardín) hace que solo se oigan quienes están adentro. Una sala para pocas personas o que se cierra con llave es una zona `office`/`meeting` o un nivel aparte con portal (como el garaje).
- **Sonidos y ambiente**: por código, como el resto (pasos por piso, clima, sonido de portal).
- **Al terminar cada una**: `pnpm typecheck`, `pnpm test` y `pnpm --filter @hyvento/web build` (el pre-render tiene que incluir todo lo nuevo). Actualizar `CLAUDE.md` y `docs/plan-rediseno.md`, y si corresponde el logro "Turista" (`TOURIST_AREAS`) y la portada.

---

## 1. Escenario al aire libre (anfiteatro)

- **Idea**: el lugar para reuniones de todo el equipo, demos, anuncios y cumpleaños. Hoy no hay dónde hablarle a 15 personas a la vez.
- **Ubicación**: al sur, entre la fogata y la glorieta, mirando al norte.
- **Arte**: tarima de madera con techito a dos aguas, telón de tela y guirnaldas de luces cálidas. Gradas de tablas en semicírculo (3 filas, con asientos), faroles a los costados y un atril con micrófono.
- **Qué hace**:
  - Quien se para en la tarima (punto `stage`, "E · Subir al escenario") **habla y comparte pantalla para todos los que están en las gradas y en la tarima**, aunque estén lejos. Es una regla de proximidad especial en `packages/shared/src/proximity.ts`, con test.
  - En las gradas se oye al que está en la tarima y a los vecinos de asiento, bajito.
  - Una pantalla grande detrás de la tarima muestra la pantalla compartida (reutilizar lo del cine si sirve).
  - Botón "Aplaudir" (emote colectivo) y "Levantar la mano" (se ve sobre la cabeza y queda en una fila de turnos que ve quien está en la tarima).
- **Servidor**: máximo 2 personas en la tarima. Valida la posición para dar el "micrófono de escenario".

## 2. Casa del árbol

- **Idea**: salas chicas para reuniones de uno a uno o para concentrarse, sin agrandar la casa.
- **Ubicación**: en el huerto de frutales del suroeste, con un árbol grande que se vea bien desde lejos.
- **Arte**: tronco grueso con una cabañita de tablas arriba, techo de tejas, ventanita con luz de noche, escalera de cuerda y un balde con polea. Faroles colgados en las ramas.
- **Qué hace**:
  - La escalera es un portal ("E · Subir") a un nivel interior chico `casa-arbol`: un cuarto de madera con cojines, mesita, una ventana al jardín y una hamaca.
  - Es una zona aislada para 3 personas como máximo.
  - "**Subir la escalera**" (botón adentro) la cierra: nadie más sube hasta que se baje o se vacíe, con una llave como las de las oficinas. Desde abajo se ve la escalera recogida y el cartel "Ocupado".
  - Opcional: modo foco (temporizador pomodoro visible para los de adentro).
- **Servidor**: cupo y cierre validados al usar el portal, con tests de cupo, de cierre y de que se abra sola al vaciarse.

## 3. Tina caliente / sauna de barril

- **Idea**: el rincón para conversar al terminar el día.
- **Ubicación**: en la orilla este del lago, con deck de madera.
- **Arte**: tinaja redonda de madera con vapor animado y agua que se mueve, sauna de barril al lado con chimenea humeando, toallas colgadas, banca, farolitos de noche y el reflejo en el lago.
- **Qué hace**:
  - "E · Meterse a la tina": el personaje se sienta adentro, con un dibujo de medio cuerpo en el agua y un sprite de "sentado en el agua".
  - "E · Entrar a la sauna": se sienta en la banca de adentro y le sale vapor.
  - Es una zona aislada (charla privada).
  - Descanso: cada 5 min adentro da puntos `LEISURE` (con el tope diario) y un logro "Relajado".
  - Al salir, el personaje queda "mojado" un rato (gotitas), como `Player.held` de la cafetería.
- **Servidor**: asientos de la tina como asientos del catálogo. Los puntos solo si hubo actividad reciente, como la presencia.

## 4. Parrilla / horno de barro

- **Idea**: cocinar en grupo con lo que se cosecha en el huerto.
- **Ubicación**: junto al patio de piedra al este de la casa, cerca de las mesas y la pérgola.
- **Arte**: horno de barro abovedado con fuego visible, parrilla de ladrillo con humo, leña apilada, mesa de preparación con tabla y cuchillo, y una pizarra con "El menú de hoy".
- **Qué hace**:
  - "E · Cocinar": se elige una receta (arepa asada, pizza al horno, chorizo, mazorca, pan de bono) que usa ingredientes del inventario (cosechas del huerto de `huerto.ts` y cosas de la cafetería).
  - Tarda un rato con una barra de progreso sobre el horno, y si hay 2 o más cocinando juntos, sale más rápido.
  - La comida queda en `held` y se puede **compartir**: quien está cerca y hace "E" toma una porción.
- **Servidor**: valida los ingredientes (se descuentan del inventario en la misma transacción), los tiempos y las porciones. Mirar primero lo que hace la rama `feat/estaciones-cocina` para no duplicar.

## 5. Gallinero con establo chico

- **Idea**: una rutina diaria tierna que trae a la gente al jardín.
- **Ubicación**: al oeste, cerca del huerto y del cobertizo.
- **Arte**: gallinero de tablas con techo rojizo y rampita, cerca de palos, 3 o 4 gallinas que caminan solas (como las mascotas), un corral con una cabra o un burro, bebedero y saco de maíz.
- **Qué hace**:
  - "E · Dar de comer" (una vez al día por persona, compartido): las gallinas corren al comedero.
  - "E · Buscar huevos": cada día hay N huevos en el nido para el primero que llega.
  - Los huevos van al inventario y son ingrediente de la parrilla o la cafetería.
  - Racha diaria de "cuidar los animales" con puntos `LEISURE`.
  - Los animales tienen nombre, y el equipo puede votar los nombres en un panel.
- **Servidor**: estado diario (comida y huevos del día de Bogotá) en el servidor de juego. Ver cómo guarda el huerto su estado; si hace falta tabla nueva, **avisar al dueño antes** (sería migración).

## 6. Observatorio (estilo Outer Wilds)

- **Idea**: inspirado en el observatorio y la aldea de Timber Hearth de *Outer Wilds*: rústico, hecho a mano, de madera y piedra, lleno de curiosidad. **Arte original**, sin copiar sus imágenes, logos ni textos.
- **Ubicación**: en un rincón alto (una lomita de piedra al noreste o al noroeste, fuera de la sombra de la casa), con un sendero de piedras que sube.
- **Arte**:
  - Torre de piedra con cúpula de madera que se abre de noche.
  - Un telescopio grande de latón y madera asomando por la cúpula.
  - Afuera, una **fogata con troncos para asar malvaviscos**, banderines, un cohete de madera de juguete en una plataforma de lanzamiento y postes con cables.
  - Adentro (nivel interior `observatorio`, dos pisos en uno):
    - un **modelo del sistema solar que gira** (orrery mecánico con planetas en brazos, animado);
    - vitrinas con piedras y "fósiles" de planetas;
    - mapas estelares en la pared y un mural;
    - un radar de señales y una escalera de caracol a la cúpula.
- **Qué hace**:
  - **Telescopio** ("E · Mirar"): de noche abre una vista del cielo con constelaciones dibujadas por código y nombres inventados por el equipo. Hay una estrella fugaz cada tanto: quien la ve primero gana un logro. De día dice "Vuelve de noche".
  - **Radar de señales** (inspirado en el *signalscope*): se apunta a una dirección y se oye más fuerte la música o la radio de lo que haya en esa dirección del mapa (la radio de la cocina, el club, alguien tocando el piano). Sirve para encontrar a la gente, con una flechita hacia quien suena.
  - **Fogata de malvaviscos**: minijuego de asar, "E" para meterlo al fuego y "E" para sacarlo a tiempo; si se pasa, se quema. Da puntos `LEISURE` chicos.
  - **Orrery**: "E" para ver la hora del día y el clima de la cabaña en forma de planetas.
  - **Diario de exploración**: las cosas "descubiertas" (entrar a cada nivel, ver la estrella fugaz, pescar algo raro) se marcan en un panel estilo bitácora. Se puede enganchar a los logros.
- **Servidor**: la estrella fugaz la decide el servidor (hora y posición, con `crypto.randomInt`, fijable en tests como la ruleta), y el primero en mirarla gana. El minijuego del malvavisco se valida por tiempos, con tope.

## 7. Cabina de grabación / podcast

- **Idea**: grabar anuncios o conversaciones del equipo y saber cuándo alguien está "en el aire".
- **Ubicación**: una cabañita chica cerca del escenario (comparten el tema "medios").
- **Arte**: cabaña de madera con paneles acústicos de tela adentro, dos micrófonos con brazo, audífonos, un cartel luminoso **"EN EL AIRE"** en la puerta que se prende en rojo, y alfombra.
- **Qué hace**:
  - Es una zona aislada para 3 personas.
  - "E · Grabar" empieza a grabar el audio de los de adentro en el navegador (MediaRecorder sobre las pistas de LiveKit, **solo con el permiso de todos los de adentro**, que tienen que aceptar) y al terminar baja un archivo.
  - Mientras graba, el cartel de afuera se prende para todos y la puerta no deja entrar.
- **Servidor**: el estado "grabando" y el consentimiento de cada persona los lleva el servidor. No se guarda audio en el servidor.

## 8. Parada del bus (basada en el Megabús de Pereira)

- **Idea**: llegar a la cabaña como quien llega a la oficina en bus, con vida en el borde del mapa.
- **Ubicación**: afuera del portón sur, en una calle que cruza el borde del jardín de este a oeste. Se puede ampliar el área jugable hacia el sur para la calle.
- **Arte**:
  - Una **estación en el estilo del Megabús**: plataforma elevada con techo, puertas de vidrio al nivel del piso del bus, torniquetes y un letrero con el nombre de la estación ("Estación Hyvento").
  - Un **bus articulado largo** en los colores del Megabús. **Confirmar con fotos** los colores y la librea antes de dibujar, sin logos oficiales. Tiene que doblarse en el articulado, con ventanas iluminadas de noche.
  - Carril exclusivo pintado en la calle.
  - Una pantalla en la estación con "Próximo bus: 2 min".
- **Qué hace**:
  - **Pasa un bus cada X minutos** (configurable; por defecto cada 3 min en horario laboral y cada 10 de noche). Frena en la estación, abre puertas, espera unos segundos y sigue, con sonido de frenos, puertas y motor. Lo decide el servidor y lo ven todos iguales.
  - **Llegar en bus**: quien entra a la cabaña puede aparecer bajando del bus en vez de en el punto de aparición de siempre (animación de bajarse). Es opcional en "Mi personaje".
  - **Irse en bus**: "E · Tomar el bus" en la estación lo sube, y el bus se lo lleva. Sirve para salir de la sesión o ponerse "Ausente" con estilo.
  - Tarjeta del bus: el "pasaje" puede ser gratis o de 1 punto (decidir con el dueño).
- **Servidor**: horario de buses en el servidor de juego (reloj de la sala), con estado sincronizado (posición del bus, puertas abiertas) y tests del horario con reloj falso.

## 9. Molino de agua

- **Idea**: vida y sonido en el mapa. Casi solo ambiente.
- **Ubicación**: en un arroyo que baja al lago, que hay que agregar (un río angosto con puentecito de madera).
- **Arte**: molino de piedra y madera con rueda que gira animada, agua que cae, puentecito y juncos.
- **Qué hace**:
  - La rueda gira más rápido cuando llueve (clima del servidor).
  - "E · Moler": se muele maíz del gallinero o del huerto y sale harina, un ingrediente para la parrilla (arepas).
  - Sonido de agua que se oye al acercarse.

## 10. Piscina detrás de la cabaña

- **Idea**: la zona de verano de la casa, para los días despejados.
- **Ubicación**: "atrás" de la cabaña, pero **visible**. Justo al norte de la casa el dibujo la tapa entera, así que hay que buscar el lado noreste (entre la casa y el patio, al fondo) o correr la piscina un poco al este para que se vea. Si no alcanza el espacio, abrir terreno hacia el norte o el este.
- **Arte**: piscina de piedra con agua turquesa animada y reflejos, deck de madera alrededor, reposeras, sombrillas, un trampolín, flotadores (dona, flamingo), ducha de jardín, toallas y luces bajo el agua de noche.
- **Qué hace**:
  - "E · Meterse" y el personaje nada: se mueve por el agua con un sprite de nado (medio cuerpo). Se puede caminar dentro del agua más lento.
  - "E · Tirarse del trampolín": animación de salto y chapuzón con salpicadura que ven todos.
  - Las reposeras son asientos para tomar el sol, que dan puntos `LEISURE` con tope, solo con el clima despejado.
  - Con lluvia o tormenta se vacía (el servidor saca a la gente del agua y la deja en el deck) y se tapa con lona.
  - Al salir, el personaje queda "mojado" un rato, igual que con la tina.
- **Servidor**: el agua es una zona donde se puede estar solo en "modo nado" (validación de movimiento aparte). La salida por lluvia y los puntos del sol, con tests.

---

## Orden sugerido

1. Escenario, casa del árbol y parada del bus (lo que más usa el equipo).
2. Piscina, tina/sauna y observatorio.
3. Parrilla, gallinero y molino (se conectan entre sí por los ingredientes: conviene hacerlas juntas).
4. Cabina de podcast.

## Preguntas para el dueño antes de empezar

- Pasaje del bus: ¿gratis o de 1 punto? ¿Cada cuántos minutos pasa?
- ¿Se puede agrandar el jardín hacia el sur (para la calle del bus) y hacia el norte o el este (para la piscina)?
- ¿La grabación de la cabina de podcast se permite? Graba voces: consentimiento explícito de todos los que están adentro.
- Gallinero: si el estado diario necesita una tabla nueva, trae migración.
