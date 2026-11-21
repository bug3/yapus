import type { AgentStats } from './get-agent-stats.ts';
import type { Finding } from './get-findings.ts';

export interface Report {
  readonly path: string;
  readonly rowCount: number;
  readonly skipped: number;
  readonly sessions: number;
  readonly first: string | undefined;
  readonly last: string | undefined;
  readonly stats: readonly AgentStats[];
  readonly findings: readonly Finding[];
  readonly refusals: readonly (readonly [string, number])[];
}

const AGENT_HEAD: readonly string[] = [
  'agent type', 'launches', 'refused', 'completed', 'capped', 'no return', 'returns', 'sent back',
  'contract words', 'verdicts', 'wall median s', 'tokens median', 'tool calls median',
];
const FINDING_HEAD: readonly string[] = ['rule', 'agent type', 'value', 'n', 'threshold', 'state'];
const REFUSAL_HEAD: readonly string[] = ['reason', 'count'];
const MS_PER_SECOND = 1000;

// The report as markdown: the record's extent, one table of counts per
// agent type, the reading rules with their state and the refusals.
export function formatReport(report: Report): string {
  const span = report.first === undefined
    ? ''
    : `, from ${ report.first } to ${ report.last ?? '' }`;
  const extent = `${ String(report.rowCount) } rows, ${ String(report.skipped) } skipped, `
    + `${ String(report.sessions) } sessions${ span }`;

  return [
    '# delegator record report',
    '',
    `Record \`${ report.path }\`: ${ extent }.`,
    '',
    '## Agent types',
    '',
    ...formatTable(AGENT_HEAD, report.stats.map(formatStats)),
    '',
    '## Reading rules',
    '',
    ...formatTable(FINDING_HEAD, report.findings.map(formatFinding)),
    '',
    '## Refusals',
    '',
    ...(report.refusals.length === 0 ? ['No refusals.'] : formatRefusals(report.refusals)),
    '',
  ].join('\n');
}

function formatStats(stats: AgentStats): string[] {
  return [
    stats.agent,
    String(stats.launches),
    String(stats.refused),
    String(stats.completed),
    String(stats.capped),
    String(stats.noReturn),
    String(stats.returns),
    String(stats.sentBack),
    String(stats.contractWords),
    formatVerdicts(stats.verdicts),
    formatNumber(stats.durationMedianMs === undefined
      ? undefined
      : stats.durationMedianMs / MS_PER_SECOND),
    formatNumber(stats.tokensMedian),
    formatNumber(stats.toolUsesMedian),
  ];
}

function formatVerdicts(verdicts: Readonly<Record<string, number>>): string {
  return Object.entries(verdicts)
    .map(([word, count]) => `${ word } ${ String(count) }`)
    .join(', ');
}

function formatFinding(finding: Finding): string[] {
  return [
    finding.rule,
    finding.agent,
    finding.value,
    String(finding.n),
    finding.threshold,
    finding.state,
  ];
}

function formatRefusals(refusals: readonly (readonly [string, number])[]): string[] {
  return formatTable(REFUSAL_HEAD, refusals.map(([reason, count]) => [reason, String(count)]));
}

function formatNumber(value: number | undefined): string {
  return value === undefined ? '-' : String(Math.round(value));
}

function formatTable(head: readonly string[], rows: readonly (readonly string[])[]): string[] {
  return [
    `| ${ head.join(' | ') } |`,
    `|${ head.map(() => '---').join('|') }|`,
    ...rows.map((row) => `| ${ row.join(' | ') } |`),
  ];
}
