# Investigación: Requisitos para Crear Extensión de VSCode

## 1. Resumen

Para crear una extensión de VSCode se requiere Node.js (versiones LTS 18, 20 o 22+), npm, Git, y opcionalmente Yeoman con el generador `generator-code`. Las extensiones se estructuran alrededor de un `package.json` con campos específicos de VSCode, un archivo de entrada que exporta las funciones `activate` y `deactivate`, y opcionalmente archivos de contribución.

---

## 2. Requisitos del Entorno de Desarrollo

| Requisito | Versión Mínima | Notas |
|-----------|----------------|-------|
| **Node.js** | LTS 18, 20, 22+ | Se recomiendan versiones LTS |
| **npm** | v8+ | Viene incluido con Node.js |
| **Git** | - | Para control de versiones |
| **TypeScript** | ^3.4.5 | Como devDependency |
| **VSCode** | Última versión estable | Para pruebas y debugging |
| **Yeoman + generator-code** | - | Para scaffolding: `npm install -g yo generator-code` |

---

## 3. Herramientas Necesarias

### 3.1 vsce (Visual Studio Code Extensions CLI)

La herramienta CLI oficial para publicar y gestionar extensiones.

```bash
npm install -g @vscode/vsce
```

**Comandos principales:**

| Comando | Descripción |
|---------|-------------|
| `vsce package` | Genera un archivo `.vsix` instalable |
| `vsce publish` | Publica la extensión en el Marketplace |
| `vsce login` | Inicia sesión para publicar |
| `vsce help` | Muestra ayuda de todos los comandos |

### 3.2 Yeoman Generator (`yo code`)

Genera automáticamente la estructura base de una extensión con scaffolding interactivo.

```bash
npm install -g yo generator-code
yo code
```

---

## 4. Estructura de Archivos de una Extensión

```
mi-extension/
├── .vscode/
│   ├── launch.json      # Configuración de debugging (F5)
│   ├── tasks.json       # Tareas de compilación
│   └── extensions.json  # Extensiones recomendadas
├── src/
│   └── extension.ts     # Punto de entrada principal
├── package.json         # Manifiesto de la extensión
├── tsconfig.json        # Configuración de TypeScript
├── README.md            # Documentación
├── CHANGELOG.md         # Historial de cambios
├── LICENSE.txt          # Licencia
└── .gitignore           # Archivos ignorados por git
```

### Descripción de archivos clave:

- **`package.json`**: Manifiesto con metadatos, dependencias y puntos de contribución
- **`src/extension.ts`**: Punto de entrada que exporta `activate` y `deactivate`
- **`tsconfig.json`**: Configuración del compilador TypeScript
- **`.vscode/launch.json`**: Configuración para depurar con F5

---

## 5. Lenguajes de Programación Soportados

| Lenguaje | Soporte | Recomendación |
|----------|---------|---------------|
| **TypeScript** | Completo | **RECOMENDADO** - Mejor IntelliSense y type checking |
| **JavaScript** | Completo | Soportado completamente |
| **WebAssembly** | Parcial | Solo para casos especiales de rendimiento |

> **Nota:** TypeScript es el lenguaje recomendado oficialmente por Microsoft para desarrollo de extensiones debido a su mejor integración con el API de VSCode y las herramientas de desarrollo.

---

## 6. APIs Principales de VSCode (VS Code API)

### Namespaces Principales

| Namespace | Descripción |
|-----------|-------------|
| `vscode.commands` | Registrar y ejecutar comandos |
| `vscode.window` | Mostrar mensajes, input boxes, quick picks, crear UI |
| `vscode.workspace` | Acceso a archivos, configuración, eventos |
| `vscode.languages` | Proveedores de características de lenguaje |
| `vscode.debug` | Gestión de depuración |
| `vscode.extensions` | Acceso a extensiones instaladas |

### Ejemplo básico de uso del API:

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    // Registrar un comando
    const disposable = vscode.commands.registerCommand(
        'mi-extension.holaMundo',
        () => {
            vscode.window.showInformationMessage('¡Hola Mundo!');
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {}
```

---

## 7. Tipos de Extensiones

| Tipo | Descripción |
|------|-------------|
| **Extensiones de Comandos (Commands)** | Las más comunes; añaden comandos al palette |
| **Themes de Color** | Personalizan la apariencia del editor |
| **File Icon Themes** | Cambian los iconos de archivos |
| **Snippets** | Plantillas de código reutilizable |
| **Language Extensions** | Añaden soporte para lenguajes |
| **Debugger Extensions** | Añaden nuevos debuggers |
| **Web Extensions** | Para github.dev y vscode.dev |
| **Extension Packs** | Bundles que instalan múltiples extensiones |

---

## 8. Manifest (`package.json`) - Campos Requeridos

### Campos Obligatorios

| Campo | Tipo | Ejemplo | Descripción |
|-------|------|---------|-------------|
| `name` | `string` | `"mi-extension"` | Minúsculas, sin espacios |
| `version` | `string` | `"1.0.0"` | SemVer (SemVer: major.minor.patch) |
| `publisher` | `string` | `"mi-publisher"` | ID del publisher en Marketplace |
| `engines` | `object` | `{ "vscode": "^1.80.0" }` | Versión mínima de VSCode |

### Campos Importantes

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `displayName` | `string` | Nombre visible en el Marketplace |
| `description` | `string` | Descripción de la extensión |
| `main` | `string` | Ruta al archivo compilado (`.js`, no `.ts`) |
| `activationEvents` | `array` | Eventos que activan la extensión |
| `contributes` | `object` | Puntos de contribución del IDE |

### Ejemplo de `package.json`:

```json
{
    "name": "mi-primera-extension",
    "displayName": "Mi Primera Extensión",
    "publisher": "mi-publisher",
    "version": "1.0.0",
    "description": "Una extensión de ejemplo para VSCode",
    "main": "./dist/extension.js",
    "engines": {
        "vscode": "^1.80.0"
    },
    "activationEvents": [
        "onCommand:mi-extension.helloWorld"
    ],
    "contributes": {
        "commands": [
            {
                "command": "mi-extension.helloWorld",
                "title": "Hola Mundo"
            }
        ]
    }
}
```

---

## 9. Debugging y Testing

### 9.1 Debugging

1. Presionar **F5** para iniciar el **Extension Development Host**
2. Se abre una nueva ventana de VSCode con la extensión cargada
3. Los breakpoints en el código fuente funcionarán normalmente

### 9.2 Testing

Para tests de integración, usar la librería `@vscode/test-electron`:

```bash
npm install --save-dev @vscode/test-electron
```

**Configuración necesaria:**

```typescript
import * as testRunner from '@vscode/test-electron';

testRunner.runTests({
    testPath: path.join(__dirname, 'suite', 'index'),
    launchArgs: ['--disable-extensions']
});
```

### 9.3 Archivos de configuración

- **`.vscode/launch.json`**: Configuración del debugger
- **`.vscode/tasks.json`**: Tareas de compilación y build

---

## 10. Activation Events

Los eventos que determinan cuándo se activa la extensión:

| Evento | Ejemplo | Descripción |
|--------|---------|-------------|
| `onCommand` | `onCommand:mi-ext.cmd` | Cuando se ejecuta un comando |
| `onLanguage` | `onLanguage:javascript` | Cuando se abre archivo del lenguaje |
| `onView` | `onView:mi-vista` | Cuando se abre una vista específica |
| `workspaceContains` | `workspaceContains:**/*.ext` | Cuando el workspace contiene archivos |
| `onStartupFinished` | - | Después de iniciar VSCode |

**Ejemplo:**

```json
{
    "activationEvents": [
        "onCommand:mi-extension.saludo",
        "onLanguage:typescript",
        "workspaceContains:**/*.md"
    ]
}
```

---

## 11. Gotchas y Problemas Conocidos

| Problema | Descripción | Solución |
|----------|-------------|----------|
| **Imágenes SVG** | No se pueden usar imágenes SVG (excepto badges aprobados) | Usar PNG o iconos vectoriales permitidos |
| **Límite de keywords** | Máximo 30 keywords en el Marketplace | Seleccionar las 30 más relevantes |
| **Ruta del main** | Debe apuntar al archivo compilado (`.js`, no `.ts`) | Configurar correctamente en `package.json` |
| **Versionado de engines** | Usar `^` para compatibilidad | `"vscode": "^1.80.0"` en lugar de `"1.80.0"` |
| **Testing en Windows** | Puede tener problemas con atributos POSIX | Usar contenedores Docker o WSL |
| **Extensiones web** | Limitaciones en APIs disponibles | Verificar compatibilidad con web extensions |

---

## 12. Referencias

| Recurso | URL |
|---------|-----|
| Documentación oficial de VSCode API | <https://code.visualstudio.com/api> |
| Guía: Tu primera extensión | <https://code.visualstudio.com/api/get-started/your-first-extension> |
| Referencia: Extension Manifest | <https://code.visualstudio.com/api/references/extension-manifest> |
| Referencia: VS Code API | <https://code.visualstudio.com/api/references/vscode-api> |
| Ejemplos oficiales (microsoft/vscode-extension-samples) | <https://github.com/microsoft/vscode-extension-samples> |

---

## 13. Pasos Rápidos para Crear una Extensión

```bash
# 1. Instalar herramientas globales
npm install -g yo generator-code @vscode/vsce

# 2. Generar estructura base
yo code

# 3. Ingresar al directorio
cd mi-extension

# 4. Instalar dependencias
npm install

# 5. Abrir en VSCode
code .

# 6. Presionar F5 para debugging
```

---

*Documento creado para el proyecto vsc-extension.*
