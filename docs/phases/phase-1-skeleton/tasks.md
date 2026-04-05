# Phase 1 — Skeleton: Tasks

## Tasks

- [x] 1. Configurar package.json
  1. Reemplazar package.json actual por manifest de extensión VSCode válido
  2. engines.vscode: "^1.105.0"
  3. activationEvents: ["onStartupFinished"]
  4. main: "./dist/extension.js"
  5. contributes.commands: pixel-agents.showPanel, pixel-agents.exportDefaultLayout
  6. contributes.views: panel pixel-agents en activitybar
  7. devDependencies: @types/vscode, typescript
  8. Scripts: build:ext, build:webview, build, watch

- [x] 2. Crear tsconfig.json raíz
  1. target: ES2020, module: CommonJS, lib: [ES2020]
  2. strict: true, outDir: dist
  3. Excluir webview-ui/

- [x] 3. Crear webview-ui/tsconfig.json
  1. target: ES2020, module: ESNext
  2. moduleResolution: bundler, jsx: react-jsx
  3. lib: [ES2020, DOM]

- [x] 4. Implementar src/extension.ts
  1. Entry point con activate() y deactivate()
  2. Registrar PixelAgentsViewProvider
  3. Registrar comandos: showPanel, exportDefaultLayout

- [x] 5. Implementar src/PixelAgentsViewProvider.ts
  1. Implementar WebviewViewProvider
  2. resolveWebviewView(): habilitar scripts, getHtmlForWebview()
  3. getHtmlForWebview(): HTML inline con dist/webview/main.js
  4. focus(): webviewView.show()
  5. exportDefaultLayout(): no-op
  6. dispose(): limpieza

- [x] 6. Crear webview-ui/src/main.tsx
  1. React entry point con createRoot

- [x] 7. Crear webview-ui/src/App.tsx
  1. Canvas mínimo #office-canvas al 100% viewport
  2. Sin lógica

- [x] 8. Configurar .vscode/launch.json
  1. Configuración F5 para Extension Development Host
  2. preLaunchTask: build

- [x] 9. Configurar .vscode/tasks.json
  1. Tarea build que ejecuta bun run build

- [x] 10. Verificar compilación
  1. bun run build compila sin errores

- [x] 11. Verificar runtime
  1. F5 abre Extension Development Host
  2. Panel "Pixel Agents" aparece en activity bar
  3. Canvas ocupa el panel (fondo negro o blanco, sin errores consola)
