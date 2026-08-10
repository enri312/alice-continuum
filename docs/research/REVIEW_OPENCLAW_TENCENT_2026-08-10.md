# Revisión técnica de `analysis_results.md`

Fecha: 2026-08-10  
Estado: revisado contra fuentes primarias; documento de investigación, no especificación

## Dictamen

El análisis generado por Claude Opus 4.6 es un buen mapa de patrones y acierta al priorizar revisión humana, versionado y procedencia. No debe aplicarse literalmente: combina conceptos de versiones distintas, atribuye a Alice componentes que aún no existen y califica como de riesgo cero cambios que modificarían el contexto de autoridad del modelo.

El archivo original `analysis_results.md` se conserva intacto y fuera de este dictamen. Esta revisión es la que gobierna cualquier adopción futura.

## Confirmado en fuentes oficiales

- OpenClaw tiene un Skill Workshop basado en propuestas, hashes, inspección, evaluación y un paso `apply`; la propuesta no equivale a una habilidad activa. También admite modos de autoaprendizaje y aplicación automática, por lo que Alice adopta solamente el patrón de propuesta explícita y no su autonomía configurable. Fuente: <https://docs.openclaw.ai/tools/skill-workshop> y <https://docs.openclaw.ai/tools/self-learning>.
- `SOUL.md` se inyecta en sesiones normales y afecta voz y comportamiento. La propia guía separa personalidad de reglas operativas y recomienda mantenerlo conciso y versionado. Fuente: <https://docs.openclaw.ai/concepts/soul>.
- Dreaming es consolidación de fondo y su fase profunda puede reescribir `MEMORY.md`; no se limita a producir propuestas. Por eso una futura adaptación de Alice deberá ser opt-in, local, auditable y producir candidatos revisables, nunca verdad automática. Fuente: <https://docs.openclaw.ai/concepts/dreaming>.
- Standing Intents existe, pero es una instrucción condicionada por eventos. Un recordatorio para una fecha u hora corresponde a tareas programadas, no a un standing intent. Fuente: <https://docs.openclaw.ai/concepts/standing-intents>.
- TencentDB Agent Memory documenta la progresión L0 Conversation → L1 Atom → L2 Scenario → L3 Persona, recuperación BM25/vector/RRF y activos de memoria gobernados. La versión oficial actual también incluye Skills, Wiki y CodeGraph con propiedad, versiones y visibilidad. Fuente: <https://github.com/TencentCloud/TencentDB-Agent-Memory>.

## Correcciones necesarias al informe

1. Alice no usa SQLite para su memoria vigente. R4 parte de JSON validado, JSONL de auditoría y archivos locales bajo `data/`.
2. `data/skills/drafts` no “ya existe” en los datos canónicos. El código sabe crearlo sólo ante un guardado explícito; al revisar este informe `data/skills` seguía ausente.
3. `alice-identity.md` no es “cero riesgo”. Inyectarlo en el contexto del LLM cambia autoridad, conducta, privacidad y presupuesto de tokens. Requiere contrato, precedencia, versionado, pruebas y una decisión posterior; no se adelanta durante R4.
4. Dreaming de OpenClaw sí puede realizar escritura duradera. La salida “sólo propuestas” sería una regla propia de Alice, no una descripción del original.
5. Standing Intents no sustituye tareas horarias. Alice debe mantener separados disparadores por evento, recordatorios y acciones programadas.
6. Guardar conversaciones crudas como L0 por defecto contradice minimización y consentimiento. R6 deberá definir retención, redacción, vencimiento y revisión antes de decidir si conserva señal cruda.
7. Los porcentajes de benchmark pertenecen al escenario y versión publicados por Tencent; no son una reducción universal garantizada para Alice.
8. El repositorio oficial vigente redirige de `Tencent` a `TencentCloud` y su arquitectura actual es un Memory Hub para equipos. Las afirmaciones de una edición anterior no deben mezclarse con el producto actual sin fecharlas.

## Decisión para Alice

| Fase | Patrón aprovechable | Restricción de Alice |
|---|---|---|
| R4 | propuesta, revisión, hash, versión, aprobación y retiro | propietario local explícito; sin ejecución |
| R5 | extraer candidatos de procedimientos repetidos | nunca autoaprobar ni aprender de una única aparición |
| R6 | capas de memoria y consolidación | no conservar conversación cruda por defecto; promoción revisable |
| R7 | separar evento, reloj y aspiración | cada acción con alcance, vencimiento, permisos y cancelación |
| R8 | grafos y trazabilidad por fuente | visualización derivada de evidencia real, no actividad decorativa |
| R9+ | canales y dispositivos como adaptadores | siempre detrás de R1, R2 y R3; sin copiar el runtime externo |

## Próxima decisión

Cerrar R4 antes de introducir identidad, extracción L1 o consolidación. El incremento R4.4 adopta únicamente revisiones inmutables, decisiones ligadas por SHA-256 y auditoría R3 correlacionada. R4.5 añadirá la superficie visible y una primera habilidad local de sólo lectura.

