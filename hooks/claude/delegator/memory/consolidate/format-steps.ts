import {
  BACKUP_PLACEHOLDER,
  MEMORY_PATH_PLACEHOLDER,
  type ConsolidateTexts,
  MOVES_PATH_PLACEHOLDER,
} from './read-consolidate-texts.ts';
import type { Moves, Step } from './read-moves.ts';

// The list a run prints before it changes a file: one line per step a run
// before it made, then one per step in the order the steps are made, then
// one per topic file no step names.
export function formatSteps({ steps, made, kept }: Moves): string[] {
  return [
    ...made.map((step) => `${ formatStep(step) }, already made`),
    ...steps.map((step) => formatStep(step)),
    ...kept.map((file) => `${ file } kept`),
  ];
}

export function formatStep(step: Step): string {
  return step.kind === 'remove'
    ? `${ step.file } removed`
    : `${ step.file } -> ${ step.directory }/${ step.name }.md`;
}

export function formatBackup(autoDirectory: string, backupDirectory: string): string {
  return `backup: ${ autoDirectory } -> ${ backupDirectory }`;
}

// The first line of the run that created the project's memory directory. A
// path is filled through a function, since a replacement string would read
// a `$` of it as a pattern.
export function formatCreated(texts: ConsolidateTexts, memoryDirectory: string): string {
  return texts.created.replaceAll(MEMORY_PATH_PLACEHOLDER, () => memoryDirectory);
}

// What a run that finds no moves file prints: the guide, with the order a
// fact is sorted by under it.
export function formatGuide(
  texts: ConsolidateTexts,
  movesPath: string,
  sortingText: string,
): string {
  return `${ texts.guide.replaceAll(MOVES_PATH_PLACEHOLDER, () => movesPath) }\n${ sortingText }`;
}

export function formatDone(texts: ConsolidateTexts, backupDirectory: string): string {
  return texts.done.replaceAll(BACKUP_PLACEHOLDER, () => backupDirectory);
}
