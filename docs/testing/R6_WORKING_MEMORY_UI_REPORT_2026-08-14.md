# Informe R6.2-B — Control visible de memoria de trabajo

Fecha: 2026-08-14  
Resultado: aprobado

## Resultado funcional

- subpestaña `Memoria → Trabajo RAM` separada de recuerdos y Capas R6;
- estado nativo `active`, `empty` o `expired`;
- conteos de mensajes e intercambios completos;
- presupuesto de caracteres y porcentaje derivado;
- TTL visible, refrescado desde Rust cada cinco segundos;
- generación usada como control de concurrencia;
- proveedor, modelo, fecha y procedencia sin copiar el texto conversacional;
- confirmación visible antes de vaciar;
- error y advertencia R3 visibles;
- fallback web `SIN BACKEND`, sin métricas ficticias.

## Evidencia

La implementación reutiliza el único polling de `working_memory_status`; no existe un reloj paralelo que pueda divergir. `clear_working_memory` recibe `confirmed: true` únicamente después del diálogo y exige `expectedGeneration`. Las pruebas Rust de R6.2-A ya verifican vaciado real, rechazo de generación obsoleta y cero archivos creados.

La revisión visual se realizó a 1600 × 1200 en el estado web explícito sin backend. La captura se conservó fuera del repositorio en el directorio local de visualizaciones de Codex.

## Puertas

| Puerta | Resultado |
|---|---|
| `npm test` | 27 archivos, 229/229 aprobadas |
| `npm run build` | aprobado; 119 módulos transformados |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets -- -D warnings` | aprobado |
| `cargo test` | 169 aprobadas; 10 sondas ambientales ignoradas |
| `cargo build` | aprobado |

Vite conserva una advertencia informativa por chunks mayores a 500 kB. No se ocultó ni afecta esta aceptación funcional.
