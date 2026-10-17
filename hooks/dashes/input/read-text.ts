import { readFile } from 'node:fs/promises';

// A file that cannot be read is absent to the caller, which then names the
// line within new_string instead of a file line.
export async function readText(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
}
