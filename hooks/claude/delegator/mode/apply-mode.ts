import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { POLICY_PATH, readPolicy } from '../policy/get-context.ts';
import { MODE, readMode } from '../settings/read-mode.ts';
import { getSettingPath } from '../settings/resolve-setting.ts';
import type { ModeChange } from './parse-args.ts';

const OFF_PATH = join(import.meta.dirname, 'off.md');

export type Applied =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'failure'; readonly detail: string };

// Writes the mode to the session's file, or to the global one, and returns
// what the main agent needs for the mode now in force: a first line naming
// the file and that mode with its source, then the policy for on, the off
// line for off. A mode file that holds neither on nor off gets the policy, so
// the rules hold. The mode is written even when the policy cannot be read.
export function applyMode(dataDir: string, sessionId: string, change: ModeChange): Applied {
  const path = write(dataDir, sessionId, change);
  const inForce = readMode(dataDir, sessionId);

  if (inForce.kind === 'value' && inForce.value === 'off') {
    const first = describeWrite(path, `this session is off (${ inForce.source })`);

    return { kind: 'text', text: `${ first }\n${ readFileSync(OFF_PATH, 'utf8') }` };
  }

  const policy = readPolicy(POLICY_PATH);

  if (policy.kind === 'failure') {
    return policy;
  }

  const state = inForce.kind === 'value'
    ? `this session is on (${ inForce.source })`
    : `${ inForce.path } holds no mode, so the rules apply`;

  return {
    kind: 'text',
    text: `${ describeWrite(path, state) }\n${ policy.text }`,
  };
}

function describeWrite(path: string, state: string): string {
  return `wrote ${ path }; ${ state }`;
}

function write(dataDir: string, sessionId: string, change: ModeChange): string {
  const { mode, isGlobal } = change;
  const path = getSettingPath(dataDir, MODE.name, isGlobal ? undefined : sessionId);

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${ mode }\n`);

  return path;
}
