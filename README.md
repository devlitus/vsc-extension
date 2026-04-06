# Work Agents — VS Code Extension

Live pixel-art office view of running Claude Code agents.

---

## Prerequisites

Install these once before anything else:

```bash
# Bun — runtime and bundler
curl -fsSL https://bun.sh/install | bash

# vsce — VS Code extension packager
npm install -g @vscode/vsce
```

---

## Setup

```bash
bun install
```

---

## Development (probar cambios sin instalar)

Usa este flujo cuando estás modificando el código y quieres probar cambios rápido.

**Paso 1 — Arrancar el watcher** (recompila automáticamente al guardar):

```bash
bun run watch
```

**Paso 2 — Abrir VS Code Extension Development Host:**

Pulsa `F5` en VS Code. Se abre una nueva ventana de VS Code con la extensión cargada desde el código fuente. Cada vez que el watcher recompila, recarga la ventana con `Ctrl+Shift+P → Developer: Reload Window`.

---

## Producción (construir e instalar la extensión)

Usa este flujo cuando quieres instalar la extensión como usuario final, o distribuirla.

**Paso 1 — Compilar:**

```bash
bun run build
```

Genera:
- `dist/extension.js` — código del extension host
- `dist/webview/main.js` — código del webview

**Paso 2 — Empaquetar en VSIX:**

```bash
vsce package
```

Genera `work-agents-0.0.1.vsix` en la raíz del proyecto.

**Paso 3 — Instalar en VS Code:**

```bash
code --install-extension work-agents-0.0.1.vsix
```

O desde VS Code: `Extensions (Ctrl+Shift+X)` → menú `···` → `Install from VSIX…`

**Paso 4 — Recargar VS Code.**

El icono de **Work Agents** aparece en la barra de actividad.

---

## Tests

```bash
bun run test           # todos los tests
bun run test:webview   # solo webview
bun run test:server    # solo servidor
```
