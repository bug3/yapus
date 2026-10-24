import type { Catalog } from '../read-catalog.ts';
import { readSubjectParts } from './read-subject-parts.ts';

// git's autosquash prefixes, which may stack.
const AUTOSQUASH_PREFIXES = /^(?:(?:fixup|squash|amend)! )*/;
const MAX_LENGTH = 72;
const CHARACTERS = new Intl.Segmenter();

export interface Catalogs {
  readonly types: Catalog;
  // Undefined: any scope of the word form passes.
  readonly scopes: Catalog | undefined;
  readonly verbs: Catalog;
}

export interface SubjectOptions {
  // A commit may start with git's autosquash prefixes; a pull request title may not.
  readonly allowAutosquash: boolean;
}

const COMMIT_OPTIONS: SubjectOptions = { allowAutosquash: true };

export function getSubjectViolations(
  subject: string,
  catalogs: Catalogs,
  options: SubjectOptions = COMMIT_OPTIONS,
): string[] {
  return [
    ...getLengthViolations(subject),
    ...getFormViolations(subject, catalogs, options),
  ];
}

// The whole first line, as tools show it: in characters, not UTF-16 units.
function getLengthViolations(subject: string): string[] {
  const { length } = Array.from(CHARACTERS.segment(subject));

  return length > MAX_LENGTH
    ? [`the subject is ${ String(length) } characters; keep it at most ${ String(MAX_LENGTH) }`]
    : [];
}

function getFormViolations(
  subject: string,
  catalogs: Catalogs,
  options: SubjectOptions,
): string[] {
  const judged = options.allowAutosquash ? subject.replace(AUTOSQUASH_PREFIXES, '') : subject;
  const parts = readSubjectParts(judged);

  if (parts === undefined) {
    return [
      `${ JSON.stringify(subject) } is not in the form "type(scope): verb ...", such as "feat(hooks): add a check"; rewrite the subject`,
    ];
  }

  return [
    ...getUnknownWordViolations('type', parts.type, catalogs.types),
    ...(catalogs.scopes === undefined
      ? []
      : getUnknownWordViolations('scope', parts.scope, catalogs.scopes)),
    ...getUnknownWordViolations('verb', parts.verb, catalogs.verbs),
  ];
}

function getUnknownWordViolations(
  partName: string,
  word: string,
  { path, words }: Catalog,
): string[] {
  return words.includes(word)
    ? []
    : [`${ partName } "${ word }" is not in ${ path }; use a listed one`];
}
