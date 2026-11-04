# Arrancar Alice localmente

Entorno validado desde 2026-11-03: **Node 26.13.0 LTS y npm 11.20.0**.
La versión del proyecto está en `.node-version` y el lanzador verifica la rama 26.
La instalación del equipo se actualizó mediante el MSI oficial firmado de OpenJS.

Actualización 2026-11-04: Vite **8.3.5**, Vitest **4.1.12** y filtro local RNNoise
**2025.1.5** fijados en el lockfile. Ejecutar `npm ci` al sincronizar estos cambios.
El filtro y sus avisos de licencia se incluyen con Alice; no necesitan un CDN.

React y React DOM se actualizaron a **19.3.1**, con tipos **19.3.0**. El lockfile
conserva la combinación probada; usar `npm ci` al sincronizar el repositorio.
La memoria nativa ahora se organiza en `src-tauri/src/memory/`; sus 28 comandos
mantienen nombres y formatos. Ver [ADR-P-108](../decisions/ADR-P-108-memoria-modular-react-19-3.md).

La transcripción vigente usa **Whisper base CPU** instalado fuera de Git. Para
reproducirla: `scripts/testing/install-whisper-local.ps1`; descarga oficial con
hashes fijados y sin modificar PATH ni servicios. No se descarga al abrir Alice.
Gemma 4 sigue como modelo de diálogo y como ASR de respaldo si falta Whisper.
Ver [sesión oral](../decisions/ADR-P-106-estabilizacion-oral-y-rumbo-nerumi.md).

Rust/Cargo se actualizó a **1.99.1 estable** mediante rustup. El proyecto fija esa
versión en `rust-toolchain.toml`, con `clippy` y `rustfmt`. Un cambio de compilador
puede hacer que el primer arranque tarde más al recompilar las dependencias.

1. Ejecutar `Iniciar Alice Continuum.cmd` desde la raíz del proyecto.
2. Esperar a que Tauri abra la ventana de Alice.
3. Verificar en Conversación que al menos un proveedor aparezca como `LISTO`.
4. Verificar en Memoria que el estado indique `ARCHIVO LOCAL`.

El lanzador detiene el inicio con un mensaje claro si Alice ya está abierta, si el puerto fijo 5173 está ocupado, si faltan dependencias o si las versiones de Node y Cargo no son utilizables. Usa `.cargo-target` como único caché Rust del proyecto y sólo acepta Ollama cuando responde en loopback.

Para comprobar el entorno sin abrir Alice ni iniciar Ollama:

```powershell
& '.\Iniciar Alice Continuum.cmd' --check
```

Si el proyecto todavía no tiene dependencias instaladas, ejecutar `npm install` una vez desde la raíz.

Las variables de entorno se leen al iniciar. Después de añadir o cambiar una clave, cerrar y volver a abrir Alice.

Para comprobar la conversación, configurar el historial visible y probar la voz,
continuar con [Conversación y voz](03-conversacion-y-voz.md).
