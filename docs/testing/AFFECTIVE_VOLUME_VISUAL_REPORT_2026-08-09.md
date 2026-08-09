# Informe visual — Matriz cognitivo-afectiva

Fecha: 2026-08-09  
Resultado: aprobado  
Alcance: presentación y contrato de canales; motor afectivo no implementado

## Cambios verificados

- Dos lóbulos cognitivos conectados a un núcleo central `ALICE / SELF MODEL`.
- Estructura completa tenue, independiente de la fracción activa.
- Nodos activos con mayor brillo, tamaño y pulso.
- Diez circuitos cromáticos identificables.
- Capa afectiva visible como `EN ESPERA · SIN DOMINANTE`.
- Todos los valores afectivos en `0.00` y estado `planned`.
- Nostalgia gris rosado `#B9A0AA`, diferenciada de Vergüenza rosa `#F39AB8`.
- Leyendas explícitas para estructura, actividad real y correlación.
- Controles de giro, desplazamiento, zoom y restablecimiento preservados.

## Revisión visual real

Se compiló el frontend y se abrió en Microsoft Edge mediante Playwright a 1440 × 1000. La prueba de disposición usó diez registros controlados en `localStorage` del navegador aislado para producir la misma densidad visible de diez recuerdos sin leer ni copiar la memoria privada de Alice.

Se capturaron la página completa y el componente enfocado fuera del repositorio. La inspección confirmó:

- ausencia de solapamiento entre ayuda, controles y paleta;
- lectura completa de los diez canales;
- núcleo central distinguible;
- estructura inactiva visible sin confundirse con pulsos activos;
- distribución multicolor estable durante la rotación;
- ninguna imagen de personajes o recurso de Disney/Pixar incluido.

Las capturas de prueba permanecen en el directorio privado de visualizaciones de Codex y no fueron preparadas para Git.

## Pruebas automatizadas

| Puerta | Resultado |
|---|---|
| TypeScript / Vitest | 66/66 |
| Pruebas de paleta | 2/2 |
| Canales únicos | 10/10 |
| Coherencia hexadecimal/RGB | aprobada |
| Estado inicial afectivo | diez canales `planned`, valor `0` |
| Rust normal | 86/86; dos sondas vivas ignoradas por defecto |
| Build web | aprobado |
| Build Tauri release | aprobado |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets --all-features -- -D warnings` | aprobado |

## Límites

- Los colores no son valores hexadecimales oficiales; son una paleta propia aproximada de Alice.
- El diseño toma asociaciones cromáticas como inspiración, no personajes, siluetas o animaciones.
- Ningún canal modifica todavía memoria, comportamiento, respuesta o avatar.
- El motor futuro dependerá de evidencia R3, decaimiento y reglas inspeccionables.
