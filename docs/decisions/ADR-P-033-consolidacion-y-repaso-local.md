# ADR-P-033 — Consolidación y repaso local verificable

Fecha: 2026-08-07  
Estado: aceptada para implementación

## Contexto

Los recuerdos de Alice ya conservan importancia, fuerza de almacenamiento, confirmaciones, dificultades y fecha de último repaso, pero esos campos no participan todavía en una regla operativa. Mostrar una consolidación creciente sin eventos verificables sería engañoso, y entrenar los pesos del modelo de nube no está dentro del alcance.

## Decisión

- Crear una cola local de repaso derivada únicamente de las enseñanzas directas en `records.json`. Las conversaciones guardadas no se consolidan automáticamente como conocimiento confirmado.
- Programar intervalos base de 1, 3, 7, 14, 30, 60 y 120 días.
- Revisar con mayor frecuencia los recuerdos importantes y acortar la etapa cuando existan correcciones.
- Ofrecer dos resultados explícitos: **sigue vigente** y **necesita corrección**.
- Una confirmación aumenta de forma limitada la fuerza de almacenamiento, registra `lastReviewedAt`, incrementa `successfulReviews` y extiende el próximo intervalo.
- Una corrección reduce la fuerza, incrementa `correctionCount`, marca el recuerdo como conflictivo y lo mantiene pendiente hasta ser corregido.
- El cálculo será una función local determinista, sin llamadas de red, temporizadores en segundo plano ni afirmaciones de entrenamiento neuronal.
- Los intervalos futuros se derivan de los registros vigentes; no se crea un índice irrecuperable ni una segunda fuente de verdad.

## Consecuencias

- Alice puede explicar por qué un recuerdo está pendiente y cuándo corresponde revisarlo.
- La fuerza de almacenamiento representa eventos de mantenimiento del registro, no conocimiento interno del proveedor de IA.
- Corregir, confirmar o eliminar continúa bajo control de Enrique y utiliza el mecanismo de respaldo existente.
- La recuperación durante conversaciones utiliza contadores y fecha propios según ADR-P-034; esta decisión cubre revisión y vigencia local.

## Criterios de aceptación

1. Un recuerdo nuevo obtiene una fecha de primer repaso sin alterar su contenido.
2. Las confirmaciones extienden progresivamente el intervalo y refuerzan el indicador sin superar 100 %.
3. Marcar una dificultad no elimina datos y deja el recuerdo claramente identificado para corrección.
4. Los archivados y registros incompletos no aparecen en la cola.
5. La cola se puede reconstruir por completo desde `records.json`.
6. La lógica posee pruebas deterministas con una fecha controlada.
