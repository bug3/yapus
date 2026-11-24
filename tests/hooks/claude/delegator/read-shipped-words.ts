import {
  RETURN_WORDS_PATH,
  readReturnWords,
  type ReturnWords,
} from '../../../../hooks/claude/delegator/contract/read-return-words.ts';

// The return words the plugin ships; throws when they cannot be read.
export function readShippedWords(): ReturnWords {
  const words = readReturnWords(RETURN_WORDS_PATH);

  if ('violation' in words) {
    throw new Error(words.violation);
  }

  return words;
}
