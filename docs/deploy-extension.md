# Investigación: Deploy de Extensiones de VSCode

Este documento describe el proceso completo para publicar y distribuir extensiones de Visual Studio Code, incluyendo autenticación, herramientas, flujo de trabajo y alternativas de distribución.

---

## 1. Resumen

El **Visual Studio Marketplace** es la plataforma oficial respaldada por Microsoft/Azure DevOps para la distribución de extensiones de VSCode. La herramienta CLI principal para publicar extensiones es **vsce** (VS Code Extension).

La autenticación se realiza mediante **Personal Access Tokens (PAT)** de Azure DevOps. Las extensiones pasan por un proceso de revisión automatizado que incluye escaneo de malware y verificación de firma.

Como alternativa de código abierto existe **Open VSX Registry**, mantenida por la Eclipse Foundation y Red Hat.

---

## 2. Visual Studio Marketplace

La plataforma oficial para distribuir extensiones de VSCode se encuentra en [https://marketplace.visualstudio.com/vscode](https://marketplace.visualstudio.com/vscode).

### Características principales

| Característica | Descripción |
|----------------|-------------|
| Estadísticas | Adquisiciones, tendencias, calificaciones y reseñas |
| Seguridad | Escaneo de malware, verificación de firma, detección de secretos |
| Verified Publishers | Marca de verificación azul para publishers que verifican dominio |
| Integración | Integración directa con VS Code |

### Verified Publishers

Los publishers verificados reciben una marca de verificación azul en el Marketplace. Para obtenerla, es necesario verificar la propiedad del dominio mediante un registro DNS TXT.

---

## 3. Herramienta vsce

**vsce** (Visual Studio Code Extensions) es la herramienta CLI oficial para crear, validar y publicar extensiones.

### Requisitos previos

```bash
# Requisitos del sistema
Node.js >= 20.x.x
npm >= 6
```

### Instalación

```bash
npm install -g @vscode/vsce
```

### Comandos principales

| Comando | Descripción |
|---------|-------------|
| `vsce package` | Crea archivo `.vsix` desde la extensión |
| `vsce publish` | Publica directamente en el Marketplace |
| `vsce publish minor` | Auto-incrementa versión minor (1.0.0 → 1.1.0) |
| `vsce publish patch` | Auto-incrementa versión patch (1.1.0 → 1.1.1) |
| `vsce publish major` | Auto-incrementa versión major (1.1.1 → 2.0.0) |
| `vsce unpublish <id>` | Elimina la extensión del Marketplace |
| `vsce login <publisher>` | Almacena credenciales de forma segura |

---

## 4. Flujo de Publicación

### Paso 1: Crear un Personal Access Token (PAT) en Azure DevOps

1. Crear una cuenta en Azure DevOps si no existe
2. Ir a [https://go.microsoft.com/fwlink/?LinkId=307137](https://go.microsoft.com/fwlink/?LinkId=307137)
3. Acceder a **User settings** → **Personal access tokens** → **New Token**
4. Configurar **Organization**: `All accessible organizations`
5. En **Scopes**, seleccionar **Show all scopes** → **Marketplace** → **Manage**
6. **Importante**: Copiar el token inmediatamente, ya que no se puede recuperar posteriormente

### Paso 2: Crear un Publisher

1. Ir a [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
2. Iniciar sesión con la misma cuenta Microsoft utilizada para crear el PAT
3. Hacer clic en **"Create publisher"**
4. Definir:
   - **Publisher ID**: Identificador único (no editable después de crear)
   - **Publisher Name**: Nombre para mostrar

### Paso 3: Preparar la Extensión

El archivo `package.json` debe incluir las siguientes propiedades obligatorias:

```json
{
  "name": "mi-extension",
  "version": "1.0.0",
  "publisher": "mi-publisher-id",
  "engines": {
    "vscode": "^1.80.0"
  },
  "displayName": "Mi Extensión",
  "description": "Descripción de la extensión"
}
```

| Campo | Descripción |
|-------|-------------|
| `name` | Nombre único de la extensión |
| `version` | Versión semántica (MAJOR.MINOR.PATCH) |
| `publisher` | ID del publisher creado en el paso anterior |
| `engines` | Versión mínima de VS Code requerida |
| `displayName` | Nombre visible en el Marketplace |
| `description` | Descripción breve de la funcionalidad |

### Paso 4: Publicar la Extensión

**Publicación automática (recomendada):**

```bash
vsce publish
```

**Publicación manual:**

1. Generar el paquete:
   ```bash
   vsce package
   ```
2. Subir el archivo `.vsix` manualmente desde el portal del Marketplace

---

## 5. Auto-incrementar Versiones con SemVer

El comando `vsce publish` soporta auto-incremento de versiones mediante argumentos:

| Comando | Ejemplo | Resultado |
|---------|---------|-----------|
| `vsce publish minor` | 1.0.0 → | 1.1.0 |
| `vsce publish patch` | 1.1.0 → | 1.1.1 |
| `vsce publish major` | 1.1.1 → | 2.0.0 |
| `vsce publish 1.2.0` | (cualquiera) → | 1.2.0 |

---

## 6. Restricciones de Seguridad

El Marketplace aplica ciertas restricciones de seguridad:

| Restricción | Descripción |
|-------------|-------------|
| **SVG** | No permite imágenes SVG proporcionadas por el usuario (excepto badges aprobados) |
| **URLs** | Las URLs de imágenes deben usar HTTPS |
| **Iconos** | Los iconos deben estar en formato PNG |
| **Keywords** | Límite máximo de 30 keywords en package.json |

---

## 7. Problemas Comunes de Autenticación

### Error "403 Forbidden" o "401 Unauthorized"

**Causas frecuentes:**

1. **Organization incorrecta**: Seleccionar `All accessible organizations` en la configuración del PAT
2. **Scope insuficiente**: Verificar que el scope sea `Marketplace (Manage)`

### En Linux: libsecret requerido

En sistemas Linux puede ser necesario instalar la biblioteca libsecret:

```bash
# Debian/Ubuntu
sudo apt-get install libsecret-1-dev
```

**Alternativas si libsecret no está disponible:**

```bash
# Usar almacenamiento en archivo
VSCE_STORE=file vsce publish

# Usar variable de entorno para el PAT
VSCE_PAT=<tu-token> vsce publish
```

---

## 8. Privacidad y Proceso de Review

### Medidas de protección del Marketplace

| Medida | Descripción |
|--------|-------------|
| **Malware Scanning** | Escaneo con múltiples motores antivirus |
| **Dynamic Detection** | Las extensiones se ejecutan en VMs sandbox |
| **Verified Publishers** | Requiere verificación de dominio (registro DNS TXT) |
| **Extension Signature Verification** | Verificación criptográfica de firmas |
| **Secret Scanning** | Bloquea la publicación si detecta API keys o credenciales |
| **Unusual Usage Monitoring** | Monitoreo de patrones de uso inusuales |
| **Block List** | Extensiones maliciosas removidas automáticamente |

---

## 9. Proceso de Reporte

Para reportar extensiones sospechosas o maliciosas:

1. Ir a la página de la extensión en el Marketplace
2. Hacer clic en **"Report a concern"**
3. El equipo de seguridad proporciona respuesta inicial en **1 día hábil**

---

## 10. Actualizaciones de Extensiones

### Actualización automática

VS Code verifica e instala actualizaciones automáticamente de forma predeterminada.

### Deshabilitar actualizaciones automáticas

En la configuración de VS Code:

```json
{
  "extensions.autoUpdate": false
}
```

### Publicar actualización

```bash
vsce publish minor  # Incrementa y publica la nueva versión
```

---

## 11. Semantic Versioning

### Formato

El formato es `MAJOR.MINOR.PATCH`:

| Componente | Descripción |
|------------|-------------|
| **MAJOR** | Cambios incompatibles con la API pública |
| **MINOR** | Funcionalidad nueva compatible hacia atrás |
| **PATCH** | Bug fixes compatibles hacia atrás |

### Pre-release en VSCode

**Importante**: VSCode **NO soporta** pre-release tags de semver (como `-beta`, `-alpha`, etc.).

**Estrategia recomendada**: 
- Usar números **PARES** para releases estables (ej: 1.0.0, 1.2.0)
- Usar números **IMPARES** para pre-releases (ej: 1.1.0, 1.3.0)

---

## 12. Alternativas de Distribución

### VSIX (Visual Studio Extension)

- `vsce package` genera un archivo `.vsix`
- Instalación manual:
  ```bash
  code --install-extension mi-extension-0.0.1.vsix
  ```
- **Limitación**: No recibe actualizaciones automáticas

### Open VSX Registry

Alternativa de código abierto mantened por Eclipse Foundation y Red Hat.

**Sitio web**: [https://www.open-vsx.org/](https://www.open-vsx.org/)

**Instalación de la CLI:**
```bash
npm install -g ovsx
```

**Publicación en Open VSX:**
```bash
ovsx publish
```

### Private Marketplace

Solución para empresas que requieren distribución interna:

- Self-hosting en Azure
- Self-hosting en Kubernetes
- Configuración de un servidor de extensiones privado

### GitHub Releases con VSIX

Estrategia de distribución dual:

1. Publicar en el Marketplace para distribución pública
2. Adjuntar archivos `.vsix` en GitHub Releases para:
   - Distribución de versiones específicas
   - Distribución sin Marketplace
   - Distribución en Private Marketplaces

---

## 14. Referencias

- [Publishing Extension - VS Code API](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce GitHub Repository](https://github.com/microsoft/vscode-vsce)
- [Extension Manifest Reference](https://code.visualstudio.com/api/references/extension-manifest)
- [Extension Runtime Security](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security)
- [Open VSX Registry](https://www.open-vsx.org/)
- [Semantic Versioning](https://semver.org/)
