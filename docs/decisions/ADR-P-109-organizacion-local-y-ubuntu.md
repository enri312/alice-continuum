# ADR-P-109: recursos locales agrupados y base portable para Ubuntu

Fecha: 2026-11-04. Estado: aceptada.

## Problema

La raíz mezclaba código, activos privados, prototipos, evidencias y un entorno
Python. Renombrar indiscriminadamente las carpetas convencionales rompería
herramientas. La persistencia de memoria importaba Win32 sin condición y Gemma y
Whisper dependían de rutas absolutas a ejecutables Windows de esta notebook.

## Decisión

Agrupar los recursos privados y de trabajo en `local/assets`,
`local/reference-adapters`, `local/drafts`, `local/artifacts` y `local/venv`.
El entorno Python se recrea y verifica antes de retirar el anterior a la Papelera.
Conservar `data/`, el caché `.cargo-target/` y los nombres de Rust, Tauri y Vite.
Git sólo publica las guías de `local/`; los recursos privados siguen excluidos.

Centralizar rutas en `runtime_paths.rs` con variables absolutas para motores,
modelos y Python. Windows conserva la instalación evaluada en D:. Ubuntu usa
ejecutables Linux y comienza en CPU; la GPU se configura después de comprobarla.
El despliegue de este incremento es desde un checkout propio compilado por sistema.
No se distribuyen modelos, claves ni un entorno Python dentro de un instalador.

Delimitar la dependencia `windows` por destino. El reemplazo atómico de memoria
mantiene MoveFileExW en Windows y usa rename del mismo directorio en Unix.
El protocolo de activos parte sin rutas estáticas y autoriza únicamente el VRM
y los clips conocidos que existan en sus ubicaciones configuradas.

Añadir lanzador Bash y verificación Ubuntu 24.04 en GitHub Actions. Los adaptadores
de escritorio, medios y DirectShow continúan siendo Windows y devuelven un error
o indisponibilidad en otros sistemas. No se asigna autoridad nueva sobre rutas
Linux en sustitución de los discos D:/E:.

## Consecuencias

La organización reduce carpetas de trabajo dispersas sin alterar recuerdos ni
modelos. Los archivos históricos conservan sus evidencias y sus fechas; la guía
de migración permite localizar sus rutas antiguas. El proyecto sigue siendo un
monolito modular, sin introducir otra arquitectura ni nuevos modelos de IA.

El propietario tiene Ubuntu instalado en otro disco de 2 TB del mismo equipo.
Se preparará un checkout nativo allí. Los modelos pueden copiarse o configurarse
por ruta montada; no se comparten `node_modules`, venv ni cachés entre sistemas.
CI acredita únicamente las verificaciones ejecutadas; la aceptación de cámara,
micrófono, inferencia, Fish y GPU exige arrancar ese Ubuntu.

[Guía y matriz de compatibilidad](../runbooks/04-ubuntu.md) ·
[Informe de comprobación](../testing/ORGANIZATION_UBUNTU_REPORT_2026-11-04.md).
