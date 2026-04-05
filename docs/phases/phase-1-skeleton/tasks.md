# Phase 1 — Skeleton: Tasks

## Tasks

- [x] 1. Configure package.json
  1. Replace existing package.json with a valid VS Code extension manifest
  2. engines.vscode: "^1.105.0"
  3. activationEvents: ["onStartupFinished"]
  4. main: "./dist/extension.js"
  5. contributes.commands: pixel-agents.showPanel, pixel-agents.exportDefaultLayout
  6. contributes.views: pixel-agents panel in activitybar
  7. devDependencies: @types/vscode, typescript
  8. Scripts: build:ext, build:webview, build, watch

- [x] 2. Create root tsconfig.json
  1. target: ES2020, module: CommonJS, lib: [ES2020]
  2. strict: true, outDir: dist
  3. Exclude webview-ui/

- [x] 3. Create webview-ui/tsconfig.json
  1. target: ES2020, module: ESNext
  2. moduleResolution: bundler, jsx: react-jsx
  3. lib: [ES2020, DOM]

- [x] 4. Implement src/extension.ts
  1. Entry point with activate() and deactivate()
  2. Register PixelAgentsViewProvider
  3. Register commands: showPanel, exportDefaultLayout

- [x] 5. Implement src/PixelAgentsViewProvider.ts
  1. Implement WebviewViewProvider
  2. resolveWebviewView(): enable scripts, getHtmlForWebview()
  3. getHtmlForWebview(): inline HTML with dist/webview/main.js
  4. focus(): webviewView.show()
  5. exportDefaultLayout(): no-op
  6. dispose(): cleanup

- [x] 6. Create webview-ui/src/main.tsx
  1. React entry point with createRoot

- [x] 7. Create webview-ui/src/App.tsx
  1. Minimal #office-canvas at 100% viewport
  2. No logic

- [x] 8. Configure .vscode/launch.json
  1. F5 configuration for Extension Development Host
  2. preLaunchTask: build

- [x] 9. Configure .vscode/tasks.json
  1. Build task that runs bun run build

- [x] 10. Verify build
  1. bun run build compiles without errors

- [x] 11. Verify runtime
  1. F5 opens Extension Development Host
  2. "Pixel Agents" panel appears in activity bar
  3. Canvas fills the panel (black or white background, no console errors)
