import type { Call } from '../../calls/get-calls.ts';
import { knownCommands } from './known-commands.ts';

// A reason to refuse a git or gh command the gate does not know, or undefined.
export function getUnknownRefusal(call: Call): string | undefined {
  const first = call.words[0]?.text;

  if (first === undefined) {
    return undefined;
  }

  const name = call.tool === 'git' ? first.toLowerCase() : first;

  if (knownCommands[call.tool].includes(name)) {
    return undefined;
  }

  return `\`${ call.tool } ${ first }\` is not a command the gate knows `
    + '(an alias or extension); a person runs it';
}
