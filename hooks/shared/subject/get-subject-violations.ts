import { partForms } from '../part-forms.ts';
import type { Catalog } from '../read-catalog.ts';

// git's autosquash prefixes, which may stack.
const AUTOSQUASH_PREFIXES = /^(?:(?:fixup|squash|amend)! )*/;
// An optional `!` before the colon marks a breaking change.
const FORM = new RegExp(
  `^(${ partForms.type })\\((${ partForms.scope })\\)!?: (${ partForms.verb })(?: .+)?$`,
);
const MAX_LENGTH = 72;
const CHARACTERS = new Intl.Segmenter();

export interface Catalogs {
  readonly types: Catalog;
  readonly scopes: Catalog;
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
  const [, type, scope, verb] = FORM.exec(judged) ?? [];
  const hasForm = type !== undefined && scope !== undefined && verb !== undefined;

  if (!hasForm) {
    return [
      `${ JSON.stringify(subject) } is not in the form "type(scope): verb ...", such as "feat(hooks): add a check"; rewrite the subject`,
    ];
  }

  return [
    ...getUnknownWordViolations('type', type, catalogs.types),
    ...getUnknownWordViolations('scope', scope, catalogs.scopes),
    ...getUnknownWordViolations('verb', verb, catalogs.verbs),
  ];
}

function getUnknownWordViolations(
  partName: string,
  word: string,
  { path, words }: Catalog,
): string[] {
  return words.includes(word)
    ? []
    : [`${ partName } "${ word }" is not in ${ path }; use a listed one or add it there`];
}
