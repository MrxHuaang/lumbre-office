# Carnaval de Negros y Blancos en la cabaña (VIR-160)

Concepto del Carnaval del día 18 del verano, inspirado en el de Pasto (patrimonio de la UNESCO desde 2009). Don Evelio es pastuso, así que él es el abanderado. El **Desfile Magno** va por **la calle del Megabús**, frente a la Estación Hyvento, con música andina hecha por código.

**"Negros y Blancos" es el nombre de los días del carnaval** (el 5 y el 6 de enero en Pasto), no el color de las carrozas. Las carrozas y las comparsas de Pasto son explosiones de color. **El Carnaval es de día, siempre**: el Desfile Magno sale a las 10:00 del juego, el concurso se premia a las 18:00 y el festival cierra a las 18:30, antes de que oscurezca.

## Respeto cultural (decisiones)

- **Nunca se oscurece la piel de un avatar.** Las figuras de papel maché sí pueden tener piel de colores de fantasía (turquesa, verde, dorado), como en Pasto; lo que no se hace es pintar personas reales ni avatares. En Pasto, el Día de Negros recuerda la petición de un día de libertad para las personas esclavizadas. Pintar caras en un juego se presta a malas lecturas, así que se nombra con respeto en la cinemática de apertura, sin imitarlo.
- El "talco" (Día de Blancos) es el juego de la maicena: deja la cara empolvada de blanco un rato. Va solo entre quienes lo aceptan: no se le echa a nadie en "No molestar" y hay una opción para no recibir.
- Las carrozas cuentan historias de la cabaña y del sur andino (paisaje, oficios, mitos), como homenaje y nunca como caricatura. No hay rostros que imiten a personas reales. Lo afro y lo indígena van con dignidad, como en las carrozas ganadoras de 2026 ("Indomable, mujer guerrera", "Nariño en alas de vida", "Herencia mágica").
- Los grupos son ficticios, inspirados en las modalidades reales del carnaval: carrozas, comparsas, murgas, colectivos coreográficos y disfraz individual.

## 1. Carrozas

Como en el Desfile Magno de Pasto: **criaturas fantásticas integradas al camión** (animales, monstruos, calaveras, personas con máscara). La figura es el vehículo: su cuerpo, manto o melena tapan la plataforma, el frente es su cara o su boca, y alrededor van muchas figuras chicas en capas. Son enormes frente a la gente de la calle (varias veces la altura de un avatar), de colores saturados, con terminaciones cuidadas (planos de luz y sombra, brillos, patrones andinos, plumas por capas).

**Movimiento de verdad**: en Pasto las figuras son articuladas (el movimiento lo incorporó en los años 60 el maestro José Eduardo Ordóñez; el ingenio mecánico se le debe a Rogerio Argote y al maestro Alfonso Zambrano), con resortes, piolas y bandas de caucho: cabezas que giran, ojos y párpados, bocas, brazos y manos que suben y bajan, alas que aletean, piezas que dan vueltas, cuerpos que se mecen. Aquí cada carroza se arma **por partes** (VIR-173, `packages/map/src/art/carrozas`): cada parte es un dibujo con su pivote y su movimiento (`gira`, `rueda`, `vaiven`, `escala`, `parpadeo`, `sube`), y el navegador las mueve con curvas suaves (`posesCarroza`, la misma pose para todos). Con "menos movimiento" quedan casi quietas.

**Técnica**: pixel art pintado en 2D, en la vista 3/4 del juego (luz de arriba a la izquierda), con la plataforma del camión en 3D. Cómo se dibuja y se suma una: `docs/carrozas.md`.

| # | Carroza | Qué se ve | Guiño |
|---|---|---|---|
| 1 | **La Familia Castañeda llega** | La abuela viajera con sombrilla, el loro y los baúles, colores de época | La tradición del 4 de enero |
| 2 | **El Cóndor de los Andes** | El cóndor con las alas de colores que aletean, sobre montañas de franjas y el sol que gira | El cóndor de los Andes |
| 3 | **El Galeras que fuma** | El volcán con rostro y faldas de retazos de cultivos, humo de colores, cuyes | El volcán de Pasto |
| 4 | **El Tablero del Diablo** | La calavera turquesa sonriente con dientes de oro, diablitos enroscados como cuernos, túnica que tapa el camión, garras levantadas y, a sus pies, el fraile y el diablo jugando ajedrez | La sala de juegos del piso 3 |
| 5 | **El Reloj de E.** | El monstruo mecánico de pelaje azul, cara rosada que ruge, cresta de fuego, engranajes y tubos que echan humo, manos moradas con la máscara de dientes de oro | Capítulo 2 de la historia |
| 6 | **La Luna en el lago** | La luna como un rostro de mujer dormida que abre un ojo, peces de escamas de colores, la llavecita | Capítulo 3 |
| 7 | **El Páramo** | El espíritu del páramo con antifaz de pavo real, alas de mariposa, la mano de uñas pintadas, frailejones y colibríes | El agua nace en el páramo |
| 8 | **La Minga de la cosecha** | La Pachamama de tocado de plumas arcoíris que ofrece una totuma de la que cae agua; la cosecha y las guaguas | El agua y la tierra |
| 9 | **El tinto de Doña Aurora** | Aurora sirviendo de una cafetera de peltre enorme, el pocillo que echa vapor, los bultos de café | La casera de la cabaña |
| 10 | **El Megabús de la alegría** | El bus con ojos y sonrisa, flores pintadas, muñecos que bailan encima, banderas y rehilete | Cierra el desfile |

**Estado**: las diez se rehicieron por partes (VIR-173). El Tablero y el Reloj ya van en pixel art pintado como criaturas integradas; las demás están en una primera versión en 3D y se rehacen con la misma técnica, apuntando a unas 20 carrozas.

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

## 3. Música (toda sintetizada por código, sin grabaciones; VIR-174)

El sonido del carnaval son **las murgas** y **los colectivos andinos**, y el ritmo más propio de Nariño es el **son sureño** (en 6/8). Va por la salida de la música del mezclador (`sfxOut("music")`). Código: `apps/web/src/game/carnaval/musica.ts` (bandas y reproducción), `musica-piezas.ts` (el repertorio), `musica-programa.ts` (la parte pura: notación, rangos, cortes, programa por tramos) y `musica-instrumentos.ts` (los sintetizadores). Ids, conjuntos, repertorios y murgas: `packages/shared/src/carnaval-musica.ts`.

**Los dos conjuntos**

- **La murga**: trompeta, saxo y trombón (diente de sierra con un filtro que se abre al soplar, el labio que entra un pelito abajo y vibrato tardío), acordeón (tres lengüetas de pulso desafinadas: el trémolo) y la percusión al frente: bombo, redoblante, platillos, timbales, güiro, guasá y campana. Sus **cortes**: golpe de toda la banda con platillo, silencio y el repique de timbales y redoblante que la vuelve a meter.
- **El colectivo andino**: quena, zampoña (segunda voz), **rondador** (dos cañas vecinas a la vez, en terceras o cuartas, como suena de verdad), bombo y shekere. Sin charango (es más del altiplano).

**El repertorio** (todo original salvo La Guaneña; cada pieza dura de 2 a 3 minutos, con introducción, temas que pasan de un instrumento a otro, la percusión sola, cortes y final):

- Murga: **"Son de la vereda"** (son sureño, Re menor), **"Son del cuy alegre"** (son sureño, La menor, con hemiolas y pregunta y respuesta), **"Sanjuanito de la plaza"** (sanjuanito, Mi menor) y **"La Guaneña"** arreglada para murga (los bronces llevan la melodía, cada vuelta arranca con un corte y la anacrusa).
- Colectivo: **"Sanjuanito del lago"** (La menor), **"Bambuco del Galeras"** (Sol mayor con un tema en Mi menor) y **"La Guaneña"** (tradicional nariñense, bambuco de dominio público e himno del carnaval: la melodía de la versión para flauta de las escuelas, en Mi menor y en 3, con la dominante antes de volver; la zampoña y el rondador se la pasan, con un puente y un interludio originales).
- El pasacalle y el albazo (más ecuatorianos) se quitaron. Nada con derechos de autor.

**En el desfile**: cada grupo rota el repertorio de su conjunto desde que sale el desfile (`sonandoEn`, con una pausa entre piezas), y cada carroza empieza en otro punto (`repertorioDe(pieza, puesto)`), así todos oyen lo mismo y dos grupos seguidos no tocan lo mismo. Las comparsas de las carrozas suenan con su colectivo; la de la cabaña (el Megabús) y las tres murgas ficticias que van detrás de algunas carrozas (`MURGAS`: por ahora se oyen, no se dibujan) con la murga. `BandasDelDesfile` toca el grupo de cada conjunto que más se oye; si se oyen los dos, el más lejano baja. Las notas se programan tramo por tramo mientras suenan.

**En las cinemáticas**: el sonido `guanena` (la apertura) toca un trozo de La Guaneña del colectivo y `murga` (la premiación) uno del "Son de la vereda" (`CINE_MUSICA`).

**Para escucharlas**: `listaParaEscuchar()` y `escucharPieza(id)` de `musica.ts` (devuelve cómo pararla).

**Fuentes**: Wikipedia, "Murgas en Carnaval de Negros y Blancos de Pasto"; Radio Nacional, "Carnaval de Negros y Blancos: música y danza que exaltan la identidad nariñense"; Vanguardia, "Carnaval de Negros y Blancos entona ritmos andinos para cantarle a la tierra".

## 4. Recorrido (la calle del Megabús)

El desfile va por el carril exclusivo, del oeste al este. Mientras pasa, **el bus no sale**: la sala suspende `BusLine` y el bus de refuerzo espera. Se ve desde la vereda y la plataforma.

1. **Salida (borde oeste, entre el bosque)**: la fila aparece desde el bosque de `surroundings`.
2. **Palco del jurado (frente a la Estación Hyvento)**: dos paradas, cuando el primer tercio y luego el último de la fila pasan por el palco. Toda la fila para y cada comparsa repite su coreografía donde va; las murgas y los disfraces bailan.
3. **La vereda entera**: quien está en la vereda se suma a la comparsa de la cabaña (E) donde vaya pasando la fila.
4. **Llegada (borde este)**: las carrozas se pierden en el bosque, lluvia final de confeti y cinemática de cierre para quienes bailaron.

Es un solo **Desfile Magno** por Carnaval: sale a las 10:00 del juego y no vuelve a salir hasta el Carnaval del año siguiente del calendario. Va despacio (0,34 tiles por segundo) y dura unos 17 minutos reales (de 10:00 a ~17:00 del juego): la fila (las carrozas con sus comparsas de 12 bailarines, tres murgas con bombo, bronces y acordeón, y tres grupos de disfraces individuales) es más larga que la calle y va pasando, así que siempre hay algo en la calle. Para dos veces frente al palco. Quien está en la vereda se suma a la comparsa de la cabaña en cualquier momento, donde va pasando la fila (baila en el hueco detrás de la carroza más cercana), y se baja cuando quiere.

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
