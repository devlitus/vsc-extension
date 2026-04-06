# Office Canvas — Estado y Pendientes

## Lo que está implementado

### Multi-room layout (24×17 grid)

Tres zonas visuales con tiles diferenciados:

| Zona | Tiles (x, y) | Tipo de suelo | Contenido |
|------|-------------|---------------|-----------|
| Oficina principal | x=1..14, y=1..15 | `floor` — madera cálida | escritorios, estanterías, reloj, plantas, alfombras |
| Sala de descanso | x=16..22, y=1..7 | `floor2` — cerámica clara | máquina vending, dispensador de agua, mesa de break, sillas blancas |
| Sala de conferencias | x=16..22, y=9..15 | `carpet` — moqueta azul | mesa grande, 8 sillas naranjas, pinturas, plantas |

Puertas entre salas:
- Oficina ↔ Sala de descanso: x=15, y=4–5
- Oficina ↔ Sala de conferencias: x=15, y=10–11
- Descanso ↔ Conferencias: y=8, x=18–19

### Muebles con Kenney sprites

- **Escritorios** (`deskSurface` + `deskFront`) con monitor canvas 2D superpuesto
- **Estanterías** de 3 tiles de alto (`cabinetTop/Mid/Bot`)
- **Sillas** naranja (`chairOrange`, `chairOrangeAlt`) y blanca (`chairWhite`)
- **Mesas** rectangular grande con tiles `tableTopLeft/Mid/Right` + `tableMidLeft/Mid/Right`
- **Plantas** (`plant`, `plantAlt`) en esquinas y centro
- **Alfombras** (`rug`) bajo la zona central y bajo la mesa de conferencias
- **Reloj** canvas 2D en pared trasera de oficina principal
- **Dispensador de agua** canvas 2D
- **Máquina vending** canvas 2D de 2 tiles de alto
- **Pinturas** canvas 2D en pared trasera de sala de conferencias

### Asientos por defecto (Character seats)

4 asientos en escritorios de la oficina principal — los agentes se asignan automáticamente al conectarse:

```
Seat 1: (3, 6)  facing up   — fila delantera izquierda
Seat 2: (8, 6)  facing up   — fila delantera derecha
Seat 3: (3, 12) facing up   — fila trasera izquierda
Seat 4: (8, 12) facing up   — fila trasera derecha
```

### Reacciones de personajes a eventos de Claude Code

| Evento | Reacción visual |
|--------|-----------------|
| `agentAdded` | Entra caminando desde la zona inferior de la oficina hasta su escritorio asignado |
| `toolStart` (Write/Edit/Bash) | Animación de teclear (`type` state — brazos hacia adelante) |
| `toolStart` (Read/Grep/Glob) | Animación de leer (`read` state — brazos levantados con libro) |
| `toolEnd` | Vuelve a `idle` |
| `turnEnd` | Muestra burbuja ✅, camina a zona de descanso (alfombra central), espera 5 s |
| Retorno de break (timer 5 s) | Camina de vuelta a su escritorio, se orienta hacia el monitor |
| `turnEnd` seguido de `toolStart` | Cancela el break, corre a casa, empieza a animar cuando llega |
| `permissionRequest` | Burbuja de permiso ❓, estado `waiting` |
| `rateLimitEnter` | Burbuja `zzz`, flag `isRateLimited` |
| `rateLimitExit` | Limpia burbuja |
| `contextUpdate` | Barra de contexto bajo el personaje (verde → amarillo → rojo) |
| `kanbanTaskAssigned` | Texto del task en burbuja durante `SPEECH_BUBBLE_DURATION_MS` |

### Sistema de walk-behavior (Character type)

Campos nuevos en `Character`:

```typescript
homePosition?: Position;       // escritorio asignado — destino de retorno
targetFacingDir?: FacingDir;   // dirección al terminar el walk actual
pendingState?: CharacterState; // estado a aplicar al terminar el walk
returnHomeAt?: number;         // timestamp — cuándo volver del break
```

Lógica en `updateCharacters` (characters.ts):
- Al terminar un `targetPath`, aplica `targetFacingDir` (o `'up'` por defecto)
- Aplica `pendingState` si existe, si no `'idle'`

---

## Pendiente / TODO

### Alta prioridad

- [x] **Ajuste de spawn point**: Implementado constante `ENTRANCE_POSITION` en `officeState.ts`. El spawn ahora usa posición explícita `(7, 14)` con spread de ±2 tiles para múltiples agentes.
- [x] **Evitar colisiones entre personajes en movimiento**: BFS ahora acepta parámetro `otherCharacters` y considera posiciones de otros agentes como obstáculos dinámicos. Actualizadas todas las llamadas en `gameLoop.ts` y `officeState.ts`.
- [x] **Sala de conferencias para reuniones multi-agente**: Implementado sistema de reuniones. Cuando ≥ 2 agentes están en `idle` simultáneamente, se caminan a `CONFERENCE_SPOTS` en sala de conferencias. Funciones `checkAndTriggerMeeting()` y `dismissMeeting()` en `gameLoop.ts`.

### Media prioridad

- [ ] **Más variedad de tiles Kenney**: Las coordenadas del tileset `roguelikeIndoor_transparent.png` solo cubren ~18 tiles. Hay 27×18=486 tiles disponibles. Identificar visualmente: sofás, ordenadores encima de mesa, papelera, pizarra, nevera.
- [ ] **Animación de llegada al escritorio**: Cuando el personaje llega a su seat, mostrar una pequeña animación de "sentarse" (cambio de facingDir momentáneo).
- [ ] **Zona de pizarra / monitor grande** en sala de conferencias para mostrar el turno de trabajo activo.
- [ ] **Subagentes que caminan** cerca del personaje padre en vez de aparecer en posición fija.

### Baja prioridad / mejoras estéticas

- [ ] **Tiles de pared diferenciados** entre paredes exteriores y divisores internos (mismo estilo ahora).
- [ ] **Iluminación dinámica**: suelo más oscuro en bordes, más claro en centro (radial gradient sobre canvas).
- [ ] **Reloj en tiempo real** — actualizar las manecillas con `Date.now()` en cada frame en lugar de posición fija 10:10.
- [ ] **Personaje idle con micro-animaciones**: cuando está en `idle` durante >5 s, girar la cabeza, estirar brazos aleatoriamente.
- [ ] **Sonido ambiental** (ya existe flag `soundEnabled` en settings).
- [ ] **Zoom por defecto**: con 24×17 tiles a 16 px y zoom=2, el canvas necesita ~768×544 px. Considerar ajuste automático al tamaño del panel.

---

## Archivos clave modificados

| Archivo | Qué hace |
|---------|----------|
| `webview-ui/src/office/types.ts` | `TileType` añade `'floor2'` y `'carpet'`; `Character` añade campos de walk-behavior + `isInMeeting` |
| `webview-ui/src/office/engine/officeState.ts` | Grid 24×17, layout multi-sala, 4 seats por defecto, spawn walk en `addCharacter`, `ENTRANCE_POSITION` constante |
| `webview-ui/src/office/engine/characters.ts` | `updateCharacters` aplica `targetFacingDir` y `pendingState` al terminar walk; `bfsPath` acepta `otherCharacters` |
| `webview-ui/src/office/engine/gameLoop.ts` | `processMessageQueue` wires up break walk, rush home, `returnHomeAt` timer; `checkAndTriggerMeeting()`, `dismissMeeting()`, `CONFERENCE_SPOTS` |
| `webview-ui/src/office/engine/renderer.ts` | Render de `floor2`/`carpet`; `renderOfficeDecorations` multi-sala completa |
| `webview-ui/src/office/sprites/kenneySprites.ts` | Sin cambios (tiles ya correctos) |
