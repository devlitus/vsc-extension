# Pixel Agents — Product Specification

> "La primera interfaz donde los equipos ven, entienden y dirigen sus agentes IA como si fueran compañeros de equipo reales."

---

## 1. Problema

Los desarrolladores que usan agentes IA hoy tienen el mismo problema: **los agentes son invisibles**. Se ejecutan en terminales, generan logs ilegibles, y cuando algo va mal — o cuando se necesita redirigirlos — no hay forma natural de intervenir. Gestionar varios agentes en paralelo es caótico. No hay visión de conjunto.

El resultado: los equipos infrautilizan sus agentes, desconfían de ellos, o los abandonan tras la primera experiencia frustrante.

---

## 2. Solución

Pixel Agents convierte cada agente en un **personaje visible** en una oficina interactiva. Puedes ver qué está haciendo, cuánto contexto le queda, si está bloqueado esperando tu respuesta, o si lleva 10 minutos en bucle. Puedes interrumpirlo, redirigirlo, o asignarle una tarea nueva — todo sin tocar la terminal.

El objetivo final es que gestionar agentes IA se sienta tan natural como gestionar un equipo humano en Slack, pero con la inmediatez visual de un videojuego.

---

## 3. Usuarios Objetivo

### Persona A — El desarrollador solo ("el vibe coder")
- Usa Claude Code o similar a diario para acelerar su trabajo personal
- Lanza 2-4 agentes en paralelo en proyectos distintos
- **Problema**: pierde el hilo de qué está haciendo cada agente; tarda más en revisar logs que en hacer el trabajo él mismo
- **Lo que necesita**: ver el estado de todos sus agentes de un vistazo sin cambiar de contexto

### Persona B — El tech lead de equipo pequeño (3-8 devs)
- Coordina un equipo donde varios desarrolladores usan agentes
- Quiere visibilidad sobre qué están haciendo los agentes del equipo, cuántos tokens consumen, y cuándo intervenir
- **Problema**: no hay herramienta que le dé esa visión agregada; cada dev gestiona sus agentes en su propia terminal
- **Lo que necesita**: una vista compartida del "trabajo en curso" de todos los agentes del proyecto

### Persona C — El contributor / entusiasta de open source
- Le gusta personalizar su entorno de desarrollo
- Quiere temas visuales, personajes propios, muebles custom
- **Problema**: las herramientas de productividad son genéricas y aburridas
- **Lo que necesita**: un sistema de extensión sencillo para crear y compartir su propio estilo

---

## 4. Jobs to Be Done

| Situación | Motivación | Resultado esperado |
|-----------|------------|--------------------|
| Tengo 3 agentes corriendo y no sé cuál está parado | Quiero saber a cuál prestar atención sin mirar 3 terminales | Ver de un vistazo cuál tiene una burbuja de "esperando" |
| Un agente lleva mucho tiempo sin avanzar | Quiero detectar bucles o bloqueos antes de perder tokens | Una señal visual clara de que el agente está atascado |
| Quiero asignar una tarea a un agente libre | Quiero hacerlo rápido, sin escribir prompts desde cero | Arrastrar una tarjeta del tablero al personaje |
| Termino de trabajar y quiero un resumen del día | Quiero saber qué produjo cada agente y cuántos tokens costó | Panel de historial por agente con resumen del turno |
| Quiero usar un proveedor de IA distinto a Claude | No quiero depender de un solo vendor | Selector de adaptador al lanzar un agente |

---

## 5. Propuesta de Valor por Segmento

| Segmento | Propuesta |
|----------|-----------|
| Devs individuales | "Tienes tu propia oficina de agentes. Sabes exactamente qué están haciendo y puedes intervenir en segundos." |
| Equipos | "Vista compartida del trabajo en curso de todos los agentes del proyecto, como un tablero Kanban pero vivo." |
| Comunidad | "Crea tu propio estilo: personajes, muebles, temas. Compártelo con otros." |

---

## 6. Funcionalidades — Priorización MoSCoW

### Must Have (base del producto)
- Personaje por agente con animación según actividad (typing, reading, waiting, idle)
- Speech bubble cuando el agente espera input o permiso
- Indicador visual de contexto usado (tokens)
- Soporte para múltiples agentes en paralelo
- Funciona con Claude Code sin configuración extra

### Should Have (diferenciación clave)
- Panel de inspección al hacer click en un personaje (modelo, directorio, herramientas usadas, tiempo de turno)
- Botones Interrumpir / Chat / Redirigir desde el panel
- Tablero Kanban en la oficina con asignación manual de tareas
- Visualización de sub-agentes vinculados al padre
- Barra de rate limit visible

### Could Have (enriquecimiento)
- Asignación autónoma de tareas cuando el agente queda idle
- Integración con GitHub Issues como fuente del Kanban
- Salas temáticas por proyecto dentro de la oficina
- Historial de turnos previos por agente
- Notificaciones a Slack/Discord cuando un agente termina o se bloquea

### Won't Have (por ahora)
- IA propia dentro de Pixel Agents (no somos un agente, somos la interfaz)
- Modificación del comportamiento de los agentes sin consentimiento explícito
- Almacenamiento en la nube obligatorio
- Soporte móvil

---

## 7. Métricas de Éxito

### Adopción
- **Instalaciones activas** (semana 1 después de lanzar una feature nueva): objetivo +20% MoM
- **Retención a 30 días**: >40% de los usuarios que instalan siguen activos al mes
- **Tiempo hasta primer agente lanzado**: <2 minutos desde instalar la extensión

### Valor percibido
- **NPS** en GitHub Discussions: >50
- **Issues de "bug" vs. "feature request"**: ratio <1:3 (más peticiones de mejoras que bugs)
- **Stars en GitHub**: indicador de resonancia, objetivo 1k en 6 meses post-lanzamiento de v2

### Calidad técnica
- **Crash rate**: <0.5% de sesiones con error no manejado
- **Performance**: sin drops de frame con 10 agentes activos simultáneos
- **Cold start**: extensión lista en <500ms

---

## 8. Milestones de Producto

### M1 — "Un agente, todo claro" (en curso)
El usuario puede lanzar un agente y ver su estado visual en tiempo real. Sabe cuándo espera, cuándo trabaja, cuándo termina. Funciona sin configuración.

**Progreso**: detección de agentes y parsing JSONL completados (Phase 1 + 2). Pendiente: animación de personajes (Phase 4) y detección precisa de turnos via hooks (Phase 3).

**Criterio de salida**: un usuario nuevo puede instalar la extensión y ver a su agente animarse en < 5 minutos.

---

### M2 — "Multi-agente, sin caos" (en curso)
El usuario puede gestionar varios agentes en paralelo y saber de un vistazo a cuál prestar atención.

**Features**:
- Sub-agentes vinculados visualmente al padre
- Etiquetas siempre visibles (modo `alwaysShowLabels`)
- Debug view para diagnosticar problemas de conexión
- Watch all sessions (agentes de todos los proyectos)

**Criterio de salida**: un usuario con 5 agentes activos puede identificar cuál necesita atención en < 3 segundos sin mirar ninguna terminal.

---

### M3 — "Hazlo tuyo" (próximo)
El usuario puede personalizar la oficina con assets propios y compartirla con su equipo.

**Features**:
- Soporte de directorios externos de assets
- Sistema de temas (pixel-office, cyberpunk, fantasy)
- Editor de manifiestos para crear assets propios
- Pack de assets de la comunidad descargable

**Criterio de salida**: un contributor no técnico puede crear y compartir un pack de muebles siguiendo solo la documentación, sin tocar el código fuente.

---

### M4 — "Agente bajo control" (roadmap)
El usuario puede inspeccionar y dirigir cualquier agente desde la UI, sin abrir una terminal.

**Features**:
- Panel de inspección con métricas, herramientas usadas, system prompt
- Botones Interrumpir / Chat / Redirigir
- Historial de turnos
- Árbol de sub-agentes expandible

**Criterio de salida**: el usuario puede interrumpir un agente bloqueado y darle nuevas instrucciones en < 10 segundos, sin salir del panel de Pixel Agents.

---

### M5 — "El equipo trabaja junto" (roadmap)
Los equipos pueden coordinar tareas entre agentes usando un tablero integrado en la oficina.

**Features**:
- Tablero Kanban en la pared de la oficina
- Integración con GitHub Issues
- Asignación manual arrastrando tarjeta al personaje
- Asignación autónoma cuando el agente queda idle

**Criterio de salida**: un tech lead puede asignar 3 tareas de GitHub Issues a 3 agentes distintos en < 1 minuto, desde la UI de Pixel Agents.

---

### M6 — "Elige tu agente" (roadmap)
El usuario no está atado a Claude Code. Puede usar el proveedor de IA que prefiera.

**Features**:
- Núcleo agnóstico extraído como paquete separado
- Adaptador para OpenAI Codex / GPT-4o
- Adaptador para Gemini
- Selector de adaptador al lanzar un agente

**Criterio de salida**: un usuario puede lanzar un agente GPT-4o y un agente Claude en la misma oficina, sin diferencia visible en la experiencia.

---

## 9. Riesgos y Supuestos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Claude Code cambia el formato JSONL y rompe la detección | Media | Alto | Documentar el contrato, añadir tests de parsing, reaccionar rápido a cambios upstream |
| Los usuarios no encuentran valor en la visualización vs. la terminal | Media | Alto | Early feedback con usuarios reales antes de invertir en M4/M5 |
| Añadir adaptadores de otros proveedores es mucho más complejo de lo esperado | Alta | Medio | Extraer el core en M6, no antes — validar el modelo de adaptadores con un prototipo interno primero |
| La comunidad de assets no despega sin incentivos | Media | Bajo | Lanzar con 3 temas oficiales de calidad; usar el foro de Discussions para incentivar contribuciones |

**Supuestos clave**:
- Los usuarios de Claude Code quieren visibilidad, no solo velocidad
- El modelo de negocio sostenible son temas/assets premium, no el core
- La comunidad open source puede mantener adaptadores para proveedores secundarios

---

## 10. Lo que NO es Pixel Agents

Para mantener el foco es tan importante saber qué no somos:

- **No somos un orquestador de agentes**: no decidimos qué hace cada agente ni cuándo. Solo mostramos y facilitamos.
- **No somos un IDE**: no competimos con VS Code, Cursor ni ningún editor.
- **No somos una capa de abstracción de LLMs**: no reemplazamos las APIs de los modelos ni añadimos prompts propios.
- **No somos un producto de datos**: no almacenamos, analizamos ni vendemos el contenido de las sesiones de los usuarios.
