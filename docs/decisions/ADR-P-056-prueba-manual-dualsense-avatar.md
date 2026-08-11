# ADR-P-056 — Prueba manual de DualSense dentro del visor VRM

Fecha: 2026-08-11  
Estado: aceptada como experimento delimitado de BODY SOLVER

## Contexto

Carlos Nuñez conectó un mando DualSense real por Bluetooth y pidió probar el movimiento del personaje. R9 y el puente corporal siguen futuros; convertir esta prueba en una salida de Alice mezclaría control humano, cognición y cuerpo antes de definir el adaptador gobernado.

## Decisión

- La prueba vive exclusivamente en la pestaña Avatar y se activa mediante `Probar control PS5`; `Ensayar marcha` ofrece una secuencia local determinista para inspección sin hardware.
- Usa Gamepad API del WebView; no instala drivers ni dependencias y no abre una ruta nativa genérica.
- Stick izquierdo desplaza la raíz dentro de un límite de 0,85 unidades.
- Stick derecho gira el VRM; L2 y R2 modifican los brazos.
- La locomoción visible aplica un ciclo procedural limitado de piernas, rodillas, brazos, cadera y oscilación vertical.
- La entrada se suaviza antes de mover el avatar y el paso distingue avance, desplazamiento lateral y giro.
- Una zona muerta de 0,14 evita deriva y cada frame limita su delta a 50 ms.
- Detener, salir de la pestaña o desmontar el visor restablece posición, rotación y postura.
- No se envían órdenes de vibración, iluminación, altavoz o micrófono al DualSense.
- La lectura no se persiste, no se audita como conducta y no alimenta R5, memoria o simulación afectiva.
- Esta interacción pertenece al visor manual existente; `output.avatar.body` continúa planificada y sin adaptador.

## Consecuencias

- Se puede comprobar el rig y la ergonomía con hardware real sin afirmar que el cuerpo de Alice está conectado.
- La etiqueta `CONTROL HUMANO` evita confundir la entrada con autonomía.
- El ensayo se etiqueta `CONTROL TÉCNICO`, dura ocho segundos por ciclo y tampoco representa autonomía.
- El movimiento es procedural de prueba, no una animación de marcha producida por Mocap, física o un solver IK.
- R9 deberá reemplazar este experimento por contratos de entrada/salida, permisos, parada y auditoría independientes.
