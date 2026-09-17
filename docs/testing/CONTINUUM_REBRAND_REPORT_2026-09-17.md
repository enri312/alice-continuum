# Alice Continuum — Validación del cambio de identidad

Identidad aprobada el 2026-09-16; cierre de validación y publicación el 2026-09-17.

## Alcance

- Nueva identidad de producto, ventana, paquetes npm/Rust y biblioteca Rust.
- Ejecutable `alice-continuum.exe` y lanzador `Iniciar Alice Continuum.cmd`.
- README, manual, índices, roadmap y `especificacion_alice_continuum.html` actualizados.
- Actualización acumulada de código, iconos, documentación y reorganización por áreas.
- Mismo repositorio privado, nuevo nombre `enri312/alice-continuum`, sin reescribir historial.
- Retirada del índice de 69 capturas y previsualizaciones antiguas en `artifacts/`;
  los archivos locales y el historial previo se conservan.

Las rutas físicas, el identificador persistente de Tauri y las claves de
almacenamiento permanecen estables según [CONTINUUM_IDENTITY.md](../architecture/CONTINUUM_IDENTITY.md).

## Corrección puntual durante la validación

La primera ejecución de Rust detectó 36 fallos derivados de una incoherencia
preexistente en la salida de voz: `unchecked` recibía `checkedAt` cuando existía
configuración. Se corrigió para no presentar una comprobación que no se realizó.
La construcción de ese descriptor ahora admite configuración explícita en una
prueba aislada que comprueba los dos estados, sin modificar variables globales,
consultar proveedores ni activar hardware.

Esta corrección no reemplaza el trabajo de seguridad pendiente sobre memoria,
permisos del disco, autorización de nube y límites de procesamiento.

## Resultados

| Comprobación | Resultado |
|---|---|
| `npm test` | 477 aprobadas; 2 sondas omitidas; 55 archivos aprobados |
| `npm run build` | TypeScript y Vite aprobados |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked --offline --lib` | 290 aprobadas; 0 fallidas; 22 sondas omitidas |
| `cargo build --manifest-path src-tauri/Cargo.toml --locked --offline` | Ejecutable de escritorio generado con el nombre nuevo |
| Lanzador con `--check` | Aprobado; no abre la aplicación ni inicia inferencia |
| Navegador Edge sin backend nativo | Marca y títulos de aplicación y HTML correctos; sin errores JavaScript |
| Revisión del índice de Git | Sin datos privados, modelos, entornos o capturas locales preparados para subir |
| Búsqueda de patrones de credenciales | Ninguna coincidencia en los archivos de texto preparados; no es una garantía absoluta de ausencia de secretos |
| Datos privados | 41 archivos conservaron su SHA-256 |

El lanzador conserva finales CRLF requeridos por su ejecución como batch de
Windows. Los avisos de tamaño de paquetes Vite y de salida del enlazador de Rust
no impidieron las compilaciones. No se ejecutaron las sondas vivas ni llamadas
pagadas y no se publicaron binarios de distribución ni se creó una release.
