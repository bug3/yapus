export interface IndexLink {
  readonly line: number;
  // Without the ./ a link may start with and without its title, so that a
  // file beside the index is named as the directory lists it.
  readonly target: string;
}

// A Markdown link, [text](target) or [text](target "title"); the target holds
// no space, and a title stands in double or single quotes.
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)/g;

// The start of a target that names the directory of the index itself.
const OWN_DIRECTORY = /^(?:\.\/)+/u;

// The target of every Markdown link in the text of an auto memory index,
// each with the number of its line, counted from 1.
export function readIndexLinks(indexText: string): readonly IndexLink[] {
  return indexText.split('\n').flatMap((lineText, index) =>
    [...lineText.matchAll(LINK)].map(([, target = '']) => ({
      line: index + 1,
      target: target.replace(OWN_DIRECTORY, ''),
    })));
}
