import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDashLines } from '../../hooks/dashes/get-dash-lines.ts';
import { isMarkdown } from '../../hooks/dashes/is-markdown.ts';
import { listFiles } from './list-files.ts';

// Every line of a markdown file under root that holds a dash other than the
// ASCII hyphen, as path:line, the hook's own dash list and markdown scope.
export function getMarkdownDashLocations(root: string): string[] {
  return listFiles(root, '')
    .filter(isMarkdown)
    .flatMap((path) => getDashLines(readFileSync(join(root, path), 'utf8'))
      .map(({ line }) => `${ path }:${ String(line) }`));
}
