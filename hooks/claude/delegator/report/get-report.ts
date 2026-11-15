import { formatReport } from './format-report.ts';
import { getAgentStats } from './get-agent-stats.ts';
import { getFindings } from './get-findings.ts';
import { getRefusals } from './get-refusals.ts';
import { getRework } from './get-rework.ts';
import { readRows } from './read-rows.ts';

// The markdown report of the record file at path with the given text.
export function getReport(path: string, text: string): string {
  const { rows, skipped } = readRows(text);
  const stats = getAgentStats(rows);
  const sessions = new Set(rows.map((row) => row.sessionId)).size;
  const times = rows.map((row) => row.time).sort();

  return formatReport({
    path,
    rowCount: rows.length,
    skipped,
    sessions,
    first: times[0],
    last: times.at(-1),
    stats,
    findings: getFindings({ stats, rework: getRework(rows), sessions }),
    refusals: getRefusals(rows),
  });
}
