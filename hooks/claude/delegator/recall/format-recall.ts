import {
  LEFT_OUT_PLACEHOLDER,
  PATH_PLACEHOLDER,
  PLANS_PLACEHOLDER,
  type Texts,
} from './read-texts.ts';

// The most characters the recall adds, so the policy beside it at the same
// compaction stays under Claude Code's cap on added context.
export const BUDGET_CHARACTERS = 5850;

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

// Where the prompt log and the project's plan files are, and whether the
// project holds files in an older layout.
export interface Paths {
  readonly logPath: string;
  readonly planPaths: readonly string[];
  readonly hasOlderLayout: boolean;
}

// The header, the latest prompts that fit the budget, oldest first, each with
// its time, the log's path, the plans line when there are plan paths, and the
// notice when the project holds an older layout; with no prompt, the plans
// line and the notice alone. Undefined when the fixed lines alone pass the
// budget.
export function formatRecall(
  texts: Texts,
  prompts: readonly LoggedPrompt[],
  { logPath, planPaths, hasOlderLayout }: Paths,
): string | undefined {
  const plansLines = planPaths.length === 0
    ? []
    : [texts.plansLine.replace(PLANS_PLACEHOLDER, () => planPaths.join(PLANS_SEPARATOR))];
  const closingLines = hasOlderLayout ? [...plansLines, texts.notice] : plansLines;

  if (prompts.length === 0) {
    const closing = closingLines.join(SEPARATOR);

    return closing.length <= BUDGET_CHARACTERS ? closing : undefined;
  }

  const blocks = prompts.map((prompt) => formatPrompt(prompt, texts.cutMark));
  const pathLine = texts.pathLine.replace(PATH_PLACEHOLDER, () => logPath);
  const join = (keptCount: number): string => {
    const leftOut = String(blocks.length - keptCount);
    const header = texts.header.replace(LEFT_OUT_PLACEHOLDER, () => leftOut);
    const kept = blocks.slice(blocks.length - keptCount);

    return [header, ...kept, pathLine, ...closingLines].join(SEPARATOR);
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
