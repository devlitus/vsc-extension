# Phase 1 — Skeleton

Objetivo: extensión VSCode que carga un webview en el panel lateral con un `<canvas>` vacío. Sin lógica, solo que arranque.

## Entregables

### package.json (raíz)
Reemplazar el actual por un manifest de extensión VSCode válido:
- `engines.vscode: "^1.105.0"`
- `activationEvents: ["onStartupFinished"]`
- `main: "./dist/extension.js"`
- `contributes.commands`: `pixel-agents.showPanel`, `pixel-agents.exportDefaultLayout`
- `contributes.views`: panel `pixel-agents` en `activitybar`
- `devDependencies`: `@types/vscode`, `typescript`
- Scripts:
  - `build:ext` → `bun build src/extension.ts --target=node --format=cjs --outfile=dist/extension.js`
  - `build:webview` → `bun build webview-ui/src/main.tsx --outfile=dist/webview/main.js --minify`
  - `build` → `bun run build:ext && bun run build:webview`
  - `watch` → ambos en paralelo con `--watch`

### tsconfig.json (raíz)
Para la extensión: `target: ES2020`, `module: CommonJS`, `lib: [ES2020]`, `strict: true`, `outDir: dist`, excluir `webview-ui/`.

### webview-ui/tsconfig.json
Para el webview: `target: ES2020`, `module: ESNext`, `moduleResolution: bundler`, `jsx: react-jsx`, `lib: [ES2020, DOM]`.

### src/extension.ts
```ts
import * as vscode from 'vscode';
import { PixelAgentsViewProvider } from './PixelAgentsViewProvider';

let providerInstance: PixelAgentsViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  providerInstance = new PixelAgentsViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PixelAgentsViewProvider.viewType, providerInstance),
    vscode.commands.registerCommand('pixel-agents.showPanel', () => providerInstance?.focus()),
    vscode.commands.registerCommand('pixel-agents.exportDefaultLayout', () => providerInstance?.exportDefaultLayout()),
  );
}

export function deactivate() {
  providerInstance?.dispose();
}
```

### src/PixelAgentsViewProvider.ts
Implementa `vscode.WebviewViewProvider`:
- `static viewType = 'pixel-agents'`
- `resolveWebviewView(webviewView)`: habilita scripts, llama a `getHtmlForWebview()`
- `getHtmlForWebview()`: HTML inline que carga `dist/webview/main.js` via `webviewView.webview.asWebviewUri()`
- `focus()`: llama a `webviewView.show()`
- `exportDefaultLayout()`: no-op por ahora
- `dispose()`: limpieza de subscripciones

### webview-ui/src/main.tsx
```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

### webview-ui/src/App.tsx
Componente mínimo: `<canvas id="office-canvas" />` que ocupa 100% del viewport. Sin lógica.

### .vscode/launch.json
Configuración F5 para Extension Development Host:
```json
{
  "version": "0.2.0",
  "configurations": [{
    "name": "Run Extension",
    "type": "extensionHost",
    "request": "launch",
    "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
    "preLaunchTask": "build"
  }]
}
```

### .vscode/tasks.json
Tarea `build` que ejecuta `bun run build`.

## Criterio de éxito
- `bun run build` compila sin errores
- F5 abre Extension Development Host
- El panel "Pixel Agents" aparece en la activity bar
- El canvas ocupa el panel (fondo negro o blanco, sin errores en consola)
