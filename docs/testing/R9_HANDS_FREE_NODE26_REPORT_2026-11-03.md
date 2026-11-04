# Sesión automática de voz y actualización a Node 26

Fecha: 2026-11-03. Entorno: Windows, `E:\Alice Cognitive Core`.
Contrato: [ADR-P-099](../decisions/ADR-P-099-sesion-de-voz-y-node-26.md).

## Resultado implementado

Una acción **Iniciar conversación por voz** prepara Gemma y permite la secuencia
captura → pausa → transcripción local → respuesta local → Fish → reproducción →
nueva escucha. No exige revisiones por turno. **Detener conversación** cancela
captura y reproducción, revoca la sesión e impide continuar con resultados
tardíos. Salir de la pantalla y el límite de dos horas también la detienen.

El diálogo de la sesión se conserva como contexto no factual; incorporar
historial anterior y recuerdos depende de las casillas elegidas antes del inicio.
No se crean recuerdos confirmados ni se invocan herramientas. El modo manual
con sus revisiones sigue disponible como opción secundaria.

La captura automática detecta energía local, exige dos muestras de voz y termina
tras un segundo de pausa. El silencio se descarta y rearma sin ASR ni TTS.
Cada toma automática se limita a 20 segundos y 8 MiB. El micrófono se libera antes
de procesar y permanece apagado durante la respuesta/reproducción. Se puede
terminar una frase con **Terminé de hablar**.

La respuesta oral solicita una a tres frases, sin listas ni fórmulas repetidas,
con máximo de 240 tokens. Fish recibe una indicación contextual corta,
`latency=balanced`, velocidad 1.0 y normalización de volumen. Se conserva el
modelo explícito `s2.1-pro-free`. Estos ajustes requieren evaluación por escucha;
no demuestran una mejora acústica ni cuantifican la latencia humana.

## Entorno actualizado

- Instalación del equipo: `C:\Program Files\nodejs`, Node **26.13.0 LTS Lithium**,
  npm **11.20.0**, comprobados desde una nueva ejecución de PowerShell.
- MSI y ZIP oficiales verificados contra SHA-256 publicado; MSI con firma válida
  de OpenJS Foundation. Instalador Windows finalizó con código 0.
- Copia portátil verificada en `%LOCALAPPDATA%\Programs\AliceNode` para el lanzador.
- `.node-version`, `engines` del proyecto y lock alineados con Node 26.13.0.
  No se actualizaron las versiones de las dependencias ni los modelos de IA.
- Lanzador, README, manual, runbooks, roadmap, plan R9 y especificación HTML
  actualizados. Los contratos históricos se conservan con la sustitución explícita
  de las confirmaciones por turno en el modo automático.

## Verificaciones

| Comprobación | Resultado |
|---|---|
| `npm test` | 499 aprobadas, 2 omitidas; 59 archivos aprobados |
| `npm run build` | TypeScript y Vite aprobados con Node 26 |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib` | 294 aprobadas, 23 sondas ignoradas |
| `cargo build --manifest-path src-tauri/Cargo.toml` | Ejecutable nativo compilado |
| `rustfmt --check` en los cuatro módulos Rust modificados de voz/cloud | Aprobado |
| `Iniciar Alice Continuum.cmd --check` | Entorno listo; no abre micrófono ni inicia modelos |
| `git diff --check` | Aprobado |

Las pruebas cubren ciclo y nueva escucha con una sola autorización, silencio sin
solicitudes, cancelación durante autorización/ASR/respuesta/TTS, fallo sin
reintento, liberación de pistas/detector, límite de tamaño y reemplazo/revocación
de sesiones nativas. La composición de contexto distingue diálogo de evidencia.

La interfaz de escritorio se inspeccionó en reposo: botón principal automático,
aviso de alcance, micrófono apagado y modo manual plegado. La instancia de prueba
y Vite quedaron cerrados. Esta inspección no sustituye el recorrido acústico.

## Datos y alcance de la evidencia

Se compararon los 43 archivos canónicos con SHA-256. **42 conservaron su huella**,
incluidos historial y memoria. El archivo de auditoría recibió exactamente una
línea `process.startup / PROCESS_STARTED` durante la verificación de arranque.
Se comprobó que su prefijo anterior coincide con la huella inicial; no se retiró
esa auditoría ni se modificaron intercambios o recuerdos. Las pruebas adicionales
usaron una raíz separada bajo `artifacts/`.

No se ejecutó en esta entrega una conversación completa con micrófono humano
ni una nueva síntesis real de Fish. Las sondas reales del incremento anterior
están documentadas en [turnos guiados](R9_VOICE_TURNS_REPORT_2026-11-03.md).
Falta aceptar varios turnos con la voz del propietario y medir por separado ASR,
generación, Fish y comienzo audible.

El enlace de YouTube sirvió como referencia del objetivo; no se obtuvo una
transcripción verificable de su implementación y no se afirma equivalencia.
Este incremento no implementa streaming, escucha simultánea ni interrupción por
voz. El ruido puede activar el detector. Detener no garantiza cancelar cómputo
ya iniciado en Gemma/Fish, aunque se descarta su continuación en la sesión.

Node actualiza las herramientas del proyecto; no acelera por sí mismo Gemma o
Fish. Persisten el aviso previo de Vite por paquetes grandes y los mensajes
informativos del enlazador de Rust. No se declara cierre de R9 ni distribución.

Los registros técnicos y sumas de esta ejecución quedan en
`artifacts/r9-hands-free-2026-11-03/`, excluidos de Git. No contienen claves.

## Referencias oficiales

- [Node 26.13.0 LTS, publicado el 28 de octubre de 2026](https://nodejs.org/en/blog/release/v26.13.0).
- [API Fish: latencia, prosodia y modelo gratuito](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech).

