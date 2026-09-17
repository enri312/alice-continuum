# Lector documental y avance R8 — 2026-09-04

## Implementado

- Vista previa en Identificación, selección de archivo y acción explícita.
- Comando nativo recibe bytes, no rutas; Python privado y script embebido.
- Límites de entrada, texto, páginas, salida y tiempo; una extracción a la vez.
- Registro R1 `memory.document.preview` (inventario 35), autorización UI y auditoría
  R3 con huella sin contenido. No se presenta como un grant R2.
- Cinco pruebas Python, incluyendo PDF con motor real y documento controlado.
- Puente Rust/Python con el manual real: aprobado, auditoría temporal y cero memoria.
- Frontend: 434 pruebas / 45 archivos aprobados y build aprobado.
- Rust: 259 pruebas aprobadas, 21 sondas opcionales ignoradas por defecto.

El entorno `.venv-adapters` y los originales de `adapters/` quedan fuera de Git.
El soporte del entorno privado en un instalador redistribuible sigue pendiente.
Actualización 2026-09-05: se compiló el ejecutable y se comprobó la ventana nativa
WebView2 con Playwright/CDP restringido a loopback, usando una raíz de datos temporal.
Selector real con el manual, autorización, ocho fragmentos, apertura y descarte
aprobados. Una entrada deliberadamente malformada mostró el error nativo. Se
verificaron cuatro eventos R3 por ejecución, cero recuerdos escritos y fuente intacta.
El primer reintento de la sonda detectó que contaba eventos históricos; se corrigió
para comprobar únicamente los eventos de cada ejecución. La repetición aprobó.
Se inspeccionó la captura y se corrigieron botones sin estilo/contraste.
La instancia QA y su servidor de desarrollo fueron cerrados al terminar.

`vite.config.ts` fija loopback, puerto 5173 y `strictPort`, alineado con el lanzador.
La configuración CDP no se incorporó a `Iniciar Alice Continuum.cmd`.

## R8 retomado

`preview_knowledge_graph_association` valida propuestas `relatedExperience` entre
dos episodios distintos. Exige versión y huella actuales y cita exacta del campo
`intention`; no permite usar la respuesta histórica del modelo como evidencia.
Devuelve posición en bytes y huella de cita, sin copiar su texto.

Una cita válida no demuestra relación semántica. La propuesta mantiene
`requiresOwnerReview=true`, `relationVerified=false`, `persisted=false`.
Pruebas: evidencia real dentro de fixtures controlados, respuesta de modelo rechazada,
identidad repetida, eliminación, cambio y supresión invalidan la propuesta.
No se escribieron propuestas ni aristas en datos personales.

La sonda canónica comprobó dos citas de entradas reales, sin imprimir contenido,
sin certificar la relación y con `writes=0`. Reconstruyó 15 referencias (6 bloqueadas,
8 episódicas y 1 procedimental) y conservó las huellas de los 36 archivos de datos.
Clippy también aprobó con `-D warnings`.

Pendiente de R8: revisión/confirmación de relaciones, persistencia reversible,
índices semánticos y conexión al volumen. R8 no se declara terminado.

## Fallos capturados y corregidos

La primera compilación detectó un argumento faltante del límite de auditoría.
La regresión detectó un estado `unchecked` con fecha de comprobación incompatible
con R1 y una fixture de supresión mal nombrada. Se corrigieron; la suite completa
posterior aprobó. Permanecen avisos de tamaño de chunks del frontend y mensajes
informativos del enlazador Windows.
