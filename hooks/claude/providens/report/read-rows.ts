import { isRecord } from '../../../shared/is-record.ts';
import type { EndRow, LaunchRow, ReturnRow, Row } from '../record-row.ts';

export interface Rows {
  readonly rows: readonly Row[];
  // Lines that are not a row the record writes: counted, never fatal, so a
  // damaged line costs one row and not the report.
  readonly skipped: number;
}

type Reader = (fields: Readonly<Record<string, unknown>>) => Row | undefined;

// One reader per hook that writes a row, keyed by the row's hook field.
const READERS: Readonly<Record<string, Reader>> = {
  launch: readLaunch,
  return: readReturn,
  end: readEnd,
};

// The rows in the text of the record file, one JSON line each.
export function readRows(text: string): Rows {
  const rows = text.split('\n').filter((line) => line !== '').map(readRow);

  return {
    rows: rows.filter((row) => row !== undefined),
    skipped: rows.filter((row) => row === undefined).length,
  };
}

function readRow(line: string): Row | undefined {
  let fields: unknown;

  try {
    fields = JSON.parse(line);
  } catch {
    return undefined;
  }

  if (!isRecord(fields) || typeof fields.hook !== 'string') {
    return undefined;
  }

  return READERS[fields.hook]?.(fields);
}

function readLaunch(fields: Readonly<Record<string, unknown>>): LaunchRow | undefined {
  const { time, sessionId, subject, allowed, reason, description } = fields;
  const hasFields = typeof time === 'string' && typeof sessionId === 'string'
    && typeof subject === 'string' && typeof allowed === 'boolean'
    && typeof reason === 'string' && typeof description === 'string';

  return hasFields
    ? {
      hook: 'launch',
      time,
      sessionId,
      subject,
      allowed,
      reason,
      description,
      toolUseId: getString(fields.toolUseId),
      promptId: getString(fields.promptId),
      model: getString(fields.model),
      effort: getString(fields.effort),
    }
    : undefined;
}

function readReturn(fields: Readonly<Record<string, unknown>>): ReturnRow | undefined {
  const { time, sessionId, subject, allowed, reason, status, length } = fields;
  const hasFields = typeof time === 'string' && typeof sessionId === 'string'
    && typeof subject === 'string' && typeof allowed === 'boolean'
    && typeof reason === 'string' && typeof status === 'string' && typeof length === 'number';

  return hasFields
    ? {
      hook: 'return',
      time,
      sessionId,
      subject,
      allowed,
      reason,
      agentId: getString(fields.agentId),
      status,
      verdict: getString(fields.verdict),
      length,
      turns: getNumber(fields.turns),
      toolUses: getNumber(fields.toolUses),
      tokens: getNumber(fields.tokens),
      durationMs: getNumber(fields.durationMs),
      model: getString(fields.model),
    }
    : undefined;
}

function readEnd(fields: Readonly<Record<string, unknown>>): EndRow | undefined {
  const { time, sessionId, subject, agentId, status, capped } = fields;
  const hasFields = typeof time === 'string' && typeof sessionId === 'string'
    && typeof subject === 'string' && typeof agentId === 'string'
    && typeof status === 'string' && typeof capped === 'boolean';

  return hasFields
    ? {
      hook: 'end',
      time,
      sessionId,
      subject,
      promptId: getString(fields.promptId),
      toolUseId: getString(fields.toolUseId),
      agentId,
      status,
      model: getString(fields.model),
      durationMs: getNumber(fields.durationMs),
      tokens: getNumber(fields.tokens),
      toolUses: getNumber(fields.toolUses),
      word: getString(fields.word),
      length: getNumber(fields.length),
      capped,
    }
    : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
