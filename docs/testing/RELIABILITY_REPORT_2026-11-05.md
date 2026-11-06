# Fiabilidad de memoria y control del motor

Fecha: 2026-11-05. Base: `e704ef4`.

Se conservan Rust/Tauri, React, Gemma y los adaptadores actuales. Se corrigen los
dos hallazgos de la [revisión focal](../architecture/CODE_REVIEW_2026-11-05.md),
sin reestructurar toda la aplicación ni afirmar que toda ella haya sido auditada.

## Memoria

El guardado y la restauración básicos sustituyen la copia/escritura directa por
la primitiva atómica existente y recuperan la fuente ante un error posterior.
Se prueban guardar/restaurar con fuente existente o ausente y con
`memory/audit/memory-events.jsonl` convertido en un directorio: las cuatro
combinaciones devuelven error y dejan la fuente anterior o su ausencia exacta.
Al retirar el fallo, el mismo caso se puede reintentar y produce una entrada de
auditoría y el contenido esperado.

También se comprueban los bytes exactos de los respaldos, un temporal ya ocupado
que impide preparar la escritura y un segundo fallo que impide recuperar la
fuente. Este último devuelve un error explícito con ambos fallos y mantiene el
respaldo para recuperación manual; no se oculta ni se informa éxito.

## Motor

Una prueba mantiene una respuesta HTTP pendiente en un puerto efímero. Consultar
estado y detener el proceso propio deben terminar antes de que el servidor
entregue su respuesta; la petición termina cancelada. Se usa una copia hija del
ejecutable de tests, sin cargar modelos ni escribir datos canónicos.

Otra prueba mantiene una petición esperando la exclusión de inferencia, detiene
el motor y crea una nueva generación. La petición anterior se rechaza sin
ejecutar su transporte; una petición nueva sí funciona. Continúan las pruebas de
arbitraje, cierre idempotente y rechazo de modelos residentes incompatibles.

## Validación

Vitest también recorría el snapshot privado de la revisión anterior dentro de
`local/`: ejecutaba dos copias de la suite. Se conserva la exclusión predeterminada
y se añaden `local/` y `.cargo-target/` al descubrimiento de pruebas. La búsqueda
de fuentes deja de depender de qué copias de trabajo estén guardadas allí.
En esta máquina pasó de 1.126 casos duplicados en 10,26 s a 563 en 3,90 s;
es una observación de dos ejecuciones, no un benchmark de la aplicación.

- Windows: **335 pruebas Rust aprobadas y 29 omitidas**, incluidas cinco
  regresiones nuevas de persistencia y concurrencia. Una prueba omitida es el
  proceso auxiliar que estas regresiones lanzan de forma controlada.
- **563 pruebas frontend aprobadas y dos omitidas**; TypeScript y Vite compilan.
  Persiste el aviso de paquetes JavaScript superiores a 500 kB.
- `cargo fmt --check` y Clippy en todos los targets con `-D warnings`: aprobados.
- Compilación nativa Windows: aprobada.
- Gemma real instalado: inicio, reutilización exclusiva del hijo propio,
  arbitraje con Ollama, respuesta `LISTO`, parada y estado final: **aprobados**.
  La prueba de integración completa duró 9,47 s en esta ejecución; no mide la
  latencia de una conversación oral ni la parada durante habla real.
- [CI Ubuntu 24.04](https://github.com/enri312/alice-continuum/actions/runs/42149508475):
  aprobada sobre `84b2ca3`, con **334 pruebas Rust y 28 omitidas**, 563 frontend,
  cinco Python y una sonda adicional del lector documental. Incluye
  formato, Clippy, compilación y arranque aislado. No acredita los dispositivos
  ni Ubuntu 26.04.1 instalado en el segundo disco del propietario.
- HTML v0.61: etiquetas equilibradas, 23 identificadores únicos, 95 enlaces
  locales del HTML y 212 enlaces de los Markdown revisados con destinos existentes.
  Portada comprobada en el navegador; las novedades siguen en sus capítulos y
  en el historial, después de la portada y el índice.
- Los 62 archivos preexistentes de datos y activos privados mantuvieron su SHA-256
  durante las pruebas. Al reabrir Alice con los datos canónicos, sólo se añadió
  el evento R3 `PROCESS_STARTED`: su prefijo conserva la huella anterior.
  El icono que estaba en edición conserva su SHA-256 y queda fuera del commit.
- Alice nativa quedó abierta en Conversación; se verificó «Micrófono apagado» y
  los botones «Activar cámara»/«Compartir escritorio», sin iniciar voz ni vistas.

Evidencia local privada: `local/artifacts/reliability-2026-11-05/`.

## Límites y continuación R9

No se simularon cortes físicos de energía ni se implementó un diario transaccional
entre archivos. El arranque mantiene su espera acotada de preparación. La
cancelación del motor no sustituye la interrupción acústica mientras Alice habla.

La siguiente aceptación con el propietario continúa siendo cinco turnos sin
música: referirse a Alice, aclarar «Me refiero a ti, Alice, no a mí», mantener el
tema, cambiarlo y decir «Detén la conversación, Alice». Registrar frase,
transcripción, respuesta y tiempos; revisar «Último mensaje atendido» si falla.
Después repetir con música de la notebook y de otro equipo. Esta revisión
automatizada no acredita esa aceptación humana. El avatar sigue pospuesto.
