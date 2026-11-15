import {
  LEFT_OUT_PLACEHOLDER,
  PATH_PLACEHOLDER,
  PLANS_PLACEHOLDER,
  type Texts,
} from './read-texts.ts';

// The most characters the recall adds, so the policy beside it at the same
// compaction stays under Claude Code's cap on added context.
export const BUDGET_CHARACTERS = 6000;

// A prompt longer than this is cut to its start, so one long paste does not
// push out every prompt before it.
export const CUT_CHARACTERS = 2000;

const SEPARATOR = '\n\n';
const PLANS_SEPARATOR = ', ';

// One line of the prompt log.
export interface LoggedPrompt {
  readonly time: string;
  readonly prompt: string;
}

// Where the prompt log and the project's plan files are.
export interface Paths {
  readonly logPath: string;
  readonly planPaths: readonly string[];
}

// The header, the latest prompts that fit the budget, oldest first, each with
// its time, the log's path, and the plans line when there are plan paths;
// with no prompt, the plans line alone. Undefined when the fixed lines alone
// pass the budget.
export function formatRecall(
  texts: Texts,
  prompts: readonly LoggedPrompt[],
  { logPath, planPaths }: Paths,
): string | undefined {
  const plansLines = planPaths.length === 0
    ? []
    : [texts.plansLine.replace(PLANS_PLACEHOLDER, () => planPaths.join(PLANS_SEPARATOR))];

  if (prompts.length === 0) {
    const plansOnly = plansLines.join(SEPARATOR);

    return plansOnly.length <= BUDGET_CHARACTERS ? plansOnly : undefined;
  }

  const blocks = prompts.map((prompt) => formatPrompt(prompt, texts.cutMark));
  const pathLine = texts.pathLine.replace(PATH_PLACEHOLDER, () => logPath);
  const join = (keptCount: number): string => {
    const leftOut = String(blocks.length - keptCount);
    const header = texts.header.replace(LEFT_OUT_PLACEHOLDER, () => leftOut);
    const kept = blocks.slice(blocks.length - keptCount);

    return [header, ...kept, pathLine, ...plansLines].join(SEPARATOR);
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
