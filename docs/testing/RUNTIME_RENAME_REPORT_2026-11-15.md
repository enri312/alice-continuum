# Renombrado de local a runtime, 2026-11-15

La carpeta de recursos privados se llama `runtime/`. El cambio conserva la
estructura interior y mantiene `data/` como raíz de recuerdos, conversaciones,
auditorías y Obsidian. No cambia componentes, estilos ni formatos operativos.

Antes del cambio se verificó el snapshot de cierre
`D:/Alice Backups/Alice Continuum/snapshot-2026-11-15T13-03-23-698Z-fc3b3ed5-4817-4605-8a43-ccb67e661c11`
(1.080 archivos y Git `92b0794`). Alice se cerró normalmente. Un servidor antiguo
del piloto Dioxus seguía reteniendo sus logs en el puerto 5178; se identificó
por los handles y se cerró ese proceso de ensayo antes de renombrar.

Se comparó el árbol completo de 84.993 entradas, incluidos 69.831 archivos, por
nombre, tamaño, fecha de modificación y destino de enlaces, antes y después del
renombrado. La comparación precede a los cambios intencionales de rutas. Se
guardaron originales y SHA-256 de doce archivos privados de configuración o
activación antes de actualizarlos. No se sustituyeron paquetes ni pesos de modelos.
El inventario y las copias de configuración son privados y no se publican en Git.

Los cambios públicos actualizan las rutas en `runtime_paths.rs`, respaldo y
restauración, pruebas, lanzador Linux, herramientas Dioxus, CI y guías. Las tres
guías permitidas acompañan a la carpeta; el resto continúa ignorado. Vite bloquea
tanto `runtime/` como el nombre anterior, y la prueba de privacidad impide
publicar contenido bajo cualquiera de ambos. Los directorios estándar XDG
`~/.local/` y los identificadores lógicos `local.*` conservan su función.
Los scripts privados históricos no se ejecutan ni se reescriben en bloque.

Verificación desde la nueva ubicación:

- Compilación TypeScript/Vite aprobada; advertencia de tamaño de chunk ya existente.
- 894 pruebas frontend aprobadas, dos opcionales omitidas; 15 de Obsidian,
  20 de respaldo/restauración y dos de privacidad aprobadas.
- 421 pruebas del backend Rust aprobadas; 32 sondas de servicio/dispositivo omitidas.
- Python documental importa PyMuPDF desde `runtime/venv/Scripts/python.exe`.
  19 pruebas de adaptadores ejecutadas, una omitida.
- Tauri/WebView2 real abrió Conversación y Estado/Flujo, comprobó once nodos,
  R3, revisión/confirmación, cancelación y persistencia de relaciones sintéticas
  después de recargar. Evidencia privada:
  `runtime/artifacts/dioxus/native/dioxus-native-d3zpoQ/`.

Los ensayos no usan voz ni proveedores reales. El arranque Linux y macOS no se
declara aceptado; el trabajo de este incremento se comprobó en Windows. Los
respaldos previos conservan el árbol y código que tenían al crearse. Los nuevos
usan `runtime/`; se mantiene el esquema del manifiesto y la restauración aislada.
