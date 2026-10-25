import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGUAGE_RECORD, STAMP } from '../plan/get-project-plan.ts';
import { DEFAULT_LANGUAGE, type Language, languages } from './languages.ts';

export type LanguageResult = { readonly language: Language } | { readonly refusal: string };

// One check per language: the refusal when the repository lacks what the
// language needs, undefined when it has it. The Record type makes a missing
// language a compile error.
const REQUIREMENTS: Readonly<Record<Language, (root: string) => string | undefined>> = {
  typescript: () => undefined,
  go: (root) => existsSync(join(root, 'go.mod'))
    ? undefined
    : 'go.mod is not at the root; run go mod init first',
};

// The language of the run: an install takes the requested one (TypeScript by
// default), an upgrade takes the recorded one (TypeScript when none is
// recorded) and refuses a different request. Go also needs go.mod at root.
// A record that names no known language is refused: nothing is written.
export function getLanguage(root: string, requested: Language | undefined): LanguageResult {
  const isUpgrade = existsSync(join(root, STAMP));
  const language = isUpgrade ? readRecord(root) : requested ?? DEFAULT_LANGUAGE;

  if (typeof language !== 'string') {
    return language;
  }

  const isConflict = isUpgrade && requested !== undefined && requested !== language;

  if (isConflict) {
    return {
      refusal: `this repository is set up for ${ language }; run /landmark:project ${ language }`,
    };
  }

  const missing = REQUIREMENTS[language](root);

  if (missing !== undefined) {
    return { refusal: missing };
  }

  return { language };
}

function readRecord(root: string): Language | { readonly refusal: string } {
  const path = join(root, LANGUAGE_RECORD);

  if (!existsSync(path)) {
    return DEFAULT_LANGUAGE;
  }

  const text = readFileSync(path, 'utf8').trim();
  const language = languages.find((name) => name === text);

  if (language === undefined) {
    const holds = `${ LANGUAGE_RECORD } holds "${ text }"`;

    return { refusal: `${ holds }, not a language; set it to typescript or go` };
  }

  return language;
}
