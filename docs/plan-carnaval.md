# Carnaval de Negros y Blancos en la cabaña (VIR-160)

Concepto del Carnaval del día 18 del verano, inspirado en el de Pasto (patrimonio de la UNESCO desde 2009). Don Evelio es pastuso, así que él es el abanderado. El desfile va por **la calle del Megabús**, frente a la Estación Hyvento, con música andina hecha por código.

## Respeto cultural (decisiones)

- El contraste blanco y negro se ve en **trajes, máscaras, banderines, confeti y carrozas**. **Nunca se oscurece la piel de un avatar.** En Pasto, el Día de Negros recuerda la petición de un día de libertad para las personas esclavizadas. Pintar caras en un juego se presta a malas lecturas, así que se nombra con respeto en la cinemática de apertura, sin imitarlo.
- El "talco" (Día de Blancos) es el juego de la maicena: deja la cara empolvada de blanco un rato. Va solo entre quienes lo aceptan: no se le echa a nadie en "No molestar" y hay una opción para no recibir.
- Las carrozas cuentan historias de la cabaña y del sur andino (paisaje, oficios, mitos). No hay caricaturas de pueblos ni personas reales.
- Los grupos son ficticios, inspirados en las modalidades reales del carnaval: carrozas, comparsas, murgas, colectivos coreográficos y disfraz individual.

## 1. Carrozas (10)

Cada carroza es papel maché blanco y negro con **un solo color de acento**. Son muebles grandes que mueve el servidor por el carril, como el bus, y se dibujan por código con piezas que se mueven: alas, péndulo, humo.

| # | Carroza | Qué se ve | Acento | Guiño |
|---|---|---|---|---|
| 1 | **La Familia Castañeda llega** | Una carreta vieja con baúles, una abuela con sombrilla y un loro de papel | Sepia | La tradición del 4 de enero: la familia viajera que llega a la fiesta |
| 2 | **El Cóndor de los Andes** | Un cóndor de 3 tiles con collar blanco y alas que suben y bajan | Oro | El cóndor ya es negro y blanco |
| 3 | **El Galeras que fuma** | Un volcán con nieve en la punta y humo blanco en espiral; cuyes de papel en la falda | Naranja brasa | El volcán de Pasto |
| 4 | **El Tablero vivo** | Un piso de ajedrez con piezas gigantes que se mueven en cada parada | Rojo | La sala de juegos del piso 3 |
| 5 | **El Reloj de E.** | Un reloj de pie enorme con péndulo y engranajes que giran; suenan trece campanadas al pasar | Bronce | Capítulo 2 de la historia |
| 6 | **La Luna en el lago** | Una media luna sobre olas, con peces de escamas brillantes y una llavecita colgando | Azul noche | Capítulo 3 |
| 7 | **El Páramo** | Frailejones, colibríes en resortes y una laguna de vidrio | Verde musgo | El agua nace en el páramo |
| 8 | **La Minga de la cosecha** | Papa, maíz, quinua y guaguas de pan gigantes sobre un tejido de colores | Multicolor (tejido andino) | Lo que se cosecha en el huerto |
| 9 | **El tinto de Doña Aurora** | Un pocillo gigante que echa vapor y una cafetera que sirve sola | Café | La casera de la cabaña |
| 10 | **El Megabús de la alegría** | El bus de la parada pintado a cuadros, con cachivaches encima | Verde lima | Cierra el desfile; detrás va la comparsa de los jugadores |

**Estado**: las diez están hechas (VIR-160 y VIR-166), en este orden dentro del desfile (`CARROZA_IDS`). Lo que se mueve en las cuatro últimas: en el Tablero, el caballo salta en L, la reina negra se desliza en diagonal y un peón avanza; en la Luna, las olas corren, los peces saltan con las escamas brillando por turnos y la llavecita oxidada se mece (de noche la luna se prende con su halo); en el Páramo, los colibríes se mecen en sus resortes con las alas borrosas, los frailejones se mecen y la laguna de vidrio destella; en la Minga, la quinua se mece, la mazorca de colores gira y las guaguas de pan se arrullan. Para que la fila más larga siga cabiendo en unos 2 minutos, el desfile va un poco más rápido (2,6 tiles por segundo).

## 2. Coreografías (en 8 tiempos, con las acciones del juego)

Cada comparsa camina con su carroza. Al llegar a una parada del recorrido repite su frase:

1. **Castañeda**: paso de paseo (caminar despacio en pareja), *saludar* a los dos lados, *girar* juntos y seguir. Es teatro: la abuela se desmaya con un *temblar* y la levantan.
2. **Cóndor**: dos filas abren los brazos (*bailar*) al ritmo de las alas. En el tiempo 8, todos *saltar*.
3. **Galeras**: un círculo alrededor del volcán, *temblar* cuando "erupciona" (sale humo) y lluvia de confeti blanco.
4. **Tablero**: los bailarines son peones en cuadrícula; avanzan 1 tile, 2 *girar*, y la reina cruza en diagonal (*correr*). Al final vuelven a su casilla y hacen la venia (*asentir*).
5. **Reloj**: fila de "engranajes" que *girar* en sentidos alternos; al sonar la campanada, quietos y *asentir*.
6. **Luna**: ola en cadena: cada bailarín hace *saltar* medio tiempo después del de al lado (ida y vuelta), se mecen (*bailar*) y una ola de *girar*.
7. **Páramo**: los colibríes corren en zigzag delante de la carroza (*walk* con `run` y `path`), una fila a contratiempo de la otra; *girar* allá y vuelven en zigzag.
8. **Minga**: ronda tomada de la mano (cada uno pasa por el puesto de los demás), *bailar* y *celebrar* al ofrecer la cosecha al público (se arriman hacia la vereda y *saludar*).
9. **Aurora**: Doña Aurora *saludar* desde arriba; las meseras reparten "tinto" (burbujas) y hacen *asentir*.
10. **Comparsa de la cabaña**: la de los jugadores. Se suman con E junto al Megabús y repiten *bailar* · *girar* · *saltar* · *celebrar* en bucle. Si son 3 o más, la cámara de quien baila se acerca un paso (y vuelve al salirse).

## 3. Música (toda sintetizada por código, sin grabaciones)

La paleta de sonido es **quena** (seno con soplo), **zampoña** (dos voces), **charango** (pulsado brillante), **bombo** y **cascabeles**, por el mezclador (`sfxOut("musica")`).

- **"La Guaneña"**: tradicional nariñense, bambuco del siglo XIX (de dominio público). Es el himno del carnaval: suena en la apertura y cuando pasa la carroza del Galeras. Basta un arreglo corto de la melodía: el del juego sigue la versión para flauta de las escuelas ("do mi la la la la, do' la sol sol sol sol, la sol mi la sol mi re do" y el cierre "do mi la do' la sol..."), en Mi menor y en 3, de Sol4 a Sol5 (lo que da una quena en Sol), con las frases que entran a contratiempo y la dominante antes de volver a empezar; dura unos 12 segundos por vuelta.
- **"Sanjuanito del lago"**: original, en ritmo de sanjuanito (2/4, alegre). Es la marcha del desfile.
- **"Pasacalle del Megabús"**: original, un pasacalle de banda. Acompaña a la comparsa de los jugadores.
- **"Albazo de la madrugada"**: original. Suena en la premiación del concurso de disfraces.
- *Para escuchar, sin reproducir en el juego*: "El cóndor pasa" (Daniel Alomía Robles, 1913) y "Llorando se fue" (Los Kjarkas, 1981), como referencia del timbre de quena y charango.

Cada carroza lleva la melodía a su paso: el volumen baja con la distancia, como la radio. Solo suena con alguien en el nivel.

## 4. Recorrido (la calle del Megabús)

El desfile va por el carril exclusivo, del oeste al este. Mientras pasa, **el bus no sale**: la sala suspende `BusLine` y el bus de refuerzo espera. Se ve desde la vereda y la plataforma.

1. **Salida (borde oeste, entre el bosque)**: las carrozas aparecen desde el bosque de `surroundings`, una cada ~6 s.
2. **Palco del jurado (frente a la Estación Hyvento)**: es la parada principal. Cada comparsa hace su coreografía completa y el techo de la estación sirve de palco. Ahí está la tarima con Don Evelio de abanderado.
3. **Frente al portón del jardín**: segunda parada. Quien está en la vereda se suma a la comparsa de la cabaña (E).
4. **Llegada (borde este)**: las carrozas se pierden en el bosque, lluvia final de confeti y cinemática de cierre para quienes bailaron.

Sale a las 11:00, 15:00 y 19:00 del juego (de noche las carrozas se prenden con faroles). Dura unos 2 minutos reales.

## 5. La decoración (VIR-176)

El carnaval de Pasto es de colores intensos y de día ("Negros y Blancos" son los nombres de los días, no la paleta de la fiesta), así que la vereda se llena de color y nada lleva dibujo de noche. Todo lo pone el festival (`world/festivales/carnaval.ts`) sin tapar caminos, portales, puntos ni la vereda:

- **Sobre la vereda**: la guirnalda de punta a punta, tramos de banderines en dos cuerdas que se cruzan y de papel crepé torcido con pompones, colgada de postes pintados en espiral con cintas que vuelan; confeti en la orilla y serpentinas en la pradera.
- **La plazoleta de la comida pastusa** (al oeste del sendero): el frito pastuso, las empanadas de añejo, el hervido y el helado de paila, cada uno con su toldo de franjas, festón con borlas, letrero pintado, mostrador de tableros con flores, su vendedora, su paila u olla con humo y cajones y canastos en el piso. Entre puesto y puesto, muñecos de papel maché en poste: el danzante con ruana y el cuy. Al lado, el puesto de máscaras y sombreros y una gradería.
- **Los arcos**: uno sobre el portón y otro sobre el camino de piedra que lleva a la estación, con columnas de azulejos morados y rombos dorados, franjas de cuadros, el letrero "CARNAVAL" pintado a mano, el sol de los Pastos con un penacho de plumas y una sarta de pompones. Se pasa por debajo.
- **Frente a la calle** (al este de la estación): la tarima del concurso (el palco del jurado, con el telón del Galeras), dos graderías de madera con armazón morado y banderines, con su valla de colores, y la tarima de la murga con sus parlantes y el bombo. En las graderías se sienta cualquiera (y parte del público de la gente de la fiesta).
- **Por el sendero y el portón**: faroles de papel de acordeón, mascarones con plumas a los lados del portón y globos.

Referencias: las calles del Desfile Magno con graderías y vallas, los puestos de comida típica (frito pastuso, empanadas de añejo, hervido de lulo o maracuyá, helado de paila) y el barniz de Pasto en las máscaras. Lo que se mueve (banderines, faroles, cintas, globos, humo) tiene cuadros que el navegador pasa en bucle.

## 6. Grupos participantes (ficticios)

- **Comparsa Familia Castañeda**: vecinos de la vereda que cada año "llegan de viaje" con ropa de 1928. La más antigua del desfile.
- **Murga Los Tamborileros del Galeras**: banda de bombo, redoblante y trompetas que va entre carrozas y marca el paso de todos.
- **Colectivo coreográfico Talco y Ceniza**: bailarines vestidos mitad blanco, mitad negro. Hacen las figuras de ola y espejo.
- **Cuadrilla del Tablero**: los ajedrecistas del piso 3. Se toman en serio lo de ser peones.
- **Los del Páramo**: caminantes y guardabosques. Llevan los colibríes y cuidan que nadie pise los frailejones.
- **La Minga**: la gente del huerto y la granja; reparten maíz tostado.
- **Abanderado: Don Evelio**: pastuso de verdad, con ruana y bandera blanca y negra. Abre el desfile y comenta cada carroza en burbujas.
- **Doña Aurora y Doña Gloria**: en la carroza del tinto y en el palco, aplaudiendo.
- **Comparsa de la cabaña**: el equipo. Cualquiera se suma, y el concurso de disfraces sale de ahí.

## Referencias

- Desfile Magno (6 de enero): carrozas monumentales desde 1926; en 2026 hubo 107 motivos, entre carrozas, comparsas, murgas y disfraces. Ver carnavaldepasto.org, Forbes Colombia y El Tiempo.
- Las modalidades del carnaval son colectivos coreográficos, disfraz individual, comparsas, murgas y carrozas motorizadas y no motorizadas (Alcaldía de Pasto y El País).
- La Familia Castañeda, desfile del 4 de enero (Radio Nacional).
- La Guaneña, bambuco tradicional de Nariño e himno del carnaval (Wikipedia).
