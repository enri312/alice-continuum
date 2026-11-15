# Dirección visual de Alice Continuum

Fecha: 2026-11-15. Estado: **evolución del diseño actual en revisión; no aplicada al producto**.

El propietario pide una identidad seria y propia para una asistente que conversa,
acompaña, conserva recuerdos y realiza acciones autorizadas. El objetivo es renovar
la presentación conservando contenido, funciones, datos y permisos.

**Aclaración vigente del propietario:** conservar también todos los iconos y
la identidad visual existente. La propuesta actual evoluciona los marcos,
espaciado, tipografía y superficies de Alice; no usa iconos sustitutos ni adopta
Observatorio o Cuaderno como una interfaz que reemplace la suya.

## Propuesta actual: evolución de la interfaz real

Se preparó una capa CSS privada sobre el build real del proyecto, dentro de un
navegador aislado. Conserva las tres áreas de navegación, sus nombres, los SVG
originales, las pantallas y la escena cerebral existente. No se reconstruyeron
los paneles con contenido abreviado. Se mejoran la coherencia de los marcos,
contraste entre superficies, espacio de los controles y legibilidad.

El estudio está en `experiments/alice-evolution-2026-11-15/`, excluido de Git.
`evolution.css` no se importa desde la aplicación. La vista previa muestra
capturas reales de esa composición en Conversación, Volumen y Estado; Memoria
tiene también una captura privada. La galería está en `alice-evolution.html`.

La comprobación comparó el estado inicial de las 15 rutas antes y después del
estilo: mismos nodos de texto, estructura DOM, botones, campos y marcado SVG de
navegación. Los hashes de los 22 archivos SVG originales también se conservaron.
Se revisaron capturas de escritorio, incluido el volumen generado por el renderer
existente. No se sustituyó la escena 3D por el esquema de las primeras maquetas.

Las capturas usan seis registros ficticios en un perfil de navegador independiente,
sin puente nativo, servicios ni datos personales. Los avisos de disponibilidad
corresponden a ese entorno visual, no a un diagnóstico de Alice Desktop. La
verificación cubre los estados muestreados a 1360 px; no certifica todas las
subvistas ni la operación real de dispositivos. La aceptación nativa y los anchos
adicionales se comprobarán al incorporar una propuesta al producto.

Evidencia privada: `runtime/artifacts/alice-evolution-2026-11-15/verification.json`,
capturas anteriores/posteriores y la galería. Las fuentes y hojas de estilo
productivas, los datos y los iconos permanecen sin cambios.

## Diagnóstico del diseño actual

La aplicación ya tiene una identidad reconocible: fondo oscuro, acentos cian,
iconos elaborados y visualización cognitiva. La navegación actual superpone marca,
selector de sistemas, encabezado del sistema y fila de pantallas. Los efectos de
borde, brillo y tipografía técnica compiten con el contenido en varias vistas.
Esta es una valoración de diseño basada en la interfaz actual, no un diagnóstico
de rendimiento.

La dirección propuesta pone la personalidad en la continuidad de la conversación,
la memoria con origen visible y el volumen cognitivo. La navegación y las
superficies acompañan esos elementos con una jerarquía más tranquila.

## Exploraciones anteriores, sin adoptar

| Propuesta | Organización | Carácter y uso |
|---|---|---|
| Observatorio | Navegación lateral compacta, conversación despejada, memoria como registro y volumen con inspector contextual. | Exploración anterior de organización; no es la base vigente tras la aclaración de conservar la identidad y los iconos actuales. |
| Cuaderno | Navegación superior de espacios principales y una composición más editorial para mensajes y recuerdos. | Alternativa más cálida para dar prioridad al acompañamiento y la lectura cotidiana. |

Las maquetas permiten alternar Conversación, Memoria y Volumen cognitivo. Todo
su contenido es ilustrativo: no representan estados, recuerdos ni respuestas
leídos de la instalación. Enviar está deshabilitado y no se abren dispositivos,
modelos o servicios. Los demás destinos se enumeran para conservar su lugar en
la organización; sus interfaces completas quedan fuera de esta muestra.

La maqueta bilateral de Volumen es un esquema de composición con temas de ejemplo.
No sustituye la escena cerebral 3D, las relaciones confirmadas ni las señales R3
del producto. La actividad real y una demostración conservarán sus distinciones.

## Criterios para la identidad

- Tipografía de lectura para mensajes, descripciones y controles; monoespaciada
  para identificadores, tiempos y datos técnicos cuando ayude a interpretarlos.
- Fondos oscuros con profundidad por capas y acentos contenidos. La propuesta
  se adapta también a una apariencia clara, sin darla por implementada en Alice.
- Un lenguaje común de espacios, tamaños, foco y superficies entre pantallas,
  manteniendo diferencias útiles entre conversar, inspeccionar y administrar.
- Contexto y herramientas complementarias a demanda en Conversación, conservando
  el mensaje, historial, voz, memoria, visión, documentos y diagnóstico existentes.
- Volumen cognitivo como escena principal con inspector próximo a la selección;
  memoria como contenido legible con tipo, origen y acciones de revisión claras.
- Estados reales visibles y acompañados de texto. Los colores de tipos de memoria
  y estados conservan su significado; no se usan como adorno intercambiable.
- Catálogo e iconos originales conservados: la propuesta vigente utiliza los
  recursos reales, sin redibujarlos ni sustituirlos por una biblioteca genérica.
  Sólo su marco, distribución y tamaño pueden ajustarse dentro de la evolución.

## Mapa de contenido que debe conservarse

| Destinos actuales | Tratamiento propuesto |
|---|---|
| Conversación | Espacio principal con las funciones esenciales; contexto, documentos y diagnóstico siguen accesibles. |
| Memoria | Aprendizaje, recuerdos/perfil, contexto de sesión y mantenimiento, con sus acciones y fuentes actuales. |
| Volumen cognitivo | Escena, selección, inspector, aprendizaje y lectura de actividad conservados. |
| Flujo cognitivo, Estado y controles, Actividad | Herramientas para observar procesos, ajustar controles disponibles e inspeccionar evidencia. |
| Planificador | Acciones, pasos y confirmaciones en un destino propio. |
| Rostro, Cuerpo, Avatar | Presencia con los controles, permisos y ciclo de vida actuales. |
| Puentes, Habilidades, Procedimientos | Capacidades y acciones gobernadas con su alcance visible. |
| Auditoría y diagnóstico, Configuración | Administración, evidencias, salud técnica y preferencias bajo control del propietario. |

La agrupación y los nombres finales aún pueden ajustarse. Un destino movido debe
seguir siendo accesible; tampoco se eliminan subpestañas por no aparecer abiertas
en una maqueta.

## Incorporación gradual

1. Revisar la evolución de la interfaz real y concretar sus ajustes conservando
   iconos, identidad y contenido. Las exploraciones previas quedan como referencia.
2. Definir colores, tipografía, espacios, superficies y estados en una base común.
   Probarla en `experiments/`, sin introducir dependencias React nuevas.
3. Aplicar primero una pantalla Dioxus acotada, como Actividad, comparando sus
   contenidos y acciones con la versión actual antes de ampliar el alcance.
4. Extender a Estado/Flujo y las demás pantallas por incrementos. La estructura
   raíz se coordina con su migración para evitar mantener dos navegaciones.
5. Después de cada incorporación: revisar contenido, teclado, estados de error,
   anchos, compilación, funcionamiento nativo, documentación y commit.

Los prototipos están en `experiments/alice-design-2026-11-15/`, excluidos de Git.
Se comprobaron las tres vistas en ambas propuestas a 1024, 736, 390 y 320 px:
24 composiciones sin desbordamiento horizontal ni errores de script observados.
Se probaron navegación, contexto, filtrado de recuerdos, origen y selección del
esquema de Volumen. Se revisaron capturas de escritorio y ancho pequeño.
La evidencia privada está en `runtime/artifacts/alice-design-2026-11-15/`.

No se cambiaron fuentes de la aplicación, estilos productivos, archivos de datos
ni dependencias. Estas comprobaciones corresponden a las propuestas visuales y
no sustituyen la aceptación nativa de una implementación futura.
