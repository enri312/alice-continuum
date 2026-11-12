# Volumen conectado y coordinación de las fuentes de aprendizaje

Fecha: 2026-11-11. Proyecto: `D:\Alice Continuum`.

## Resultado

La referencia de colores queda plegada y fuera del lienzo. El Volumen conserva
sus nodos, fuentes, contenido, asociaciones, cámara y demostración, y muestra
la fase registrada del autoestudio y el estado de las lecturas que lo alimentan.

La coordinación de aprendizaje sale de `App.tsx` hacia un hook y un controlador
puro. Este incremento del núcleo corrige fallos concretos: eventos perdidos,
lectura inicial fallida y respuestas viejas posteriores a una pausa o revisión.
El estado automático se rotula como última señal recibida; su comando de consulta
no expone fase. La fase persistida de autoestudio no demuestra inferencia en curso.

## Comportamiento conservado y corregido

- Sondeo de respaldo cada cinco segundos, aunque falle la suscripción a eventos.
- Una lectura pendiente por fuente; eventos agrupados y relectura después de
  registrar la escucha. Un tick no invalida lecturas lentas válidas.
- Mutaciones en orden e invalidación de respuestas iniciadas antes de ellas.
  Una pausa no espera a que termine una consulta de estado antigua.
- Última muestra válida conservada al fallar una lectura; fuente, error y fecha
  visibles. El cierre evita publicar respuestas tardías y cancela escrituras
  todavía en cola.
- **Actualizar lectura** consulta los estados existentes. Reintenta perfil y
  recuerdos si su lectura inicial falló; no inicia otro ciclo de aprendizaje.
- La conversación mantiene el filtro de estudios aprobados. Intentos pendientes
  continúan visibles en el Volumen sin convertirse en contexto de respuesta.

No cambian Rust, permisos, currículo, prioridad de conversación, formatos ni
ubicación de almacenes. No se modifican pesos ni se inventan eventos R3.

## Validación y límites

| Comprobación | Resultado |
|---|---|
| Vitest completo | 694 aprobadas; 2 sondas opcionales omitidas |
| Controlador de fuentes, incluido en Vitest | 13 casos deterministas aprobados |
| Obsidian y respaldos | 15 y 20 aprobadas con datos aislados |
| TypeScript y compilación frontend | Aprobados; aviso conocido de paquetes grandes |
| Interfaz del Volumen | 19 comprobaciones aprobadas; 0 errores de página o consola |
| Anchos de ventana | 1440, 1000 y 420 px, sin desborde horizontal |
| Hook real con IPC simulado | 6 casos de integración aprobados |

Las pruebas del controlador cubren eventos durante lecturas lentas, respaldo sin
notificaciones, recuperación después de fallos, pausa/revisión frente a respuestas
antiguas, cola de escrituras y cierre. La regresión de una lectura de 15 segundos
verifica que los ticks no la invaliden continuamente.

La integración monta el hook real con los mocks oficiales de Tauri en un
navegador aislado. Comprueba fallo inicial y recuperación, escucha fallida con
incorporación mediante sondeo, fases de estudio, filtro RAG, mutaciones frente
a respuestas antiguas y desmontaje. Son datos y eventos sintéticos, no progreso
personal ni inferencias reales de Gemma.

La interfaz comprueba además la referencia cerrada por defecto, sus seis tipos
al abrirla, control por teclado y ausencia dentro del canvas. Verifica fase y
error visibles, reintento de lectura sin alterar contadores y preserva las
comprobaciones anteriores de crecimiento, inspector, fuentes, cámara y señales.

Artefactos ignorados por Git:

- `local/artifacts/volume-live-20261111/`: runner, reporte y capturas sintéticas.
- `local/artifacts/learning-sources-20261111/`: integración del hook con IPC simulado.
- `local/backups/volume-live-20261111/source-before.zip`: archivo de código y
  documentación versionados antes del cambio, SHA-256
  `D38A377AA59152D86838CD08B59FC15997D66EE159198BF77C22BB965EC56C0D`.

Alice y su motor ya estaban abiertos. El intento de inspeccionar su ventana
falló con `Computer Use native pipe is unavailable` (`os error 2`), también
después de los reintentos y reinicio de la conexión. No se hicieron clics,
mensajes de prueba ni reinicios del estudio en la sesión personal. Las pruebas
no iniciaron otros motores ni usaron recuerdos personales.

Falta aceptar en la ventana nativa una incorporación real, su continuidad tras
reinicio, recuperación con fuente y proyección en Obsidian. Tampoco se repitieron
Rust ni aceptación de voz, porque este incremento no cambia esos componentes.

[Decisión](../decisions/ADR-P-116-fuentes-de-aprendizaje-observables.md) ·
[Guía](../MANUAL_DE_USO.md#volumen-cognitivo).
