import { readFile } from 'node:fs/promises';

// The widest form a part of a subject takes: a scope's.
const WORD = /^[a-z0-9-]+$/;

export interface Catalog {
  readonly path: string;
  readonly words: readonly string[];
}

export interface CatalogViolation {
  readonly violation: string;
}

export async function readCatalog(path: string): Promise<Catalog | CatalogViolation> {
  let catalogText: string;

  try {
    catalogText = await readFile(path, 'utf8');
  } catch {
    return makeViolation(path, 'cannot be read');
  }

  let words: unknown;

  try {
    words = JSON.parse(catalogText);
  } catch {
    return makeViolation(path, 'is not JSON');
  }

  return isWordList(words)
    ? { path, words }
    : makeViolation(path, 'is not a sorted array of distinct lowercase words');
}

function isWordList(words: unknown): words is string[] {
  return Array.isArray(words) && words.every(isWord) && isSortedAndDistinct(words);
}

function isWord(word: unknown): word is string {
  return typeof word === 'string' && WORD.test(word);
}

function isSortedAndDistinct(words: readonly string[]): boolean {
  return words.every((word, index) => {
    const previous = words[index - 1];

    return previous === undefined || previous < word;
  });
}

function makeViolation(path: string, reason: string): CatalogViolation {
  return { violation: `${ path } ${ reason }; the commit is blocked until the catalog is fixed` };
}
