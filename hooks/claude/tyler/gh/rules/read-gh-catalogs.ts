import { join } from 'node:path';
import { readLabels, type Label } from '../../../../shared/labels/read-labels.ts';
import {
  readCatalog,
  type Catalog,
  type CatalogViolation,
} from '../../../../shared/read-catalog.ts';

export const CATALOGS_DIRECTORY = join(
  import.meta.dirname, '..', '..', '..', '..', 'shared', 'catalogs',
);

// The catalogs a title and the labels are judged by.
export interface GhCatalogs {
  readonly types: Catalog;
  readonly scopes: Catalog;
  readonly verbs: Catalog;
  readonly labels: readonly Label[];
}

// The catalogs in `directory`, or the first one that cannot be read.
export async function readGhCatalogs(directory: string): Promise<GhCatalogs | CatalogViolation> {
  const [types, scopes, verbs, labels] = await Promise.all([
    readCatalog(join(directory, 'types.json'), 'type'),
    readCatalog(join(directory, 'scopes.json'), 'scope'),
    readCatalog(join(directory, 'verbs.json'), 'verb'),
    readLabels(directory),
  ]);

  if ('violation' in types) {
    return types;
  }

  if ('violation' in scopes) {
    return scopes;
  }

  if ('violation' in verbs) {
    return verbs;
  }

  return 'violation' in labels ? labels : { types, scopes, verbs, labels };
}
