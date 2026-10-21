import { readLabels } from '../../../../../shared/labels/read-labels.ts';
import { CATALOGS_DIRECTORY } from '../gh-catalogs.ts';

// Every label of the repository, or the catalog that cannot be read.
export const ghLabels = await readLabels(CATALOGS_DIRECTORY);
