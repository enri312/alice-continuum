# Diagnóstico medido de la entrada de voz

Fecha: 2026-11-12. Entorno: Alice Tauri en Windows.

## Problema observado

Tras el ajuste `bbba31d`, el propietario volvió a informar sustituciones al
decir «Alice pausa Spotify». Su captura de pantalla muestra resultados
incorrectos acumulados y una línea final correcta; confirmó que esa última
línea había sido escrita por él. No se considera aceptado el reconocimiento.

La concatenación del dictado añade cada resultado al borrador anterior. Por
ello, las tres repeticiones visibles no demuestran que una única grabación
provocara tres repeticiones del reconocedor. La última transcripción se
separa ahora del borrador para conservar esa distinción.

## Observación añadida

- Entrada: RMS, pico y muestras que superan el límite antes del recorte de
  Alice. Incluye el procesamiento previo del navegador y la ganancia local.
- Salida: RMS, pico y muestras realmente entregadas desde el worklet al
  grabador, incluidos ceros de arranque o falta de datos.
- La cobertura corresponde al último lote recibido. El contador de muestras
  permite ver cuánto audio del filtro se midió; no sustituye la duración real
  de la toma ni prueba cobertura completa del WebM.
- Los snapshots inválidos o ausentes no se presentan como silencio ni señal
  saludable. La falta de diagnóstico tampoco impide apagar el micrófono.

No se cambian filtros, ganancia, umbrales, silencios, modelo ASR ni permisos
de ejecución. Tampoco se añaden estos indicadores al payload de transcripción,
al historial, a los recuerdos ni a auditorías persistidas.

## Escucha local de la entrada

Durante dictado manual, **Parar y revisar audio** termina la captura sin llamar
al reconocedor. El propietario puede escuchar la toma filtrada en el
reproductor local y decidir después **Transcribir localmente**. El audio está
limitado a la toma manual existente (60 s/8 MiB), en memoria de la pantalla.
La acción normal **Terminé de hablar y transcribir** conserva su flujo.

Cambiar o descartar toma, transcribir, cerrar el dictado, iniciar sesión
automática o desmontar la pantalla detiene el reproductor y revoca su URL.
El reproductor no usa autoplay, archivos, Fish ni una petición de red.

## Validación automatizada

- **808 pruebas frontend aprobadas; 2 sondas opcionales omitidas**.
- Compilación TypeScript/Vite aprobada; permanece el aviso conocido de chunks.
- Los cálculos se comprobaron con señales conocidas, contadores independientes,
  clipping previo al límite, salida real y conservación de las muestras.
- Se comprobaron snapshot previo al cierre, limpieza entre generaciones y
  callbacks tardíos. Un getter de diagnóstico que falla no bloquea el apagado.
- Las URL locales se liberan una vez, incluso con errores del reproductor o
  ref retirada al desmontar. Los callbacks viejos no crean otra reproducción.
- Cero muestras se distingue de silencio realmente medido; no se inventan
  niveles de entrada o salida cuando ese lado carece de muestras.

Spotify se observó pausado en su control de reproducción antes de preparar la
siguiente prueba. No se usaron sus canciones, cuenta ni datos de reproducción
como fixtures ni contenido de este reporte.

La comprobación de audio real de este diagnóstico se pospone por la petición
posterior del propietario de priorizar una nueva voz y personalidad. No se
considera resuelto el reconocimiento por las pruebas automatizadas. El backend
no cambió en este incremento; las 385 pruebas Rust, 15 de Obsidian y 20 de
respaldo corresponden a sus validaciones anteriores.

## Protección del trabajo

Alice se cerró antes de editar. Se verificó el respaldo privado
`D:\Alice Backups\Alice Continuum\snapshot-2026-11-12T19-08-52-998Z-bedfae1c-e196-41c7-9b27-812b9bb16c9d`.
El código anterior está en `local/backups/voice-signal-diagnostics-20261112/source-before.zip`.
El borrador del propietario se conservó temporalmente para devolverlo a la
interfaz; no se creó un archivo adicional con ese texto.
Los 134 archivos privados conservaron sus huellas durante edición y pruebas,
antes de los cambios de configuración de voz posteriores.

La siguiente prueba real debe comparar la frase pronunciada, el sonido de esa
misma toma, la señal medida y la transcripción. Los indicadores no demuestran
por sí solos que un micrófono esté averiado ni que Whisper reconozca bien.
