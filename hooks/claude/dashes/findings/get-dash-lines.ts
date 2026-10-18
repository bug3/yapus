// Every Unicode dash punctuation code point (category Pd) except U+002D,
// written out so that a Unicode update in Node cannot change the set.
export const DASHES: readonly number[] = [
  0x058a, 0x05be, 0x1400, 0x1806, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014,
  0x2015, 0x2e17, 0x2e1a, 0x2e3a, 0x2e3b, 0x2e40, 0x2e5d, 0x301c, 0x3030,
  0x30a0, 0xfe31, 0xfe32, 0xfe58, 0xfe63, 0xff0d, 0x10d6e, 0x10ead,
];

const dashCodePoints: ReadonlySet<number> = new Set(DASHES);

export interface DashLine {
  readonly line: number;
  readonly dashes: readonly number[];
}

export function getDashLines(content: string): DashLine[] {
  return content.split('\n').flatMap((lineText, index) => {
    const dashes = getDashes(lineText);

    return dashes.length === 0 ? [] : [{ line: index + 1, dashes }];
  });
}

function getDashes(lineText: string): number[] {
  return [
    ...new Set(
      Array.from(lineText, (character) => character.codePointAt(0) ?? 0)
        .filter((codePoint) => dashCodePoints.has(codePoint)),
    ),
  ];
}
