import { readFileSync } from 'node:fs';

// Fatal, so a byte that is not UTF-8 fails the read instead of turning into
// U+FFFD; a byte order mark stays in the text.
const utf8Decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

// The text of a file, or undefined when its bytes are not UTF-8 text: a
// byte that is not UTF-8, or a NUL, which UTF-16 puts beside every ASCII
// character. A file that cannot be read throws.
export function readUtf8(path: string): string | undefined {
  const bytes = readFileSync(path);

  if (bytes.includes(0)) {
    return undefined;
  }

  try {
    return utf8Decoder.decode(bytes);
  } catch {
    return undefined;
  }
}
