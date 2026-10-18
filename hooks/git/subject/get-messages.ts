import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSubject } from './get-subject.ts';
import { getViolations, type Catalogs } from './get-violations.ts';
import { formatMessage } from './output/format-message.ts';
import { readCatalog, type Catalog, type CatalogViolation } from './read-catalog.ts';

export interface HookInput {
  readonly messagePath: string;
  readonly isEditorUsed: boolean;
  readonly catalogsPath: string;
}

export async function getMessages(
  { messagePath, isEditorUsed, catalogsPath }: HookInput,
): Promise<string[]> {
  const messageText = await readMessage(messagePath);

  if (messageText === undefined) {
    return [
      formatMessage(
        `cannot read the message file ${ messagePath }; the commit is blocked, retry it`,
      ),
    ];
  }

  const catalogs = await readCatalogs(catalogsPath);

  if (Array.isArray(catalogs)) {
    return catalogs.map(({ violation }) => formatMessage(violation));
  }

  const subject = getSubject(messageText, isEditorUsed);

  if ('violation' in subject) {
    return [formatMessage(subject.violation)];
  }

  return getViolations(subject.subject, catalogs).map(formatMessage);
}

async function readMessage(messagePath: string): Promise<string | undefined> {
  try {
    return await readFile(messagePath, 'utf8');
  } catch {
    return undefined;
  }
}

async function readCatalogs(catalogsPath: string): Promise<Catalogs | CatalogViolation[]> {
  const [types, scopes, verbs] = await Promise.all([
    readCatalog(join(catalogsPath, 'types.json')),
    readCatalog(join(catalogsPath, 'scopes.json')),
    readCatalog(join(catalogsPath, 'verbs.json')),
  ]);
  const isEveryCatalogRead = 'words' in types && 'words' in scopes && 'words' in verbs;

  return isEveryCatalogRead
    ? { types, scopes, verbs }
    : [types, scopes, verbs].filter(isViolation);
}

function isViolation(catalogRead: Catalog | CatalogViolation): catalogRead is CatalogViolation {
  return 'violation' in catalogRead;
}
