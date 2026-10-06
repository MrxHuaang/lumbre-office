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

## Cómo se revisa

- Antes de abrir un PR con arte, se dibuja una **hoja PNG** con cada pieza a escala del juego, junto a un chibi para comparar, de día (y de noche si aplica), y se mira con calma.
- Se compara con lo mejor que ya tiene el juego (la casa, el observatorio, la tina, el garaje): lo nuevo no puede verse peor.
- Si una pieza se ve plana, chica, con pocos colores o no se entiende, se rehace antes del PR.
- En el PR se describe la hoja y qué se revisó.
