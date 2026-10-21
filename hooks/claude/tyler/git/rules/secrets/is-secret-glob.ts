import { secretFiles } from './secret-files.ts';

const GLOB_CHARACTERS = /[*?[]/;

// Whether a word holds a glob that, applied to its last path segment as a shell does,
// matches the name of a sample secret file.
export function isSecretGlob(word: string): boolean {
  if (!GLOB_CHARACTERS.test(word)) {
    return false;
  }

  const pattern = word.slice(word.lastIndexOf('/') + 1);
  const name = new RegExp(`^${ toRegExpSource(pattern) }$`, 'i');

  // `*`, `?` and a bracket do not match a leading dot unless the pattern starts with one.
  return secretFiles.globSamples.some((sample) =>
    (pattern.startsWith('.') || !sample.startsWith('.')) && name.test(sample));
}

function toRegExpSource(glob: string): string {
  let source = '';

  for (let index = 0; index < glob.length; index += 1) {
    const char = glob.charAt(index);
    const close = char === '[' ? glob.indexOf(']', index + 2) : -1;

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
