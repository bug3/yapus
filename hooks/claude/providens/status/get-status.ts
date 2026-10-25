import { countLaunches, LIMIT } from '../../tyler/launch/admit-launch.ts';
import { readMode } from '../settings/read-mode.ts';
import { type ResolvedSetting, resolveSetting } from '../settings/resolve-setting.ts';

// The three lines of the status: the mode and the launch limit in force, each
// with its source, and the launches the limit counts for the session. A file
// that holds no valid value is named in place of the value.
export function getStatus(dataDir: string, sessionId: string): string {
  const mode = describe(readMode(dataDir, sessionId), 'mode');
  const limit = describe(resolveLimit(dataDir, sessionId), 'whole number');

  return `mode: ${ mode }\nlaunch limit: ${ limit }\n`
    + `launches this session: ${ String(countLaunches(dataDir, sessionId)) }\n`;
}

function resolveLimit(dataDir: string, sessionId: string): ResolvedSetting<number> {
  return resolveSetting(dataDir, sessionId, LIMIT);
}

function describe<T>(setting: ResolvedSetting<T>, noun: string): string {
  return setting.kind === 'invalid'
    ? `${ setting.path } holds no ${ noun }`
    : `${ String(setting.value) } (${ setting.source })`;
}
