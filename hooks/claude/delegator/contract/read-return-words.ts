import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isRecord } from '../../../shared/is-record.ts';

export const RETURN_WORDS_PATH = join(import.meta.dirname, 'return-words.json');

// The words a return opens with (contract.md), the words a judge puts on the
// line after them (plan-reviewer.md, diff-reviewer.md), and those of the
// verdicts that send the work back.
export interface ReturnWords {
  readonly statuses: readonly string[];
  readonly verdicts: readonly string[];
  readonly reworkVerdicts: readonly string[];
}

export interface ReturnWordsViolation {
  readonly violation: string;
}

interface Verdict {
  readonly word: string;
  readonly rework: boolean;
}

const WORD_FORM = /^[A-Z]+$/;

// The return words in the JSON file at path, or why they cannot be read.
export function readReturnWords(path: string): ReturnWords | ReturnWordsViolation {
  let wordsText: string;

  try {
    wordsText = readFileSync(path, 'utf8');
  } catch {
    return makeViolation(path, 'cannot be read');
  }

  let words: unknown;

  try {
    words = JSON.parse(wordsText);
  } catch {
    return makeViolation(path, 'is not JSON');
  }

  if (!isWordsShape(words)) {
    return makeViolation(
      path,
      'does not hold statuses as uppercase words and verdicts as words with a rework flag',
    );
  }

  return {
    statuses: words.statuses,
    verdicts: words.verdicts.map((verdict) => verdict.word),
    reworkVerdicts: words.verdicts.filter((verdict) => verdict.rework)
      .map((verdict) => verdict.word),
  };
}

function isWordsShape(
  words: unknown,
): words is { readonly statuses: string[]; readonly verdicts: Verdict[] } {
  return isRecord(words)
    && Array.isArray(words.statuses) && words.statuses.every(isWord)
    && Array.isArray(words.verdicts) && words.verdicts.every(isVerdict);
}

function isVerdict(verdict: unknown): verdict is Verdict {
  return isRecord(verdict) && isWord(verdict.word) && typeof verdict.rework === 'boolean';
}

function isWord(word: unknown): word is string {
  return typeof word === 'string' && WORD_FORM.test(word);
}

function makeViolation(path: string, reason: string): ReturnWordsViolation {
  return { violation: `${ path } ${ reason }; fix the file` };
}
