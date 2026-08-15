# Informe R6.2-C — Presupuesto saliente e iconos diagnósticos

Fecha: 2026-08-14  
Resultado: aprobado

## Presupuesto real antes del envío

La revisión obligatoria de Conversación muestra, a partir de la misma cadena que se entrega a Rust:

- mensaje actual;
- historial reciente autorizado;
- recuerdos relevantes autorizados;
- ventana actual autorizada;
- separadores entre secciones;
- total exacto.

Cada fila informa caracteres Unicode y bytes UTF-8. Un fragmento opcional desmarcado o no disponible registra cero y se identifica como `NO AUTORIZADO`. No se calcula un token ficticio: el límite de 1.200 tokens corresponde a la respuesta y sigue siendo aplicado por el adaptador nativo.

Las pruebas incluyen texto con tilde y emoji para demostrar que bytes y caracteres no se equiparan indebidamente. También verifican que la suma de fragmentos y separadores sea exactamente igual al payload final.

## Actividad frente a Auditoría y diagnóstico

La navegación reutilizaba `nav-activity.svg` para ambas pantallas. Se creó `nav-audit.svg`, se añadió un tipo `audit` propio y se reconstruyó también `nav-activity.svg` desde la fuente reproducible del sistema.

- **Actividad:** tres carriles temporales, pulsos y ventana R3 verde/cian.
- **Auditoría y diagnóstico:** expediente, lente, huella SHA-256 y sello de integridad coral/azul.

Los SVG son locales, autónomos, accesibles y distintos. `icons/app-alice.svg` quedó intacto con SHA-256 `91412F987203DA9B0191E3CC2F3CED85CFD7781F12AF74FE8113280F499BFF5D`.

## Puertas

| Puerta | Resultado |
|---|---|
| Pruebas focalizadas | 79 aprobadas |
| `npm test` | 235/235 aprobadas |
| `npm run build` | aprobado |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets -- -D warnings` | aprobado |
| `cargo test` | 169 aprobadas; 10 sondas ambientales ignoradas |
| `cargo build` | aprobado |

La revisión visual rasterizó ambos SVG reales con Microsoft Edge. El aviso de Vite sobre chunks mayores a 500 kB continúa siendo informativo y no fue ocultado.
