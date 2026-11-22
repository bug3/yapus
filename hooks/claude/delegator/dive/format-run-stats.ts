import { getMedian } from '../report/get-median.ts';
import type { AgentUsage } from './get-agent-usages.ts';

const HEAD: readonly string[] = [
  'Stage', 'Workflow agents', 'Returned', 'Turns', 'Output tokens', 'Input tokens',
  'Cache-read tokens', 'Median s', 'Longest s', 'Models', 'Tools',
];
const FETCH_HEAD: readonly string[] = ['Host', 'Fetches', 'Failed'];
const ABSENT = '-';
const NOT_HELD_TITLE = 'not held: ';
const MS_PER_SECOND = 1000;

// The report of one workflow run as markdown: a table with one row per stage,
// in the order the stages first appear, then one line of totals. Turns is the
// mean per workflow agent and the tokens are sums. The seconds of a stage
// come from its workflow agents that have times, and those of the run from
// its earliest to its latest time. A stage with no times, no model or no
// tool call gets a dash there.
// The calls of a tool a workflow agent did not hold follow those of the
// tools held. When a workflow agent called WebFetch, a table of the fetches
// and the failed ones per host follows the total line, the most fetched host
// first and then by name.
export function formatRunStats(usages: readonly AgentUsage[]): string {
  const stages = [...new Set(usages.map((usage) => usage.stage))];

  return [
    formatRow(HEAD),
    formatRow(HEAD.map(() => '---')),
    ...stages.map((stage) => formatRow(
      getStageCells(stage, usages.filter((usage) => usage.stage === stage)),
    )),
    '',
    formatTotal(usages),
    ...formatFetches(usages),
    '',
  ].join('\n');
}

function formatRow(cells: readonly string[]): string {
  return `| ${ cells.join(' | ') } |`;
}

function getStageCells(stage: string, usages: readonly AgentUsage[]): string[] {
  const seconds = usages.flatMap(getSeconds);

  return [
    stage,
    String(usages.length),
    String(usages.filter((usage) => usage.isReturned).length),
    (getSum(usages.map((usage) => usage.turns)) / usages.length).toFixed(1),
    String(getSum(usages.map((usage) => usage.outputTokens))),
    String(getSum(usages.map((usage) => usage.inputTokens))),
    String(getSum(usages.map((usage) => usage.cacheReadTokens))),
    formatSeconds(getMedian(seconds)),
    formatSeconds(seconds.length === 0 ? undefined : Math.max(...seconds)),
    formatList([...new Set(usages.flatMap((usage) => usage.models))].sort()),
    formatTools(usages),
  ];
}

function formatTotal(usages: readonly AgentUsage[]): string {
  const firsts = usages.flatMap(({ firstMs }) => (firstMs === undefined ? [] : [firstMs]));
  const lasts = usages.flatMap(({ lastMs }) => (lastMs === undefined ? [] : [lastMs]));
  // The line holds a number, so a run with no times has 0 seconds.
  const seconds = firsts.length === 0 || lasts.length === 0
    ? 0
    : (Math.max(...lasts) - Math.min(...firsts)) / MS_PER_SECOND;

  return `Total: ${ String(usages.length) } workflow agents, `
    + `${ String(getSum(usages.map((usage) => usage.outputTokens))) } output tokens, `
    + `${ String(getSum(usages.map((usage) => usage.inputTokens))) } input tokens, `
    + `${ String(getSum(usages.map((usage) => usage.cacheReadTokens))) } cache-read tokens, `
    + `${ String(Math.round(seconds)) } s from first to last`;
}

function formatFetches(usages: readonly AgentUsage[]): string[] {
  const calls = usages.flatMap((usage) => Object.entries(usage.fetches));
  const hosts = [...new Set(calls.map(([host]) => host))].sort();
  // The sort keeps the order of the names among hosts of equal fetches.
  const rows = hosts
    .map((host) => {
      const counts = calls.flatMap(([name, count]) => (name === host ? [count] : []));

      return {
        host,
        fetches: getSum(counts.map((count) => count.fetches)),
        failed: getSum(counts.map((count) => count.failed)),
      };
    })
    .sort((left, right) => right.fetches - left.fetches);

  return rows.length === 0
    ? []
    : [
      '',
      formatRow(FETCH_HEAD),
      formatRow(FETCH_HEAD.map(() => '---')),
      ...rows.map(({ host, fetches, failed }) => (
        formatRow([host, String(fetches), String(failed)])
      )),
    ];
}

function getSeconds(usage: AgentUsage): number[] {
  const { firstMs, lastMs } = usage;

  return firstMs === undefined || lastMs === undefined ? [] : [(lastMs - firstMs) / MS_PER_SECOND];
}

function formatTools(usages: readonly AgentUsage[]): string {
  const held = getToolCounts(usages.map((usage) => usage.tools));
  const notHeld = getToolCounts(usages.map((usage) => usage.toolsNotHeld));
  const parts = [
    ...(held.length === 0 ? [] : [held.join(', ')]),
    ...(notHeld.length === 0 ? [] : [`${ NOT_HELD_TITLE }${ notHeld.join(', ') }`]),
  ];

  return parts.length === 0 ? ABSENT : parts.join('; ');
}

// Each tool of the tallies, one tally per workflow agent, as "<name> <calls>",
// in the order of the names.
function getToolCounts(tallies: readonly Readonly<Record<string, number>>[]): string[] {
  const calls = tallies.flatMap((tally) => Object.entries(tally));
  const names = [...new Set(calls.map(([name]) => name))].sort();

  return names.map((name) => {
    const counts = calls.flatMap(([tool, count]) => (tool === name ? [count] : []));

    return `${ name } ${ String(getSum(counts)) }`;
  });
}

function getSum(numbers: readonly number[]): number {
  return numbers.reduce((total, number) => total + number, 0);
}

function formatSeconds(seconds: number | undefined): string {
  return seconds === undefined ? ABSENT : String(Math.round(seconds));
}

function formatList(entries: readonly string[]): string {
  return entries.length === 0 ? ABSENT : entries.join(', ');
}
