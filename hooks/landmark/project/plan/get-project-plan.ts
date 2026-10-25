import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Template } from '../files/read-templates.ts';
import { getGitignoreText } from './get-gitignore-text.ts';
import { getRefusals } from './get-refusals.ts';
import { getRootRefusal } from './get-root-refusal.ts';
import { getScopes } from './get-scopes.ts';

export interface ProjectPlan {
  readonly mode: 'install' | 'upgrade';
  readonly writes: readonly { readonly target: string; readonly text: string }[];
  readonly removals: readonly string[];
  readonly created: readonly string[];
  readonly changed: readonly string[];
}

export type PlanResult = { readonly plan: ProjectPlan } | { readonly refusals: readonly string[] };

export const STAMP = '.landmark/version';

export const PACKAGE = 'package.json';

const SCOPES = '.landmark/scopes.json';
const GITIGNORE = '.gitignore';
const LEGACY_LINT_FILES: readonly string[] = [
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.mts',
  'eslint.config.cts',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintignore',
];

// What the project installer will do in root, or why it refuses. Reads only;
// the stamp and package.json are touched by the installer but not in writes.
export function getProjectPlan(
  root: string,
  templates: readonly Template[],
  env: NodeJS.ProcessEnv,
): PlanResult {
  const mode = existsSync(join(root, STAMP)) ? 'upgrade' : 'install';
  const isInstall = mode === 'install';
  const removals = isInstall ? LEGACY_LINT_FILES.filter((name) => hasPath(root, name)) : [];
  const rootRefusal = getRootRefusal(root, env);

  if (rootRefusal !== undefined) {
    return { refusals: [rootRefusal] };
  }

  const writes = [
    ...templates
      .filter(({ kind }) => isInstall || kind === 'owned')
      .map(({ target, text }) => ({ target, text })),
    ...isInstall && !hasPath(root, SCOPES) ? [{ target: SCOPES, text: getScopes(root, env) }] : [],
    ...isInstall ? getGitignoreWrites(root) : [],
  ];
  const touched = [...writes.map(({ target }) => target), ...removals, PACKAGE, STAMP];
  const refusals = getRefusals(root, touched, env);

  if (refusals.length > 0) {
    return { refusals };
  }

  return {
    plan: {
      mode,
      writes,
      removals,
      created: touched.filter((path) => !hasPath(root, path)),
      changed: touched.filter((path) => hasPath(root, path)),
    },
  };
}

function hasPath(root: string, path: string): boolean {
  return existsSync(join(root, path));
}

function getGitignoreWrites(root: string): { target: string; text: string }[] {
  const text = getGitignoreText(root);

  return text === undefined ? [] : [{ target: GITIGNORE, text }];
}
