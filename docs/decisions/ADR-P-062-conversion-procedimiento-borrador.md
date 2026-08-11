# ADR-P-062 — Conversión explícita de candidato R5 a borrador R4

Fecha: 2026-08-11  
Estado: aceptada para R5.4

## Contexto

R5.3 permite conservar un candidato verificado, pero conservar no debe crear automáticamente una habilidad. La conversión necesita cruzar la frontera entre aprendizaje observado y Taller sin perder procedencia, sobrescribir borradores ni hacer pasar una decisión administrativa por actividad cognitiva de Alice.

## Decisión

- Sólo una decisión `retain` con candidato y SHA-256 válidos puede convertirse.
- La conversión exige actor `localOwner`, confirmación explícita, huella y SHA-256 esperados y un motivo de 12 a 600 caracteres.
- El propietario puede corregir `skillId`, título, descripción y propósito antes de escribir.
- El destino siempre es un manifiesto R4 nuevo, `draft`, versión 1, `simulationOnly`, sin red, procesos, escritura, aprobación o ejecución.
- Cada paso y requisito se deriva de las capacidades/operaciones observadas; R4 vuelve a validar el manifiesto completo contra R1.
- `SkillProvenance` admite un enlace opcional y cerrado con `decisionId`, `candidateId`, `fingerprint` y `candidateSha256`.
- La procedencia R5 no puede editarse y sobrevive revisión, aprobación, desactivación y restauración como revisiones nuevas e inmutables.
- Una huella sólo puede originar un borrador. Un `skillId` ocupado se rechaza; R5.4 nunca sobrescribe otro borrador.
- El estado de conversiones cruza cada procedencia del borrador con la decisión y el candidato R5 originales; una referencia huérfana o alterada bloquea la lectura.
- La auditoría usa `procedure.candidate.convert`, sin contenido ni motivo en claro.
- Los eventos administrativos `source=procedure` cuentan como eventos visibles, pero no elevan señal global ni activan regiones del Núcleo.

## Consecuencias

- R5 puede entregar material verificable al Taller sin conceder autonomía.
- Un borrador convertido todavía requiere todo el gobierno R4.
- El estado canónico continúa en cero mientras no exista un candidato real retenido.
- R5.4 no crea memoria, aprendizaje motor ni actividad afectiva; esos contenidos corresponden a fases posteriores.

## Evidencia

Las pruebas crearon archivos R5 y R4 reales en directorios temporales, verificaron SHA-256, procedencia, rechazo de descartes, uso único, no sobrescritura y ciclo R4 con nuevas revisiones y restauración. La sonda canónica informó cero conversiones, ejecución falsa y aprobación automática falsa sin modificar ningún archivo.
