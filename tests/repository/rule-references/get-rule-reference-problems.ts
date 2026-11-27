import { join } from 'node:path';
import { listAllFiles, listFiles } from '../../helpers/list-files.ts';
import { readUtf8 } from '../../helpers/read-utf8.ts';

const STANDARDS = 'standards/';
// The delegator's orchestration rules live outside standards/.
const POLICY = 'hooks/claude/delegator/policy/policy.md';
const RULE_HEADING = /^## (([A-Z]+)-[1-9]\d*)\. /gm;
const CITATION = /(?<![A-Za-z0-9_-])([A-Z]+)-[0-9]+(?![0-9])/g;

interface RuleIds {
  readonly ruleIds: ReadonlySet<string>;
  readonly prefixes: ReadonlySet<string>;
}

// Every rule ID cited in a file git keeps that names no rule heading of a
// standard or of the delegator policy, as "<path>:<line>: <ID> names no rule";
// a word whose prefix no rule heading uses, such as UTF-8, is no rule ID.
export function getRuleReferenceProblems(root: string): string[] {
  const known = getRuleIds(root);

  return listAllFiles(root).flatMap((path) => {
    const lines = (readUtf8(join(root, path)) ?? '').split('\n');

    return lines.flatMap((line, index) => {
      const lineNumber = String(index + 1);

      return judgeLine(line, `${ path }:${ lineNumber }`, known);
    });
  });
}

function judgeLine(line: string, location: string, known: RuleIds): string[] {
  return [...line.matchAll(CITATION)]
    .filter(([ruleId, prefix = '']) => known.prefixes.has(prefix) && !known.ruleIds.has(ruleId))
    .map(([ruleId]) => `${ location }: ${ ruleId } names no rule`);
}

function getRuleIds(root: string): RuleIds {
  const headings = listFiles(root, '.md')
    .filter((path) => path.startsWith(STANDARDS) || path === POLICY)
    .flatMap((path) => [...(readUtf8(join(root, path)) ?? '').matchAll(RULE_HEADING)]);

  return {
    ruleIds: new Set(headings.map(([, ruleId = '']) => ruleId)),
    prefixes: new Set(headings.map(([, , prefix = '']) => prefix)),
  };
}
