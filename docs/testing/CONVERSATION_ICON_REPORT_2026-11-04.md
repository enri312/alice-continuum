# Icono de Conversación — 2026-11-04

Se actualiza la escena SVG existente para representar conversación con texto,
voz filtrada y vistas opcionales. Se mantiene el chasis industrial, la paleta
cian/violeta, el segundo mensaje con onda vocal y la accesibilidad de la familia.
Se retira el interruptor de revisión por turno. El icono no es un indicador de
captura activa ni de identificación del propietario.

La fuente permanece en `scripts/icons/scenes/cognitive-conversation-channel.mjs`;
el SVG generado es `icons/cognitive-conversation-channel.svg`. Se actualizan sus
acabados de componentes y el contrato de navegación. La generación por nombre
permite conservar intactos los demás SVG; una comparación SHA-256 confirmó que
sólo cambió este icono.

- 172 comprobaciones existentes del sistema de iconos aprobadas.
- `npm run build`: TypeScript y Vite 8.3.5 aprobados; aviso previo de tamaño de chunks.
- Comparación visual con el anterior y lectura a 58 × 54 píxeles junto a Volumen.
- La ruta interna, los permisos y las funciones de Conversación se conservan.

Evidencia local en `artifacts/conversation-icon-2026-11-04/`.
Contrato: [ADR-P-098 actualizado](../decisions/ADR-P-098-inicio-centrado-en-conversacion.md).
