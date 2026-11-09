# Puerto ocupado, cierre e icono de Ubuntu

Fecha: 2026-11-06. El propietario encontró el puerto 18089 ocupado al iniciar
la conversación después de una recompilación de Alice.

## Diagnóstico y recuperación

El listener era el llama-server de este mismo checkout: coincidían ejecutable,
modelo, proyector, directorio de trabajo, `ALICE_DATA_DIR` y carpeta del proyecto.
Su padre ya había terminado y systemd de usuario lo había recogido. Se cerró
únicamente ese proceso verificado. El guardia que rechaza puertos de procesos
ajenos permanece activo; Alice no adopta servidores externos.

La parada del evento Tauri Exit y Drop no cubría la terminación Unix usada por
el watcher. Linux incorpora un manejador SIGINT/SIGTERM/SIGHUP mediante
signal-hook 0.3.18: un hilo ordinario cancela peticiones, detiene y recoge el
motor propio y solicita la salida de Alice. No se hacen operaciones de bloqueo
dentro del manejador de señal. SIGKILL y pérdida de energía siguen fuera del
alcance; no se anuncia recuperación automática de cualquier servidor huérfano.

## Inicio e icono

- Se instaló la entrada de usuario
  `~/.local/share/applications/com.carlosnunez.alicecognitivecore.desktop` y una
  copia ejecutable en el escritorio traducido del propietario, con marca trusted.
- El icono existente de 256 px se copió al tema hicolor del usuario. No se
  regeneraron ni sobrescribieron los iconos del proyecto que ya estaban en edición.
- `enableGTKAppId` y el nombre de icono GTK enlazan la ventana con la entrada
  `.desktop` para GNOME/Wayland. Se conserva el identificador histórico.
- El acceso directo usa el lanzador Bash, carga Fish desde su configuración
  privada y guarda el registro en `~/.local/state/alice-continuum/launcher.log`.
  Si ya hay una instancia, avisa sin cerrar aplicaciones.
- Preparador reproducible: `python3 scripts/setup/install-ubuntu-desktop.py`.
  El menú muestra **Alice Continuum**. El checkout compartido debe estar montado
  en la misma ruta para que el acceso directo funcione.

## Verificación

- **340 pruebas Rust aprobadas**, 30 sondas opcionales omitidas. Una regresión
  lanza procesos auxiliares aislados y verifica que SIGTERM, SIGINT y SIGHUP
  terminen el padre y recojan su hijo propio, sin modelos ni datos personales.
- Clippy con `-D warnings`, formato Rust y compilación nativa aprobados.
- Gemma real: inicio, respuesta `LISTO`, reutilización del proceso propio,
  arbitraje y parada aprobados; 45 archivos de datos personales con huellas
  intactas durante la sonda. Puerto 18089 liberado al finalizar.
- Cierre real mediante SIGTERM de Alice nativa: finalizaron la aplicación,
  el watcher y Vite; ambos puertos quedaron libres.
- `.desktop` aprobado por desktop-file-validate, cachés actualizados,
  Gio reconoce **Alice Continuum**, Gtk.IconTheme encuentra el PNG instalado
  y la aplicación registra el identificador correcto en el bus de sesión.
- La interfaz conserva la validación frontend previa de 609 pruebas; este
  incremento no modifica su código.

Para la apertura final desde herramientas se usó una unidad transitoria de
systemd de usuario que ejecuta el mismo comando del acceso directo, evitando
que la finalización del proceso de herramientas cierre sus descendientes.
No se creó un servicio habilitado al arrancar ni una automatización recurrente.

Evidencias privadas: `local/artifacts/ubuntu-r9-2026-11-06/lifecycle-*`.
