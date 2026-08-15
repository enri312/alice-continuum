# Informe visual — Volumen neural compacto

Fecha: 2026-08-15  
Alcance: presentación `[01]`, reglas visuales puras y ejecución nativa

## Resultado

El volumen cognitivo dejó de dispersar estructura y colores afectivos por todo el lienzo. La nueva geometría nace en el centro, conserva dos lóbulos y distingue tres evidencias:

| Evidencia | Representación |
|---|---|
| Memoria persistente | un ancla con aro por recuerdo, limitada por capacidad gráfica |
| Actividad R3 reciente | racimo temporal y pulsos sobre conexiones visibles |
| Afecto | color de canal únicamente si está `ready` y su valor es positivo |

La sesión nativa inspeccionada informó cero recuerdos persistentes, dos eventos dentro de cinco minutos y señal R3 real decreciente. La interfaz mostró `PULSO TEMPORAL`, cero anclas, estructura `0%` y los diez canales afectivos en espera; no inventó memoria ni emoción para llenar el panel.

## Pruebas ejecutadas

| Comprobación | Resultado |
|---|---|
| `npm test` | 243/243 aprobadas en 29 archivos |
| Reglas nuevas | crecimiento centro-afuera, conteo exacto/acotado de anclas y bloqueo de color afectivo sin señal |
| `npm run build` | TypeScript y Vite aprobados |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets --all-features -- -D warnings` | aprobado |
| `cargo test` | 175/175 normales aprobadas; 12 sondas de hardware/datos canónicos ignoradas por diseño |
| `cargo build` | ejecutable de desarrollo aprobado con Alice cerrada |
| Navegador, estado sin backend | estado vacío correcto; no atribuye datos nativos inexistentes |
| Aplicación Tauri real | actividad R3 y decaimiento observados en la ventana de Alice |
| Interacción | giro, mover, zoom y restablecer preservados |

La advertencia de Vite por tamaño de chunks permanece preexistente. El emblema `icons/app-alice.svg`, los archivos de memoria y el avatar privado no fueron modificados.
