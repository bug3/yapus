import { LEFT_OUT_PLACEHOLDER, PATH_PLACEHOLDER, type Texts } from './read-texts.ts';

// The most characters the recall adds, so the policy beside it at the same
// compaction stays under Claude Code's cap on added context.
export const BUDGET_CHARACTERS = 6000;

// A prompt longer than this is cut to its start, so one long paste does not
// push out every prompt before it.
export const CUT_CHARACTERS = 2000;

const SEPARATOR = '\n\n';

// One line of the prompt log.
export interface LoggedPrompt {
  readonly time: string;
  readonly prompt: string;
}

// The header, the latest prompts that fit the budget, oldest first, each with
// its time, and the log's path last; undefined when even the header and the
// path pass the budget.
export function formatRecall(
  texts: Texts,
  prompts: readonly LoggedPrompt[],
  logPath: string,
): string | undefined {
  const blocks = prompts.map((prompt) => formatPrompt(prompt, texts.cutMark));
  const pathLine = texts.pathLine.replace(PATH_PLACEHOLDER, () => logPath);
  const join = (keptCount: number): string => {
    const leftOut = String(blocks.length - keptCount);
    const header = texts.header.replace(LEFT_OUT_PLACEHOLDER, () => leftOut);

    return [header, ...blocks.slice(blocks.length - keptCount), pathLine].join(SEPARATOR);
  };
  const keptCounts = [...blocks.keys(), blocks.length].map((index) => blocks.length - index);
  const keptCount = keptCounts.find((count) => join(count).length <= BUDGET_CHARACTERS);

  return keptCount === undefined ? undefined : join(keptCount);
}

function formatPrompt({ time, prompt }: LoggedPrompt, cutMark: string): string {
  const text = prompt.length > CUT_CHARACTERS ? `${ cut(prompt) }\n${ cutMark }` : prompt;

  return `${ time }\n${ text }`;
}

// The start of the prompt, without the first half of a character the limit
// splits, so the context never carries a lone surrogate.
function cut(prompt: string): string {
  const start = prompt.slice(0, CUT_CHARACTERS);

  return start.isWellFormed() ? start : start.slice(0, -1);
}
