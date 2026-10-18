import { readFile } from 'node:fs/promises';
import { partForms } from './part-forms.ts';

export interface Catalog {
  readonly path: string;
  readonly words: readonly string[];
}

export interface CatalogViolation {
  readonly violation: string;
}

export async function readCatalog(
  path: string,
  partName: keyof typeof partForms,
): Promise<Catalog | CatalogViolation> {
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

  return isWordList(words, new RegExp(`^(?:${ partForms[partName] })$`))
    ? { path, words }
    : makeViolation(path, 'is not a sorted array of distinct lowercase words');
}

function isWordList(words: unknown, wordForm: RegExp): words is string[] {
  const isWord = (word: unknown): word is string =>
    typeof word === 'string' && wordForm.test(word);

  return Array.isArray(words) && words.every(isWord) && isSortedAndDistinct(words);
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
