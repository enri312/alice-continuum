# ADR-P-029 — Almacenamiento de memoria v1

Fecha: 2026-08-07  
Estado: aceptada

Nota: ADR-P-030 cambia la ubicación activa, pero conserva los formatos y límites definidos aquí.

## Contexto

Alice necesita una memoria local visible y portable, pero el proyecto se compartirá sin datos personales. Guardar recuerdos dentro del repositorio mezclaría código con información privada y podría versionarla por accidente.

## Decisión

La memoria vive en el directorio de datos por usuario que proporciona Tauri, dentro de `memory/`. La versión inicial utiliza JSON para registros y manifiesto, JSONL para auditoría append-only y subcarpetas separadas para respaldos, exportaciones, adjuntos e índices derivados.

`records.json` reemplaza conceptualmente a `sessions.json`. La migración copia el archivo histórico y no lo elimina. SQLite se evaluará cuando el volumen o el grafo de asociaciones justifique transacciones e índices persistentes.

## Consecuencias

- El repositorio puede distribuirse sin recuerdos personales.
- Los datos siguen siendo inspeccionables y exportables.
- Guardar reescribe el archivo principal, por lo que se crea un respaldo previo.
- JSON no será suficiente indefinidamente; existe una ruta explícita hacia SQLite.
