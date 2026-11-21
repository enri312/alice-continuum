# Abrir Alice en Windows

## Primera instalación

1. Instalá Node.js y npm en las versiones del proyecto, Rust mediante rustup, las herramientas de C++ de Visual Studio y el runtime WebView2. [Versiones del proyecto](../../README.md).
2. Abrí PowerShell en la carpeta que contiene `Iniciar Nyxia.cmd` y ejecutá `npm ci`.
3. Comprobá el entorno y abrí Alice.

```powershell
& '.\Iniciar Nyxia.cmd' --check
& '.\Iniciar Nyxia.cmd'
```

El primer inicio compila la aplicación. En las siguientes sesiones basta con abrir el archivo `.cmd`. Cuando veas el Dashboard, entrá en **Conversación** y comprobá que haya un proveedor listo. [Configurar un modelo, la voz y el primer mensaje](03-conversacion-y-voz.md).

## Si el arranque se detiene

| Qué ves | Qué comprobar |
|---|---|
| Falta una dependencia | Revisá el nombre que indica el lanzador. Usá `npm ci` en la raíz para instalar las dependencias JavaScript del archivo de bloqueo. |
| Alice ya está abierta o el puerto 5173 está ocupado | Buscá la ventana o la consola de una sesión anterior. Si la compilación sigue en curso, esperá a que abra la ventana. |
| Alice abre, pero el proveedor local no está listo | Instalá el motor y el modelo adecuados para tu equipo. En una instalación nueva se buscan en `runtime/inference/`. Podés elegir otra ubicación mediante una ruta absoluta en `ALICE_INFERENCE_HOME`. Los cambios de entorno se aplican al volver a abrir Alice. |
| Necesitás transcripción local | En PowerShell, ejecutá `& '.\scripts\testing\install-whisper-local.ps1' -Model small`. El instalador comprueba las descargas. Para usar un modelo ya instalado, indicá su ruta absoluta en `ALICE_WHISPER_MODEL`. [Configuración de voz](03-conversacion-y-voz.md). |

## Datos de la instalación

El lanzador resuelve la carpeta del proyecto y utiliza `data/` como almacén predeterminado. En **Memoria** podés comprobar el estado del archivo local y consultar o pausar el autoestudio. La bóveda está en `data/obsidian/`. [Autoestudio](06-autoestudio-al-arrancar.md) · [Obsidian](05-memoria-obsidian.md).

El lanzador programa respaldos al abrir Alice, cada 15 minutos y al cerrar normalmente. Comprobá el destino configurado antes de depender de esas copias. [Respaldo integral y restauración](07-respaldo-integral.md).
