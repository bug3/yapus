import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectDirectory } from './get-project-directory.ts';
import { getWorkflow } from './get-workflow.ts';
import { getWrapperEslintConfig } from './get-wrapper-eslint-config.ts';
import { getWrapperTsconfig } from './get-wrapper-tsconfig.ts';

// A file the project installer writes; target is relative to the adopter's
// repository root. An owned file is rewritten on every upgrade, a wrapper
// is written once and left to the adopter.
export interface Template {
  readonly target: string;
  readonly kind: 'owned' | 'wrapper';
  readonly text: string;
}

// The base files are read from this code's own location.
export function readTemplates(): readonly Template[] {
  return [
    {
      target: `${ getProjectDirectory() }/eslint.config.ts`,
      kind: 'owned',
      text: readBase('eslint.config.ts'),
    },
    {
      target: `${ getProjectDirectory() }/tsconfig.json`,
      kind: 'owned',
      text: readBase('tsconfig.json'),
    },
    { target: '.github/workflows/yapus.yml', kind: 'owned', text: getWorkflow() },
    { target: 'eslint.config.ts', kind: 'wrapper', text: getWrapperEslintConfig() },
    { target: 'tsconfig.json', kind: 'wrapper', text: getWrapperTsconfig() },
  ];
}

function readBase(name: string): string {
  return readFileSync(join(import.meta.dirname, name), 'utf8');
}
