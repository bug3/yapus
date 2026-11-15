import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectDirectory } from '../../../shared/hooks-path/get-project-directory.ts';
import { DEFAULT_LANGUAGE, type Language } from '../language/languages.ts';
import { getGoWorkflow } from './go/get-go-workflow.ts';
import { getGolangciConfig } from './go/get-golangci-config.ts';
import { getWorkflow } from './typescript/get-workflow.ts';
import { getWrapperEslintConfig } from './typescript/get-wrapper-eslint-config.ts';
import { getWrapperTsconfig } from './typescript/get-wrapper-tsconfig.ts';

// A file the project installer writes; target is relative to the adopter's
// repository root. An owned file is rewritten on every upgrade, a wrapper
// is written once and left to the adopter.
export interface Template {
  readonly target: string;
  readonly kind: 'owned' | 'wrapper';
  readonly text: string;
}

// One reader per language; the Record type makes a missing language a
// compile error.
const READERS: Readonly<Record<Language, () => readonly Template[]>> = {
  typescript: readTypescriptTemplates,
  go: readGoTemplates,
};

export function readTemplates(language: Language = DEFAULT_LANGUAGE): readonly Template[] {
  return READERS[language]();
}

function readGoTemplates(): readonly Template[] {
  return [
    { target: '.golangci.yml', kind: 'owned', text: getGolangciConfig() },
    { target: '.github/workflows/yapus.yml', kind: 'owned', text: getGoWorkflow() },
  ];
}

// The base files are read from this code's own location.
function readTypescriptTemplates(): readonly Template[] {
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
  return readFileSync(join(import.meta.dirname, 'typescript', name), 'utf8');
}
