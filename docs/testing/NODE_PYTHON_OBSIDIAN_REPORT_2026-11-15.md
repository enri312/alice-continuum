# Primer reparto Node/Python: formateo Obsidian, 2026-11-15

Se implementó el primer módulo del reparto: Python construye las notas Markdown
de recuerdos registrados, automáticos y perfil cuando se solicita el comando
manual `npm run obsidian:sync:python`. Node conserva selección y validación de
fuentes, preparación de campos, serialización JSON técnica, índices, autoestudio,
protección de notas editadas, rutas y escrituras. La vigilancia de dos segundos
y el lanzador habitual mantienen el formateador Node.

## Ensayo previo y alcance

El prototipo está en `experiments/node-python-obsidian/`, excluido de Git. Se
comparó el resultado UTF-8 con la función pura original extraída del código
actual, sin ejecutar su CLI ni acceder a los datos personales. Los 18 casos
incluyen Unicode, surrogates, CRLF, controles, cercas Markdown largas, contenido
HTML literal, campos vacíos/nulos, booleanos, registros retirados y números en el
JSON técnico. El adaptador incorporado pasó la misma comparación.

Node serializa el JSON técnico y normaliza los campos de texto para conservar
su representación JavaScript exacta. Python recibe sólo esos campos preparados;
no decide políticas de recuerdo, recuperaciones ni materias de aprendizaje.
No tiene interfaz de rutas ni acceso a modelos o red. No se cambió el núcleo
Rust, la interfaz, los iconos ni las dependencias instaladas.

El supervisor inicia un proceso por lote de hasta 1.000 notas y espera a que
termine antes de iniciar otro. Entrada máxima de 8 MiB, salida de 32 MiB y diez
segundos por proceso. Valida la estructura e identidad de las respuestas; un
fallo impide terminar la preparación y no inicia la escritura de la proyección.
La opción no admite `--watch` ni cambia silenciosamente a Node al fallar.

## Medición orientativa en Windows

Python 3.15.2 y Node 26.13.0; cinco repeticiones por tamaño, con lotes ficticios.
La medición final se repitió sin las compilaciones/pruebas ejecutándose a la vez.
El caso Node usa el proceso ya iniciado; Python incluye preparación en Node,
inicio del subproceso, protocolo, renderizado y validación de la respuesta.

| Notas por lote | Node, mediana | Adaptador Python incorporado, mediana |
|---:|---:|---:|
| 0 | <0,01 ms | <0,01 ms; no se inicia Python |
| 1 | 0,03 ms | 133,59 ms |
| 100 | 0,67 ms | 130,37 ms |
| 1.000 | 5,84 ms | 219,30 ms |

Un proceso vacío del prototipo instrumentado tardó aproximadamente 108 ms.
Su pico de working set observado fue de unos 21,4 MiB. Esa memoria corresponde
al subproceso; no mide el total conjunto con Node ni representa memoria ahorrada.
Las muestras son pequeñas y dependen del equipo y carga; no prueban una mejora
de velocidad. Justifican un modo manual por lotes y conservar el modo automático
actual. Evidencia privada: `runtime/artifacts/node-python-obsidian-2026-11-15/result.json`.

## Validación

- Prototipo: 18 casos idénticos byte a byte, 11 solicitudes inválidas rechazadas,
  tres fallos de proceso comprobados y comparación de lotes de hasta 1.000 notas.
- Integración: bóveda completa Node/Python idéntica en la misma raíz ficticia;
  la segunda sincronización no indicó cambios. Se preservaron originales y
  ediciones manuales. Un Python inexistente y un modo inválido no modificaron
  ni crearon la bóveda. También se comprobaron varios lotes con 1.001 notas.
- CLI real sobre `runtime/artifacts/.../cli-fixture/data`: Python generó una nota
  y Node devolvió después `changed: false`. No se ejecutó el modo Python sobre
  la bóveda personal.
- `npm test`: 900 frontend aprobadas, dos opcionales omitidas; 19 Obsidian,
  20 respaldos y dos privacidad aprobadas. Las pruebas de Python se ejecutaron
  con el entorno de esta instalación; si no existe ese entorno se omiten las
  dos integraciones que lo requieren y se siguen probando los errores de ausencia.
- Adaptadores Python: 25 pruebas ejecutadas, una sonda anterior omitida.
- Compilación frontend y verificación de los artefactos Dioxus aprobadas.
- Tauri/WebView2 con backend real y datos aislados: abrió Conversación,
  Estado/Flujo y Actividad; comprobó R3, teclado, revisión/confirmación y
  persistencia. Evidencia: `runtime/artifacts/dioxus/native/dioxus-native-EMRO85/`.

No se realizaron pruebas de micrófono ni proveedores reales. Este incremento
incorpora una opción manual de formateo; no migra todo Obsidian ni elimina Node.
El uso del comando sobre una bóveda real requiere cerrar su observador para
evitar dos procesos de sincronización simultáneos. Ver [operación y límites](../runbooks/05-memoria-obsidian.md#formateo-manual-con-python).
