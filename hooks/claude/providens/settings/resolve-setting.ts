import { join } from 'node:path';
import { readSettingFile } from './read-setting-file.ts';

export type SettingSource = 'session' | 'global' | 'default';

export type ResolvedSetting<T> =
  | { readonly kind: 'value'; readonly value: T; readonly source: SettingSource }
  | { readonly kind: 'invalid'; readonly path: string };

export interface Setting<T> {
  readonly name: string;
  readonly parse: (text: string) => T | undefined;
  readonly fallback: T;
}

// Resolves a setting the person wrote: the session's file <dataDir>/sessions/
// <sessionId>.<name>, else the global file <dataDir>/<name>, else the fallback.
// The first file that exists decides; an invalid one is returned, never skipped.
export function resolveSetting<T>(
  dataDir: string,
  sessionId: string,
  setting: Setting<T>,
): ResolvedSetting<T> {
  const { name, parse, fallback } = setting;
  const candidates = [
    { path: join(dataDir, 'sessions', `${ sessionId }.${ name }`), source: 'session' },
    { path: join(dataDir, name), source: 'global' },
  ] as const;

  for (const { path, source } of candidates) {
    const file = readSettingFile(path, parse);

    if (file.kind === 'invalid') {
      return { kind: 'invalid', path };
    }

    if (file.kind === 'value') {
      return { kind: 'value', value: file.value, source };
    }
  }

  return { kind: 'value', value: fallback, source: 'default' };
}
