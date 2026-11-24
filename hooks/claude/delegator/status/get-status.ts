import { countLaunches } from '../../gates/launch/admit-launch.ts';
import { RETURN_WORDS_PATH, readReturnWords } from '../contract/read-return-words.ts';
import { readLimit } from '../settings/read-limit.ts';
import { readMode } from '../settings/read-mode.ts';
import type { ResolvedSetting } from '../settings/resolve-setting.ts';
import { getWaits } from './get-waits.ts';

// The three lines of the status: the mode and the launch limit in force, each
// with its source, and the launches the limit counts for the session. A file
// that holds no valid value is named in place of the value. After them, the
// lines of the session's background launches that wait at the time now.
export function getStatus(dataDir: string, sessionId: string, now: Date): string {
  const mode = describe(readMode(dataDir, sessionId), 'mode');
  const limit = describe(readLimit(dataDir, sessionId), 'whole number');
  const waits = getWaits({ dataDir, sessionId }, now, readReturnWords(RETURN_WORDS_PATH));

  return `mode: ${ mode }\nlaunch limit: ${ limit }\n`
    + `launches this session: ${ String(countLaunches(dataDir, sessionId)) }\n${ waits }`;
}

function describe<T>(setting: ResolvedSetting<T>, noun: string): string {
  return setting.kind === 'invalid'
    ? `${ setting.path } holds no ${ noun }`
    : `${ String(setting.value) } (${ setting.source })`;
}
