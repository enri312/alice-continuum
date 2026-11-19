# Componentes de iconos

Estos componentes presentan los SVG versionados en la carpeta `Frontend/icons/` del
proyecto. El contenido SVG se carga durante la compilación desde archivos del
proyecto; no se acepta marcado del usuario.

- Las pestañas principales cargan sus SVG desde `navigation_ui.rs`. La
  implementación anterior está en `src/Legacy/components/icons/NavigationIcon.tsx`.
- `InlineSvgIcon.tsx`: envoltorio común utilizado también por los controles de
  cámara del Volumen cognitivo.
- `governance_ui.rs` presenta los SVG del inventario y de permisos en el
  selector del Núcleo de gobernanza.

El selector antiguo `NucleusViewIcon.tsx` se retiró al no tener importadores;
su contenido sigue en el historial Git y en la copia local de recuperación.
La [revisión de organización](https://github.com/enri312/alice-continuum/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/architecture/REORGANIZACION_2026-11-14.md)
documenta los cambios y límites de limpieza.
