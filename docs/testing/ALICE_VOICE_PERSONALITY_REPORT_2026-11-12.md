# Voz privada y personalidad de Alice

Fecha: 2026-11-12. Entorno comprobado: Alice Tauri en Windows.

## Alcance implementado

- Perfil privado `voice-profile.json`, esquema 1, con `referenceId`. El perfil
  local válido tiene prioridad; la variable `ALICE_FISH_REFERENCE_ID` sólo se
  usa si falta el archivo. Un perfil presente inválido impide seleccionar voz.
- `FISH_API_KEY` permanece en el entorno y el modelo sigue siendo
  `s2.1-pro-free`. Este reporte no contiene el identificador real ni claves.
- Personalidad compartida para texto, voz y visión: estilo inspirado en Akali,
  seguro, directo, informal y con humor seco ocasional. Alice conserva su
  identidad, empatía, solidaridad, humildad y reconocimiento de límites.
- Saludo breve, sin pregunta obligatoria. Entrega TTS contextual
  `[confident, conversational]`, dentro del texto revisado y su huella.
- Procedencia, pronombres, citas, recibos, permisos y autorización conservados.
  No hay cambios en ASR, filtros, ganancia ni currículo de autoestudio.

## Casos de comprobación

Las pruebas de configuración usan identificadores ficticios y carpetas
temporales: prioridad local, compatibilidad sólo por ausencia, versión y
formato inválidos, campos desconocidos y ausencia de filtración del contenido
del perfil en los errores. La preparación de voz debe coincidir con la misma
política que usa la síntesis.

Las pruebas de prompts comprueban inclusión del mismo bloque de personalidad,
saludo sólo ante el mensaje actual y conservación de procedencia y límites
multimodales. Las de TTS comprueban que la entrega está acotada, forma parte
del texto revisado y no altera la retirada exclusiva del aviso inicial de
interfaz al hablar. Estas comprobaciones no califican una voz escuchada.

## Resultados del incremento

| Comprobación | Estado actual | Resultado y alcance |
|---|---|---|
| Tests Rust y configuración de voz | Aprobado | `cargo test --manifest-path src-tauri/Cargo.toml --lib`: 391 aprobados, 30 sondas opcionales omitidas. |
| Formato y Clippy | Aprobado | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` y `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`. |
| Frontend y compilación TypeScript/Vite | Aprobado | `npm test`: 808 aprobados y 2 sondas omitidas; 15 de Obsidian y 20 de respaldo. `npm run build` pasó, con el aviso existente de tamaño de chunks. |
| Revisión nativa | Aprobado para este recorrido | Ejecutable recompilado, mensaje escrito procesado por Gemma, revisión de texto Fish y vuelta a reposo. Micrófono apagado al terminar; borrador anterior restaurado. |
| Síntesis de la nueva voz | Aprobado | Frase genérica revisada: «Soy Alice. Vamos al grano y resolvamos esto paso a paso.» con la dirección contextual. Auditoría `VOICE_SYNTHESIS_COMPLETED`, éxito en 4165 ms; sin error visible. |
| Escucha y preferencia del propietario | Pendiente | El éxito de la síntesis y el recorrido de interfaz no acreditan que el propietario la haya escuchado ni aprobado su naturalidad. |
| Coherencia del estilo en uso real | Pendiente | Saludo, petición operativa, incertidumbre, corrección y tema personal |

Para la valoración del estilo, usar ejemplos ficticios sin incorporarlos a
memoria: una consulta concreta, un error que corregir, una fuente incierta y
una vivencia personal. La franqueza debe producir claridad; el humor ocasional
no debe convertirse en burla ante angustia ni en presión para actuar.

## Pendiente independiente: reconocimiento por micrófono

La sustitución de palabras al dictar continúa sin resolverse y la aceptación
acústica de R9 permanece abierta. No se anuncia que Alice haya escuchado una
prueba nueva ni que el micrófono esté corregido. La siguiente comprobación de
entrada debe comparar frase pronunciada, sonido de la misma toma filtrada,
medición parcial de señal y transcripción, con los controles del
[diagnóstico local](VOICE_INPUT_DIAGNOSTICS_REPORT_2026-11-12.md).

Cambiar la voz TTS o la personalidad no demuestra una mejora de Whisper ni
explica por sí solo el fallo de reconocimiento.

## Preservación

El trabajo parte del respaldo integral verificado antes de este incremento.
El perfil real y las credenciales se mantienen fuera de los archivos públicos.
Se añadió únicamente la selección de voz; no se modificaron claves ni variables
globales del sistema. La comparación del manifiesto previo no encontró archivos
originales ausentes. El arranque y la prueba actualizaron historial, auditoría,
autoestudio y su proyección en Obsidian; el README de datos también cambió por
documentación. No se presenta el almacenamiento como inmutable durante el uso.
La síntesis externa recibió sólo la frase genérica revisada y su dirección de
voz; no se enviaron recuerdos, audio del micrófono ni historial a Fish.

[Decisión ADR-P-127](../decisions/ADR-P-127-voz-privada-y-personalidad-alice.md) ·
[Formato y configuración](../runbooks/03-conversacion-y-voz.md#voz-privada-y-personalidad).
