# Informe de prueba manual — DualSense y visor de Alice

Fecha: 2026-08-11  
Estado: entrada real, retargeting Mixamo y ensayo visual confirmados; IK completo pendiente

## Hardware real

Windows detectó por Bluetooth:

- `DualSense Wireless Controller`.
- Interfaz de juego HID Sony `VID 054C / PID 0CE6`.
- Estado PnP `OK`, código de problema `0`.
- Controladores HID Bluetooth Microsoft firmados.

## Primera observación humana

Carlos Nuñez activó la prueba en el visor y confirmó movimiento real mediante el mando. Informó que el personaje se desplazaba rígido, como si se deslizara, porque la primera versión sólo trasladaba la raíz del VRM.

## Corrección

Se agregó locomoción procedural limitada:

- alternancia de muslos;
- flexión de rodillas;
- balanceo opuesto de brazos;
- inclinación leve de columna y cadera;
- oscilación vertical mínima;
- transición suavizada hacia movimiento o reposo;
- avance relativo a la orientación actual de Alice;
- separación de gesto frontal, lateral y de giro.

Stick izquierdo controla desplazamiento, stick derecho giro y L2/R2 brazos. La entrada queda limitada por zona muerta, delta máximo y radio de traslación. Detener restablece la pose.

El visor añade `Ensayar marcha`, una secuencia determinista local de diez segundos que recorre avance, carrera, retroceso, lateral, giro, salto y reposo. La prueba inicial aquí descrita fue posteriormente reemplazada por clips privados de Mixamo retargeteados; el diagnóstico procedural de huesos queda únicamente como respaldo cuando falta un clip. La ampliación y sus mediciones están documentadas en [AVATAR_LOCOMOTION_APPEARANCE_REPORT_2026-08-11.md](AVATAR_LOCOMOTION_APPEARANCE_REPORT_2026-08-11.md).

## Inventario real del VRM

- 18.631.596 bytes.
- 54 huesos humanoides declarados, incluidas piernas, pies y dedos.
- 14 expresiones VRM.
- 52 cadenas de resortes y 22 colliders.
- Cero clips de animación embebidos.

El rig permite retargeting y física secundaria, pero el archivo por sí solo no contiene caminar, correr, idle animado o giros.

## Seguridad y alcance

- Sin vibración, iluminación, altavoz o micrófono del mando.
- Sin persistencia, red, memoria, R5 o auditoría cognitiva.
- Etiqueta visible `CONTROL HUMANO`.
- No habilita el puente `output.avatar.body`.
- Las pruebas TypeScript validan zona muerta, selección del DualSense, sticks/gatillos, límites, movimiento local, secuencia diagnóstica, suavizado, mezcla de clips, temporización y estabilización de pies.

## Límite observado

El retargeting y la mezcla direccional ya están implementados con activos privados compatibles, junto con corrección vertical y un primer estabilizador horizontal. El bloqueo alcanza todavía su límite de 6,5 cm en algunas fases de apoyo. La siguiente mejora de calidad requiere un solver IK de pies o locomoción con movimiento raíz; no se presenta el estabilizador actual como IK terminado.
