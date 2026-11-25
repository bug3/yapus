export function toCamelCase(fileName: string): string {
  return fileName.replace(/-[a-z0-9]/g, (match) => match.charAt(1).toUpperCase());
}
