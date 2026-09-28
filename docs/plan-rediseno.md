# Rediseño de la cabaña

Rediseño completo de la propiedad: una casa de tres pisos más sótano, pensada desde cero como un edificio real (con recibidor, pasillos y cada sala con una función clara), un terreno mucho más amplio que no se siente como una isla flotante, y un casino y unos consumibles que se usan dentro del mundo. Se mantiene el estilo (pixel-art cozy estilo Stardew, todo dibujado por código) y se lleva el detalle bastante más lejos.

Decisiones tomadas:

- El rediseño va antes que la lógica de la fase 5. El huerto, el lago, el arcade y el cine quedan ubicados en el mapa nuevo, y la fase 5 se construye encima.
- El piso 3 es de biblioteca y descanso.
- El casino se juega en la mesa: al sentarse o acercarse, la cámara se acerca y todo pasa sobre el paño.
- Primero se aprueba este plano y después trabajan agentes en paralelo.

Medidas en tiles (1 tile = 32 px de mundo). Los ids de los niveles se mantienen (`jardin`, `planta-baja`, `piso-2`, `sotano`) y se agrega `piso-3`. Las oficinas siguen siendo `office-1..4`.

## Principios de circulación

- Se entra por el **porche** al **recibidor**. Del recibidor salen el pasillo principal y las escaleras.
- **Cada sala se abre a un pasillo o a un vestíbulo**, nunca a través de otra sala. La única excepción son los espacios que forman parte de una sala: los probadores de la tienda, la cocina detrás de la barra y el bar dentro del club.
- **Las escaleras están una sobre otra**, en el mismo lugar en todos los pisos, como en una casa real. Se sale de la escalera al rellano de cada piso.
- **Las funciones se agrupan por piso**:
  - planta baja: lo social y lo comercial;
  - piso 2: el trabajo;
  - piso 3: el descanso;
  - sótano: el entretenimiento.

## Exterior (`jardin`)

El terreno pasa de 32x28 a una **zona jugable de unos 64x56**, rodeada de otros 12 tiles de bosque en todo el borde, que se dibujan pero no se pisan.

**Sin isla flotante**:
- el pasto y la tierra siguen hasta el borde del dibujo, sin la losa con costados de tierra;
- en el borde hay bosque denso, rocas y un sendero que se pierde entre los árboles;
- la cámara no deja ver más allá;
- el límite para caminar es invisible: una cerca con portón en el frente y, en el resto, árboles y rocas que bloquean.

```
      0          10         20         30         40         50        63
   0  · · bosque · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   6  ·  ┌─ cerca ───────────────────────────────────────────────────┐ ·
      ·  │ cobertizo   HUERTO             ┌──────────────┐  leñera   │ ·
      ·  │ ┌──┐        20 camas (4x5)     │              │┌───────┐ │ ·
      ·  │ └──┘        pozo, colmenas,    │   CASA       ││TERRAZA│ │ ·
      ·  │ INVERNADERO espantapájaros     │  3 pisos     ││pérgola│ │ ·
      ·  │ ┌──────┐    compost, barriles  │ (22x14)      │└───────┘ │ ·
      ·  │ │      │                       └────┬─porche─┬┘           │ ·
      ·  │ └──────┘     jardín de flores       │ camino │   rocas    │ ·
      ·  │                                    │        │            │ ·
      ·  │  FOGATA con troncos   buzón tablón ├────────┤  ~~~~~~~~  │ ·
      ·  │  (charla al aire)     farolas      │        │ ~~ LAGO ~~ │ ·
      ·  │                                    │ camino │~ islote  ~~│ ·
      ·  │  bancas, glorieta                  │        │ ~ muelle ~ │ ·
      ·  │                                    │        │  ~~ bote ~ │ ·
  56  ·  └──────────────────────── portón ─────┴────────┴────────────┘ ·
      · · · · bosque, sendero que se pierde · · · · · · · · · · · · · ·
```

### La casa por fuera

Un sprite nuevo mucho más grande (unos 22x14 de planta, de alto hasta el techo del piso 3) y **menos cuadrado**:
- un cuerpo principal de tres pisos;
- un ala este más baja, con la terraza cubierta y la pérgola;
- un mirador o torre redonda en la esquina oeste;
- techos a distintas alturas, lucarnas, chimenea con humo, balcones con barandas y jardineras;
- el porche de la entrada con techito propio y faroles;
- una escalera exterior de madera al balcón del piso 2.

Tiene versión de noche, con las ventanas encendidas. La referencia es la imagen que mandaste.

### Zonas del exterior

- **Huerto grande** (oeste): 20 parcelas (4 filas de 5, con pasillos). Suma pozo, barriles de agua, compost, colmenas, espantapájaros y un cobertizo de herramientas.
- **Invernadero**: casita de vidrio con plantas adentro (de adorno; más adelante se podría entrar).
- **Lago** (sureste), grande y de borde orgánico: orilla de arena y piedras, juncos, nenúfares con flores, un islote con un árbol, un muelle con farol y un bote amarrado. Se pesca en la punta del muelle y en una piedra plana de la orilla. Alrededor hay una banca y una mesa de picnic.
- **Frente**: el camino de piedra con farolas va del porche al portón y se bifurca hacia el huerto y el lago. El buzón y el tablón quedan junto al camino. Hay una **fogata** con troncos para sentarse (un punto de charla) y una glorieta con bancas.
- **Terraza este**: cubierta de madera con mesas, pérgola con enredaderas y faroles, y la leñera.
- **Naturaleza**: más variedad de árboles (robles, pinos, abedules, frutales), arbustos con flores, macizos de flores, rocas de varios tamaños, hongos y troncos caídos.
- **Garaje** (agregado después del rediseño): pegado al oeste de la torre, de 5x5, de bloque de cemento gastado con techo de chapa oxidada, el portón enrollable a medio subir, la puerta chica con su foco y la entrada de concreto con manchas de aceite hasta el sendero del huerto. La puerta chica lleva al nivel `garaje` (ver abajo). Detrás de él (lo que su dibujo tapa) hay matorral y cachivaches, sin lugar donde pararse.

## Planta baja: lo social y lo comercial (unos 40x26)

```
x →   0            12 13          25 26          39
y 0   ┌────────────┬──────────────┬──────────────┐
      │  SALÓN     │  CAFETERÍA   │  COCINA      │
      │ chimenea,  │ barra al     │ (detrás de   │
      │ sofás,     │ norte, mesas,│  la barra;   │
      │ piano,     │ rincón con   │  de adorno)  │
      │ biblioteca │ ventanal     │              │
      │ chica      │              │              │
y 10  ├───[ ]──────┴─────[ ]──────┴─────┬────────┤
y 11  │   PASILLO PRINCIPAL (3 de ancho)   │ BAÑOS │
y 13  ├──[ ]──┬──────────────┬────[ ]──┴────────┤
      │ GUAR- │  RECIBIDOR   │  TIENDA          │
      │ DA-   │ escalera     │ mostrador,       │
      │ RROPA │ arriba/abajo │ estantes,        │
      │       │ recepción,   │ percheros,       │
      │       │ alfombra     │ probadores al    │
      │       │              │ fondo            │
y 25  └───────┴────[puerta]──┴──────────────────┘
                   porche
```

- **Recibidor**: la puerta de entrada, la recepción, un perchero, plantas y la escalera (arriba al piso 2 y abajo al sótano). De ahí se pasa al pasillo principal y a la tienda.
- **Cafetería**: más grande. La barra (con los pedidos de la fase 3a, cigarros y el desayuno) queda contra la pared norte, con la cocina detrás. Hay mesas con su burbuja de audio y un rincón con ventanal.
- **Salón**: chimenea, sofás y sillones, piano, una estantería chica y una mesa de centro. Es la sala de estar de todos.
- **Tienda**: se entra desde el recibidor y desde el pasillo. Los probadores quedan al fondo, dentro de la tienda. Ya no se cruza un probador para llegar a otro lado.
- **Guardarropa y baños**: de adorno, para que la casa se sienta completa.
- **Sala de reuniones**: se muda al piso 2, que es el de trabajo.

## Piso 2: el trabajo (unos 40x26)

```
x →   0      8 9        18 19          31 32      39
y 0   ┌──────┬──────────┬──────────────┬──────────┐
      │RELLA-│ OFICINA 1│ SALA DE      │ OFICINA 2│
      │NO    │          │ REUNIONES    │          │
      │esca- │          │ pantalla     │          │
      │lera  │          │ norte        │          │
y 9   ├─[ ]──┴───[ ]────┴────[ ]───────┴───[ ]────┤
y 10  │          PASILLO DE OFICINAS                │
y 12  ├─[ ]────┬───[ ]────┬────[ ]──────┬───[ ]────┤
      │CABINAS │ OFICINA 3│ ZONA DE     │ OFICINA 4│
      │de lla- │          │ DESCANSO    │          │
      │mada x2 │          │ cafetera,   │          │
      │        │          │ nevera,     │          │
      │        │          │ sofás       │          │
y 22  └────────┴──────────┴─────────────┴──────────┘
                    balcón (sale por la zona de descanso)
```

- **Oficinas 1 a 4**: más grandes (unos 10x9), una puerta cada una al pasillo, con cerradura y "tocar la puerta" como hoy. Tienen ventana, escritorio con PC, estantería, zona de visitas y espacio para decorar.
- **Sala de reuniones**: mesa larga, pantalla en la pared norte y audio aislado.
- **Zona de descanso**: kitchenette con cafetera, nevera y mesa alta, más sofás. Da a un balcón con barandas.
- **Cabinas de llamada**: dos cabinas para hablar sin molestar (audio aislado).

## Piso 3: biblioteca y descanso (unos 32x20, bajo el techo)

```
x →   0                  17 18           31
y 0   ┌───────────────────┬──────────────┐
      │ BIBLIOTECA        │ SALA DE ESTAR│
      │ estanterías altas,│ chimenea,    │
      │ escalerita,       │ tocadiscos,  │
      │ mesas de lectura  │ sillones     │
      │ con lámparas,     │              │
      │ globo             │              │
y 8   ├──────[ ]──────────┴────[ ]───────┤
y 9   │ RELLANO (escalera)    PASILLO     │
y 11  ├──────[ ]──────────┬────[ ]───────┤
      │ RINCÓN DE LECTURA │ SALA DE      │
      │ ventanal, puffs,  │ JUEGOS DE    │
      │ hamaca, mantas    │ MESA         │
      │                   │ ajedrez,     │
      │                   │ puzle        │
y 19  └────────┬──────────┴────┬─────────┘
               │ TERRAZA (deck,│
               │ baranda,      │
               │ plantas, vista│
               │ al lago)      │
               └───────────────┘
```

- **Biblioteca**: estanterías altas contra las paredes del fondo, escalerita, mesas largas con lámparas verdes, globo y un rincón silencioso (audio aislado).
- **Sala de estar**: chimenea, tocadiscos (se puede poner música), sillones y mantas.
- **Rincón de lectura**: ventanal, puffs, una hamaca, cojines y una lámpara de pie.
- **Sala de juegos de mesa**: mesa de ajedrez y un puzle a medio armar.
- **Terraza**: piso de madera al aire libre, baranda baja, plantas en macetas y la vista al lago.

## Sótano: el entretenimiento (unos 40x28)

```
x →   0              14 15        24 25            39
y 0   ┌────────────────┬───────────┬────────────────┐
      │ CASINO         │ VESTÍBULO │ CLUB           │
      │ ruleta grande  │ escalera, │ pista, tubo,   │
      │ (3x4),         │ guarda-   │ BAR integrado: │
      │ blackjack,     │ rropa,    │ tragos y       │
      │ póker, fuente, │ neón      │ cigarros, DJ,  │
      │ tragamonedas,  │           │ sofás          │
      │ caja           │           │                │
y 13  ├──────[ ]───────┴───[ ]─────┴──────[ ]───────┤
y 14  │            PASILLO DEL SÓTANO                 │
y 16  ├──────[ ]───────┬───────────┬──────[ ]───────┤
      │ CINE           │ BAÑOS     │ ARCADE         │
      │ pantalla oeste,│           │ máquinas,      │
      │ butacas en     │           │ peluches,      │
      │ gradas,        │           │ hockey,        │
      │ crispetas      │           │ puffs          │
y 27  └────────────────┴───────────┴────────────────┘
```

- Se baja al **vestíbulo**, que tiene guardarropa y un letrero de neón por sala. Del vestíbulo se entra al casino y al club, y por el pasillo al cine y al arcade. **Ninguna sala se cruza para llegar a otra.**
- **Club**: el **bar queda integrado a la sala**, con barra larga, banquetas y estante de botellas. Vende tragos (cerveza, vino, whisky, cóctel) y cigarros, que se consumen con animación (ver más abajo). También tiene la tarima con el tubo, el DJ y los sofás.
- **Cine**: butacas en gradas mirando a la pantalla con telón.
- **Arcade**: se entra por el pasillo, ya no por el club.

## Garaje: el taller y una oficina (16x11)

```
x →   0                     9 10          15
y 0   ┌──────────────────────┬─────────────┐
      │ TALLER               │ OFICINA DEL │
      │ portón (pared oeste),│ GARAJE      │
      │ carro tapado, banco  │ (office-5)  │
      │ con el tablero de    [ ] escritorio│
      │ herramientas,        │ con PC viejo│
      │ estantes, llantas,   └─────────────┤
      │ tambores, compresor, reflector     │
y 9   └─────────[  ]───────────────────────┘
                 ↓ salida al jardín
```

- Nivel interior aparte (`garaje`), al que se entra desde la puerta chica del garaje del jardín.
- **Taller** (zona común): concreto con manchas de aceite, bloque sin pintar, telarañas, el portón enrollable por dentro, el banco de trabajo bajo el tablero de herramientas, estantes metálicos, pilas de llantas, la caja de herramientas roja, el compresor, tambores, cajas, latas de pintura, la escoba, la nevera vieja, la radio y un carro tapado con lona. Todo descuidado a propósito.
- **Oficina del garaje** (`office-5`, aislada, puerta desde el taller): escritorio metálico con un computador de los noventa (prende Hyvento OS), una silla de oficina rota con cinta, archivador abollado, ventilador, planta seca, calendario viejo y un tapete gastado. Se asigna en /admin y su dueño la decora como las del piso 2.

## Casino, más trabajado y jugado en la mesa

- **Números legibles**: una tipografía pixel de números propia (5x7, pensada para leerse a escala 1 y 2) en el paño, la rueda, el historial y las fichas. Adiós a los números que se confunden.
- **Ruleta grande**: una mesa de 3x4 con la rueda aparte (más grande, con los 37 números legibles). La bola se ve girar en sentido contrario, pierde velocidad, rebota entre los casilleros y cae en el número. El resultado se marca en el paño y en el historial.
- **Mesa en vez de ventana**:
  - Al pararse junto a la ruleta (o sentarse en el blackjack), la cámara se acerca a la mesa y el paño se vuelve el tablero.
  - Las fichas se ponen haciendo clic en el paño mismo y se ven las de todos.
  - Las cartas del blackjack se reparten sobre la mesa, frente a cada banqueta.
  - En pantalla solo queda una tira mínima: fichas para elegir, saldo, cuenta regresiva y "Levantarse".
  - Al salir, la cámara vuelve.
- **La caja** sigue siendo una ventanilla, pero con el mismo estilo de la mesa.

## Consumibles y objetos que se usan

- **Cafetería y bar**: lo que se pide queda en la mano (como hoy) y **se usa con F** (o clic en un botón). Cada objeto tiene su animación:
  - **cigarro**: se lleva a la boca, la punta brilla y sale humo que sube y se deshace;
  - **tragos y café**: se inclina el vaso y se ve el sorbo; al café le sale vapor;
  - **postres**: se ve el mordisco.

  Cada objeto tiene varios usos (por ejemplo, 5 pitadas o 4 sorbos) y después desaparece. Lo valida el servidor: tener el objeto y respetar la pausa entre usos. Los demás ven la animación.
- **Muebles que se usan** (de la tienda y de la casa):
  - piano y guitarra: se tocan, con notas generadas por código;
  - tocadiscos: pone música en la sala;
  - tele retro: se prende y se apaga;
  - lámparas: se prenden y se apagan;
  - gato: se acaricia (corazón).

## Cambios técnicos de base (antes de los agentes)

- **`areas.ts` se divide en un archivo por nivel** (`world/areas/jardin.ts`, `planta-baja.ts`, `piso-2.ts`, `piso-3.ts`, `sotano.ts`) y **el catálogo por tema**, para que los agentes no se pisen.
- **Nivel `piso-3`** nuevo, con escaleras apiladas: los portales se conectan en el mismo lugar en cada piso.
- **Límite jugable**: cada nivel exterior tiene un rectángulo jugable y un margen que solo se dibuja. La cámara queda dentro del dibujo y nunca muestra el vacío.
- **Escondites del Man del Sombrero en el jardín** (`SOMBRERO_HIDEOUTS` en `packages/shared/src/sombrero.ts`, en tiles del nivel): detrás del huerto (4, 1), el rincón del noreste (70, 2), entre los árboles del centro (30, 37) y junto al camino del lago (47, 22), en coordenadas de la zona jugable. No ocupan tiles (se le puede pasar por encima); si algo se construye ahí, conviene mover el escondite (un test revisa que se pueda llegar y que no caigan en las franjas de las estructuras).
- **Decoración de oficinas en coordenadas relativas a la oficina**: así un rediseño futuro no corre los muebles de nadie. La fase 3c todavía no está en producción, así que no hay datos que migrar.

## Cómo se ejecuta

1. **Base** (yo): los cambios técnicos de arriba, con los tests del mapa al día.
2. **Agentes en paralelo**, cada uno en su rama, con revisión cruzada al final:
   - **exterior**: el terreno, la casa nueva, el lago, el huerto, el invernadero y la naturaleza;
   - **interiores**: la planta baja y los pisos 2 y 3, con los muebles nuevos (estanterías, chimeneas, cocina, cabinas, biblioteca…);
   - **sótano**: la distribución nueva, el bar del club y la reubicación de lo que ya existe;
   - **casino**: la tipografía de números, la ruleta grande con su bola y la mesa con la cámara;
   - **consumibles**: usar lo que está en la mano con animaciones, la carta del bar y los muebles que se usan.
3. **Integración**: se mezcla todo, se prueba en el navegador y se abre un PR.

La **fase 5** (regalos, intercambios, huerto, pesca, arcade y video del cine) se construye después, sobre este mapa.
