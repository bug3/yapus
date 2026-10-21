import { join } from 'node:path';
import { readLabels } from '../../../../../../shared/labels/read-labels.ts';

const CATALOGS = join(
  import.meta.dirname, '..', '..', '..', '..', '..', '..', 'shared', 'catalogs',
);

// Every label of the repository, or the catalog that cannot be read.
export const ghLabels = await readLabels(CATALOGS);
