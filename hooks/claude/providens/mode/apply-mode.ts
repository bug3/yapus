import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getContext, POLICY_PATH } from '../policy/get-context.ts';
import { readMode } from '../settings/read-mode.ts';
import type { ModeChange } from './parse-args.ts';

const OFF_PATH = join(import.meta.dirname, 'off.md');

export type Applied =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'failure'; readonly detail: string };

// Writes the mode to the session's file, or to the global one, and returns
// what the model needs for the mode now in force: a first line naming the
// file and that mode with its source, then the policy for on, the off line
// for off. A mode file that holds neither on nor off gets the policy, so
// the rules hold. The mode is written even when the policy cannot be read.
export function applyMode(dataDir: string, sessionId: string, change: ModeChange): Applied {
  const path = write(dataDir, sessionId, change);
  const inForce = readMode(dataDir, sessionId);

  if (inForce.kind === 'value' && inForce.value === 'off') {
    const first = describeWrite(path, `this session is off (${ inForce.source })`);

    return { kind: 'text', text: `${ first }\n${ readFileSync(OFF_PATH, 'utf8') }` };
  }

  const context = getContext(POLICY_PATH);

  if (context.kind === 'failure') {
    return context;
  }

  const state = inForce.kind === 'value'
    ? `this session is on (${ inForce.source })`
    : `${ inForce.path } holds no mode, so the rules apply`;

  return {
    kind: 'text',
    text: `${ describeWrite(path, state) }\n${ readFileSync(POLICY_PATH, 'utf8') }`,
  };
}

function describeWrite(path: string, state: string): string {
  return `wrote ${ path }; ${ state }`;
}

function write(dataDir: string, sessionId: string, change: ModeChange): string {
  const { mode, isGlobal } = change;
  const path = isGlobal ? join(dataDir, 'mode') : join(dataDir, 'sessions', `${ sessionId }.mode`);

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${ mode }\n`);

  return path;
}
