export function toCamelCase(kebabName: string): string {
  return kebabName.replace(/-[a-z0-9]/g, (match) => match.charAt(1).toUpperCase());
}
