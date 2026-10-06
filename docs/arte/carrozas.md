# Cómo se dibuja y se suma una carroza del Carnaval

Guía corta para dibujar carrozas del Desfile Magno (VIR-173). El concepto está en `docs/planes/plan-carnaval.md`.
Una carroza de Pasto es una criatura fantástica (animal, monstruo, calavera, persona con máscara) **integrada al camión**:
- su cuerpo, su manto o su melena tapan la plataforma;
- su cara o su boca son el frente;
- alrededor y atrás van muchas figuras chicas en capas.

Todo va de día y en colores intensos.

## Técnica: pixel art pintado, en 2D

Se dibuja de frente a la pantalla, en la vista 3/4 isométrica del juego:
- lado izquierdo con luz y lado derecho en sombra;
- luz de arriba a la izquierda.

Las referencias son solo guía: ninguna imagen entra al repo.

Los ejemplos a seguir son `art/carrozas/calavera.ts` (el Tablero del Diablo) y `art/carrozas/monstruo.ts` (el Reloj de E.).

- **Lienzo**:
  - `Figura` (`figuras.ts`) da un lienzo que cubre la carroza, con el origen de la carroza en `(OX, OY)`.
  - Se dibuja en coordenadas de pantalla desde el origen.
  - Los helpers `P`, `pol`, `el`, `ci`, `cap` y `curvaP` corren las coordenadas. Copiarlos de `calavera.ts`.
- **Formas** (`pintura.ts`): `poligono`, `elipse`, `circulo`, `capsula`, `caja`, más `union`, `resta`, `corte` y `fundir`. Las formas se diseñan con la silueta de la cosa, no se componen de bolitas.
- **Pintar** con `p.volumen(forma, rampa, opciones)`:
  - `planos: true`: bandas nítidas de luz y sombra, como pintado a mano.
  - `borde: "oscuro"`: contorno cálido.
  - `sombra: 0.35`: la sombra que la pieza tira sobre lo de atrás.
  - `brillo`: el barniz.
  - `patron`: rampa por píxel, para rayas, pliegues y escamas.
  - `pinta`: un color encima, para ruedos y bordados.
  - `p.plano(forma, color)` es pintura plana: pupilas, huecos, letras.
- **Rasgos listos** (`figuras.ts`): `ojo` (iris, pupila, brillo y pestañas), `parpado`, `ceja`, `sonrisa`, `mejilla`, `pluma`, `abanico`, `cuentas` y `mano`. En `munecos.ts`: `figurita` (muñeco chico con cara), `mazorca`, `papa`, `quinua` y `cuy`.
- **Colores**: `rampa("#hex")` da seis tonos con cambio de tono (sombras moradas y luces amarillas).
- **Plataforma**:
  - `escena(LARGO)` y `plataforma(s, LARGO, { faldon, cubierta, flecos }, false)`, de `plataforma.ts`. Es el camión en 3D: faldón, flecos, ribete y ruedas.
  - `parteBase(s)` es la primera parte.
  - Patrones del faldón: `rombosAndinos`, `zigzag` y `floresBarniz`.

## Las partes y el movimiento

Cada parte que se mueve se pinta en su propio lienzo (`f.lienzo()`) y se cierra con:

```ts
f.parte(id, lienzo, pivoteX, pivoteY, { padre?, mov?, contorno? })
```

- **El pivote** (en coordenadas del lienzo, con `P(x, y)`) es el punto alrededor del cual gira: el hombro de un brazo, el cuello de una cabeza, la bisagra de una quijada.
- **`padre`**: se mueve con otra parte. Por ejemplo, los párpados con la cabeza y la cabeza con el cuerpo.
- **El orden de la lista** es el orden de dibujo, de atrás hacia adelante. La plataforma va primero.
- **`mov`** (ver `partes.ts`), todo con seno y suave:
  - `gira: { amp, periodo, fase?, centro? }`: radianes; cabezas, brazos, alas, péndulos.
  - `rueda: { periodo, sentido }`: engranajes, soles.
  - `vaiven: { dx, dy, periodo }`: manos que suben, quijadas que se abren, cuerpos que se mecen.
  - `escala: { sx, sy, periodo }`: alas que aletean, banderas.
  - `parpadeo: { cada, dura }`: la parte se ve solo un ratito. Va en los párpados, con `contorno: false`.
  - `sube: { dx, dy, periodo, crece }`: humo, vapor y gotas que suben o caen y se desvanecen.
- **Movimiento**: que se vea vivo pero no mareador. Con "menos movimiento", casi todo queda quieto solo.
- **Tamaño**: unas 8 a 14 partes por carroza.
- **Marco**: lo que se mueve no puede salirse de `marco` (la plataforma ± 40 px a lo ancho). Un test lo revisa.

La función devuelve `{ largo: LARGO, partes, luces: [], marco: { x0: -ANCHO - 40, x1: LARGO + 40 } }`.

## Sumarla al desfile

1. Crear el archivo `packages/map/src/art/carrozas/<id>.ts` con `export function <id>(): CarrozaArte`.
2. En `packages/shared/src/carnaval.ts`:
   - su id en `CARROZA_IDS`;
   - su comparsa en `COMPARSAS`: nombre, grupo ficticio, `acento`, la pieza de música, 12 bailarines con `comparsero` (los colores salen de `PALETAS`; sumar su paleta) y la `frase` de la coreografía;
   - el comentario de Don Evelio en `EVELIO_CARROZAS`;
   - su lugar en `DESFILE_ORDEN`.
3. En `packages/map/src/carnaval.ts`, lo largo en `CARROZA_TILES`: `LARGO / 16`, redondeado hacia arriba. El dibujo no puede pasarse.
4. En `packages/map/src/art/carrozas/index.ts`, la función en `CARROZAS_ARTE`.

El build la pre-dibuja en el atlas (`apps/web/scripts/prerender.ts`) y el navegador la mueve sola (`game/carnaval/desfile.ts`). No hay que tocar nada más.

## Revisarla

```bash
pnpm --filter @hyvento/map carrozas salida.png <id1,id2> 3          # tres poses de cada una, con un chibi al lado
SOLO=1 COLS=5 pnpm --filter @hyvento/map carrozas salida.png "" 2   # todas, una pose, en grilla
pnpm --filter @hyvento/map exec vitest run src/art/carrozas src/carnaval.test.ts
```

Mirar la hoja con zoom antes del PR (`docs/arte/estandar-arte.md`). Revisar que:
- se lea qué es cada cosa;
- la figura llene el camión;
- las caras tengan expresión;
- nada flote suelto;
- las partes que se mueven no dejen huecos al moverse.
