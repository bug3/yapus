import type { Word } from '../../shell/split-commands.ts';
import { bypassCatalog } from '../../rules/bypass/bypass-catalog.ts';
import type { Unreadable } from '../read-wrapper.ts';
import { variableSpecs } from './variable-specs.ts';

// In agent shells the GIT_CONFIG* variables are already exported, so setting or removing
// one changes the later git calls of the line.
export const CONFIG_REFUSAL: Unreadable = {
  kind: 'unjudgeable',
  reason: bypassCatalog.reasons.configEnvironment,
  shouldAlwaysDeny: false,
};

export function isConfigName(name: string): boolean {
  return name.startsWith(bypassCatalog.environmentConfigPrefix);
}

// Whether a word holds a GIT_CONFIG* name anywhere (`printf -vGIT_CONFIG_COUNT`), so a
// loop, `read`, `let` or an assignment may set it.
export function isConfigWord(word: Word): boolean {
  return word.text.includes(bypassCatalog.environmentConfigPrefix);
}

export const AGENT_REFUSAL: Unreadable = {
  kind: 'unjudgeable',
  reason: 'CLAUDECODE marks the shell as an agent\'s; a person changes it',
  shouldAlwaysDeny: false,
};

export function isAgentName(name: string): boolean {
  return variableSpecs.agentVariables.includes(name);
}

// The refusal for a word that may set a variable whose value git runs as a program, or
// undefined: the name alone (`read PAGER`), with `=`, `+=`, `[`, `++` or `--` after it,
// `-vNAME` (`printf -v`), or a value naming it (`declare -n p=PAGER`). An assignment of
// a literal harmless value passes.
export function refuseWatchedWord(word: Word): Unreadable | undefined {
  const { text } = word;
  const value = text.slice(text.indexOf('=') + 1);
  const name = [
    ...variableSpecs.programVariables,
    ...variableSpecs.hookVariables,
    ...variableSpecs.agentVariables,
  ].find((candidate) =>
    text === candidate
    || text === `-v${ candidate }`
    || (text.includes('=') && value === candidate)
    || variableSpecs.watchedSuffixes.some((suffix) =>
      text.startsWith(`${ candidate }${ suffix }`)));

  if (name === undefined) {
    return undefined;
  }

  if (isAgentName(name)) {
    return AGENT_REFUSAL;
  }

  if (variableSpecs.hookVariables.includes(name)) {
    return {
      kind: 'unjudgeable',
      reason: `${ name } names hooks the gate cannot read`,
      shouldAlwaysDeny: false,
    };
  }

  const isHarmless = text.startsWith(`${ name }=`)
    && variableSpecs.harmlessPrograms.includes(text.slice(name.length + 1));

  return isHarmless
    ? undefined
    : {
      kind: 'unjudgeable',
      reason: `${ name } names a program the gate cannot read`,
      shouldAlwaysDeny: false,
    };
}
