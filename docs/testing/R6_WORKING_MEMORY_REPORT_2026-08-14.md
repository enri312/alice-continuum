# Informe R6.2-A — Memoria de trabajo real

Fecha: 2026-08-14  
Resultado: aprobado

## Alcance comprobado

- almacén Rust dentro del proceso, sin archivo de contenido;
- tres intercambios completos, seis mensajes y 48.000 caracteres;
- TTL de 30 minutos en producción;
- expiración demostrada con tiempo transcurrido real en una instancia de prueba;
- desalojo del intercambio completo más antiguo;
- rechazo de intercambio sobredimensionado sin almacenamiento parcial;
- bloqueo de vaciado con generación obsoleta;
- registro únicamente después de una respuesta satisfactoria del proveedor;
- auditoría R3 con SHA-256, sin preguntas ni respuestas;
- conversación integrada en `[00]` y ruta duplicada eliminada.

## Puertas ejecutadas

| Puerta | Resultado |
|---|---|
| `npm test` | 27 archivos, 228/228 pruebas aprobadas |
| `npm run build` | TypeScript y Vite aprobados; 119 módulos transformados |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets -- -D warnings` | aprobado |
| `cargo test` | 169 aprobadas, 10 sondas ignoradas por requerir entorno autorizado |
| `cargo build` | aprobado |

Las pruebas de RAM crean un directorio temporal controlado, comparan su contenido antes y después y comprueban cero archivos adicionales. No se envió una solicitud facturable ni se inventó una respuesta de proveedor para presentarla como prueba viva.

## Pendiente deliberado

R6.2-B expondrá en Memoria el contador, el vencimiento y el vaciado confirmado. La consolidación, el análisis automático de proyectos y la promoción a recuerdos continúan fuera de este incremento.
