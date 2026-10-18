import { assertNever } from '../assert-never.ts';
import type { Finding, Place } from '../findings/get-findings.ts';
import { formatMessage } from './format-message.ts';
import { getCodePointName } from './get-code-point-name.ts';

export function formatFinding({ filePath, place, dashes }: Finding): string {
  const location = getLocation(filePath, place);
  const dashNames = dashes.map(getCodePointName).join(', ');

  return formatMessage(`${ location }: ${ dashNames }; use the ASCII hyphen`);
}

function getLocation(filePath: string, place: Place): string {
  const printablePath = getPrintablePath(filePath);

  switch (place.kind) {
    case 'file':
      return `${ printablePath }:${ String(place.line) }`;
    case 'new_string':
      return `${ printablePath }: new_string line ${ String(place.line) }`;
    default:
      return assertNever(place);
  }
}

// A path is printed on one line: a character that could break or hide the
// line is written as its code point.
function getPrintablePath(filePath: string): string {
  return Array.from(filePath, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;

    return isControlOrSeparator(codePoint) ? `<${ getCodePointName(codePoint) }>` : character;
  }).join('');
}

function isControlOrSeparator(codePoint: number): boolean {
  const isControl = codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f);

  return isControl || codePoint === 0x2028 || codePoint === 0x2029;
}
