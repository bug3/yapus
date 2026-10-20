import { type Context, readSubstitution, type SubstitutionResult } from './read-substitution.ts';
import { makeFailure } from './read-word.ts';
import type { SplitFailure } from './split-commands.ts';

const PARAMETER = /^(?:[A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-])/;

// Reads a substitution or a parameter expansion that starts at `start`; a
// parameter expansion is a substitution read with no items.
export function readExpansion(line: string, start: number, context: Context): SubstitutionResult {
  const substitution = readSubstitution(line, start, context);

  if (substitution.kind !== 'none' || line.charAt(start) !== '$') {
    return substitution;
  }

  if (line.charAt(start + 1) === '{') {
    const end = readBraced(line, start + 2);

    return typeof end === 'number' ? { kind: 'substitution', items: [], end } : end;
  }

  const parameter = PARAMETER.exec(line.slice(start + 1));

  if (parameter === null) {
    return { kind: 'none' };
  }

  return { kind: 'substitution', items: [], end: start + 1 + parameter[0].length };
}

// Reads from just after `${`; the result is just past the matching `}`.
function readBraced(line: string, start: number): number | SplitFailure {
  let isInDouble = false;
  let position = start;

  while (position < line.length) {
    const char = line.charAt(position);
    const next = line.charAt(position + 1);

    if (char === '`' || (char === '$' && next === '(')) {
      return makeFailure('substitution inside ${...}');
    }

    if (char === '$' && next === '{') {
      const end = readBraced(line, position + 2);

      if (typeof end !== 'number') {
        return end;
      }

      position = end;
    } else if (char === "'" && !isInDouble) {
      const close = line.indexOf("'", position + 1);

      if (close === -1) {
        return makeFailure('unclosed ${');
      }

      position = close + 1;
    } else if (char === '}' && !isInDouble) {
      return position + 1;
    } else {
      isInDouble = char === '"' ? !isInDouble : isInDouble;
      position += char === '\\' ? 2 : 1;
    }
  }

  return makeFailure('unclosed ${');
}
