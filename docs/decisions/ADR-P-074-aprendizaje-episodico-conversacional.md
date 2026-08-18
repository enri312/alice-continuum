# ADR-P-074 — Aprendizaje episódico desde conversaciones reales

Fecha: 2026-08-17  
Estado: aceptada; primer incremento implementado

## Contexto

Alice ya conserva hasta tres intercambios de nube en memoria de trabajo, pero ese contexto desaparece al vencer el TTL o cerrar la aplicación. Carlos quiere que las conversaciones reales contribuyan al crecimiento de Alice aunque cambie el modelo seleccionado en OpenRouter. Una respuesta de un modelo, sin embargo, puede contener errores y no debe convertirse silenciosamente en conocimiento verdadero.

## Decisión

- El control local pasa a llamarse **Aprendizaje episódico local** y comienza activado; Carlos puede desmarcarlo antes de cada envío.
- Sólo una respuesta realmente recibida del proveedor puede crear un episodio. Un fallo, una previsualización o un estado de demostración no escribe memoria.
- El episodio conserva pregunta, respuesta, fecha, proveedor y modelo en `records.json`, fuera de Git.
- Su clase es `episodic`, su fuerza inicial es `0.08` y su procedencia declara `Intercambio real autorizado`.
- `confirmed` confirma que el intercambio ocurrió; no certifica como verdaderas las afirmaciones del modelo.
- Cuando un episodio se recupera para otra conversación, el payload lo rotula explícitamente como **NO ES UN HECHO VERIFICADO**.
- Cambiar de modelo no cambia la fuente de verdad: la memoria pertenece a Alice y registra cuál modelo produjo cada respuesta.

## Límites

- Este incremento no extrae automáticamente preferencias, hábitos, hechos ni procedimientos.
- OpenRouter continúa sin herramientas de búsqueda dentro de Alice; una petición de “investigar” no demuestra actualidad ni verificación de fuentes.
- La ventana activa aporta sólo título y proceso autorizados. No equivale a visión de pantalla, comprensión de un juego, video o trabajo.
- Cámara, micrófono, audio del sistema y píxeles permanecen fuera de esta ruta.

## Siguiente incremento

Crear candidatos revisables derivados de evidencia explícita: datos afirmados por Carlos, resultados con fuentes verificables y observaciones de adaptadores reales. Sólo la confirmación del propietario podrá promoverlos a perfil, preferencia o memoria semántica.
