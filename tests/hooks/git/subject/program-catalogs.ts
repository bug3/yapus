import { join } from 'node:path';
import type { CatalogPaths } from '../../../../hooks/git/subject/get-messages.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', 'hooks');

// The catalogs the subject hook reads in the repository.
export const programCatalogs: CatalogPaths = {
  types: join(HOOKS, 'shared', 'catalogs', 'types.json'),
  scopes: join(HOOKS, 'shared', 'catalogs', 'scopes.json'),
  verbs: join(HOOKS, 'shared', 'catalogs', 'verbs.json'),
};
