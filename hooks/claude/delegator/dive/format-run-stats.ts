import { getMedian } from '../report/get-median.ts';
import type { AgentUsage } from './get-agent-usages.ts';

const HEAD: readonly string[] = [
  'Stage', 'Agents', 'Returned', 'Turns', 'Output tokens', 'Input tokens', 'Cache-read tokens',
  'Median s', 'Longest s', 'Models', 'Tools',
];
const ABSENT = '-';
const MS_PER_SECOND = 1000;

// The report of one workflow run as markdown: a table with one row per stage,
// in the order the stages first appear, then one line of totals. Turns is the
// mean per agent and the tokens are sums. The seconds of a stage come from its
// agents that have times, and those of the run from its earliest to its latest
// time. A stage with no times, no model or no tool call gets a dash there.
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
    formatList(getToolCounts(usages)),
  ];
}

function formatTotal(usages: readonly AgentUsage[]): string {
  const firsts = usages.flatMap(({ firstMs }) => (firstMs === undefined ? [] : [firstMs]));
  const lasts = usages.flatMap(({ lastMs }) => (lastMs === undefined ? [] : [lastMs]));
  // The line holds a number, so a run with no times has 0 seconds.
  const seconds = firsts.length === 0 || lasts.length === 0
    ? 0
    : (Math.max(...lasts) - Math.min(...firsts)) / MS_PER_SECOND;

  return `Total: ${ String(usages.length) } agents, `
    + `${ String(getSum(usages.map((usage) => usage.outputTokens))) } output tokens, `
    + `${ String(getSum(usages.map((usage) => usage.inputTokens))) } input tokens, `
    + `${ String(getSum(usages.map((usage) => usage.cacheReadTokens))) } cache-read tokens, `
    + `${ String(Math.round(seconds)) } s from first to last`;
}

function getSeconds(usage: AgentUsage): number[] {
  const { firstMs, lastMs } = usage;

  return firstMs === undefined || lastMs === undefined ? [] : [(lastMs - firstMs) / MS_PER_SECOND];
}

// Each tool the agents called as "<name> <calls>", in the order of the names.
function getToolCounts(usages: readonly AgentUsage[]): string[] {
  const calls = usages.flatMap((usage) => Object.entries(usage.tools));
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
