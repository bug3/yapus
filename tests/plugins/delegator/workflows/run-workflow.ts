import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { isRecord } from '../../../../hooks/shared/is-record.ts';

export interface AgentCall {
  readonly prompt: string;
  readonly options: Readonly<Record<string, unknown>>;
}

export interface WorkflowRun {
  readonly meta: unknown;
  readonly returned: unknown;
  readonly calls: readonly AgentCall[];
  readonly logs: readonly string[];
  readonly phases: readonly string[];
}

interface ScriptParts {
  readonly metaJson: string;
  readonly body: string;
}

const META_START = 'export const meta = ';
const META_LAST_LINE = '}';

// The workflow runtime throws on a clock and on a random number; a realm
// that holds neither fails a script on the same lines.
const DROP_CLOCK_AND_RANDOM = 'delete globalThis.Date; delete Math.random;';

// Runs a workflow script of a plugin against stand-ins for what the workflow
// runtime gives it: `agent`, `parallel`, `phase`, `log` and `args`, and no
// `pipeline`, `workflow`, `Date`, `Math.random`, `process` or `require`.
// `answer` gives what a workflow agent returns, JSON null for a skipped
// workflow agent, and throws for a rejected one. `returned` and the options
// of each call are copies a test compares with deepEqual. The promise rejects
// for a meta that is not JSON, a script that does not parse and an error the
// script throws.
export async function runWorkflow(
  scriptPath: string,
  args: unknown,
  answer: (call: AgentCall) => unknown,
): Promise<WorkflowRun> {
  const { metaJson, body } = splitScript(scriptPath);
  const meta: unknown = JSON.parse(metaJson);
  const calls: AgentCall[] = [];
  const logs: string[] = [];
  const phases: string[] = [];

  const realm = createContext({
    args,
    agent: (prompt: string, options: unknown) => {
      const call = { prompt, options: copyOptions(options) };

      calls.push(call);

      // An answer that throws reaches the script as a rejection.
      return Promise.try(() => answer(call));
    },
    parallel: (thunks: readonly (() => unknown)[]) => Promise.all(thunks.map((thunk) => thunk())),
    phase: (title: string) => {
      phases.push(title);
    },
    log: (line: string) => {
      logs.push(line);
    },
  });

  runInContext(DROP_CLOCK_AND_RANDOM, realm);

  // The body of an async function, where a top-level return and await parse
  // and an import does not, in strict mode, as the workflow runtime runs it.
  const returned: unknown = await runInContext(
    `(async () => { 'use strict';\n${ body }\n})()`,
    realm,
  );

  return { meta, returned: copyIntoThisRealm(returned), calls, logs, phases };
}

// The meta runs from META_START through the first line that is `}` alone;
// the body is every line after it.
function splitScript(scriptPath: string): ScriptParts {
  const scriptText = readFileSync(scriptPath, 'utf8');
  const lines = scriptText.split('\n');
  const metaLastIndex = lines.indexOf(META_LAST_LINE);

  if (!scriptText.startsWith(META_START) || metaLastIndex === -1) {
    throw new Error(
      `${ scriptPath }: no meta from "${ META_START }" to a line that is "${ META_LAST_LINE }" alone`,
    );
  }

  return {
    metaJson: lines.slice(0, metaLastIndex + 1).join('\n').slice(META_START.length),
    body: lines.slice(metaLastIndex + 1).join('\n'),
  };
}

// A call without options records none.
function copyOptions(options: unknown): Readonly<Record<string, unknown>> {
  const copy = copyIntoThisRealm(options);

  return isRecord(copy) ? copy : {};
}

// An object of the script's realm has that realm's prototype, so deepEqual
// tells it from one a test writes; a copy through JSON is built here. The
// wrapper keeps undefined, which has no JSON text, as an absent key.
function copyIntoThisRealm(original: unknown): unknown {
  const wrapper: unknown = JSON.parse(JSON.stringify({ copy: original }));

  return isRecord(wrapper) ? wrapper.copy : undefined;
}
