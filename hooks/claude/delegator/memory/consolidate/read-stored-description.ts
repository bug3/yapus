import { readFrontmatter } from '../read-frontmatter.ts';

// The description line of a topic file as Claude Code stores it, a YAML
// line: the text after the key, in quotes or not.
const DESCRIPTION = /^description:[ \t]*(.*?)[ \t]*$/mu;

// The header of a YAML block scalar, > or | with its indicators: the text
// stands on the lines under it.
const BLOCK_SCALAR = /^[>|][0-9+-]{0,2}$/u;

// The description the frontmatter of a topic file of an auto memory holds on
// one line, without the quotes around it; empty for a text with no
// frontmatter, which one with CRLF line ends is to the reader, for a
// frontmatter with no such line and for a block scalar.
export function readStoredDescription(sourceText: string): string {
  const { body } = readFrontmatter(sourceText);
  const frontmatter = sourceText.slice(0, sourceText.length - body.length);
  const [, written = ''] = DESCRIPTION.exec(frontmatter) ?? [];

  return BLOCK_SCALAR.test(written) ? '' : unquote(written);
}

// A YAML text without the quotes around it and the escape of its own quote.
function unquote(written: string): string {
  const inner = written.slice(1, -1);

  if (written.length > 1 && written.startsWith('"') && written.endsWith('"')) {
    return inner.replaceAll(/\\(["\\])/gu, '$1');
  }

  return written.length > 1 && written.startsWith("'") && written.endsWith("'")
    ? inner.replaceAll("''", "'")
    : written;
}
