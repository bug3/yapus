import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isRecord } from '../is-record.ts';
import { readCatalog, type CatalogViolation } from '../read-catalog.ts';

// How a label is named: the prefix of the labels derived from the types and the
// scopes, and the label of a breaking change.
export const labelNames = {
  typePrefix: 'type: ',
  scopePrefix: 'scope: ',
  breaking: 'breaking-change',
} as const;

export interface Label {
  readonly name: string;
  readonly color: string;
  readonly description: string;
}

interface Style {
  readonly color: string;
  readonly description: string;
}

const COLOR = /^[0-9a-f]{6}$/;
// GitHub cuts a description at 100 characters.
const MAX_DESCRIPTION = 100;

// Every label of the repository: one per type, one per scope, and the extras of
// `labels.json`, all read from the catalogs in `directory`.
export async function readLabels(directory: string): Promise<readonly Label[] | CatalogViolation> {
  const path = join(directory, 'labels.json');
  const [types, scopes, text] = await Promise.all([
    readCatalog(join(directory, 'types.json'), 'type'),
    readCatalog(join(directory, 'scopes.json'), 'scope'),
    readFile(path, 'utf8').catch(() => undefined),
  ]);
  const style = text === undefined ? undefined : parseStyle(text);

  if ('violation' in types) {
    return types;
  }

  if ('violation' in scopes) {
    return scopes;
  }

  if (style === undefined) {
    return { violation: `${ path } is missing or not a label catalog; blocked until it is fixed` };
  }

  return [
    ...types.words.map((word) => ({ name: `${ labelNames.typePrefix }${ word }`, ...style.type })),
    ...scopes.words.map((word) => ({
      name: `${ labelNames.scopePrefix }${ word }`,
      ...style.scope,
    })),
    ...style.extras,
  ];
}

interface Styles {
  readonly type: Style;
  readonly scope: Style;
  readonly extras: readonly Label[];
}

function parseStyle(text: string): Styles | undefined {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.extras)) {
    return undefined;
  }

  const { type, scope } = parsed;
  const extras: unknown[] = parsed.extras;

  return isStyle(type) && isStyle(scope) && extras.every(isLabel)
    ? { type, scope, extras }
    : undefined;
}

function isStyle(value: unknown): value is Style {
  return isRecord(value)
    && typeof value.color === 'string' && COLOR.test(value.color)
    && typeof value.description === 'string'
    && value.description.length <= MAX_DESCRIPTION;
}

function isLabel(value: unknown): value is Label {
  return isStyle(value) && isRecord(value) && typeof value.name === 'string'
    && value.name !== '' && !value.name.includes(',');
}
