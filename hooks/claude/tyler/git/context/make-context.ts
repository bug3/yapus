import { run, type Run } from './run.ts';

// What a rule may ask of the world: the directory of the tool call, and the one
// way to run a child process in it.
export interface Context {
  readonly cwd: string | undefined;
  readonly run: Run;
}

// The time from the start of judging to the end of its last child process: the
// stdin read may take 3 s of the hook's 10 s.
const JUDGING_MS = 6000;

// A context whose child processes all end within one deadline, counted from now.
export function makeContext(cwd: string | undefined): Context {
  const deadline = Date.now() + JUDGING_MS;

  return {
    cwd,
    run: (program, args, options) => run({ program, args, ...options }, { cwd, deadline }),
  };
}
