import { join } from 'node:path';
import { readSettingFile } from './read-setting-file.ts';

export type SettingSource = 'session' | 'global' | 'default';

export type ResolvedSetting<T> =
  | {
    readonly kind: 'value';
    readonly value: T;
    readonly source: SettingSource;
    readonly path: string;
  }
  | { readonly kind: 'invalid'; readonly path: string };

export interface Setting<T> {
  readonly name: string;
  readonly parse: (text: string) => T | undefined;
  readonly fallback: T;
}

// The file a setting is written in: the session's <dataDir>/sessions/
// <sessionId>.<name>, or with no session id the global <dataDir>/<name>.
export function getSettingPath(dataDir: string, name: string, sessionId?: string): string {
  return sessionId === undefined
    ? join(dataDir, name)
    : join(dataDir, 'sessions', `${ sessionId }.${ name }`);
}

// Resolves a setting the person wrote: the session's file <dataDir>/sessions/
// <sessionId>.<name>, else the global file <dataDir>/<name>, else the fallback.
// The first file that exists decides; an invalid one is returned, never skipped.
// A value carries the path that decided, or for the fallback the global path.
export function resolveSetting<T>(
  dataDir: string,
  sessionId: string,
  setting: Setting<T>,
): ResolvedSetting<T> {
  const { name, parse, fallback } = setting;
  const candidates = [
    { path: getSettingPath(dataDir, name, sessionId), source: 'session' },
    { path: getSettingPath(dataDir, name), source: 'global' },
  ] as const;

  for (const { path, source } of candidates) {
    const file = readSettingFile(path, parse);

    if (file.kind === 'invalid') {
      return { kind: 'invalid', path };
    }

    if (file.kind === 'value') {
      return { kind: 'value', value: file.value, source, path };
    }
  }

  return {
    kind: 'value',
    value: fallback,
    source: 'default',
    path: getSettingPath(dataDir, name),
  };
}
