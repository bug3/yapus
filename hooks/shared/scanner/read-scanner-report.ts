import { isRecord } from '../is-record.ts';

export interface Finding {
  readonly ruleId: string;
  readonly file: string;
  readonly startLine: number;
}

export interface ReportViolation {
  readonly violation: string;
}

// The findings of a report: a JSON array whose entries name RuleID, File and
// StartLine, as gitleaks writes it. With --redact the report holds no secret,
// and nothing else of an entry is read.
export function readScannerReport(reportText: string): Finding[] | ReportViolation {
  let report: unknown;

  try {
    report = JSON.parse(reportText);
  } catch {
    return { violation: 'the report is not JSON' };
  }

  if (!Array.isArray(report) || report.length === 0) {
    return { violation: 'the report is not a list with a finding' };
  }

  const findings = report.map(readFinding);

  return findings.every((finding) => finding !== undefined)
    ? findings
    : { violation: 'a finding of the report lacks RuleID, File or StartLine' };
}

function readFinding(entry: unknown): Finding | undefined {
  if (!isRecord(entry)) {
    return undefined;
  }

  const { RuleID: ruleId, File: file, StartLine: startLine } = entry;

  return typeof ruleId === 'string' && typeof file === 'string' && typeof startLine === 'number'
    ? { ruleId, file, startLine }
    : undefined;
}
