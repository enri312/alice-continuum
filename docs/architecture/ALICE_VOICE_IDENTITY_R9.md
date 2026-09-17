# Identidad de voz de Alice — R9

Fecha: 2026-09-12  
Estado: perfil de selección aprobado por el propietario. La voz elegida se
configura sólo fuera del repositorio mediante `ALICE_FISH_REFERENCE_ID`; no es un
recuerdo ni un dato de Git. El puente R9.2 sigue requiriendo una prueba manual.

## Fuente y alcance

El propietario confirmó que el personaje mostrado por `Assets/Alice.vrm` representa
a Alice: cabello claro, ojos azul claro, indumentaria técnica oscura con detalles
fríos y una silueta juvenil-adulta. La imagen es una referencia de dirección
artística; no define una edad, nacionalidad, identidad humana ni una emoción real.

La voz no pretende hacer pasar a Alice por una persona concreta. Es una capa de
presentación del avatar, separada de conversación, memoria, percepción y decisión
cognitiva según ADR-P-094.

## Dirección aprobada

| Dimensión | Decisión |
|---|---|
| Idioma principal | español latino neutro |
| Género de presentación | femenino |
| Registro | joven-adulto, claro y cercano |
| Timbre | limpio, luminoso y suave, con cuerpo natural; no estridente |
| Ritmo | pausado-medio, articulado y fácil de seguir |
| Carácter de presentación | sereno, atento, técnico y cordial |
| Intensidad inicial | contenida; no declama ni sobreactúa |
| Compatibilidad visual | acompaña la estética blanca, grafito, negra y cian del VRM sin convertirla en una voz robótica |

## Exclusiones

Se descartan voces que resulten:

- infantiles o excesivamente agudas;
- caricaturescas, estilo anime exagerado o coquetas por defecto;
- robóticas, de asistente telefónico o de locución comercial;
- demasiado graves, autoritarias o dramáticas para la presencia de Alice;
- marcadamente regionales para el uso inicial en español latino neutro;
- obtenidas mediante clonación o referencias de una persona sin autorización.

## Audición comparativa obligatoria

No se adoptará una voz por nombre, imagen de catálogo o metadatos. Se evaluarán
hasta tres voces públicas o ya autorizadas que declaren español compatible, usando
la misma síntesis efímera y estos tres textos no privados:

1. **Bienvenida:** «Hola, Carlos. Estoy lista para acompañarte con lo que necesites.»
2. **Explicación:** «Podemos revisar el resultado paso a paso y conservar sólo la
   información que decidas confirmar.»
3. **Cercanía serena:** «Entiendo. Podemos tomarnos un momento y continuar cuando
   te resulte cómodo.»

Carlos elegirá una sola voz después de oír las tres. El resultado se registrará
como `voiceProfileId` opaco en configuración local, no como un recuerdo. Si ninguna
cumple, se descartan las tres sin retener los audios.

## Límites de la primera prueba

- una solicitud a la vez, máximo 500 caracteres por muestra;
- texto explícitamente previsualizado y confirmado antes de salir del equipo;
- MP3 temporal reproducido sólo en Alice y descartado al cerrar, cancelar o iniciar
  otra audición;
- sin streaming, clonación, subida de audio, sincronización labial ni memoria;
- sin enviar historial de conversación, recuerdos, imagen del avatar o datos de
  Carlos al proveedor;
- error, falta de crédito o cancelación no reintentan la solicitud.

## Criterio de aceptación de la selección

La voz elegida debe entenderse con facilidad en los tres textos, conservar español
latino neutro, resultar coherente con el personaje y poder detenerse sin dejar un
audio persistente. El veredicto es artístico y humano de Carlos; el proveedor no
lo calcula ni lo sustituye.
