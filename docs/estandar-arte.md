# Estándar de calidad del arte

Todo lo que se dibuja en el juego (muebles, decoración, objetos, personajes, carrozas, NPC, efectos) es pixel art hecho por código y tiene que ser **entendible, bonito y llamativo**. Un sprite que se ve simple, plano o con pocos píxeles no pasa, aunque funcione. Este documento es la vara para revisar arte nuevo y el arte viejo que se rehace.

## Lo que se pide

1. **Se entiende de un vistazo.** A zoom normal del juego, cualquiera debe saber qué es sin leer el nombre. La silueta dice qué es; los detalles lo confirman. Si hay que adivinar, falta forma o sobra ruido.
2. **Volumen, no recortes.** Todo es isométrico en 3/4: se ven dos caras (el frente y un lado) con distinta luz. La luz viene de arriba a la izquierda: arriba y a la izquierda más claro, abajo y a la derecha más oscuro. Las piezas se tapan unas con otras, proyectan sombra al piso y tienen grosor (un poste es un cilindro, no una raya; una bandera tiene tela que ondea y su lado de sombra).
3. **Color rico.** Cada material lleva al menos tres tonos (luz, base y sombra) y, si brilla, un toque de brillo. Contorno oscuro y cálido del mismo material, no negro puro en todo. Los colores, saturados y armónicos con la paleta cozy; los acentos llaman la atención donde importa.
4. **Detalle con intención.** Textura que cuente qué material es: veta en la madera, trama en la tela, pliegues, remaches, costuras, patrones (tejido andino, barniz de Pasto). Nada de áreas grandes de un solo color plano. Tampoco ruido al azar: cada píxel suma.
5. **Tamaño justo.** Un mueble usa el espacio de su catálogo: no un dibujito chico en el centro de un tile grande. Lo festivo y monumental (carrozas, arcos, tarimas) se ve grande e imponente frente a un personaje.
6. **Vivo cuando se puede.** Lo que en la vida real se mueve (banderines, faroles, llamas, agua, humo, plumas) tiene cuadros de animación o partes que se mecen. Con "menos movimiento", quieto.
7. **Coherente con el mundo.** Misma escala que los chibis y los muebles de alrededor, misma dirección de luz, misma familia de colores del lugar (la cabaña es cálida y rústica; ver la estética del jardín).
8. **Fiel a lo que representa.** Si es algo real (el Carnaval de Pasto, una silleta, un pesebre), se parece a lo real. Se buscan referencias antes de dibujar.

## Técnica obligatoria: pixel art dibujado a mano

Indicación del dueño para todo el arte: **pixel art dibujado a mano y detallado**.

- **Nada de componer con primitivas.** No se arma un dibujo juntando círculos, elipses, esferas, cajas, conos ni cilindros, ni con un "escultor 3D" que salpica superficies (`renderSprite` con cajas, `Escena`, `blob`, `canopy`). Eso da formas genéricas, bordes de compás y luz de calculadora. Lo que ya está hecho así se va cambiando a mano en las tandas de mejora (ver `docs/auditoria-arte.md`).
- **Grillas de letras.** Cada pieza se dibuja como filas de letras, píxel por píxel, con una leyenda de colores (como los objetos de `art/items.ts` o `art/grilla.ts`): la silueta, cada tono y cada brillo se eligen a propósito.
- **Trazos con intención.** Si algo se dibuja con código (una veta, una cuerda, un borde que se repite), cada trazo se pone donde va, no sale de un ruido al azar ni de una fórmula que nadie mira.
- **El volumen se pinta.** Luz de arriba a la izquierda: el lado iluminado con su tono claro y un brillo, el lado en sombra con el oscuro, la sombra en el piso, y un contorno cálido del color del material (su tono más oscuro tirado al café `OUT`), nunca negro.
- **Rampas por letra.** En la leyenda, los tonos de un material van con letras o dígitos (0 el más oscuro, 5 el más claro), así una misma grilla sirve con otra rampa (un roble verde, uno oliva) y las variantes no son copias pegadas. En espejo no: la luz quedaría viniendo de la derecha (otra silueta es mejor que voltear).
- **Las piezas comunes** están en `art/grilla.ts`: `gridSprite` (la grilla con su leyenda y dónde va el origen del mueble), `rampLegend` (los dígitos de una rampa), `edgeOf` (el contorno cálido de un material) y `groundShadow` (la letra de la sombra en el piso). Una letra sin color en la leyenda es un error, así un dedazo no pasa callado. Ejemplos: los árboles (`art/jardin-arboles.ts`), las matas y hierbas (`art/jardin-matas.ts`), la cerca (`art/outdoor.ts`) y los objetos de mano (`art/items.ts`).
- **Una grilla grande no se escribe a ciegas:** se boceta la silueta y las masas, se mira en la hoja, se corrige letra por letra y se vuelve a mirar. Lo que importa es el resultado que queda en el código, que se puede leer y retocar a mano.
- **Follaje** (lo aprendido en la tanda 1): masas de hojas con el borde festoneado, no círculos; dentro, racimos que tienen su propio lado claro y su lado oscuro; la panza de cada masa en sombra; una masa de atrás más oscura que tapa los huecos; el contorno solo afuera (entre masas manda el contraste, no una raya). Los pinos van en faldas con las puntas caídas y dentadas, y cada falda deja su sombra sobre la de abajo.

## Cómo se revisa

- Antes de abrir un PR con arte, se dibuja una **hoja PNG** con cada pieza a escala del juego, junto a un chibi para comparar, de día (y de noche si aplica), y se mira con calma: `pnpm --filter @hyvento/map hoja <carpeta> [filtro] [escala]` (por ejemplo `hoja /tmp/hojas oak,pine 4`; `objetos` son los de mano). Pone cada mueble sobre el rombo de su lugar, con un chibi al lado, y deja `metricas.json` con cuántas veces sale en el mundo, sus colores y cuánto llena su lugar. La auditoría de todo, por impacto, está en `docs/auditoria-arte.md`.
- Para ver la pieza en su sitio, el nivel entero: `pnpm --filter @hyvento/map render <nivel> salida.png`.
- Se compara con lo mejor que ya tiene el juego (la casa, el observatorio, la tina, el garaje): lo nuevo no puede verse peor.
- Si una pieza se ve plana, chica, con pocos colores o no se entiende, se rehace antes del PR.
- En el PR se describe la hoja y qué se revisó.
