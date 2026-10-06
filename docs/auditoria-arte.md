# Auditoría del arte (VIR-177)

Cada pieza del juego medida contra `docs/estandar-arte.md`. Se hizo mirando las **hojas de contacto** (`pnpm --filter @hyvento/map hoja <carpeta> [filtro] [escala]`: cada mueble de frente, de espaldas y de noche si tiene, sobre el rombo de su lugar y con un chibi al lado; los objetos de mano aumentados y a tamaño real) y los niveles enteros (`render`). La hoja deja también `metricas.json` con cuántas veces sale cada pieza en el mundo (contando la decoración de los festivales), cuántos colores tiene y cuánto llena su lugar.

## Resumen

- **Muebles, edificios y plantas auditados:** 388 (sin contar 4 versiones viejas que ya no salen y 6 del Carnaval, que hacen otros).
- **Cumplen antes de la tanda 1:** 274 de 388 (71 %); 102 mejorables y 12 para rehacer. Contando lo que se ve (cada vez que una pieza sale en el mundo), cumplía el **22 %**: lo que más se repite (la cerca, las matas, los árboles, el helecho, el pasto) era lo más flojo.
- **Después de la tanda 3:** cumplen 329 de 388 (85 %): 15 piezas más, las que más se veían de lo que faltaba (el macizo de flores, la lámpara de pie, las mesitas, la banca) y el Megabús por dentro y la estación.
- **Después de la tanda 2:** cumplen 314 de 388 (81 %) y el **91 % de lo que se ve**; lo dibujado a mano en grillas ya es el 69 % de lo que se ve.
- **Después de la tanda 1:** cumplen 294 de 388 (76 %) y el **80 % de lo que se ve**.
- **Objetos de mano:** 177; cumplen 167 (94 %). Ya son grillas dibujadas a mano de 10x10 como mucho, con luz, sombra y contorno del material; abajo, los que piden otra mirada.
- **Técnica (pixel art a mano, sin primitivas):** antes de la tanda 1, solo los objetos de mano y algunos detalles; todos los muebles y edificios se armaban con cajas, cilindros, elipses o el escultor 3D (`renderSprite`, `Escena`, `blob`, `canopy`). La tanda 1 pasa a grillas a mano 20 piezas, que son el 58 % de lo que se ve. Que una pieza "cumpla" en esta tabla es por cómo se ve; igual se pasa a grilla cuando se la toque.

## Tandas

1. **Jardín: árboles, matas, hierbas y la cerca** (hecha). Los robles (tres siluetas y el grande), los pinos (tres alturas), los abedules, los frutales, las cuatro matas, el helecho, el pasto alto, las flores silvestres y la cerca, en grillas a mano (`art/jardin-arboles.ts`, `art/jardin-matas.ts`, `art/outdoor.ts`). Mismo tamaño en el catálogo y misma colisión; el pie de cada uno quedó en el centro de su tile.
2. **Lo que quedaba del jardín y los muebles comunes de las salas** (hecha). En `art/jardin-detalles.ts`: los hongos, las cuatro piedras, los nenúfares, el tocón, la cerca de palos de la granja y los faroles (el del camino, el farolito y el del muelle), ahora de hierro café cálido con vidrio ámbar en vez de azul frío. En `art/salas-muebles.ts`: la silla, el taburete, el sillón, el puf, la barra de la cafetería (también con la cafetera), la barra del club, el parlante y el proyector. Las luces de noche y el golpe del parlante (`speakerPulse`) siguen calzando donde estaban.
3. **El jardín, las mesitas, las lámparas, el bus por dentro y la estación** (hecha). En `art/jardin-tanda3.ts`: el macizo de flores (cantero con borde de piedras), el tronco banca, el poste de cerca, la banca y la mesa de terraza. En `art/salas-tanda3.ts`: la mesita, la mesa de centro, la mesa de café, la lámpara de pie (prendida y apagada salen de la misma grilla, `lampShadeOn`/`lampShadeOff`) y la lámpara hongo. En `art/bus-adentro-tanda3.ts`: la barra con timbre, la cabina del conductor, el plato del fuelle y los asientos. En `art/estacion-bus.ts`: la estación (techo de tablas con claraboyas, vidrios con reflejo, bancas y materas; las luces de noche de `ESTACION` salen de su geometría) y la plataforma de arenisca con la franja táctil y los torniquetes.
4. **Lo que sigue:** lo plano del baño y la cocina, las plantas en maceta (`pothos`, `boston-fern`, `plant`, `palm`), los sofás y lo del sótano (tragamonedas, cubículos).
5. **Fachadas y edificios:** pasar a grilla la cabaña, el garaje, el observatorio y la casa del árbol sin mover las ventanas (las luces de noche de VIR-178 van encima).
6. **Objetos de mano** de la lista de abajo y el bosque de alrededor (`surroundings.ts`, que todavía usa `canopy`).

## Muebles, edificios y plantas, por impacto

Ordenados por cuánto se ven (veces en el mundo) por cuánto les falta (rehacer pesa el doble que mejorable). La nota es la de antes de esta tanda; la columna de la tanda dice qué se hizo.

| Pieza | Grupo | Veces | Nota | Por qué | Tanda |
|---|---|---:|---|---|---|
| `fence` | base | 495 | rehacer | listones planos de un solo naranja y 4 colores: parecía cartón | tanda 1: a mano, cumple |
| `birch-1` | exterior | 133 | rehacer | palo blanco con tres bolitas de hojas: no se lee como árbol | tanda 1: a mano, cumple |
| `wildflowers` | exterior | 127 | rehacer | florcitas de un píxel que no se ven; llena menos de la mitad del tile | tanda 1: a mano, cumple |
| `bush-round` | exterior | 240 | mejorable | mancha verde clara de poco contraste, más chica que su tile | tanda 1: a mano, cumple |
| `birch-2` | exterior | 102 | rehacer | como el abedul 1 | tanda 1: a mano, cumple |
| `fern` | exterior | 185 | mejorable | manojo chico de rayas verdes sin foliolos | tanda 1: a mano, cumple |
| `oak-1` | exterior | 181 | mejorable | copa en motas iguales, sin masas ni sombra de panza; tronco liso | tanda 1: a mano, cumple |
| `pine-1` | exterior | 181 | mejorable | pisos de triángulo con raíces naranjas enormes; poca sombra entre pisos | tanda 1: a mano, cumple |
| `tall-grass` | exterior | 163 | mejorable | matita lima de pocos tonos | tanda 1: a mano, cumple |
| `pine-2` | exterior | 151 | mejorable | como el pino 1 | tanda 1: a mano, cumple |
| `bush-berry` | exterior | 126 | mejorable | las bayas casi no se ven | tanda 1: a mano, cumple |
| `oak-big` | exterior | 99 | mejorable | copa grande pero en motas; sin masas | tanda 1: a mano, cumple |
| `pine-3` | exterior | 99 | mejorable | como el pino 1 | tanda 1: a mano, cumple |
| `oak-3` | exterior | 97 | mejorable | como el roble 1 | tanda 1: a mano, cumple |
| `mushrooms` | exterior | 86 | mejorable | grupito que se entiende, pero los sombreros se funden entre sí | tanda 2: a mano, cumple |
| `stick-fence` | granja | 35 | rehacer | palos de un tono sin corteza; 4 colores | tanda 2: a mano, cumple |
| `oak-2` | exterior | 65 | mejorable | como el roble 1 | tanda 1: a mano, cumple |
| `bush-hydrangea` | exterior | 62 | mejorable | las bolas de flor se pierden en la mata | tanda 1: a mano, cumple |
| `rock-small` | exterior | 55 | mejorable | piedrita gris de 5 tonos sin facetas claras | tanda 2: a mano, cumple |
| `lamp-post` | base | 24 | rehacer | poste azul marino frío en un jardín cálido; farol de caja sin vidrio ni brillo | tanda 2: a mano, cumple |
| `bush-rose` | exterior | 47 | mejorable | las rosas son puntitos rojos | tanda 1: a mano, cumple |
| `chair` | base | 47 | mejorable | se entiende, pero la madera es plana (sin veta) y el cojín de un tono | tanda 2: a mano, cumple |
| `flower-patch` | exterior | 47 | mejorable | macizo de flores en cruz repetida; sin forma de cantero | tanda 3: a mano, cumple |
| `lamp` | base | 22 | rehacer | pantalla amarilla plana de un solo tono, pie de palo: no parece una lámpara de pie bonita | tanda 3: a mano, cumple |
| `lily-pad` | exterior | 43 | mejorable | nenúfares chicos; la flor apenas se ve | tanda 2: a mano, cumple |
| `rock-mossy` | exterior | 42 | mejorable | el musgo es una mancha; faltan facetas | tanda 2: a mano, cumple |
| `beanbag` | base | 14 | rehacer | mancha morada de 5 colores sin pliegues ni costura: no se entiende que es un puf | tanda 2: a mano, cumple |
| `garden-lantern` | exterior | 26 | mejorable | faro de jardín frío (gris azulado) para la estética cálida | tanda 2: a mano, cumple |
| `stool` | base | 26 | mejorable | chico y sin volumen en el asiento; la madera sin veta | tanda 2: a mano, cumple |
| `armchair` | base | 21 | mejorable | verde plano con mucha área de un tono; le faltan costuras y pliegues | tanda 2: a mano, cumple |
| `garden-plot` | base | 20 | mejorable | la tierra en surcos se lee, pero el marco de madera es plano |  |
| `reading-lamp` | interior | 17 | mejorable | lámpara de banquero chica, pantalla verde plana |  |
| `side-table` | base | 16 | mejorable | se lee, pero chica en su tile y con pocos tonos por material | tanda 3: a mano, cumple |
| `speaker` | base | 8 | rehacer | caja negra con dos círculos: plana y sin detalle | tanda 2: a mano, cumple |
| `bench` | base | 14 | mejorable | tablones planos de un tono; sin veta ni clavos | tanda 3: a mano, cumple |
| `counter` | base | 7 | rehacer | caja con tapa crema: no se lee como barra (sin zócalo, sin veta, sin nada encima) | tanda 2: a mano, cumple |
| `rock-medium` | exterior | 13 | mejorable | piedra gris sin facetas | tanda 2: a mano, cumple |
| `stump` | exterior | 13 | mejorable | tocón chico con anillos; el brote es un palito | tanda 2: a mano, cumple |
| `arcade-cabinet` | base | 12 | mejorable | la pantalla y el gabinete planos; le falta el arte lateral y los botones |  |
| `cafe-table` | base | 12 | mejorable | tapa crema plana, pie de metal sin brillo | tanda 3: a mano, cumple |
| `pothos` | plantas | 12 | mejorable | mata cilíndrica de bolitas |  |
| `fence-post` | exterior | 6 | rehacer | palo naranja liso: no se entiende qué es | tanda 3: a mano, cumple |
| `slot-machine` | base | 11 | mejorable | caja con poco detalle: faltan los rodillos, la palanca con brillo y luces |  |
| `boston-fern` | plantas | 10 | mejorable | helecho en un pie raro que parece tronco |  |
| `log-seat` | exterior | 10 | mejorable | tronco liso sin corteza ni anillos marcados | tanda 3: a mano, cumple |
| `lounge-sofa` | base | 10 | mejorable | terciopelo con volumen pero de pocos tonos; faltan capitoné y brillo |  |
| `sofa` | base | 10 | mejorable | se entiende, pero el tapiz es plano y las costuras no se ven |  |
| `coffee-table` | base | 9 | mejorable | mesa café chica y plana | tanda 3: a mano, cumple |
| `plant` | base | 9 | mejorable | hojas en bolitas iguales sobre una maceta de caja |  |
| `lamp-mushroom` | base | 8 | mejorable | hongo de dos tonos; la luz no se nota de día | tanda 3: a mano, cumple |
| `cocktail-table` | base | 7 | mejorable | mesa alta de metal muy delgada; la tapa sin brillo |  |
| `column-cactus` | plantas | 7 | mejorable | cactus de columnas lisas |  |
| `palm` | base | 7 | mejorable | palmerita chica en maceta dorada; hojas pocas y tiesas |  |
| `bath-stall` | sotano | 6 | mejorable | cubículo blanco liso |  |
| `bus-pole` | bus | 6 | mejorable | tubo amarillo plano | tanda 3: a mano, cumple |
| `cherry-tree` | exterior | 6 | mejorable | copa rosada en motas | tanda 1: a mano, cumple |
| `flat-rock` | exterior | 6 | mejorable | losa gris plana | tanda 2: a mano, cumple |
| `velvet-rope` | base | 6 | mejorable | postes dorados finos; el cordón casi no se ve |  |
| `water-barrel` | base | 6 | mejorable | barril de duelas sin aros con brillo; el agua de arriba plana |  |
| `bar-counter` | base | 5 | mejorable | caja negra con borde rosado; le faltan las botellas o la madera | tanda 2: a mano, cumple |
| `hay-bale` | granja | 5 | mejorable | paca amarilla con poca paja suelta |  |
| `peach-tree` | exterior | 5 | mejorable | copa en motas con frutas de un píxel | tanda 1: a mano, cumple |
| `pet-bed` | casa | 5 | mejorable | cama rosada plana |  |
| `vanity` | interior | 5 | mejorable | lavamanos chico de caja blanca |  |
| `apple-tree` | exterior | 4 | mejorable | copa en motas con frutas de un píxel | tanda 1: a mano, cumple |
| `bath-sink` | sotano | 4 | mejorable | lavamanos con espejo chico |  |
| `cobweb` | brujas | 4 | mejorable | telaraña fina que se pierde |  |
| `high-table` | interior | 4 | mejorable | mesa alta de tapa plana sobre un pie fino |  |
| `patio-table` | exterior | 4 | mejorable | mesita redonda plana | tanda 3: a mano, cumple |
| `poster-stand` | base | 4 | mejorable | afiche con estrella plana; el marco sin volumen |  |
| `stairs-up` | base | 4 | mejorable | escalones de un solo tono de madera; sin veta ni sombra entre peldaños |  |
| `toilet-stall` | interior | 4 | mejorable | caja menta lisa con una puerta |  |
| `umbrella-stand` | interior | 4 | mejorable | paragüero chico de dos tonos |  |
| `printer` | interior | 3 | mejorable | caja beige: se entiende poco que es una impresora |  |
| `stove` | interior | 3 | mejorable | estufa y campana de cajas grises |  |
| `velita` | velitas | 3 | mejorable | velita chica |  |
| `wall-sconce` | sotano | 3 | mejorable | aplique que de día casi no se ve |  |
| `water-cooler` | interior | 3 | mejorable | botellón azul sobre caja blanca lisa |  |
| `mailbox` | base | 2 | mejorable | buzón chico; el poste plano |  |
| `photo-board` | interior | 2 | mejorable | corcho grande y plano (las fotos van encima) |  |
| `scarecrow` | base | 2 | mejorable | muy chico para su tile, sin brazos de palo ni paja que sobresale |  |
| `signpost` | exterior | 2 | mejorable | letrero de dos tablas lisas sin letras |  |
| `stage-lantern` | escenario | 2 | mejorable | poste liso con farolito |  |
| `sundial` | observatorio | 2 | mejorable | reloj de sol chico |  |
| `toilet` | interior | 2 | mejorable | inodoro blanco de pocos tonos |  |
| `treehouse-cushion` | casa-arbol | 2 | mejorable | cojín de un tono |  |
| `water-trough` | granja | 2 | mejorable | bebedero chico |  |
| `wheelbarrow` | exterior | 2 | mejorable | carretilla chica de pocos tonos |  |
| `projector` | base | 1 | rehacer | dos cajas oscuras: no se lee como proyector (sin lente ni carretes) | tanda 2: a mano, cumple |
| `bus-cabin` | bus | 1 | mejorable | cabina de cajas negras | tanda 3: a mano, cumple |
| `bus-platform` | bus | 1 | mejorable | losas naranjas lisas | tanda 3: a mano, cumple |
| `bus-station` | bus | 1 | mejorable | techo gris liso y vidrios oscuros; lejos de la calidez del resto | tanda 3: a mano, cumple |
| `bus-turntable` | bus | 1 | mejorable | óvalo gris plano | tanda 3: a mano, cumple |
| `cactus` | base | 1 | mejorable | cactus de columnas lisas en maceta amarilla |  |
| `chicken-feeder` | granja | 1 | mejorable | comedero chico |  |
| `cinema-stage` | sotano | 1 | mejorable | tarima de tablones planos |  |
| `counter-coffee` | base | 1 | mejorable | cafetera de caja gris sobre barra plana | tanda 2: a mano, cumple |
| `dance-pole` | base | 1 | mejorable | tubo blanco plano, sin brillo cromado |  |
| `diving-board` | agua | 1 | mejorable | trampolín de tabla lisa |  |
| `dock-lamp` | exterior | 1 | mejorable | farol del muelle en poste liso | tanda 2: a mano, cumple |
| `farm-sign` | granja | 1 | mejorable | letrero chico sin letras |  |
| `feed-sack` | granja | 1 | mejorable | costal liso |  |
| `flour-sacks` | granja | 1 | mejorable | costales blancos planos |  |
| `hay-rack` | granja | 1 | mejorable | pesebrera chica |  |
| `millstone` | granja | 1 | mejorable | piedra de molino gris lisa |  |
| `pesca-nevera` | pesca | 1 | mejorable | nevera de icopor lisa |  |
| `pet-bowl` | casa | 1 | mejorable | platico chico |  |
| `podcast-cables` | podcast | 1 | mejorable | cables chiquitos en el piso |  |
| `race-flag` | base | 1 | mejorable | banderita a cuadros chica en un palo |  |
| `treehouse-cushion-sage` | casa-arbol | 1 | mejorable | cojín de un tono |  |
| `cable-pole` | observatorio | 0 | mejorable | poste liso con cable |  |
| `cable-pole-end` | observatorio | 0 | mejorable | poste liso |  |
| `cuadro` | base | 0 | mejorable | marco plano de un tono (los píxeles de la pintura van encima) |  |
| `flowerbed` | base | 0 | mejorable | cajón con florcitas de un píxel |  |
| `banderines-carnaval` | carnaval | 101 | otra rama | el Carnaval lo hacen otros agentes (VIR-160/166/176): no se audita aquí |  |
| `reeds` | exterior | 39 | cumple | juncos con totoras y ondas en el agua |  |
| `corn-maze-4` | brujas | 36 | cumple | mata de maíz con mazorcas |  |
| `corn-maze-3` | brujas | 34 | cumple | mata de maíz con mazorcas |  |
| `railing` | interior | 31 | cumple | baranda de madera con balaustres |  |
| `corn-maze-1` | brujas | 28 | cumple | mata de maíz con mazorcas |  |
| `corn-maze-2` | brujas | 25 | cumple | mata de maíz con mazorcas |  |
| `serpentinas-suelo` | carnaval | 25 | otra rama | el Carnaval lo hacen otros agentes (VIR-160/166/176): no se audita aquí |  |
| `planter` | exterior | 23 | cumple | jardinera de madera con flores |  |
| `bus-seat` | bus | 18 | cumple | silla del bus verde lima | tanda 3: a mano, cumple |
| `bookcase-tall` | interior | 16 | cumple | biblioteca alta llena de libros |  |
| `flower-bucket` | feria | 16 | cumple | balde de flores |  |
| `armchair-wing` | interior | 15 | cumple | sillón orejero con tapiz |  |
| `kentia` | plantas | 15 | cumple | palma con maceta de cerámica |  |
| `snake-plant` | plantas | 14 | cumple | lengua de suegra con rayas |  |
| `bookshelf-low` | base | 13 | cumple | libros de colores y estructura clara |  |
| `carved-pumpkin` | brujas | 12 | cumple | ahuyama tallada que se prende |  |
| `monstera` | base | 12 | cumple | hojas grandes y canasto con trama |  |
| `runner` | interior | 12 | cumple | alfombra larga con patrón |  |
| `farol-carnaval` | carnaval | 11 | otra rama | el Carnaval lo hacen otros agentes (VIR-160/166/176): no se audita aquí |  |
| `fiddle-fig` | plantas | 11 | cumple | ficus de hojas grandes |  |
| `patio-chair` | exterior | 11 | cumple | silla de madera con cojín |  |
| `rug-round` | base | 11 | cumple | tejido trenzado con anillos de color |  |
| `farol-velitas` | velitas | 10 | cumple | farol de colores en estaca |  |
| `paper-lantern` | brujas | 10 | cumple | farol de papel en poste |  |
| `feria-lantern` | feria | 9 | cumple | farol de papel |  |
| `kitchen-counter` | interior | 9 | cumple | mesón verde con cosas encima |  |
| `office-chair` | base | 9 | cumple | silla con ruedas, respaldo y brazos; se entiende |  |
| `rug-3x3` | base | 9 | cumple | alfombra con borde y medallón |  |
| `clothes-rack` | base | 8 | cumple | ropa de colores colgada, perchero dorado |  |
| `grandfather-clock` | interior | 8 | cumple | reloj de pie con péndulo |  |
| `olive-tree` | plantas | 8 | cumple | olivo en maceta de barro |  |
| `rug-persian` | interior | 8 | cumple | alfombra persa con borde y medallón |  |
| `succulents` | plantas | 8 | cumple | cajón de suculentas |  |
| `velitas-vasos` | velitas | 8 | cumple | grupito de vasos |  |
| `blanket-basket` | interior | 7 | cumple | canasto con cobija a cuadros |  |
| `desk-pc` | base | 7 | cumple | escritorio con cajones, monitor con código y taza |  |
| `filing-cabinet` | interior | 7 | cumple | archivador con cajones y matica |  |
| `sun-lounger` | agua | 7 | cumple | reposera con toalla |  |
| `boulder` | exterior | 6 | cumple | roca grande con musgo y facetas |  |
| `cardboard-boxes` | garaje | 6 | cumple | cajas de cartón con cinta |  |
| `cinema-seat` | base | 6 | cumple | butaca roja con brazos y tapiz |  |
| `cinema-seat-1` | sotano | 6 | cumple | butaca de cine tapizada |  |
| `cinema-seat-2` | sotano | 6 | cumple | butaca de cine tapizada |  |
| `cinema-seat-3` | sotano | 6 | cumple | butaca de cine tapizada |  |
| `greenhouse-bed` | exterior | 6 | cumple | cajón con brotes |  |
| `picnic-bench` | exterior | 6 | cumple | banca de tablones |  |
| `radio` | casa | 6 | cumple | radio retro en su mesita |  |
| `sideboard` | interior | 6 | cumple | aparador con cajones y adornos |  |
| `silleta-stand` | feria | 6 | cumple | exhibidor de silleta |  |
| `trophy-case` | interior | 6 | cumple | vitrina de vidrio con reflejo |  |
| `woodpile` | exterior | 6 | cumple | leña apilada bajo techito |  |
| `crates` | exterior | 5 | cumple | cajones con fruta |  |
| `deck-chair` | interior | 5 | cumple | silla de playa con tela a rayas |  |
| `desk-phone` | base | 5 | cumple | teléfono de disco con su cable |  |
| `display-shelf` | base | 5 | cumple | estante con productos de colores |  |
| `entry-bench` | interior | 5 | cumple | banca con cojín y zapatos |  |
| `fallen-log` | exterior | 5 | cumple | tronco caído con musgo y anillos |  |
| `globe` | base | 5 | cumple | globo con continentes en su pie |  |
| `guitar` | base | 5 | cumple | guitarra con boca y clavijas |  |
| `orchid` | plantas | 5 | cumple | orquídea en maceta de madera |  |
| `record-player` | base | 5 | cumple | tocadiscos con brazo y notas |  |
| `tire-stack` | garaje | 5 | cumple | llantas apiladas |  |
| `towel-rack` | agua | 5 | cumple | toallero |  |
| `backbar` | interior | 4 | cumple | mesón con cafetera y frutas |  |
| `bus-seat-blue` | bus | 4 | cumple | silla preferencial | tanda 3: a mano, cumple |
| `cat-bed` | base | 4 | cumple | gato dormido en su cama |  |
| `coat-rack` | base | 4 | cumple | perchero con sombrero y bufanda |  |
| `farol-cubo` | velitas | 4 | cumple | farol cubito |  |
| `fridge` | interior | 4 | cumple | nevera menta retro con imanes |  |
| `kitchen-sink` | interior | 4 | cumple | lavaplatos con llave |  |
| `mecedora` | casa-propia | 4 | cumple | mecedora tallada |  |
| `office-chair-sage` | base | 4 | cumple | como la silla de oficina |  |
| `paint-cans` | garaje | 4 | cumple | tarros de pintura |  |
| `railing-corner` | interior | 4 | cumple | esquina de baranda |  |
| `sofa-leather` | interior | 4 | cumple | sofá de cuero con capitoné |  |
| `stairwell` | base | 4 | cumple | baranda con balaustres y el hueco en sombra |  |
| `tv-retro` | base | 4 | cumple | tele con antenas, consola y cables |  |
| `arbol-navidad` | novenas | 3 | cumple | árbol con luces |  |
| `armario` | casa-propia | 3 | cumple | armario con espejo |  |
| `balcony-planter` | interior | 3 | cumple | jardinera con flores |  |
| `bar-shelf` | base | 3 | cumple | botellas de colores con brillo |  |
| `barrel` | exterior | 3 | cumple | barril con aros y frutas |  |
| `beehive` | exterior | 3 | cumple | colmena por pisos con techo |  |
| `cama-sencilla` | casa-propia | 3 | cumple | cama con cobija tejida |  |
| `cardboard-tombstone` | brujas | 3 | cumple | lápida con letras |  |
| `carved-pumpkin-big` | brujas | 3 | cumple | ahuyama grande |  |
| `console-table` | interior | 3 | cumple | consola con lámpara y florero |  |
| `curio-cabinet` | interior | 3 | cumple | vitrina con platos y figuras |  |
| `easel` | base | 3 | cumple | caballete con su cuadro |  |
| `fireplace-stone` | interior | 3 | cumple | chimenea de piedra con fuego |  |
| `fitting-booth` | base | 3 | cumple | probador con cortina y rayas |  |
| `floor-mirror` | interior | 3 | cumple | espejo de pie con marco dorado |  |
| `hall-runner` | sotano | 3 | cumple | alfombra larga con patrón |  |
| `hammock` | interior | 3 | cumple | hamaca de colores en su base |  |
| `parasol` | agua | 3 | cumple | parasol a rayas |  |
| `piano` | base | 3 | cumple | piano vertical con teclas y partitura |  |
| `picnic-table` | exterior | 3 | cumple | mesa con mantel y comida |  |
| `pinball` | sotano | 3 | cumple | pinball con tablero de luces |  |
| `pumpkin-pile` | brujas | 3 | cumple | pila de ahuyamas |  |
| `rug-2x3` | base | 3 | cumple | alfombra verde con su patrón |  |
| `silleta-decor` | feria | 3 | cumple | silleta de adorno |  |
| `stargazer-scope` | observatorio | 3 | cumple | telescopio en trípode |  |
| `straw-bale` | brujas | 3 | cumple | fardo con ahuyama |  |
| `acuario` | interior | 2 | cumple | acuario largo con peces y plantas |  |
| `bar-taps` | sotano | 2 | cumple | barra con grifos y botellas |  |
| `baul` | casa-propia | 2 | cumple | baúl con herrajes |  |
| `bonsai` | base | 2 | cumple | bonsái con copa en nubes |  |
| `bookshelf` | base | 2 | cumple | biblioteca alta con libros |  |
| `brick-grill` | granja | 2 | cumple | parrilla de ladrillo con chimenea |  |
| `cafe-sign` | interior | 2 | cumple | tablerito con el menú |  |
| `claw-machine` | base | 2 | cumple | vitrina con peluches y la garra |  |
| `coat-rail` | sotano | 2 | cumple | perchero de abrigos de colores |  |
| `coffee-station` | interior | 2 | cumple | cafetera con tazas |  |
| `dish-hutch` | interior | 2 | cumple | alacena con platos |  |
| `dog-house` | casa | 2 | cumple | casita de perro con techo |  |
| `fire-pit` | exterior | 2 | cumple | fogata de piedra con llamas |  |
| `flower-arch` | feria | 2 | cumple | arco de flores |  |
| `game-shelf` | interior | 2 | cumple | estante de juegos de mesa |  |
| `garden-gate` | exterior | 2 | cumple | portón con arco de enredadera y faroles |  |
| `hot-tub` | tina | 2 | cumple | tina de duelas con agua |  |
| `library-ladder` | interior | 2 | cumple | escalera de biblioteca |  |
| `luces-navidad` | novenas | 2 | cumple | arco de luces |  |
| `mascaron` | carnaval | 2 | otra rama | el Carnaval lo hacen otros agentes (VIR-160/166/176): no se audita aquí |  |
| `metal-shelf` | garaje | 2 | cumple | estante con cosas |  |
| `oil-drum` | garaje | 2 | cumple | caneca con aros |  |
| `pantry-shelf` | interior | 2 | cumple | despensa con frascos y costales |  |
| `prep-table` | granja | 2 | cumple | mesa con tabla y comida |  |
| `puzzle-table` | interior | 2 | cumple | mesa con rompecabezas |  |
| `race-line` | base | 2 | cumple | línea a cuadros en el piso |  |
| `reading-table` | interior | 2 | cumple | mesa con paño verde y libros |  |
| `rug-stripes` | base | 2 | cumple | tejido de rayas de colores |  |
| `telescope` | interior | 2 | cumple | telescopio dorado en trípode |  |
| `tocador` | casa-propia | 2 | cumple | tocador con espejo |  |
| `tool-shed` | exterior | 2 | cumple | cobertizo rojo con techo de tejas |  |
| `well` | exterior | 2 | cumple | pozo de piedra con techo y balde |  |
| `witch-scarecrow` | brujas | 2 | cumple | espantapájaros con sombrero |  |
| `work-light` | garaje | 2 | cumple | reflector en trípode |  |
| `air-hockey` | base | 1 | cumple | mesa con neón, discos y marcador |  |
| `aquarium` | base | 1 | cumple | pecera con peces y plantas |  |
| `baccarat-table` | base | 1 | cumple | paño verde con casillas y patas talladas |  |
| `balcony-stair` | casa | 1 | cumple | escalera de madera con baranda |  |
| `barra-casa` | casa-propia | 1 | cumple | barra con botellas |  |
| `blackjack-table` | base | 1 | cumple | mesa en media luna con paño |  |
| `bola-disco` | casa-propia | 1 | cumple | bola de discoteca |  |
| `brass-telescope` | observatorio | 1 | cumple | telescopio grande de bronce |  |
| `broom-corner` | garaje | 1 | cumple | escoba con balde |  |
| `bunting` | observatorio | 1 | cumple | banderines entre postes |  |
| `cama-doble` | casa-propia | 1 | cumple | cama doble con colcha de retazos |  |
| `casa-finca` | casa-propia | 1 | cumple | casona de finca con balcón y flores |  |
| `casino-cashier` | base | 1 | cumple | caja con reja dorada y fichas |  |
| `cauldron` | brujas | 1 | cumple | caldero burbujeante |  |
| `celestial-globe` | observatorio | 1 | cumple | globo celeste |  |
| `checkers-table` | interior | 1 | cumple | mesita con tablero |  |
| `chess-table` | interior | 1 | cumple | mesita con piezas |  |
| `chicken-coop` | granja | 1 | cumple | gallinero con rampa y techo |  |
| `cigar-case` | sotano | 1 | cumple | vitrina dorada |  |
| `cigar-humidor` | sotano | 1 | cumple | humidor de madera |  |
| `cinema-tier-1` | sotano | 1 | cumple | grada alfombrada con patrón |  |
| `cinema-tier-2` | sotano | 1 | cumple | grada alfombrada con patrón |  |
| `cinema-tier-3` | sotano | 1 | cumple | grada alfombrada con patrón |  |
| `clay-oven` | granja | 1 | cumple | horno de barro con fuego |  |
| `coat-check` | sotano | 1 | cumple | mostrador del guardarropa |  |
| `coffee-sacks` | interior | 1 | cumple | costales de café apilados |  |
| `coin-fountain` | base | 1 | cumple | fuente blanca con agua y monedas |  |
| `compost` | exterior | 1 | cumple | compostera con restos |  |
| `compressor` | garaje | 1 | cumple | compresor rojo |  |
| `conference-table` | interior | 1 | cumple | mesa larga con laptops |  |
| `dance-floor` | sotano | 1 | cumple | pista de baldosas de colores |  |
| `dead-plant` | garaje | 1 | cumple | mata seca a propósito |  |
| `desk-crt` | garaje | 1 | cumple | escritorio con monitor viejo |  |
| `desk-phone-counter` | base | 1 | cumple | teléfono como el del escritorio |  |
| `dj-booth` | base | 1 | cumple | cabina con luces de ecualizador |  |
| `entry-table` | interior | 1 | cumple | mesita con florero |  |
| `equipo-sonido` | casa-propia | 1 | cumple | equipo de sonido con discos |  |
| `filing-dented` | garaje | 1 | cumple | archivador abollado |  |
| `floor-fan` | garaje | 1 | cumple | ventilador de pie |  |
| `flower-stall` | feria | 1 | cumple | puesto con toldo |  |
| `footbridge` | granja | 1 | cumple | puentecito de tablas con baranda |  |
| `fortune-wheel` | base | 1 | cumple | rueda de colores con su pie |  |
| `fossil-case` | observatorio | 1 | cumple | vitrina con fósil |  |
| `garage` | garaje | 1 | cumple | garaje de troncos con portón y enredadera |  |
| `garden-shower` | agua | 1 | cumple | ducha de madera |  |
| `garland-pole` | feria | 1 | cumple | poste de guirnaldas |  |
| `gazebo` | exterior | 1 | cumple | piso de la glorieta con vetas en rayos |  |
| `gazebo-roof` | exterior | 1 | cumple | glorieta blanca con techo de tejas |  |
| `goat-shed` | granja | 1 | cumple | establo con heno |  |
| `golden-pumpkin` | brujas | 1 | cumple | calabaza dorada |  |
| `gradas-1` | escenario | 1 | cumple | gradas de piedra con banca |  |
| `gradas-2` | escenario | 1 | cumple | gradas de piedra con banca |  |
| `gradas-3` | escenario | 1 | cumple | gradas de piedra con banca |  |
| `greenhouse` | exterior | 1 | cumple | piso a cuadros del invernadero |  |
| `greenhouse-roof` | exterior | 1 | cumple | estructura de vidrio con plantas |  |
| `guirnalda` | novenas | 1 | cumple | corona |  |
| `horse-race-table` | base | 1 | cumple | pista con carriles y caballitos |  |
| `house` | exterior | 1 | cumple | la casa del jardín: torre, porche, tejas, troncos y piedra; la vara de calidad |  |
| `icebox` | garaje | 1 | cumple | nevera de icopor |  |
| `juego-rana` | casa-propia | 1 | cumple | juego de la rana |  |
| `kitchen-island` | interior | 1 | cumple | isla con tabla de picar y frutas |  |
| `lampara-colgante` | casa-propia | 1 | cumple | lámpara colgante |  |
| `lobby-rug` | sotano | 1 | cumple | alfombra roja con medallón |  |
| `lobby-sign` | sotano | 1 | cumple | poste con flechas de colores |  |
| `lobby-statue` | sotano | 1 | cumple | estatua dorada sobre pedestal |  |
| `log-desk` | observatorio | 1 | cumple | escritorio con diario |  |
| `marshmallow-fire` | observatorio | 1 | cumple | fogata con malvaviscos |  |
| `maze-arch` | brujas | 1 | cumple | arco del laberinto |  |
| `menu-board` | granja | 1 | cumple | tablero con el menú |  |
| `mesa-billar` | casa-propia | 1 | cumple | mesa de billar con lámparas |  |
| `mesa-comedor` | casa-propia | 1 | cumple | mesa puesta |  |
| `mill-wheel` | granja | 1 | cumple | rueda del molino con paletas |  |
| `notice-board` | base | 1 | cumple | tablón de corcho con notas y techito |  |
| `observatory` | observatorio | 1 | cumple | torre de piedra con cúpula |  |
| `observatory-board` | observatorio | 1 | cumple | letrero del observatorio |  |
| `observatory-sign` | observatorio | 1 | cumple | letrerito |  |
| `office-chair-blue` | base | 1 | cumple | como la silla de oficina |  |
| `office-chair-broken` | garaje | 1 | cumple | silla rota a propósito |  |
| `office-chair-mustard` | base | 1 | cumple | como la silla de oficina |  |
| `office-chair-rose` | base | 1 | cumple | como la silla de oficina |  |
| `orrery` | observatorio | 1 | cumple | planetario de bronce |  |
| `parada-casa` | casa-propia | 1 | cumple | parada con techo y letrero |  |
| `pastry-case` | base | 1 | cumple | vitrina de vidrio con pasteles |  |
| `pergola` | exterior | 1 | cumple | pérgola con enredadera y glicinas |  |
| `pesca-canas` | pesca | 1 | cumple | cañas en su soporte |  |
| `pesca-caseta` | pesca | 1 | cumple | caseta con toldo a rayas |  |
| `pesca-mostrador` | pesca | 1 | cumple | mostrador con cosas |  |
| `podcast-code-desk` | podcast | 1 | cumple | escritorio con pantalla verde |  |
| `podcast-console` | podcast | 1 | cumple | consola de grabación |  |
| `podcast-crystal` | podcast | 1 | cumple | cristal en pedestal |  |
| `podcast-rocket` | podcast | 1 | cumple | cohete de madera |  |
| `podcast-rug` | podcast | 1 | cumple | alfombra de estrellas |  |
| `podcast-shelf` | podcast | 1 | cumple | estante con planetas |  |
| `podcast-table` | podcast | 1 | cumple | mesa con micrófonos y lámparas |  |
| `pole-stage` | base | 1 | cumple | tarima redonda con borde de luces |  |
| `pool` | agua | 1 | cumple | piscina con deck y agua con reflejos |  |
| `popcorn-machine` | base | 1 | cumple | carrito rojo con crispetas |  |
| `prize-shelf` | sotano | 1 | cumple | estante de peluches |  |
| `puesto-carnaval` | carnaval | 1 | otra rama | el Carnaval lo hacen otros agentes (VIR-160/166/176): no se audita aquí |  |
| `reception-desk` | interior | 1 | cumple | recepción con computador |  |
| `rock-case` | observatorio | 1 | cumple | vitrina de rocas |  |
| `roulette-table` | base | 1 | cumple | paño con números y patas doradas |  |
| `roulette-wheel` | base | 1 | cumple | rueda con casillas y bola |  |
| `rowboat` | exterior | 1 | cumple | bote con remos |  |
| `sauna` | tina | 1 | cumple | banca de la sauna con estufa |  |
| `sauna-shell` | tina | 1 | cumple | barril de la sauna con techo y ventanita |  |
| `shop-counter` | base | 1 | cumple | mostrador verde con caja registradora |  |
| `sicbo-table` | base | 1 | cumple | mesa con casillas y la cúpula de dados |  |
| `signal-radar` | observatorio | 1 | cumple | radar de señales |  |
| `silletero-table` | feria | 1 | cumple | mesa del silletero |  |
| `spa-deck` | tina | 1 | cumple | deck de tablones |  |
| `spiral-stairs` | observatorio | 1 | cumple | escalera de caracol |  |
| `stage-deck` | escenario | 1 | cumple | tarima de tablas |  |
| `stage-lectern` | escenario | 1 | cumple | atril con micrófono |  |
| `stage-shell` | escenario | 1 | cumple | concha con cortinas, luces y parlantes |  |
| `tarima-comparsa` | carnaval | 1 | otra rama | el Carnaval lo hacen otros agentes (VIR-160/166/176): no se audita aquí |  |
| `tarp-car` | garaje | 1 | cumple | carro tapado con lona |  |
| `tendedero` | casa-propia | 1 | cumple | tendedero con ropa |  |
| `tina-bano` | casa-propia | 1 | cumple | tina con patas |  |
| `tool-chest` | garaje | 1 | cumple | caja de herramientas roja |  |
| `toy-rocket` | observatorio | 1 | cumple | cohete de juguete |  |
| `treehouse` | casa-arbol | 1 | cumple | casa del árbol: copa grande, baranda, faroles |  |
| `treehouse-crates` | casa-arbol | 1 | cumple | cajones apilados |  |
| `treehouse-ladder` | casa-arbol | 1 | cumple | escalera de madera |  |
| `treehouse-lantern` | casa-arbol | 1 | cumple | farolito |  |
| `treehouse-rug` | casa-arbol | 1 | cumple | tapete trenzado |  |
| `treehouse-table` | casa-arbol | 1 | cumple | mesita de tronco |  |
| `treehouse-trapdoor` | casa-arbol | 1 | cumple | trampilla |  |
| `treehouse-trunk` | casa-arbol | 1 | cumple | tronco que atraviesa el piso |  |
| `water-mill` | granja | 1 | cumple | molino de piedra y entramado |  |
| `workbench` | garaje | 1 | cumple | banco con herramientas |  |
| `worn-rug` | garaje | 1 | cumple | tapete gastado |  |
| `bush` | base | 0 | sin uso | versión vieja, ya no sale en el mundo |  |
| `cabin` | base | 0 | sin uso | la cabaña vieja (vitrina del login): no sale en el mundo |  |
| `fireplace` | base | 0 | cumple | chimenea de piedra con fuego y repisa |  |
| `maze-arch-y` | brujas | 0 | cumple | arco del laberinto |  |
| `meeting-table` | base | 0 | cumple | mesa con laptop y papeles |  |
| `pesebre` | novenas | 0 | cumple | pesebre con figuras |  |
| `pine` | base | 0 | sin uso | versión vieja, ya no sale en el mundo |  |
| `poker-table` | base | 0 | cumple | paño con fichas y cartas |  |
| `tree` | base | 0 | sin uso | versión vieja, ya no sale en el mundo |  |
| `velita-vaso-amarillo` | velitas | 0 | cumple | vasito de color |  |
| `velita-vaso-azul` | velitas | 0 | cumple | vasito de color |  |
| `velita-vaso-morado` | velitas | 0 | cumple | vasito de color |  |
| `velita-vaso-rojo` | velitas | 0 | cumple | vasito de color |  |
| `velita-vaso-verde` | velitas | 0 | cumple | vasito de color |  |

## Objetos de mano que piden otra mirada

| Objeto | Nota | Por qué |
|---|---|---|
| `aguardiente` | mejorable | la botella se lee poco al lado de las otras |
| `carton` | mejorable | cartón chico de pocos tonos |
| `harina` | mejorable | bolsa clara de pocos tonos |
| `hoja` | mejorable | hoja con rayas: se confunde con la libreta |
| `huevo` | mejorable | dos óvalos blancos sin brillo marcado |
| `kumis` | mejorable | vaso blanco plano |
| `papa` | mejorable | bolita amarilla: se confunde con un limón |
| `perico` | mejorable | taza que no se distingue del tinto |
| `queso` | mejorable | cuña blanca casi sin tonos |
| `velita` | mejorable | velita muy delgada |

Todos los demás objetos de mano cumplen: se entienden a tamaño real junto al chibi, tienen la luz arriba a la izquierda, su sombra y el contorno del material, y los parecidos ya se distinguen (un test lo revisa).

