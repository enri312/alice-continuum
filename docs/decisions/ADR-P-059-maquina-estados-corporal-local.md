# ADR-P-059 — Máquina de estados corporal local y aprendizaje motor separado

Fecha: 2026-08-11  
Estado: aceptada para el visor manual de BODY SOLVER

## Contexto

Alice dispone de clips privados Mixamo validados para reposo, locomoción, salto, arranque de marcha, reposo sentado y levantarse. Reproducirlos directamente según el stick causa cortes, permite mover un cuerpo sentado y confunde repertorio instalado con aprendizaje motor.

## Decisión

- Incorporar una máquina pura con estados `standing-idle`, `starting-walk`, `locomoting`, `jumping`, `sitting-down`, `sitting-idle` y `standing-up`.
- Ejecutar `Start Walking` una sola vez antes de una marcha frontal iniciada desde reposo.
- Reutilizar `Standing Up` en reversa para sentarse, porque todavía no existe un clip independiente de *Sitting Down*.
- Mantener `Sitting Idle` en bucle y obligar a pasar por `Standing Up` antes de aceptar locomoción.
- Fundir acciones durante 180–240 ms y mantener movimiento de escena, animación, IK y decisión cognitiva como capas separadas.
- Exponer estado y clip en telemetría; el control continúa etiquetado como humano o diagnóstico local.
- No escribir recuerdos, no reforzar habilidades y no habilitar `output.avatar.body` desde esta máquina.

## Aprendizaje motor futuro

La máquina aporta el vocabulario corporal, pero aprender exige otro ciclo gobernado:

1. intención aprobada y estado inicial;
2. acción corporal seleccionada;
3. telemetría real de ejecución, apoyo, duración, colisión y resultado;
4. comparación con un objetivo observable;
5. episodio motor local con procedencia y correlación R3;
6. varias repeticiones exitosas antes de proponer una memoria procedural;
7. confirmación del propietario antes de consolidar o modificar una política.

Un clip disponible representa capacidad. Un clip reproducido representa ejecución. Sólo evidencia repetida y validada podrá representar aprendizaje.

## Consecuencias

- El inspector reconoce 12 clips reales sin publicar sus binarios.
- Alice puede sentarse y levantarse visualmente, aunque todavía no conoce muebles, equilibrio físico ni consecuencias.
- La futura sala podrá alimentar experiencias motoras sin convertir el diagnóstico actual en autonomía ficticia.
