# Alice Continuum: identidad y compatibilidad

Fecha de adopción: 2026-09-16. Decisión expresa del propietario.

**Alice Continuum** es la plataforma local de memoria, cognición y presencia
digital. **Alice** sigue siendo el personaje. El cambio de nombre reconoce que
el proyecto integra memoria, conversación, percepción, voz, avatar, gobierno de
capacidades y auditoría; no significa que posea conciencia ni autonomía general.

## Identidad vigente

| Elemento | Valor |
|---|---|
| Producto y ventana | Alice Continuum |
| Paquete npm y paquete Rust | `alice-continuum` |
| Biblioteca Rust | `alice_continuum_lib` |
| Ejecutable de Windows | `alice-continuum.exe` |
| Lanzador | `Iniciar Alice Continuum.cmd` |
| Repositorio privado | `enri312/alice-continuum` |
| Documento visual | `docs/especificacion_alice_continuum.html` |

## Compatibilidad deliberada

- La carpeta de trabajo sigue siendo `E:\Alice Cognitive Core`. No se mueve una
  carpeta de trabajo activa ni se cambian las rutas reales de datos, modelos o
  animaciones como parte de un cambio de marca. Un clon nuevo puede llamarse
  `alice-continuum`, pero el alcance de recursos privados de Tauri debe ajustarse
  explícitamente a la instalación correspondiente.
- Se conserva `com.carlosnunez.alicecognitivecore` como identificador interno de
  Tauri. Así no se selecciona otro directorio AppData o perfil de WebView por
  accidente. No es el nombre visible del programa.
- Se conservan las claves `alice-cognitive-core-sessions-v1` y
  `alice-cognitive-core-cloud-selection-v1`, junto con la lectura compatible de
  `proyecto-p-sessions-v1`. No se vacía ni reinicializa el almacenamiento web.
- `ALICE_DATA_DIR` y las demás variables `ALICE_*` no cambian. Los formatos e IDs
  persistentes de recuerdos, auditoría y permisos tampoco cambian.
- El lanzador detecta también el ejecutable anterior para evitar instancias
  simultáneas. El observador excluye ambos nombres de ejecutable.
- `app-alice.svg` mantiene su nombre y dibujo; sólo se actualiza la descripción
  accesible de la plataforma. Los nombres de subsistemas cognitivos no se
  sustituyen por el nombre comercial de toda la aplicación.

## Documentación y publicación

El README, manual, índice documental, HTML y referencias operativas presentan
la identidad nueva. Los informes fechados, la decisión ADR-P-042 y el plan de
migración inicial conservan los nombres históricos que identifican lo probado
en su momento. No deben confundirse con el nombre vigente.

Se actualiza el mismo repositorio privado de GitHub, conservando el historial;
no se crea un repositorio paralelo ni se fuerza el reemplazo de ramas. Los datos,
modelos privados, entornos, capturas locales y credenciales quedan fuera de la
actualización. Retirar capturas del índice actual no borra su historial anterior.

Este cambio de identidad no implementa las correcciones de seguridad detectadas
el 2026-09-14. Esos hallazgos siguen pendientes; el nombre nuevo no certifica que
el producto esté endurecido ni listo para una distribución pública.
