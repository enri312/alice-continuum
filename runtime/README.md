# Recursos privados de esta instalación

`runtime/` reúne recursos instalados, configuración y trabajo auxiliar. La memoria
operativa y el historial están en [`../data/`](../data/README.md). Git sólo publica
esta guía y las guías de activos permitidas; los demás archivos permanecen privados.

Desde el 15 de noviembre de 2026 el nombre es `runtime/` (antes `local/`). Se
actualizaron sus consumidores y la configuración privada necesaria. Los scripts
históricos dentro de `maintenance/` y las copias de pilotos pueden conservar
rutas anteriores y necesitan revisión antes de reutilizarlos. El contenido de
`data/` no se trasladó. Ver [verificación del renombrado](../docs/testing/RUNTIME_RENAME_REPORT_2026-11-15.md).

## Ubicaciones por función

| Ruta | Contenido y tratamiento |
|---|---|
| `assets/` | Avatar, animaciones y modelos de percepción privados. Se conserva su ubicación activa. |
| `inference/` | Motores y modelos portables. En Windows, la instalación histórica existente en `D:/Alice-model-evaluation` conserva prioridad, salvo configuración explícita. |
| `venv/`, `venv-linux/` | Entornos Python propios de cada sistema; pueden contener rutas absolutas. Se mantienen en su ubicación y se recrean al cambiar de equipo. |
| `experiments/` | Copias privadas de pilotos anteriores y herramientas instaladas, incluido `toolchains/`. Se mantienen para no romper las compilaciones. Los ensayos nuevos van en `../experiments/`; no se fusionan pilotos homónimos automáticamente. |
| `dioxus-build/` | Caché, temporales y registros de compilación Dioxus. Su ubicación sigue activa. |
| `cache/` | Cachés regenerables; `cache/npm-workspace/` agrupa la usada al reorganizar el frontend. |
| `artifacts/` | Capturas, informes de ensayos, perfiles de navegador y datos sintéticos. Las sondas Dioxus nuevas escriben en `artifacts/dioxus/browser/` y `artifacts/dioxus/native/`. |
| `drafts/` | Originales privados de trabajo, por ejemplo audio aportado para revisión. No se tratan como caché. |
| `archives/` | Recuperaciones anteriores y código retirado, conservados para consulta y respaldo. |
| `maintenance/` | Scripts y manifiestos de intervenciones puntuales, separados por tarea. No participan en el arranque y requieren revisar sus rutas antes de reutilizarlos. |
| `backups/` | Copias parciales históricas. No sustituye el respaldo integral verificado en `D:/Alice Backups/Alice Continuum`. |
| `reference-adapters/` | Prototipos originales en cuarentena; el producto usa `../Backend/adapters/`. |
| `backup.json`, `ubuntu.env` | Configuración privada de esta instalación; no publicar sus valores. |
| `alice-launch.lock` | Bloqueo del lanzador Linux mediante `flock`; permanece en su ruta activa. Windows usa un mutex por checkout. No mover ni borrar un bloqueo en uso. |

La [revisión del 15 de noviembre de 2026](../docs/testing/LOCAL_DATA_ORGANIZATION_REPORT_2026-11-15.md)
agrupó evidencias y auxiliares sin trasladar entornos, herramientas ni modelos
activos. `data/visual-checks/` pasó a `artifacts/visual-checks/`; eran dos capturas
técnicas sin referencias encontradas en los datos revisados. Los informes de
pruebas conservan sus fechas y apuntan a las evidencias reubicadas.

## Respaldo y portabilidad

El [respaldo integral](../docs/runbooks/07-respaldo-integral.md) incluye
`assets/`, `archives/`, `drafts/`, `maintenance/`, la configuración seleccionada y
los datos de Alice. Los perfiles y resultados en `artifacts/`, cachés, entornos
Python, herramientas y motores externos a `assets/` quedan fuera. Conservar los
instaladores o las fuentes necesarios para recrearlos. `recovered-settings/`,
cuando existe tras una restauración, contiene configuración pendiente de revisión.

No copiar entornos Python, `.cargo-target/`, `node_modules/` o `Frontend/dist/`
entre sistemas. Reinstalarlos desde sus manifiestos y comprobar las rutas de
modelos. Consulta [Ubuntu](../docs/runbooks/04-ubuntu.md).
