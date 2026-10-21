// The most words one expansion may build, the longest word and the most groups it may
// read; a word past any of them is not expanded.
const MAX_WORDS = 256;
const MAX_LENGTH = 1024;
const MAX_GROUPS = 16;
// What a sequence group (`{1..3}`, `{a..e}`, `{1..9..2}`) has and a comma group has not.
const SEQUENCE = '..';

// The words a shell makes of a word with comma brace groups (`.{env,x}` is `.env` and
// `.x`), nested groups included. A `{` with no comma at its level is a plain character.
// Undefined when the expander cannot tell what the word makes: it holds a sequence
// group, or it is past a cap. The caller treats such a word as possibly anything.
export function expandBraces(word: string): readonly string[] | undefined {
  if (word.length > MAX_LENGTH || word.split('{').length - 1 > MAX_GROUPS) {
    return undefined;
  }

  return expand(word);
}

function expand(word: string): readonly string[] | undefined {
  for (let open = word.indexOf('{'); open !== -1; open = word.indexOf('{', open + 1)) {
    // A `{` after `$` opens a parameter expansion, not a group.
    const close = word.charAt(open - 1) === '$' ? -1 : findClose(word, open);
    const inside = close === -1 ? '' : word.slice(open + 1, close);
    const parts = splitAlternatives(inside);

    if (close !== -1 && parts.length === 1 && inside.includes(SEQUENCE)) {
      return undefined;
    }

    if (close !== -1 && parts.length > 1) {
      return expandParts(word.slice(0, open), parts, word.slice(close + 1));
    }
  }

  return [word];
}

// Stops as soon as the words built pass the cap: the work is capped, not the output.
function expandParts(
  prefix: string,
  parts: readonly string[],
  suffix: string,
): readonly string[] | undefined {
  const words: string[] = [];

  for (const part of parts) {
    const expanded = expand(prefix + part + suffix);

    if (expanded === undefined) {
      return undefined;
    }

    words.push(...expanded);

    if (words.length > MAX_WORDS) {
      return undefined;
    }
  }

  return words;
}

function findClose(word: string, open: number): number {
  let depth = 0;

  for (let index = open; index < word.length; index += 1) {
    depth += depthChange(word.charAt(index));

    if (depth === 0) {
      return index;
    }
  }

  return -1;
}

function splitAlternatives(inside: string): readonly string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;

  for (let index = 0; index < inside.length; index += 1) {
    const char = inside.charAt(index);

    depth += depthChange(char);

    if (char === ',' && depth === 0) {
      parts.push(inside.slice(from, index));
      from = index + 1;
    }
  }

  return [...parts, inside.slice(from)];
}

function depthChange(char: string): number {
  if (char === '{') {
    return 1;
  }

  return char === '}' ? -1 : 0;
}
