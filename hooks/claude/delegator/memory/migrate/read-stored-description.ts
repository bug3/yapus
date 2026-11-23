import { readFrontmatter } from '../read-frontmatter.ts';

// The description line of a topic file as Claude Code stores it, a YAML
// line: the text after the key, in quotes or not.
const DESCRIPTION = /^description:[ \t]*(.*?)[ \t]*$/mu;

// The description in the frontmatter of a topic file of an auto memory,
// without the quotes around it; empty for a text with no frontmatter or a
// frontmatter with no such line.
export function readStoredDescription(sourceText: string): string {
  const { body } = readFrontmatter(sourceText);
  const frontmatter = sourceText.slice(0, sourceText.length - body.length);
  const [, written = ''] = DESCRIPTION.exec(frontmatter) ?? [];

  return unquote(written);
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
