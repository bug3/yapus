// The most words one brace expansion yields; the rest are dropped.
const MAX_WORDS = 256;

// The words a shell makes of a word with comma brace groups (`.{env,x}` is `.env` and
// `.x`), nested groups included. A `{` with no comma at its level is a plain character.
export function expandBraces(word: string): readonly string[] {
  for (let open = word.indexOf('{'); open !== -1; open = word.indexOf('{', open + 1)) {
    const close = findClose(word, open);
    const parts = close === -1 ? [] : splitAlternatives(word.slice(open + 1, close));

    if (parts.length > 1) {
      const prefix = word.slice(0, open);
      const suffix = word.slice(close + 1);

      return parts
        .flatMap((part) => expandBraces(prefix + part + suffix))
        .slice(0, MAX_WORDS);
    }
  }

  return [word];
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
