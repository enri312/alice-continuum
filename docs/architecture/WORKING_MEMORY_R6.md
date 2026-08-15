# Memoria de trabajo R6.2

Estado: incremento R6.2-C validado  
Fecha: 2026-08-14

## Propósito

La memoria de trabajo conserva únicamente el contexto conversacional reciente que Alice está usando durante el proceso actual. No es un recuerdo duradero, no declara aprendizaje y no modifica `records.json` ni `layer-index-v2.json`.

## Contrato vigente

| Límite | Valor |
|---|---:|
| Intercambios completos | 3 |
| Mensajes | 6 |
| Caracteres | 48.000 |
| TTL desde la última respuesta | 30 minutos |
| Persistencia | Ninguna |

Un intercambio entra al almacén sólo después de una respuesta real y satisfactoria del proveedor. Conserva texto de usuario, texto de Alice, fecha UTC, proveedor, modelo y procedencia `cloudConversation`. Al superar un límite se retira el intercambio completo más antiguo; nunca se trunca un mensaje.

## Ciclo de vida

1. React presenta al propietario exactamente qué contexto saldrá.
2. El propietario autoriza una solicitud real.
3. Rust recibe una respuesta real del proveedor.
4. Rust registra el intercambio en RAM y aumenta su generación.
5. React consulta el snapshot defensivo y muestra sólo esa fuente nativa.
6. El vencimiento, un vaciado confirmado o el cierre del proceso elimina el contenido.

`clear_working_memory` exige `confirmed: true` y la generación exacta vista por el usuario. Si llegó un intercambio más reciente, el vaciado se bloquea para no borrar estado que no fue revisado.

## Privacidad y auditoría

R3 registra operación, resultado, duración y un SHA-256 derivado. No recibe preguntas ni respuestas. Un fallo posterior de auditoría se informa sin descartar silenciosamente una respuesta ya recibida; un fallo al registrar en RAM tampoco se presenta como éxito de memoria.

## Integración visual

La conversación real vive dentro de `[00] CONVERSATION / PERCEPTION INPUT`; no existe como pantalla cognitiva independiente. El mapa de referencia queda así:

- cerebro: `[00]`, `[01]`, `[02]`, `[03]`, `[04]`, `[06]` y `[07]`;
- cuerpo: `[05] FACE + BODY OUTPUT BRIDGE`;
- `Face` y `Body` son destinos visibles del grafo `[02]`, pero su ejecución pertenece a `Body Solver`.

La pantalla Memoria mantiene subpestañas distintas para recuerdos duraderos, Trabajo RAM y Capas R6. Trabajo RAM recibe el mismo snapshot nativo que alimenta la conversación, actualiza el TTL cada cinco segundos y muestra solamente conteos, presupuesto, generación, proveedor, modelo y fecha. No duplica preguntas o respuestas.

El vaciado presenta una confirmación visible y envía la generación exacta mostrada. Rust bloquea una generación obsoleta, por lo que una respuesta llegada después de abrir la confirmación no puede borrarse accidentalmente. En desarrollo web aparece `SIN BACKEND`; no existe fallback con contenido o métricas inventadas.

## Presupuesto del contexto saliente

La previsualización obligatoria compone primero la cadena exacta que recibirá el comando nativo y deriva de ella un presupuesto por fragmento. Muestra mensaje actual, historial reciente, recuerdos relevantes y ventana actual; las tres últimas fuentes son opcionales y registran cero cuando no fueron autorizadas o no están disponibles. También muestra el coste de los separadores y el total.

Se cuentan caracteres Unicode y bytes UTF-8 mediante `TextEncoder`. No se estima un número de tokens porque la tokenización cambia entre proveedor y modelo. El presupuesto no modifica el límite independiente de 1.200 tokens de salida configurado en Rust.
