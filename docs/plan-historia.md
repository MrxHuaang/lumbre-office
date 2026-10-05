# Plan: la historia de la cabaña ("Lo que dejó E.")

La cabaña deja de ser solo una oficina donde uno se conecta a hablar: tiene una historia por capítulos con un
misterio que se resuelve jugando por todo el mundo. El capítulo 1 ("La llegada", `packages/shared/src/historia.ts`)
ya la siembra: Doña Aurora cuenta que el cuidador de antes se fue sin despedirse y, al terminar, llega su carta
firmada "E.": la puertica del cuarto del fondo del sótano está trabada, la llave está "donde se guardan las cosas
que uno quiere que alguien encuentre" y el reloj de pie del recibidor, "cuando vuelva a dar la hora", dirá que
se va por buen camino. Este plan cuenta el resto y el motor para contarlo.

## Reglas comunes

- **Cada quien avanza a su ritmo**: la historia es por persona (banderas en `UserStat`, pasos en
  `QuestProgress` con período `historia`), sin migraciones. Lo que se ve distinto según el avance (el reloj
  que da la hora, la puerta abierta) lo dibuja el navegador de cada uno; las reglas las valida el servidor.
- **Se juega con lo que ya existe**: cada paso sigue un contador (`STAT_KEYS`, prefijos o uno nuevo de
  historia) y manda a usar lo que hay —el molino, el taller, el Man del Sombrero, la pesca de noche, los
  oficios— para que la historia sea la excusa para recorrer la cabaña.
- **Paga poco y fuera del tope** (`STORY_REF_SUFFIX`), como el capítulo 1: lo que se gana de verdad son
  objetos, escenas, cartas, logros y lugares nuevos.
- **Nada se pierde**: los objetos de historia no se tiran, ni se regalan, ni se cambian (`story: true`).
- **Para todo el equipo al final**: el último capítulo junta a todos en un evento.

## El motor (VIR-150)

Lo que necesitan todos los capítulos, genérico para no repetirlo:

1. **Capítulos como datos** (`CAPITULOS` en `historia.ts`): id, título, pasos (encargos `kind: "story"`
   encadenados con `next`), qué lo abre (la bandera del capítulo anterior), su bandera de terminado
   (`story_ch<n>`), su logro y su carta. El capítulo 1 pasa a ser uno más, sin cambiar cómo se juega.
   La sala de los encargos abre el primer paso de un capítulo cuando se cumple lo que lo abre (también a
   quien ya lo tenía cumplido de antes).
2. **Cartas por capítulo**: `lettersFor` las arma de las banderas; el buzón las muestra todas.
3. **Objetos de historia** (`story: true` en `BAG_OBJECTS`): el servidor no deja tirarlos, regalarlos ni
   cambiarlos; ocupan casilla como todo. Un paso puede pedir **entregar** objetos (se sacan de la mochila
   al entregarlo, en la misma validación).
4. **Cinemáticas** (VIR-155, compartido con los festivales y los momentos del juego): secuencias de pasos
   como datos que reproduce el navegador sobre la escena: franjas de cine, fundidos, cámara que se mueve,
   actores (NPC o el jugador) que caminan, miran, hacen emotes y hablan en un cuadro con su retrato, sonidos
   y destellos, y opciones al final. El servidor manda cuál se ve (a una persona o a todo un nivel) y una
   opción solo puede poner las banderas que esa cinemática permite (el servidor revisa que se la haya mandado).
   Se saltan con Esc o clic y con "menos movimiento" quedan en cuadros quietos.
5. **El diario de la historia**: una pestaña "Historia" en la mochila con los capítulos (terminados, el de
   ahora con sus pasos y el que sigue, sin spoilers), el consejo del paso abierto y las cartas para releer.
6. **Puertas por historia** (para el capítulo 4): un portal puede pedir una bandera (`requires`); el servidor
   lo valida en `handleTravel` y en el viaje rápido, y el cliente lo anticipa con un aviso ("Está trabada").

## Los capítulos

### Capítulo 2: "El reloj de pie" (VIR-151)

Lo abre terminar el capítulo 1. Lo da Doña Aurora, que ya leyó la carta por encima del hombro.

1. **El reloj callado**: mirar el reloj de pie del recibidor (E). Escena: está parado en las 3:15 y le faltan
   tres piezas. Aurora: "Él lo tenía siempre andando. Decía que el reloj sabe cosas."
2. **Un engranaje de bronce**: el molino del arroyo lo tiene trabado entre las aspas; sale moliendo una
   mazorca con el paso abierto (`obj:pieza-engranaje`).
3. **Un resorte templado**: en el banco del taller del garaje, con el paso abierto, se templa uno
   (`obj:pieza-resorte`).
4. **Un péndulo**: lo tiene el Man del Sombrero ("de dudosa procedencia"), y solo se lo vende a quien lo
   anda buscando.
5. **Que vuelva a dar la hora**: llevar las tres piezas al reloj (E). Escena: el reloj arranca y da trece
   campanadas (como en el libro "El misterio del reloj de pie"). Desde ahí, para esa persona, el péndulo se
   mueve y suena cada hora del juego. Llega la carta 2, con la pista de la llave.

Logro "Relojero" (raro).

### Capítulo 3: "La llavecita del lago" (VIR-152)

La carta 2 dice que la llave está "donde todo lo que se pierde termina llegando": el lago. Lo abre terminar
el 2 y los pasos se reparten entre quienes saben algo:

1. **El agua que brilla** (Profe Celeste): preguntarle en el observatorio. Escena: mira el cielo y cuenta
   que el lago brilla con la luna alta y el cielo limpio, de 9 de la noche a 3 de la mañana del juego, sin
   lluvia, tormenta ni niebla (`aguaBrilla`), y dice si esa noche brilla.
2. **La carnada de E.** (Don Evelio): se hace el loco ("¿E.? ¿Cuál E.?", el pato); mostrándole la carta
   suelta la receta: masa de mazorca, miel y fresa.
3. **Masa, miel y fresa** (Evelio): cocinarla en la estufa (receta de historia: solo con el paso abierto,
   una sola, no se come).
4. **Lo que el lago guarda** (Evelio): con el agua brillando y la carnada en la mochila, lo que pica es la
   **llavecita oxidada** (sin minijuego; se gasta la carnada). Mientras brilla, el lago titila para quien
   tiene este paso.
5. **La llave de E.** (Doña Aurora): mostrársela. La reconoce y no la recibe: la llave es de quien la
   sacó (abre el capítulo 4).

Llega la carta 3 (la puerta del fondo del sótano, detrás de los baños: el taller de E.) y el logro
"Pescador de secretos".

### Capítulo 4: "El cuarto del fondo" (VIR-153)

Un cuarto nuevo del sótano (detrás de los baños, hacia el sur), con portal que pide la bandera de la llave.
Adentro, el taller de E.: planos, un tablero de corcho con recortes, cajones con páginas de su diario
(coleccionables que se leen en el diario de la historia) y un acertijo con los números del reloj para abrir
el baúl. En el baúl, la carta 3 y una foto vieja de la cabaña con alguien que todos conocen.

### Capítulo 5: "¿Quién es E.?" (VIR-154)

La foto lleva a preguntar por todos lados (Gloria, Evelio, Celeste, el portero: cada uno sabe un pedacito).
La revelación cuadra con lo sembrado (Aurora, el reloj, los pasos del piso 3). El cierre es un evento de todo
el equipo: E. vuelve a la cabaña la noche que la mitad del equipo conectado ya terminó el capítulo, con
escena para todos, y se queda como NPC (con sus propios encargos).

## Después

El motor sirve para lo que viene: amistad con los NPC (escenas a 2, 4 y 6 corazones), restaurar la cabaña
entre todos (las salas que E. dejó a medias) y festivales de temporada.

## Orden

VIR-155 (cinemáticas) y VIR-150 (motor) → VIR-151 (capítulo 2) → VIR-152 → VIR-153 → VIR-154. Cada uno en su
PR, sin migraciones. Los festivales van en `docs/plan-festivales.md`.
