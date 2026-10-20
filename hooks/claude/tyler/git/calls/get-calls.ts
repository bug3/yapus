import type { CommandItem, Item, Word } from '../shell/split-commands.ts';
import { readGitOptions } from './read-git-options.ts';
import { type Cursor, readWrapper } from './read-wrapper.ts';

export interface Call {
  readonly tool: 'git' | 'gh';
  readonly words: readonly Word[];
  readonly configs: readonly Word[];
  readonly assignments: readonly string[];
}

export interface CallsFound {
  readonly kind: 'calls';
  readonly calls: readonly Call[];
}

export interface CallsUnjudgeable {
  readonly kind: 'unjudgeable';
  readonly reason: string;
}

export type Calls = CallsFound | CallsUnjudgeable;

interface CommandCall {
  readonly kind: 'call';
  readonly call: Call;
}

interface NoCall {
  readonly kind: 'none';
}

const NO_CALL: NoCall = { kind: 'none' };

export function getCalls(items: readonly Item[]): Calls {
  const calls: Call[] = [];

  for (const item of items) {
    if (item.kind !== 'command') {
      continue;
    }

    const found = readCommand(item);

    if (found.kind === 'unjudgeable') {
      return found;
    }

    if (found.kind === 'call') {
      calls.push(found.call);
    }
  }

  return { kind: 'calls', calls };
}

function readCommand(
  item: CommandItem,
): CommandCall | NoCall | CallsUnjudgeable {
  const cursor: Cursor = { index: 0, assignments: [] };

  for (;;) {
    const reading = readWrapper(item.words, cursor);

    if (reading.kind === 'unjudgeable') {
      return reading;
    }

    if (reading.kind === 'ended') {
      return NO_CALL;
    }

    if (reading.kind === 'program') {
      return readProgram(item.words, cursor);
    }
  }
}

function readProgram(
  words: readonly Word[],
  cursor: Cursor,
): CommandCall | NoCall | CallsUnjudgeable {
  const program = words[cursor.index];

  if (program === undefined) {
    return NO_CALL;
  }

  if (program.isOpaque) {
    return {
      kind: 'unjudgeable',
      reason: 'a program name the gate cannot read',
    };
  }

  // macOS file systems ignore case, so `GIT` runs git.
  const name = program.text.slice(program.text.lastIndexOf('/') + 1);
  const base = name.toLowerCase();
  const { assignments } = cursor;

  if (base === 'gh') {
    const call: Call = {
      tool: 'gh',
      words: words.slice(cursor.index + 1),
      configs: [],
      assignments,
    };

    return { kind: 'call', call };
  }

  if (base.startsWith('git-')) {
    const subcommand: Word = { text: name.slice('git-'.length), isOpaque: false };
    const call: Call = {
      tool: 'git',
      words: [subcommand, ...words.slice(cursor.index + 1)],
      configs: [],
      assignments,
    };

    return { kind: 'call', call };
  }

  if (base !== 'git') {
    return NO_CALL;
  }

  const options = readGitOptions(words, cursor.index + 1);

  if (options.kind === 'unjudgeable') {
    return options;
  }

  const call: Call = {
    tool: 'git',
    words: options.words,
    configs: options.configs,
    assignments,
  };

  return { kind: 'call', call };
}
