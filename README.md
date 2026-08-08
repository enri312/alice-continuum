# Alice — Relanzamiento

El documento maestro que guía esta nueva etapa está en [`docs/alice_documento_maestro.html`](docs/alice_documento_maestro.html). La secuencia operativa y las puertas de calidad de las próximas fases están en [`Roadmap.md`](Roadmap.md). Antes de agregar más funciones, toda materialización debe respetar ambos documentos, su alcance y sus criterios de aceptación.

## Estado actual

Alice ya dispone de conversación directa multiproveedor, un Núcleo que muestra estados comprobables, memoria local editable con recuperación lexical por relevancia y una consola de actividad. Ya no exige iniciar una misión ni elegir una categoría antes de hablar.

En Núcleo → Volumen neuronal, la cámara se controla con la rueda para zoom, arrastre para girar, modo Mover o `Shift` + arrastre para desplazar, doble clic o tecla `0` para restablecer. Los botones visibles ofrecen las mismas acciones sin depender del teclado.

## Principios

- Nada se envía a Internet hasta que la previsualización de una consulta sea autorizada expresamente.
- No observa aplicaciones, pantalla ni archivos de forma automática o en segundo plano.
- La observación de ventana activa solo existe en la aplicación de escritorio y permanece apagada hasta que Carlos Nuñez la enciende. Consulta cada dos segundos el nombre del programa y el título de la última ventana usada; no registra teclas, contenido de archivos ni imágenes. Al apagarla, el contexto en memoria se borra.
- Historial, recuerdos y ventana actual se excluyen de las consultas de nube por defecto. Cada fuente se incorpora con un control independiente.
- Las solicitudes usan `store: false`, un máximo de 1200 tokens de salida y no habilitan herramientas. La política operativa y de retención del proveedor sigue siendo aplicable.
- Alice no ejecuta comandos ni permite que el modelo modifique Windows en esta fase.
- Cada recuerdo debe poder verse y corregirse.
- La búsqueda de recuerdos ocurre localmente. Alice muestra las coincidencias y no las añade a una consulta de nube hasta que Carlos Nuñez activa su autorización.

## Iniciar Alice

La forma más sencilla es hacer doble clic en **`Iniciar Alice.cmd`**, ubicado en la raíz de este proyecto. La ventana de terminal debe permanecer abierta mientras Alice esté funcionando; al cerrarla, también se detiene la aplicación.

En una terminal, el inicio equivalente es:

```powershell
npm run tauri dev
```

Si es la primera ejecución y todavía no existe la carpeta `node_modules`, ejecutar antes `npm install`.

## Configurar un proveedor de IA

La conversación permanece desconectada hasta que Windows tenga las variables del proveedor que quieras usar. Se admiten:

- OpenRouter: `OPENROUTER_API_KEY`; usa inicialmente `openrouter/free` y puede cambiarse con `OPENROUTER_MODEL`. El router selecciona un modelo gratuito disponible y la respuesta indica cuál fue; la disponibilidad, los límites y la política de datos pueden variar según el proveedor enrutado.
- OpenAI: `OPENAI_API_KEY`; modelo inicial configurable con `OPENAI_MODEL`.
- Anthropic: `ANTHROPIC_API_KEY`; modelo inicial opcional con `ANTHROPIC_MODEL`.
- Google Gemini: `GEMINI_API_KEY`; modelo inicial configurable con `GEMINI_MODEL`.
- xAI: `XAI_API_KEY`; modelo inicial configurable con `XAI_MODEL`.
- API compatible con Chat Completions: `ALICE_COMPATIBLE_API_KEY`, `ALICE_COMPATIBLE_BASE_URL`; modelo inicial opcional con `ALICE_COMPATIBLE_MODEL`. La URL base debe ser HTTPS y normalmente termina en `/v1`; Alice añade `/chat/completions`.

Para añadirlas, abrir **Editar las variables de entorno para tu cuenta** desde la búsqueda de Windows, crear las variables necesarias y reiniciar Alice. Las claves no deben escribirse en este repositorio, pegarse en React ni compartirse en una conversación. La pantalla mostrará cuántos proveedores están disponibles.

## Ejecutar solo la interfaz web

1. Instalar dependencias: `npm install`
2. Ejecutar: `npm run dev`
3. Abrir la dirección local que muestre Vite.

La parte nativa vive en módulos dentro de `src-tauri/src/`; `lib.rs` solo los orquesta y registra sus órdenes limitadas. Observación, memoria, avatar y proveedores tienen responsabilidades y pruebas separadas. React no conoce ninguna clave. El proceso nativo ignora su propia ventana para conservar como referencia la última aplicación externa usada.

Al iniciar con `Iniciar Alice.cmd`, la variable `ALICE_DATA_DIR` apunta a `E:\Proyecto P\data`. Alice crea allí `memory/` y `cloud/`, manteniendo recuerdos y auditorías fuera del disco C. `records.json` conserva recuerdos y enseñanzas; `manifest.json` identifica el formato; `backups/`, `exports/`, `audit/`, `attachments/` e `indexes/` separan responsabilidades. El contenido generado en `data/` está excluido de Git. Si `ALICE_DATA_DIR` no está definida, Tauri usa como compatibilidad el directorio de datos del usuario asignado por Windows. La pestaña Memoria muestra la ruta activa y permite abrirla. Al ejecutar solo la versión web, `localStorage` continúa como respaldo de desarrollo. El diseño completo está en `docs/architecture/MEMORY_SYSTEM.md`.

Las llamadas de nube agregan una línea a `cloud-audit.jsonl` con proveedor, modelo, cantidad de contexto, uso de tokens y huellas SHA-256. No registra la clave ni el texto completo de la consulta o respuesta.

## Cómo está hecho

- `src/App.tsx`: coordinación de conversación, memoria, permisos y actividad.
- `src/core/memory-retrieval.ts`: recuperación local explicable de hasta tres recuerdos relacionados; todavía no utiliza embeddings.
- `icons/`: insignias SVG industriales utilizadas por la navegación principal y las vistas internas del Núcleo.
- `src/Page/`: componentes de las pantallas Conversación, Núcleo, Memoria, Actividad y Puentes de salida.
- `src/styles.css`: apariencia de la interfaz.
- `src-tauri/src/`: backend nativo modular para nube, memoria, avatar, auditoría y observación autorizada de ventana; `lib.rs` actúa como orquestador.
- `Iniciar Alice.cmd`: inicio de la aplicación de escritorio mediante doble clic.
- `localStorage`: compatibilidad temporal para desarrollo web y migración inicial hacia la aplicación de escritorio.

La regla para las siguientes versiones es simple: primero se muestra qué se desea observar o hacer, luego Carlos Nuñez lo autoriza y solo después ocurre la acción.
