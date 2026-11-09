# Recuperación: respaldo y validación en Windows

Fecha: 2026-11-09. Carpeta activa: `D:\Alice Continuum`.

## Punto de recuperación conservado

Se conservó el checkout recuperado, con base `7e375c4`, todos sus cambios de
Ubuntu y los iconos existentes. El checkpoint **`7e796ee`** incorpora 100 archivos
modificados o nuevos y quedó subido a la rama
`codex/recovered-windows-2026-11-09` del repositorio privado. No se descartaron
cambios locales ni se reparó el volumen original. La confianza de Git en Windows
se configuró sólo para `D:/Alice Continuum`, cuyo propietario recuperado es SYSTEM.

Además, se creó una copia privada en otro volumen:
`%USERPROFILE%\.codex\backups\alice-continuum\recovered-20261109-193054`.
Windows identifica C: en el disco físico 0 y D: en el 2; el respaldo privado
no depende del mismo disco físico que la carpeta recuperada.

- `project.bundle`: historial Git completo, verificado mediante `git bundle verify`.
- `project-final.bundle`: copia adicional del historial al terminar esta revisión;
  conserva también la documentación y los ajustes de rutas/CI.
- `data/`: los 45 archivos de datos recuperados.
- `assets/`: 17 recursos privados del proyecto.
- `recovery-extra/` y `recovery-evidence/`: versiones alternativas, inventarios,
  originales incompletos y evidencia de la recuperación.
- `ubuntu.env`: configuración privada; no se publica ni se muestran sus valores.
- Índice Git anterior y manifiesto SHA-256 del respaldo.

Se cotejaron **128 archivos copiados** con sus fuentes, sin diferencias.
El respaldo contiene el checkpoint, no depende de una futura subida del código.
No es una imagen completa del disco: modelos, runtimes y cachés grandes permanecen
en su ubicación local. GitHub conserva código/documentación y excluye datos,
credenciales, memoria, modelos y activos privados. El archivo de configuración
privado debe permanecer en la copia local, fuera de publicaciones.

## Revisión del material recuperado

- `git fsck --full`: sin objetos faltantes o corruptos. Los objetos sin referencia
  encontrados no se eliminaron; el commit suelto identificado pertenece a agosto.
- Los 655 archivos del índice recibido estaban presentes, ninguno vacío;
  después se incorporaron los archivos nuevos recuperados al checkpoint.
- Los 45 archivos de datos coinciden con el manifiesto final de recuperación.
  Sus 32 JSON y cuatro JSONL (1.454 entradas) se pudieron leer correctamente.
- De los 21 archivos reparados, 19 conservan exactamente la huella registrada.
  Los otros dos son documentación con las notas posteriores del traslado; sus
  diferencias fueron contrastadas. Los 21 objetos Git de reparación son válidos.
- Los archivos de configuración JSON/TOML son válidos. Gemma, su proyector y
  Whisper Windows están presentes en `D:\Alice-model-evaluation`.
- Python se ejecuta desde el entorno trasladado y carga PyMuPDF 1.26.4.

El [informe de recuperación en Ubuntu](PROJECT_RECOVERY_REPORT_2026-11-09.md)
documenta las inconsistencias NTFS originales y la reparación previa de un respaldo
automático. No se repitió la lectura forense del volumen original desde Windows.

## Comprobaciones de Windows

- Lanzador `--check`: reconoce proyecto, datos y caché en la nueva ruta.
- Arranque mediante el lanzador normal: proceso nativo desde
  `D:\Alice Continuum\.cargo-target\debug\alice-continuum.exe` y evento
  `PROCESS_STARTED` en el almacén canónico. Esta verificación no inspecciona
  visualmente la ventana ni inicia el micrófono, cámaras o inferencia.
- Frontend: **609 pruebas aprobadas, dos omitidas**; TypeScript y Vite compilan.
- Rust: **339 pruebas aprobadas, 29 omitidas**; formato y Clippy de todos los
  targets con `-D warnings` aprobados. Compilación nativa desde D: aprobada.
- Python: 19 casos, **18 aprobados y uno omitido** por requerir pidfd de Linux.
- El auxiliar Windows `start-llama-evaluation.ps1` conservaba una ruta de logs
  fija en E:. Ahora la resuelve desde su carpeta, dentro del proyecto, y crea
  el directorio de evidencia si falta. Se comprobó su sintaxis y la ruta resuelta
  sin ejecutar otra instancia de Gemma.
- La caché Windows no conocía `signal-hook`: se completó desde las dependencias
  fijadas en el lockfile. No se actualizaron versiones de paquetes ni modelos.
- Fish y la referencia de voz están configurados en el entorno Windows; sólo
  se comprobó su presencia, sin mostrar valores ni solicitar síntesis.

Persiste el aviso conocido de paquetes frontend superiores a 500 kB. Compilar y
pasar pruebas no acredita una conversación real, acústica con música ni una
reproducción multimedia con la cuenta del propietario.

El HTML conserva sus estilos: 23 identificadores únicos, 55 referencias locales
existentes y etiquetas/anclas comprobadas sin errores. No se realizó inspección
visual en esta sesión. Los 45 archivos privados siguen siendo válidos; sólo
cambió la auditoría por el evento del arranque de comprobación.

## Compatibilidad Linux revisada

La primera ejecución remota del checkpoint pasó frontend, Python, las 342 pruebas
Rust Linux, formato, Clippy, compilación y arranque nativo. Falló la comprobación
WebKit de R9: Ubuntu 24.04 suministró GStreamer 1.24.2 y
`MediaRecorder.isTypeSupported('audio/webm;codecs=opus')` devolvió `false`.
WebKitGTK requiere GStreamer 1.24.9 o posterior para esa grabación; instalar los
plugins no resuelve la versión de su motor.

Se cambió el runner a **Ubuntu 26.04**, la versión usada por el propietario y
disponible oficialmente en GitHub. La prueba WebM/Opus sigue siendo obligatoria,
y el log registra las versiones de WebKit y GStreamer. No se alteraron los
paquetes del Ubuntu personal ni se añadieron repositorios de terceros.
Ver [requisitos y fuentes](../runbooks/04-ubuntu.md).

Resultado: [CI Ubuntu 26.04 aprobada](https://github.com/enri312/alice-continuum/actions/runs/42714601419)
para `c2d2836`: **609 pruebas frontend, 342 Rust y 19 Python** aprobadas,
31 casos Rust omitidos en la suite ordinaria. También pasaron por separado el
lector documental real y la captura WebKit con dispositivo simulado, incluidos
rechazo sin permiso, captura autorizada y rechazo de cámara en sesión de voz.
WebM/Opus devolvió `true`; formato, Clippy, compilación y arranque aislado pasaron.
El runner usó GStreamer 1.28.2 y WebKitGTK 2.52.6.
No se abrió hardware físico ni se usaron cuentas o modelos privados en CI.

El auxiliar PowerShell posterior se comprobó en Windows mediante su parser y
resolución de rutas. Los cambios finales de documentación y ese auxiliar no
modifican el núcleo Rust/TypeScript validado en esta ejecución Linux.

## Qué sigue en R9

1. Aceptar cinco turnos reales con el propietario, incluyendo referentes entre
   Alice, Carlos y terceros, corrección y cambio de tema.
2. Comprobar espera dirigida, pausa y apagado; repetir sin música, con música
   del equipo y con música externa.
3. Medir el turno completo y ajustar la naturalidad/espera de la salida oral.
4. Implementar y aceptar activación acústica por nombre e interrupción con eco
   controlado. Hoy el filtro usa ASR y exige el nombre en cada frase atendida.
5. Aceptar cámara y escritorio por turno, y verificar en Windows la preferencia
   de YouTube de playlist privada y repetición completa ya comprobada en Ubuntu.
   La captura nativa de escritorio y la observación de ventanas aún requieren
   adaptadores Linux; su disponibilidad en Windows no acredita Wayland/X11.

El avatar continúa pospuesto. No se establece un porcentaje de cierre con tests
automáticos ni se convierte el respaldo en aceptación funcional de R9.

En cada hito: revisar el diff, comprobar que no incluye información privada,
crear commit y verificar su subida. Los datos privados requieren su copia aparte.

Para recuperar el código aunque GitHub no esté disponible, se puede clonar el
`project.bundle` en una carpeta nueva. Los datos y recursos privados se restauran
por separado, con Alice cerrada y comprobando sus huellas. El bundle no contiene
claves ni modelos; no reemplaza el respaldo privado ni copia el sistema operativo.

Evidencia local: `local/artifacts/windows-recovery-2026-11-09/`.
