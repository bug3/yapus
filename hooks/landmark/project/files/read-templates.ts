import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { workflow } from './workflow.ts';
import { wrapperEslintConfig } from './wrapper-eslint-config.ts';
import { wrapperTsconfig } from './wrapper-tsconfig.ts';

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
    { target: '.landmark/eslint.config.ts', kind: 'owned', text: readBase('eslint.config.ts') },
    { target: '.landmark/tsconfig.json', kind: 'owned', text: readBase('tsconfig.json') },
    { target: '.github/workflows/landmark.yml', kind: 'owned', text: workflow() },
    { target: 'eslint.config.ts', kind: 'wrapper', text: wrapperEslintConfig() },
    { target: 'tsconfig.json', kind: 'wrapper', text: wrapperTsconfig() },
  ];
}

function readBase(name: string): string {
  return readFileSync(join(import.meta.dirname, name), 'utf8');
}
