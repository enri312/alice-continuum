type InlineSvgIconProps = {
  markup: string;
  className: string;
};

// El contenido procede exclusivamente de los SVG versionados en icons/ y se
// integra durante la compilación; nunca se acepta marcado proporcionado por el usuario.
export function InlineSvgIcon({ markup, className }: InlineSvgIconProps) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />;
}
