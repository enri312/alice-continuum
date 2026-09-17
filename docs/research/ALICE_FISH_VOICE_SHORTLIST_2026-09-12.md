# Terna inicial de voces públicas para Alice

Fecha de consulta: 2026-09-12  
Estado: candidatas de audición; ninguna voz fue adoptada, sintetizada ni enviada a
Alice.

## Regla de selección

La terna se deriva de [la identidad de voz de Alice](../architecture/ALICE_VOICE_IDENTITY_R9.md):
femenino, español latino neutro, joven-adulto, claro, sereno y técnico-cercano.
Se excluyeron imitaciones de personajes, voces sensuales, infantiles, comerciales
o de regionalismo fuerte. Que una ficha pública use una etiqueta no prueba el
resultado: la selección final depende de una audición humana con el mismo texto.

## Candidatas

| Orden de audición | Voz pública | `reference_id` | Motivo | Riesgo a comprobar |
|---|---|---|---|---|
| 1 — principal | [Mujer Voz](https://fish.audio/es/m/3cd43259940f417bad9e7ad63a2f6ed3/) | `3cd43259940f417bad9e7ad63a2f6ed3` | Fish la describe como femenina joven-profesional, suave y clara, con ritmo medido y español latino neutro; coincide directamente con el perfil de Alice. | Puede sonar demasiado institucional o narrativa en diálogo corto. |
| 2 — contraste cálido | [Mujer latina](https://fish.audio/es/m/13d17017d63340a0b9751ffb04561c8d/) | `13d17017d63340a0b9751ffb04561c8d` | Su ficha la ubica como suave, profesional, clara, tranquila, amigable y educativa en español. Sirve para contrastar si Alice necesita más calidez. | Puede percibirse más madura o como narradora que la presencia visual del VRM. |
| 3 — contraste ligero | [YO](https://fish.audio/m/21f49a79a6894173b4fe294c56dad2c1/) | `21f49a79a6894173b4fe294c56dad2c1` | Declara voz femenina joven, calma y español latino neutro; prueba el extremo más suave del rango aceptable. | La propia ficha la describe como soplosa; probablemente se descarte si reduce claridad técnica. |

Las páginas son referencias públicas de catálogo, no una garantía de disponibilidad,
derechos permanentes, calidad o idioma efectivo. Se verificará de nuevo antes de
una petición con costo. No se seleccionó ninguna voz de franquicias, personas
identificables ni material aportado por Carlos.

## Hipótesis de elección

**Mujer Voz** es la candidata preferida antes de escucharla. Sólo pasa a ser la
voz de Alice si cumple simultáneamente:

1. mantiene español latino neutro y pronunciación clara en los tres textos de
   prueba;
2. combina serenidad con cercanía, sin timbre infantil, comercial o excesivamente
   dramático;
3. no contradice la presencia visual joven-adulta, sobria y tecnológica del VRM;
4. Carlos la elige al compararla con las otras dos;
5. su uso sigue permitido por los términos y el plan de Fish vigentes.

Si no cumple, se descarta sin conservar el resultado y se abre otra terna. El
`reference_id` de la candidata ganadora recién se almacenará en la configuración
local después de su confirmación explícita; no se guarda como memoria ni se
versiona en Git.

## Procedimiento cuando R9.2 tenga la vista previa implementada

1. Abrir cada ficha y escuchar primero su muestra pública, sin usar la API.
2. En Alice, mostrar la misma frase breve no privada y el identificador de voz.
3. Carlos confirma individualmente la generación de cada muestra.
4. Reproducir el MP3 temporal, marcar `apta` o `descartada` y eliminarlo.
5. Elegir una voz o cerrar la terna sin selección. Ninguna respuesta habitual se
   sintetiza durante esta audición.
