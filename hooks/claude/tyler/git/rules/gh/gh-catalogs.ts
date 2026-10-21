import { join } from 'node:path';
import {
  readCatalog,
  type Catalog,
  type CatalogViolation,
} from '../../../../../shared/read-catalog.ts';

const CATALOGS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'shared', 'catalogs');

export interface GhCatalogs {
  readonly types: Catalog;
  readonly scopes: Catalog;
  readonly verbs: Catalog;
}

// The catalogs a title is judged by, or the first one that cannot be read.
export const ghCatalogs = await readGhCatalogs();

async function readGhCatalogs(): Promise<GhCatalogs | CatalogViolation> {
  const [types, scopes, verbs] = await Promise.all([
    readCatalog(join(CATALOGS, 'types.json'), 'type'),
    readCatalog(join(CATALOGS, 'scopes.json'), 'scope'),
    readCatalog(join(CATALOGS, 'verbs.json'), 'verb'),
  ]);

  if ('violation' in types) {
    return types;
  }

  if ('violation' in scopes) {
    return scopes;
  }

  return 'violation' in verbs ? verbs : { types, scopes, verbs };
}
