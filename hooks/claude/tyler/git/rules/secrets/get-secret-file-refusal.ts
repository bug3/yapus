import { getCalls } from '../../calls/get-calls.ts';
import { programName } from '../../calls/program-name.ts';
import { isRunner, readRunner } from '../../calls/read-runner.ts';
import { runnerSpecs } from '../../calls/runner-specs.ts';
import {
  type CommandItem,
  type Item,
  splitCommands,
  type Word,
} from '../../shell/split-commands.ts';
import { isSecretFile } from './is-secret-file.ts';
import { isSecretGlob } from './is-secret-glob.ts';
import { secretFiles } from './secret-files.ts';

// A reason to refuse a line whose commands name a file that holds secrets, or
// undefined. Every command is judged, git or not, and so is the string a shell runs
// (`bash -c 'cat .env'`); an opaque word is not (`cat "$F"`).
export function getSecretFileRefusal(
  items: readonly Item[],
  home: string | undefined,
  depth = 0,
): string | undefined {
  for (const item of items) {
    if (item.kind === 'command') {
      const reason = getItemRefusal(item, home) ?? getNestedRefusal(item, home, depth);

      if (reason !== undefined) {
        return reason;
      }
    }
  }

  return undefined;
}

function getItemRefusal(item: CommandItem, home: string | undefined): string | undefined {
  const [program] = item.words;
  const file = findSecretFile(item);

  if (file === undefined || isAllowed(item, home)) {
    return undefined;
  }

  // A redirection on a group of commands leaves an item with no program.
  return program === undefined
    ? secretFiles.reasons.groupShown(file.text)
    : secretFiles.reasons.shown(programName(program.text), file.text);
}

// The first literal word or input target that names a secret file, or opaque word whose
// glob could. The code of an
// interpreter is cut into names, since the file is a string inside it.
function findSecretFile(item: CommandItem): Word | undefined {
  const isInterpreted = item.words.some(isInterpreter);
  const names = (word: Word): boolean => word.isOpaque
    ? isSecretGlob(word.text)
    : isSecretFile(word.text)
      || isInterpreted && word.text.split(secretFiles.nameBreaks).some(isSecretFile);

  return [...item.words, ...item.inputTargets].find(names);
}

function isInterpreter(word: Word): boolean {
  const base = programName(word.text);
  const unversioned = runnerSpecs.versionedName.exec(base)?.[1] ?? base;

  return !word.isOpaque
    && (secretFiles.interpreters.includes(base) || secretFiles.interpreters.includes(unversioned));
}

// The strings a program in the command runs as a shell (`env bash -c STRING`); a
// wrapper in front does not hide it, since every word is tried as a program.
function getNestedRefusal(
  item: CommandItem,
  home: string | undefined,
  depth: number,
): string | undefined {
  if (depth >= secretFiles.maxNesting) {
    return undefined;
  }

  for (const [index, word] of item.words.entries()) {
    const base = programName(word.text);
    const run = word.isOpaque || !isRunner(base)
      ? undefined
      : readRunner(base, item.words, index + 1);
    const split = run?.kind === 'resplit' ? splitCommands(run.text, home) : undefined;
    const reason = split?.kind === 'items'
      ? getSecretFileRefusal(split.items, home, depth + 1)
      : undefined;

    if (reason !== undefined) {
      return reason;
    }
  }

  return undefined;
}

// Whether the command's program never shows a file's content. A git item is read
// through the git call reader for its subcommand; one it cannot read has no allowance.
function isAllowed(item: CommandItem, home: string | undefined): boolean {
  const [program] = item.words;

  if (program === undefined || program.isOpaque) {
    return false;
  }

  const base = programName(program.text);

  if (secretFiles.allowed.programs.includes(base)) {
    return true;
  }

  const found = base === 'git' ? getCalls([item], home) : undefined;
  const call = found?.kind === 'calls' ? found.calls[0] : undefined;
  const [subcommand, ...rest] = call?.tool === 'git' ? call.words : [];

  return subcommand !== undefined && (
    secretFiles.allowed.gitSubcommands.includes(subcommand.text)
    || secretFiles.allowed.gitFlagged.some((allowed) =>
      allowed.subcommand === subcommand.text
      && rest.some((word) => word.text === allowed.flag))
  );
}
