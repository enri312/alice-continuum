# Componentes de iconos

Estos componentes presentan los SVG versionados en la carpeta `icons/` de la
raíz. El contenido SVG se carga durante la compilación desde archivos del
proyecto; no se acepta marcado del usuario.

- `NavigationIcon.tsx`: iconos de las pestañas principales de `App.tsx`.
- `InlineSvgIcon.tsx`: envoltorio común utilizado también por los controles de
  cámara del Volumen cognitivo.
- `BridgeViewIcon.tsx`: iconos de la variante con pestañas del registro de
  capacidades; se conserva para esa variante aunque la navegación actual use
  vistas fijadas.

El selector antiguo `NucleusViewIcon.tsx` se retiró al no tener importadores;
su contenido sigue en el historial Git y en la copia local de recuperación.
La [revisión de organización](../../../docs/architecture/REORGANIZACION_2026-11-14.md)
documenta los cambios y límites de limpieza.
