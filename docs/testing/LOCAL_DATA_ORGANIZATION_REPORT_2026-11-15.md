# Organización de recursos privados y datos, 2026-11-15

## Alcance

Se revisaron `local/` y `data/` antes de continuar la migración progresiva a
Dioxus. Se trasladaron evidencias y auxiliares; no se modificaron componentes,
estilos, dependencias ni formatos de memoria. La rama de trabajo sigue siendo
`master` y los comandos de arranque permanecen en la raíz.

## Distribución

| Contenido revisado | Ubicación resultante |
|---|---|
| Ensayos Edge y Tauri/WebView2 | `local/artifacts/dioxus/browser/` y `local/artifacts/dioxus/native/`; las sondas generan allí los ensayos futuros |
| Revisiones de portabilidad, traslado y organización | Subcarpetas de `local/artifacts/` |
| Dos capturas técnicas de `data/visual-checks/` | `local/artifacts/visual-checks/`; sin referencias encontradas en los 139 archivos de texto de datos revisados |
| Caché npm del traslado Frontend | `local/cache/npm-workspace/` |
| Audio original aportado para revisión | `local/drafts/whatsapp-audio-review/` |
| Código retirado y recuperación anterior | Subcarpetas de `local/archives/` |
| Scripts y manifiestos de intervenciones puntuales | Subcarpetas de `local/maintenance/`; no se llaman durante el arranque |

Los scripts privados trasladados conservan sus bytes y pueden mencionar rutas
históricas. Deben revisarse antes de reutilizarlos. Los informes versionados de
ensayos conservan sus fechas y actualizan las rutas de sus evidencias.

Se mantienen en su ubicación `local/assets/`, `inference/`, `venv/`,
`venv-linux/`, `experiments/` con herramientas instaladas, `dioxus-build/`,
`reference-adapters/`, `backups/`, `backup.json`, `ubuntu.env` y
`alice-launch.lock`. Este bloqueo todavía lo usa el lanzador Linux con `flock`;
su traslado inicial se revirtió al revisar ese consumidor. Los motores
Windows existentes en `D:/Alice-model-evaluation` tampoco se trasladan. Cambiar
de sitio entornos o herramientas con rutas absolutas necesita otra intervención.
Los ensayos nuevos usan `experiments/` de la raíz; no se fusionaron las copias
anteriores homónimas dentro de `local/experiments/`.

Los recuerdos, historial, auditoría, perfiles y bóvedas siguen en `data/`, con el
mismo `ALICE_DATA_DIR`. `memory/records.json` es canónico y `sessions.json`
permanece como legado sin reimportarlo. Se conservaron ambas configuraciones
Obsidian, las notas manuales y el archivo de base personal de la raíz. Las guías
de [`local/`](../../local/README.md) y [`data/`](../../data/README.md) detallan sus
funciones; no se incluyen inventarios personales en el repositorio.

## Integridad y respaldos

- Antes del traslado se creó y verificó la copia integral
  `D:/Alice Backups/Alice Continuum/snapshot-2026-11-15T07-14-41-037Z-d0eb0898-f33e-4e57-822a-93302b63beca`.
- Se copiaron además 26 archivos originales aún no cubiertos por esa política a
  `D:/Alice Backups/Alice Continuum/local-organization-safety-1794727452824-d999feda-ebcd-4c44-b240-e4c49a195249`,
  comprobando sus hashes. Es una copia auxiliar, no un snapshot restaurable por CLI.
- Se reagruparon 42 elementos y se verificaron por SHA-256 sus 16.342 archivos.
  Otros 159 archivos de datos, activos y configuración protegidos permanecieron
  idénticos. La verificación se repitió después de las sondas y antes del arranque
  personal; los informes privados están en `local/artifacts/storage-review-2026-11-15/`.
- Los nuevos respaldos incluyen `local/archives/`, `local/drafts/` y
  `local/maintenance/`. Se conserva el esquema 1 y las categorías existentes del
  manifiesto. Los anteriores conservan el alcance que tenían al crearse.
- `local/artifacts/`, cachés, entornos y motores externos a `local/assets/`
  permanecen excluidos. La copia en D: no sustituye un respaldo en otro disco.
- Después del traslado se creó y verificó
  `D:/Alice Backups/Alice Continuum/snapshot-2026-11-15T07-38-53-231Z-729dc6fa-d73c-48f1-9a16-c4d959879067`:
  1.081 archivos, incluidos 13 de `local/archives/`, 19 de `local/drafts/` y
  nueve de `local/maintenance/`. Su manifiesto no incluye los árboles de
  artefactos, cachés, entornos, inferencia ni compilación de `local/`.

## Comprobaciones después del traslado

- `npm run build`: aprobado. No hubo cambios en componentes ni hojas de estilo.
- `npm test`: 894 pruebas frontend aprobadas y dos opcionales omitidas;
  15 de Obsidian, 20 de respaldos/restauración y dos de privacidad aprobadas.
  El ensayo de respaldo/restauración incorpora originales ficticios de las tres
  nuevas ubicaciones y comprueba la exclusión de cachés, entornos y artefactos.
- `npm run test:dioxus:browser`: aprobado sobre el build servido en loopback.
  Comprueba teclado, navegación, estados R3 ficticios, sondeo sin solapamiento,
  descarte al desmontar, relaciones y recuperación. Evidencia privada:
  `local/artifacts/dioxus/browser/dioxus-browser-w9dRHD/`.
- `npm run test:dioxus:native`: aprobado con ventana real Tauri/WebView2, IPC real
  y datos sintéticos aislados. Comprobó apertura de Conversación, navegación
  Estado/Flujo, once nodos, R3, fuentes, revisión/confirmación, cancelación y
  persistencia de una relación tras recargar. Los registros fuente conservaron
  sus hashes. Evidencia: `local/artifacts/dioxus/native/dioxus-native-xJjnaq/`.
  La captura nativa se revisó visualmente.
- `node --check scripts/testing/volume-observatory.cjs`: aprobado tras cambiar
  sólo el destino de sus capturas. Ese piloto histórico con datos personales no
  se volvió a ejecutar; la aceptación funcional de esta tarea usa las sondas
  aisladas anteriores.
- El lanzador habitual inició Vite desde `Frontend/` y abrió la ventana normal
  de Alice; se verificó su identificador de ventana y HTTP 200 para `/` y
  `/src/main.tsx` en el puerto 5173. Se dejó Alice abierta. Los registros están
  en `local/artifacts/storage-review-2026-11-15/normal-launch.*.log`.

Mientras se actualizaba este informe, la copia automática de inicio detectó un
cambio de fuentes y rechazó publicar su versión incompleta. Conservó las copias
verificadas anteriores y permitió abrir Alice, conforme al contrato del
supervisor. Esto no se confunde con el snapshot manual ya verificado arriba.

Las sondas no utilizan recuerdos personales, modelos ni proveedores y no
constituyen una prueba de micrófono o de servicios reales. No se ejecutó otra
migración de pantalla durante esta reorganización. El diagnóstico y las
dependencias React pendientes se retoman en el siguiente incremento, de uno
en uno y con otra prueba de arranque.
