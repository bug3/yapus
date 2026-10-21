import { secretFiles } from './secret-files.ts';

const GLOB_CHARACTERS = /[*?[]/;
// Inside a set: a class, an equivalence class or a collating symbol.
const SET_CLASS = /\[[:=.]/;
const NAME_CHARACTER = /[A-Za-z0-9_]/;
const SPECIAL_PARAMETER = /[@*#?$!-]/;

// Whether a word holds a glob that, applied to its last path segment as a shell does,
// matches the name of a sample secret file. A bracket set the translation cannot read
// with confidence counts as a match, and an expansion in the word counts as `*`.
export function isSecretGlob(word: string): boolean {
  if (!GLOB_CHARACTERS.test(word)) {
    return false;
  }

  const expanded = replaceExpansions(word);
  const pattern = expanded.slice(expanded.lastIndexOf('/') + 1);
  const source = toRegExpSource(pattern);

  if (source === undefined) {
    return true;
  }

  const name = new RegExp(`^${ source }$`, 'i');

  // `*`, `?` and a bracket do not match a leading dot unless the pattern starts with one.
  return secretFiles.globSamples.some((sample) =>
    (pattern.startsWith('.') || !sample.startsWith('.')) && name.test(sample));
}

// Each `$X`, `${X}`, `$(..)` and backtick span becomes `*`.
function replaceExpansions(word: string): string {
  let result = '';
  let index = 0;

  while (index < word.length) {
    const end = findExpansionEnd(word, index);

    result += end === index ? word.charAt(index) : '*';
    index = Math.max(end, index + 1);
  }

  return result;
}

// The position after the expansion that starts at `start`, or `start` when none does.
function findExpansionEnd(word: string, start: number): number {
  const char = word.charAt(start);
  const next = word.charAt(start + 1);

  if (char === '`') {
    const close = word.indexOf('`', start + 1);

    return close === -1 ? word.length : close + 1;
  }

  if (char !== '$') {
    return start;
  }

  if (next === '(' || next === '{') {
    return findBalancedEnd(word, start + 1);
  }

  if (NAME_CHARACTER.test(next)) {
    let end = start + 1;

    while (NAME_CHARACTER.test(word.charAt(end))) {
      end += 1;
    }

    return end;
  }

  return SPECIAL_PARAMETER.test(next) ? start + 2 : start;
}

function findBalancedEnd(word: string, open: number): number {
  const opener = word.charAt(open);
  const closer = opener === '(' ? ')' : '}';
  let depth = 0;

  for (let index = open; index < word.length; index += 1) {
    if (word.charAt(index) === opener) {
      depth += 1;
    } else if (word.charAt(index) === closer) {
      depth -= 1;
    }

    if (depth === 0) {
      return index + 1;
    }
  }

  return word.length;
}

// The source of a regular expression for a glob, or undefined when a bracket set is
// one it cannot translate with confidence: it never closes, or it holds a class.
function toRegExpSource(glob: string): string | undefined {
  let source = '';

  for (let index = 0; index < glob.length; index += 1) {
    const char = glob.charAt(index);
    const close = char === '[' ? glob.indexOf(']', index + 2) : -1;

    if (char === '[' && (close === -1 || SET_CLASS.test(glob.slice(index + 1, close)))) {
      return undefined;
    }

    if (char === '*') {
      source += '.*';
    } else if (char === '?') {
      source += '.';
    } else if (close === -1) {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    } else {
      const set = glob.slice(index + 1, close).replace(/^!/, '^').replaceAll('\\', '\\\\');

      source += `[${ set }]`;
      index = close;
    }
  }

  return source;
}
