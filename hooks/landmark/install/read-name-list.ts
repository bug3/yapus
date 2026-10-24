import { readFileSync } from 'node:fs';

// The strings of the JSON array at path; throws when it is anything else.
export function readNameList(path: string): string[] {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));

  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error(`${ path } is not an array of strings`);
  }

  return parsed.map(String);
}
