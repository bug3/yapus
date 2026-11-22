import { readFileSync } from 'node:fs';
import { isRecord } from '../../shared/is-record.ts';

const EXCLUDES_KEY = 'claudeMdExcludes';
const STANDARDS_PATTERN = '**/.claude/rules/yapus/ordo/**';
const MISSING_FILE_CODE = 'ENOENT';

export type ExclusionMode = 'exclude' | 'include';

export type SettingsMerge =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'changed'; readonly settingsText: string }
  | { readonly kind: 'refused'; readonly violation: string };

type Settings = Readonly<Record<string, unknown>>;

const UNCHANGED: SettingsMerge = { kind: 'unchanged' };

// The settings file at path once mode is applied to the pattern that keeps
// the ordo standards from loading: exclude adds it once, include takes it out.
// Other keys and entries stay; a file that is not a JSON object, or whose
// excludes are not an array of strings, is refused, as the person wrote it.
export function mergeSettings(path: string, mode: ExclusionMode): SettingsMerge {
  const settingsText = readSettingsText(path);

  if (settingsText === undefined) {
    return mode === 'exclude' ? toChanged({ [EXCLUDES_KEY]: [STANDARDS_PATTERN] }) : UNCHANGED;
  }

  let settings: unknown;

  try {
    settings = JSON.parse(settingsText);
  } catch {
    return refuse(`${ path } is not JSON`);
  }

  if (!isRecord(settings)) {
    return refuse(`${ path } is not a JSON object`);
  }

  const excludes = Object.hasOwn(settings, EXCLUDES_KEY) ? settings[EXCLUDES_KEY] : [];

  if (!isStringArray(excludes)) {
    return refuse(`${ EXCLUDES_KEY } in ${ path } is not an array of strings`);
  }

  return mode === 'exclude' ? addPattern(settings, excludes) : removePattern(settings, excludes);
}

// A missing file is undefined; any other read error is a defect to report.
function readSettingsText(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === MISSING_FILE_CODE) {
      return undefined;
    }

    throw error;
  }
}

function addPattern(settings: Settings, excludes: readonly string[]): SettingsMerge {
  return excludes.includes(STANDARDS_PATTERN)
    ? UNCHANGED
    : toChanged({ ...settings, [EXCLUDES_KEY]: [...excludes, STANDARDS_PATTERN] });
}

// An array left empty leaves the settings; an object left empty stays as {},
// so no file of the person's is deleted.
function removePattern(settings: Settings, excludes: readonly string[]): SettingsMerge {
  if (!excludes.includes(STANDARDS_PATTERN)) {
    return UNCHANGED;
  }

  const kept = excludes.filter((pattern) => pattern !== STANDARDS_PATTERN);
  const rest = Object.entries(settings).filter(([key]) => key !== EXCLUDES_KEY);

  return toChanged(
    kept.length === 0 ? Object.fromEntries(rest) : { ...settings, [EXCLUDES_KEY]: kept },
  );
}

function isStringArray(excludes: unknown): excludes is string[] {
  return Array.isArray(excludes) && excludes.every((pattern) => typeof pattern === 'string');
}

function toChanged(settings: Settings): SettingsMerge {
  return { kind: 'changed', settingsText: `${ JSON.stringify(settings, undefined, 2) }\n` };
}

function refuse(violation: string): SettingsMerge {
  return { kind: 'refused', violation };
}
