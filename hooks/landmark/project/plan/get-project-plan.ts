import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectDirectory } from '../../../shared/hooks-path/get-project-directory.ts';
import type { Template } from '../files/read-templates.ts';
import type { Language } from '../language/languages.ts';
import { getGitignoreText } from './get-gitignore-text.ts';
import { getRefusals } from './get-refusals.ts';
import { getRootRefusal } from './get-root-refusal.ts';
import { getScopes } from './get-scopes.ts';

export interface ProjectPlan {
  readonly mode: 'install' | 'upgrade';
  readonly writes: readonly FileWrite[];
  readonly removals: readonly string[];
  readonly created: readonly string[];
  readonly changed: readonly string[];
}

interface FileWrite {
  readonly target: string;
  readonly text: string;
}

export type PlanResult = { readonly plan: ProjectPlan } | { readonly refusals: readonly string[] };

export const STAMP = `${ getProjectDirectory() }/version`;

export const PACKAGE = 'package.json';

export const LANGUAGE_RECORD = `${ getProjectDirectory() }/language`;

const SCOPES = `${ getProjectDirectory() }/scopes.json`;
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
const GOLANGCI_FILES: readonly string[] = ['.golangci.yaml', '.golangci.toml', '.golangci.json'];
const INSTALL_REMOVALS: Readonly<Record<Language, readonly string[]>> = {
  typescript: LEGACY_LINT_FILES,
  go: GOLANGCI_FILES,
};
// Only a TypeScript run touches package.json and .gitignore.
const PACKAGE_PATHS: Readonly<Record<Language, readonly string[]>> = {
  typescript: [PACKAGE],
  go: [],
};
const GITIGNORE_WRITES: Readonly<Record<Language, (root: string) => readonly FileWrite[]>> = {
  typescript: getGitignoreWrites,
  go: () => [],
};

interface PlanInput {
  readonly templates: readonly Template[];
  readonly language: Language;
}

// What the project installer will do in root for a TypeScript repository, or
// why it refuses. Reads only; the stamp and package.json are touched by the
// installer but not in writes.
export function getProjectPlan(
  root: string,
  templates: readonly Template[],
  env: NodeJS.ProcessEnv,
): PlanResult {
  return getPlan(root, env, { templates, language: 'typescript' });
}

// The same for a Go repository: no package.json, no .gitignore line.
export function getGoProjectPlan(
  root: string,
  templates: readonly Template[],
  env: NodeJS.ProcessEnv,
): PlanResult {
  return getPlan(root, env, { templates, language: 'go' });
}

function getPlan(root: string, env: NodeJS.ProcessEnv, input: PlanInput): PlanResult {
  const { templates, language } = input;
  const mode = existsSync(join(root, STAMP)) ? 'upgrade' : 'install';
  const isInstall = mode === 'install';
  const removals = isInstall
    ? INSTALL_REMOVALS[language].filter((name) => hasPath(root, name))
    : [];
  const rootRefusal = getRootRefusal(root, env);

  if (rootRefusal !== undefined) {
    return { refusals: [rootRefusal] };
  }

  const writes = [
    ...templates
      .filter(({ kind }) => isInstall || kind === 'owned')
      .map(({ target, text }) => ({ target, text })),
    ...isInstall && !hasPath(root, SCOPES) ? [{ target: SCOPES, text: getScopes(root, env) }] : [],
    ...isInstall ? GITIGNORE_WRITES[language](root) : [],
    ...isInstall ? [{ target: LANGUAGE_RECORD, text: `${ language }\n` }] : [],
  ];
  const touched = [
    ...writes.map(({ target }) => target),
    ...removals,
    ...PACKAGE_PATHS[language],
    STAMP,
  ];
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

function getGitignoreWrites(root: string): readonly FileWrite[] {
  const text = getGitignoreText(root);

  return text === undefined ? [] : [{ target: GITIGNORE, text }];
}
