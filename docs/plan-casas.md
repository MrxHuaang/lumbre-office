# Plan: la casa de cada persona

> Estado: **idea documentada, no se desarrolla todavía.** Se retoma cuando se decida; este documento es
> la base para planearlo en detalle.

## La idea en una frase

La cabaña es el lugar de trabajo compartido; cada persona tiene además **su propia casa**, a la que llega
en el Megabús. Todos se bajan en la misma parada, pero cada uno entra a una casa distinta: la suya. Ahí se
duerme para pasar la noche, se decora y se guardan las cosas.

## Cómo se llega

- **El Megabús es el camino a casa.** Desde la "Estación Hyvento" del jardín, el bus lleva a la parada del
  barrio de las casas ("Barrio" o el nombre que se elija). Todos se bajan en la misma parada.
- **Una casa por persona, en la misma dirección.** La puerta de la parada lleva a *tu* casa: técnicamente
  es un nivel por persona (instancia privada), no una casa por persona en el mapa. Así no hace falta un
  barrio gigante y cada casa puede crecer sin chocar con las demás.
- **Viaje corto.** El viaje en bus hoy dura 30 s (`BUS_TIMINGS.tripMs`) y el bus pasa cada 3 min. Para ir
  a casa tiene que ser rápido para no aburrir:
  - viaje de unos 8–10 s, con la pantalla del recorrido (`BusTrip`) acortada;
  - si no hay un bus en la estación, sale uno de refuerzo al instante (como ya pasa con "Llegar en bus" si
    el próximo tarda más de `maxWaitMs`).
- **Botón "Ir a la estación".** En el HUD (junto a "Mi oficina") o en el menú: teletransporta a la
  plataforma de la estación con un fundido, para no caminar desde cualquier punto del jardín o de la casa.
  El servidor lo valida (no en medio de una llamada, de una partida de mesa, nadando ni desmayado) y tiene
  una pausa corta para que no se use como atajo por todo el mapa.
- **Volver.** Desde la casa se sale por la puerta a la parada y el bus devuelve a la Estación Hyvento. Un
  botón "Ir a la cabaña" hace lo mismo sin caminar.

## Qué hay en la casa

Primera versión (lo mínimo para que tenga sentido):

- **Cama y pasar la noche.** Dormir es solo aquí. De noche del juego (19:00–6:59), E en la cama acuesta
  al personaje (`Player.sleeping`, con "Zzz"); moverse lo despierta. Cuando duermen todos los conectados
  (o, con más de 3, al menos la mitad y nadie en llamada ni en reunión, para que uno solo no le salte la
  noche a un grupo trabajando), el servidor adelanta el reloj a las 06:00 por el mismo camino que
  `/time set`, con fundido a negro y el aviso "Amaneció". Se muestra "Durmiendo 2/4". Como cada casa es
  un nivel propio, dormir cuenta para la regla aunque cada uno esté en su casa. Hay que revisar lo que
  depende de la hora: huevos al amanecer, el Man del Sombrero, el bus y la pesca.
- **Habitaciones**: sala, cuarto y cocinita (a planear el tamaño y la distribución; empezar con una casa
  chica de 2–3 cuartos y crecerla después).
- **Decoración libre**, reutilizando lo que ya existe:
  - el editor de oficina (`decor.ts`, decoración guardada relativa a la sala) aplicado a la casa;
  - los muebles de la tienda y la mochila (lo comprado se pone en la casa igual que en la oficina);
  - pisos y papeles elegibles, como en las oficinas.
- **Buzón y puerta** con el nombre de la persona.

Ideas para versiones siguientes (priorizar cuando se retome):

| Idea | Qué es | Reutiliza |
|---|---|---|
| Visitas | Invitar a alguien a tu casa (entra a tu instancia); tocar el timbre | Invitaciones (#24) y toques de puerta |
| Casa cerrada / abierta | Como las oficinas: abierta, solo invitados, cerrada | Reglas de oficinas cerradas del servidor |
| Cocina propia | Cocinar lo de la mochila en tu estufa | `cocina.ts` |
| Huertico o matas | Una maceta o jardincito propio que se riega | Huerto (`huerto.ts`) |
| Mascota en casa | La mascota adoptada duerme y come en tu casa | Mascotas (`mascotas.ts`) |
| Armario | Cambiarse de ropa en casa | Vestidor / editor de personaje |
| Baúl | Guardar lo que no cabe en la mochila | Mochila (`bag.ts`) |
| Vitrina y cuadros | Trofeos, fotos del tablón, peces del álbum | Trofeos, fotos, acuario |
| Ampliaciones | Comprar un cuarto más o un segundo piso con puntos | Puntos (`spendPoints`) |
| Luz y clima | Ventanas que muestran el día, la noche y la lluvia | Reloj del juego y clima |
| Descanso | Dormir en tu cama da el bono "descansado" al día siguiente | Buff de la cocina (`Player.buff`) |

## Preguntas abiertas

- ¿La casa se ve desde afuera (una calle con fachadas) o es solo un interior tras la puerta de la parada?
  Recomendación: una calle corta con 3–4 fachadas decorativas y una sola puerta que lleva a tu instancia.
- ¿Se puede entrar a la casa de otros sin invitación si está abierta? (privacidad frente a lo social)
- ¿Cuántos puntos cuestan las ampliaciones y qué tamaño tiene la casa inicial?
- ¿Proximidad y video dentro de la casa? Solo con quien esté de visita.

## Técnica (borrador)

- **Instancia por persona**: el `area` del jugador sería `casa:<userId>`; el servidor construye el nivel
  desde una plantilla (`world/areas/casa.ts`) más la decoración guardada de esa persona. La proximidad ya
  cuenta solo dentro del mismo `area`, así que las casas quedan aisladas solas.
- **Datos**: la decoración de la casa puede ir en la misma tabla que la de las oficinas (con un id de
  "zona" `casa:<userId>`), sin migración, o en una tabla `Home` si hace falta guardar ampliaciones.
- **Portales**: la puerta de la parada del barrio resuelve el destino en el servidor según quién la cruza
  (`MSG.travel` → `casa:<userId>`).
- **Bus**: una segunda línea o un destino alterno en `bus.ts` con `tripMs` corto.
