# Dirección visual de Alice Continuum

Fecha: 2026-11-15. Estado: **propuestas para revisión; no aplicadas al producto**.

El propietario pide una identidad seria y propia para una asistente que conversa,
acompaña, conserva recuerdos y realiza acciones autorizadas. El objetivo es renovar
la presentación conservando contenido, funciones, datos y permisos.

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

## Dos alternativas comparables

| Propuesta | Organización | Carácter y uso |
|---|---|---|
| Observatorio | Navegación lateral compacta, conversación despejada, memoria como registro y volumen con inspector contextual. | Recomendada como punto de partida por la cantidad de módulos y la importancia de explorar el núcleo de Alice. |
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
- Catálogo actual de iconos conservado. Los símbolos de las maquetas son
  representativos; adaptar tamaños o redibujar un icono requiere una revisión
  individual antes de retirar su versión anterior.

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

1. Revisar las dos propuestas y concretar la dirección visual y los elementos
   que se quieren combinar.
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
