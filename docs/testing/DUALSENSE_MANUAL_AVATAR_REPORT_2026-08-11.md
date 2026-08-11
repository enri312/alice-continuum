# Informe de prueba manual — DualSense y visor de Alice

Fecha: 2026-08-11  
Estado: entrada real y ensayo visual confirmados; locomoción procedural limitada

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

El visor añade `Ensayar marcha`, una secuencia determinista local de ocho segundos que recorre avance, retroceso, lateral, giro y reposo. Se compiló una variante Tauri temporal con autoensayo exclusivamente para la comprobación visual, se recorrió la interfaz real con mouse y se capturaron ciclos sobre `Alice.vrm`. La primera revisión reveló cruce de pies lateral; se redujeron apertura y elevación, se recompiló y el segundo ciclo quedó estable. Después se cerró esa instancia y se restauró una compilación normal sin autoensayo.

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
- Siete pruebas TypeScript validan zona muerta, selección del DualSense, sticks/gatillos, límites, movimiento local, secuencia diagnóstica y suavizado.

## Límite observado

La corrección evita el deslizamiento completamente rígido y ofrece feedback corporal durante la prueba, pero no bloquea cada pie contra el suelo. La siguiente mejora de calidad requiere clips direccionales con licencia compatible, retargeting al humanoide VRM, crossfade y un solver IK de pies; no se presenta esta marcha procedural como terminada.
