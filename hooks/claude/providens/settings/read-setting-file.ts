import { existsSync, readFileSync } from 'node:fs';

export type SettingFile<T> =
  | { readonly kind: 'value'; readonly value: T }
  | { readonly kind: 'missing' }
  | { readonly kind: 'invalid' };

// Reads a setting the person wrote in a file: missing when there is no file,
// invalid when parse finds nothing in its trimmed text. A file that exists but
// cannot be read throws.
export function readSettingFile<T>(
  path: string,
  parse: (text: string) => T | undefined,
): SettingFile<T> {
  if (!existsSync(path)) {
    return { kind: 'missing' };
  }

  const parsed = parse(readFileSync(path, 'utf8').trim());

  return parsed === undefined ? { kind: 'invalid' } : { kind: 'value', value: parsed };
}
