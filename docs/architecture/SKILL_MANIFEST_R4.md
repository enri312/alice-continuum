# Contrato de manifiesto de habilidades R4

Versión del esquema: 1  
Estado: incrementos R4.1, R4.2, R4.3 y R4.4 implementados  
Fecha: 2026-08-10

## Objetivo

Una habilidad describe un procedimiento local, visible y versionado. El manifiesto no contiene código ejecutable: declara qué pasos se pretenden realizar, qué capacidades R1 serían necesarias y cómo se comprobaría el resultado. R4.2 conserva únicamente borradores verificables y R4.3 permite analizarlos estáticamente; ninguno los aprueba, activa o ejecuta.

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

R4.4 implementa las transiciones `submitReview`, `approve`, `disable`, `restore` y `retire`. La decisión se vincula a una revisión y SHA-256 concretos, actor `localOwner` y confirmación explícita. La aprobación nunca se infiere desde conversación o memoria.

Cada estado nuevo es una revisión inmutable bajo `data/skills/revisions/<skillId>/<revisionId>.json`; `data/skills/lifecycle.json` conserva el puntero actual y los digests del historial. Una revisión aprobada no se sobrescribe. Someter cambios después de aprobar incrementa la versión y conserva la aprobación anterior.

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
- R3 registra simulación, revisión, aprobación, desactivación, restauración y retiro mediante pares correlacionados sin contenido privado.
- R4 no amplía el inventario R1 ni permite shell, PowerShell, ejecutables o código arbitrario.

## Simulación estática R4.3

El comando `simulate_skill_plan` vuelve a validar el manifiesto contra el registro R1 vigente y produce un resultado cerrado con:

- identidad y digests SHA-256 del manifiesto y del plan;
- entradas y resultados como metadatos, nunca valores;
- capacidades, operaciones, riesgo, madurez, estado y salud;
- efectos, alcances de datos, requisitos y política de permisos;
- pasos consecutivos con disponibilidad estática o bloqueos explícitos;
- precondiciones y comprobaciones marcadas `evaluated: false`;
- `canExecute: false`, `adapterInvocationCount: 0` y `sideEffectsApplied: false`.

`available` no equivale a permiso ni ejecución: sólo indica que el descriptor R1 vigente no presenta un bloqueo estático. El bloqueo global `executionDisabled` siempre está presente. La misma combinación de manifiesto y snapshot produce el mismo digest del plan.

## Límites del incremento

Existen comandos Tauri para estado, lectura, guardado de borradores, simulación estática, consulta del ciclo y transiciones gobernadas. No existe editor visible, eliminación, descarga, instalación, simulación con adaptadores ni ejecución. Las pruebas usan archivos reales en carpetas temporales aisladas y una aceptación pasiva contra los datos canónicos. No se usa la memoria personal como fixture destructivo.
