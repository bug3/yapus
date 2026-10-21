import type { ScanOutcome } from './run-scanner.ts';

export interface ScanVerdict {
  // Lines to say while the work goes on.
  readonly warnings: readonly string[];
  // Lines that say why the work stops; none lets it go on.
  readonly violations: readonly string[];
}

const SECRET_ADVICE =
  'stop and tell the person; if it was pushed, rotate it; do not rewrite history to hide it';

// What a scan outcome means for the work, named by what was scanned, such as
// "the staged change". A finding names the rule, the file and the line and
// never the secret.
export function getScanVerdict(outcome: ScanOutcome, target: string): ScanVerdict {
  switch (outcome.kind) {
    case 'clean':
      return { warnings: [], violations: [] };
    case 'missing':
      return {
        warnings: [`${ outcome.program } is not installed; ${ target } is not scanned`],
        violations: [],
      };
    case 'failure':
      return {
        warnings: [],
        violations: [`cannot scan ${ target } (${ outcome.reason }); retry it`],
      };
    case 'findings':
      return {
        warnings: [],
        violations: [
          ...outcome.findings.map(
            ({ ruleId, file, startLine }) =>
              `secret found: rule ${ ruleId }, ${ file } line ${ String(startLine) }`,
          ),
          SECRET_ADVICE,
        ],
      };
  }
}
