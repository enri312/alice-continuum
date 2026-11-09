# Recuperación y ubicación del proyecto — 9 de noviembre de 2026

La carpeta de trabajo solicitada por el propietario es **Datos → Alice
Continuum**, en Ubuntu `/run/media/carlos-nu-ez/Datos/Alice Continuum`.
Se continuará trabajando allí. La letra de unidad de Windows no se presupone.

## Qué se comprobó del original

La carpeta anterior no aparecía al enumerar el volumen NTFS
`62FCB1EFFCB1BE1B`, de aproximadamente 478 GB. Su registro MFT seguía asignado:
inodo 140640, secuencia 29, nombre Alice Continuum, directorio padre raíz.
Tanto ntfs3 como NTFS FUSE, montados en solo lectura, omitían la carpeta.
Además, varios archivos modificados conservaban un tamaño anterior y terminaban
incompletos. Son inconsistencias observadas en los metadatos del sistema de
archivos; no permiten determinar por sí solas qué las provocó. No se atribuye
el incidente a una operación concreta ni a uno de los sistemas operativos.

El origen se leyó mediante un descriptor de respaldo de UDisks abierto en
solo lectura, validando la identidad NTFS y las secuencias de los registros.
No se reparó, escribió ni borró el volumen original; quedó desmontado.

## Qué se recuperó y reparó en Datos

- Se copiaron y verificaron por SHA-256 **30.999 archivos**, unos **18,9 GB**,
  en 4.484 directorios. El enlace relativo `local/venv-linux/lib64 → lib`
  también se conservó. El inventario incluye nueve versiones alternativas
  asignadas, guardadas aparte en `local/recovery-extra-2026-11-09/`.
- La copia temporal solo recibió el nombre definitivo después de verificarla.
  Git conserva HEAD `7e375c424130c69b51f0d16eb7b1cfeb9c0423f7`, sus ramas
  y los cambios locales anteriores. No se hizo reset, commit ni descarte.
- **21 archivos de código y documentación** incompletos se restauraron desde
  objetos Git existentes. Cada versión completa coincide byte por byte con
  todo el prefijo recuperado. Los originales incompletos se conservaron aparte.
- Faltaba un árbol de una referencia de comprobación de Codex. Se reconstruyó
  con entradas existentes y se escribió únicamente después de obtener su
  identificador SHA-1 exacto `60e8495361b0fe28845f46931ab380524ff6fcb3`.
- Los **45 archivos de datos** se recuperaron. La memoria activa y el historial
  no se modificaron. Solo `data/memory/automatic-v1.backup.json` estaba
  incompleto: se restauró desde una versión anterior completa también recuperada,
  que conserva todo su prefijo. El respaldo incompleto queda guardado aparte.
- Se actualizaron ocho archivos de rutas del entorno Python Linux y se
  reinstalaron los accesos de Ubuntu con el icono existente. Las credenciales
  Fish y el perfil de YouTube siguen en la cuenta Ubuntu, fuera del repositorio.
- Se regeneraron las dependencias de Tauri cuya caché retenía la ruta anterior.
  Se conservan los recursos y entornos separados de Windows y Linux. La caché
  de compilación de esos paquetes también se invalidó en el directorio Windows,
  sin tocar `.cargo-target/linux/`, para que el próximo inicio regenere sus rutas.

## Validación

La copia bruta verificada es el punto de partida: sus hashes no significan que
los archivos originales incompletos fueran correctos. Las reparaciones anteriores
están registradas aparte para distinguir la recuperación de la puesta en marcha.

- `git fsck --full --no-dangling`: aprobado, sin objetos faltantes.
- Frontend: **609 pruebas aprobadas**, dos omitidas; TypeScript/Vite compiló.
  Persiste el aviso conocido de tamaño de algunos paquetes.
- Rust: **342 pruebas aprobadas**, 31 sondas opcionales omitidas; compilación
  nativa desde la nueva ubicación aprobada, con dependencias bloqueadas y offline.
- Python: **19 pruebas aprobadas** y `pip` ejecutable desde el entorno trasladado.
- Lanzador Bash: sintaxis y `--check` aprobados. Menú y escritorio apuntan a Datos.
- Arranque Tauri aprobado con Vite propio, pantalla virtual y datos temporales:
  proceso vivo y evento `PROCESS_STARTED`. La prueba no activó hardware.
- Gemma enumera Intel Graphics y NVIDIA RTX 3050 desde el ejecutable recuperado;
  Whisper responde a `--help`. No se repitió una conversación ni reproducción.
- Los JSON/JSONL de los 45 archivos de datos son válidos. Se comprobaron 136
  archivos protegidos de datos, iconos y activos: solo difiere el respaldo de
  memoria reparado expresamente; los demás conservan su SHA-256 de recuperación.

Las evidencias, inventarios, hashes, originales incompletos y registros están
en `local/artifacts/relocation-2026-11-09/`, excluido de Git. La sesión completa
de Codex y las credenciales no se copiaron a ese informe.

Este traslado no cierra R9: siguen pendientes la aceptación de cinco turnos,
las órdenes habladas con música y la latencia completa con el propietario.
El arranque de Windows debe comprobarse al volver a ese sistema.
