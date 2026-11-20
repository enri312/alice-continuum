# Frontend de Alice Continuum

Workspace de la interfaz. `src/main.ts` arranca la raíz Dioxus desde
`crates/dioxus-ui/src/app.rs`. Los adaptadores TypeScript conectan sus
pantallas y mantienen disponibles los reintentos si falla WebAssembly.

| Ruta | Contenido |
|---|---|
| `src/` | Entrada, navegación, pantallas, componentes, estilos, contratos y lógica TypeScript existente. |
| `crates/dioxus-ui/` | Raíz de la aplicación, sesiones compartidas y vistas Rust/Dioxus. |
| `src/dioxus/dioxus-ui/pkg/` | WASM y bindings versionados, verificados contra las fuentes. |
| `src/Legacy/` | Entrada anterior, vistas React y pruebas históricas con configuración JSX propia. |
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

Actividad usa la sesión compartida de Rust. Las recuperaciones de Flujo, Estado
y controles y relaciones entre recuerdos se cargan al fallar WebAssembly y
mantienen sus selecciones, borradores y confirmaciones según la vista. React y
React DOM son dependencias de desarrollo de las pruebas históricas.
[Inventario de la migración](../docs/architecture/DIOXUS_MIGRATION_STATUS.md).
