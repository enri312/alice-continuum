# Informe de prueba — Base de auditoría R3

Fecha: 2026-08-09  
Alcance: incremento 1 de R3  
Resultado: aprobado

## Implementación comprobada

- Sobre nativo `schemaVersion=1` con UUID v4 de evento y operación.
- Fuentes, etapas, decisiones y resultados cerrados por enumeraciones.
- Rechazo de campos desconocidos y ausencia estructural de payload libre.
- Archivo `data/audit/events-v1.jsonl` limitado a 5 MiB.
- Una rotación anterior en `events-v1.previous.jsonl`.
- Lectura de los 200 eventos válidos más recientes sin crear archivos al consultar una raíz vacía.
- Vista `[08] NATIVE AUDIT R3` separada de la consola temporal React.

## Prueba real del proceso

La instancia Tauri de desarrollo se recompiló y reinició con el nuevo módulo. El archivo privado resultante contenía dos eventos producidos por dos arranques reales:

```text
AUDIT_LINES=2
AUDIT_VALID_STARTUP=2
AUDIT_UNEXPECTED_FIELDS=0
AUDIT_BYTES=688
source=system
operation=process.startup
stage=execution
outcome=success
reasonCode=PROCESS_STARTED
```

No se fabricó una respuesta ni se insertó una fixture en `data/`. Los UUID y marcas temporales provinieron de los procesos reales. El informe no copia los identificadores completos.

## Regresión

| Puerta | Resultado |
|---|---|
| TypeScript / Vitest | 64/64 |
| Rust normal | 86/86; dos sondas vivas ignoradas por defecto |
| Pruebas específicas de auditoría | 6/6 |
| Escritura y lectura JSONL sobre carpeta temporal real | aprobada |
| Rotación sobre archivos temporales reales | aprobada |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets --all-features -- -D warnings` | aprobado |
| Build web | aprobado |
| Build Tauri release | aprobado |

Ejecutable producido:

```text
E:\Alice Cognitive Core\.cargo-target\release\alice-cognitive-core.exe
```

## Privacidad y recursos

| Recurso | Antes del primer evento R3 | Después |
|---|---:|---:|
| Archivos privados en `data/` | 9 | 10 |
| Bytes privados en `data/` | 69.374 | 70.062 |
| Archivo R3 esperado | ausente | 688 bytes |
| Entradas multimedia del proyecto | 107 | 107 |

Los siete archivos de memoria conservaron tamaños y fechas respecto del cierre R2. `Assets/Alice.vrm` mantuvo 18.631.596 bytes y SHA-256 `39E7815A3E34D179D431B81421A38F6B1AE2A4DFB4EC48DB336DBDBDCC51EB3B`. `data/`, el avatar y los medios privados permanecen excluidos de Git.

## Alcance pendiente

Este resultado no cierra R3. El Gateway R2, memoria y nube aún no producen el sobre unificado. La pestaña puede diferenciar las etapas definidas, pero la secuencia completa de solicitud, autorización, ejecución, bloqueo y error será evidencia real solamente después de instrumentar cada productor.

El volumen neuronal no se densificó en este incremento. Primero recibirá telemetría correlacionada; después se diseñará estimulación cognitiva controlada sobre percepción, recuperación, decisión y salida.
