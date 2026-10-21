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
import { expandBraces } from './expand-braces.ts';
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
    ? secretFiles.reasons.groupShown(file)
    : secretFiles.reasons.shown(programName(program.text), file);
}

// The first literal word or input target that names a secret file, or opaque word whose
// glob could, as the text to show. The code of an interpreter, in its words and its
// heredocs, is cut into names, since the file is a string inside it; so is the heredoc
// of a shell.
function findSecretFile(item: CommandItem): string | undefined {
  const isInterpreted = item.words.some((word) => isProgramOf(word, secretFiles.interpreters));
  const isShell = item.words.some((word) => isProgramOf(word, secretFiles.shells));
  const names = (word: Word): boolean => namesSecret(word, isInterpreted);
  const inCode = isInterpreted || isShell
    ? item.heredocs.flatMap((body) => body.split(secretFiles.nameBreaks)).find(isSecretFile)
    : undefined;

  return [...item.words, ...item.inputTargets].find(names)?.text ?? inCode;
}

// Whether a word, with its brace groups expanded, names a secret file. A word the
// expander cannot read counts as secret when the shell would expand it (opaque); a
// quoted one is read as it stands.
function namesSecret(word: Word, isInterpreted: boolean): boolean {
  const expanded = expandBraces(word.text);

  if (expanded === undefined && word.isOpaque) {
    return true;
  }

  return (expanded ?? [word.text]).some((text) => word.isOpaque
    ? isSecretGlob(text) || text !== word.text && isSecretFile(text)
    : isSecretFile(text)
      || isInterpreted && text.split(secretFiles.nameBreaks).some(isSecretFile));
}

function isProgramOf(word: Word, programs: readonly string[]): boolean {
  const base = programName(word.text);
  const unversioned = runnerSpecs.versionedName.exec(base)?.[1] ?? base;

  return !word.isOpaque
    && (programs.includes(base) || programs.includes(unversioned));
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

  return item.words.some((word) => isProgramOf(word, secretFiles.shells))
    ? getHeredocRefusal(item, home, depth)
    : undefined;
}

// The heredoc of a shell is a script: its commands are judged whole. A body that does
// not split is left to the token check of `findSecretFile`, which reads every word of it.
function getHeredocRefusal(
  item: CommandItem,
  home: string | undefined,
  depth: number,
): string | undefined {
  for (const body of item.heredocs) {
    const split = splitCommands(body, home);
    const reason = split.kind === 'items'
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
