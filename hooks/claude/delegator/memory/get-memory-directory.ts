import { join } from 'node:path';

// The directories of a project's memory, one level deep: open items, how to
// act in a named situation, and the rest.
export const DIRECTORIES = ['work', 'rules', 'reference'] as const;

export type Directory = typeof DIRECTORIES[number];

// The directory of a project's memory, under the directory the session was
// opened in and beside the plans and the sessions.
export function getMemoryDirectory(projectRoot: string): string {
  return join(projectRoot, '.yapus', 'memory');
}
