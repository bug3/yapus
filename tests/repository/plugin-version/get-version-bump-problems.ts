import { join } from 'node:path';
import { readUtf8 } from '../../helpers/read-utf8.ts';
import { runGit } from '../../helpers/run-git.ts';

const MANIFEST = 'plugins/delegator/.claude-plugin/plugin.json';
const TAG_PREFIX = 'delegator-';
const SHIPPED_PATHS: readonly string[] = ['plugins/delegator', 'hooks'];

// Every way the working tree under root ships a changed delegator under the
// version its latest `delegator-<version>` tag already published; no tag
// means nothing is published yet, so nothing can be stale.
export function getVersionBumpProblems(root: string): string[] {
  const tag = getLatestTag(root);

  if (tag === undefined) {
    return [];
  }

  const isChanged = runGit(['diff', '--name-only', tag, '--', ...SHIPPED_PATHS], root) !== '';
  const isSameVersion = readVersion(root) === tag.slice(TAG_PREFIX.length);

  return isChanged && isSameVersion
    ? [`${ MANIFEST }: the shipped files changed since ${ tag } under the same version`]
    : [];
}

function getLatestTag(root: string): string | undefined {
  const [latest] = runGit(['tag', '--list', `${ TAG_PREFIX }*`, '--sort=-v:refname'], root)
    .split('\n');

  return latest === '' ? undefined : latest;
}

// The manifest's version, or undefined when the file or the field is missing.
function readVersion(root: string): string | undefined {
  const text = readUtf8(join(root, MANIFEST));

  if (text === undefined) {
    return undefined;
  }

  const manifest: unknown = JSON.parse(text);

  return isRecord(manifest) && typeof manifest.version === 'string' ? manifest.version : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
