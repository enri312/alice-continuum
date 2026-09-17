# Alice Continuum

**Plataforma local de memoria, cognición y presencia digital.** Alice es el
personaje; Alice Continuum es el programa que la sostiene.

> **Identidad vigente desde el 16 de septiembre de 2026:** anteriormente Alice
> Cognitive Core. Iniciá con `Iniciar Alice Continuum.cmd`. El código está
> organizado por áreas en `src/pages`, `src/components` y `src/core`.
> Consulta la [estructura actual](docs/architecture/PROJECT_STRUCTURE.md), la
> [compatibilidad de datos](docs/architecture/CONTINUUM_IDENTITY.md) y el
> [documento maestro](docs/especificacion_alice_continuum.html).
>
> El cambio de nombre no corrige los hallazgos de seguridad identificados en la
> revisión del 14 de septiembre: protección de estados de memoria, permisos
> locales, autorización nativa de envíos y límites de procesamiento siguen
> requiriendo trabajo. Los informes y cifras históricos de abajo corresponden
> a sus respectivas fechas, no a una certificación de seguridad vigente.

![Estado](https://img.shields.io/badge/estado-prototipo%20funcional-0ea5e9?style=flat-square)
![R1](https://img.shields.io/badge/R1-validado-16a34a?style=flat-square)
![R2](https://img.shields.io/badge/R2-alcance%20inicial%20validado-16a34a?style=flat-square)
![R3](https://img.shields.io/badge/R3-validado-16a34a?style=flat-square)
![R4](https://img.shields.io/badge/R4-validado-16a34a?style=flat-square)
![R5](https://img.shields.io/badge/R5-completado-16a34a?style=flat-square)
![R6](https://img.shields.io/badge/R6-completado-16a34a?style=flat-square)
![R7](https://img.shields.io/badge/R7-validado-16a34a?style=flat-square)
![R8](https://img.shields.io/badge/R8-validado-16a34a?style=flat-square)
![TypeScript](https://img.shields.io/badge/Frontend-477%20aprobadas%20%7C%202%20sondas-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-290%20aprobadas%20%7C%2022%20sondas-b7410e?style=flat-square&logo=rust&logoColor=white)
![Python](https://img.shields.io/badge/Python-lector%20documental%20validado-3776ab?style=flat-square&logo=python&logoColor=white)
![Hardware](https://img.shields.io/badge/hardware-CAM%20%2B%20MIC%20vivos-0f766e?style=flat-square)
![Tauri](https://img.shields.io/badge/Tauri-2.x-24c8db?style=flat-square&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-087ea4?style=flat-square&logo=react&logoColor=white)
![Windows](https://img.shields.io/badge/plataforma-Windows-0078d4?style=flat-square&logo=windows11&logoColor=white)
![Privacidad](https://img.shields.io/badge/datos-local--first-0f766e?style=flat-square)
![Repositorio](https://img.shields.io/badge/repositorio-privado-6b7280?style=flat-square&logo=github&logoColor=white)

Aplicación de escritorio local-first para que **Alice** gestione conversación, memoria, percepción autorizada, estado cognitivo observable y futuras señales de rostro y cuerpo bajo control de Carlos Nuñez.

> **Uso cotidiano:** consulta el [Manual de uso de Alice](docs/MANUAL_DE_USO.md) para iniciar la aplicación, conversar, revisar recuerdos y entender cada pantalla sin depender de los códigos técnicos R1–R7.

El nombre técnico del sistema es **Alice Continuum**. La interfaz separa tres espacios actuales y reserva un cuarto para el futuro:

- `ALICE_NEURAL_CORE // COGNITIVE IDENTIFICATION`: entrada `[00]`, volumen, grafo, estado, planificación, memoria y actividad cognitiva.
- `ALICE_NEURAL_CORE // BODY SOLVER`: rostro, cuerpo y avatar.
- `ALICE_LOCAL_CONTROL // GOVERNANCE`: capacidades, permisos, auditoría, diagnóstico, Taller y configuración; pertenece al propietario, no al cerebro de Alice.
- `ENVIRONMENT // OBSERVATION ROOM`: sala futura, todavía no implementada, para sesiones delimitadas de comportamiento y maduración trazable.

> Los badges reflejan la revalidación local del cambio de identidad, realizada entre el 16 y el 17 de septiembre de 2026. No representan un workflow de CI remoto. Consulta el [informe de publicación](docs/testing/CONTINUUM_REBRAND_REPORT_2026-09-17.md); los demás informes conservan sus resultados históricos.

## Estado verificado

| Área | Estado real |
|---|---|
| Registro de capacidades R1 | Validado: snapshot nativo v1 con 39 capacidades |
| Gateway de permisos R2 | Ventana, cámara y micrófono protegidos; permiso facial separado disponible sin ejecución |
| Auditoría unificada R3 | Validada: evidencia correlacionada, diagnóstico pasivo y actividad efímera del Núcleo |
| Taller de habilidades R4 | Validado: editor visible, borradores, simulación, gobierno inmutable y primera habilidad de lectura; sin ejecución |
| Aprendizaje gobernado R5 | Cinco incrementos validados: contrato, detector, decisiones, puente R4 y vigencia de evidencia; 0 conversiones canónicas |
| Memoria por capas R6 | Completada: ciclo v1 y capas v3 activos; conjunto conversacional actual de 3 recuerdos reales y perfil confirmado conservado por separado |
| Tareas e intenciones R7 | R7.5 validado: registro gobernado, reloj apagable, recordatorio local explícito y comprobación de solo lectura; 0 tareas canónicas persistidas durante el cierre |
| Grafo R8 | Validado: referencias regenerables, relaciones reversibles, recuperación híbrida explicada y evidencia visible en el volumen; sin índice semántico persistente |
| Capacidades implementadas o parciales | 31 |
| Capacidades planificadas | 8, sin adaptador y no disponibles |
| Pruebas frontend y herramientas | 477 aprobadas; 2 sondas opcionales omitidas |
| Pruebas Rust | 290 normales aprobadas; 22 sondas opcionales omitidas |
| Builds | Frontend y ejecutable Tauri aprobados |
| Prueba viva de ventana | Win32 devolvió metadatos reales del primer plano; el contenido no se imprimió ni persistió |
| Prueba viva sensorial | Cámara y micrófono entregaron señal real mediante leases separados; 107 archivos multimedia antes y después, delta 0 |
| Preparación facial por webcam | Sonda diagnóstica aprobada: 53/53 análisis con rostro, 478 landmarks, 52 blendshapes y 20,71 ms de latencia media; todavía desconectada de Alice |
| Datos privados preservados | 42 archivos en `data/` conservaron sus huellas durante la sonda final R8; `records.json` permanece fuera de Git |
| Avatar privado | Preservado y excluido de Git |

La evidencia completa está en [el informe de validación R1](docs/testing/R1_CAPABILITY_REGISTRY_REPORT_2026-08-09.md), [el cierre final R6](docs/testing/R6_CLOSEOUT_REPORT_2026-09-01.md), [el informe R7.1](docs/testing/R7_TASK_REGISTRY_REPORT_2026-09-01.md), [la validación R7.2-A](docs/testing/R7_2A_TASK_MUTATION_REPORT_2026-09-01.md), [la prueba visible R7.2-B](docs/testing/R7_2B_TASK_UI_REPORT_2026-09-02.md), [el sentido temporal R7.3-A](docs/testing/R7_3A_TEMPORAL_ENGINE_REPORT_2026-09-02.md), [el recordatorio local R7.4](docs/testing/R7_4_LOCAL_NOTIFICATION_REPORT_2026-09-04.md), [la comprobación R7.5](docs/testing/R7_5_READ_ONLY_CAPABILITY_CHECK_REPORT_2026-09-04.md) y [su validación viva](docs/testing/R7_5_LIVE_VALIDATION_2026-09-04.md).

La memoria conversacional conserva la pregunta real, pero no reutiliza una antigua respuesta de modelo como conocimiento: consulta el [informe del límite de evidencia RAG](docs/testing/MEMORY_RAG_EVIDENCE_BOUNDARY_REPORT_2026-09-04.md).

R8 comenzó con [referencias nativas de fuentes](docs/testing/R8_1_SOURCE_GRAPH_REPORT_2026-09-04.md) y cerró con un volumen que abre evidencia real sin duplicarla. El [contrato R8](docs/architecture/KNOWLEDGE_GRAPH_R8.md), su [plan](docs/plans/R8-knowledge-graph.md) y el [informe final R8.4](docs/testing/R8_4_VOLUME_CLOSEOUT_2026-09-11.md) mantienen separadas las experiencias, la evidencia, las asociaciones y la actividad efímera.

Identificación incorpora una [vista previa documental local](scripts/adapters/README.md)
para PDF/MD/TXT seleccionados explícitamente. No incorpora texto al chat ni a recuerdos.
R8 permite revisar, confirmar, retirar y restaurar relaciones entre episodios con
citas y versiones verificables, sin modificar recuerdos. La decisión del propietario
no se presenta como verdad semántica. [Validación R8.2](docs/testing/R8_2_ASSOCIATIONS_REPORT_2026-09-05.md).

## Límites actuales

- Nada se envía a Internet sin una previsualización y autorización visibles.
- Alice no ejecuta PowerShell, comandos libres ni herramientas remotas.
- React no recibe ni muestra claves de proveedores.
- Una respuesta de nube no se convierte automáticamente en recuerdo o verdad.
- La observación vigente se limita a metadatos autorizados de la ventana activa; no registra teclas, archivos ni imágenes.
- Cámara y micrófono son capacidades parciales con leases R2 de 60 segundos; pantalla, reproductores, acciones accesibles y gestos siguen planificados. Rostro dispone de autorización R2 separada, pero todavía no de adaptador ejecutable.
- La voz dispone de transcripción local manual y síntesis de respuestas mediante Fish Audio con revisión explícita; no hay escucha continua ni habla automática. Rostro, mirada y control corporal autónomo permanecen desconectados. El lector documental está integrado. El visor posee una prueba manual DualSense que no representa salida autónoma de Alice.
- R1 describe capacidades; no concede permisos nuevos ni ejecuta las capacidades desde el registro.
- R2 consume grants efímeros para ventana, cámara, micrófono o derivación facial. Aprobar no abre hardware; el grant facial ni siquiera expone activación todavía y puede cancelarse, denegarse, vencer o revocarse.
- El envío a la nube todavía usa previsualización y confirmación en React; R1 lo declara `enforcedBy: currentUi` hasta una migración nativa futura.

## Pantallas

| Espacio | Pantallas | Responsabilidad |
|---|---|---|
| Cognitive Core | Entrada e identificación `[00]`, Volumen `[01]`, Grafo `[02]`, Estado `[03]`, Planificador `[04]`, Memoria y Actividad `[06]/[07]` | Percepción interpretada, estructura, recuerdos, estado, planificación, línea temporal y eventos |
| Body Solver | Puente rostro/cuerpo `[05]`, Rostro, Cuerpo y Avatar | Traduce decisiones a expresión y presencia física; sus adaptadores continúan desconectados |
| Governance Core | Capacidades y permisos, Auditoría y diagnóstico, Taller y Configuración | Controles externos de Carlos sobre alcance, autorización, evidencia técnica y evolución de Alice |
| Observation Room | Futura | Entorno delimitado para observar sesiones, estímulos, conducta y cambios trazables |

El volumen `[01]` es una semilla 3D evolutiva: crece desde el centro, representa cada recuerdo persistente mediante un ancla y mantiene la señal R3 reciente como un pulso temporal separado. Los colores afectivos no decoran la red: sólo pueden aparecer cuando el canal correspondiente esté disponible y aporte un valor real mayor que cero. Con poca evidencia, la red permanece deliberadamente compacta. Consulta [ADR-P-070](docs/decisions/ADR-P-070-volumen-neural-compacto-evolutivo.md) y [el informe visual](docs/testing/NEURAL_VOLUME_COMPACT_REPORT_2026-08-15.md).

### Sistema de insignias técnicas Alice

La navegación y los controles visuales usan 21 SVG locales generados de forma reproducible: dieciséis símbolos funcionales y cinco controles de cámara. La familia se reconstruyó desde cero en lenguaje industrial cyberpunk: chasis de metal oscuro, biseles, tornillería y uniones mecánicas forman la estructura; cian, ámbar, violeta, verde y magenta se reservan para núcleos, energía y señales de estado. Cada icono conserva una silueta y una escena semántica propia vinculada a su pantalla —escáner biométrico, osciloscopio, bóveda de memoria, cámara VRM, gateway de permisos, consola, planificador o volumen neuronal—, sin microetiquetas ni elementos SVG `<text>` visibles. Tampoco usa patrones, retículas de fondo ni esquinas en L repetidas. El tratamiento refinado reduce el grosor de chasis, cables y soportes, controla el halo y añade biseles internos, grabados, conectores con llave y reflejos finos para que las piezas se separen mejor al tamaño real de navegación. Toda la familia emplea tornillos de alojamiento hexagonal estratificados —anillos mecanizados, cabeza de metal, socket profundo y brillo controlado— siguiendo la referencia `screw.svg` aportada por el propietario. Las antiguas ranuras flotantes se sustituyeron por rieles de refrigeración montados, finos y alineados; solo aparecen sobre carcasas que pueden alojarlos y se retiraron de Configuración y del Registro de capacidades para evitar cruces con engranajes, conductos o señales. Memoria se representa como una bóveda técnica de tres capas indexadas, con bus RAG lateral, núcleo cifrado, compuertas de retención, cartuchos de archivo y respaldo duplicado. Permisos se representa como un gateway de política con solicitud de acceso, token de concesión, sello del propietario, núcleo bloqueado, temporizador de lease y corte físico de revocación; ya no usa las dos torres genéricas anteriores. Actividad usa tres carriles temporales, playhead, severidad y puertos de evento; Identificación separa ingreso perceptivo, huella del propietario, contexto, presupuesto de tokens y revisión local. El Registro distingue visualmente capacidades sondeadas, listas y planificadas; el Planificador compara tres candidatos mediante riesgo y utilidad, conservando un bloqueo físico de ejecución; Auditoría enlaza evidencia durable, huella de integridad y diagnóstico pasivo. Los cinco controles priorizan una lectura convencional incluso a `22 × 22 px`: cuatro flechas para desplazar, flecha orbital con cubo para rotar, lupas con más o menos para zoom y flecha circular con casa para restablecer. Los archivos usan nombres descriptivos por dominio y función: prefijos `cognitive-`, `embodiment-`, `governance-` y `camera-` reemplazan los ambiguos `nav-`, `bridge-`, `nucleus-` y `view-`. Los engranajes quedan reservados exclusivamente para Configuración, que emplea uno principal de alta precisión acompañado por tres módulos de control y un riel inferior. Avatar conserva el maniquí y su rig; Rostro conserva landmarks reservados y una cámara tachada para no fingir tracking activo. `nav-conversation.svg` y `nav-nucleus.svg`, que permanecían importados sin ningún destino real, se retiraron del catálogo. El movimiento es decorativo y acotado, y se desactiva con `prefers-reduced-motion`. Las pruebas verifican catálogo, nombres, accesibilidad, unicidad, ausencia de texto y patrones visibles, semántica, movimiento desactivable, exclusividad del engranaje y ausencia de recursos externos o contenido ejecutable.

En el Registro de capacidades, el puerto de entrada y el backplane ocupan piezas separadas para evitar la superposición que parecía un engranaje. Las tres tarjetas se centran sobre el mismo eje y alinean sus conectores; cada estado incorpora símbolo propio, telemetría interna y lámpara, mientras el riel inferior conserva una sincronización limpia y sin cruces.

La pasada `precision-finish-v3` refina los 22 SVG de la carpeta `icons`: reduce de forma proporcional los trazos estructurales hasta un máximo de `7.2`, conserva los microtrazos legibles y amplía el detalle material mediante gradientes metálicos de bandas finas, vidrio estratificado, menor halo, conectores con doble anillo, nodos con lente calibrada y bases con juntas mecanizadas. El emblema mantiene su composición, pero aligera chasis, hemisferios, circuitos y bus e incorpora índices de calibración alrededor del núcleo.

La pasada posterior `precision-finish-v4` limita el grosor máximo a `6.4` y concentra el detalle nuevo dentro de componentes existentes: tornillos con índice radial de mecanizado, rieles de refrigeración con cuatro anclajes, anillos de calibración con pista interior y módulos técnicos con contactos inferiores. El marco de `app-alice.svg` añade costuras mecanizadas y anillos finos en nodos sin cambiar el cerebro, el monograma ni su distribución.

`precision-finish-v5` amplía el acabado de componentes a los 22 SVG: nodos con contactos diagonales, sockets con pestañas cardinales de cierre, tornillería calibrada también en el emblema y grosor máximo de `6.0`. Flujo cognitivo abandona la antigua cadena de evidencia y reproduce el grafo funcional real de la pantalla: inhibición, percepción, memoria y lenguaje convergen en el espacio de trabajo global antes de una salida gobernada; las funciones futuras permanecen como satélites atenuados. Taller se reconstruye como una mesa única con biblioteca local, cartucho de manifiesto y huella, cúpula de simulación estática, bus de capacidades, columna de ciclo inmutable, llave del propietario y aislador físico de ejecución.

`precision-finish-v6` baja el máximo a `5.8` y refina rodamientos, celdas de estado y controles mediante retenes, contactos e índices de guía. Permisos abandona el portal con escudo y se convierte en una esclusa R2 coherente: deny-by-default, solicitud preparada, decisión explícita, grant efímero, vencimiento, ejecución separada, revocación y drenaje no persistente. Auditoría abandona el escudo y la lupa genéricos para mostrar una consola dual: ledger R3 correlacionado y rotado, verificador de integridad, banco pasivo de cinco categorías, trampa de líneas inválidas, sonda de solo lectura y aislador sin efectos.

`precision-finish-v7` reduce el grosor máximo a `5.6`, amplía la estratificación del metal compartido y reemplaza las metáforas incorrectas de Volumen y Planificador. Volumen ya no es una esfera orbital con núcleo único: muestra dos lóbulos compactos, asociaciones próximas, anclas de memoria persistente, pulsos R3 temporales, reserva afectiva inactiva y rutas independientes de entrada, contexto y salida. Planificador ya no simula tres candidatas ni una selección inexistente: es un banco vacío con checkpoint de entrada, generador sellado, cola vacía, cuatro métricas sin calcular, traza futura de cuatro etapas, cuna de respuesta vacía y aislador de ejecución. Esta descripción v7 sustituye la caracterización anterior del Planificador como comparador activo.

`precision-finish-v8` reduce el máximo a `5.4`, compacta sombras y halos y reconstruye Identificación y Avatar desde sus pantallas vigentes. Identificación elimina la huella y el sello biométricos porque la identidad personal no está conectada; ahora representa ingreso local real, multiplexor de fuente, tokenización limitada, vector de procedencia, clasificación heurística, controles de ciclo, simulación afectiva apagada y failsafe local. Avatar deja de ser un maniquí orbital genérico y pasa a un banco de inspección VRM: archivo privado, render local, cuerpo techwear, rig humanoide, scanner, telemetría, catálogo de expresiones de solo lectura, springs, mando manual, registro R3 y cuatro fronteras donde sólo el render está conectado. Esta descripción sustituye las metáforas anteriores de ambos iconos.

`precision-finish-v9` completa la gramática de montaje. Los dieciséis iconos que representan equipos incorporan dos patas portantes mecanizadas entre chasis y plinto, con refuerzos diagonales, placas de acople, tornillos e índices de carga; la separación inferior deja de parecer una pieza faltante. Los cinco controles de cámara permanecen como mandos ópticos independientes con sombra propia y sin plinto. `app-alice.svg` conserva su condición de emblema enmarcado. Los SVG declaran esta distinción mediante `data-mounting-grammar`, y las pruebas impiden que un equipo pierda sus soportes o que un control reciba una base incorrecta.

`precision-finish-v10` convierte el antiguo conducto genérico de Configuración en un arnés inequívoco de fibra óptica blindada. Una columna distribuidora conecta físicamente el engranaje con tres ramales independientes para inferencia, privacidad y hardware; cada ramal incorpora camisa metálica, núcleo luminoso propio, férulas en ambos extremos y señal animada. Dos abrazaderas con tornillos aportan alivio de tensión y un prisma central representa el diagnóstico del bus. El SVG ya no contiene `refined-signal-conduit` en esta escena y declara `fiber-optic-bus` en su semántica.

`precision-finish-v11` reconstruye el engranaje principal de Configuración como un conjunto de precisión: dieciséis dientes cortos biselados, corona de raíz mecanizada, encoder óptico de 32 marcas, ocho radios cónicos, seis limitadores de torque, jaula fija de doce bolas y acople central con llave. Sólo gira la corona exterior; el cubo y el rodamiento permanecen fijos, por lo que el movimiento ya no arrastra una pieza que debería estar anclada. El engranaje conserva el contacto físico con el arnés óptico sin invadir el distribuidor ni los tres módulos.

`precision-finish-v12` elimina el gran hexágono inferior que se interpretaba como un segundo núcleo o un control sin función. En su lugar queda un soporte compacto alineado con el eje del engranaje, con acople antivibración, índices de carga y anclajes al plinto. El núcleo real añade retén axial, eje estriado de dieciséis caras, chaveta, apertura hexagonal reducida y tapa endurecida; cada capa describe transmisión o retención mecánica en vez de ornamentación.

`precision-finish-v13` coloca el arnés óptico de Configuración en la capa posterior: conductos, distribuidor y férulas pasan detrás del engranaje, el soporte y los tres módulos, mientras los conectores externos conservan su lectura frontal. Memoria mantiene exactamente sus responsabilidades pero separa mejor sus componentes: cada capa recibe tapa mecanizada, ventana de estado e índice de dirección; las tres retenciones incorporan actuadores y señales; el núcleo cifrado gana jaula y balizas; la lente RAG integra retícula; los cartuchos muestran medio, contactos y estado; y el respaldo distingue dos canales espejo.

`precision-finish-v14` refina los 21 SVG funcionales sin modificar `app-alice.svg`: reduce de forma moderada los respaldos negros y contornos estructurales de mayor masa —incluido el soporte común de los dieciséis equipos—, preservando señales, micrograbados y tornillería. Planificador se reconstruye como un banco de arbitraje gobernado: cargador sellado y vacío, cámara hexagonal dominante, cuatro evaluadores sin cálculo diferenciados por geometría, cuna de respuesta sin selección, traza futura de cuatro etapas y doble interbloqueo de salida. El módulo temporal R7 aparece como un dock del propietario físicamente montado pero eléctricamente aislado, con reloj detenido, bandeja de vista previa vacía, confirmación cerrada y ledger sin reservas; no sugiere decisión autónoma, despacho ni ejecución. El acabado añade violeta para arbitraje, conserva cian y ámbar para señal y seguridad, evita flechas, texto y engranajes fuera de Configuración, y limita el grosor final del catálogo generado a `4.7` unidades.

La interfaz adopta `industrial-button-shell-v1` para trasladar a sus 104 botones el mismo lenguaje material de los iconos. La carcasa compartida usa metal oscuro, reflejo diagonal, marcas mecanizadas en esquinas, profundidad de presión y neón semántico; cian identifica acciones primarias, plata las secundarias, verde la aprobación, ámbar la advertencia, rosa el peligro y violeta las operaciones especiales. Pestañas con SVG y selectores de datos usan versiones menos profundas para conservar su jerarquía. Los nodos de la línea temporal permanecen como puntos gráficos, pero reciben foco de teclado visible. Estados seleccionado, presionado, bloqueado y `prefers-reduced-motion` están definidos de forma explícita.

El refinamiento de movimiento evita iconos completamente estáticos: cada SVG funcional incorpora una oscilación mecánica subpíxel y suma únicamente las animaciones pertinentes a su contenido —flujo por conductos, órbitas de calibración, barridos de visor, pulsos de estado, respiración técnica o articulaciones—. Taller muestra manifiesto, cámara de simulación, aprobación, bloqueo y ciclo de vida; Procedimientos muestra evidencia repetida, correlador, candidato, decisión del propietario y aislamiento de ejecución. Cuerpo expone rig, rodamientos, restricciones IK y objetivos de apoyo con la entrada sensorial sellada. Avatar separa visor VRM, geometría, rig, materiales MToon, spring bones y control manual. Rostro conserva la cámara apagada mientras anima solamente guías y landmarks reservados. `app-alice.svg` mantiene su composición y añade un flujo neuronal y orbital leve. Todo movimiento queda anulado por `prefers-reduced-motion`.

Flujo cognitivo deja de ser una curva abstracta y se representa como un circuito de evidencia trazable: paquetes de entrada acreditada, bus correlacionado, verificador central, reserva de contexto de memoria, compuerta de elegibilidad de salida, ledger de integridad y canal no acreditado rechazado. El recorrido usa pulsos y trazos discontinuos animados, nunca flechas, y no representa una ejecución autónoma. Una pasada adicional reduce con moderación los trazos estructurales medianos y gruesos de los 21 iconos generados sin alterar su geometría semántica.

En Estado y controles, los cuatro rectángulos inferiores sin significado se reemplazan por cuatro bancos dobles que condensan los ocho controles de comportamiento reales de la pantalla. Cada banco muestra dos faders inmóviles, estado bloqueado y un LED técnico; el interlock central enfatiza que el panel es de solo lectura y no puede cambiar la conducta de Alice. Los indicadores pueden pulsar, pero los faders no se animan ni presentan valores inventados.

El acabado `precision-finish-v2` aplica una última reducción proporcional a los trazos estructurales pesados de los 22 SVG, incluido el emblema, sin adelgazar los micrograbados por debajo de su lectura útil. Los halos pasan a ser más estrechos y las sombras menos difusas para que tornillos, biseles, faders y conductos no se mezclen. Cada nodo estratificado incorpora cuatro índices cardinales de calibración; las pruebas limitan el grosor máximo de la familia y exigen un índice por cada nodo generado.

El emblema [`icons/app-alice.svg`](icons/app-alice.svg) conserva su identidad de hemisferios y núcleo. El 2026-08-31 recibió únicamente un refinamiento ligero: fondo grafito-azul con profundidad radial, grabados mecánicos discretos, halo central más contenido y cuatro tornillos de alojamiento hexagonal; el conjunto de iconos de Tauri (`src-tauri/icons/`) permanece intacto. La decisión vigente y la verificación están documentadas en [ADR-P-064](docs/decisions/ADR-P-064-pantallas-cognitivas-e-iconos-cyrcetech.md). [ADR-P-063](docs/decisions/ADR-P-063-sistema-cyber-glyph-v2.md) conserva el antecedente reemplazado.

## Cámara, micrófono y aprendizaje sensorial

Carlos Nuñez autorizó las pruebas con la cámara y el micrófono integrados. Alice ya prepara una previsualización específica, crea un grant separado por dispositivo y solo abre el hardware después de pulsar **Activar**. El indicador permanece visible y **Detener**, revocar, vencer o cerrar la aplicación finaliza el lease.

Comprobación real de hardware del 09 de agosto de 2026:

| Dispositivo | Resultado |
|---|---|
| `ACER HD User Facing` | 12 fotogramas recibidos mediante DirectShow, 640×480, sin guardar imágenes |
| `Microphone Array (Intel Smart Sound Technology)` | 77.175 muestras recibidas, 44.100 Hz, 1,75 s, señal RMS real y sin guardar audio |

El incremento R2 volvió a abrir ambos dispositivos mediante la ruta gobernada real: la prueba exigió señal positiva, detuvo cada lease y confirmó `MEDIA_DELTA=0` sobre 107 archivos. Las capacidades `perception.camera.observe` y `perception.microphone.observe` son ahora `partial`, usan `enforcedBy: native` y aparecen `idle` o `active` según el proceso real. Todavía no analizan, transcriben ni crean recuerdos.

Como evaluación de una alternativa accesible a un visor con seguimiento facial, el 15 de agosto de 2026 se ejecutó una sonda local independiente con MediaPipe Face Landmarker sobre `ACER HD User Facing`. En 10,59 segundos analizó 53 fotogramas, detectó un rostro en 53/53, obtuvo 478 landmarks y 52 blendshapes, con 20,71 ms de latencia media y 22,17 ms en p95. El recuento multimedia permaneció en 117 archivos (`MEDIA_DELTA=0`). El modelo verificado vive sólo en `Assets/Models/private/`, está excluido de Git y la sonda exige `--live`; no identifica personas, no conserva coordenadas y no mueve el avatar. `perception.face.landmarks` continúa planificada aunque ya dispone de autorización R2 específica. La ejecución seguirá bloqueada hasta incorporar adaptador, parada operacional, calibración y un puente R9 revisado.

La pestaña **Rostro** consulta además una comprobación nativa pasiva: vuelve a calcular la huella del modelo local y verifica Python, OpenCV, MediaPipe y NumPy. Sólo expone preparación, nunca abre cámara ni lee landmarks; `sensorOpened` se valida como `false`. El panel también permite preparar y decidir el permiso facial R2 `critical` de 60 segundos. Incluso aprobado, el grant queda sin ejecutar y puede revocarse desde el mismo panel; todos los canales permanecen en reserva.

La salida manual de voz dispone de un adaptador nativo de **Fish Audio**. Requiere `FISH_API_KEY`, `ALICE_FISH_REFERENCE_ID` y confirmar cada respuesta antes de enviarla; el audio se mantiene temporal y no mueve automáticamente el avatar. La transcripción local es también manual. Las credenciales nunca deben escribirse en este README, el repositorio, React, la memoria o una auditoría. Las pruebas de identidad no realizaron llamadas pagadas ni activaron micrófono o cámara.

Los prototipos Python aportados externamente permanecen en una carpeta local excluida de Git y no forman parte del runtime. Una auditoría estática encontró ideas recuperables para lectura documental, OCR, STT, visión, TTS y conocimiento, pero también dependencias ausentes y límites incompletos de rutas, red, procesos y mutación. Ninguno se conecta hasta ser reescrito como una capacidad gobernada y probado por separado. Consulta la [política de cuarentena](docs/architecture/ADAPTER_QUARANTINE.md) y el [informe técnico](docs/research/ADAPTER_STATIC_AUDIT_2026-09-04.md).

Más detalles en [el informe inicial de hardware](docs/testing/HARDWARE_INPUT_READINESS_REPORT_2026-08-09.md), [el informe de leases R2](docs/testing/R2_SENSOR_LEASE_REPORT_2026-08-09.md), [el informe de preparación facial](docs/testing/FACE_LANDMARKER_READINESS_REPORT_2026-08-15.md), [el informe pasivo del panel Rostro](docs/testing/FACE_READINESS_PANEL_REPORT_2026-08-16.md), [el informe del permiso facial](docs/testing/R2_FACE_PERMISSION_CONTRACT_REPORT_2026-08-16.md), [ADR-P-043](docs/decisions/ADR-P-043-aprendizaje-sensorial-gobernado.md), [ADR-P-071](docs/decisions/ADR-P-071-sonda-facial-webcam-local.md) y [ADR-P-072](docs/decisions/ADR-P-072-permiso-facial-r2-separado.md).

### Prueba manual DualSense

Windows detectó el mando conectado por Bluetooth como `DualSense Wireless Controller`, con interfaz de juego HID Sony `VID 054C / PID 0CE6`, estado `OK`, código de problema 0 y controladores Microsoft firmados. La pestaña **Avatar** ofrece una prueba explícita de control humano: stick izquierdo desplaza el VRM en su orientación local, stick derecho lo gira, X salta y L2/R2 elevan brazos. Doce clips privados de Mixamo proporcionan reposo, arranque, marcha, carrera, retroceso, laterales, giros, salto, reposo sentado y transición de pie mediante retargeting al humanoide VRM. El botón **Ensayar marcha** reproduce una secuencia local determinista y los controles **Sentar/Levantar a Alice** comprueban las posturas sin depender del mando.

La entrada se lee sólo mediante Gamepad API mientras la prueba está activada. Existe zona muerta, suavizado, desplazamiento máximo y parada que restablece postura y posición. Una máquina de siete estados ejecuta `Start Walking` antes de la marcha frontal, mantiene `Sitting Idle` y reutiliza `Standing Up` en reversa para sentarse; cualquier movimiento desde sentado exige levantarse primero. La temporización de cada clip se calibró con la longitud de zancada medida en sus FBX; el visor expone estado, velocidad, animación, pie de apoyo, corrección horizontal, ajuste vertical y error IK. Un solver posicional de dos huesos orienta muslo y pantorrilla hacia el apoyo, preserva la orientación animada del zapato y renueva objetivos que superan 7,5 cm. En el ciclo Tauri aceptado el error observado quedó entre 0,0 y 1,9 cm. Todavía no resuelve muebles, terreno irregular, pendientes o colisiones. El acabado local distingue chaqueta, interior, arnés, prenda base, botas y corbata mediante materiales MToon, sombras suaves y contraste techwear; el detalle superficial mejora filtrado, mipmaps y relieve existente sin cambiar colores ni reescribir `Alice.vrm`. Cada transición manual o diagnóstica deja un evento R3 mínimo, enciende solamente `Motor manual` y nunca se presenta como decisión de Alice. El ensayo se detiene automáticamente a los diez segundos. No se transmiten vibración, luces, audio ni micrófono; no se guardan entradas y no se conectan a memoria, R5 o decisiones cognitivas. Esto no habilita `output.avatar.body` ni sustituye el futuro solver R9. El catálogo de expresiones declarado por el VRM se muestra sólo para inspección, sin pesos ni retargeting; consulte [el informe del catálogo facial](docs/testing/AVATAR_EXPRESSION_CATALOG_REPORT_2026-08-16.md). Consulta [ADR-P-056](docs/decisions/ADR-P-056-prueba-manual-dualsense-avatar.md), [ADR-P-058](docs/decisions/ADR-P-058-locomocion-retargeteada-con-activos-compatibles.md), [ADR-P-059](docs/decisions/ADR-P-059-maquina-estados-corporal-local.md), [ADR-P-060](docs/decisions/ADR-P-060-telemetria-motora-y-detalle-superficial.md), [el informe del mando](docs/testing/DUALSENSE_MANUAL_AVATAR_REPORT_2026-08-11.md), [el informe de locomoción y acabado](docs/testing/AVATAR_LOCOMOTION_APPEARANCE_REPORT_2026-08-11.md), [el informe de la máquina corporal](docs/testing/AVATAR_BODY_STATE_MACHINE_REPORT_2026-08-11.md), [el informe de telemetría y superficie](docs/testing/AVATAR_MOTOR_R3_SURFACE_REPORT_2026-08-11.md) y [el análisis de referencias externas](docs/testing/AVATAR_REFERENCE_ANALYSIS_2026-08-11.md).

## Control de contexto de conversación

El control de contexto integrado en `[00] CONVERSATION / PERCEPTION INPUT` es la última revisión antes de una inferencia local o una solicitud de nube:

- con Ollama, historial reciente y RAG local comienzan seleccionados, pero la interfaz distingue esa selección de la disponibilidad real de mensajes o coincidencias; para proveedores remotos continúan desmarcados;
- observar una ventana localmente no implica enviarla;
- cámara, micrófono, fotogramas y audio no son fuentes elegibles;
- cada intercambio permanece en la memoria de trabajo temporal; la conversación no guarda automáticamente la respuesta del modelo como recuerdo duradero ni como hecho confirmado;
- la promoción futura de un intercambio a episodio durable deberá ser explícita y pasar por revisión;
- proveedor y modelo se muestran como motor seleccionado sin herramientas y sólo se cambian en Configuración;
- el botón de ventana abre el Gateway R2 para configurar o administrar el observador: no activa ni detiene directamente.

El informe completo del alcance inicial está en [R2_PERMISSION_GATEWAY_REPORT_2026-08-09.md](docs/testing/R2_PERMISSION_GATEWAY_REPORT_2026-08-09.md).

## Auditoría unificada R3

Los cinco incrementos de R3 incorporan un sobre nativo v1 cerrado, conectan Gateway R2, memoria y nube como productores correlacionados, añaden `[09] PASSIVE DIAGNOSTIC` y derivan la actividad efímera del Núcleo. Solicitud, autorización, ejecución, detención, revocación, bloqueo, error y vencimiento comparten un `operationId`; no existen propiedades para mensajes, recuerdos, imágenes, audio, parámetros o claves.

La auditoría vive en `data/audit/events-v1.jsonl`, limita el archivo actual a 5 MiB y conserva una sola rotación anterior. Guardar, exportar, restaurar o migrar memoria registra una solicitud antes del efecto y un resultado con la misma correlación. Una solicitud de nube no sale si R3 no puede registrar su inicio; el resultado conserva únicamente una huella de integridad. Las auditorías heredadas de memoria y nube continúan en escritura dual durante esta fase de compatibilidad.

El diagnóstico clasifica cada comprobación como saludable, configuración pendiente, no disponible o error. Lee rutas y versiones, comprueba presencia de configuración sin revelar valores, importa el runtime sensorial sin abrir dispositivos y valida el Gateway sin vencer ni modificar solicitudes. No envía red, solicita permisos, crea carpetas, rota auditorías ni corrige archivos.

El comando `core_activity_snapshot` evalúa los eventos R3 visibles dentro de una ventana de cinco minutos. `r3-recency-motor-v2` pondera recencia, etapa y resultado, y produce siete regiones y cinco enlaces con conteos verificables. La séptima región recibe únicamente estados motores manuales o diagnósticos y permanece aislada de contexto y salida. El volumen proyecta las regiones cognitivas en tres rutas independientes —Entrada, Contexto y Salida— y anima conexiones sólo cuando existe señal acreditada; una solicitud pendiente no inventa una respuesta. La interfaz lo marca siempre como heurística técnica. Los eventos sólo controlan brillo temporal; la memoria local sigue siendo la única fuente de densidad persistente y los diez canales afectivos permanecen en `0.00`.

Consulta el [contrato R3](docs/architecture/UNIFIED_AUDIT_R3.md), [ADR-P-045](docs/decisions/ADR-P-045-auditoria-unificada-local.md), [ADR-P-047](docs/decisions/ADR-P-047-actividad-efimera-del-nucleo-desde-r3.md), el [plan incremental](docs/plans/R3-unified-audit.md), [el informe de la base](docs/testing/R3_AUDIT_FOUNDATION_REPORT_2026-08-09.md), [el informe del Gateway correlacionado](docs/testing/R3_PERMISSION_AUDIT_REPORT_2026-08-09.md), [el informe de memoria y nube](docs/testing/R3_MEMORY_CLOUD_AUDIT_REPORT_2026-08-09.md), [el informe del diagnóstico](docs/testing/R3_PASSIVE_DIAGNOSTIC_REPORT_2026-08-09.md) y [el cierre de actividad del Núcleo](docs/testing/R3_CORE_ACTIVITY_REPORT_2026-08-09.md).

## Matriz cognitivo-afectiva

El volumen neuronal distingue estructura aprendida de actividad actual: solo aparecen los nodos respaldados por recuerdos o señales comprobables, mientras que el brillo y el pulso quedan reservados para actividad temporal. Con pocos recuerdos la red permanece pequeña; la nube densa es una meta de crecimiento para cientos o miles de registros y asociaciones auditables.

La paleta futura incluye Alegría amarilla, Tristeza azul, Ira roja, Temor violeta, Desagrado verde, Ansiedad naranja, Envidia turquesa, Aburrimiento índigo, Vergüenza rosa y Nostalgia gris rosado. Los diez valores siguen en `0.00` y `planned`; todavía no existe simulación emocional. Consulta el [diseño afectivo](docs/architecture/AFFECTIVE_SIMULATION_DESIGN.md), [ADR-P-046](docs/decisions/ADR-P-046-paleta-afectiva-y-volumen-cognitivo.md) y el [informe visual](docs/testing/AFFECTIVE_VOLUME_VISUAL_REPORT_2026-08-09.md).

## Taller de habilidades R4

R4 define habilidades como manifiestos JSON cerrados, no como scripts o prompts ejecutables. Cada borrador declara propósito, procedencia, pasos visibles, entradas, resultados, precondiciones, comprobaciones, riesgo y las capacidades/operaciones exactas que necesitaría. Rust y TypeScript contrastan el manifiesto con el Registro R1 y rechazan privilegios sobrantes.

Toda habilidad nueva comienza `draft`, versión 1 y desactivada. R4.2 añade listado, lectura y guardado nativos bajo `data/skills`: usa rutas derivadas, reemplazo sincronizado, conflicto por revisión esperada y SHA-256 para el borrador y su respaldo anterior. Consultar no crea la carpeta.

R4.3 incorpora `simulate_skill_plan`, un análisis estático contra el Registro R1 vigente. El resultado muestra pasos, capacidades, permisos, efectos, alcances, requisitos y bloqueos sin recibir valores sensibles. Siempre declara ejecución deshabilitada, cero adaptadores y cero efectos. La prueba viva construyó las 24 capacidades desde los datos canónicos y confirmó que `data/` permaneció idéntico.

R4.4 añade revisión, aprobación, desactivación, restauración y retiro como transiciones nativas. Cada decisión exige confirmación del propietario local ligada a la revisión y su SHA-256; cada estado crea un archivo inmutable y deja un par de eventos R3 correlacionados sin copiar pasos, motivos ni contenido. Una revisión aprobada nunca se sobrescribe.

R4.5 completa la fase con la pestaña **Taller**, ubicada en `GOVERNANCE CORE` porque es una herramienta del propietario y no una función cognitiva de Alice. Preparar una plantilla no escribe archivos; guardar es una acción visible. La primera habilidad `local.revisar-proveedores-ia` usa únicamente `cloud.providers.inspect/cloud_status`: revela presencia de configuración y modelos públicos, pero no claves, mensajes ni red. La prueba E2E escribió borrador y revisiones en un directorio temporal real, simuló el plan, lo llevó a revisión y aprobación, lo reabrió por SHA-256 y confirmó cero adaptadores, cero efectos y ejecución deshabilitada.

La política fija `simulationOnly` mantiene red, procesos y escritura en `false`; `approved` todavía no significa ejecutable. R4 queda cerrada y el siguiente trabajo corresponde a R5: propuestas de procedimientos sustentadas en evidencia auditada. Consulta el [contrato R4](docs/architecture/SKILL_MANIFEST_R4.md), [ADR-P-048](docs/decisions/ADR-P-048-manifiesto-local-de-habilidades.md), [ADR-P-049](docs/decisions/ADR-P-049-almacen-local-borradores.md), [ADR-P-050](docs/decisions/ADR-P-050-simulacion-estatica-de-habilidades.md), [ADR-P-051](docs/decisions/ADR-P-051-ciclo-de-vida-inmutable-de-habilidades.md), el [plan](docs/plans/R4-skill-workshop.md), [el informe R4.1](docs/testing/R4_SKILL_MANIFEST_REPORT_2026-08-09.md), [el informe R4.2](docs/testing/R4_SKILL_DRAFT_STORE_REPORT_2026-08-09.md), [el informe R4.3](docs/testing/R4_SKILL_SIMULATION_REPORT_2026-08-10.md), [el informe R4.4](docs/testing/R4_LIFECYCLE_AUDIT_REPORT_2026-08-10.md) y [el cierre R4.5](docs/testing/R4_VISIBLE_WORKSHOP_REPORT_2026-08-10.md).

## Aprendizaje gobernado R5.1–R5.5

El primer incremento de R5 define qué evidencia sería suficiente para proponer un procedimiento sin afirmar que Alice ya aprendió uno. Un candidato requiere al menos tres operaciones correlacionadas distintas, dos pasos y una evidencia R3 de ejecución exitosa por paso. Capacidad, operación y riesgo se contrastan con R1; eventos de permisos, simulaciones R4, bloqueos o errores no califican.

El contrato no contiene parámetros, mensajes, imágenes ni audio. Las únicas diferencias admitidas inicialmente son duración y huella SHA-256, recalculadas desde R3. La política es inmutable: sólo propuesta, sin autoactivación, ejecución ni memoria duradera.

R5.2 incorpora `procedure_detection_status`, una lectura efímera de la ventana visible R3. Excluye sistema, permisos, simulaciones, errores, pasos únicos, capacidades planificadas y operaciones cuyo orden no pueda demostrarse a nivel de milisegundo. Agrupa secuencias exactas, exige tres UUID de operación y devuelve huellas y referencias, pero mantiene persistencia, creación de candidato y ejecución en `false`. La sonda canónica real examinó 22 eventos, calificó 0 ejecuciones y devolvió 0 patrones sin alterar ninguno de los 10 archivos de datos.

R5.3 añade `procedure_candidate_store_status` y `record_procedure_pattern_decision`. El almacén vive bajo `data/procedures`, separado de memoria y habilidades; consultar no lo crea. Cada huella sólo admite una decisión inmutable del propietario. `retain` reconstruye y valida el candidato contra R1/R3 y conserva su SHA-256; `dismiss` no guarda metadatos del candidato. El motivo nunca se guarda en claro. La nueva pestaña **Procedimientos** está en Governance, no en el Taller. En ambos casos ejecución y creación de borradores R4 siguen en `false`.

La sonda canónica posterior leyó 200 eventos y confirmó 0 patrones, 0 decisiones y almacén inexistente sin modificar datos. Las pruebas controladas sí escribieron archivos JSON/JSONL reales en directorios temporales para demostrar persistencia, SHA-256 e inmutabilidad sin sembrar recuerdos ficticios en Alice.

R5.4 incorpora un puente de uso único desde `retain` hacia un borrador R4 nuevo. El propietario revisa identidad, título, descripción y propósito; el manifiesto conserva decisión, candidato, fingerprint y SHA-256 de origen. Descartes, digests incorrectos, identidades ocupadas y segundos intentos fallan sin sobrescribir. El borrador mantiene `simulationOnly`, aprobación falsa y ejecución falsa incluso al recorrer revisión, aprobación, desactivación y restauración. Los eventos administrativos R5 se auditan, pero ya no elevan la señal global del Núcleo.

R5.5 cierra la fase clasificando cada decisión como evidencia vigente, obsoleta, descartada, convertida o bloqueada. Una auditoría no saludable bloquea la evaluación en lugar de fingir obsolescencia. La pestaña muestra ocurrencias, eventos correlacionados, pasos y diferencias de duración o huella. El backend vuelve a resolver R1/R3 antes de convertir: una huella obsoleta no cruza a R4 aunque la interfaz fuese eludida. Pruebas con archivos temporales y eventos R3 generados por los constructores reales verifican los cinco estados y que el rechazo no crea `skills/` ni modifica hashes existentes.

Consulta el [contrato R5](docs/architecture/GOVERNED_PROCEDURE_CANDIDATE_R5.md), [ADR-P-055](docs/decisions/ADR-P-055-candidatos-procedimientos-auditados.md), [ADR-P-057](docs/decisions/ADR-P-057-detector-conservador-procedimientos.md), [ADR-P-061](docs/decisions/ADR-P-061-almacen-decisiones-procedimientos.md), [ADR-P-062](docs/decisions/ADR-P-062-conversion-procedimiento-borrador.md), [ADR-P-065](docs/decisions/ADR-P-065-cierre-r5-vigencia-evidencia.md), el [plan R5](docs/plans/R5-governed-procedure-learning.md), [el informe R5.1](docs/testing/R5_PROCEDURE_CANDIDATE_REPORT_2026-08-11.md), [el informe R5.2](docs/testing/R5_PROCEDURE_DETECTOR_REPORT_2026-08-11.md), [el informe R5.3](docs/testing/R5_PROCEDURE_DECISION_STORE_REPORT_2026-08-11.md), [el informe R5.4](docs/testing/R5_PROCEDURE_DRAFT_CONVERSION_REPORT_2026-08-11.md) y [el cierre R5.5](docs/testing/R5_CLOSEOUT_REPORT_2026-08-13.md).

## Memoria por capas R6.1

La pestaña **Memoria → Capas R6** relee `records.json` y muestra una proyección explicable antes de escribir. El índice `layer-index-v2.json` conserva solamente IDs de registros, clasificación, revisiones y SHA-256: no duplica conversaciones, títulos, fuentes ni resúmenes. Activar exige confirmar la huella visible y Rust vuelve a comprobarla. Revertir desactiva la revisión sin borrar la memoria ni el historial.

La sonda real clasificó los 10 registros actuales como 9 episodios, 0 hechos semánticos enseñados y 1 procedimiento pendiente de vínculo R5. No activó la migración y mantuvo intactos los 10 archivos canónicos. Consulta el [contrato R6](docs/architecture/LAYERED_MEMORY_R6.md), [ADR-P-066](docs/decisions/ADR-P-066-proyeccion-memoria-por-capas.md), el [plan R6](docs/plans/R6-layered-memory.md) y el [informe R6.1](docs/testing/R6_LAYERED_MEMORY_REPORT_2026-08-13.md).

## Memoria de trabajo y salida controlada R6.2-C

Cada respuesta real del proveedor puede conservar el intercambio reciente en un almacén nativo dentro del proceso: máximo seis intercambios completos, doce mensajes, 72.000 caracteres y dos horas desde la última actividad. Conversación vuelve a adjuntar hasta los diez mensajes más recientes cuando Ollama está activo. La subpestaña **Memoria → Trabajo RAM** muestra mensajes, intercambios, caracteres, porcentaje, vencimiento, generación y procedencia sin repetir el contenido. Vaciar exige confirmación visible y la generación exacta revisada por el usuario.

El texto no se escribe en disco; cerrar Alice, vencer el TTL o vaciar elimina la RAM sin afectar recuerdos duraderos. R3 registra únicamente operaciones y SHA-256. En navegador se muestra explícitamente `SIN BACKEND`, sin inventar un snapshot.

Antes de autorizar una llamada, Alice muestra el tamaño exacto de `mensaje`, `historial`, `recuerdos` y `ventana` en caracteres Unicode y bytes UTF-8. El RAG lexical combina la consulta actual con hasta dos mensajes anteriores del propietario y recupera como máximo tres recuerdos confirmados. Una fuente opcional desmarcada cuenta cero; los separadores y el total se derivan de la misma cadena que recibe Rust. No se publican estimaciones de tokens porque dependen del modelo y del proveedor.

La antigua pantalla independiente **Conversación** fue eliminada. Su compositor, previsualización y mensajes viven ahora dentro de `[00] CONVERSATION / PERCEPTION INPUT`. `[05] FACE + BODY OUTPUT BRIDGE` queda en Body Solver; `Face` y `Body` son destinos del grafo cognitivo, no ejecutores del cerebro. Consulta [WORKING_MEMORY_R6.md](docs/architecture/WORKING_MEMORY_R6.md), [ADR-P-067](docs/decisions/ADR-P-067-memoria-trabajo-y-panel-entrada.md), [el informe R6.2-A](docs/testing/R6_WORKING_MEMORY_REPORT_2026-08-14.md), [la validación R6.2-B](docs/testing/R6_WORKING_MEMORY_UI_REPORT_2026-08-14.md) y [el cierre R6.2-C](docs/testing/R6_OUTGOING_BUDGET_AND_ICONS_REPORT_2026-08-14.md).

## Consolidación manual R6.3-F

La subpestaña **Memoria → Consolidar** relee `records.json` desde Rust y produce referencias de candidatos sin escribir. Un duplicado exacto exige coincidencia normalizada de tipo, clase, intención, resumen y próximo paso. Dos registros con la misma intención pero contenido diferente se etiquetan únicamente como **revisión requerida**: Alice no afirma por sí sola que exista una contradicción.

Cada candidato contiene dos IDs, una razón cerrada y una huella SHA-256 determinista. R6.3-B añade la resolución **mantener separados**, con confirmación, respaldo, decisión lateral y auditoría. R6.3-C permite elegir qué registro sobreviviría sólo para un duplicado exacto y calcula el conteo, SHA-256, bytes, diferencias originales, respaldo e impacto sobre las capas R6.1. El plan se invalida al cambiar la selección o releer la fuente.

R6.3-D añade un protocolo visible de ocho pasos y un motor Rust desconectado de Tauri. En almacenamiento físico controlado sustituyó realmente `records.json` mediante una operación atómica de Windows, verificó la proyección, auditó y restauró exactamente los bytes originales. Un fallo de auditoría inducido también restauró la fuente; una revisión R6.1 activa bloqueó antes de escribir.

R6.3-E persiste antes del reemplazo un recibo atómico sin contenido conversacional. Sus estados cerrados `prepared`, `projected` y `restored` permiten que una llamada nueva, sin conservar el plan en RAM, distinga la fuente original de la proyectada, restaure el respaldo y reintente una auditoría fallida. Una tercera huella o un recibo corrupto bloquean sin reparar silenciosamente; una recuperación terminada es idempotente.

R6.3-F registra una consulta nativa que distingue `idle`, `recoveryRequired`, `restored` y `blocked`. Sólo ante un recibo pendiente y una fuente con huella autorizada aparece **Confirmar y restaurar original**. El comando exige confirmación y ambas huellas revisadas, deriva internamente las rutas, audita antes de cerrar y recarga la memoria desde disco. No puede crear una transacción ni ejecutar una fusión.

La interfaz mantiene **FUSIÓN NO DISPONIBLE**. La memoria canónica nunca pasó por los motores R6.3-D/E: las sondas de solo lectura encontraron 17 recuerdos, cero candidatos, estado de recuperación `idle` y 20 archivos sin cambios de SHA-256. Consulta el [contrato R6.3](docs/architecture/CONSOLIDATION_PREVIEW_R6.md), [ADR-P-075](docs/decisions/ADR-P-075-plan-fusion-duplicados-exactos.md), [ADR-P-076](docs/decisions/ADR-P-076-ensayo-recuperacion-fusion.md), [ADR-P-077](docs/decisions/ADR-P-077-recibo-durable-recuperacion-reinicio.md), [ADR-P-078](docs/decisions/ADR-P-078-estado-restauracion-gobernada.md), [el informe R6.3-D](docs/testing/R6_CONSOLIDATION_RECOVERY_REHEARSAL_REPORT_2026-08-20.md), [el informe R6.3-E](docs/testing/R6_CONSOLIDATION_RESTART_RECOVERY_REPORT_2026-08-20.md) y [el informe R6.3-F](docs/testing/R6_CONSOLIDATION_GOVERNED_RESTORE_REPORT_2026-08-20.md).

## Iniciar Alice

Hacer doble clic en [`Iniciar Alice Continuum.cmd`](Iniciar%20Alice.cmd). La terminal debe permanecer abierta mientras se usa la aplicación.

Para el recorrido completo de operación y solución de problemas, consulta el [Manual de uso](docs/MANUAL_DE_USO.md).

El lanzador valida Node, npm, Cargo, las dependencias locales y el puerto 5173 antes de iniciar. También impide abrir dos instancias del mismo proyecto, limita Ollama a `127.0.0.1:11434` y comparte el caché Rust canónico `.cargo-target` con los comandos Cargo del repositorio. Para comprobar el entorno sin abrir Alice:

```powershell
& '.\Iniciar Alice Continuum.cmd' --check
```

Inicio equivalente desde PowerShell:

```powershell
npm run tauri dev
```

Primera instalación:

```powershell
npm install
npm run tauri dev
```

La carpeta local canónica es `E:\Alice Cognitive Core`. `E:\Proyecto P` sigue siendo un respaldo temporal y no debe borrarse hasta completar su copia al disco externo.

## Proveedores de conversación

La selección de proveedor y modelo vive en **Configuración**, no en la portada de Conversación.

| Proveedor | Variable requerida | Modelo opcional |
|---|---|---|
| Ollama local | ninguna; `Iniciar Alice Continuum.cmd` verifica el runtime | `ALICE_OLLAMA_MODEL` (por defecto `qwen3.5:4b`) |
| OpenRouter | **PAUSADO**; su clave no lo habilita | adaptador preservado para una decisión futura |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_MODEL` |
| Anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` |
| Google | `GEMINI_API_KEY` | `GEMINI_MODEL` |
| xAI | `XAI_API_KEY` | `XAI_MODEL` |
| Compatible con Chat Completions | `ALICE_COMPATIBLE_API_KEY` y `ALICE_COMPATIBLE_BASE_URL` | `ALICE_COMPATIBLE_MODEL` |

`Iniciar Alice Continuum.cmd` comprueba Ollama y, si hace falta, inicia `ollama serve` limitado a `127.0.0.1:11434`; Alice no acepta una URL local configurable, no reutiliza la excepción HTTPS del proveedor Compatible y rechaza identificadores Ollama terminados en `:cloud` o `-cloud`. El contrato conversacional local usa contexto 4096, desactiva herramientas, streaming y razonamiento visible, limita la salida a 900 tokens y mantiene la previsualización obligatoria. OpenRouter no aparece en Configuración y Rust rechaza cualquier solicitud directa hacia él. Ejecutar Ollama en reposo no crea actividad cognitiva: sólo una solicitud y una respuesta reales producen eventos R3 y memoria de trabajo temporal. Ninguna respuesta del modelo se consolida automáticamente como recuerdo durable. Consulta [ADR-P-079](docs/decisions/ADR-P-079-inferencia-ollama-loopback.md), [ADR-P-080](docs/decisions/ADR-P-080-contexto-rag-local.md), [el inventario de modelos](docs/research/LOCAL_MODEL_INVENTORY_2026-08-20.md) y [el informe de pruebas](docs/testing/LOCAL_OLLAMA_ADAPTER_REPORT_2026-08-20.md).

## Observación visual local

En **Memoria → Aprendizaje**, `Elegir pantalla o ventana` abre el selector del sistema operativo. Alice sólo puede ver la ventana o pantalla elegida. Toma una muestra cada cinco minutos, la reduce a 960 píxeles de ancho, la analiza con el modelo Ollama local y descarta inmediatamente el JPEG temporal. El audio permanece desactivado. Qwen devuelve como máximo cuatro apuntes y dos fragmentos visibles; se conservan hasta doce muestras como candidato editable en RAM. Detener la sesión no guarda nada. Sólo **Confirmar aprendizaje episódico** escribe los apuntes revisados en Memoria; nunca se guardan capturas. El selector WebView2 y el backend local ya completaron cinco muestras autorizadas; la capacidad conserva madurez `partial`, pero su salud es `healthy` y su estado de reposo es `idle`. Consulta [ADR-P-081](docs/decisions/ADR-P-081-observacion-visual-local-revisable.md) y [el informe real](docs/testing/LOCAL_RAG_VISUAL_LEARNING_REPORT_2026-08-20.md).

## Candidatos de aprendizaje local

En la misma pantalla, **Candidatos desde recuerdos reales** permite elegir un registro existente y pedir a `qwen3.5:4b` una vista previa local. Rust limita la fuente, exige JSON cerrado, admite como máximo cuatro propuestas y rechaza toda cita que no aparezca literalmente en el recuerdo. R6.4-C confirma en un único comando nativo: relee y reconstruye el candidato, verifica el SHA-256, crea un respaldo exacto, reemplaza atómicamente, audita y restaura ante fallo. El reintento idéntico no duplica; un candidato alterado se bloquea. En pruebas reales, dos fuentes breves produjeron cero candidatos y una conversación extensa produjo cuatro; la sonda transaccional rechazó una fuente obsoleta sin cambiar ninguno de los 21 archivos canónicos. Consulta [el contrato R6.4-C](docs/architecture/LEARNING_CANDIDATES_R6.md), [ADR-P-082](docs/decisions/ADR-P-082-candidatos-aprendizaje-local.md), [ADR-P-083](docs/decisions/ADR-P-083-confirmacion-transaccional-aprendizaje.md), [el informe de candidatos](docs/testing/R6_LOCAL_LEARNING_CANDIDATES_REPORT_2026-08-20.md) y [el informe transaccional](docs/testing/R6_TRANSACTIONAL_LEARNING_CONFIRMATION_REPORT_2026-08-20.md).

La credencial de Fish Audio no se lee desde documentos ni se incorpora al repositorio. Su adaptador sigue perteneciendo a R9 y deberá usar una variable de entorno, previsualización de texto, límites de costo y autorización visible.

## Datos locales

`Iniciar Alice Continuum.cmd` establece `ALICE_DATA_DIR` en `E:\Alice Cognitive Core\data`. Puede apuntarse a otra ubicación definiendo esa variable antes de arrancar; el lanzador normaliza la ruta y comprueba que sea accesible. El contenido está excluido de Git.

```text
data/
├── audit/
│   ├── events-v1.jsonl
│   └── events-v1.previous.jsonl
├── cloud/cloud-audit.jsonl
└── memory/
    ├── manifest.json
    ├── records.json
    ├── audit/
    ├── backups/
    ├── exports/
    ├── attachments/
    └── indexes/
```

La memoria es visible, editable, exportable y respaldable. Las auditorías conservan metadatos y huellas SHA-256, no claves ni el texto completo de las conversaciones. El diseño está en [MEMORY_SYSTEM.md](docs/architecture/MEMORY_SYSTEM.md).

## Arquitectura

```text
src/
├── pages/                pantallas React agrupadas por área
├── components/           paneles, iconos y visualizaciones
└── core/                 contratos R1/R2 y lógica TypeScript comprobable

src-tauri/src/
├── audit.rs              esquema, persistencia acotada y lectura R3
├── capabilities.rs       registro R1 y sondas pasivas
├── cloud.rs              proveedores y solicitudes autorizadas
├── core_activity.rs      señal efímera del Núcleo derivada de eventos R3
├── diagnostics.rs        inspección R3 pasiva y tipada sin efectos laterales
├── learning_candidates.rs vista previa R6.4-B y confirmación transaccional R6.4-C
├── memory.rs             persistencia v1 y proyección R6.1 reversible, respaldada y auditada
├── working_memory.rs     contexto conversacional R6.2 efímero, acotado y sólo en RAM
├── observation.rs        metadatos autorizados de ventana
├── procedure_learning.rs contrato y detector R5.2 de secuencias auditadas sin efectos
├── procedure_store.rs    decisiones R5.3 separadas, inmutables y verificables por SHA-256
├── avatar.rs             validación pasiva del VRM
├── permissions.rs        tipos, validaciones y digest del Gateway R2
├── permissions/
│   └── gateway.rs        almacén efímero y máquina de estados R2
├── sensory.rs            leases CAM/MIC y adaptador local de señal efímera
├── skills.rs             manifiestos R4 y almacén local verificable de borradores
│   ├── lifecycle.rs      revisiones inmutables y transiciones auditadas
│   ├── simulation.rs     simulación estática sin adaptadores ni efectos
│   └── templates.rs      primera habilidad nativa de sólo lectura
├── util.rs               rutas y utilidades compartidas
└── lib.rs                estado y registro de comandos Tauri
```

Los contratos vigentes son [CAPABILITY_REGISTRY_R1.md](docs/architecture/CAPABILITY_REGISTRY_R1.md), [PERMISSION_GATEWAY_R2.md](docs/architecture/PERMISSION_GATEWAY_R2.md), [UNIFIED_AUDIT_R3.md](docs/architecture/UNIFIED_AUDIT_R3.md), [SKILL_MANIFEST_R4.md](docs/architecture/SKILL_MANIFEST_R4.md), [GOVERNED_PROCEDURE_CANDIDATE_R5.md](docs/architecture/GOVERNED_PROCEDURE_CANDIDATE_R5.md), [LAYERED_MEMORY_R6.md](docs/architecture/LAYERED_MEMORY_R6.md) y [WORKING_MEMORY_R6.md](docs/architecture/WORKING_MEMORY_R6.md). El [Roadmap](Roadmap.md) gobierna el orden R1–R10 y el [documento maestro](docs/especificacion_alice_continuum.html) conserva la especificación completa.

Las investigaciones externas son referencias, no autoridad de implementación. Están revisadas en [OpenClaw + Tencent](docs/research/REVIEW_OPENCLAW_TENCENT_2026-08-10.md) y [Project AIRI](docs/research/REVIEW_AIRI_2026-08-13.md). AIRI aporta patrones útiles para el futuro puente de voz y VRM de R9, pero no sustituye el núcleo Tauri/Rust ni el diseño propio de memoria R6.

### Arquitectura políglota controlada

Alice utiliza varios lenguajes porque cada uno tiene una responsabilidad distinta, no para aumentar el *stack* sin necesidad:

| Tecnología | Responsabilidad actual | Límite de autoridad |
|---|---|---|
| TypeScript + React | Interfaz, visualizaciones, contratos defensivos y estado visible | No concede permisos nativos ni conserva credenciales |
| Rust + Tauri | Fuente de verdad local para permisos, auditoría, memoria, rutas y acceso gobernado al sistema | No delega decisiones de seguridad a la interfaz |
| Python | Proceso auxiliar local para señal efímera de cámara y micrófono; futuro lugar natural para visión, audio y evaluación de modelos | Se inicia desde Rust, no decide permisos y no persiste contenido crudo |
| HTML + CSS + SVG/WebGL | Presentación adaptable, iconografía y volumen neuronal interactivo | No contiene lógica de autoridad |

Python ya participa en `sensory.rs`: OpenCV comprueba señal real de cámara y `sounddevice`/NumPy comprueban señal real del micrófono. Su siguiente ampliación útil será percepción local comprobable; la UI, las credenciales y las decisiones finales de permiso seguirán fuera de Python.

## Pruebas

```powershell
npm test
npm run build
cargo fmt --manifest-path src-tauri\Cargo.toml -- --check
cargo test --manifest-path src-tauri\Cargo.toml
cargo clippy --manifest-path src-tauri\Cargo.toml -- -D warnings
cargo build --manifest-path src-tauri\Cargo.toml
```

Las pruebas del registro verifican serialización, esquema, IDs únicos, estados planificados, salud, idempotencia y rechazo de datos mal formados. Las pruebas operativas deben usar dispositivos y archivos reales cuando corresponda, sin fabricar métricas en la interfaz y sin conservar contenido sensorial crudo por defecto.

## Repositorio y continuidad

- Repositorio canónico privado: [enri312/alice-continuum](https://github.com/enri312/alice-continuum).
- Rama vigente: `master`.
- El avatar privado y `data/` no se versionan.
- No se deben publicar claves, recuerdos, grabaciones ni capturas privadas.
- El checkpoint de R1 y de la interfaz acumulada fue creado después de revisar secretos, archivos privados y resultados de prueba.

La regla operativa continúa siendo: **mostrar qué se desea observar o hacer, obtener autorización específica y revocable, y solo entonces ejecutar**.
