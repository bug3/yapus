import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { listFiles } from '../../helpers/list-files.ts';
import { readUtf8 } from '../../helpers/read-utf8.ts';

const ROOT_INSTRUCTIONS = 'CLAUDE.md';
const RULES_DIR = '.claude/rules/';
const STANDARDS = 'standards/';
// Claude Code follows an import up to four hops from CLAUDE.md.
const MAX_HOPS = 4;
const RULE_HEADING = /^## ([A-Z]+-\d+)\. /;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const FENCED_BLOCK = /^```[\s\S]*?^```$/gm;
const CODE_SPAN = /`[^`\n]*`/g;
// `@path` at a line start or after whitespace; the path runs to the next space.
const IMPORT = /(?:^|\s)@(\S+)/g;
const PATHS_HEAD = '---\npaths:\n';

export interface AlwaysLoaded {
  // In load order, CLAUDE.md first, relative to root.
  readonly files: string[];
  // "<file> imports <target>" for every target that is not on disk.
  readonly missing: string[];
}

// The files Claude Code loads in every session: CLAUDE.md with what it
// imports, to four hops, and every rule file that has no paths head.
export function getAlwaysLoaded(root: string): AlwaysLoaded {
  const files: string[] = [];
  const missing: string[] = [];
  let frontier = existsSync(join(root, ROOT_INSTRUCTIONS)) ? [ROOT_INSTRUCTIONS] : [];

  for (let hop = 0; hop <= MAX_HOPS && frontier.length > 0; hop += 1) {
    files.push(...frontier);

    const imports = frontier.flatMap((file) => getImports(root, file));
    const found = imports.filter((entry) => entry.exists);

    missing.push(...imports.filter((entry) => !entry.exists).map(describeMissing));
    frontier = unique(found.map((entry) => entry.target))
      .filter((target) => !files.includes(target));
  }

  return { files: [...files, ...getUnscopedRuleFiles(root)], missing };
}

// The rule ids of every always-loaded file, in load order.
export function getAlwaysLoadedRules(root: string): string[] {
  return getAlwaysLoaded(root).files.flatMap((file) => getRuleIds(root, file));
}

// The always-loaded files that carry a paths head, which Claude Code would
// load at launch all the same.
export function getImportedPathsFiles(root: string): string[] {
  return getAlwaysLoaded(root).files.filter((file) => hasPathsHead(root, file));
}

// Every rule id that more than one standard or always-loaded file holds.
export function getDuplicateRuleIds(root: string): string[] {
  const standards = listFiles(root, '.md').filter((path) => path.startsWith(STANDARDS));
  const ids = unique([...getAlwaysLoaded(root).files, ...standards])
    .flatMap((file) => getRuleIds(root, file));

  return unique(ids.filter((id, index) => ids.indexOf(id) !== index));
}

interface Import {
  readonly file: string;
  readonly target: string;
  readonly exists: boolean;
}

function getImports(root: string, file: string): Import[] {
  // Fenced blocks go first: their fences would read as empty code spans.
  const text = stripNonInstructions(readUtf8(join(root, file)) ?? '').replace(CODE_SPAN, '');

  return [...text.matchAll(IMPORT)].map(([, path]) => {
    const target = join(dirname(file), path ?? '');

    return { file, target, exists: existsSync(join(root, target)) };
  });
}

function describeMissing(entry: Import): string {
  return `${ entry.file } imports ${ entry.target }`;
}

function getUnscopedRuleFiles(root: string): string[] {
  return listFiles(root, '.md')
    .filter((path) => path.startsWith(RULES_DIR))
    .filter((path) => !hasPathsHead(root, path));
}

function getRuleIds(root: string, file: string): string[] {
  return stripNonInstructions(readUtf8(join(root, file)) ?? '')
    .split('\n')
    .flatMap((line) => {
      const id = RULE_HEADING.exec(line)?.[1];

      return id === undefined ? [] : [id];
    });
}

function hasPathsHead(root: string, file: string): boolean {
  return (readUtf8(join(root, file)) ?? '').startsWith(PATHS_HEAD);
}

// Claude Code strips HTML comments before it injects a file; text in a fenced
// block is shown, not followed.
function stripNonInstructions(text: string): string {
  return text.replace(HTML_COMMENT, '').replace(FENCED_BLOCK, '');
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
