# Preservación de voz baja después del filtro

Fecha: 2026-11-12. Entorno: Windows y Alice Tauri.

## Evidencia de entrada

La opción de dictado manual se hizo visible en `5717895`. El propietario
confirmó por escrito que la frase pronunciada había sido «Alice pausa Spotify»;
el borrador no la conservó. Esa toma no se cierra por silencio, por lo que no
puede atribuirse todo el fallo al plazo de 2 segundos de la sesión automática.
La señal del micrófono y el reconocimiento requieren revisión adicional.

En una toma posterior se comprobó en la interfaz nativa: **Whisper small · local
CPU**, **60,0 s de captura** y **22,8 s de transcripción**. Se completó su
transcripción local y se dejó en borrador. No se envió ese borrador al chat ni
se ejecutó una orden desde él. Su contenido no se usa como referencia de
precisión porque no se confirmó la frase de esa toma posterior.

## Cambio acotado

Voz baja y pausada conserva la salida procesada por RNNoise sin la atenuación
adicional basada en probabilidad. Normal mantiene su objetivo de ganancia
0,08/0,4/1 y el suavizado anterior. No se cambia el nivel previo, los filtros
del navegador, el reconocedor, el detector de fin de frase ni sus límites.
[Decisión](../decisions/ADR-P-125-conservar-voz-baja-filtrada.md).

La revisión del código demuestra que la etapa existía. No demuestra que fuera
la única causa de las sustituciones de palabras en la grabación del propietario.
Tampoco se midió todavía saturación o inteligibilidad del micrófono físico.

## Validación automatizada

- **765 pruebas frontend aprobadas; 2 sondas opcionales omitidas**.
- **29 regresiones específicas** de pipeline/worklet aprobadas, incluidas en
  el total anterior. La compilación TypeScript/Vite pasó; permanece el aviso
  conocido de tamaño de chunks.
- Las tramas simuladas devueltas por el worker con probabilidad baja/intermedia
  conservan amplitud en soft. Normal, omisión y valores desconocidos conservan
  la atenuación anterior. El perfil queda fijado ante reconexiones.
- Ambos perfiles esperan la salida del worker antes de producir sonido y
  conservan límites de cola, descarte por frecuencia incompatible y cierre
  frente a respuestas tardías.

Estos controles validan el procesamiento de una señal conocida, no la
inteligibilidad de la voz del propietario. El backend y los almacenes no se
modificaron: 385 pruebas Rust, 15 de Obsidian y 20 de respaldo corresponden a
las comprobaciones previas documentadas, no a una nueva ejecución en este ajuste.
La precisión de una frase real se comprobará por separado al reabrir Alice.

## Respaldo

Alice se cerró normalmente antes de modificar audio. Se verificó el respaldo
privado `D:\Alice Backups\Alice Continuum\snapshot-2026-11-12T18-48-00-474Z-351d8352-c2d7-4cbf-a743-b101519840f4`.
El código anterior está en `local/backups/voice-soft-preserve-20261112/source-before.zip`.
El ajuste no añade archivos de audio, métricas persistidas ni envíos externos.
Los **134 archivos privados** conservaron sus huellas durante este ajuste y
sus pruebas, antes de reabrir Alice.
