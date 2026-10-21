import type { Catalog } from './read-catalog.ts';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 50;

// The reason a branch name is not `<type>/<slug>`, or undefined: the type from
// the types catalog, the slug lowercase letters, digits and single hyphens.
export function getBranchNameViolation(name: string, types: Catalog): string | undefined {
  const [type = '', slug = '', ...rest] = name.split('/');
  const isNamed = rest.length === 0
    && types.words.includes(type)
    && SLUG.test(slug)
    && slug.length <= MAX_SLUG_LENGTH;

  return isNamed
    ? undefined
    : `branch \`${ name }\` is not \`<type>/<slug>\` (type from ${ types.path }, slug of `
      + `lowercase letters, digits and hyphens, at most ${ String(MAX_SLUG_LENGTH) }); name it so`;
}
