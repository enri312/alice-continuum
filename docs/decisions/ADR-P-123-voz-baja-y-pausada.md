# ADR-P-123 — Voz baja y pausada

Fecha: 2026-11-12. Estado: implementado; aceptación acústica de voz baja pendiente.

El propietario indicó que de madrugada habla bajo y despacio, y solicitó más
sensibilidad. Se añade un selector visible en Audio de entrada con dos perfiles:

| Perfil | Ganancia local de entrada | Silencio para terminar un turno automático |
|---|---:|---:|
| Normal | 1× | 1 s |
| Voz baja y pausada | 4×, aproximadamente +12 dB | 2 s |

La ganancia se aplica en un GainNode entre el filtro pasaaltos y RNNoise. El
stream entregado al grabador sigue siendo el procesado y se conserva el límite
de amplitud del worklet. El nodo de ganancia se desconecta al cerrar o cancelar.

El perfil se propaga tanto a dictado manual como a escucha automática. Sólo la
escucha automática usa el plazo de cierre por silencio; el dictado conserva su
botón de finalización. Los valores desconocidos vuelven a Normal. Los criterios
RMS/probabilidad, los 120 ms mínimos de voz, el descarte tras 8 s de silencio y
las cotas de duración/tamaño permanecen como antes.

La página comienza con Voz baja y pausada por la petición del propietario;
Normal queda disponible. La selección pertenece a la página y no se persiste
en almacenamiento ni cambia la configuración del sistema. El selector queda
deshabilitado durante captura o preparación. El estado identifica el perfil de
la última toma preparada, sin afirmar que una selección nueva ya se aplicó.

La amplificación no demuestra por sí sola que Whisper reconozca una palabra ni
mejora una relación voz/ruido deficiente. El propietario puede volver a Normal
si aumenta la captación del ambiente o aparece saturación. La petición completa
y los controles de ejecución continúan siendo necesarios.

[Pruebas y límites](../testing/SOFT_VOICE_REPORT_2026-11-12.md).
