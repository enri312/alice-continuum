# ADR-P-065 — Cierre R5 y vigencia de evidencia procedimental

Fecha: 2026-08-13  
Estado: aceptada

## Contexto

R5.1–R5.4 podían detectar una repetición R3, conservar o descartar una huella y convertir un candidato `retain` en borrador R4. Faltaba distinguir visual y nativamente una evidencia aún reconstruible de otra que salió de la ventana R3, y evitar que una auditoría no saludable se confundiera con obsolescencia.

## Decisión

- Cada decisión R5 expone un `evidenceState` cerrado: `current`, `stale`, `dismissed`, `converted` o `blocked`.
- `current` exige que el fingerprint vuelva a aparecer en el detector R5.2 vigente.
- `stale` significa que R3 está saludable pero la huella retenida ya no se reconstruye en la ventana visible.
- `blocked` significa que R3 no está saludable; no se afirma vigencia ni obsolescencia.
- `dismissed` tiene precedencia para descartes; `converted` tiene precedencia cuando existe un borrador R4 con procedencia verificable.
- El comando nativo de conversión vuelve a leer R1/R3 y rechaza una huella obsoleta o una auditoría bloqueada. La interfaz no es la única barrera.
- La pantalla muestra ocurrencias, eventos correlacionados, pasos, variaciones de duración o huella, umbrales y límites sin copiar contenido privado.

## Consecuencias

- Consultar sigue siendo pasivo y no crea almacenamiento.
- Una decisión inmutable puede cambiar de clasificación porque la clasificación describe evidencia visible, no reescribe la decisión.
- La salida de la ventana R3 no elimina el candidato ni sus hashes; sólo impide una nueva conversión hasta que exista evidencia vigente verificable.
- R5 queda cerrado sin autoactivación, ejecución o escritura en memoria duradera.

## Evidencia

El cierre se valida con archivos temporales y eventos R3 producidos por los constructores reales: `retain` vigente, obsolescencia al vaciar la ventana, bloqueo con R3 no saludable, descarte y conversión. La prueba de obsolescencia confirma que no aparece `data/skills` y que el árbol temporal conserva exactamente sus hashes.
