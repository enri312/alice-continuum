# Contrato R6 — Memoria por capas y migración reversible

Versión: R6.1  
Estado: implementado y validado  
Fecha: 2026-08-13

## Propósito

R6 separa memoria de trabajo, episodios y hechos enseñados sin reinterpretar silenciosamente los registros v1. El primer incremento crea una **proyección tipada** sobre `memory/records.json`: no duplica el contenido privado, no extrae hechos mediante un modelo y no convierte señal sensorial en memoria.

## Fuentes de verdad

- `records.json` continúa siendo la fuente histórica editable durante R6.1.
- `layer-index-v2.json` contiene únicamente referencias, clasificación, procedencia y revisiones de migración.
- Cada revisión queda ligada al SHA-256 exacto de `records.json` que la originó.
- Una revisión anterior no se reescribe cuando cambia la fuente.

## Capas iniciales

| Capa | Contenido admitido en R6.1 | Persistencia |
|---|---|---|
| `working` | Contexto explícito de la sesión actual | Vacía en la migración; no se deriva de v1 ni se conserva todavía |
| `episodic` | Registros `Conversación` y enseñanzas declaradas `episodic` | Referencias al registro v1 |
| `taughtFacts` | Enseñanzas directas declaradas `semantic` | Referencias al registro v1 |
| `unclassified` | Procedimientos, preferencias o registros que no encajan sin interpretación | Referencia y código de razón; nunca promoción automática |

Una preferencia no se convierte en hecho, y una enseñanza procedural no se convierte en memoria procedimental R5/R4 por existir en `records.json`.

## Documento derivado

```json
{
  "schemaVersion": 1,
  "activeRevisionId": "sha256:…",
  "revisions": [
    {
      "revisionId": "sha256:…",
      "createdAt": "2026-08-13T00:00:00Z",
      "source": {
        "recordsFile": "records.json",
        "sha256": "sha256:…",
        "recordCount": 10
      },
      "layers": {
        "working": [],
        "episodic": [],
        "taughtFacts": []
      },
      "unclassified": []
    }
  ]
}
```

Los IDs de revisión son deterministas respecto de esquema y huella fuente. Las revisiones son inmutables; activar o revertir sólo cambia `activeRevisionId`.

## Estados visibles

- `unavailable`: no existe `records.json`.
- `ready`: la fuente es válida y todavía no hay revisión coincidente.
- `active`: la revisión activa coincide con el SHA-256 actual.
- `sourceChanged`: existe una revisión activa, pero `records.json` cambió.
- `rolledBack`: existe una revisión coincidente, pero está desactivada.
- `blocked`: la fuente o el índice existen con estructura inválida.

## Migración y reversión

1. La vista previa relee y valida `records.json` sin escribir.
2. La interfaz muestra conteos, exclusiones y SHA-256.
3. Activar exige confirmación explícita y el SHA-256 exacto de la vista previa.
4. Rust relee la fuente; si cambió, rechaza la operación.
5. Antes de sustituir un índice existente se crea un respaldo.
6. Revertir exige el ID exacto de la revisión activa y deja todas las revisiones intactas.

## Fronteras

- Cero llamadas a proveedores o modelos.
- Cero extracción, resumen o corrección automática.
- Cero contenido de recuerdos dentro del índice.
- Cero persistencia de cámara, micrófono, pantalla o gestos.
- Cero consolidación en segundo plano.
- Cero cambio de los pesos o del prompt de identidad.
- Los índices continúan siendo derivados y reconstruibles.

## Criterios R6.1

- [x] Vista previa determinista y defensiva.
- [x] Confirmación ligada a SHA-256 en el backend.
- [x] Clasificación sin inferencia semántica.
- [x] Revisión inmutable y reversión sin pérdida.
- [x] `records.json` preservado byte a byte durante activar y revertir.
- [x] Estados vacío, listo, activo, cambiado, revertido y bloqueado comprobados.
