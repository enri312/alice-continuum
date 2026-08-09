# Informe R3 — Diagnóstico pasivo

Fecha: 2026-08-09  
Incremento: R3.4  
Resultado: aprobado

## Alcance

Se añadió el comando nativo `diagnostic_snapshot` y la vista `[09] PASSIVE DIAGNOSTIC`. El snapshot v1 separa rutas, versiones de datos, proveedores, adaptadores y permisos, y distingue cuatro resultados:

- `healthy`: evidencia disponible y válida;
- `configurationPending`: configuración ausente sin fallo operativo;
- `unavailable`: sonda o adaptador no disponible de forma segura;
- `error`: archivo inválido, configuración incoherente o fallo real de inspección.

El estado general y los cinco conteos se recalculan en Rust y se vuelven a validar en TypeScript. Campos adicionales, identificadores duplicados, conteos falsos o un estado general incoherente son rechazados.

## Garantías pasivas

- La auditoría y la memoria se leen sin crear, migrar, rotar ni corregir archivos.
- Los proveedores se comprueban por presencia de configuración; los valores y claves no salen del proceso nativo.
- La URL del proveedor compatible se valida sin conectarse.
- Python importa OpenCV, sounddevice, NumPy y comprueba FFmpeg con `PYTHONDONTWRITEBYTECODE=1`.
- Cámara y micrófono no se abren y sus permisos del sistema se declaran no disponibles para una sonda segura.
- El Gateway valida su almacén sin ejecutar vencimientos ni cambiar grants.
- Rostro y cuerpo aparecen no disponibles porque todavía no existe adaptador conectado.

## Evidencia real

| Puerta | Resultado |
|---|---|
| Rust normal | 95/95 aprobadas; tres sondas vivas ignoradas por defecto |
| TypeScript/Vitest | 74/74 aprobadas |
| Sonda viva del diagnóstico | aprobada sobre `E:\Alice Cognitive Core\data` y runtime Python real |
| Integridad canónica | SHA-256 de todos los archivos bajo `data` idénticos antes y después |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets -- -D warnings` | aprobado |
| Build TypeScript/Vite | aprobado |
| Build Tauri `release` | aprobado |
| Sonda del ejecutable | un `process.startup` real añadido: 9 → 10 eventos |
| Memoria | 7 archivos sin cambios durante la sonda de arranque |
| Avatar privado | SHA-256 `39E7815A3E34D179D431B81421A38F6B1AE2A4DFB4EC48DB336DBDBDCC51EB3`, sin cambios |
| Red y dispositivos | cero solicitudes de red; cámara y micrófono no abiertos |

Tres pruebas Rust usan carpetas temporales reales para confirmar lectura inmutable, ausencia de creación y clasificación de archivos corruptos. La cuarta sonda, ignorada por defecto, usa únicamente el estado canónico autorizado y compara huellas antes/después.

## Revisión visual

La vista se verificó a 1.920×1.000 mediante Edge/Playwright: 11 comprobaciones representativas renderizadas, cinco categorías visibles y `scrollWidth` igual al ancho del viewport. La captura quedó fuera de Git y no contiene datos privados reales.
