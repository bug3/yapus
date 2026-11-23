// The line that opens the frontmatter as a file's first line, and closes it.
const FENCE = '---';

// A top-level line, key: "text". The text runs from the first quote to the
// last one of the line and is taken as it is written.
const FIELD = /^([a-z][a-z-]*): "(.*)"$/u;

export interface Frontmatter {
  // The text of each key; of a key written twice, the last.
  readonly fields: ReadonlyMap<string, string>;
  // The text after the closing line, or the whole text without a frontmatter.
  readonly body: string;
}

// The frontmatter of a memory file and the body under it, read line by line.
// A line of another form, such as an indented one or a text without quotes,
// is skipped. A text that does not start with the opening line, or never
// closes it, has no field.
export function readFrontmatter(text: string): Frontmatter {
  const [first, ...lines] = text.split('\n');
  const closing = lines.indexOf(FENCE);

  if (first !== FENCE || closing === -1) {
    return { fields: new Map(), body: text };
  }

  const fields = lines.slice(0, closing).flatMap((line): [string, string][] => {
    const [, key, fieldText] = FIELD.exec(line) ?? [];

    return key === undefined || fieldText === undefined ? [] : [[key, fieldText]];
  });

  return { fields: new Map(fields), body: lines.slice(closing + 1).join('\n') };
}
