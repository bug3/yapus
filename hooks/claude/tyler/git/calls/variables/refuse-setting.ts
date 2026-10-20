import type { Word } from '../../shell/split-commands.ts';
import type { Call } from '../get-calls.ts';
import { bypassCatalog } from '../../rules/bypass/bypass-catalog.ts';
import { assignedName, type Unreadable } from '../read-wrapper.ts';
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

// The refusal for a NAME=VALUE word of `call`, the call the command makes if any, or
// undefined. A GIT_CONFIG* one on a git call is left to the rules, which read the call's
// assignments; a program variable passes only with a literal harmless value.
export function refuseSetting(word: Word, call: Call | undefined): Unreadable | undefined {
  const name = assignedName(word.text);

  if (isConfigName(name)) {
    return call?.tool === 'git' ? undefined : CONFIG_REFUSAL;
  }

  if (!variableSpecs.programVariables.includes(name)) {
    return undefined;
  }

  const value = word.text.slice(word.text.indexOf('=') + 1);
  const isHarmless = variableSpecs.harmlessPrograms.includes(value);

  // An opaque value holds an expansion, so it is never one of the literal harmless values.
  return isHarmless
    ? undefined
    : {
      kind: 'unjudgeable',
      reason: `${ name } names a program the gate cannot read`,
      shouldAlwaysDeny: false,
    };
}
