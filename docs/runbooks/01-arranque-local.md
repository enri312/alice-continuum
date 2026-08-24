# Arrancar Alice localmente

1. Ejecutar `Iniciar Alice.cmd` desde la raíz del proyecto.
2. Esperar a que Tauri abra la ventana de Alice.
3. Verificar en Conversación que al menos un proveedor aparezca como `LISTO`.
4. Verificar en Memoria que el estado indique `ARCHIVO LOCAL`.

El lanzador detiene el inicio con un mensaje claro si Alice ya está abierta, si el puerto fijo 5173 está ocupado, si faltan dependencias o si las versiones de Node y Cargo no son utilizables. Usa `.cargo-target` como único caché Rust del proyecto y sólo acepta Ollama cuando responde en loopback.

Para comprobar el entorno sin abrir Alice ni iniciar Ollama:

```powershell
& '.\Iniciar Alice.cmd' --check
```

Si el proyecto todavía no tiene dependencias instaladas, ejecutar `npm install` una vez desde la raíz.

Las variables de entorno se leen al iniciar. Después de añadir o cambiar una clave, cerrar y volver a abrir Alice.
