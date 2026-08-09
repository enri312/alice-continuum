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
13. [Informe del documento maestro v0.16](testing/MASTER_DOCUMENT_REPORT_2026-08-08.md)
14. [Contrato e inventario del Registro de Capacidades R1](architecture/CAPABILITY_REGISTRY_R1.md)
15. [Plan de implementación R1](plans/R1-capability-registry.md)
16. [Decisión de identidad Alice Cognitive Core](decisions/ADR-P-042-identidad-alice-cognitive-core.md)
17. [Plan de migración de identidad](plans/identity-migration.md)
18. [Informe de migración Alice Cognitive Core](testing/IDENTITY_MIGRATION_REPORT_2026-08-08.md)
19. [Informe de validación R1](testing/R1_CAPABILITY_REGISTRY_REPORT_2026-08-09.md)
20. [Decisión de aprendizaje sensorial gobernado](decisions/ADR-P-043-aprendizaje-sensorial-gobernado.md)
21. [Informe real de cámara y micrófono](testing/HARDWARE_INPUT_READINESS_REPORT_2026-08-09.md)
22. [Contrato del Gateway de permisos R2](architecture/PERMISSION_GATEWAY_R2.md)
23. [ADR-P-044: Gateway nativo de permisos](decisions/ADR-P-044-gateway-permisos-nativo.md)
24. [Plan de implementación R2](plans/R2-permission-gateway.md)
25. [Contrato de auditoría unificada R3](architecture/UNIFIED_AUDIT_R3.md)
26. [ADR-P-045: auditoría unificada local](decisions/ADR-P-045-auditoria-unificada-local.md)
27. [Plan de implementación R3](plans/R3-unified-audit.md)
28. [Informe de la base de auditoría R3](testing/R3_AUDIT_FOUNDATION_REPORT_2026-08-09.md)
29. [Diseño de simulación afectiva explicable](architecture/AFFECTIVE_SIMULATION_DESIGN.md)
30. [ADR-P-046: paleta afectiva y volumen cognitivo](decisions/ADR-P-046-paleta-afectiva-y-volumen-cognitivo.md)
31. [Informe visual de la matriz cognitivo-afectiva](testing/AFFECTIVE_VOLUME_VISUAL_REPORT_2026-08-09.md)
32. [Informe R3 del Gateway correlacionado](testing/R3_PERMISSION_AUDIT_REPORT_2026-08-09.md)

## Secciones

| Carpeta | Contenido |
|---|---|
| `architecture/` | Arquitectura, datos y límites del sistema |
| `decisions/` | Decisiones que deben conservarse durante el desarrollo |
| `plans/` | Planes de ingeniería aprobados y contratos de migración |
| `runbooks/` | Procedimientos repetibles de ejecución y recuperación |
| `testing/` | Informes verificables de pruebas funcionales y regresión |

Los recuerdos reales, auditorías y respaldos viven en `data/`, fuera de `docs/`, y están excluidos de Git. Las claves continúan únicamente en variables de entorno y nunca se escriben en esa carpeta.
