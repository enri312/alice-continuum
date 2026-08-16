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
33. [ADR-P-047: actividad efímera del Núcleo](decisions/ADR-P-047-actividad-efimera-del-nucleo-desde-r3.md)
34. [Informe de cierre R3 y actividad del Núcleo](testing/R3_CORE_ACTIVITY_REPORT_2026-08-09.md)
35. [Contrato del manifiesto de habilidades R4](architecture/SKILL_MANIFEST_R4.md)
36. [ADR-P-048: manifiesto local sin código ejecutable](decisions/ADR-P-048-manifiesto-local-de-habilidades.md)
37. [Plan incremental R4](plans/R4-skill-workshop.md)
38. [Informe R4.1 del contrato de habilidades](testing/R4_SKILL_MANIFEST_REPORT_2026-08-09.md)
39. [ADR-P-049: almacén local verificable de borradores](decisions/ADR-P-049-almacen-local-borradores.md)
40. [Informe R4.2 del almacén de borradores](testing/R4_SKILL_DRAFT_STORE_REPORT_2026-08-09.md)
41. [ADR-P-050: simulación estática de habilidades](decisions/ADR-P-050-simulacion-estatica-de-habilidades.md)
42. [Informe R4.3 del simulador de planes](testing/R4_SKILL_SIMULATION_REPORT_2026-08-10.md)
43. [ADR-P-051: ciclo de vida inmutable de habilidades](decisions/ADR-P-051-ciclo-de-vida-inmutable-de-habilidades.md)
44. [Informe R4.4 de ciclo de vida y auditoría](testing/R4_LIFECYCLE_AUDIT_REPORT_2026-08-10.md)
45. [Revisión técnica de OpenClaw y TencentDB Agent Memory](research/REVIEW_OPENCLAW_TENCENT_2026-08-10.md)
46. [ADR-P-070: volumen neural compacto y evolutivo](decisions/ADR-P-070-volumen-neural-compacto-evolutivo.md)
47. [Informe visual del volumen neural compacto](testing/NEURAL_VOLUME_COMPACT_REPORT_2026-08-15.md)
48. [ADR-P-071: sonda facial local mediante webcam](decisions/ADR-P-071-sonda-facial-webcam-local.md)
49. [Informe real de preparación facial](testing/FACE_LANDMARKER_READINESS_REPORT_2026-08-15.md)
50. [Informe R1/R2 del contrato facial](testing/R1_FACE_CAPABILITY_CONTRACT_REPORT_2026-08-16.md)

## Secciones

| Carpeta | Contenido |
|---|---|
| `architecture/` | Arquitectura, datos y límites del sistema |
| `decisions/` | Decisiones que deben conservarse durante el desarrollo |
| `plans/` | Planes de ingeniería aprobados y contratos de migración |
| `research/` | Revisiones de fuentes externas; inspiran decisiones pero no son contratos |
| `runbooks/` | Procedimientos repetibles de ejecución y recuperación |
| `testing/` | Informes verificables de pruebas funcionales y regresión |

Los recuerdos reales, auditorías y respaldos viven en `data/`, fuera de `docs/`, y están excluidos de Git. Las claves continúan únicamente en variables de entorno y nunca se escriben en esa carpeta.
