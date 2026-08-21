# ADR-P-083 — Confirmación transaccional de aprendizaje local

Fecha: 2026-08-20  
Estado: aceptada

## Contexto

R6.4-B separó propuesta y confirmación, pero React todavía convertía el candidato aprobado en una enseñanza y llamaba al guardado general. Entre la vista previa y ese guardado, `records.json` podía cambiar; además, la revalidación del candidato, el respaldo, la sustitución y la auditoría no constituían una sola operación nativa.

## Decisión

- Exponer `confirm_learning_candidate` bajo la capacidad existente `memory.records.write`.
- Exigir confirmación explícita, modelo Ollama local, ID de fuente y SHA-256 exacto revisado.
- Recibir tanto la propuesta original como la edición humana aprobada.
- Releer el recuerdo y reconstruir en Rust el candidato original, incluida la evidencia literal y su ID determinista.
- Volver a validar tipo, clase, título, contenido e importancia antes de escribir.
- Serializar confirmación, guardado general y restauraciones de `records.json` mediante un bloqueo común del proceso.
- Crear un respaldo exacto y sustituir la fuente mediante archivo temporal y renombrado atómico.
- Escribir auditoría de memoria después de la sustitución; restaurar la fuente original si esa auditoría falla.
- Hacer idempotente sólo el reintento exacto. El mismo candidato con contenido distinto se rechaza.
- Recargar la memoria en React desde Rust después del éxito; la interfaz no fabrica el registro confirmado.

## Consecuencias

Una confirmación ya no depende de una instantánea editable mantenida sólo en React. Una fuente obsoleta, un candidato alterado, una edición inválida o un fallo de auditoría terminan sin una nueva enseñanza canónica. La operación sigue siendo gobernada: no confirma automáticamente lo que propone el modelo y no convierte confianza estadística en verdad.

El bloqueo es local al proceso actual. Una futura escritura desde otro proceso deberá incorporar bloqueo de archivo o un único servicio propietario del almacén.

## Evidencia

- Éxito físico con respaldo exacto y auditoría.
- Reintento idéntico sin duplicación ni segunda auditoría.
- Reintento alterado rechazado sin cambios.
- SHA-256 obsoleto rechazado sin cambios.
- Fallo inducido de auditoría con restauración exacta.
- Sonda sobre los datos canónicos: 21 archivos conservaron sus huellas.
