# Workflow de Desarrollo

## Cuándo aplicar

Este workflow aplica **únicamente para tareas de codificación**:
- Nuevas features o funcionalidades
- Refactoring de código
- Bug fixes
- Optimización de performance
- Configuración de build/deploy
- Cualquier tarea que involucre escribir o modificar código

**No aplica para:** preguntas generales, investigación pura, consultas de documentación, o tareas administrativas de git.

## Secuencia de subagents (siempre en orden)

Para tareas de codificación, SIEMPRE ejecutar:

| Paso | Agent | Propósito |
|------|-------|-----------|
| 1 | `investigator` | Investigar librerías, APIs, frameworks, docs externas |
| 2 | `planner` | Generar plan detallado con subtareas específicas |
| 3 | `security` | Pre-check: identificar requisitos de seguridad antes de escribir código |
| 4 | `builder` | Implementar código siguiendo el plan |
| 5 | `qa` | Review de código, escribir tests, verificar calidad |
| 6 | `security` | Post-check: escanear vulnerabilidades en código final |
| 7 | `docs-writer` | Documentación, JSDoc, actualizar README |

## Regla: Presentar el plan primero

Antes de ejecutar cualquier paso, presentar al usuario:

```
## Plan de trabajo

- [ ] Paso 1: investigator (investigar APIs)
- [ ] Paso 2: planner (generar plan)
- [ ] Paso 3: security (pre-check)
- [ ] Paso 4: builder (implementar)
- [ ] Paso 5: qa (review/tests)
- [ ] Paso 6: security (post-check)
- [ ] Paso 7: docs-writer (documentar)

¿Confirmas para continuar?
```

## Excepciones

Si decides omitir un paso, explicar claramente:
- Qué paso se omite
- Por qué se omite (ej: "hotfix trivial")
- Qué riesgo se acepta

Ejemplo:
> "Omito pasos 1-3 porque es un typo fix en un string. Acepto el riesgo de no haber investigado alternativas."

## Workflows especializados

| Tipo de tarea | Secuencia |
|--------------|-----------|
| Bug report | `debugger` → `builder` → `qa` |
| Performance | `performance` → `builder` → `qa` |
| Cleanup/Refactor | `refactorer` → `builder` → `qa` |
| Deployment | `devops` → `security` → `builder` |

---

Última actualización: 2026-04-05
