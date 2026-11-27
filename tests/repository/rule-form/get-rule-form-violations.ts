import { join } from 'node:path';
import { listFiles } from '../../helpers/list-files.ts';
import { readUtf8 } from '../../helpers/read-utf8.ts';

const STANDARDS = 'standards/';
const FENCE = '---';
const TITLE = /^# \S/;
const RULE_HEADING = /^## ([A-Z]+)-([1-9]\d*)\. (.*)$/;
// One sentence: it ends with a period and nowhere starts a second one.
const ONE_SENTENCE = /^(?!.*\. [A-Z`]).*\.$/;

// Every line of a standard that is not its title, a rule heading of one
// sentence or blank, and every rule heading whose prefix is not the first
// rule heading's or whose number is not the one after the previous heading's,
// or 1 for the first, as "<path>:<line>: <what is wrong>".
export function getRuleFormViolations(root: string): string[] {
  return listFiles(root, '.md')
    .filter((path) => path.startsWith(STANDARDS))
    .flatMap((path) => getViolations(path, (readUtf8(join(root, path)) ?? '').split('\n')));
}

function getViolations(path: string, lines: readonly string[]): string[] {
  const bodyStart = getBodyStart(lines);
  const [title = '', ...rules] = lines.slice(bodyStart);
  const titleLine = String(bodyStart + 1);
  const titleViolations = TITLE.test(title) ? [] : [`${ path }:${ titleLine }: not a title`];

  return [
    ...titleViolations,
    ...rules.flatMap((line, index) => {
      const lineNumber = String(bodyStart + index + 2);

      return judgeLine(line, `${ path }:${ lineNumber }`);
    }),
    // The title slot counts: a file with no title opens with its first rule.
    ...getNumberingViolations(path, lines, bodyStart),
  ];
}

function getNumberingViolations(path: string, lines: readonly string[], start: number): string[] {
  const headings = lines.slice(start).flatMap((line, index) => {
    const [, prefix, ruleNumber] = RULE_HEADING.exec(line) ?? [];
    const lineNumber = start + index + 1;

    return prefix === undefined || ruleNumber === undefined
      ? []
      : [{ lineNumber, prefix, ruleNumber: Number(ruleNumber) }];
  });
  const firstPrefix = headings[0]?.prefix ?? '';

  return headings.flatMap(({ lineNumber, prefix, ruleNumber }, index) => {
    const expected = (headings[index - 1]?.ruleNumber ?? 0) + 1;
    const location = `${ path }:${ String(lineNumber) }`;
    const prefixViolations = prefix === firstPrefix
      ? []
      : [`${ location }: not prefixed ${ firstPrefix }`];
    const numberViolations = ruleNumber === expected
      ? []
      : [`${ location }: not numbered ${ String(expected) }`];

    return [...prefixViolations, ...numberViolations];
  });
}

function judgeLine(line: string, location: string): string[] {
  if (line === '') {
    return [];
  }

  const sentence = RULE_HEADING.exec(line)?.[3];

  if (sentence === undefined) {
    return [`${ location }: not a rule heading`];
  }

  return ONE_SENTENCE.test(sentence) ? [] : [`${ location }: not one sentence`];
}

// The first text line after a paths head, when the file has one.
function getBodyStart(lines: readonly string[]): number {
  const closingFence = lines[0] === FENCE ? lines.indexOf(FENCE, 1) : -1;
  const afterHead = closingFence === -1 ? 0 : closingFence + 1;
  const firstText = lines.slice(afterHead).findIndex((line) => line !== '');

  return firstText === -1 ? lines.length : afterHead + firstText;
}
