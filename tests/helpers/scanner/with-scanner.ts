import { delimiter } from 'node:path';
import type { FakeScanner } from './make-fake-scanner.ts';

// The environment with the fake scanner's directory first on PATH.
export function withScanner(env: NodeJS.ProcessEnv, scanner: FakeScanner): NodeJS.ProcessEnv {
  return { ...env, PATH: `${ scanner.directory }${ delimiter }${ env.PATH ?? '' }` };
}
