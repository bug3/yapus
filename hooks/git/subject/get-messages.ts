import { readFile } from 'node:fs/promises';
import { readCatalog, type Catalog, type CatalogViolation } from '../../shared/read-catalog.ts';
import {
  getSubjectViolations,
  type Catalogs,
} from '../../shared/subject/get-subject-violations.ts';
import { getSubject } from './get-subject.ts';
import { formatMessage } from './output/format-message.ts';

// The path of each catalog; the catalogs are shared with the other hooks.
export interface CatalogPaths {
  readonly types: string;
  // Undefined: no scope catalog exists, and any scope of the word form passes.
  readonly scopes: string | undefined;
  readonly verbs: string;
}

export interface HookInput {
  readonly messagePath: string;
  readonly isEditorUsed: boolean;
  readonly catalogPaths: CatalogPaths;
}

export async function getMessages(
  { messagePath, isEditorUsed, catalogPaths }: HookInput,
): Promise<string[]> {
  const messageText = await readMessage(messagePath);

  if (messageText === undefined) {
    return [
      formatMessage(
        `cannot read the message file ${ messagePath }; the commit is blocked, retry it`,
      ),
    ];
  }

  const catalogs = await readCatalogs(catalogPaths);

  if (Array.isArray(catalogs)) {
    return catalogs.map(({ violation }) => formatMessage(violation));
  }

  const subject = getSubject(messageText, isEditorUsed);

  if ('violation' in subject) {
    return [formatMessage(subject.violation)];
  }

  return getSubjectViolations(subject.subject, catalogs).map(formatMessage);
}

async function readMessage(messagePath: string): Promise<string | undefined> {
  try {
    return await readFile(messagePath, 'utf8');
  } catch {
    return undefined;
  }
}

async function readCatalogs(paths: CatalogPaths): Promise<Catalogs | CatalogViolation[]> {
  const [types, scopes, verbs] = await Promise.all([
    readCatalog(paths.types, 'type'),
    paths.scopes === undefined ? undefined : readCatalog(paths.scopes, 'scope'),
    readCatalog(paths.verbs, 'verb'),
  ]);
  const isScopesRead = scopes === undefined || 'words' in scopes;
  const isEveryCatalogRead = 'words' in types && isScopesRead && 'words' in verbs;

  return isEveryCatalogRead
    ? { types, scopes, verbs }
    : [types, scopes, verbs].filter(isViolation);
}

function isViolation(
  catalogRead: Catalog | CatalogViolation | undefined,
): catalogRead is CatalogViolation {
  return catalogRead !== undefined && 'violation' in catalogRead;
}
