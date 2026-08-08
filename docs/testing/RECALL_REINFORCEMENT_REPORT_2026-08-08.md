# Informe de integración — Refuerzo por recuperación autorizada

Fecha: 2026-08-08  
Estado: aprobado con pruebas locales; llamada real pendiente de una enseñanza elegible

## Alcance

Se conectó la recuperación lexical de Conversación con la consolidación persistente. Los identificadores se congelan al abrir la previsualización y se procesan localmente solo después de que el proveedor devuelve una respuesta correcta.

## Comportamiento verificado

- Buscar recuerdos no cambia la memoria.
- Mostrar la previsualización no cambia la memoria.
- Desmarcar **Recuerdos relevantes** produce una lista de refuerzo vacía.
- Solo una `Enseñanza` con estado `confirmed` puede entrar en esa lista.
- Conversaciones, conflictos, archivados, registros sin identificador y duplicados quedan excluidos.
- Una recuperación correcta incrementa `successfulRecalls`, actualiza `lastRecalledAt` y aumenta moderadamente `storageStrength`.
- Los repasos manuales utilizan `successfulReviews`, `correctionCount` y `lastReviewedAt`; ya no comparten contadores con el uso conversacional.
- Los identificadores internos no se agregan al `payload` enviado al proveedor.

## Resultados automatizados

| Comprobación | Resultado |
|---|---|
| Pruebas TypeScript | 25/25 aprobadas |
| Pruebas Rust | 10/10 aprobadas |
| Compilación frontend | Aprobada |
| Compatibilidad de registros antiguos | Aprobada; campos nuevos comienzan en cero |
| Mutación de los ocho registros personales durante la auditoría | Ninguna |

## Límite de la prueba

Los datos actuales contienen conversaciones, pero ninguna enseñanza directa elegible. Por esa razón no se fabricó un registro ni se consumió una llamada de nube solo para producir una captura. La transformación exacta y la selección de identificadores están cubiertas con fechas y objetos controlados en `memory-consolidation.test.ts`.

Cuando Enrique cree una enseñanza y autorice su inclusión en una conversación relacionada, la pestaña Memoria mostrará el aumento en **USOS AUTORIZADOS** y consolidación. Ese será el primer ensayo de extremo a extremo con datos reales del usuario.
