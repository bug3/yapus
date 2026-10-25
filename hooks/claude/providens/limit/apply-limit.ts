import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { LIMIT, readLimit } from '../settings/read-limit.ts';
import { getSettingPath } from '../settings/resolve-setting.ts';
import type { LimitChange } from './parse-args.ts';

export interface Applied {
  readonly text: string;
}

// Writes the limit to the session's file, or to the global one, and returns
// one line naming the file and the limit now in force for the session with
// its source. A limit file that holds no whole number is named instead.
export function applyLimit(dataDir: string, sessionId: string, change: LimitChange): Applied {
  const path = write(dataDir, sessionId, change);
  const inForce = readLimit(dataDir, sessionId);
  const state = inForce.kind === 'value'
    ? `this session's launch limit is ${ String(inForce.value) } (${ inForce.source })`
    : `${ inForce.path } holds no whole number, so launches are refused`;

  return { text: `wrote ${ path }; ${ state }\n` };
}

function write(dataDir: string, sessionId: string, change: LimitChange): string {
  const { limit, isGlobal } = change;
  const path = getSettingPath(dataDir, LIMIT.name, isGlobal ? undefined : sessionId);

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${ String(limit) }\n`);

  return path;
}
