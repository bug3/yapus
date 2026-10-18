import { join } from 'node:path';
import { getDashLines } from '../../../hooks/claude/dashes/findings/get-dash-lines.ts';
import { isMarkdown } from '../../../hooks/claude/dashes/findings/is-markdown.ts';
import { listFiles } from '../../helpers/list-files.ts';
import { readUtf8 } from '../../helpers/read-utf8.ts';

// Every line of a markdown file under root that holds a dash other than the
// ASCII hyphen, as path:line, the hook's own dash list and markdown scope; a
// markdown file that is not UTF-8 text is named as path: not UTF-8 text,
// since its dashes cannot be read.
export function getMarkdownDashLocations(root: string): string[] {
  return listFiles(root, '')
    .filter(isMarkdown)
    .flatMap((path) => getDashLocations(root, path));
}

function getDashLocations(root: string, path: string): string[] {
  const text = readUtf8(join(root, path));

  if (text === undefined) {
    return [`${ path }: not UTF-8 text`];
  }

  return getDashLines(text).map(({ line }) => `${ path }:${ String(line) }`);
}
