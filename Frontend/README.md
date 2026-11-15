# Frontend de Alice Continuum

Workspace de la interfaz. La reubicación conserva los archivos de diseño,
iconos, recursos y comportamiento; no convierte por sí sola más pantallas a Dioxus.

| Ruta | Contenido |
|---|---|
| `src/` | Entrada, navegación, pantallas, componentes, estilos, contratos y lógica TypeScript existente. |
| `crates/state-controls/` | Fuentes Rust/Dioxus de Estado y controles, Flujo, relaciones y Actividad con su línea temporal. |
| `src/dioxus/state-controls/pkg/` | WASM y bindings versionados, verificados contra las fuentes. |
| `icons/` | Catálogo SVG consumido por la interfaz. Los iconos nativos de Tauri siguen en el backend. |
| `public/` | Recursos estáticos y licencias, publicados en las mismas URL que antes. |
| `dist/` | Build regenerable que Tauri utiliza; excluido de Git. |
| `vite.config.ts`, `tsconfig*.json`, `index.html` | Configuración y entrada de la interfaz. |

Desde la raíz del repositorio se mantienen los comandos:

```powershell
npm ci
npm run dev
npm run build
npm test
```

La raíz coordina el workspace npm; `package-lock.json` y las dependencias
compartidas en `node_modules/` permanecen allí. Las dependencias de interfaz se
declaran en este `package.json`; Tauri y las pruebas integrales se coordinan desde
el manifiesto raíz. No hay un segundo lockfile que sincronizar.
Vite también puede mantener caché regenerable en `Frontend/node_modules/.vite/`.

`npm run dioxus:check`, `npm run dioxus:build` y `npm run icons:generate` también
se ejecutan desde la raíz. Sus herramientas en `scripts/` resuelven las nuevas
rutas. Los scripts de aceptación de navegador y Tauri siguen en `scripts/testing/`.

Los datos, Obsidian, modelos, credenciales, configuración privada y ensayos no
pertenecen a este workspace: conservan sus ubicaciones en `data/`, `runtime/` y
`experiments/`. El servidor Vite mantiene bloqueados esos directorios, incluso
cuando las dependencias npm se comparten con la raíz.

Actividad se presenta en un solo montaje Dioxus; `src/pages/cognitive/ActivityHost.tsx`
sólo conecta su ciclo de vida y el buffer temporal de `App.tsx`. Auditoría y
diagnóstico conserva su contenido React en `GovernancePage.tsx`. Ver
[alcance y aceptación](../docs/testing/ACTIVITY_PAGE_DIOXUS_REPORT_2026-11-15.md).
