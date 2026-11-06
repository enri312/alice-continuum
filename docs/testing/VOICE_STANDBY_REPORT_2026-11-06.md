# Espera de voz, control y revisión de frameworks

Fecha: 2026-11-06. Base: `fc07b69`. Implementación: `794bb92`;
ajuste de portabilidad de la prueba HTTP: `c97f57c`.
La gramática final añade abstención ante enunciados y preguntas en tercera
persona sobre Alice en `18f03fb`.

## Resultado aportado por el propietario

La respuesta a «Hola, Alice, ¿me escuchas? Quiero seguir mejorándote» atribuyó
la mejora a Alice. Es un caso positivo, no una aceptación de continuidad de cinco
turnos. La orden se transcribió como «Detend la conversación, Alice» y recibió
«De acuerdo, Carlos. Detengo la conversación». El código sólo reconocía «deten»;
el modelo respondió al texto, lo cual no acredita que se hubiera cerrado la sesión.

## Comportamiento implementado

- La escucha comienza en espera, después de iniciarla explícitamente.
- Se atienden llamadas directas, como «Alice, abre Spotify» y «¿Me escuchas,
  Alice?». Se descartan frases ambientales y referencias narrativas a Alice.
- «Detén/Detend la conversación, Alice» vuelve a esperar sin diálogo ni TTS.
- «Apaga el micrófono, Alice», «Deja de escuchar, Alice» y el botón de apagado
  cierran la captura y revocan la sesión. Las pausas no extienden sus dos horas.
- Se conservan Gemma, Whisper, Fish y la voz configurada. Se añade únicamente
  `@types/node` 26.6.6 como dependencia de desarrollo para tipar la configuración
  Node de Vite; no es otro motor ni un servicio de producción.

[ADR-P-112](../decisions/ADR-P-112-espera-por-nombre-y-apagado.md) y
[revisión del informe solicitado](../research/FRAMEWORKS_REVIEW_2026-11-06.md).
El original `evaluacion_frameworks_ia_asistente.md` se conserva sin editar.

## Pruebas

- **608 pruebas frontend aprobadas, dos omitidas**; TypeScript y Vite compilan.
- Compilación nativa y arranque con el lanzador habitual Windows: aprobados.
- [CI Ubuntu 24.04 final](https://github.com/enri312/alice-continuum/actions/runs/42166714916)
  aprobada sobre `18f03fb`: 608 pruebas frontend, 334 Rust y 28 omitidas, cinco
  pruebas Python, sonda documental adicional, formato, Clippy con `-D warnings`,
  compilación y arranque aislado. La aceptación de hardware en Ubuntu 26.04.1
  del propietario continúa separada.
- Regresiones de órdenes: la grafía «Detend», citas, negaciones, vocativos
  iniciales/finales, referencias a terceros y apagado distinto de la pausa.
- Secuencia de ocho frases: ambiente ignorado, dos llamadas atendidas, pausa,
  reanudación y apagado, con una autorización y dos síntesis. Los textos ignorados
  no aparecen en observación ni se envían a respuesta/herramientas/Fish.
- El límite de dos horas se mantiene después de pausar. Se conservan las pruebas
  de rechazo de resultados tardíos, cancelación y recuperación ante fallos de voz.
- HTML v0.62: estructura equilibrada, 23 identificadores únicos, 98 enlaces
  locales del HTML y 241 enlaces de Markdown comprobados. La portada sigue
  precediendo al contenido; se actualizaron manual, runbook y plan R9.
- Los 116 archivos protegidos de datos, activos, iconos y reporte original
  conservaron su SHA-256 durante las pruebas. Al reabrir Alice sólo cambió la
  auditoría R3 por los eventos `PROCESS_STARTED`, con prefijo anterior intacto.
- En la aplicación nativa se comprobaron «Micrófono apagado», «Iniciar escucha
  de Alice» y el aviso nuevo. No se activó el micrófono físico, la cámara ni
  el escritorio; se deja la sesión preparada para la aceptación del propietario.

## Corrección HTTP puntual

Vite sirvió un archivo ficticio de `data/` con HTTP 200 antes de la corrección.
Se cerró ese acceso conservando sus exclusiones predeterminadas de credenciales.
Después, cinco rutas al archivo ficticio devuelven **403**, incluyendo mayúsculas,
nombre codificado, consulta `?raw` y ruta absoluta `@fs`. No se descargaron recuerdos.

Ocho pruebas HTTP usan una tienda desechable en el caché del proyecto y comprueban
también `local/`, caché Rust y credenciales, además de la disponibilidad del HTML
y los iconos. Se corrigió una suposición de la prueba en Linux: una ruta inexistente
con mayúsculas puede devolver el HTML público de la SPA con 200; se comprueba su
contenido para distinguirlo de la exposición de un archivo privado.

Los pilotos antiguos dejan de leer `local/` por HTTP. El preparador explícito
`node scripts/testing/prepare-voice-fixtures.mjs` copia sólo las fixtures sintéticas
conocidas a `scripts/testing/.fixtures/`, ignorado en Git. El piloto de conversación
ahora comprueba retorno a espera al tercer audio. No se ejecutó esta sonda con
Fish en la revisión: las pruebas indicadas arriba son automatizadas.

## Aceptación pendiente

El filtro utiliza texto después de transcribir y exige «Alice» en cada frase que
se quiera atender. No es wake-word acústico, identificación de Carlos ni
comprensión general de a quién va dirigida una frase. El micrófono mantiene
pausas durante transcripción, procesamiento y reproducción. Continúa pendiente
la escucha simultánea/interrupción con control de eco y la prueba acústica real.

Prueba sugerida: iniciar escucha; hablar una frase cotidiana sin nombre y comprobar
que no responde; «Alice, ¿me escuchas?»; «Detén la conversación, Alice»; otra
frase sin nombre; «¿Me escuchas otra vez, Alice?»; «Apaga el micrófono, Alice».
Verificar estado, ausencia de respuestas ambientales y apagado final. Repetir
con música de la notebook y de otro equipo después de la pasada sin música.

Evidencia privada: `local/artifacts/voice-standby-2026-11-06/`.
