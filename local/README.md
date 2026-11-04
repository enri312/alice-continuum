# Recursos de esta instalación

Esta carpeta agrupa contenido privado y generado. Git sólo publica esta guía y
las guías de los activos; los recursos, modelos, evidencias y entornos se excluyen.

| Carpeta | Contenido | Antes |
|---|---|---|
| `assets/` | Avatar, animaciones y modelos de percepción privados | `Assets/` |
| `reference-adapters/` | Prototipos originales en cuarentena; no se ejecutan | `adapters/` |
| `drafts/` | Borradores y capturas útiles | `scratch/` |
| `artifacts/` | Evidencias y resultados de pruebas | `artifacts/` |
| `venv/` | Entorno Python documental recreable para cada sistema | `.venv-adapters/` |
| `inference/` | Ubicación predeterminada de motores/modelos en Ubuntu | Nueva, opcional |

Los datos de conversación y memoria siguen en `../data/`. Los motores de esta
notebook siguen en `D:/Alice-model-evaluation`; no se duplican ni se trasladan.
No copies `venv/`, `.cargo-target/`, `node_modules/` o `dist/` entre sistemas.
Recréales a partir de los manifiestos. Consulta [Ubuntu](../docs/runbooks/04-ubuntu.md).

Los informes históricos conservan las rutas y fechas de sus ensayos. Una ruta
antigua `artifacts/...` ahora se encuentra físicamente en `local/artifacts/...`.
