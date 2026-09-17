# R8.2 — Relaciones revisables entre episodios

## Alcance entregado

En Flujo cognitivo, la sección «Relaciones entre recuerdos» permite elegir dos
episodios recuperables y copiar una cita literal de la entrada de cada uno.
Revisar valida fuentes/versiones/huellas; confirmar guarda `relatedExperience`
como criterio explícito del propietario, sin afirmar causalidad ni verdad semántica.
Retirar y restaurar requieren confirmación y generan revisiones adicionales.

El volumen 3D todavía no consume estas aristas. No hay inferencia de asociaciones,
embeddings ni envío a modelos. R8.3 y R8.4 continúan pendientes.

## Persistencia y recuperación

- Archivos numerados en `data/memory/associations-v1/`, máximo 1000 revisiones,
  64 KiB por revisión y 8 MiB leídos por historial.
- Cada revisión conserva identidad, decisión, localizadores de evidencia,
  versiones, huellas, fecha y huella de la revisión anterior. No duplica citas.
- Publicación desde temporal sincronizado y renombrado; no sobrescribe revisiones.
- Lock entre procesos y revisión esperada evitan aplicar decisiones sobre estado
  obsoleto. Lecturas no crean el historial.
- Corrupción o huecos producen error; no se repara ni se elimina evidencia sola.
- Un cierre abrupto puede dejar `writer.lock`: antes de retirarlo manualmente hay
  que cerrar todas las instancias y revisar la cadena. Nunca se borra automáticamente
  un lock presuntamente ajeno. Los temporales incompletos no se consideran revisiones.
- Si falla la auditoría final después de guardar, el error avisa que la revisión
  existe y exige actualizar antes de repetir. Solicitud/resultado R3 no llevan texto.
- No es un registro autenticado contra manipulación deliberada del disco: las
  huellas detectan inconsistencias, no reemplazan una firma ni un respaldo externo.

Al consultar, R6 y la evidencia exacta se revalidan. Una fuente corregida, suprimida,
archivada o eliminada excluye la arista del snapshot sin borrar su historial.
Una relación retirada sólo se restaura si sus fuentes aún coinciden.

## Evidencia de pruebas

- Rust: 264 aprobadas; 21 sondas opcionales ignoradas por defecto.
- TypeScript: 436 aprobadas en 46 archivos.
- Clippy `-D warnings`, frontend y ejecutable nativo: aprobados.
- Cinco pruebas de archivos: ciclo completo/relectura, confirmación y versión
  obsoleta, duplicados invertidos, invalidaciones, corrupción y lock ajeno.
- `scripts/testing/probe-associations-ui.cjs`: WebView2 real con copia temporal
  de registros canónicos, sin enviar texto a modelos ni imprimir citas.

```text
nativeUi=true saved=true withdrawn=true restored=true reload=true
staleSourceExcluded=true immutableRevisions=3 canonicalFilesPreserved=36
```

La relación usada por la sonda sólo existe en la copia temporal de prueba: no es
una conclusión sobre el propietario ni un aprendizaje de Alice. La prueba cambia
una entrada únicamente en esa copia para comprobar que deja de alimentar el grafo.
Los originales conservaron sus huellas.

## Registro R1

36 capacidades: nueva `memory.graph.manage`. Confirmación visible (CurrentUi),
con validación nativa de evidencia y versión; no se presenta como grant R2 ni
habilita ejecución autónoma. Inspección separada, siempre de sólo lectura.
