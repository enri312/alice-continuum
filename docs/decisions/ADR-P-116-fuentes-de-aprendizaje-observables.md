# ADR-P-116 — Fuentes de aprendizaje observables y recuperables

Fecha: 2026-11-11. Estado: implementado; aceptación nativa pendiente.

## Problema

El Volumen dependía de las lecturas y eventos coordinados dentro de `App.tsx`.
Perder una notificación o fallar la lectura inicial podía congelar el conocimiento
visible. Una respuesta antigua podía sobreescribir el resultado de una revisión
o pausa confirmada. La pantalla no explicaba qué fuente había fallado.

## Decisión

- `src/core/memory/learning-source.ts` coordina una lectura pendiente, agrupa
  solicitudes y conserva la última muestra válida. Los eventos invalidan lecturas
  desplazadas; el respaldo cada cinco segundos permite recuperarse sin eventos.
  Un tick no invalida una lectura lenta válida.
- Las mutaciones conservan los comandos existentes y se ejecutan en orden. Una
  pausa o revisión no espera una lectura antigua; sus resultados confirmados no
  pueden ser reemplazados por esa respuesta desplazada. El cierre descarta
  publicaciones tardías y escrituras todavía no iniciadas.
- `src/hooks/useLearningSources.ts` adapta Tauri y los contratos existentes. La
  relectura posterior al registro de listeners cierra la ventana de suscripción.
  Si falla la escucha, el sondeo continúa y el aviso permanece visible.
- `App.tsx` compone los estados y las acciones. La conversación conserva su filtro
  de lecciones aprobadas; la proyección visual sigue separada de RAG.
- El Volumen muestra fase registrada, última lectura y fallos por fuente. La
  acción **Actualizar lectura** consulta estados; no arranca otro ciclo de estudio.
  Permite reintentar la lectura inicial del perfil y los recuerdos si falló.
- La referencia de colores permanece disponible, plegada y fuera del lienzo.

La fase del autoestudio procede del estado nativo persistido. La fase automática
procede del último evento recibido y se rotula como última señal. Ninguna de
ellas se convierte en pulsos R3 ni prueba inferencia ejecutándose en ese instante.

## Límites y validación

No cambia Rust, permisos, currículo, formatos, prioridad del estudio ni ubicación
de almacenes. No se reentrenan pesos ni se añaden fuentes de conocimiento.
El proyecto sigue siendo un monolito parcialmente modularizado; esta extracción
no agota la coordinación pendiente de `App.tsx`.

[Resultados y alcance](../testing/COGNITIVE_VOLUME_LIVE_REPORT_2026-11-11.md) ·
[Uso del Volumen](../MANUAL_DE_USO.md#volumen-cognitivo).
