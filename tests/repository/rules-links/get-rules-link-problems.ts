import { lstatSync, readdirSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { readUtf8 } from '../../helpers/read-utf8.ts';

const STANDARDS_DIR = 'standards';
const RULES_DIR = join('.claude', 'rules');
const FRONT_MATTER_START = '---\n';

// Every standard with a `paths:` front matter that `.claude/rules` does not
// link under its lowercase name, which Claude Code needs to load it for the
// paths it names; a standard without front matter loads another way.
export function getRulesLinkProblems(root: string): string[] {
  const links = readdirSync(join(root, RULES_DIR));

  return readdirSync(join(root, STANDARDS_DIR))
    .filter((name) => name.endsWith('.md') && hasFrontMatter(join(root, STANDARDS_DIR, name)))
    .flatMap((name) => getLinkProblems(root, links, name));
}

function hasFrontMatter(path: string): boolean {
  return readUtf8(path)?.startsWith(FRONT_MATTER_START) ?? false;
}

function getLinkProblems(root: string, links: readonly string[], name: string): string[] {
  const link = join(RULES_DIR, name.toLowerCase());
  const target = join('..', '..', STANDARDS_DIR, name);

  if (!links.includes(name.toLowerCase())) {
    return [`${ link }: missing; link it to ${ target }`];
  }

  const isLinkToTarget = lstatSync(join(root, link)).isSymbolicLink()
    && readlinkSync(join(root, link)) === target;

  return isLinkToTarget ? [] : [`${ link }: is not a symlink to ${ target }`];
}
