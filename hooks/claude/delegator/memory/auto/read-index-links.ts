export interface IndexLink {
  readonly line: number;
  readonly target: string;
}

// A Markdown link, [text](target); the target holds no space.
const LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

// The target of every Markdown link in the text of an auto memory index,
// each with the number of its line, counted from 1.
export function readIndexLinks(indexText: string): readonly IndexLink[] {
  return indexText.split('\n').flatMap((lineText, index) =>
    [...lineText.matchAll(LINK)].map(([, target]) => ({ line: index + 1, target: target ?? '' })));
}
