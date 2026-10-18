import { join } from 'node:path';
import { listFiles } from '../../helpers/list-files.ts';
import { readUtf8 } from '../../helpers/read-utf8.ts';

const STANDARDS = 'standards/';
const FENCE = '---';
const TITLE = /^# \S/;
const RULE_HEADING = /^## [A-Z]+-\d+\. (.*)$/;
// One sentence: it ends with a period and nowhere starts a second one.
const ONE_SENTENCE = /^(?!.*\. [A-Z`]).*\.$/;

// Every line of a standard that is not its title, a rule heading of one
// sentence or blank, as "<path>:<line>: <what is wrong>".
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
  ];
}

function judgeLine(line: string, location: string): string[] {
  if (line === '') {
    return [];
  }

  const sentence = RULE_HEADING.exec(line)?.[1];

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
