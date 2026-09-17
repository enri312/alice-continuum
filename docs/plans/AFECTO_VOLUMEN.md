# Estado afectivo y representación del volumen

## Criterio acordado

El volumen permite observar el procesamiento de Alice. El tamaño representa
importancia duradera, el color debe representar una asociación emocional y el
brillo actividad actual. Una memoria importante conserva su tamaño en reposo.
Una emoción simulada puede combinar canales y cambiar con el contexto.

## Implementado en esta revisión

- Encuadre centrado, selección accesible, inspector y órbita opcional.
- Tamaño por importancia registrada; brillo de recuperación independiente.
- Selector de importancia en la confirmación conversacional. Antes se derivaba
  de la confianza del modelo; esa equivalencia era incorrecta. No se migraron
  retrospectivamente valores existentes.
- Paleta de diez emociones con nostalgia gris rosado.
- Las propuestas de recuerdo conversacional pueden contener hasta tres emociones
  expresadas explícitamente por el propietario. Cada canal conserva intensidad y
  una cita literal, se muestra para revisión y se guarda sólo al confirmar el recuerdo.
- Gemma propone el contenido del recuerdo, pero no decide el canal emocional: un
  analizador local determinista deriva el canal y los modificadores de intensidad
  desde la cita. Esto evita conservar clasificaciones contradictorias del modelo.
- La misma frontera normaliza las clases: una emoción explícita sin declaración de
  preferencia es `episodic`; “prefiero”, “me gusta” o “me encanta” permanece como
  `preference`. Los hechos neutrales continúan como `semantic`.
- El backend rechaza etiquetas sin una palabra emocional explícita, citas ajenas,
  negaciones cercanas, canales repetidos e intensidades fuera de rango.
- Un nodo confirmado mezcla ponderadamente los colores guardados. Los estados de
  conflicto, archivo, supresión y reposo prevalecen para no ocultar su condición.
- Asociaciones persistentes sin pulsos decorativos de procesamiento.

## Siguiente integración pendiente

La asociación afectiva del recuerdo no es todavía el estado emocional actual de
Alice. Falta el sistema temporal que combine contexto presente, recuperación,
decaimiento y respuesta sin reescribir el recuerdo original. Cámara, micrófono y
avatar necesitan conexiones y pruebas independientes. Una evaluación ausente
figura sin evaluar, nunca como diez emociones medidas en cero.
