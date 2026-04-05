# Phase 5 — Polish

Objetivo: completar la experiencia de usuario con settings, sonido, sub-agentes, assets externos y distribución.

## Archivos a crear / modificar

### webview-ui/src/components/SettingsModal.tsx

Modal accesible desde `BottomToolbar`. Opciones:

| Setting | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `soundEnabled` | boolean | false | Notificación de sonido al completar turno |
| `soundVolume` | number 0-1 | 0.5 | Volumen |
| `externalAssetsDir` | string | '' | Ruta a directorio de furniture pack externo |
| `showAgentIds` | boolean | false | Mostrar ID numérico sobre personajes |
| `showToolStatus` | boolean | true | Mostrar burbuja con nombre de herramienta activa |

El webview envía `{ type: 'saveSettings', settings }` a la extensión; la extensión persiste via `context.globalState`.

Al abrir, la extensión envía `{ type: 'settingsLoaded', settings }`.

### webview-ui/src/components/ChangelogModal.tsx

Modal con historial de versiones. Datos en `webview-ui/src/changelogData.ts`:
```ts
export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}
export const CHANGELOG: ChangelogEntry[];
```

Se muestra automáticamente una vez tras actualización de versión (comparar versión guardada en `globalState` con la del `package.json`).

### webview-ui/src/components/VersionIndicator.tsx

Badge pequeño en la esquina del panel con la versión actual. Click abre `ChangelogModal`.

### Sonido (webview-ui/src/office/engine/sound.ts)

```ts
export function playTurnComplete(volume: number): void;
export function playAgentSpawn(volume: number): void;
```

Usar `AudioContext` API del navegador. Generar tonos sintéticos (sin archivos de audio externos) para evitar assets adicionales:
- Turno completado: dos beeps cortos ascendentes
- Spawn de agente: tono suave

### Efecto Matrix (webview-ui/src/office/matrixEffect.ts)

Para sub-agentes (id negativo):

```ts
export interface MatrixEffect {
  x: number;
  y: number;
  chars: string[];
  progress: number;   // 0-1
  duration: number;   // ms
}

export function createMatrixEffect(x: number, y: number): MatrixEffect;
export function updateMatrixEffect(effect: MatrixEffect, dt: number): boolean; // false cuando termina
export function renderMatrixEffect(ctx: CanvasRenderingContext2D, effect: MatrixEffect, zoom: number): void;
```

Cascada de caracteres verdes (0-9, A-Z) que cae sobre el tile de spawn durante `MATRIX_EFFECT_MS`. Al terminar, el personaje aparece normalmente.

### Assets externos (src/assetLoader.ts — ampliar)

Leer directorio externo configurado en settings:
1. Buscar `furniture.json` (manifiesto del pack)
2. Cargar sprites PNG referenciados
3. Mergear con catálogo bundled (los externos tienen prefijo `ext_` en su ID)

Formato `furniture.json` del pack externo:
```json
{
  "version": 1,
  "items": [
    {
      "id": "my_desk",
      "name": "Custom Desk",
      "sprite": "my_desk.png",
      "width": 2,
      "height": 1,
      "walkable": false
    }
  ]
}
```

### Comando exportDefaultLayout

Implementar `exportDefaultLayout()` en `PixelAgentsViewProvider`:
- Leer layout actual de `~/.pixel-agents/layout.json`
- Copiarlo a `dist/assets/default-layout.json` (se distribuye con la extensión)
- Mostrar `vscode.window.showInformationMessage('Default layout exported')`

### MigrationNotice.tsx

Banner temporal que aparece si el formato de layout cambió entre versiones:
- Detectar via `layout.version < CURRENT_VERSION`
- Ofrecer "Migrate" (llamar `migrateLayout`) o "Reset to default"

### Tooltip.tsx

Componente reutilizable de tooltip para botones del editor y toolbar.

### Debug view (webview-ui/src/components/DebugView.tsx)

Vista de debug accesible via `?debug=1` en la URL del webview o un setting oculto:
- Lista de agentes activos con estado
- Últimos 20 mensajes recibidos
- Estadísticas: frames por segundo, tiles renderizados

---

## Distribución (docs/package-extension.md ya existe)

Tareas finales antes de publicar:
1. Añadir `icon.png` (128×128, PNG) al root
2. Rellenar `README.md` con screenshots y GIFs
3. Añadir `CHANGELOG.md`
4. Configurar `.vscodeignore` para excluir `webview-ui/src/`, `server/src/`, `docs/`, `node_modules/`
5. `bunx @vscode/vsce package` → genera `.vsix`
6. Verificar instalación: `code --install-extension pixel-agents-x.x.x.vsix`

`.vscodeignore`:
```
webview-ui/src/
server/src/
docs/
src/
*.ts
!dist/**
node_modules/
.vscode/
bun.lock
tsconfig*.json
```

---

## Criterio de éxito
- Sub-agente aparece con efecto Matrix verde
- Sonido suena al completar turno (si habilitado)
- Assets externos se cargan desde directorio configurado
- El `.vsix` generado instala y funciona sin errores
- No hay `console.error` en la consola del webview tras 5 minutos de uso normal
