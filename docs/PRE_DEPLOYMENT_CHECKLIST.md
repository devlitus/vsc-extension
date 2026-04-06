# Pre-Deployment Checklist — Pixel Agents v0.0.1

## Orden de ejecución

```bash
1. bun run test          # todos los tests deben pasar
2. bun audit             # sin vulnerabilidades críticas
3. bun run package       # genera .vsix sin errores
4. instalar .vsix en VS Code limpio + testing manual (ver sección abajo)
```

---

## 1. Tests automatizados

- [ ] `bun run test` — todos los tests pasan (webview + server)
- [ ] `bun run test:server` — tests unitarios en `server/__tests__/`
- [ ] `bun run test:webview` — tests de componentes en `webview-ui/test/`

---

## 2. Build

- [x] Build completa sin errores (`bun run build`)
- [x] Bundle de extensión generado (`dist/extension.js` — 82KB, < 100KB)
- [x] Bundle de webview generado (`dist/webview/main.js` — 450KB, < 500KB)
- [x] TypeScript compila en código de producción (errores solo en archivos de test, no bloquean)

---

## 3. Seguridad

- [x] Sin credenciales hardcodeadas (usa `crypto.randomBytes` y VS Code secrets API)
- [x] Sin `eval()` en código fuente (solo en type definitions de node_modules)
- [x] Permisos de archivos correctos (0o600 para configs, 0o700 para directorios)
- [x] CSP configurada con nonces (`src/PixelAgentsViewProvider.ts:726`)
- [x] Protección path traversal en `isSafePath()` (`src/fileWatcher.ts:14-23`)
- [x] Protección timing attack en `crypto.timingSafeEqual()` (`src/server/server.ts:200-215`)
- [x] Protección prototype pollution en `deepCloneWithProtection()` (`src/transcriptParser.ts:7-60`)
- [x] Sanitización de input en `sanitizeString()` e `isSafeKanbanBoard()` (`src/PixelAgentsViewProvider.ts:44-123`)
- [x] Validación de origen en hook requests (`src/server/server.ts:173-189`)
- [x] Rate limiting GitHub sync — cooldown 60s (`src/PixelAgentsViewProvider.ts:438-446`)
- [x] Verificación PID para prevenir ataques de reutilización (`src/server/server.ts:327-338`)

---

## 4. Dependencias

- [ ] `bun audit` — sin vulnerabilidades críticas
  - ⚠️ Conocido: `esbuild <=0.24.2` (moderate, solo devDependency vía vitest, no bloquea)
  - Resolver con `bun update vitest` antes del despliegue si es posible

---

## 5. Empaquetado

- [ ] `bun run package` — genera `.vsix` sin errores
- [ ] Archivo `.vsix` creado correctamente
- [ ] Tamaño del `.vsix` razonable

**Prerequisito:** `vsce` debe estar instalado:
```bash
npm install -g @vscode/vsce
```

---

## 6. Testing manual en VS Code limpio

Instalar el `.vsix` generado:
```bash
code --install-extension pixel-agents-0.0.1.vsix
```

### Flujos críticos a verificar

**Activación:**
- [ ] La extensión activa al abrir VS Code (`onStartupFinished`)
- [ ] El icono de Pixel Agents aparece en la Activity Bar
- [ ] Sin errores en Output > Extension Host

**Servidor HTTP y hooks:**
- [ ] El servidor HTTP levanta en `127.0.0.1` (puerto aleatorio, visible en logs)
- [ ] Se instalan los hooks en `~/.claude/settings.json`
- [ ] El archivo `~/.pixel-agents/server.json` se crea con permisos 0o600
- [ ] Al desactivar la extensión, los hooks se desinstalan

**FileWatcher:**
- [ ] Detecta cambios en `~/.claude/projects/<project-hash>/<session-uuid>.jsonl` (polling cada 500ms)
- [ ] Los agentes aparecen en el canvas al iniciar una sesión de Claude Code

**Game loop y canvas:**
- [ ] Los personajes se renderizan en el canvas
- [ ] Los personajes se mueven con pathfinding BFS
- [ ] El canvas corre a ~60fps sin freezes

**Panel de inspección:**
- [ ] Clic en un personaje abre el panel de inspección
- [ ] El panel muestra datos correctos del agente (id, estado, herramientas activas)

**Kanban board:**
- [ ] Se pueden crear tareas
- [ ] Se pueden mover tareas entre columnas
- [ ] Se pueden eliminar tareas
- [ ] Los cambios persisten en disco (verificar `~/.pixel-agents/kanban.json`)

**Webview DevTools** (Ctrl+Shift+I en el panel):
- [ ] Sin errores en la consola
- [ ] Sin drops significativos de animation frames

---

## 7. Performance

- [ ] Memoria < 200MB en idle
- [ ] CPU < 5% en idle
- [ ] El file polling no causa freezes en la UI
- [ ] Sin memory leaks tras uso extendido (revisar en DevTools > Memory)

---

## 8. Issues conocidos

### Medio (no bloquea despliegue)
- `src/PixelAgentsViewProvider.ts:344-354` — resolución de ruta de Claude CLI inline en lugar de método dedicado `getClaudeExecutablePath()`. Funciona correctamente, deuda técnica para post-release.

### Dev dependency (no bloquea despliegue)
- `esbuild <=0.24.2` via `vitest > vite-node > vite`. Solo afecta al dev server, no al build de producción.

---

## 9. Pasos de release

- [ ] Actualizar `CHANGELOG.md` con los cambios de esta versión
- [ ] Verificar versión en `package.json` (actualmente `0.0.1`)
- [ ] Crear tag de release:
  ```bash
  git tag -a v0.0.1 -m "Release v0.0.1"
  git push origin v0.0.1
  ```
- [ ] Publicar en VS Code Marketplace:
  ```bash
  vsce publish
  ```
- [ ] Crear GitHub release con notas de la versión

---

**Decisión Go/No-Go:** ✅ LISTO PARA DESPLIEGUE — pendiente completar los pasos sin marcar arriba.
