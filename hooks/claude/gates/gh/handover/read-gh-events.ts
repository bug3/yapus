import type { MemoryEvent } from '../../../delegator/memory/parse-event.ts';
import { skipLeadWords } from '../calls/skip-lead-words.ts';
import { ghCommands } from '../rules/gh-commands.ts';
import { splitCommands, type Word } from '../shell/split-commands.ts';

type GhEvent = Extract<MemoryEvent, { readonly kind: 'gh' }>;

const PROGRAM = 'gh';

// The gh calls a command line makes, in order, each as the event a rule names
// it by: the two words after `gh`, a spelling of a judged action read as its
// command, `gh pr new` as `gh pr create`. A command that cannot be split
// gives none.
export function readGhEvents(command: string): readonly GhEvent[] {
  const split = splitCommands(command);

  return 'failure' in split
    ? []
    : split.commands.map((words) => readGhEvent(words)).filter((event) => event !== undefined);
}

// Whether a rule's event is one of the events of a command line; the rule's
// own words are read as a call's are, so a rule may name any spelling.
export function holdsEvent(ghEvents: readonly GhEvent[], event: MemoryEvent): boolean {
  if (event.kind !== 'gh') {
    return false;
  }

  const { group, action } = readCommandEvent(event.group, event.action);

  return ghEvents.some((called) => called.group === group && called.action === action);
}

function readGhEvent(words: readonly Word[]): GhEvent | undefined {
  const [program, group, action] = skipLeadWords(words);
  const isCall = program !== undefined && isGh(program.text);

  return isCall && group !== undefined && action !== undefined
    ? readCommandEvent(group.text, action.text)
    : undefined;
}

// `gh`, or a path to it.
function isGh(text: string): boolean {
  return text === PROGRAM || text.endsWith(`/${ PROGRAM }`);
}

// The event of the two words after `gh`: the command of the judged action
// they spell, or the words as they are written.
function readCommandEvent(group: string, action: string): GhEvent {
  const judged = Object.values(ghCommands.actions)
    .find(({ spellings }) => spellings.includes(`${ group } ${ action }`));
  const [, commandGroup = group, commandAction = action] = judged?.command.split(' ') ?? [];

  return { kind: 'gh', group: commandGroup, action: commandAction };
}
