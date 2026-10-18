import type { Catalog } from './read-catalog.ts';

// git's autosquash prefixes, which may stack.
const AUTOSQUASH_PREFIXES = /^(?:(?:fixup|squash|amend)! )*/;
const FORM = /^([a-z]+)\(([a-z0-9-]+)\): ([a-z]+)(?: .+)?$/;

export interface Catalogs {
  readonly types: Catalog;
  readonly scopes: Catalog;
  readonly verbs: Catalog;
}

export function getViolations(subject: string, catalogs: Catalogs): string[] {
  const [, type, scope, verb] = FORM.exec(subject.replace(AUTOSQUASH_PREFIXES, '')) ?? [];
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
