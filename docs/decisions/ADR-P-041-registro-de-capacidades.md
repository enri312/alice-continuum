# ADR-P-041 — Registro nativo y declarativo de capacidades

Fecha: 2026-08-08  
Estado: aceptada para implementación

## Contexto

Alice ya conversa con proveedores de nube, mantiene memoria local, observa metadatos de la ventana activa con permiso e inspecciona un avatar VRM. Sin embargo, la pantalla Puentes solo contiene seis canales de salida futuros definidos en React. No existe una fuente única que permita distinguir una capacidad implementada, una configuración ausente, una función apagada y un adaptador meramente planificado.

Además, algunas protecciones actuales viven en la interfaz. El backend valida solicitudes, rutas y datos, pero la previsualización de nube y varias confirmaciones se realizan antes de invocar Rust. El registro debe describir esta situación con precisión y preparar R2 sin afirmar que ya existe una puerta central.

## Decisión

- Crear un registro declarativo cuya fuente de verdad esté en Rust.
- Exponer un snapshot de solo lectura y versión 1 mediante un único comando Tauri tentativo: `capability_registry_status`.
- Implementar el registro en un módulo cohesivo `src-tauri/src/capabilities.rs`; `lib.rs` solo registrará el comando.
- Separar madurez, estado operativo, salud y riesgo para no mezclar conceptos.
- Declarar dónde se aplica actualmente cada permiso: backend, interfaz, sistema operativo o ningún lugar.
- Incluir capacidades reales de nube, contexto, memoria y avatar.
- Mantener voz, rostro, mirada, cuerpo y adaptadores externos como `planned` y `unavailable` hasta que exista código real.
- Derivar estados mediante sondas locales sin efectos secundarios. Consultar el registro no crea archivos, no migra memoria, no lanza Explorer, no carga el VRM completo y no usa la red.
- Mantener `lastExecution: null` hasta que la auditoría unificada de R3 pueda respaldar ese dato.
- Conservar sin cambios los diez comandos Tauri existentes durante R1.
- No persistir el snapshot: es una vista regenerable del estado actual.

## Consecuencias positivas

- Puentes dejará de ser la autoridad sobre el estado del sistema.
- Las capacidades futuras no podrán parecer conectadas por tener un componente visual.
- R2 podrá aplicar permisos a identificadores estables en vez de depender de botones concretos.
- R3 podrá correlacionar auditoría y diagnóstico con los mismos identificadores.
- Las habilidades de R4 podrán declarar exactamente qué capacidades necesitan.

## Costos y límites

- Será necesario crear sondas específicas en cada módulo sin reutilizar comandos con efectos secundarios.
- El modo navegador necesitará un estado de desarrollo explícito porque no dispone del backend nativo.
- Durante R1 el campo de permisos será descriptivo; todavía no impedirá invocaciones directas que el backend actual acepte.
- El registro no convierte a Alice en un servicio del sistema ni le concede acceso al kernel.

## Alternativas descartadas

### Mantener el arreglo estático en React

Se descarta porque puede divergir del backend y convertir una decisión visual en una afirmación falsa sobre seguridad o disponibilidad.

### Registrar cada comando como si fuera una capacidad de usuario

Se descarta como única estrategia porque los nombres técnicos no siempre representan el efecto comprensible. El contrato conserva la relación con comandos, pero publica capacidades estables y semánticas.

### Ejecutar pruebas activas de red y archivos al abrir Puentes

Se descarta porque produciría costos, filtraciones o mutaciones solo para dibujar un estado. R1 utiliza sondas pasivas.

### Copiar la arquitectura completa de OpenClaw

Se descarta porque Alice necesita un núcleo mínimo adaptado a su alcance. Se toma el principio de un registro gobernado, no sus canales, autonomía ni acceso general al equipo.

## Evidencia requerida para cerrar R1

- Contrato Rust y TypeScript compatible con `camelCase`.
- Pruebas de enumeraciones, IDs únicos e invariantes de capacidades planificadas.
- Pruebas que demuestren que consultar el registro no altera la raíz de datos.
- Estado visual vacío, no configurado, desactivado, disponible y error.
- Compilación y pruebas completas de Rust y frontend.
- Documento maestro, Roadmap e informe de pruebas sincronizados.
