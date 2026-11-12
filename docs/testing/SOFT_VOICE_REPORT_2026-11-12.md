# Entrada para voz baja y habla pausada

Fecha: 2026-11-12. Proyecto: `D:\Alice Continuum`.

Después de la pérdida de palabras en las pruebas de Spotify, el propietario
explicó que hablaba bajo y despacio por ser de madrugada. Solicitó aumentar la
sensibilidad. La revisión de Whisper ya había retirado un texto inicial fijo,
pero una toma posterior todavía confundió el nombre del servicio. No se da por
aceptada la precisión acústica por esos cambios.

Se añade **Voz baja y pausada** como perfil inicial de Conversación, seleccionable
en **Audio de entrada** junto a **Normal**. Aplica ganancia local 4× antes de
RNNoise y permite 2 s de silencio entre palabras antes de terminar el turno
automático. Normal conserva 1× y 1 s. El dictado manual recibe la ganancia del
perfil y conserva su botón para terminar.

## Comprobaciones

- **738 pruebas frontend aprobadas; 2 sondas opcionales omitidas**.
- **15 pruebas de Obsidian** y **20 de respaldo/restauración** aprobadas.
- TypeScript/Vite compilados; se conserva el aviso conocido de tamaño de chunks.
- El backend no cambia en este incremento; las 378 pruebas Rust y Clippy
  corresponden a la revisión de ASR anterior, commit `a0bcfa6`.

Las nuevas regresiones comprueban la ganancia aplicada, la cadena completa
micrófono → pasaaltos → ganancia → RNNoise → destino filtrado, la liberación del
nodo y el perfil comunicado. Un valor desconocido conserva Normal. El detector
tolera pausas de 1 a 1,75 s en el perfil de voz baja, cierra a los 2 s y mantiene
rechazo de ruido, golpes y evidencia insuficiente. Una regresión del
controlador comprueba que el perfil llega al filtro y al detector antes de anunciar escucha.

Esto prueba configuración y comportamiento bajo señales controladas. No es
una grabación con la voz del propietario ni una medición de precisión de Whisper.

## Protección de los datos

Alice se cerró normalmente antes de editar. Se creó y verificó el respaldo
privado `D:\Alice Backups\Alice Continuum\snapshot-2026-11-12T03-20-46-650Z-440bfe84-1a31-4a5c-b694-65ba5f7e10e1`.
El archivo de código previo está en `local/backups/voice-soft-20261112/source-before.zip`.
Los 134 archivos privados conservaron sus huellas durante edición y pruebas,
antes de reabrir la aplicación. No se cambian permisos ni volumen del sistema.

## Repetición personal

El propietario informó: «Me oye, pero cambia alguna palabra». En la interfaz
nativa se confirmó **Voz baja y pausada**, tanto en el selector como en el perfil
de la última captura. Una toma conservó «Alice Pausa Spotify» y recibió
**Spotify quedó en pausa**; otras sustituyeron el servicio o el verbo. Esa toma
correcta demuestra un caso funcional, no una precisión estable. El micrófono se
apagó antes de continuar el diagnóstico.

La captura se mantiene fija al evaluar un reconocedor más capaz. No se añade
una corrección aproximada de «Spotify» ni se reconstruyen acciones ausentes.
Ver [la evaluación de Whisper small](WHISPER_SMALL_REPORT_2026-11-12.md).

## Aceptación pendiente

Repetir en voz baja una frase completa al aparecer **En espera**. Comprobar la
transcripción, el recibo y la salida audible; después comprobar pausas naturales
y apagado.
Separar esta prueba de la posterior con música y de los cinco turnos cotidianos.

La amplificación puede elevar también el ambiente y puede saturar con voz
fuerte. El selector Normal queda disponible para esas condiciones. Ningún
perfil elimina la revisión de la acción ni confirma la identidad del hablante.
