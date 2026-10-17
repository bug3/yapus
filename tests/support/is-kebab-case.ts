const KEBAB_SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// A file name without its extension, such as get-dash-lines.test or
// eslint.config: every dot-separated segment is kebab-case.
export function isKebabCase(fileName: string): boolean {
  return fileName.split('.').every((segment) => KEBAB_SEGMENT.test(segment));
}
