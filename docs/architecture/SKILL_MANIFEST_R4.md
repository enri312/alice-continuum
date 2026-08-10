# Contrato de manifiesto de habilidades R4

Versión del esquema: 1  
Estado: incrementos R4.1 y R4.2 implementados  
Fecha: 2026-08-09

## Objetivo

Una habilidad describe un procedimiento local, visible y versionado. El manifiesto no contiene código ejecutable: declara qué pasos se pretenden realizar, qué capacidades R1 serían necesarias y cómo se comprobaría el resultado. R4.2 conserva únicamente borradores verificables; no los aprueba, activa, simula operativamente ni ejecuta.

## Reglas obligatorias

- `skillId` usa el espacio local, por ejemplo `local.revisar-memoria`.
- `revisionId` y `parentRevisionId` son UUID v4 canónicos.
- Una habilidad nueva comienza como `draft`, versión `1` y sin revisión padre.
- La procedencia inicial es `localUser` y conserva autor, creación y actualización.
- `execution.mode` es `simulationOnly`; todas las banderas de efectos permanecen en `false`.
- Cada capacidad y operación debe existir en el snapshot R1 entregado al validador.
- El riesgo declarado debe ser igual o mayor al riesgo máximo de sus capacidades.
- Toda capacidad y operación declarada debe usarse en un paso; no se permiten privilegios sobrantes.
- Un paso de capacidad sólo puede usar combinaciones declaradas. Un paso manual no puede ocultar una operación.
- Entradas y resultados de tipo `path` siempre se marcan `sensitive`.
- Campos desconocidos, duplicados, referencias rotas o listas fuera de límite se rechazan.

## Sobre cerrado v1

| Campo | Contenido |
|---|---|
| `schemaVersion` | fijo `1` |
| `skillId` | identidad estable dentro de `local.*` |
| `version` / `revisionId` | versión positiva y revisión inmutable |
| `title`, `description`, `purpose` | explicación visible, sin script |
| `provenance` | autor local, origen y fechas |
| `status` | `draft`, `inReview`, `approved`, `disabled` o `retired` |
| `declaredRisk` | `none`, `low`, `medium`, `high` o `critical` |
| `execution` | política cerrada y desactivada de R4.1 |
| `requiredCapabilities` | IDs y operaciones exactas del Registro R1, con motivo |
| `inputs` / `outputs` | contrato de valores y sensibilidad |
| `preconditions` | confirmación manual, entrada presente o capacidad disponible |
| `steps` | pasos manuales o referencias exactas a capacidad/operación |
| `successChecks` | confirmación manual, resultado presente o capacidad saludable |

## Estados y autoridad

Los cinco estados forman parte del contrato para que las revisiones futuras puedan representarse sin cambiar el esquema. Los comandos R4.2 sólo aceptan `draft`. Aceptar un JSON con otro estado en el parser general no lo activa: el almacén lo rechaza, `execution.enabled` continúa obligatoriamente en `false` y ningún comando ejecuta pasos.

Las transiciones de estado y su auditoría se implementarán en incrementos posteriores. La aprobación será una decisión de Carlos Nuñez y deberá crear evidencia R3; nunca será inferida desde conversación o memoria.

## Persistencia de borradores R4.2

- La raíz fija es `data/skills/`; React nunca proporciona una ruta.
- `manifest.json` indexa hasta 128 archivos bajo `drafts/`.
- Índice, manifiesto y respaldo usan esquemas cerrados; cada contenido vigente se verifica por SHA-256.
- La lectura no crea la carpeta si aún no existe.
- Crear exige versión 1 sin padre. Editar exige `expectedRevisionId`, revisión nueva y padre igual a la anterior.
- Un bloqueo nativo serializa las operaciones del almacén y convierte la segunda edición concurrente en un conflicto visible.
- Una edición conserva autor, `skillId`, versión y fecha de creación.
- `backups/` mantiene la revisión anterior y una copia anterior del índice.
- Una incoherencia o manipulación se informa; R4.2 no la repara ni sobrescribe automáticamente.

## Relación con R1, R2 y R3

- R1 es la fuente de verdad para capacidad, operación y riesgo.
- R2 seguirá siendo obligatorio para cualquier permiso cuando exista ejecución real.
- R3 registrará creación, revisión, simulación, activación, desactivación y retiro en incrementos posteriores.
- R4 no amplía el inventario R1 ni permite shell, PowerShell, ejecutables o código arbitrario.

## Límites del incremento

Existen comandos Tauri exclusivamente para estado, lectura y guardado de borradores. No existe editor visible, eliminación, descarga, instalación, transición de estado, simulador operativo ni ejecución. Las pruebas usan archivos reales en carpetas temporales aisladas y el inventario de 24 descriptores generado por el código R1. No se usa la memoria personal como fixture.
