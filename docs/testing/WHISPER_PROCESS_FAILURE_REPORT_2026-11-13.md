# Fallos del proceso Whisper y diagnóstico seguro

Fecha: 2026-11-13. Entorno: backend Rust de Alice Tauri en Windows.

## Evidencia anterior al cambio

Se registraron dos fallos de transcripción con duraciones aproximadas de
**576 ms** y **1026 ms**. Por separado, una ejecución CLI del reconocedor
terminó correctamente en **5,67 s con audio sintético**.

La diferencia de duración no identifica la causa de los fallos ni permite
asignarlos a una palabra, ritmo de habla, dispositivo o estado personal.
El éxito aislado de CLI tampoco acredita la captura dentro de Alice ni la
aceptación del reconocimiento con la voz del propietario. La causa original
permanece sin confirmar.

El acierto puntual comunicado antes se conserva como tal; no se convierte
en estabilidad prolongada ni en aceptación de cinco turnos reales.

## Cambio acotado

- Helper de proceso `src-tauri/src/whisper_input/process.rs`: `FailureKind`
  clasifica el fallo y `WhisperFailure` lo transporta, distinguiendo
  preparación, ejecución y decodificación de noSpeech.
- Retención en RAM de hasta 24 KiB de stdout y 16 KiB de stderr, con drenaje
  completo de ambos canales hasta EOF aun cuando se alcance el límite.
- Fallo ante error fatal detectado en stderr incluso con código de salida
  cero. Un fallo de configuración o decodificación no se presenta como una
  toma vacía o sin habla.
- `noSpeech` también puede proceder de PCM silencioso detectado localmente
  antes de lanzar el CLI, además de un reconocimiento válido sin palabras.
- Cierre del child CLI directo, espera y unión de los hilos ante cancelación, 90 segundos
  o fallos de preparación. Hay un lector efímero adicional de stderr por uso;
  no hay un servicio o proceso nuevo persistente.
- Códigos R3 de `WhisperFailure` acotados a 64 caracteres: clase/prefijos
  fijos y sufijo `_EXIT_{8HEX}` normalizado cuando existe, sin contenido técnico
  privado. Los mensajes comprensibles usan el aviso de error existente.

El cierre se limita al CLI directo creado por Alice; no es un mecanismo para
administrar descendientes arbitrarios ni terminar otros procesos del equipo.

No se registran stderr sin procesar, rutas o texto reconocido en esos códigos.
No se crean archivos de audio, transcriptos ni stderr para depurar el fallo.
La transcripción válida conserva el flujo y las autorizaciones de conversación
existentes.

No cambian interfaz, captura, filtros, ganancia 2×, dispositivo ni modelos.
Tampoco se añade un reintento o fallback ciego ante el fallo del reconocedor
instalado. La opinión sobre diseño no implica un rediseño en este incremento.

## Resultados del incremento

Validación del backend realizada el **13 de noviembre de 2026**. La suite
predeterminada aprobó **408 pruebas Rust y omitió 32**. Dos de esas sondas
omitidas, que requieren el CLI y modelo instalados, se seleccionaron y aprobaron
aparte; las otras 30 siguen siendo opcionales sin ejecutar.

| Comprobación | Estado | Resultado y alcance |
|---|---|---|
| Fallos tipados y clasificación | Aprobado | Pruebas de salida no exitosa, error fatal con exit cero y separación de errores frente a noSpeech. PCM silencioso conserva su descarte local. |
| Límites y drenaje de canales | Aprobado | Pruebas de salida por encima de los límites con retención acotada y drenaje de los canales. |
| Cancelación, tiempo máximo y preparación | Aprobado | Pruebas de cierre/espera del CLI directo y unión de hilos en los recorridos aplicables. No acredita gestión de descendientes arbitrarios. |
| Privacidad de códigos R3 | Aprobado | Clases fijas y sufijo `_EXIT_{8HEX}`, con longitud máxima 64; sin raw stderr, rutas o transcripción. |
| CLI instalado: positiva y negativa | Aprobado | Dos pruebas seleccionadas aparte, **5,13 s en total**: audio sintético válido y fixture de modelo inválido rechazado con fallo saneado. |
| CLI instalado con Alice/Gemma activos | Aprobado | Sonda positiva de audio sintético en **8,01 s**. No usa micrófono ni prueba la precisión con el propietario. |
| Cargo check, formato y Clippy | Aprobado | `cargo check`, comprobación de formato y Clippy para todos los targets con `-D warnings`. |
| Compilación nativa | Aprobado | Ejecutable Rust actualizado compilado. CLI y modelo ASR no cambiaron. |
| Apertura y lectura nativas | Comprobado en el recorrido observado | Alice abrió normalmente; Conversación quedó con micrófono apagado. Se revisaron Conversación, Volumen, Memoria y Gobierno en lectura. No hubo rediseño. |
| Aviso de error forzado en la interfaz | No realizado | Las pruebas de errores de proceso no se presentan como una provocación del fallo en la UI nativa. |
| Repetición con voz del propietario | Pendiente | Frase original confirmada, resultado del ASR y efectos reales cuando correspondan. |

Los resultados de frontend **824 aprobadas/2 omitidas**, Obsidian **15** y
respaldo **20** pertenecen al **12 de noviembre** y no se repitieron para este
incremento de proceso. No se atribuyen a la compilación nativa del día 13.

Los tests pueden usar procesos y textos ficticios para comprobar canales y
errores. Eso verifica la frontera de proceso; no es una prueba acústica real.
Una clase de error informa el fallo detectado, sin demostrar automáticamente
la causa de los episodios anteriores.

Los tiempos de las sondas son mediciones sintéticas independientes: 5,13 s es
el total de dos pruebas y 8,01 s corresponde a la positiva con Alice/Gemma
activos. No son latencias de conversación real ni una comparación controlada
contra los fallos originales de 576/1026 ms o la CLI previa de 5,67 s.

## Preservación y siguiente paso

Antes de editar se preservó el código y se creó y verificó un respaldo
integral privado. Este reporte no incluye conversaciones personales,
grabaciones, claves, identificadores de voz ni salidas técnicas privadas.

Con el manejo de fallos comprobado, sigue realizar los cinco turnos
reales breves de reproducir, pausar, reanudar, conversar y apagar el micrófono.
Se mantienen los criterios del
[reporte de feedback](VOICE_TURN_FEEDBACK_REPORT_2026-11-12.md).
R9 continúa abierta; después se retoma autoestudio, recuperación con fuente y
Obsidian dentro del alcance autorizado.

[ADR-P-129](../decisions/ADR-P-129-fallos-del-proceso-whisper.md) ·
[Roadmap](../../Roadmap.md#próximo-paso-autorizado).
