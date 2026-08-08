# Sistema de memoria de Alice

Estado: almacenamiento, repaso local y refuerzo por recuperación v1 implementados  
Fecha: 2026-08-07

## Propósito

La memoria de Alice conserva enseñanzas y experiencias locales para recuperarlas durante una conversación autorizada. No modifica los pesos del modelo de OpenRouter y no convierte automáticamente una salida de nube en conocimiento propio.

## Directorio de datos

El iniciador define `ALICE_DATA_DIR=E:\Proyecto P\data`. Dentro de ese directorio Alice crea `memory/` y conserva la auditoría de proveedores en `cloud/`:

```text
memory/
|-- manifest.json                 # Versión y contrato del almacenamiento
|-- records.json                  # Recuerdos y enseñanzas vigentes
|-- backups/
|   |-- records.backup.json       # Respaldo automático anterior
|   `-- records.pre-restore.json  # Estado protegido antes de restaurar
|-- exports/
|   `-- alice-memory-*.json       # Exportaciones solicitadas por Carlos Nuñez
|-- audit/
|   `-- memory-events.jsonl       # Eventos append-only con huella SHA-256
|-- attachments/                  # Reservado para adjuntos autorizados
`-- indexes/                      # Reservado para índices derivados y regenerables
```

La pantalla Memoria debe mostrar la ruta real y ofrecer un botón para abrirla. `data/*` está excluido de Git, salvo su README explicativo, de modo que los recuerdos no se publican al compartir el código.

Si `ALICE_DATA_DIR` no está definida, Tauri conserva como fallback su directorio por usuario en Windows. En esta máquina, la ruta anterior era `C:\Users\enri3\AppData\Roaming\com.enrique.proyectop`. La migración a E: se realiza por copia y la fuente de C: no se borra hasta verificar la nueva ubicación.

## Formatos

| Formato | Uso | Motivo |
|---|---|---|
| JSON | `manifest.json`, `records.json` y exportaciones | Legible, portable, editable y adecuado para el volumen inicial |
| JSONL | Auditoría | Permite agregar un evento por línea sin reescribir el historial |
| Archivos originales | Adjuntos futuros | Evita insertar binarios dentro de JSON |
| SQLite | Migración futura | Se adoptará cuando asociaciones, consultas e historial requieran transacciones e índices a mayor escala |

## Compatibilidad

Si existe `memory/sessions.json` y todavía no existe `records.json`, Alice copia el contenido al formato vigente y conserva el archivo anterior. La migración no borra la fuente histórica.

## Registro v1

Campos principales: identificador, clase de registro, intención o título, contenido, fecha, tipo de memoria, fuente, importancia, fuerza de almacenamiento, estado, recuperaciones conversacionales, repasos manuales, correcciones y sus fechas.

La fuerza de almacenamiento no es una certeza científica. Es una métrica de ingeniería explicable para visualizar consolidación y programar repasos.

## Consolidación y repaso v1

La cola de repaso acepta únicamente registros de clase `Enseñanza`, porque fueron escritos y confirmados directamente por Carlos Nuñez. Las conversaciones guardadas permanecen consultables, pero no aumentan su fuerza ni se convierten automáticamente en conocimiento propio.

La próxima fecha se deriva de `finishedAt` o `lastReviewedAt`, el balance entre `successfulReviews` y `correctionCount`, y la importancia. Los intervalos base son 1, 3, 7, 14, 30, 60 y 120 días. Marcar **Sigue vigente** refuerza el indicador y extiende el intervalo; **Necesita corrección** reduce la fuerza y cambia el estado a `conflict` hasta guardar una corrección.

El uso durante conversación se registra de manera independiente. Si una enseñanza confirmada fue incluida en la previsualización, Carlos Nuñez autorizó el envío y el proveedor respondió correctamente, Alice incrementa `successfulRecalls` y actualiza `lastRecalledAt`. Cancelar, desmarcar la memoria o recibir un error no produce refuerzo.

No existe un proceso oculto ni una tarea en segundo plano. La cola se reconstruye al mostrar la memoria y todos sus datos continúan en `records.json`.

## Fronteras

- React nunca recibe credenciales de proveedor.
- Guardar una enseñanza no llama a la nube.
- Incluir recuerdos en una consulta requiere selección y previsualización.
- Respaldos, exportaciones y auditorías permanecen locales.
- Los índices futuros serán derivados: deben poder regenerarse desde `records.json`.
