# Adaptadores adaptados para Alice

Esta carpeta contiene versiones revisadas. Los originales de `local/reference-adapters/` se
conservan intactos y excluidos de Git. Nada aquí se ejecuta al iniciar Alice.

## Lector documental

```powershell
python -m venv local/venv
.\local/venv\Scripts\python.exe -m pip install -r scripts/adapters/requirements.txt
.\local/venv\Scripts\python.exe -B scripts/adapters/document_reader.py --root docs --file MANUAL_DE_USO.md
.\local/venv\Scripts\python.exe -B -m unittest discover -s scripts/adapters -p 'test_*.py' -v
```

`--root` define la carpeta autorizada; `--file` selecciona el documento. La salida
JSON **contiene el texto del documento**: no publicar ni guardar salidas privadas
en Git. No usar una raíz amplia como todo el disco para una lectura puntual.

- MD/TXT: UTF-8, sin dependencias adicionales.
- PDF: requiere PyMuPDF en el Python seleccionado; no se instala automáticamente.
- Hasta 16 MiB, 2 millones de caracteres y 1000 páginas PDF.
- Fragmentos de 64 a 16000 caracteres; solapamiento máximo del 50 %.
- Referencias por página, posiciones exactas y SHA-256 del archivo leído.
- Sin llamadas a modelos, red, creación de índices ni escrituras de memoria.
- Un PDF sin texto devuelve `noText`; no se inventa OCR.

Se corrigieron dos problemas del prototipo: repetición indefinida del último
fragmento con solapamiento y consulta de longitud después de cerrar el PDF.

Estado: integrada en Identificación, sección «Documento local · Vista previa».
Seleccionar archivo y pulsar «Autorizar lectura y ver texto». Descartar elimina
la vista previa de la interfaz; no se crea un recuerdo. No se carga automáticamente
en la conversación ni se envía al modelo.

El comando Tauri `preview_document` recibe bytes, nunca rutas. Ejecuta el script
embebido en el backend con el Python del entorno privado, sin consola visible,
con un máximo de 30 segundos y 32 MiB de salida. Una extracción a la vez.
R1: `memory.document.preview`, confirmación en la UI (no es un grant R2), límites
nativos. R3 registra solicitud y resultado con SHA-256, sin nombre ni texto.
El inventario registra 35 capacidades. El entorno es local al checkout de desarrollo;
su distribución con un instalador sigue pendiente.

## Comprobación del 2026-09-04

- Cinco pruebas automatizadas aprobadas con archivos temporales de prueba.
- Lectura real de `docs/MANUAL_DE_USO.md`: 8 fragmentos, SHA-256 verificado.
- PDF validado con PyMuPDF real, documento controlado de dos páginas (una vacía),
  texto, numeración y huella. No es una prueba sobre un documento personal.
- Puente Rust/Python ejecutado con el manual real y auditoría en carpeta temporal:
  aprobado, sin crear memoria.
- 2026-09-05: prueba en WebView2 nativo con datos temporales. Selección del manual,
  autorización, expansión de fragmentos, descarte y error visible ante UTF-8 inválido
  aprobados. Cuatro eventos de auditoría por ejecución, sin texto ni nombre de archivo;
  fuente intacta y cero recuerdos escritos. Script reproducible: `probe_document_ui.cjs`.
  Requiere una instancia QA aislada con depuración exclusivamente en loopback; no
  activar esa depuración en el lanzador cotidiano.

## Lanzador

`Iniciar Alice Continuum.cmd --check` no crea datos ni inicia Ollama o la aplicación.
Devuelve 0 si puede iniciar, 10 si Alice ya está abierta, 1 ante fallo de entorno
y 2 para argumentos desconocidos. Sin argumentos conserva el inicio habitual.

Prueba real: detectó la instancia PID 9268, devolvió 10 y no creó la carpeta de
datos temporal indicada. Un argumento desconocido devolvió 2. No se probó abrir
otra sesión porque la aplicación estaba en uso.

El servidor de desarrollo queda alineado con el lanzador: `127.0.0.1:5173` y
`strictPort=true`. No cambia silenciosamente a 5174 si el puerto está ocupado.
