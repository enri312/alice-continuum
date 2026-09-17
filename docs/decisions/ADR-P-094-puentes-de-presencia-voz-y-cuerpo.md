# ADR-P-094 — Puentes de presencia, voz y cuerpo desacoplados

Fecha: 2026-09-12  
Estado: aceptada para el diseño R9.1

## Contexto

Alice ya cuenta con conversación local, memoria gobernada, permisos R2, auditoría
R3, un avatar VRM privado y un piloto manual de transcripción local. Estos
componentes no deben convertirse en una sola tubería: capturar voz, sintetizar
audio, animar el cuerpo y almacenar recuerdos tienen riesgos, permisos y ciclos de
vida diferentes.

Fish Audio es una opción que el propietario posee para la voz, pero una credencial
no autoriza enviarle conversaciones ni instalar el adaptador heredado. El VRM
declara expresiones reales, aunque todavía no tiene salida facial ni mapeo desde
sensores.

## Decisión

1. R9 se implementará mediante puentes unidireccionales e independientes.
2. El piloto de voz local sigue siendo entrada manual a texto revisable; no es TTS
   ni conversación por voz permanente.
3. `output.voice.synthesize` requerirá una previsualización del texto, una
   confirmación específica por intento, un límite de salida, cancelación y una
   política de descarte efímero antes de que se adopte cualquier proveedor.
4. Una credencial de Fish Audio sólo podrá provenir del entorno del proceso nativo.
   No se copiará a documentos, React, memoria, auditoría, capturas, pruebas ni Git.
5. El avatar recibe únicamente salidas de presentación aprobadas. Sus expresiones,
   mirada y cuerpo no deciden tareas, memoria, permisos ni estado emocional real.
6. La entrada facial/corporal continúa bajo permisos R2 separados y produce sólo
   datos efímeros filtrados. No identifica personas ni guarda biometría.
7. Los estados `no-signal`, `denied`, `cancelled`, `error` y `unavailable` son
   distintos y visibles. Un fallo o desconexión no activa reintentos automáticos.
8. Desconectar cualquier puente conserva conversación, memoria y los demás
   puentes operativos.

## Consecuencias

- La primera entrega de R9 es un contrato revisable, no una activación de cámara,
  micrófono, proveedor de nube o avatar.
- Fish Audio se podrá reemplazar si sus términos, costo o pruebas no resultan
  adecuados, porque el contrato no depende de su API.
- La integración llevará más pasos, pero cada salida tendrá procedencia, control y
  una parada comprensible para Carlos.
- Actividad del volumen y colores afectivos continúan siendo una proyección
  trazable; no se reinterpretan como emociones conscientes por añadir una voz o
  animación.

## Referencias

- [Plan R9](../plans/R9-presence-voice-body.md)
- [Piloto local de turno de voz](../testing/VOICE_TURN_PILOT_2026-09-05.md)
- [Registro de capacidades R1](../architecture/CAPABILITY_REGISTRY_R1.md)
- [Política de cuarentena de adaptadores](../architecture/ADAPTER_QUARANTINE.md)
