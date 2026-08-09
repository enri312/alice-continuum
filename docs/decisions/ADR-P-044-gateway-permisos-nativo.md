# ADR-P-044 — Gateway nativo de permisos efímeros

Fecha: 2026-08-09  
Estado: aceptada para implementación incremental

## Contexto

R1 ofrece una fuente de verdad sobre 24 capacidades, pero describe dónde vive cada control actual sin imponer una frontera común. Algunas confirmaciones siguen en React y los comandos protegidos todavía no exigen un grant nativo.

Carlos Nuñez autorizó avanzar con cámara y micrófono reales. Esa autorización de desarrollo no debe convertirse en captura permanente ni permitir que una respuesta del modelo active dispositivos por sí sola.

## Decisión

- Crear un Gateway en Rust con política de denegación predeterminada.
- Preparar y retener los parámetros en el backend antes de mostrar la previsualización.
- Vincular cada decisión al digest de una previsualización inmutable.
- Admitir grants `oneShot` y leases `session`, siempre específicos, revocables y con vencimiento.
- Eliminar solicitudes y grants al cerrar Alice; R2 no persiste permisos.
- Tratar cerrar el diálogo, perder estado o fallar una validación como rechazo.
- Exigir indicador visible y control Detener para cámara y micrófono.
- Conservar separados los permisos de cámara, micrófono y cualquier futura salida Fish Audio.
- Migrar capacidades existentes una por una; ninguna se declara protegida nativamente hasta rechazar bypasses reales.
- Mantener la auditoría persistente fuera de R2 y diseñarla en R3.

## Consecuencias positivas

- React deja de ser la autoridad sobre permisos.
- Un plan no puede cambiar entre aprobación y ejecución.
- Repeticiones y dobles clics no duplican grants ni efectos.
- Cerrar Alice revoca todo sin depender de limpieza posterior.
- La futura integración sensorial parte de una frontera comprobable.

## Costos y límites

- Cada adaptador necesita una fase de preparación que produzca una previsualización segura.
- Los comandos actuales deben migrarse sin romper formatos ni datos.
- R2 todavía no ofrece auditoría persistente ni automatización.
- La disponibilidad real de cámara y micrófono no autoriza su uso fuera de una sesión aprobada.

## Alternativas descartadas

### Confiar únicamente en botones React

Se descarta porque la interfaz puede desincronizarse del backend y no protege invocaciones directas.

### Guardar permisos para siempre

Se descarta porque amplía silenciosamente el alcance y contradice la revocación predeterminada.

### Enviar otra vez los parámetros al ejecutar

Se descarta porque permitiría aprobar una previsualización y ejecutar otra operación distinta.

### Activar cámara y micrófono directamente tras la autorización conversacional

Se descarta porque una autorización de desarrollo no sustituye una decisión visible por sesión dentro del producto.

## Evidencia requerida

- contrato de datos y transiciones implementado en Rust;
- pruebas de aprobación, rechazo, cancelación, vencimiento, revocación y duplicados;
- comprobación de que modificar el plan invalida el digest;
- primera migración real de `context.foreground.control` sin bypass;
- interfaz accesible con previsualización y control Detener;
- pruebas completas sin cambios en memoria o avatar.
