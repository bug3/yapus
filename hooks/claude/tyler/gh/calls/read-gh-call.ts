import { ghCommands, type GhAction } from '../rules/gh-commands.ts';
import type { Word } from '../shell/split-commands.ts';
import { skipLeadWords } from './skip-lead-words.ts';

export interface GhCall {
  readonly action: GhAction;
  // The words after the action, its options and operands.
  readonly argumentWords: readonly Word[];
}

const PROGRAM = 'gh';
const ACTION_WORDS = 2;

const ACTIONS: readonly GhAction[] = Object.keys(ghCommands.actions).filter(isGhAction);

// The gh action a command runs when it is one this check judges, whatever
// spelling it is written in, or undefined.
export function readGhCall(words: readonly Word[]): GhCall | undefined {
  const [program, ...rest] = skipLeadWords(words);
  const written = rest.slice(0, ACTION_WORDS).map(({ text }) => text).join(' ');
  const action = ACTIONS.find((name) => ghCommands.actions[name].spellings.includes(written));

  return program === undefined || !isGh(program.text) || action === undefined
    ? undefined
    : { action, argumentWords: rest.slice(ACTION_WORDS) };
}

function isGhAction(name: string): name is GhAction {
  return Object.hasOwn(ghCommands.actions, name);
}

// `gh`, or a path to it.
function isGh(text: string): boolean {
  return text === PROGRAM || text.endsWith(`/${ PROGRAM }`);
}
