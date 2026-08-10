# Plan de implementación R4 — Taller de habilidades

Estado: en curso; incrementos 1, 2, 3 y 4 implementados  
Fecha: 2026-08-10

## Objetivo

Permitir que Carlos Nuñez enseñe procedimientos reutilizables, inspeccionables y reversibles sin conceder ejecución autónoma ni aceptar código arbitrario.

## Incremento 1 — Contrato y validaciones ✅

- Tipos Rust cerrados con `deny_unknown_fields`.
- Parser TypeScript defensivo.
- Identidad, versión, procedencia, pasos, entradas, salidas, precondiciones y comprobaciones.
- Validación real contra IDs, operaciones, madurez y riesgo de R1.
- Menor privilegio: todo requisito debe ser utilizado por un paso.
- Política fija `simulationOnly`, desactivada y sin red, procesos o escritura.
- En R4.1 aún no existían comandos, almacenamiento o cambios de estado.

## Incremento 2 — Almacén local de borradores ✅

- Definir `data/skills/manifest.json` y archivos por habilidad con crecimiento acotado.
- Crear, leer y editar únicamente borradores mediante comandos nativos.
- Escritura atómica, respaldo y rechazo de rutas fuera de la raíz.
- No permitir `approved`, activación o ejecución.

**Resultado 2026-08-09:** tres comandos nativos permiten listar, leer y guardar sólo borradores bajo `data/skills`. El índice cerrado enlaza borrador y respaldo anterior mediante SHA-256; las ediciones exigen la revisión previa y los reemplazos sincronizados intentan restaurar el estado anterior ante fallos. Las lecturas no crean carpetas y no existe comando de aprobación o ejecución.

## Incremento 3 — Simulador de planes ✅

- Resolver el manifiesto contra el snapshot R1 vigente.
- Mostrar pasos, datos, permisos, efectos y bloqueos sin llamar adaptadores.
- Producir un resultado de simulación cerrado, reconstruible y sin contenido sensible.

**Resultado 2026-08-10:** `simulate_skill_plan` realiza análisis estático contra R1 y devuelve el método cerrado `r4-static-plan-v1`, digests SHA-256, pasos, permisos, efectos, alcances y bloqueos. No recibe valores, no llama adaptadores y fija ejecución y efectos en `false`. Una prueba viva construyó el registro desde los datos canónicos sin modificarlos.

## Incremento 4 — Versionado, ciclo de vida y auditoría

- Revisión, aprobación, desactivación y retiro mediante transiciones nativas.
- Crear revisiones inmutables; nunca sobrescribir una versión aprobada.
- Emitir eventos R3 correlacionados para cada transición y simulación.
- Mantener ejecución real desactivada.

**Resultado 2026-08-10:** las decisiones se ligan a revisión y SHA-256 confirmados por el propietario local. `lifecycle.json` referencia revisiones inmutables; aprobar, desactivar, restaurar y retirar crean archivos nuevos y conservan los aprobados. Cada transición y simulación emite solicitud y cierre R3 correlacionados sin contenido ni motivo privado. `approved` continúa siendo `simulationOnly` y no invoca adaptadores.

## Incremento 5 — Taller visible y habilidad local de solo lectura

- Editor accesible para manifiestos y simulación.
- Primera habilidad local de solo lectura validada de extremo a extremo.
- Permisos R2 visibles si la futura ruta los requiere.
- Activación y ejecución seguirán fuera de alcance hasta una decisión posterior explícita.

## Puertas obligatorias

- Rust, TypeScript, `fmt`, `clippy`, build web y build Tauri.
- Archivos temporales o datos sintéticos aislados; nunca recuerdos privados como fixture.
- Cero comandos libres, código descargado, instalación externa o autoaprobación.
- `data/`, avatar y credenciales preservados y excluidos de Git.
