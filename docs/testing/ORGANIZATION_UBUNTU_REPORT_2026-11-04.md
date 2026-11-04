# Organización local y preparación Ubuntu

Fecha: 2026-11-04. Base: `18b8ec5`.

## Organización comprobada

| Antes | Ahora |
|---|---|
| `Assets/` | `local/assets/` |
| `adapters/` | `local/reference-adapters/` |
| `scratch/` | `local/drafts/` |
| `artifacts/` | `local/artifacts/` |
| `.venv-adapters/` | `local/venv/`, recreado y comprobado |

Se verificaron **708 archivos** mediante SHA-256 con correspondencia entre rutas:
activos, datos, prototipos, borradores y evidencias permanecen idénticos después
del traslado. `data/` no se mueve ni migra de formato. Los motores y modelos
en D: permanecen en su instalación anterior. El entorno Python antiguo se envía
a la Papelera tras pasar las pruebas con su reemplazo.

Las carpetas de herramientas conservan sus nombres. Los pilotos activos apuntan
ahora a `local/artifacts/`. Las rutas en informes históricos describen ensayos
anteriores y se resuelven mediante el mapa de `local/README.md`.

## Windows

- Interfaz: **563 aprobadas, 2 omitidas**; TypeScript y build Vite aprobados.
- Rust: **327 aprobadas, 28 ignoradas** en la primera comprobación del cambio.
- Python: **5 aprobadas** con PyMuPDF real en `local/venv`.
- Manual documental: extracción real válida y puente Rust/Python aprobado desde el entorno nuevo.
- Gemma real: inicio, inferencia y parada comprobados sin escribir memoria canónica.
- Clippy con advertencias como errores y compilación nativa: aprobados.
- HTML v0.59: 23 identificadores únicos y 81 enlaces locales válidos; portada conservada.
- Vite conserva el aviso previo por paquetes de más de 500 kB.

La comprobación final conserva **705 archivos idénticos byte a byte**. Sólo se
actualizaron las dos guías de activos versionadas y la auditoría agregó un único
`PROCESS_STARTED` al abrir Alice; su contenido anterior conserva la misma huella.
La ventana nativa de Windows abrió con 16 recuerdos, historial previo y micrófono
y cámara apagados. El lanzador `--check` pasó.

## Ubuntu

El workflow verifica Ubuntu 24.04 x86_64: dependencias GTK/WebKit, pruebas de
interfaz, Rust y Python, Clippy, compilación y arranque aislado Xvfb/DBus.
Resultado: **aprobado**, ejecución [41907263208](https://github.com/enri312/alice-continuum/actions/runs/41907263208), código `742aade`.

- Interfaz: **563 aprobadas, 2 omitidas**; compilación aprobada.
- Rust: **326 aprobadas, 27 ignoradas**; prueba adicional del puente Rust/Python aprobada.
- Python: **5 aprobadas**.
- Clippy con `-D warnings`, build nativo y comprobación del lanzador: aprobados.
- Arranque: proceso vivo durante 10 segundos y evento `PROCESS_STARTED` en datos temporales.

La diferencia de recuento Rust corresponde a pruebas específicas de Windows.
El primer ensayo detectó una dependencia de los tests respecto a la instalación
local de Gemma; se corrigió inyectando su presencia en los snapshots de prueba.
Los adaptadores multimedia de Windows quedan fuera de la compilación Linux.

Esta comprobación no carga modelos privados ni usa micrófono, cámara, Fish o GPU.
El propietario tiene Ubuntu en otro disco de 2 TB del mismo equipo; la aceptación
de esos componentes se hará allí. Captura de escritorio, ventana activa, música,
aperturas D:/E: y diagnóstico DirectShow conservan adaptadores Windows.

Evidencia privada: `local/artifacts/organization-ubuntu-2026-11-04/`.
[Guía Ubuntu](../runbooks/04-ubuntu.md) ·
[Decisión](../decisions/ADR-P-109-organizacion-local-y-ubuntu.md).
