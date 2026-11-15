const maximumExpressionNameLength = 96;

/**
 * Conserva únicamente los nombres que el VRM ya declaró. No crea presets,
 * pesos ni una salida para el avatar.
 */
export function catalogAvatarExpressions(values: readonly string[]): string[] {
  const catalog: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (/[\u0000-\u001f\u007f]/.test(value)) continue;
    const name = value.trim();
    if (!name || name.length > maximumExpressionNameLength || seen.has(name)) continue;
    seen.add(name);
    catalog.push(name);
  }
  return catalog;
}
