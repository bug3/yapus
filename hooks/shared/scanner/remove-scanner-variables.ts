import type { Scanner } from './read-scanner.ts';

// The environment without the variables that could name another config.
export function removeScannerVariables(
  scanner: Scanner,
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(([name]) => !scanner.removedVariables.includes(name)),
  );
}
