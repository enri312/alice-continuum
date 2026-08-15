# Informe R6.3-A — Vista previa de consolidación

Fecha: 2026-08-15  
Resultado: aprobado

## Evidencia controlada

Sobre archivos temporales reales se comprobaron:

- un duplicado exacto pese a mayúsculas, puntuación y espacios diferentes;
- dos pares de revisión con la misma intención y contenido distinto;
- exclusión de un registro archivado;
- determinismo entre consultas repetidas;
- fuente ausente sin creación de directorios;
- fuente corrupta bloqueada sin reparación ni reescritura.

Las huellas recursivas antes y después fueron idénticas.

## Sonda canónica

Se ejecutó explícitamente con `ALICE_LIVE_DATA_DIR=E:\Alice Cognitive Core\data`:

```text
R6_3_CANONICAL records=10 eligible=10 exact=0 review=0 filesIntact=10
```

Los cero candidatos reflejan los recuerdos actuales; no se agregó actividad sintética. Las huellas de los 10 archivos inspeccionados permanecieron iguales.

## Interfaz

`Memoria → Consolidar` presenta candidatos, conteos, fuente y fronteras. En navegador muestra `SIN BACKEND` y no genera un resultado sustituto. La revisión visual se realizó a 1600 × 1200 sobre la ruta real de la interfaz web.

## Puertas

| Puerta | Resultado |
|---|---|
| Pruebas R6.3 Rust controladas | 3 aprobadas |
| Sonda R6.3 canónica | 1 aprobada explícitamente |
| `npm test` | 238/238 aprobadas |
| `npm run build` | aprobado |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets -- -D warnings` | aprobado |
| `cargo test` | 172 aprobadas; 11 sondas ambientales ignoradas |
| `cargo build` | aprobado |

Vite conserva su advertencia informativa por chunks mayores a 500 kB.
