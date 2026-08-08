# Centro de documentación de Alice

Este índice es la entrada principal para comprender, ejecutar y mantener el proyecto. El documento visual consolidado es [alice_documento_maestro.html](alice_documento_maestro.html).

## Lectura recomendada

1. [Documento maestro](alice_documento_maestro.html)
2. [Sistema de memoria](architecture/MEMORY_SYSTEM.md)
3. [Cómo iniciar Alice](runbooks/01-arranque-local.md)
4. [Respaldar y restaurar memoria](runbooks/02-operar-memoria.md)
5. [Decisiones técnicas](decisions/README.md)
6. [Último informe de prueba funcional](testing/TEST_REPORT_2026-08-07.md)
7. [Informe funcional del visor VRM](testing/AVATAR_REPORT_2026-08-07.md)
8. [Informe de consolidación y repaso v1](testing/CONSOLIDATION_REPORT_2026-08-07.md)
9. [Informe de refuerzo por recuperación autorizada](testing/RECALL_REINFORCEMENT_REPORT_2026-08-08.md)
10. [Informe de enseñanza guiada y emblema](testing/GUIDED_TEACHING_ICON_REPORT_2026-08-08.md)
11. [Plan de modularización del backend](plans/backend-modularization.md)
12. [Informe de modularización del backend](testing/BACKEND_MODULARIZATION_REPORT_2026-08-08.md)
13. [Informe del documento maestro v0.14](testing/MASTER_DOCUMENT_REPORT_2026-08-08.md)

## Secciones

| Carpeta | Contenido |
|---|---|
| `architecture/` | Arquitectura, datos y límites del sistema |
| `decisions/` | Decisiones que deben conservarse durante el desarrollo |
| `plans/` | Planes de ingeniería aprobados y contratos de migración |
| `runbooks/` | Procedimientos repetibles de ejecución y recuperación |
| `testing/` | Informes verificables de pruebas funcionales y regresión |

Los recuerdos reales, auditorías y respaldos viven en `data/`, fuera de `docs/`, y están excluidos de Git. Las claves continúan únicamente en variables de entorno y nunca se escriben en esa carpeta.
