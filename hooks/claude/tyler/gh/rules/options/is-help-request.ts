import type { GhArguments } from '../read-gh-arguments.ts';

// Whether the call asks for help: gh prints the help and creates nothing.
export function isHelpRequest(args: GhArguments): boolean {
  return args.flags.get('help') === true;
}
