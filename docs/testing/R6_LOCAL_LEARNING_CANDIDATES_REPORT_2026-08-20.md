# Informe R6.4-B — Candidatos de aprendizaje local

Fecha: 2026-08-20  
Resultado: aprobado con límite documentado

## Pruebas automatizadas

- TypeScript: 289 aprobadas.
- Rust: 197 aprobadas y 15 sondas de hardware/estado ignoradas por requerir autorización explícita.
- `npm run build`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt --check` y `git diff --check`: aprobados.

Los tests verifican modelo local, ausencia de herramientas, contexto acotado, máximo de cuatro candidatos, salida no persistida, enums cerrados y rechazo de evidencia inexistente.

## Pruebas reales sin escritura

Se usó Ollama 0.32.13 con `qwen3.5:4b` y recuerdos canónicos existentes. No se imprimió contenido privado.

| Fuente | Tiempo | Entrada/salida | Candidatos | Evidencia literal | Memoria |
|---|---:|---:|---:|---|---|
| recuerdo real breve | 18,310 s | 261 / 10 | 0 | aplica | SHA-256 intacto |
| enseñanza real breve | 1,880 s | 261 / 10 | 0 | aplica | SHA-256 intacto |
| conversación real extensa | 73,777 s | 2710 / 498 | 4 | 4/4 | SHA-256 intacto |

Los tres ensayos declararon cero escrituras. Los resultados vacíos son aceptados: la extracción no inventa candidatos para aparentar actividad.

## Límite pendiente

La vista previa y el backend están conectados, pero la confirmación final todavía reutiliza el guardado general de Memoria desde React. Una fase posterior podrá unir revalidación de SHA-256 y anexado en una sola transacción Rust. No se confirmó automáticamente ningún candidato durante estas pruebas.

