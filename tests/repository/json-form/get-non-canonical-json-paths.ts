import { join } from 'node:path';
import { listFiles } from '../../helpers/list-files.ts';
import { readUtf8 } from '../../helpers/read-utf8.ts';
import { isCanonicalJson } from './is-canonical-json.ts';

// Every JSON file under root that is not in the D2 form, a file that is not
// UTF-8 among them.
export function getNonCanonicalJsonPaths(root: string): string[] {
  return listFiles(root, '.json').filter((path) => !isCanonicalJsonFile(join(root, path)));
}

function isCanonicalJsonFile(path: string): boolean {
  const text = readUtf8(path);

  return text !== undefined && isCanonicalJson(text);
}
